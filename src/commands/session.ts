import { emit, type Flags } from "../output.ts";
import { checkSession } from "../session.ts";
import { symbols, theme } from "../ui/theme.ts";

const ORIGIN: Record<string, string> = {
  env: "COURSERA_CAUTH environment variable",
  cli: "this CLI's own store",
  legacy: "inherited store from coursera_recon (Python)",
};

export async function run(flags: Flags): Promise<void> {
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
