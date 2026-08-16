import { describe, expect, test } from "bun:test";
import { buildOutline, countItems, planItems } from "../src/services/courses.ts";
import type { Envelope } from "../src/types.ts";
import materials from "./fixtures/materials.json" with { type: "json" };

type MaterialsEnvelope = Envelope<{ id?: string; moduleIds?: string[] }>;
const outline = buildOutline(materials as MaterialsEnvelope, "duke-ml");

describe("buildOutline", () => {
  test("reconstruye el árbol desde las listas planas de linked", () => {
    expect(outline.courseId).toBe("Bob8HYsxEeuqDwqw9ez0Fw");
    expect(outline.modules.length).toBe(6);
    expect(outline.modules[0]?.name).toBe("What is Machine Learning");
    expect(outline.modules[0]?.lessons[0]?.name).toBe("Course Overview");
  });

  test("lee typeName desde contentSummary, no desde la raíz del item", () => {
    const first = outline.modules[0]?.lessons[0]?.items[0];
    expect(first?.name).toBe("Specialization Overview");
    expect(first?.type).toBe("lecture");
  });

  test("conserva todos los items del curso", () => {
    expect(countItems(outline)).toBe(69);
  });

  test("respeta el orden declarado en moduleIds", () => {
    expect(outline.modules.map((m) => m.id)).toEqual([
      "eEphX",
      "awp1I",
      "DalLb",
      "5hMHy",
      "4YA27",
      "5FAbo",
    ]);
  });

  test("un item censurado queda como unknown y hereda el nombre de su lección", () => {
    const censurado: MaterialsEnvelope = {
      elements: [{ id: "C1", moduleIds: ["m1"] }],
      linked: {
        "onDemandCourseMaterialModules.v1": [{ id: "m1", name: "Módulo 4", lessonIds: ["l1"] }],
        "onDemandCourseMaterialLessons.v1": [{ id: "l1", name: "Semana bloqueada", itemIds: ["i1"] }],
        "onDemandCourseMaterialItems.v2": [],
      },
    };
    const item = buildOutline(censurado, "x").modules[0]?.lessons[0]?.items[0];
    expect(item?.type).toBe("unknown");
    expect(item?.name).toContain("Semana bloqueada");
  });

  test("falla claro si no viene courseId", () => {
    expect(() => buildOutline({ elements: [] }, "x")).toThrow(/courseId/);
  });
});

describe("planItems", () => {
  test("aplana el árbol conservando módulo y lección", () => {
    const plan = planItems(outline);
    expect(plan.length).toBe(69);
    expect(plan[0]?.moduleIndex).toBe(1);
    expect(plan[0]?.lessonName).toBe("Course Overview");
  });

  test("filtra por tipo cuando se le pide", () => {
    const plan = planItems(outline, ["lecture"]);
    expect(plan.length).toBe(48);
    expect(plan.every((item) => item.type === "lecture")).toBe(true);
  });

  test("los items censurados NUNCA se filtran: son el 75% de un curso en preview", () => {
    const conCensura: MaterialsEnvelope = {
      elements: [{ id: "C1", moduleIds: ["m1"] }],
      linked: {
        "onDemandCourseMaterialModules.v1": [{ id: "m1", name: "M", lessonIds: ["l1"] }],
        "onDemandCourseMaterialLessons.v1": [{ id: "l1", name: "L", itemIds: ["i1"] }],
        "onDemandCourseMaterialItems.v2": [],
      },
    };
    const plan = planItems(buildOutline(conCensura, "x"), ["lecture"]);
    expect(plan.length).toBe(1);
  });
});
