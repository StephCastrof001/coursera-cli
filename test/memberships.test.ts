import { describe, expect, test } from "bun:test";
import { filterCourses, parseMembershipsPage, searchCourses } from "../src/services/memberships.ts";
import type { Course, Envelope } from "../src/types.ts";
import page from "./fixtures/memberships.page.json" with { type: "json" };

describe("parseMembershipsPage", () => {
  test("reads courses from linked, not from elements", () => {
    const parsed = parseMembershipsPage(page as Envelope);
    expect(parsed.courses.length).toBe(5);
    expect(parsed.courses[0]?.slug).toBe("product-management-an-introduction");
  });

  test("reports the real total even when the page holds fewer", () => {
    const parsed = parseMembershipsPage(page as Envelope);
    // The bug this prevents: 215 memberships, 5 on this page. Reporting 5 would lie.
    expect(parsed.total).toBe(215);
    expect(parsed.courses.length).toBeLessThan(parsed.total);
  });

  test("exposes the cursor for the next page", () => {
    expect(parseMembershipsPage(page as Envelope).next).toBe("5");
  });

  test("drops entries without a slug instead of breaking", () => {
    const broken: Envelope = {
      linked: { "courses.v1": [{ id: "a" }, { id: "b", slug: "s", name: "n" }] },
    };
    expect(parseMembershipsPage(broken).courses.length).toBe(1);
  });
});

const library: Course[] = [
  {
    id: "1",
    slug: "machine-learning-foundations",
    name: "Machine Learning Foundations",
    level: "INTERMEDIATE",
    domainTypes: [{ domainId: "data-science", subdomainId: "machine-learning" }],
    primaryLanguages: ["en"],
    partnerIds: ["7"],
    workload: "4 weeks of study, 2-3 hours/week",
  },
  {
    id: "2",
    slug: "analitica-y-ciencia-de-datos",
    name: "Analítica y ciencia de datos",
    level: "BEGINNER",
    domainTypes: [{ domainId: "data-science", subdomainId: "data-analysis" }],
    primaryLanguages: ["es"],
    partnerIds: ["9"],
    workload: "2 hours",
  },
  {
    id: "3",
    slug: "deep-learning",
    name: "Deep Learning Avanzado",
    domainTypes: [{ domainId: "computer-science" }],
    primaryLanguages: ["es"],
    workload: "20 hours total",
  },
];

describe("searchCourses", () => {
  test("matches on name and on slug", () => {
    expect(searchCourses(library, "learning").map((c) => c.id).sort()).toEqual(["1", "3"]);
  });

  test("ignores accents: 'analitica' finds 'Analítica'", () => {
    expect(searchCourses(library, "analitica")[0]?.id).toBe("2");
  });

  test("ranks prefix matches first", () => {
    expect(searchCourses(library, "deep")[0]?.id).toBe("3");
  });

  test("an empty query returns everything", () => {
    expect(searchCourses(library, "  ").length).toBe(3);
  });

  test("no match returns an empty list, not an error", () => {
    expect(searchCourses(library, "organic chemistry")).toEqual([]);
  });
});

describe("filterCourses", () => {
  test("filters by declared level", () => {
    expect(filterCourses(library, { level: "BEGINNER" }).map((c) => c.id)).toEqual(["2"]);
  });

  test("a course with no declared level never matches a level filter", () => {
    const levels = filterCourses(library, { level: "ADVANCED" });
    expect(levels).toEqual([]);
  });

  test("filters by branch and by sub-branch", () => {
    expect(filterCourses(library, { domain: "data-science" }).length).toBe(2);
    expect(filterCourses(library, { domain: "machine-learning" }).map((c) => c.id)).toEqual(["1"]);
  });

  test("filters by language", () => {
    expect(filterCourses(library, { language: "es" }).map((c) => c.id)).toEqual(["2", "3"]);
  });

  test("filters by institution", () => {
    expect(filterCourses(library, { partnerId: "7" }).map((c) => c.id)).toEqual(["1"]);
  });

  test("filters by hours, excluding courses whose workload cannot be read", () => {
    const hours = (course: Course): number | null =>
      course.workload === "2 hours" ? 2 : course.workload === "20 hours total" ? 20 : 10;
    expect(filterCourses(library, { maxHours: 5 }, hours).map((c) => c.id)).toEqual(["2"]);
    const noWorkload: Course[] = [{ id: "x", slug: "x", name: "X" }];
    expect(filterCourses(noWorkload, { maxHours: 100 }, () => null)).toEqual([]);
  });

  test("filters compose with AND", () => {
    const result = filterCourses(library, { domain: "data-science", language: "es" });
    expect(result.map((c) => c.id)).toEqual(["2"]);
  });
});
