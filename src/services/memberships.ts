/**
 * Memberships = el vínculo cuenta↔curso. NO es el curso.
 *
 * El endpoint tiene un `limit` máximo y devuelve `paging.total` con el real.
 * Sin recorrer el cursor, un `limit=100` sobre 215 memberships trunca en
 * silencio: el buscador no vería más de la mitad de la biblioteca.
 */
import { MAX_PAGES, PAGE_SIZE } from "../constants.ts";
import type { Client } from "../http.ts";
import type { Course, Envelope } from "../types.ts";
import { endpoint } from "./endpoints.ts";

export interface MembershipsPage {
  courses: Course[];
  next?: string;
  total: number;
}

/** Extrae los cursos de una página. Vienen en `linked`, no en `elements`. */
export function parseMembershipsPage(payload: Envelope): MembershipsPage {
  const linked = (payload.linked?.["courses.v1"] ?? []) as Array<Partial<Course>>;
  const courses = linked
    .filter((c): c is Course => Boolean(c.id && c.slug && c.name))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      courseType: c.courseType,
      domainTypes: c.domainTypes,
      workload: c.workload,
      primaryLanguages: c.primaryLanguages,
      partnerIds: c.partnerIds,
    }));
  return {
    courses,
    next: payload.paging?.next,
    total: payload.paging?.total ?? courses.length,
  };
}

/** Recorre el cursor hasta agotar `paging.next`. Deduplica por id. */
export async function listCourses(client: Client): Promise<Course[]> {
  const seen = new Map<string, Course>();
  let start = "0";

  for (let page = 0; page < MAX_PAGES; page++) {
    const payload = await client.getJson<Envelope>(
      endpoint("memberships", { limit: String(PAGE_SIZE), start }),
    );
    const parsed = parseMembershipsPage(payload);
    for (const course of parsed.courses) seen.set(course.id, course);
    if (!parsed.next || parsed.courses.length === 0) break;
    start = parsed.next;
  }
  return [...seen.values()];
}

/** Normaliza para comparar: sin acentos, minúsculas. "Análisis" matchea "analisis". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Busca por nombre o slug. Devuelve los matches ordenados: primero los que
 * empiezan con la consulta, después los que la contienen.
 */
export function searchCourses(courses: Course[], query: string): Course[] {
  const needle = fold(query.trim());
  if (!needle) return courses;

  const scored = courses
    .map((course) => {
      const haystack = `${fold(course.name)} ${fold(course.slug)}`;
      if (!haystack.includes(needle)) return null;
      const starts = fold(course.name).startsWith(needle) || fold(course.slug).startsWith(needle);
      return { course, score: starts ? 0 : 1 };
    })
    .filter((entry): entry is { course: Course; score: number } => entry !== null);

  scored.sort((a, b) => a.score - b.score || a.course.name.localeCompare(b.course.name));
  return scored.map((entry) => entry.course);
}
