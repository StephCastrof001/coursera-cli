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

type CommandModule = { run: (flags: ReturnType<typeof parseFlags>) => Promise<void> };

const COMMANDS: Record<string, () => Promise<CommandModule>> = {
  session: () => import("./src/commands/session.ts"),
  doctor: () => import("./src/commands/doctor.ts"),
  courses: () => import("./src/commands/courses.ts"),
  map: () => import("./src/commands/map.ts"),
  course: () => import("./src/commands/course.ts"),
  transcript: () => import("./src/commands/transcript.ts"),
};

const HELP = `coursera ${VERSION} — your Coursera courses from the terminal

  coursera session                          session state: alive or dead, and how old
  coursera doctor                           diagnose session, routes and paths
  coursera courses [filters]                your courses
  coursera map [--detail]                   branches you studied and half-finished specializations
  coursera course <slug>                    syllabus, institution and instructors
  coursera transcript <slug> [--out <dir>]  download transcripts and readings

Filters for \`courses\`:
  --search <text>          name or slug; several words need no quotes
  --level beginner|intermediate|advanced
  --domain <id>            branch or sub-branch, e.g. data-science
  --lang es                primary language
  --hours <n>              at most n estimated hours
  --university <name>      e.g. duke

Global flags:
  --json                   structured output for agents (implied when piped)
  --quiet                  suppress progress
  --limit <n>              stop after n items (transcript)
  --lang es,en             subtitle preference order (transcript)
  --version, --help
`;

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

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
    process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
    process.exit(1);
  }
  await (await load()).run(parseFlags(rest));
}

main().catch((error: unknown) => {
  if (error instanceof AppError) {
    process.stderr.write(`ERROR [${error.code}] ${error.human}\n`);
    if (error.hint) process.stderr.write(`  → ${error.hint}\n`);
  } else {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
});
