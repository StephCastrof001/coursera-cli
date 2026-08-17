/** Bridge between the stored session and the HTTP client. */
import { loadSession, type Session } from "./config.ts";
import { fail } from "./errors.ts";
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
  if (!session) fail("NO_SESSION");
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

/** Capturing a token does not prove it works: verify against a real endpoint. */
export async function checkSession(): Promise<SessionStatus> {
  const { session, client } = requireSession();
  const base = {
    source: session.source,
    capturedAt: session.capturedAt,
    ageHours: session.ageHours,
  };
  try {
    const payload = await client.getJson<Envelope>(
      endpoint("memberships", { limit: "1", start: "0" }),
    );
    return { ...base, alive: true, totalCourses: parseMembershipsPage(payload).total };
  } catch (error) {
    return { ...base, alive: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
