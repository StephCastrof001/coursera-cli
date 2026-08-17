/**
 * Routes live in endpoints.json, never hardcoded: when Coursera deprecates a
 * version the fix is one line of data. That debt is what killed coursera-dl.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENDPOINTS_FILE = path.join(REPO_ROOT, "endpoints.json");

type EndpointMap = Record<string, string>;

let cache: EndpointMap | null = null;

function load(): EndpointMap {
  if (cache) return cache;
  cache = JSON.parse(fs.readFileSync(ENDPOINTS_FILE, "utf8")) as EndpointMap;
  return cache;
}

/** Comma-separated id lists must survive interpolation unescaped. */
const RAW_PARAMS = new Set(["ids"]);

/** Interpolates the {placeholders} of a route declared in endpoints.json. */
export function endpoint(name: string, params: Record<string, string> = {}): string {
  const template = load()[name];
  if (!template) throw new Error(`unknown endpoint: ${name} (check endpoints.json)`);
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`missing parameter {${key}} for endpoint ${name}`);
    return RAW_PARAMS.has(key) ? value : encodeURIComponent(value);
  });
}

export function endpointNames(): string[] {
  return Object.keys(load()).filter((key) => !key.startsWith("_") && key !== "base");
}
