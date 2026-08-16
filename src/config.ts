/**
 * Carga de la sesión. La cookie CAUTH puede venir de tres lugares, en orden:
 *   1. env COURSERA_CAUTH        — para CI / EC2 sin GUI
 *   2. store propio del CLI      — lo que escribe `coursera login`
 *   3. store del repo de recon    — la sesión que ya tenías capturada en Python
 *
 * El paso 3 existe para no obligar a re-loguearse: el token dura días.
 */
import fs from "node:fs";
import { CONFIG_DIR, RECON_SESSION_FILE, SESSION_FILE } from "./constants.ts";

export type SessionSource = "env" | "cli" | "recon";

export interface Session {
  cauth: string;
  source: SessionSource;
  capturedAt?: string;
  /** Antigüedad en horas al momento de leer. Indefinido si el store no la trae. */
  ageHours?: number;
}

interface SessionFile {
  cauth?: string;
  captured_at?: string;
  capturedAt?: string;
}

function readStore(file: string): SessionFile | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SessionFile;
  } catch {
    return null;
  }
}

function ageInHours(capturedAt: string | undefined): number | undefined {
  if (!capturedAt) return undefined;
  const then = Date.parse(capturedAt);
  if (Number.isNaN(then)) return undefined;
  return Math.round(((Date.now() - then) / 3_600_000) * 10) / 10;
}

export function loadSession(): Session | null {
  const fromEnv = process.env.COURSERA_CAUTH;
  if (fromEnv) return { cauth: fromEnv, source: "env" };

  for (const [file, source] of [
    [SESSION_FILE, "cli"],
    [RECON_SESSION_FILE, "recon"],
  ] as const) {
    const store = readStore(file);
    if (!store?.cauth) continue;
    const capturedAt = store.captured_at ?? store.capturedAt;
    return { cauth: store.cauth, source, capturedAt, ageHours: ageInHours(capturedAt) };
  }
  return null;
}

export function saveSession(cauth: string): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const body = { cauth, capturedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(body, null, 2), "utf8");
  return SESSION_FILE;
}
