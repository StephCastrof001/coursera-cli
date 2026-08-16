/**
 * Extracción de transcripts por sondeo polimórfico.
 *
 * El agregador censura el tipo de los items en cursos en preview, así que no
 * se puede saber de antemano qué es cada item. La estrategia es preguntarle
 * directo a los microservicios atómicos:
 *   Sonda A → onDemandLectureVideos.v1  (video: subtítulos .vtt)
 *   Sonda B → onDemandSupplements.v1    (lectura: CML → markdown)
 * Lo que responda 200 gana. Si ninguna responde, el item se salta.
 *
 * Gotcha 7: las URLs de media van firmadas y expiran. No se puede guardar el
 * plan hoy y bajar mañana — hay que pedir y bajar en la misma pasada.
 */
import { DEFAULT_SUBTITLE_LANGS } from "../constants.ts";
import { CourseraError, type Client } from "../http.ts";
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
  /** Ruta RELATIVA tal como la manda la API. El cliente le antepone el host. */
  path: string;
}

/**
 * Elige idioma de subtítulos. Prueba las preferencias en orden; si ninguna
 * existe, cae al primero disponible antes que devolver nada — un transcript
 * en otro idioma es más útil que ningún transcript.
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

/** Convierte .vtt a texto corrido: sin cues, sin timestamps, sin líneas repetidas. */
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

/** CML renderizado → markdown pobre pero legible. No es un conversor general. */
export function supplementToMarkdown(payload: SupplementPayload): string | null {
  const html = payload.linked?.["openCourseAssets.v1"]?.[0]?.definition
    ?.renderableHtmlWithMetadata?.renderableHtml;
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

/** Nombre de archivo seguro en Windows: sin < > : " / \ | ? * ni puntos finales. */
export function safeName(name: string, maxLength = 80): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
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

/** Sondeo dual de un item. Ninguna sonda que falle debe abortar la corrida. */
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
    if (error instanceof CourseraError && error.kind === "unauthorized") throw error;
  }

  try {
    const supplement = await client.getJson<SupplementPayload>(
      endpoint("supplement", { course_id: courseId, item_id: itemId }),
    );
    const markdown = supplementToMarkdown(supplement);
    if (markdown) return { kind: "supplement", markdown };
  } catch (error) {
    if (error instanceof CourseraError && error.kind === "unauthorized") throw error;
  }

  return { kind: "empty" };
}
