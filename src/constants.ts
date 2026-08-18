import os from "node:os";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };
import { getAppPaths } from "./cli/foundation/xdg-paths.ts";

/** Read from package.json so `--version` can never drift from what npm serves. */
export const VERSION: string = pkg.version;
export const APP_NAME = "coursera-cli";

export const BASE_URL = "https://www.coursera.org";

/** Several internal routes answer 403 without this User-Agent, valid cookie or not. */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Pause between item probes. Keeps the CDN from rate-limiting the run. */
export const RATE_LIMIT_MS = 500;

/** Page cap for memberships. 215 courses is 3 pages; 20 is headroom, not a real limit. */
export const MAX_PAGES = 20;

export const PAGE_SIZE = 100;

/** Subtitle language preference order. Override with --lang. */
export const DEFAULT_SUBTITLE_LANGS = ["es", "es-LA", "en"];

export const PATHS = getAppPaths(APP_NAME);

export const SESSION_FILE = path.join(PATHS.sessions, "session.json");

/** Where downloaded courses land unless --out says otherwise. */
export const DATA_DIR = path.join(PATHS.state, "courses");

/** Index of where each course was last downloaded, so reads can find it again. */
export const LOCATIONS_FILE = path.join(PATHS.state, "locations.json");

/**
 * Session inherited from the Python recon repo. Read-only: this CLI never
 * writes there. Kept so an existing capture keeps working without a re-login.
 */
export const LEGACY_SESSION_FILE = path.join(
  process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
  "coursera_recon",
  "session.json",
);
