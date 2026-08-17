import { emit, type Flags } from "../output.ts";
import {
  fetchSpecializations,
  groupByDomain,
  parseWorkloadHours,
  specializationProgress,
  type DomainGroup,
  type SpecializationProgress,
} from "../services/library.ts";
import { listCourses } from "../services/memberships.ts";
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

function renderSpecs(specs: SpecializationProgress[]): string[] {
  return specs.map((spec) => {
    const mark = spec.missing === 0 ? "✓" : "○";
    const gap = spec.missing === 0 ? "completa" : `falta${spec.missing > 1 ? "n" : ""} ${spec.missing}`;
    return `  ${mark} ${spec.name.slice(0, 46).padEnd(48)} ${spec.enrolled}/${spec.courseIds.length}  ${gap}`;
  });
}

export async function run(flags: Flags): Promise<void> {
  const { client } = requireSession();
  const courses = await listCourses(client);
  const specs = await fetchSpecializations(client);

  const domains = groupByDomain(courses);
  const progress = specializationProgress(specs, courses);
  const withoutDomain = courses.filter((course) => (course.domainTypes ?? []).length === 0).length;
  // Se cuenta por curso, no sumando los grupos: un curso con dos ramas
  // aparece en ambos y sumarlos lo contaría dos veces.
  const unknownWorkload = courses.filter(
    (course) => parseWorkloadHours(course.workload) === null,
  ).length;

  emit(
    flags.output,
    { totalCourses: courses.length, withoutDomain, domains, specializations: progress },
    () =>
      [
        `${courses.length} cursos en tu biblioteca`,
        "",
        ...renderDomains(domains, flags.booleans.has("detalle")),
        "",
        `ESPECIALIZACIONES (${progress.length})`,
        ...renderSpecs(progress),
        "",
        "Un curso con dos ramas cuenta en las dos: los totales por rama suman más que el total de cursos.",
        unknownWorkload > 0
          ? `Horas estimadas del texto de Coursera; ${unknownWorkload} de ${courses.length} cursos no lo declaran de forma legible.`
          : "",
        withoutDomain > 0 ? `${withoutDomain} cursos sin rama asignada.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
  );
}
