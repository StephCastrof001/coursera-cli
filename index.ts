#!/usr/bin/env bun
/**
 * Dispatcher. One file per command under src/commands/.
 *
 * Commands run in-process: v1 never touches Playwright. If a browser-based
 * `login` lands later, that one command routes to Node+tsx per ADR-0001 of the
 * klipso_reverse framework.
 */
import { AppError } from "./src/cli/foundation/error-map.ts";
import { VERSION } from "./src/constants.ts";
import { parseFlags } from "./src/output.ts";
import { theme } from "./src/ui/theme.ts";

type CommandModule = { run: (flags: ReturnType<typeof parseFlags>) => Promise<void> };

const COMMANDS: Record<string, () => Promise<CommandModule>> = {
  session: () => import("./src/commands/session.ts"),
  doctor: () => import("./src/commands/doctor.ts"),
  courses: () => import("./src/commands/courses.ts"),
  map: () => import("./src/commands/map.ts"),
  course: () => import("./src/commands/course.ts"),
  transcript: () => import("./src/commands/transcript.ts"),
};

/** `coursera transcript <slug>` reads better than a bare column of verbs. */
function usage(invocation: string, description: string): string {
  const [command, ...args] = invocation.split(" ");
  const call = `coursera ${theme.brand(command as string)}${args.length > 0 ? ` ${theme.dim(args.join(" "))}` : ""}`;
  const visible = `coursera ${invocation}`.length;
  return `  ${call}${" ".repeat(Math.max(2, 44 - visible))}${description}`;
}

function option(flag: string, description: string): string {
  return `  ${theme.accent(flag.padEnd(24))} ${description}`;
}

function section(title: string): string {
  return `\n${theme.heading(title)}`;
}

const HELP = [
  `${theme.heading("coursera")} ${theme.dim(VERSION)} ${theme.dim("—")} your Coursera courses from the terminal`,
  "",
  usage("session", "session state: alive or dead, and how old"),
  usage("doctor", "diagnose session, routes and paths"),
  usage("courses [filters]", "your courses"),
  usage("map [--detail]", "branches you studied and half-finished specializations"),
  usage("course <slug>", "syllabus, institution and instructors"),
  usage("transcript <slug> [--out <dir>]", "download transcripts and readings"),
  section("Filters for `courses`"),
  option("--search <text>", "name or slug; several words need no quotes"),
  option("--level <level>", "beginner | intermediate | advanced"),
  option("--domain <id>", "branch or sub-branch, e.g. data-science"),
  option("--lang es", "primary language"),
  option("--hours <n>", "at most n estimated hours"),
  option("--university <name>", "e.g. duke"),
  section("Global flags"),
  option("--json", "structured output for agents (implied when piped)"),
  option("--quiet", "suppress progress"),
  option("--limit <n>", "stop after n items (transcript)"),
  option("--lang es,en", "subtitle preference order (transcript)"),
  option("--version, --help", ""),
  "",
].join("\n");

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  /**
   * Bare `coursera` in a terminal is someone opening the front door: show the
   * wordmark and where they stand before the command list. Piped or redirected,
   * that is noise on someone's stdin — help only, and no network probe.
   */
  if (!command && process.stdout.isTTY) {
    const { renderBanner } = await import("./src/ui/banner.ts");
    process.stdout.write(await renderBanner());
    process.stdout.write(`${HELP}`);
    return;
  }
  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (command === "--version" || command === "-V" || command === "version") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const load = COMMANDS[command];
  if (!load) {
    process.stderr.write(`${theme.bad("unknown command:")} ${command}\n\n${HELP}`);
    process.exit(1);
  }
  await (await load()).run(parseFlags(rest));
}

main().catch((error: unknown) => {
  if (error instanceof AppError) {
    process.stderr.write(`${theme.bad(`ERROR [${error.code}]`)} ${error.human}\n`);
    if (error.hint) process.stderr.write(`  ${theme.accent("→")} ${error.hint}\n`);
  } else {
    process.stderr.write(
      `${theme.bad("ERROR:")} ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
  process.exit(1);
});
