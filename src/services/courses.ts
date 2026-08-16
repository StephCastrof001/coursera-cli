/**
 * Reconstrucción del árbol del curso.
 *
 * La API no devuelve el árbol armado: manda tres listas planas en `linked`
 * (módulos, lecciones, items) más los ids que las cosen. Acá se cosen.
 *
 * Regla del desbloqueo: NO se filtra por typeName al construir. En cursos en
 * preview el agregador censura ese campo, y filtrar temprano se come el 75%
 * del temario asumiendo que los módulos futuros están vacíos.
 */
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
  /** typeName vive anidado acá dentro, no en la raíz del item. */
  contentSummary?: { typeName?: string };
}

function indexById<T extends { id: string }>(rows: unknown[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of (rows ?? []) as T[]) if (row?.id) map.set(row.id, row);
  return map;
}

export function buildOutline(payload: Envelope<{ id?: string; moduleIds?: string[] }>, slug: string): Outline {
  const root = payload.elements?.[0];
  if (!root?.id) throw new Error(`respuesta sin courseId para el slug "${slug}"`);

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
      return { id: lessonId, name: rawLesson?.name ?? `Lección ${lessonId}`, items };
    });
    return { id: moduleId, name: rawModule?.name ?? `Módulo ${moduleId}`, lessons };
  });

  return { courseId: root.id, slug, modules };
}

/** Si el agregador censuró el nombre, se deriva del título de la lección padre. */
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
  const payload = await client.getJson<Envelope<{ id?: string; moduleIds?: string[] }>>(
    endpoint("materials", { slug }),
  );
  return buildOutline(payload, slug);
}

/** Aplana el árbol a una lista de descargas, conservando la posición para nombrar archivos. */
export function planItems(outline: Outline, types?: string[]): PlannedItem[] {
  const plan: PlannedItem[] = [];
  outline.modules.forEach((module, moduleIndex) => {
    let itemIndex = 0;
    for (const lesson of module.lessons) {
      for (const item of lesson.items) {
        itemIndex++;
        // `unknown` siempre pasa: es un item censurado, no un item descartable.
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
    (total, module) =>
      total + module.lessons.reduce((sum, lesson) => sum + lesson.items.length, 0),
    0,
  );
}
