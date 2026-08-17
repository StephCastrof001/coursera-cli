/**
 * Argv parsing and table rendering.
 *
 * Structured output is delegated to the cligentic `json-mode` block: stdout is
 * data, stderr is logs, and piped stdout switches to JSON on its own.
 */
import { emit as emitBlock } from "./cli/agent/json-mode.ts";
import { parseGlobalFlags, type GlobalFlags } from "./cli/foundation/global-flags.ts";

export interface Flags extends GlobalFlags {
  values: Record<string, string>;
  booleans: Set<string>;
  positional: string[];
}

const KNOWN_BOOLEANS = new Set([
  "json",
  "quiet",
  "verbose",
  "dry-run",
  "no-input",
  "detail",
  "force",
  "help",
]);

/**
 * Minimal POSIX-ish parser. A flag takes every token up to the next `--`, so
 * `--search machine learning` works without quotes.
 */
export function parseFlags(argv: string[]): Flags {
  const values: Record<string, string> = {};
  const booleans = new Set<string>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (KNOWN_BOOLEANS.has(key)) {
      booleans.add(key);
      continue;
    }
    const words: string[] = [];
    while (i + 1 < argv.length && !(argv[i + 1] as string).startsWith("--")) {
      words.push(argv[++i] as string);
    }
    if (words.length === 0) booleans.add(key);
    else values[key] = words.join(" ");
  }

  const global = parseGlobalFlags({
    json: booleans.has("json") || values.output === "json",
    quiet: booleans.has("quiet"),
    verbose: booleans.has("verbose"),
    "dry-run": booleans.has("dry-run"),
    "no-input": booleans.has("no-input"),
  });

  return { ...global, values, booleans, positional };
}

/** Human mode when attached to a TTY and `--json` was not requested. */
export function isHuman(flags: Flags): boolean {
  if (flags.json) return false;
  if (flags.values.output === "table") return true;
  return Boolean(process.stdout.isTTY);
}

export function emit(flags: Flags, data: unknown, renderHuman: () => string): void {
  if (isHuman(flags)) process.stdout.write(`${renderHuman()}\n`);
  else emitBlock(data, { json: true });
}

/** Fixed-width table. No dependencies: this is a CLI, not a dashboard. */
export function table(rows: Array<Record<string, string>>, columns: string[]): string {
  if (rows.length === 0) return "(no results)";
  const widths = columns.map((col) =>
    Math.min(60, Math.max(col.length, ...rows.map((row) => (row[col] ?? "").length))),
  );
  const line = (cells: string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i] as number).slice(0, widths[i])).join("  ");
  return [
    line(columns),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map((row) => line(columns.map((col) => row[col] ?? ""))),
  ].join("\n");
}
