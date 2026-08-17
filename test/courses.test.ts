import { describe, expect, test } from "bun:test";
import { AppError } from "../src/cli/foundation/error-map.ts";
import { buildOutline, countItems, planItems } from "../src/services/courses.ts";
import type { Envelope } from "../src/types.ts";
import materials from "./fixtures/materials.json" with { type: "json" };

type MaterialsEnvelope = Envelope<{ id?: string; moduleIds?: string[] }>;
const outline = buildOutline(materials as MaterialsEnvelope, "duke-ml");

describe("buildOutline", () => {
  test("rebuilds the tree from the flat lists in linked", () => {
    expect(outline.courseId).toBe("Bob8HYsxEeuqDwqw9ez0Fw");
    expect(outline.modules.length).toBe(6);
    expect(outline.modules[0]?.name).toBe("What is Machine Learning");
    expect(outline.modules[0]?.lessons[0]?.name).toBe("Course Overview");
  });

  test("reads typeName from contentSummary, not from the item root", () => {
    const first = outline.modules[0]?.lessons[0]?.items[0];
    expect(first?.name).toBe("Specialization Overview");
    expect(first?.type).toBe("lecture");
  });

  test("keeps every item in the course", () => {
    expect(countItems(outline)).toBe(69);
  });

  test("honours the order declared in moduleIds", () => {
    expect(outline.modules.map((m) => m.id)).toEqual([
      "eEphX",
      "awp1I",
      "DalLb",
      "5hMHy",
      "4YA27",
      "5FAbo",
    ]);
  });

  test("a censored item becomes unknown and inherits its lesson name", () => {
    const censored: MaterialsEnvelope = {
      elements: [{ id: "C1", moduleIds: ["m1"] }],
      linked: {
        "onDemandCourseMaterialModules.v1": [{ id: "m1", name: "Module 4", lessonIds: ["l1"] }],
        "onDemandCourseMaterialLessons.v1": [{ id: "l1", name: "Locked week", itemIds: ["i1"] }],
        "onDemandCourseMaterialItems.v2": [],
      },
    };
    const item = buildOutline(censored, "x").modules[0]?.lessons[0]?.items[0];
    expect(item?.type).toBe("unknown");
    expect(item?.name).toContain("Locked week");
  });

  test("fails with a typed error when no courseId comes back", () => {
    expect(() => buildOutline({ elements: [] }, "x")).toThrow(AppError);
    try {
      buildOutline({ elements: [] }, "x");
    } catch (error) {
      // Agents branch on the code, not on the prose.
      expect((error as AppError).code).toBe("NOT_FOUND");
      expect((error as AppError).hint).toBeDefined();
    }
  });
});

describe("planItems", () => {
  test("flattens the tree while keeping module and lesson", () => {
    const plan = planItems(outline);
    expect(plan.length).toBe(69);
    expect(plan[0]?.moduleIndex).toBe(1);
    expect(plan[0]?.lessonName).toBe("Course Overview");
  });

  test("filters by type when asked", () => {
    const plan = planItems(outline, ["lecture"]);
    expect(plan.length).toBe(48);
    expect(plan.every((item) => item.type === "lecture")).toBe(true);
  });

  test("censored items are NEVER filtered: they are 75% of a preview course", () => {
    const censored: MaterialsEnvelope = {
      elements: [{ id: "C1", moduleIds: ["m1"] }],
      linked: {
        "onDemandCourseMaterialModules.v1": [{ id: "m1", name: "M", lessonIds: ["l1"] }],
        "onDemandCourseMaterialLessons.v1": [{ id: "l1", name: "L", itemIds: ["i1"] }],
        "onDemandCourseMaterialItems.v2": [],
      },
    };
    expect(planItems(buildOutline(censored, "x"), ["lecture"]).length).toBe(1);
  });
});
