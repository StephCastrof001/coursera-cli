import { describe, expect, test } from "bun:test";
import { table } from "../src/output.ts";
import { detectTruecolor, theme } from "../src/ui/theme.ts";

const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const strip = (text: string): string => text.replace(ANSI, "");

describe("detectTruecolor", () => {
  test("trusts COLORTERM when the terminal sets it", () => {
    expect(detectTruecolor({ COLORTERM: "truecolor" }, true)).toBe(true);
    expect(detectTruecolor({ COLORTERM: "24bit" }, true)).toBe(true);
  });

  /**
   * The regression that motivated this file: COLORTERM is a Unix convention and
   * Windows Terminal never sets it, so keying off COLORTERM alone downgraded the
   * brand blue to plain ANSI blue on the default terminal of this project.
   */
  test("recognises Windows Terminal, which sets WT_SESSION and no COLORTERM", () => {
    expect(detectTruecolor({ WT_SESSION: "7bf78c4f" }, true)).toBe(true);
  });

  test("recognises terminals that identify through TERM_PROGRAM", () => {
    expect(detectTruecolor({ TERM_PROGRAM: "vscode" }, true)).toBe(true);
    expect(detectTruecolor({ TERM_PROGRAM: "iTerm.app" }, true)).toBe(true);
    expect(detectTruecolor({ TERM_PROGRAM: "WezTerm" }, true)).toBe(true);
  });

  test("reads a direct-colour TERM entry", () => {
    expect(detectTruecolor({ TERM: "xterm-direct" }, true)).toBe(true);
  });

  test("says no when nothing advertises 24-bit colour", () => {
    expect(detectTruecolor({}, true)).toBe(false);
    expect(detectTruecolor({ TERM: "xterm-256color" }, true)).toBe(false);
  });

  test("stays off whenever colour itself is off, however capable the terminal", () => {
    expect(detectTruecolor({ WT_SESSION: "abc", COLORTERM: "truecolor" }, false)).toBe(false);
  });
});

describe("theme.level", () => {
  /**
   * Levels arrive already padded to their column width. Matching on the padded
   * string meant only INTERMEDIATE — whose name happens to equal that width —
   * ever got a colour.
   */
  test("colours a level that arrives padded", () => {
    const padded = "BEGINNER    ";
    expect(strip(theme.level(padded))).toBe(padded);
    expect(theme.level(padded)).not.toBe(padded);
  });

  test("gives different levels different colours", () => {
    const colours = ["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((l) => theme.level(l));
    expect(new Set(colours).size).toBe(3);
  });
});

describe("table", () => {
  const rows = [
    { slug: "python-data-analysis", level: "INTERMEDIATE", name: "Intro to Data Science" },
    { slug: "linear-regression", level: "BEGINNER", name: "Linear Regression" },
  ];
  const columns = ["slug", "level", "name"];

  /**
   * ANSI escapes are characters to padEnd and slice, so colouring before padding
   * silently shreds every column boundary. Stripping colour must leave rows of
   * one identical width.
   */
  test("keeps every row the same width once colour is stripped", () => {
    const rendered = table(rows, columns, { slug: theme.brand, level: theme.level });
    const widths = new Set(rendered.split("\n").map((line) => [...strip(line)].length));
    expect(widths.size).toBe(1);
  });

  test("renders the same text with and without colourisers", () => {
    const plain = table(rows, columns);
    const painted = table(rows, columns, { slug: theme.brand, level: theme.level });
    expect(strip(painted)).toBe(strip(plain));
  });

  test("says so when there is nothing to show", () => {
    expect(strip(table([], columns))).toBe("(no results)");
  });
});
