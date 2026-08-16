#!/usr/bin/env bun
/**
 * Dispatcher. Un archivo por comando en src/commands/.
 *
 * No usa Bun.spawn para rutear (patrón del framework para runtime híbrido):
 * v1 no toca Playwright, así que todo corre en el mismo proceso. Si más
 * adelante entra `login` con browser, ese comando sí se rutea a Node+tsx
 * según ADR-0001.
 */
import { CourseraError } from "./src/http.ts";
import { parseFlags } from "./src/output.ts";

const COMMANDS: Record<string, () => Promise<{ run: (flags: ReturnType<typeof parseFlags>) => Promise<void> }>> = {
  session: () => import("./src/commands/session.ts"),
  courses: () => import("./src/commands/courses.ts"),
  course: () => import("./src/commands/course.ts"),
  transcript: () => import("./src/commands/transcript.ts"),
};

const HELP = `coursera — tus cursos de Coursera desde la terminal

  coursera session                          estado de la sesión (viva/muerta, antigüedad)
  coursera courses [--buscar <texto>]       tus cursos; con --buscar filtra por nombre o slug
  coursera course <slug>                    árbol de módulos, lecciones e items
  coursera transcript <slug> [--out <dir>]  baja transcripts y lecturas

Flags globales:
  --output json|table|auto   default auto (tabla en terminal, json si redirigís)
  --limit <n>                corta después de n items (transcript)
  --lang es,en               orden de preferencia de subtítulos
`;

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }
  const load = COMMANDS[command];
  if (!load) {
    process.stderr.write(`comando desconocido: ${command}\n\n${HELP}`);
    process.exit(1);
  }
  const module = await load();
  await module.run(parseFlags(rest));
}

main().catch((error: unknown) => {
  if (error instanceof CourseraError) {
    process.stderr.write(`ERROR [${error.kind}] ${error.message}\n  ruta: ${error.path}\n`);
    if (error.kind === "unauthorized") {
      process.stderr.write("  → la sesión venció. Recapturá la cookie CAUTH.\n");
    }
  } else {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
});
