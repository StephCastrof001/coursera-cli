import { emit, type Flags } from "../output.ts";
import { checkSession } from "../session.ts";

const ORIGIN: Record<string, string> = {
  env: "variable de entorno COURSERA_CAUTH",
  cli: "store propio del CLI",
  recon: "store heredado de coursera_recon (Python)",
};

export async function run(flags: Flags): Promise<void> {
  const status = await checkSession();
  emit(flags.output, status, () => {
    const lines = [
      `origen      ${ORIGIN[status.source] ?? status.source}`,
      `capturada   ${status.capturedAt ?? "(desconocida)"}`,
      `antigüedad  ${status.ageHours !== undefined ? `${status.ageHours} h` : "(desconocida)"}`,
      `estado      ${status.alive ? "VIVA" : "MUERTA"}`,
    ];
    if (status.alive) lines.push(`cursos      ${status.totalCourses}`);
    else lines.push(`detalle     ${status.detail ?? ""}`);
    return lines.join("\n");
  });
  if (!status.alive) process.exitCode = 1;
}
