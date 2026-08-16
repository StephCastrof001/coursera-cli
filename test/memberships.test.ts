import { describe, expect, test } from "bun:test";
import { parseMembershipsPage, searchCourses } from "../src/services/memberships.ts";
import type { Course, Envelope } from "../src/types.ts";
import page from "./fixtures/memberships.page.json" with { type: "json" };

describe("parseMembershipsPage", () => {
  test("saca los cursos de linked, no de elements", () => {
    const parsed = parseMembershipsPage(page as Envelope);
    expect(parsed.courses.length).toBe(5);
    expect(parsed.courses[0]?.slug).toBe("product-management-an-introduction");
  });

  test("expone el total real aunque la página traiga menos", () => {
    const parsed = parseMembershipsPage(page as Envelope);
    // El bug que previene: 215 memberships, 5 en esta página. Reportar 5 sería mentir.
    expect(parsed.total).toBe(215);
    expect(parsed.courses.length).toBeLessThan(parsed.total);
  });

  test("devuelve el cursor de la próxima página", () => {
    expect(parseMembershipsPage(page as Envelope).next).toBe("5");
  });

  test("descarta entradas sin slug en vez de romper", () => {
    const roto: Envelope = { linked: { "courses.v1": [{ id: "a" }, { id: "b", slug: "s", name: "n" }] } };
    expect(parseMembershipsPage(roto).courses.length).toBe(1);
  });
});

describe("searchCourses", () => {
  const courses: Course[] = [
    { id: "1", slug: "machine-learning-foundations", name: "Machine Learning Foundations" },
    { id: "2", slug: "analitica-y-ciencia-de-datos", name: "Analítica y ciencia de datos" },
    { id: "3", slug: "deep-learning", name: "Deep Learning Avanzado" },
  ];

  test("matchea por nombre y por slug", () => {
    expect(searchCourses(courses, "learning").map((c) => c.id).sort()).toEqual(["1", "3"]);
  });

  test("ignora acentos: 'analitica' encuentra 'Analítica'", () => {
    expect(searchCourses(courses, "analitica")[0]?.id).toBe("2");
  });

  test("prioriza los que empiezan con la consulta", () => {
    expect(searchCourses(courses, "deep")[0]?.id).toBe("3");
  });

  test("consulta vacía devuelve todo", () => {
    expect(searchCourses(courses, "  ").length).toBe(3);
  });

  test("sin match devuelve lista vacía, no error", () => {
    expect(searchCourses(courses, "quimica organica")).toEqual([]);
  });
});
