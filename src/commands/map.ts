import { emit, type Flags } from "../output.ts";
import {
  fetchSpecializations,
  groupByDomain,
  parseWorkloadHours,
  specializationProgress,
  tallyLevels,
  type DomainGroup,
  type LevelTally,
  type SpecializationProgress,
} from "../services/library.ts";
import { listCourses } from "../services/memberships.ts";
import { collectPartnerIds, fetchPartners, tallyPartners } from "../services/partners.ts";
import { requireSession } from "../session.ts";

const BAR_WIDTH = 24;

function bar(value: number, max: number): string {
  const filled = max === 0 ? 0 : Math.max(1, Math.round((value / max) * BAR_WIDTH));
  return "█".repeat(filled);
}

function renderDomains(domains: DomainGroup[], detail: boolean): string[] {
  const max = domains[0]?.courses ?? 0;
  const lines: string[] = [];
  for (const domain of domains) {
    const hours = domain.hours > 0 ? `${domain.hours} h` : "";
    lines.push(
      `${domain.domainId.padEnd(32)} ${String(domain.courses).padStart(3)}  ${bar(domain.courses, max).padEnd(BAR_WIDTH)} ${hours}`,
    );
    if (!detail) continue;
    for (const sub of domain.subdomains) {
      lines.push(`   ${sub.subdomainId.padEnd(29)} ${String(sub.courses).padStart(3)}`);
    }
  }
  return lines;
}

function renderLevels(levels: LevelTally): string {
  return (["BEGINNER", "INTERMEDIATE", "ADVANCED", "UNDECLARED"] as const)
    .map((level) => `${level.toLowerCase()} ${levels[level]}`)
    .join("   ");
}

function renderSpecs(specs: SpecializationProgress[]): string[] {
  return specs.map((spec) => {
    const mark = spec.missing === 0 ? "✓" : "○";
    const gap = spec.missing === 0 ? "complete" : `${spec.missing} missing`;
    return `  ${mark} ${spec.name.slice(0, 46).padEnd(48)} ${spec.enrolled}/${spec.courseIds.length}  ${gap}`;
  });
}

export async function run(flags: Flags): Promise<void> {
  const { client } = requireSession();
  const courses = await listCourses(client);
  const specs = await fetchSpecializations(client);
  const partners = await fetchPartners(client, collectPartnerIds(courses));

  const domains = groupByDomain(courses);
  const levels = tallyLevels(courses);
  const progress = specializationProgress(specs, courses);
  const institutions = tallyPartners(courses, partners);
  // Counted per course, not by summing groups: a course in two branches would
  // otherwise be counted twice.
  const unknownWorkload = courses.filter(
    (course) => parseWorkloadHours(course.workload) === null,
  ).length;

  emit(
    flags,
    {
      totalCourses: courses.length,
      levels,
      domains,
      specializations: progress,
      institutions: institutions.map((entry) => ({
        name: entry.partner.name,
        courses: entry.courses,
      })),
    },
    () =>
      [
        `${courses.length} courses in your library`,
        `levels: ${renderLevels(levels)}`,
        "",
        ...renderDomains(domains, flags.booleans.has("detail")),
        "",
        `SPECIALIZATIONS (${progress.length})`,
        ...renderSpecs(progress),
        "",
        "TOP INSTITUTIONS",
        ...institutions
          .slice(0, 8)
          .map((entry) => `  ${entry.partner.name.slice(0, 44).padEnd(46)} ${entry.courses}`),
        "",
        "A course with two branches counts in both: branch totals exceed the course count.",
        unknownWorkload > 0
          ? `Hours estimated from Coursera's own text; ${unknownWorkload} of ${courses.length} courses do not state it readably.`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
  );
}
