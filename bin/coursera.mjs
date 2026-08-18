#!/usr/bin/env node
/**
 * Launcher for the `coursera` command.
 *
 * The CLI itself is TypeScript run by Bun. Pointing `bin` straight at
 * `index.ts` works only when Bun is on PATH, and when it is not the user gets
 * `exec: bun: not found` — a message that names neither Bun nor this package.
 * Anyone installing from npm has Node by definition, so Node answers the door:
 * it finds Bun even where PATH does not, and says something useful when Bun is
 * genuinely absent.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(packageRoot, "index.ts");
const windows = process.platform === "win32";
const exe = windows ? "bun.exe" : "bun";

/**
 * Resolves Bun to an absolute path.
 *
 * PATH is walked here rather than delegated to a shell: spawning with
 * `shell: true` concatenates arguments instead of escaping them, and these
 * arguments come from whoever typed the command. Searching PATH directly keeps
 * the spawn argument-safe and still finds a Bun that PATH does not advertise —
 * the case this launcher exists for.
 */
function findBun() {
  const fromPath = (process.env.PATH ?? "")
    .split(windows ? ";" : ":")
    .filter(Boolean)
    .map((dir) => join(dir, exe));

  const wellKnown = windows
    ? [join(process.env.USERPROFILE ?? homedir(), ".bun", "bin", exe)]
    : [join(homedir(), ".bun", "bin", exe), "/usr/local/bin/bun", "/opt/homebrew/bin/bun"];

  return [...fromPath, ...wellKnown].find((candidate) => existsSync(candidate)) ?? null;
}

function missingBun() {
  process.stderr.write(
    [
      "",
      "  coursera-cli runs on Bun, and Bun was not found.",
      "",
      "  Install it:  https://bun.sh",
      "    macOS, Linux, WSL   curl -fsSL https://bun.sh/install | bash",
      "    Windows             powershell -c \"irm bun.sh/install.ps1 | iex\"",
      "",
      "  Already installed? Bun is probably not on your PATH. This launcher",
      `  also looks in ${join(homedir(), ".bun", "bin", exe)}.`,
      "",
    ].join("\n"),
  );
  process.exit(127);
}

const bun = findBun();
if (!bun) missingBun();

const child = spawn(bun, ["run", entry, ...process.argv.slice(2)], { stdio: "inherit" });

child.on("error", (error) => {
  if (error.code === "ENOENT") missingBun();
  process.stderr.write(`coursera: could not start Bun: ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
