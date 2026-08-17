import { describe, expect, test } from "bun:test";
import {
  groupByDomain,
  parseSpecializations,
  parseWorkloadHours,
  specializationProgress,
} from "../src/services/library.ts";
import { parseMembershipsPage } from "../src/services/memberships.ts";
import type { Course, Envelope } from "../src/types.ts";
import rich from "./fixtures/memberships.rich.json" with { type: "json" };
import specs from "./fixtures/specializations.json" with { type: "json" };

const courses = parseMembershipsPage(rich as Envelope).courses;

describe("parseWorkloadHours", () => {
  test("total explícito en horas", () => {
    expect(parseWorkloadHours("5 weeks of study, approximately 15 hours total")).toBe(15);
  });

  test("semanas por rango de horas: toma el punto medio", () => {
    expect(parseWorkloadHours("4 weeks of study, 2-3 hours/week")).toBe(10);
  });

  test("semanas por horas fijas", () => {
    expect(parseWorkloadHours("3 weeks of study, 2 hours/week")).toBe(6);
  });

  test("texto que describe varios cursos: toma el primero", () => {
    const raro = "2 weeks of study, 1-2 hours/week for Course 1 (4-6 weeks of study, 3-5 hours/week for Course 2-6)";
    expect(parseWorkloadHours(raro)).toBe(3);
  });

  test("horas sueltas, el formato más común de la biblioteca real", () => {
    expect(parseWorkloadHours("2 hours")).toBe(2);
    expect(parseWorkloadHours("1.5 hours")).toBe(1.5);
    expect(parseWorkloadHours("1 hour")).toBe(1);
  });

  test("español: semanas de estudio y horas por semana", () => {
    expect(parseWorkloadHours("4 semanas de estudio, 2-4 horas/semana")).toBe(12);
  });

  test("español: rango total de horas", () => {
    expect(parseWorkloadHours("De 4 a 8 horas de videos, lecturas y exámenes")).toBe(6);
  });

  test("variante 'hours a week' en vez de 'hours/week'", () => {
    expect(parseWorkloadHours("4 weeks of study, 3-4 hours a week")).toBe(14);
  });

  test("esfuerzo declarado por módulo", () => {
    const texto = "The course consists of 5 modules, each of which should take 3-5 hours of study time.";
    expect(parseWorkloadHours(texto)).toBe(20);
  });

  test("formato ambiguo devuelve null en vez de inventar", () => {
    // "4-6 hours/week" sin decir cuántas semanas no permite calcular un total.
    expect(parseWorkloadHours("4-6 hours/week")).toBeNull();
    expect(parseWorkloadHours("2")).toBeNull();
    expect(parseWorkloadHours("4 weeks of study")).toBeNull();
    expect(parseWorkloadHours("a tu ritmo")).toBeNull();
    expect(parseWorkloadHours(undefined)).toBeNull();
  });
});

describe("groupByDomain", () => {
  test("agrupa los cursos reales por rama", () => {
    const domains = groupByDomain(courses);
    expect(domains.length).toBeGreaterThan(0);
    expect(domains[0]?.courses).toBeGreaterThan(0);
  });

  test("ordena de más a menos cursos", () => {
    const counts = groupByDomain(courses).map((domain) => domain.courses);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  test("un curso con dos ramas cuenta en las dos", () => {
    const doble: Course[] = [
      {
        id: "c1",
        slug: "s",
        name: "n",
        domainTypes: [
          { domainId: "business", subdomainId: "strategy" },
          { domainId: "data-science", subdomainId: "ml" },
        ],
      },
    ];
    const domains = groupByDomain(doble);
    expect(domains.length).toBe(2);
    expect(domains.every((domain) => domain.courses === 1)).toBe(true);
  });

  test("no cuenta dos veces el mismo curso en la misma rama", () => {
    const repetido: Course[] = [
      {
        id: "c1",
        slug: "s",
        name: "n",
        workload: "4 weeks of study, 2-3 hours/week",
        domainTypes: [
          { domainId: "computer-science", subdomainId: "design-and-product" },
          { domainId: "computer-science", subdomainId: "software-development" },
        ],
      },
    ];
    const [domain] = groupByDomain(repetido);
    expect(domain?.courses).toBe(1);
    expect(domain?.hours).toBe(10);
    expect(domain?.subdomains.length).toBe(2);
  });

  test("cuenta aparte los cursos sin workload en vez de asumir cero", () => {
    const sinWorkload: Course[] = [{ id: "c1", slug: "s", name: "n", domainTypes: [{ domainId: "business" }] }];
    expect(groupByDomain(sinWorkload)[0]?.unknownWorkload).toBe(1);
  });

  test("un curso sin ramas no aparece en ningún grupo", () => {
    expect(groupByDomain([{ id: "c1", slug: "s", name: "n" }])).toEqual([]);
  });
});

describe("especializaciones", () => {
  const parsed = parseSpecializations(specs as Envelope);

  test("lee las especializaciones reales con sus cursos", () => {
    expect(parsed.length).toBe(15);
    expect(parsed.every((spec) => spec.courseIds.length > 0)).toBe(true);
  });

  test("cuenta cuántos cursos de cada una tenés", () => {
    const inventada = [{ id: "s1", name: "Spec", slug: "spec", courseIds: ["a", "b", "c"] }];
    const mios: Course[] = [
      { id: "a", slug: "a", name: "A" },
      { id: "c", slug: "c", name: "C" },
    ];
    const [progress] = specializationProgress(inventada, mios);
    expect(progress?.enrolled).toBe(2);
    expect(progress?.missing).toBe(1);
  });

  test("ordena primero las que están más cerca de cerrarse", () => {
    const inventadas = [
      { id: "s1", name: "Lejos", slug: "l", courseIds: ["a", "b", "c", "d"] },
      { id: "s2", name: "Cerca", slug: "c", courseIds: ["a", "e"] },
    ];
    const mios: Course[] = [{ id: "a", slug: "a", name: "A" }];
    expect(specializationProgress(inventadas, mios)[0]?.name).toBe("Cerca");
  });
});
