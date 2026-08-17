/**
 * Session loading. The CAUTH cookie can come from three places, in order:
 *   1. COURSERA_CAUTH env var   — CI, servers, anything headless
 *   2. this CLI's own store
 *   3. the Python recon repo's store
 *
 * Step 3 exists so an existing capture keeps working: the cookie lasts days.
 */
import fs from "node:fs";
import path from "node:path";
import { LEGACY_SESSION_FILE, SESSION_FILE } from "./constants.ts";

export type SessionSource = "env" | "cli" | "legacy";

export interface Session {
  cauth: string;
  source: SessionSource;
  capturedAt?: string;
  /** Age in hours at read time. Undefined when the store does not record it. */
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
    [LEGACY_SESSION_FILE, "legacy"],
  ] as const) {
    const store = readStore(file);
    if (!store?.cauth) continue;
    const capturedAt = store.captured_at ?? store.capturedAt;
    return { cauth: store.cauth, source, capturedAt, ageHours: ageInHours(capturedAt) };
  }
  return null;
}

export function saveSession(cauth: string): string {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  const body = { cauth, capturedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(body, null, 2), "utf8");
  return SESSION_FILE;
}
