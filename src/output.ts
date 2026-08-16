/**
 * Agent-first IO: todo comando soporta --output json.
 * El default es `auto` — tabla si hay TTY, json si el output está redirigido.
 */
export type OutputMode = "json" | "table" | "auto";

export interface Flags {
  output: OutputMode;
  values: Record<string, string>;
  booleans: Set<string>;
  positional: string[];
}

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
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      values[key] = next;
      i++;
    } else {
      booleans.add(key);
    }
  }

  const requested = values.output as OutputMode | undefined;
  const output: OutputMode = requested ?? (booleans.has("json") ? "json" : "auto");
  return { output, values, booleans, positional };
}

export function resolveMode(mode: OutputMode): "json" | "table" {
  if (mode !== "auto") return mode;
  return process.stdout.isTTY ? "table" : "json";
}

export function emit(mode: OutputMode, data: unknown, renderTable: () => string): void {
  if (resolveMode(mode) === "json") {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderTable()}\n`);
  }
}

/** Tabla mínima de ancho fijo. Sin dependencias: es una CLI, no un dashboard. */
export function table(rows: Array<Record<string, string>>, columns: string[]): string {
  if (rows.length === 0) return "(sin resultados)";
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

export function fail(message: string, hint?: string): never {
  process.stderr.write(`ERROR: ${message}\n`);
  if (hint) process.stderr.write(`  → ${hint}\n`);
  process.exit(1);
}
