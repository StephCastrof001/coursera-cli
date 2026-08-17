/**
 * Library map: which branches you actually studied, how hard the material was,
 * and which specializations you left half-finished.
 *
 * Coursera does expose a `level` (BEGINNER / INTERMEDIATE / ADVANCED) but many
 * courses leave it empty, so it is reported as declared — never inferred. The
 * real progression is the order of courses inside a specialization.
 */
import type { Client } from "../http.ts";
import type { Course, CourseLevel, Envelope } from "../types.ts";
import { endpoint } from "./endpoints.ts";

export interface Specialization {
  id: string;
  name: string;
  slug: string;
  courseIds: string[];
}

export interface SpecializationProgress extends Specialization {
  /** How many of its courses are in your library. */
  enrolled: number;
  /** How many are missing to complete it. */
  missing: number;
}

export interface Subdomain {
  subdomainId: string;
  courses: number;
}

export interface DomainGroup {
  domainId: string;
  courses: number;
  hours: number;
  /** Courses in this branch with no readable workload. */
  unknownWorkload: number;
  subdomains: Subdomain[];
}

export type LevelTally = Record<CourseLevel | "UNDECLARED", number>;

const HOUR = "(?:hours?|horas?)";
const HOURS_TOTAL = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${HOUR}\\s*(?:total|to complete|en total)`, "i");
const RANGE_TOTAL = new RegExp(`(?:de|from)\\s*(\\d+)\\s*(?:a|to)\\s*(\\d+)\\s*${HOUR}`, "i");
const WEEKS = /(\d+(?:\.\d+)?)\s*(?:weeks?|semanas?)/i;
const PER_WEEK = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*(?:-|–|\\s+a\\s+|\\s+to\\s+)?\\s*(\\d+(?:\\.\\d+)?)?\\s*${HOUR}\\s*(?:\\/|\\s+a\\s+|\\s+per\\s+|\\s+por\\s+)?\\s*(?:week|semana)`,
  "i",
);
const MODULES = new RegExp(
  `(\\d+)\\s*(?:modules?|módulos?)[^.]*?(\\d+(?:\\.\\d+)?)\\s*(?:-|–)?\\s*(\\d+(?:\\.\\d+)?)?\\s*${HOUR}`,
  "i",
);
const PLAIN_HOURS = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*${HOUR}\\s*$`, "i");

const midpoint = (low: string, high?: string): number =>
  high ? (Number(low) + Number(high)) / 2 : Number(low);

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Turns the prose workload into estimated hours.
 *
 * There is no format: each course team writes it their own way, in English and
 * Spanish, as totals, weekly ranges, or per module. The shapes recognized here
 * were measured against a real 215-course library. When the text is genuinely
 * ambiguous ("2", or hours per week without saying how many weeks) this returns
 * null rather than inventing a number.
 *
 * Ranges collapse to their midpoint, and text describing several courses uses
 * the first. It is an estimate: good for comparing branches, not for planning.
 */
export function parseWorkloadHours(workload: string | undefined): number | null {
  if (!workload) return null;
  const text = workload.trim();

  const total = HOURS_TOTAL.exec(text);
  if (total?.[1]) return Number(total[1]);

  const range = RANGE_TOTAL.exec(text);
  if (range?.[1] && range[2]) return round1(midpoint(range[1], range[2]));

  const weeks = WEEKS.exec(text);
  const perWeek = PER_WEEK.exec(text);
  if (weeks?.[1] && perWeek?.[1]) return round1(Number(weeks[1]) * midpoint(perWeek[1], perWeek[2]));

  const modules = MODULES.exec(text);
  if (modules?.[1] && modules[2]) return round1(Number(modules[1]) * midpoint(modules[2], modules[3]));

  const plain = PLAIN_HOURS.exec(text);
  if (plain?.[1]) return Number(plain[1]);

  return null;
}

/**
 * Groups by branch. A course with two domains counts in both: this describes
 * areas of study, it does not split a pie. Branch totals add up to more than
 * the course count, and that is correct.
 */
export function groupByDomain(courses: Course[]): DomainGroup[] {
  const groups = new Map<
    string,
    { courses: Set<string>; hours: number; unknown: number; subs: Map<string, Set<string>> }
  >();

  for (const course of courses) {
    const hours = parseWorkloadHours(course.workload);
    const seen = new Set<string>();
    for (const ref of course.domainTypes ?? []) {
      if (!ref.domainId) continue;
      const group = groups.get(ref.domainId) ?? {
        courses: new Set<string>(),
        hours: 0,
        unknown: 0,
        subs: new Map<string, Set<string>>(),
      };
      if (!seen.has(ref.domainId)) {
        seen.add(ref.domainId);
        group.courses.add(course.id);
        if (hours === null) group.unknown++;
        else group.hours += hours;
      }
      if (ref.subdomainId) {
        const sub = group.subs.get(ref.subdomainId) ?? new Set<string>();
        sub.add(course.id);
        group.subs.set(ref.subdomainId, sub);
      }
      groups.set(ref.domainId, group);
    }
  }

  return [...groups.entries()]
    .map(([domainId, group]) => ({
      domainId,
      courses: group.courses.size,
      hours: Math.round(group.hours),
      unknownWorkload: group.unknown,
      subdomains: [...group.subs.entries()]
        .map(([subdomainId, set]) => ({ subdomainId, courses: set.size }))
        .sort((a, b) => b.courses - a.courses),
    }))
    .sort((a, b) => b.courses - a.courses);
}

/** Counts declared difficulty. Undeclared is its own bucket, never guessed. */
export function tallyLevels(courses: Course[]): LevelTally {
  const tally: LevelTally = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0, UNDECLARED: 0 };
  for (const course of courses) {
    const level = course.level;
    if (level === "BEGINNER" || level === "INTERMEDIATE" || level === "ADVANCED") tally[level]++;
    else tally.UNDECLARED++;
  }
  return tally;
}

export function parseSpecializations(payload: Envelope): Specialization[] {
  const rows = (payload.linked?.["onDemandSpecializations.v1"] ?? []) as Array<Partial<Specialization>>;
  return rows
    .filter((row): row is Specialization => Boolean(row.id && row.name))
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug ?? "",
      courseIds: row.courseIds ?? [],
    }));
}

/** Crosses your specializations against your library: what is left to finish one. */
export function specializationProgress(
  specs: Specialization[],
  courses: Course[],
): SpecializationProgress[] {
  const owned = new Set(courses.map((course) => course.id));
  return specs
    .map((spec) => {
      const enrolled = spec.courseIds.filter((id) => owned.has(id)).length;
      return { ...spec, enrolled, missing: spec.courseIds.length - enrolled };
    })
    .sort((a, b) => a.missing - b.missing || b.enrolled - a.enrolled);
}

export async function fetchSpecializations(client: Client): Promise<Specialization[]> {
  const payload = await client.getJson<Envelope>(
    endpoint("specialization_memberships", { limit: "50" }),
  );
  return parseSpecializations(payload);
}
