/**
 * Transcript extraction by polymorphic probing.
 *
 * The aggregator censors item types on preview courses, so there is no way to
 * know upfront what an item is. The strategy is to ask the atomic
 * microservices directly:
 *   Probe A → onDemandLectureVideos.v1  (video: .vtt subtitles)
 *   Probe B → onDemandSupplements.v1    (reading: CML → markdown)
 * Whichever answers 200 wins. If neither does, the item is skipped.
 *
 * Recon gotcha #7: media URLs are signed and expire. You cannot save the plan
 * today and download tomorrow — ask and fetch in the same pass.
 */
import { AppError } from "../cli/foundation/error-map.ts";
import { DEFAULT_SUBTITLE_LANGS } from "../constants.ts";
import type { Client } from "../http.ts";
import type { Envelope } from "../types.ts";
import { endpoint } from "./endpoints.ts";

interface VideoPayload extends Envelope {
  linked?: {
    "onDemandVideos.v1"?: Array<{
      subtitlesVtt?: Record<string, string>;
      subtitles?: Record<string, string>;
    }>;
  };
}

interface SupplementPayload extends Envelope {
  linked?: {
    "openCourseAssets.v1"?: Array<{
      definition?: { renderableHtmlWithMetadata?: { renderableHtml?: string } };
    }>;
  };
}

export interface SubtitleChoice {
  lang: string;
  /** RELATIVE path exactly as the API returns it. The client prepends the host. */
  path: string;
}

/**
 * Picks the subtitle language. Tries the preferences in order; if none exist it
 * falls back to whatever is available rather than returning nothing — a
 * transcript in another language beats no transcript.
 */
export function pickSubtitle(
  payload: VideoPayload,
  preferred: string[] = DEFAULT_SUBTITLE_LANGS,
): SubtitleChoice | null {
  const video = payload.linked?.["onDemandVideos.v1"]?.[0];
  const available = video?.subtitlesVtt ?? {};
  for (const lang of preferred) {
    const path = available[lang];
    if (path) return { lang, path };
  }
  const [fallbackLang, fallbackPath] = Object.entries(available)[0] ?? [];
  return fallbackLang && fallbackPath ? { lang: fallbackLang, path: fallbackPath } : null;
}

const TIMESTAMP = /^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->/;

/** Turns .vtt into running text: no cues, no timestamps, no repeated lines. */
export function vttToText(vtt: string): string {
  const lines: string[] = [];
  for (const rawLine of vtt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "WEBVTT" || TIMESTAMP.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (line.startsWith("NOTE ") || line.startsWith("Kind:") || line.startsWith("Language:")) continue;
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (clean && clean !== lines[lines.length - 1]) lines.push(clean);
  }
  return lines.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Rendered CML → poor but readable markdown. Not a general-purpose converter. */
export function supplementToMarkdown(payload: SupplementPayload): string | null {
  const html = payload.linked?.["openCourseAssets.v1"]?.[0]?.definition?.renderableHtmlWithMetadata
    ?.renderableHtml;
  if (!html) return null;
  return html
    .replace(/<h([1-6])[^>]*>/g, (_, level: string) => `\n\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/g, "\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/(p|div|ul|ol|li)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Windows-safe file name: no < > : " / \ | ? * or control chars, no trailing dots. */
export function safeName(name: string, maxLength = 80): string {
  return name
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, maxLength)
    .trim();
}

export type ProbeResult =
  | { kind: "lecture"; lang: string; text: string }
  | { kind: "supplement"; markdown: string }
  | { kind: "empty" };

/** Dual probe for one item. A failing probe must never abort the whole run. */
export async function probeItem(
  client: Client,
  courseId: string,
  itemId: string,
  langs: string[] = DEFAULT_SUBTITLE_LANGS,
): Promise<ProbeResult> {
  try {
    const video = await client.getJson<VideoPayload>(
      endpoint("lecture_video", { course_id: courseId, item_id: itemId }),
    );
    const choice = pickSubtitle(video, langs);
    if (choice) {
      const vtt = await client.getText(choice.path);
      return { kind: "lecture", lang: choice.lang, text: vttToText(vtt) };
    }
  } catch (error) {
    if (error instanceof AppError && error.code === "SESSION_EXPIRED") throw error;
  }

  try {
    const supplement = await client.getJson<SupplementPayload>(
      endpoint("supplement", { course_id: courseId, item_id: itemId }),
    );
    const markdown = supplementToMarkdown(supplement);
    if (markdown) return { kind: "supplement", markdown };
  } catch (error) {
    if (error instanceof AppError && error.code === "SESSION_EXPIRED") throw error;
  }

  return { kind: "empty" };
}
