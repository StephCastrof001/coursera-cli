/**
 * Download orchestrator: tree → plan → probe → disk → manifest.
 *
 * The manifest is what lets a later read find one item without going back to
 * the API, where the signed URLs would already have expired. A separate
 * locations index remembers WHERE each course was downloaded, so `--out` does
 * not hide a course from the reader.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, DEFAULT_SUBTITLE_LANGS, LOCATIONS_FILE, RATE_LIMIT_MS } from "../constants.ts";
import type { Client } from "../http.ts";
import type { Outline, PlannedItem } from "../types.ts";
import { fetchOutline, planItems } from "./courses.ts";
import { probeItem, safeName } from "./transcripts.ts";

export interface DownloadedItem {
  itemId: string;
  name: string;
  kind: "lecture" | "supplement";
  lang?: string;
  file: string;
  bytes: number;
}

export interface Manifest {
  slug: string;
  courseId: string;
  dir: string;
  downloadedAt: string;
  items: DownloadedItem[];
  skipped: Array<{ itemId: string; name: string; type: string }>;
}

export interface DownloadOptions {
  outDir?: string;
  langs?: string[];
  /** Stop after N items. For trying a course without pulling all of it. */
  limit?: number;
  onProgress?: (done: number, total: number, item: PlannedItem) => void;
}

export function courseDir(slug: string, outDir?: string): string {
  return outDir ? path.resolve(outDir) : path.join(DATA_DIR, slug);
}

function manifestPath(dir: string): string {
  return path.join(dir, "manifest.json");
}

type Locations = Record<string, string>;

function readLocations(): Locations {
  if (!fs.existsSync(LOCATIONS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8")) as Locations;
  } catch {
    return {};
  }
}

function rememberLocation(slug: string, dir: string): void {
  fs.mkdirSync(path.dirname(LOCATIONS_FILE), { recursive: true });
  fs.writeFileSync(
    LOCATIONS_FILE,
    JSON.stringify({ ...readLocations(), [slug]: dir }, null, 2),
    "utf8",
  );
}

/**
 * Finds a downloaded course. An explicit `outDir` always wins; otherwise the
 * last known location is used, falling back to the default directory.
 */
export function readManifest(slug: string, outDir?: string): Manifest | null {
  const candidates = outDir
    ? [courseDir(slug, outDir)]
    : [readLocations()[slug], courseDir(slug)].filter((dir): dir is string => Boolean(dir));

  for (const dir of candidates) {
    const file = manifestPath(dir);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
  }
  return null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function downloadCourse(
  client: Client,
  slug: string,
  options: DownloadOptions = {},
): Promise<Manifest> {
  const outline: Outline = await fetchOutline(client, slug);
  const plan = planItems(outline);
  const selected = options.limit ? plan.slice(0, options.limit) : plan;
  const dir = courseDir(slug, options.outDir);
  fs.mkdirSync(dir, { recursive: true });

  const items: DownloadedItem[] = [];
  const skipped: Manifest["skipped"] = [];

  for (const [index, planned] of selected.entries()) {
    options.onProgress?.(index + 1, selected.length, planned);
    const result = await probeItem(
      client,
      outline.courseId,
      planned.itemId,
      options.langs ?? DEFAULT_SUBTITLE_LANGS,
    );

    if (result.kind === "empty") {
      skipped.push({ itemId: planned.itemId, name: planned.name, type: planned.type });
    } else {
      items.push(writeItem(dir, planned, result));
    }
    if (index < selected.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const manifest: Manifest = {
    slug,
    courseId: outline.courseId,
    dir,
    downloadedAt: new Date().toISOString(),
    items,
    skipped,
  };
  fs.writeFileSync(manifestPath(dir), JSON.stringify(manifest, null, 2), "utf8");
  rememberLocation(slug, dir);
  return manifest;
}

function writeItem(
  dir: string,
  planned: PlannedItem,
  result: Exclude<Awaited<ReturnType<typeof probeItem>>, { kind: "empty" }>,
): DownloadedItem {
  const moduleDir = path.join(
    dir,
    `M${String(planned.moduleIndex).padStart(2, "0")}-${safeName(planned.moduleName, 50)}`,
  );
  fs.mkdirSync(moduleDir, { recursive: true });

  const prefix = String(planned.itemIndex).padStart(2, "0");
  const base = `${prefix}-${safeName(planned.name)}`;
  const isLecture = result.kind === "lecture";
  const file = path.join(moduleDir, isLecture ? `${base}.txt` : `${base}.reading.md`);
  const body = isLecture
    ? `# ${planned.name}\n\n> ${planned.moduleName} › ${planned.lessonName} (${result.lang})\n\n${result.text}\n`
    : `# ${planned.name}\n\n> ${planned.moduleName} › ${planned.lessonName}\n\n${result.markdown}\n`;

  fs.writeFileSync(file, body, "utf8");
  return {
    itemId: planned.itemId,
    name: planned.name,
    kind: result.kind,
    lang: isLecture ? result.lang : undefined,
    file,
    bytes: Buffer.byteLength(body, "utf8"),
  };
}
