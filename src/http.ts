/**
 * HTTP client. It knows how to authenticate and fetch — it knows no routes.
 *
 * Recon gotcha #1: without `Accept: application/json` Coursera negotiates
 * content and serves the SPA's HTML with status 200.
 */
import { BASE_URL, USER_AGENT } from "./constants.ts";
import { fail } from "./errors.ts";

export interface Client {
  getJson<T>(target: string): Promise<T>;
  getText(target: string): Promise<string>;
  getBytes(target: string): Promise<Uint8Array>;
}

function buildHeaders(cauth: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "x-requested-with": "XMLHttpRequest",
    referer: `${BASE_URL}/`,
    "user-agent": USER_AGENT,
    cookie: `CAUTH=${cauth}`,
  };
}

/** Relative paths (subtitle assets, for one) need the host prepended. */
function absolute(target: string): string {
  return target.startsWith("http") ? target : BASE_URL + target;
}

async function request(target: string, cauth: string, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(absolute(target), {
      headers: buildHeaders(cauth),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    fail("NETWORK", cause);
  }
  if (res.status === 401 || res.status === 403) fail("SESSION_EXPIRED", target);
  if (res.status === 404) fail("NOT_FOUND", target);
  if (!res.ok) fail("HTTP_ERROR", `${res.status} ${target}`);
  return res;
}

export function createClient(cauth: string, timeoutMs = 30_000): Client {
  return {
    async getJson<T>(target: string): Promise<T> {
      const res = await request(target, cauth, timeoutMs);
      const text = await res.text();
      const head = text.trimStart();
      if (!head.startsWith("{") && !head.startsWith("[")) fail("ROUTE_GONE", target);
      return JSON.parse(text) as T;
    },

    async getText(target: string): Promise<string> {
      return (await request(target, cauth, timeoutMs)).text();
    },

    async getBytes(target: string): Promise<Uint8Array> {
      return new Uint8Array(await (await request(target, cauth, timeoutMs)).arrayBuffer());
    },
  };
}
