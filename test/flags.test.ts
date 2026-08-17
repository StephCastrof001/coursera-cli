import { describe, expect, test } from "bun:test";
import { parseFlags } from "../src/output.ts";

describe("parseFlags", () => {
  test("a text flag takes every word up to the next flag", () => {
    // The bug this fixes: `--search machine learning` used to search "machine"
    // only, silently returning extra results instead of failing.
    const flags = parseFlags(["--search", "machine", "learning"]);
    expect(flags.values.search).toBe("machine learning");
    expect(flags.positional).toEqual([]);
  });

  test("a following flag ends the previous value", () => {
    const flags = parseFlags(["--search", "machine learning", "--level", "beginner"]);
    expect(flags.values.search).toBe("machine learning");
    expect(flags.values.level).toBe("beginner");
  });

  test("known booleans never swallow the next token", () => {
    const flags = parseFlags(["transcript-slug", "--json", "--limit", "5"]);
    expect(flags.json).toBe(true);
    expect(flags.values.limit).toBe("5");
    expect(flags.positional).toEqual(["transcript-slug"]);
  });

  test("a flag with no value is a boolean", () => {
    expect(parseFlags(["--detail"]).booleans.has("detail")).toBe(true);
  });

  test("positional arguments survive alongside flags", () => {
    const flags = parseFlags(["ai-for-everyone", "--out", "C:/notes/ai"]);
    expect(flags.positional).toEqual(["ai-for-everyone"]);
    expect(flags.values.out).toBe("C:/notes/ai");
  });

  test("--json implies the machine-readable path", () => {
    expect(parseFlags(["--json"]).json).toBe(true);
    expect(parseFlags([]).json).toBe(false);
  });
});
