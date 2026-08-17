/**
 * Pre-flight diagnosis. Answers "why is this failing?" without making the user
 * guess between a dead session, a dead route and a dead network.
 */
import fs from "node:fs";
import { renderDoctor, runDoctor, type DoctorCheck } from "../cli/agent/doctor.ts";
import { DATA_DIR, PATHS, VERSION } from "../constants.ts";
import { loadSession } from "../config.ts";
import type { Flags } from "../output.ts";
import { endpoint, endpointNames } from "../services/endpoints.ts";
import { checkSession } from "../session.ts";
import { createClient } from "../http.ts";

export async function run(flags: Flags): Promise<void> {
  const result = await runDoctor([
    async (): Promise<DoctorCheck> => ({
      name: "version",
      ok: true,
      detail: `coursera-cli ${VERSION} on ${process.platform}, ${process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.version}`}`,
    }),
    async (): Promise<DoctorCheck> => {
      const session = loadSession();
      return {
        name: "session-present",
        ok: Boolean(session),
        detail: session
          ? `found via ${session.source}${session.ageHours !== undefined ? `, ${session.ageHours} h old` : ""}`
          : "no session: set COURSERA_CAUTH or capture one",
      };
    },
    async (): Promise<DoctorCheck> => {
      const status = await checkSession();
      return {
        name: "session-alive",
        ok: status.alive,
        detail: status.alive ? `${status.totalCourses} courses visible` : (status.detail ?? "dead"),
      };
    },
    async (): Promise<DoctorCheck> => {
      const session = loadSession();
      if (!session) return { name: "endpoints", ok: false, detail: "skipped, no session" };
      const client = createClient(session.cauth);
      // One cheap live route. A 200 with HTML here means the route moved,
      // which is a very different fix from a dead session.
      try {
        await client.getJson(endpoint("domains"));
        return { name: "endpoints", ok: true, detail: `${endpointNames().length} routes declared, domains.v1 alive` };
      } catch (error) {
        return {
          name: "endpoints",
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async (): Promise<DoctorCheck> => {
      const writable = (() => {
        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
          return true;
        } catch {
          return false;
        }
      })();
      return {
        name: "paths",
        ok: writable,
        detail: writable ? `state ${PATHS.state}` : `cannot write to ${DATA_DIR}`,
      };
    },
  ]);

  renderDoctor(result, { json: flags.json });
  if (!result.ok) process.exitCode = 1;
}
