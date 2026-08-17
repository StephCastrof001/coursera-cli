/**
 * Mapa de la biblioteca: en qué ramas te formaste y qué especializaciones
 * dejaste a medias.
 *
 * Coursera no expone un campo de dificultad. Lo que sí manda es `domainTypes`
 * (rama + subrama) y `workload` en prosa. La progresión real no está en un
 * número de nivel: está en el orden de los cursos dentro de una especialización.
 */
import type { Client } from "../http.ts";
import type { Course, Envelope } from "../types.ts";
import { endpoint } from "./endpoints.ts";

export interface Specialization {
  id: string;
  name: string;
  slug: string;
  courseIds: string[];
}

export interface SpecializationProgress extends Specialization {
  /** Cuántos de sus cursos están en tu biblioteca. */
  enrolled: number;
  /** Cuántos le faltan para estar completa. */
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
  /** Cuántos de esos cursos no traen workload parseable. */
  unknownWorkload: number;
  subdomains: Subdomain[];
}

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
 * Convierte el workload en prosa a horas estimadas.
 *
 * Coursera no tiene un formato: lo escriben los equipos de cada curso, en
 * inglés y en español, con totales, rangos por semana, o por módulo. Se
 * reconocen las formas medidas en la biblioteca real; cuando el texto es
 * ambiguo ("2", "4-6 hours/week" sin decir cuántas semanas) devuelve null en
 * vez de inventar un número.
 *
 * Ante un rango se toma el punto medio, y si el texto describe varios cursos
 * se toma el primero. Es una estimación: sirve para comparar ramas entre sí,
 * no para planificar una agenda.
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
  if (weeks?.[1] && perWeek?.[1]) {
    return round1(Number(weeks[1]) * midpoint(perWeek[1], perWeek[2]));
  }

  const modules = MODULES.exec(text);
  if (modules?.[1] && modules[2]) {
    return round1(Number(modules[1]) * midpoint(modules[2], modules[3]));
  }

  const plain = PLAIN_HOURS.exec(text);
  if (plain?.[1]) return Number(plain[1]);

  return null;
}

/**
 * Agrupa por rama. Un curso con dos dominios cuenta en los dos: describe un
 * área de formación, no reparte una torta. Los totales por rama suman más que
 * el total de cursos, y está bien que así sea.
 */
export function groupByDomain(courses: Course[]): DomainGroup[] {
  const groups = new Map<string, { courses: Set<string>; hours: number; unknown: number; subs: Map<string, Set<string>> }>();

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

/** Cruza tus especializaciones contra tu biblioteca: qué te falta para cerrarlas. */
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
  const payload = await client.getJson<Envelope>(endpoint("specialization_memberships", { limit: "50" }));
  return parseSpecializations(payload);
}
