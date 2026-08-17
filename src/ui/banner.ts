/**
 * The wordmark and the status dashboard shown when `coursera` runs bare.
 *
 * Two rules keep this from slowing the CLI down:
 *   1. Nothing here is imported by a command. The dispatcher pulls it in only
 *      on the bare-invocation path, so `coursera courses` never pays for it.
 *   2. The session probe is a dynamic import behind a timeout. Reaching for
 *      `../session.ts` at module scope would drag the whole HTTP and service
 *      graph into every start-up.
 */
import fs from "node:fs";
import { LOCATIONS_FILE, VERSION } from "../constants.ts";
import { theme, symbols } from "./theme.ts";

/**
 * "COURSERA" in the ANSI Regular block font: 63 columns plus a two-space
 * indent. Anything wider wraps in an 80-column terminal and stops looking
 * like a logo.
 */
const WORDMARK = [
  " ██████  █████  ██   ██ ██████  ███████ ███████ ██████   █████ ",
  "██      ██   ██ ██   ██ ██   ██ ██      ██      ██   ██ ██   ██",
  "██      ██   ██ ██   ██ ██████  ███████ █████   ██████  ███████",
  "██      ██   ██ ██   ██ ██   ██      ██ ██      ██   ██ ██   ██",
  " ██████  █████   █████  ██   ██ ███████ ███████ ██   ██ ██   ██",
];

/** The wordmark, faded top to bottom through Coursera blue. */
export function renderWordmark(): string {
  return WORDMARK.map((row, i) =>
    theme.brandAt(i / (WORDMARK.length - 1), `  ${row}`),
  ).join("\n");
}

export function renderHeader(): string {
  return [
    "",
    renderWordmark(),
    "",
    `  ${theme.dim(`v${VERSION}`)}  ${theme.dim(symbols.bullet)}  ${theme.dim("Your Coursera courses from the terminal")}`,
    "",
  ].join("\n");
}

/** Counts courses that have been downloaded at least once. */
function downloadedCount(): number {
  try {
    const raw = fs.readFileSync(LOCATIONS_FILE, "utf8");
    return Object.keys(JSON.parse(raw) as Record<string, string>).length;
  } catch {
    return 0;
  }
}

/** Fixed-width gutter so every dashboard value starts in the same column. */
const GUTTER = 11;

function label(name: string): string {
  if (!name) return " ".repeat(2 + GUTTER);
  return `  ${theme.heading(`${name}:`)}${" ".repeat(Math.max(1, GUTTER - name.length - 1))}`;
}

/**
 * Probes the session, but never lets a slow network hold the banner hostage:
 * after `timeoutMs` the dashboard says so and the help text still prints.
 */
async function probeSession(timeoutMs: number): Promise<string> {
  const { loadSession } = await import("../config.ts");
  if (!loadSession()) {
    return `${label("Session")}${theme.bad(`${symbols.bad} none`)} ${theme.dim("(set COURSERA_CAUTH, or capture one — see `coursera doctor`)")}`;
  }

  const { checkSession } = await import("../session.ts");
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const status = await Promise.race([checkSession().catch(() => null), timeout]);

  if (!status) {
    return `${label("Session")}${theme.warn("unreachable")} ${theme.dim("(coursera.org did not answer in time)")}`;
  }
  const age =
    status.ageHours !== undefined ? theme.dim(` (captured ${status.ageHours}h ago)`) : "";
  if (!status.alive) {
    return [
      `${label("Session")}${theme.bad(`${symbols.bad} expired`)}${age}`,
      `${label("")}${theme.dim("capture a fresh CAUTH cookie — it lasts days, not hours")}`,
    ].join("\n");
  }
  return [
    `${label("Session")}${theme.ok(`${symbols.ok} alive`)}${age}`,
    `${label("Courses")}${theme.accent(String(status.totalCourses ?? "?"))} ${theme.dim("enrolled")}`,
  ].join("\n");
}

/** Banner plus dashboard. Returns the text; the caller decides the stream. */
export async function renderBanner(options: { timeoutMs?: number } = {}): Promise<string> {
  const downloaded = downloadedCount();
  const lines = [
    renderHeader(),
    await probeSession(options.timeoutMs ?? 5_000),
    `${label("Downloads")}${theme.accent(String(downloaded))} ${theme.dim(downloaded === 1 ? "course cached locally" : "courses cached locally")}`,
    "",
  ];
  return lines.join("\n");
}
