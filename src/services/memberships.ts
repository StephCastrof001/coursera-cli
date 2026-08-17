/**
 * A membership is the link between an account and a course. It is NOT the course.
 *
 * The endpoint caps at `limit` and reports the real count in `paging.total`.
 * Without walking the cursor, `limit=100` over 215 memberships truncates
 * silently: search would never see more than half the library.
 */
import { MAX_PAGES, PAGE_SIZE } from "../constants.ts";
import type { Client } from "../http.ts";
import type { Course, CourseLevel, Envelope } from "../types.ts";
import { endpoint } from "./endpoints.ts";

export interface MembershipsPage {
  courses: Course[];
  next?: string;
  total: number;
}

/** Courses arrive under `linked`, not `elements`. */
export function parseMembershipsPage(payload: Envelope): MembershipsPage {
  const linked = (payload.linked?.["courses.v1"] ?? []) as Array<Partial<Course>>;
  const courses = linked
    .filter((c): c is Course => Boolean(c.id && c.slug && c.name))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      courseType: c.courseType,
      level: c.level,
      certificates: c.certificates,
      domainTypes: c.domainTypes,
      workload: c.workload,
      primaryLanguages: c.primaryLanguages,
      partnerIds: c.partnerIds,
      instructorIds: c.instructorIds,
    }));
  return {
    courses,
    next: payload.paging?.next,
    total: payload.paging?.total ?? courses.length,
  };
}

/** Walks the cursor until `paging.next` runs out. Deduplicates by id. */
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

/** Normalizes for comparison: no accents, lowercase. "Análisis" matches "analisis". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export interface CourseFilters {
  /** Free text over name and slug. */
  search?: string;
  level?: CourseLevel;
  /** Domain or subdomain id, e.g. "data-science" or "machine-learning". */
  domain?: string;
  /** Primary language code, e.g. "es". */
  language?: string;
  /** Upper bound on estimated hours. Courses with no readable workload are excluded. */
  maxHours?: number;
  /** Partner id. Resolve a university name to its id with the partners service. */
  partnerId?: string;
}

/**
 * Applies every filter given; they compose with AND. Text search ranks matches
 * that start with the query above matches that merely contain it.
 */
export function filterCourses(
  courses: Course[],
  filters: CourseFilters,
  hoursOf?: (course: Course) => number | null,
): Course[] {
  let result = courses;

  if (filters.level) result = result.filter((c) => c.level === filters.level);

  if (filters.domain) {
    const needle = filters.domain;
    result = result.filter((c) =>
      (c.domainTypes ?? []).some((d) => d.domainId === needle || d.subdomainId === needle),
    );
  }

  if (filters.language) {
    const needle = filters.language.toLowerCase();
    result = result.filter((c) =>
      (c.primaryLanguages ?? []).some((lang) => lang.toLowerCase().startsWith(needle)),
    );
  }

  if (filters.partnerId) {
    result = result.filter((c) => (c.partnerIds ?? []).includes(filters.partnerId as string));
  }

  if (filters.maxHours !== undefined && hoursOf) {
    result = result.filter((c) => {
      const hours = hoursOf(c);
      return hours !== null && hours <= (filters.maxHours as number);
    });
  }

  if (filters.search?.trim()) {
    const needle = fold(filters.search.trim());
    const scored = result
      .map((course) => {
        const haystack = `${fold(course.name)} ${fold(course.slug)}`;
        if (!haystack.includes(needle)) return null;
        const starts = fold(course.name).startsWith(needle) || fold(course.slug).startsWith(needle);
        return { course, score: starts ? 0 : 1 };
      })
      .filter((entry): entry is { course: Course; score: number } => entry !== null);
    scored.sort((a, b) => a.score - b.score || a.course.name.localeCompare(b.course.name));
    result = scored.map((entry) => entry.course);
  }

  return result;
}

/** Kept as a thin alias: text search is the common case. */
export function searchCourses(courses: Course[], query: string): Course[] {
  return filterCourses(courses, { search: query });
}
