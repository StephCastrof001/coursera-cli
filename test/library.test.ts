import { describe, expect, test } from "bun:test";
import {
  groupByDomain,
  parseSpecializations,
  parseWorkloadHours,
  specializationProgress,
  tallyLevels,
} from "../src/services/library.ts";
import { parseMembershipsPage } from "../src/services/memberships.ts";
import type { Course, Envelope } from "../src/types.ts";
import rich from "./fixtures/memberships.rich.json" with { type: "json" };
import specs from "./fixtures/specializations.json" with { type: "json" };

const courses = parseMembershipsPage(rich as Envelope).courses;

describe("parseWorkloadHours", () => {
  test("explicit hour total", () => {
    expect(parseWorkloadHours("5 weeks of study, approximately 15 hours total")).toBe(15);
  });

  test("weeks times an hour range takes the midpoint", () => {
    expect(parseWorkloadHours("4 weeks of study, 2-3 hours/week")).toBe(10);
  });

  test("weeks times fixed hours", () => {
    expect(parseWorkloadHours("3 weeks of study, 2 hours/week")).toBe(6);
  });

  test("text describing several courses uses the first", () => {
    const odd =
      "2 weeks of study, 1-2 hours/week for Course 1 (4-6 weeks of study, 3-5 hours/week for Course 2-6)";
    expect(parseWorkloadHours(odd)).toBe(3);
  });

  test("bare hours, the most common shape in a real library", () => {
    expect(parseWorkloadHours("2 hours")).toBe(2);
    expect(parseWorkloadHours("1.5 hours")).toBe(1.5);
    expect(parseWorkloadHours("1 hour")).toBe(1);
  });

  test("Spanish: weeks of study and hours per week", () => {
    expect(parseWorkloadHours("4 semanas de estudio, 2-4 horas/semana")).toBe(12);
  });

  test("Spanish: total hour range", () => {
    expect(parseWorkloadHours("De 4 a 8 horas de videos, lecturas y exámenes")).toBe(6);
  });

  test("the 'hours a week' variant, not just 'hours/week'", () => {
    expect(parseWorkloadHours("4 weeks of study, 3-4 hours a week")).toBe(14);
  });

  test("effort declared per module", () => {
    const text = "The course consists of 5 modules, each of which should take 3-5 hours of study time.";
    expect(parseWorkloadHours(text)).toBe(20);
  });

  test("ambiguous text returns null instead of inventing a number", () => {
    // "4-6 hours/week" without a week count cannot yield a total.
    expect(parseWorkloadHours("4-6 hours/week")).toBeNull();
    expect(parseWorkloadHours("2")).toBeNull();
    expect(parseWorkloadHours("4 weeks of study")).toBeNull();
    expect(parseWorkloadHours("at your own pace")).toBeNull();
    expect(parseWorkloadHours(undefined)).toBeNull();
  });
});

describe("tallyLevels", () => {
  test("counts declared levels and keeps undeclared as its own bucket", () => {
    const sample: Course[] = [
      { id: "1", slug: "a", name: "A", level: "BEGINNER" },
      { id: "2", slug: "b", name: "B", level: "BEGINNER" },
      { id: "3", slug: "c", name: "C", level: "INTERMEDIATE" },
      { id: "4", slug: "d", name: "D" },
    ];
    expect(tallyLevels(sample)).toEqual({
      BEGINNER: 2,
      INTERMEDIATE: 1,
      ADVANCED: 0,
      UNDECLARED: 1,
    });
  });

  test("never guesses a level for a course that does not declare one", () => {
    expect(tallyLevels([{ id: "1", slug: "a", name: "A" }]).UNDECLARED).toBe(1);
  });
});

describe("groupByDomain", () => {
  test("groups real courses by branch", () => {
    const domains = groupByDomain(courses);
    expect(domains.length).toBeGreaterThan(0);
    expect(domains[0]?.courses).toBeGreaterThan(0);
  });

  test("sorts from most to fewest courses", () => {
    const counts = groupByDomain(courses).map((domain) => domain.courses);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  test("a course with two branches counts in both", () => {
    const dual: Course[] = [
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
    const domains = groupByDomain(dual);
    expect(domains.length).toBe(2);
    expect(domains.every((domain) => domain.courses === 1)).toBe(true);
  });

  test("does not double count the same course within one branch", () => {
    const repeated: Course[] = [
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
    const [domain] = groupByDomain(repeated);
    expect(domain?.courses).toBe(1);
    expect(domain?.hours).toBe(10);
    expect(domain?.subdomains.length).toBe(2);
  });

  test("counts workload-less courses separately instead of assuming zero", () => {
    const noWorkload: Course[] = [
      { id: "c1", slug: "s", name: "n", domainTypes: [{ domainId: "business" }] },
    ];
    expect(groupByDomain(noWorkload)[0]?.unknownWorkload).toBe(1);
  });

  test("a course with no branch appears in no group", () => {
    expect(groupByDomain([{ id: "c1", slug: "s", name: "n" }])).toEqual([]);
  });
});

describe("specializations", () => {
  const parsed = parseSpecializations(specs as Envelope);

  test("reads real specializations with their courses", () => {
    expect(parsed.length).toBe(15);
    expect(parsed.every((spec) => spec.courseIds.length > 0)).toBe(true);
  });

  test("counts how many of each one you already have", () => {
    const invented = [{ id: "s1", name: "Spec", slug: "spec", courseIds: ["a", "b", "c"] }];
    const mine: Course[] = [
      { id: "a", slug: "a", name: "A" },
      { id: "c", slug: "c", name: "C" },
    ];
    const [progress] = specializationProgress(invented, mine);
    expect(progress?.enrolled).toBe(2);
    expect(progress?.missing).toBe(1);
  });

  test("puts the ones closest to completion first", () => {
    const invented = [
      { id: "s1", name: "Far", slug: "f", courseIds: ["a", "b", "c", "d"] },
      { id: "s2", name: "Close", slug: "c", courseIds: ["a", "e"] },
    ];
    const mine: Course[] = [{ id: "a", slug: "a", name: "A" }];
    expect(specializationProgress(invented, mine)[0]?.name).toBe("Close");
  });
});
