/** Puente entre la sesión guardada y el cliente HTTP. */
import { loadSession, type Session } from "./config.ts";
import { createClient, type Client } from "./http.ts";
import { endpoint } from "./services/endpoints.ts";
import { parseMembershipsPage } from "./services/memberships.ts";
import type { Envelope } from "./types.ts";

export interface ActiveSession {
  session: Session;
  client: Client;
}

export function requireSession(): ActiveSession {
  const session = loadSession();
  if (!session) {
    throw new Error(
      "no hay sesión: definí COURSERA_CAUTH, o corré `coursera login`, " +
        "o capturá una con capture_session.py del repo coursera_recon",
    );
  }
  return { session, client: createClient(session.cauth) };
}

export interface SessionStatus {
  source: Session["source"];
  capturedAt?: string;
  ageHours?: number;
  alive: boolean;
  totalCourses?: number;
  detail?: string;
}

/** Capturar el token no prueba que sirva: se verifica contra un endpoint real. */
export async function checkSession(): Promise<SessionStatus> {
  const { session, client } = requireSession();
  const base = { source: session.source, capturedAt: session.capturedAt, ageHours: session.ageHours };
  try {
    const payload = await client.getJson<Envelope>(endpoint("memberships", { limit: "1", start: "0" }));
    return { ...base, alive: true, totalCourses: parseMembershipsPage(payload).total };
  } catch (error) {
    return { ...base, alive: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
