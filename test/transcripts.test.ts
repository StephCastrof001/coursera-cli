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
  test("respeta el orden de preferencia", () => {
    expect(pickSubtitle(video as VideoFixture, ["es", "en"])?.lang).toBe("es");
    expect(pickSubtitle(video as VideoFixture, ["en", "es"])?.lang).toBe("en");
  });

  test("devuelve la ruta relativa tal cual la manda la API", () => {
    const choice = pickSubtitle(video as VideoFixture, ["en"]);
    // Gotcha 5: es relativa. El cliente HTTP le antepone el host.
    expect(choice?.path.startsWith("/api/subtitleAssetProxy.v1/")).toBe(true);
  });

  test("cae a cualquier idioma antes que devolver nada", () => {
    const soloRuso = { linked: { "onDemandVideos.v1": [{ subtitlesVtt: { ru: "/api/x" } }] } };
    expect(pickSubtitle(soloRuso, ["es", "en"])?.lang).toBe("ru");
  });

  test("sin subtítulos devuelve null", () => {
    expect(pickSubtitle({ linked: { "onDemandVideos.v1": [{}] } }, ["es"])).toBeNull();
  });
});

describe("vttToText", () => {
  test("saca cabecera, numeración y timestamps", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:01.000 --> 00:00:04.000",
      "Hola, bienvenidos al curso",
      "",
      "2",
      "00:00:04.000 --> 00:00:07.500",
      "hoy vamos a hablar de modelos",
    ].join("\n");
    expect(vttToText(vtt)).toBe("Hola, bienvenidos al curso hoy vamos a hablar de modelos");
  });

  test("colapsa líneas repetidas consecutivas (roll-up captions)", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nmismo\n\n00:00:02.000 --> 00:00:03.000\nmismo";
    expect(vttToText(vtt)).toBe("mismo");
  });

  test("quita tags de posicionamiento", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Sara>hola</v>";
    expect(vttToText(vtt)).toBe("hola");
  });

  test("un vtt vacío da string vacío, no rompe", () => {
    expect(vttToText("WEBVTT\n\n")).toBe("");
  });
});

describe("supplementToMarkdown", () => {
  test("convierte el CML renderizado a markdown legible", () => {
    const markdown = supplementToMarkdown(supplement as SupplementFixture);
    expect(markdown).toContain("## Course overview");
    expect(markdown).not.toContain("<div");
    expect(markdown).not.toContain("&nbsp;");
  });

  test("sin contenido devuelve null", () => {
    expect(supplementToMarkdown({ linked: {} })).toBeNull();
  });
});

describe("safeName", () => {
  test("saca los caracteres ilegales en Windows", () => {
    expect(safeName('Módulo 1: ¿qué es "ML"? / intro')).toBe("Módulo 1 ¿qué es ML intro");
  });

  test("no deja punto final (Windows lo borra en silencio)", () => {
    expect(safeName("Wrap-up...")).toBe("Wrap-up");
  });

  test("trunca nombres largos", () => {
    expect(safeName("a".repeat(200)).length).toBe(80);
  });
});
