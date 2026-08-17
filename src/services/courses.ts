/**
 * Rebuilding the course tree.
 *
 * The API never returns a tree: it sends three flat lists in `linked` (modules,
 * lessons, items) plus the ids that stitch them together. This is the stitching.
 *
 * Unlock rule: NEVER filter by typeName while building. Preview courses have
 * that field censored, and filtering early throws away 75% of the syllabus.
 */
import { fail } from "../errors.ts";
import type { Client } from "../http.ts";
import type { Envelope, Item, Lesson, Module, Outline, PlannedItem } from "../types.ts";
import { endpoint } from "./endpoints.ts";

interface RawModule {
  id: string;
  name?: string;
  lessonIds?: string[];
}
interface RawLesson {
  id: string;
  name?: string;
  itemIds?: string[];
}
interface RawItem {
  id: string;
  name?: string;
  slug?: string;
  /** typeName is nested in here, not at the item root. */
  contentSummary?: { typeName?: string };
}

type MaterialsEnvelope = Envelope<{ id?: string; moduleIds?: string[] }>;

function indexById<T extends { id: string }>(rows: unknown[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of (rows ?? []) as T[]) if (row?.id) map.set(row.id, row);
  return map;
}

export function buildOutline(payload: MaterialsEnvelope, slug: string): Outline {
  const root = payload.elements?.[0];
  if (!root?.id) fail("NOT_FOUND", `no courseId for slug "${slug}"`);

  const modulesById = indexById<RawModule>(payload.linked?.["onDemandCourseMaterialModules.v1"]);
  const lessonsById = indexById<RawLesson>(payload.linked?.["onDemandCourseMaterialLessons.v1"]);
  const itemsById = indexById<RawItem>(payload.linked?.["onDemandCourseMaterialItems.v2"]);

  const modules: Module[] = (root.moduleIds ?? []).map((moduleId) => {
    const rawModule = modulesById.get(moduleId);
    const lessons: Lesson[] = (rawModule?.lessonIds ?? []).map((lessonId) => {
      const rawLesson = lessonsById.get(lessonId);
      const items: Item[] = (rawLesson?.itemIds ?? []).map((itemId) =>
        toItem(itemId, itemsById.get(itemId), rawLesson?.name),
      );
      return { id: lessonId, name: rawLesson?.name ?? `Lesson ${lessonId}`, items };
    });
    return { id: moduleId, name: rawModule?.name ?? `Module ${moduleId}`, lessons };
  });

  return { courseId: root.id, slug, modules };
}

/** When the aggregator censors the name, derive it from the parent lesson title. */
function toItem(itemId: string, raw: RawItem | undefined, lessonName: string | undefined): Item {
  const name = raw?.name?.trim();
  return {
    id: itemId,
    name: name && name !== "?" ? name : `${lessonName ?? "Item"} (${itemId})`,
    slug: raw?.slug,
    type: raw?.contentSummary?.typeName?.trim() || "unknown",
  };
}

export async function fetchOutline(client: Client, slug: string): Promise<Outline> {
  const payload = await client.getJson<MaterialsEnvelope>(endpoint("materials", { slug }));
  return buildOutline(payload, slug);
}

/** Flattens the tree into a download list, keeping position for file naming. */
export function planItems(outline: Outline, types?: string[]): PlannedItem[] {
  const plan: PlannedItem[] = [];
  outline.modules.forEach((module, moduleIndex) => {
    let itemIndex = 0;
    for (const lesson of module.lessons) {
      for (const item of lesson.items) {
        itemIndex++;
        // `unknown` always passes: it is a censored item, not a discardable one.
        if (types && item.type !== "unknown" && !types.includes(item.type)) continue;
        plan.push({
          itemId: item.id,
          name: item.name,
          type: item.type,
          moduleIndex: moduleIndex + 1,
          moduleName: module.name,
          lessonName: lesson.name,
          itemIndex,
        });
      }
    }
  });
  return plan;
}

export function countItems(outline: Outline): number {
  return outline.modules.reduce(
    (total, module) => total + module.lessons.reduce((sum, lesson) => sum + lesson.items.length, 0),
    0,
  );
}
