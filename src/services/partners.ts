/**
 * Universities and instructors.
 *
 * Neither rides along with memberships: `includes=partnerIds` is ignored there.
 * The cheap way is to collect the ids from the whole library and resolve them
 * in one batched call — two requests for 215 courses, not 430.
 */
import type { Client } from "../http.ts";
import type { Course, Envelope, Instructor, Partner } from "../types.ts";
import { endpoint } from "./endpoints.ts";

/** Coursera rejects absurdly long id lists; chunking keeps URLs sane. */
const CHUNK = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function parsePartners(payload: Envelope): Partner[] {
  const rows = (payload.elements ?? []) as Array<Partial<Partner>>;
  return rows
    .filter((row): row is Partner => Boolean(row.id && row.name))
    .map((row) => ({
      id: String(row.id),
      name: row.name,
      shortName: row.shortName,
      location: row.location,
    }));
}

export function parseInstructors(payload: Envelope): Instructor[] {
  const rows = (payload.elements ?? []) as Array<Partial<Instructor>>;
  return rows
    .filter((row): row is Instructor => Boolean(row.id && row.fullName))
    .map((row) => ({
      id: String(row.id),
      fullName: row.fullName,
      title: row.title,
      department: row.department,
    }));
}

export async function fetchPartners(client: Client, ids: string[]): Promise<Map<string, Partner>> {
  const map = new Map<string, Partner>();
  for (const batch of chunk([...new Set(ids)], CHUNK)) {
    if (batch.length === 0) continue;
    const payload = await client.getJson<Envelope>(endpoint("partners", { ids: batch.join(",") }));
    for (const partner of parsePartners(payload)) map.set(partner.id, partner);
  }
  return map;
}

export async function fetchInstructors(
  client: Client,
  ids: string[],
): Promise<Map<string, Instructor>> {
  const map = new Map<string, Instructor>();
  for (const batch of chunk([...new Set(ids)], CHUNK)) {
    if (batch.length === 0) continue;
    const payload = await client.getJson<Envelope>(endpoint("instructors", { ids: batch.join(",") }));
    for (const instructor of parseInstructors(payload)) map.set(instructor.id, instructor);
  }
  return map;
}

export interface PartnerTally {
  partner: Partner;
  courses: number;
}

/** Which institutions your library actually comes from, most-taught first. */
export function tallyPartners(courses: Course[], partners: Map<string, Partner>): PartnerTally[] {
  const counts = new Map<string, number>();
  for (const course of courses) {
    for (const id of new Set(course.partnerIds ?? [])) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      partner: partners.get(id) ?? { id, name: `(unknown partner ${id})` },
      courses: count,
    }))
    .sort((a, b) => b.courses - a.courses || a.partner.name.localeCompare(b.partner.name));
}

export function collectPartnerIds(courses: Course[]): string[] {
  return [...new Set(courses.flatMap((course) => course.partnerIds ?? []))];
}

export function collectInstructorIds(courses: Course[]): string[] {
  return [...new Set(courses.flatMap((course) => course.instructorIds ?? []))];
}

/** Resolves a university by name, short name or id. Case- and accent-insensitive. */
export function findPartner(partners: Partner[], query: string): Partner | undefined {
  const fold = (text: string): string =>
    text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const needle = fold(query);
  return partners.find(
    (partner) =>
      partner.id === query ||
      fold(partner.shortName ?? "") === needle ||
      fold(partner.name).includes(needle),
  );
}
