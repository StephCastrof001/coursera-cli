import { saveSession } from "../config.ts";
import { fail } from "../errors.ts";
import { emit, type Flags } from "../output.ts";
import { checkSession } from "../session.ts";
import { symbols, theme } from "../ui/theme.ts";

const ORIGIN: Record<string, string> = {
  env: "COURSERA_CAUTH environment variable",
  cli: "this CLI's own store",
  legacy: "inherited store from coursera_recon (Python)",
};

/**
 * `coursera session set <cauth>` writes the cookie to this CLI's own store.
 *
 * Without it the only writable source was the environment variable, which dies
 * with the shell, and the third source is a file left behind by a separate
 * recon repo that nobody else has. So a fresh install had no durable place to
 * keep a session.
 */
async function set(flags: Flags): Promise<void> {
  const cauth = flags.positional[1];
  if (!cauth) fail("MISSING_ARGUMENT");

  const file = saveSession(cauth);
  const status = await checkSession();

  emit(flags, { saved: true, file, alive: status.alive, totalCourses: status.totalCourses }, () =>
    status.alive
      ? [
          `${theme.ok(`${symbols.ok} saved`)} ${theme.dim(file)}`,
          `${theme.accent(String(status.totalCourses))} courses visible`,
        ].join("\n")
      : [
          `${theme.warn("saved, but the cookie does not work")} ${theme.dim(file)}`,
          theme.dim(status.detail ?? ""),
        ].join("\n"),
  );
  if (!status.alive) process.exitCode = 1;
}

export async function run(flags: Flags): Promise<void> {
  if (flags.positional[0] === "set") return set(flags);

  const status = await checkSession();
  emit(flags, status, () => {
    const field = (name: string, value: string): string =>
      `${theme.heading(name.padEnd(10))} ${value}`;
    const lines = [
      field("source", ORIGIN[status.source] ?? status.source),
      field("captured", status.capturedAt ?? theme.dim("(unknown)")),
      field(
        "age",
        status.ageHours !== undefined ? `${status.ageHours} h` : theme.dim("(unknown)"),
      ),
      field(
        "state",
        status.alive
          ? theme.ok(`${symbols.ok} ALIVE`)
          : theme.bad(`${symbols.bad} DEAD`),
      ),
    ];
    if (status.alive) lines.push(field("courses", theme.accent(String(status.totalCourses))));
    else lines.push(field("detail", theme.dim(status.detail ?? "")));
    return lines.join("\n");
  });
  if (!status.alive) process.exitCode = 1;
}
