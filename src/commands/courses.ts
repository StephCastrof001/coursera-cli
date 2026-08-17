import { emit, table, type Flags } from "../output.ts";
import { parseWorkloadHours } from "../services/library.ts";
import { filterCourses, listCourses, type CourseFilters } from "../services/memberships.ts";
import { collectPartnerIds, fetchPartners, findPartner } from "../services/partners.ts";
import { requireSession } from "../session.ts";
import type { Client, } from "../http.ts";
import type { Course, CourseLevel } from "../types.ts";

function readLevel(raw: string | undefined): CourseLevel | undefined {
  const upper = raw?.toUpperCase();
  return upper === "BEGINNER" || upper === "INTERMEDIATE" || upper === "ADVANCED" ? upper : undefined;
}

/** `--university duke` needs the partner catalog to resolve a name into an id. */
async function resolvePartnerId(
  client: Client,
  courses: Course[],
  query: string,
): Promise<string | undefined> {
  const partners = await fetchPartners(client, collectPartnerIds(courses));
  return findPartner([...partners.values()], query)?.id;
}

export async function run(flags: Flags): Promise<void> {
  const { client } = requireSession();
  const all = await listCourses(client);

  const filters: CourseFilters = {
    search: flags.values.search ?? flags.positional[0],
    level: readLevel(flags.values.level),
    domain: flags.values.domain,
    language: flags.values.lang,
    maxHours: flags.values.hours ? Number(flags.values.hours) : undefined,
  };
  if (flags.values.university) {
    filters.partnerId = await resolvePartnerId(client, all, flags.values.university);
  }

  const matches = filterCourses(all, filters, (course) => parseWorkloadHours(course.workload));
  const active = Object.entries(filters).filter(([, value]) => value !== undefined);

  emit(flags, { total: all.length, matches: matches.length, filters, courses: matches }, () =>
    [
      table(
        matches.map((course) => ({
          slug: course.slug,
          level: course.level ?? "-",
          hours: String(parseWorkloadHours(course.workload) ?? "-"),
          name: course.name,
        })),
        ["slug", "level", "hours", "name"],
      ),
      "",
      active.length > 0
        ? `${matches.length} of ${all.length} courses match ${active.map(([k, v]) => `${k}=${v}`).join(" ")}`
        : `${all.length} courses`,
    ].join("\n"),
  );
}
