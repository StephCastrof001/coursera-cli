import { emit, type Flags } from "../output.ts";
import { checkSession } from "../session.ts";

const ORIGIN: Record<string, string> = {
  env: "COURSERA_CAUTH environment variable",
  cli: "this CLI's own store",
  legacy: "inherited store from coursera_recon (Python)",
};

export async function run(flags: Flags): Promise<void> {
  const status = await checkSession();
  emit(flags, status, () => {
    const lines = [
      `source     ${ORIGIN[status.source] ?? status.source}`,
      `captured   ${status.capturedAt ?? "(unknown)"}`,
      `age        ${status.ageHours !== undefined ? `${status.ageHours} h` : "(unknown)"}`,
      `state      ${status.alive ? "ALIVE" : "DEAD"}`,
    ];
    if (status.alive) lines.push(`courses    ${status.totalCourses}`);
    else lines.push(`detail     ${status.detail ?? ""}`);
    return lines.join("\n");
  });
  if (!status.alive) process.exitCode = 1;
}
