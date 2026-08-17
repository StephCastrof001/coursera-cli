import { describe, expect, test } from "bun:test";
import {
  collectInstructorIds,
  collectPartnerIds,
  findPartner,
  parseInstructors,
  parsePartners,
  tallyPartners,
} from "../src/services/partners.ts";
import type { Course, Envelope, Partner } from "../src/types.ts";

const partnersPayload: Envelope = {
  elements: [
    { id: 7, name: "Duke University", shortName: "duke", location: { country: "US", city: "Durham" } },
    { id: 9, name: "Universidad de los Andes", shortName: "uniandes" },
    { id: 11, name: "" },
  ],
};

describe("parsePartners", () => {
  test("reads institutions and normalizes the numeric id to a string", () => {
    const partners = parsePartners(partnersPayload);
    expect(partners.length).toBe(2);
    expect(partners[0]?.id).toBe("7");
    expect(partners[0]?.location?.city).toBe("Durham");
  });

  test("drops nameless entries instead of rendering blanks", () => {
    expect(parsePartners(partnersPayload).some((partner) => partner.name === "")).toBe(false);
  });
});

describe("parseInstructors", () => {
  test("reads name, title and department", () => {
    const payload: Envelope = {
      elements: [
        {
          id: 45353055,
          fullName: "Jon Reifschneider",
          title: "Director, Master of Engineering in AI",
          department: "Engineering",
        },
      ],
    };
    const [instructor] = parseInstructors(payload);
    expect(instructor?.fullName).toBe("Jon Reifschneider");
    expect(instructor?.department).toBe("Engineering");
  });
});

const courses: Course[] = [
  { id: "1", slug: "a", name: "A", partnerIds: ["7"], instructorIds: ["100"] },
  { id: "2", slug: "b", name: "B", partnerIds: ["7", "9"], instructorIds: ["100", "200"] },
  { id: "3", slug: "c", name: "C" },
];

describe("collecting ids", () => {
  test("deduplicates partner ids across the library", () => {
    expect(collectPartnerIds(courses).sort()).toEqual(["7", "9"]);
  });

  test("deduplicates instructor ids across the library", () => {
    expect(collectInstructorIds(courses).sort()).toEqual(["100", "200"]);
  });

  test("courses without institutions do not add empty ids", () => {
    expect(collectPartnerIds([{ id: "x", slug: "x", name: "X" }])).toEqual([]);
  });
});

describe("tallyPartners", () => {
  const known = new Map<string, Partner>(
    parsePartners(partnersPayload).map((partner) => [partner.id, partner]),
  );

  test("ranks institutions by how many courses came from each", () => {
    const tally = tallyPartners(courses, known);
    expect(tally[0]?.partner.name).toBe("Duke University");
    expect(tally[0]?.courses).toBe(2);
  });

  test("an unresolved id is labelled, never dropped silently", () => {
    const orphan: Course[] = [{ id: "1", slug: "a", name: "A", partnerIds: ["999"] }];
    expect(tallyPartners(orphan, known)[0]?.partner.name).toContain("999");
  });
});

describe("findPartner", () => {
  const partners = parsePartners(partnersPayload);

  test("finds by short name", () => {
    expect(findPartner(partners, "duke")?.id).toBe("7");
  });

  test("finds by part of the full name, ignoring accents and case", () => {
    expect(findPartner(partners, "ANDES")?.id).toBe("9");
  });

  test("returns undefined when nothing matches", () => {
    expect(findPartner(partners, "mit")).toBeUndefined();
  });
});
