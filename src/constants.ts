import os from "node:os";
import path from "node:path";

export const BASE_URL = "https://www.coursera.org";

/** Sin este User-Agent varias rutas internas responden 403 aunque CAUTH sea válida. */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Pausa entre requests al sondear items. Evita disparar protecciones del CDN. */
export const RATE_LIMIT_MS = 500;

/** Tope de páginas de memberships. 215 cursos ≈ 3 páginas; 20 es holgura, no límite real. */
export const MAX_PAGES = 20;

export const PAGE_SIZE = 100;

/** Orden de preferencia de idioma para subtítulos. Se puede pisar con --lang. */
export const DEFAULT_SUBTITLE_LANGS = ["es", "es-LA", "en"];

const XDG_CONFIG = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
const XDG_DATA = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");

export const CONFIG_DIR = path.join(XDG_CONFIG, "coursera-cli");
export const SESSION_FILE = path.join(CONFIG_DIR, "session.json");

/** Sesión heredada del repo de recon en Python. Se lee, nunca se escribe. */
export const RECON_SESSION_FILE = path.join(XDG_CONFIG, "coursera_recon", "session.json");

export const DATA_DIR = path.join(XDG_DATA, "coursera-cli");
