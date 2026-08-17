import { describe, expect, test } from "bun:test";
import {
  pickSubtitle,
  safeName,
  supplementToMarkdown,
  vttToText,
} from "../src/services/transcripts.ts";
import video from "./fixtures/lecture_video.json" with { type: "json" };
import supplement from "./fixtures/supplement.json" with { type: "json" };

type VideoFixture = Parameters<typeof pickSubtitle>[0];
type SupplementFixture = Parameters<typeof supplementToMarkdown>[0];

describe("pickSubtitle", () => {
  test("honours the preference order", () => {
    expect(pickSubtitle(video as VideoFixture, ["es", "en"])?.lang).toBe("es");
    expect(pickSubtitle(video as VideoFixture, ["en", "es"])?.lang).toBe("en");
  });

  test("returns the relative path exactly as the API sends it", () => {
    const choice = pickSubtitle(video as VideoFixture, ["en"]);
    // Recon gotcha #5: it is relative. The HTTP client prepends the host.
    expect(choice?.path.startsWith("/api/subtitleAssetProxy.v1/")).toBe(true);
  });

  test("falls back to any language rather than returning nothing", () => {
    const russianOnly = { linked: { "onDemandVideos.v1": [{ subtitlesVtt: { ru: "/api/x" } }] } };
    expect(pickSubtitle(russianOnly, ["es", "en"])?.lang).toBe("ru");
  });

  test("returns null when there are no subtitles at all", () => {
    expect(pickSubtitle({ linked: { "onDemandVideos.v1": [{}] } }, ["es"])).toBeNull();
  });
});

describe("vttToText", () => {
  test("strips the header, cue numbers and timestamps", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:01.000 --> 00:00:04.000",
      "Welcome to the course",
      "",
      "2",
      "00:00:04.000 --> 00:00:07.500",
      "today we will talk about models",
    ].join("\n");
    expect(vttToText(vtt)).toBe("Welcome to the course today we will talk about models");
  });

  test("collapses consecutive duplicate lines (roll-up captions)", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nsame\n\n00:00:02.000 --> 00:00:03.000\nsame";
    expect(vttToText(vtt)).toBe("same");
  });

  test("removes positioning tags", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Sara>hello</v>";
    expect(vttToText(vtt)).toBe("hello");
  });

  test("an empty vtt yields an empty string instead of throwing", () => {
    expect(vttToText("WEBVTT\n\n")).toBe("");
  });
});

describe("supplementToMarkdown", () => {
  test("turns rendered CML into readable markdown", () => {
    const markdown = supplementToMarkdown(supplement as SupplementFixture);
    expect(markdown).toContain("## Course overview");
    expect(markdown).not.toContain("<div");
    expect(markdown).not.toContain("&nbsp;");
  });

  test("returns null when there is no content", () => {
    expect(supplementToMarkdown({ linked: {} })).toBeNull();
  });
});

describe("safeName", () => {
  test("strips characters Windows rejects but keeps the words", () => {
    expect(safeName('Module 1: what is "ML"? / intro')).toBe("Module 1 what is ML intro");
  });

  test("leaves no trailing dot (Windows drops it silently)", () => {
    expect(safeName("Wrap-up...")).toBe("Wrap-up");
  });

  test("truncates long names", () => {
    expect(safeName("a".repeat(200)).length).toBe(80);
  });
});
