/**
 * Cliente HTTP. No conoce rutas — sólo autentica y pega.
 *
 * Gotcha 1 del RESEARCH: sin `Accept: application/json` Coursera negocia
 * contenido y devuelve el HTML de la SPA con status 200. Un 200 con HTML NO
 * significa sesión vencida, significa request mal armado. 401/403 sí es sesión.
 */
import { BASE_URL, USER_AGENT } from "./constants.ts";

export type ErrorKind = "unauthorized" | "not_found" | "html_response" | "http" | "network";

/** Error tipado: los agentes necesitan discriminar el fallo, no parsear un string. */
export class CourseraError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  readonly path: string;

  constructor(kind: ErrorKind, message: string, path: string, status?: number) {
    super(message);
    this.name = "CourseraError";
    this.kind = kind;
    this.path = path;
    this.status = status;
  }
}

export interface Client {
  getJson<T>(path: string): Promise<T>;
  getText(path: string): Promise<string>;
  getBytes(path: string): Promise<Uint8Array>;
}

function headers(cauth: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "x-requested-with": "XMLHttpRequest",
    referer: `${BASE_URL}/`,
    "user-agent": USER_AGENT,
    cookie: `CAUTH=${cauth}`,
  };
}

/** Las rutas relativas (ej. subtitlesVtt) necesitan el host antepuesto. */
function absolute(target: string): string {
  return target.startsWith("http") ? target : BASE_URL + target;
}

async function request(target: string, cauth: string, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(absolute(target), {
      headers: headers(cauth),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new CourseraError("network", `fallo de red: ${String(cause)}`, target);
  }
  if (res.status === 401 || res.status === 403) {
    throw new CourseraError("unauthorized", "sesión CAUTH inválida o vencida", target, res.status);
  }
  if (res.status === 404) {
    throw new CourseraError("not_found", "no existe", target, 404);
  }
  if (!res.ok) {
    throw new CourseraError("http", `HTTP ${res.status}`, target, res.status);
  }
  return res;
}

export function createClient(cauth: string, timeoutMs = 30_000): Client {
  return {
    async getJson<T>(target: string): Promise<T> {
      const res = await request(target, cauth, timeoutMs);
      const text = await res.text();
      if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
        throw new CourseraError(
          "html_response",
          "200 pero HTML: ruta deprecada o request mal armado (no es la sesión)",
          target,
          200,
        );
      }
      return JSON.parse(text) as T;
    },

    async getText(target: string): Promise<string> {
      const res = await request(target, cauth, timeoutMs);
      return res.text();
    },

    async getBytes(target: string): Promise<Uint8Array> {
      const res = await request(target, cauth, timeoutMs);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
