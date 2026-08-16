/**
 * Las rutas viven en endpoints.json, nunca hardcodeadas: cuando Coursera
 * deprecia una versión el fix es una línea de datos. Esa deuda mató a coursera-dl.
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
  const raw = JSON.parse(fs.readFileSync(ENDPOINTS_FILE, "utf8")) as EndpointMap;
  cache = raw;
  return raw;
}

/** Interpola {placeholders} de una ruta declarada en endpoints.json. */
export function endpoint(name: string, params: Record<string, string> = {}): string {
  const template = load()[name];
  if (!template) throw new Error(`endpoint desconocido: ${name} (revisá endpoints.json)`);
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`falta el parámetro {${key}} para el endpoint ${name}`);
    return encodeURIComponent(value);
  });
}
