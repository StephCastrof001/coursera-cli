/**
 * MCP server. Granular tools (the interbank pattern), not one tool with a
 * subcommand argument: Claude can call `list_courses` without knowing it is a
 * subcommand of anything.
 *
 * Context rule: `fetch_transcripts` does NOT return text — it returns where the
 * text landed. A course is ~130 KB (≈35k tokens) and would blow up the
 * conversation. To read, `read_transcript` hands over one item.
 */
import fs from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "../constants.ts";
import { countItems, fetchOutline } from "../services/courses.ts";
import { downloadCourse, readManifest } from "../services/download.ts";
import {
  fetchSpecializations,
  groupByDomain,
  parseWorkloadHours,
  specializationProgress,
  tallyLevels,
} from "../services/library.ts";
import { filterCourses, listCourses } from "../services/memberships.ts";
import {
  collectInstructorIds,
  collectPartnerIds,
  fetchInstructors,
  fetchPartners,
  tallyPartners,
} from "../services/partners.ts";
import type { CourseLevel } from "../types.ts";
import { checkSession, requireSession } from "../session.ts";

const TOOLS = [
  {
    name: "session_status",
    description:
      "Coursera session state: whether the cookie is still alive, where it came from, and how many courses it can see.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_courses",
    description:
      "List the courses the user is enrolled in. Filters compose: query (name or slug), level, domain, language, maxHours. " +
      "Returns the slug, which every other tool takes as input.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "free text over name and slug" },
        level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
        domain: { type: "string", description: "branch or sub-branch id, e.g. data-science" },
        language: { type: "string", description: "primary language code, e.g. es" },
        maxHours: { type: "number", description: "at most this many estimated hours" },
      },
    },
  },
  {
    name: "get_library_map",
    description:
      "Map of the user's library: courses and hours per branch and sub-branch, declared difficulty levels, " +
      "top institutions, and progress on every specialization (how many courses they have and how many are missing). " +
      "Answers what they actually studied and what they left half-finished.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_course_outline",
    description:
      "Course tree: modules, lessons and items with their type, plus institution, instructors and declared level.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "fetch_transcripts",
    description:
      "Download a course's transcripts and readings to disk. Returns the index of what landed (paths and sizes), NOT the text. " +
      "Use `read_transcript` to read one item.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        limit: { type: "number", description: "stop after N items" },
        lang: { type: "string", description: "language preference order, e.g. 'es,en'" },
      },
      required: ["slug"],
    },
  },
  {
    name: "read_transcript",
    description: "Return the text of ONE already-downloaded item, found by itemId or by part of its name.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        itemId: { type: "string" },
        name: { type: "string", description: "part of the item name" },
      },
      required: ["slug"],
    },
  },
] as const;

type Args = Record<string, unknown>;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

async function handle(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case "session_status":
      return checkSession();

    case "list_courses": {
      const { client } = requireSession();
      const all = await listCourses(client);
      const matches = filterCourses(
        all,
        {
          search: asString(args.query),
          level: asString(args.level) as CourseLevel | undefined,
          domain: asString(args.domain),
          language: asString(args.language),
          maxHours: typeof args.maxHours === "number" ? args.maxHours : undefined,
        },
        (course) => parseWorkloadHours(course.workload),
      );
      return {
        total: all.length,
        matches: matches.length,
        courses: matches.map((course) => ({
          slug: course.slug,
          name: course.name,
          level: course.level,
          hours: parseWorkloadHours(course.workload),
        })),
      };
    }

    case "get_library_map": {
      const { client } = requireSession();
      const courses = await listCourses(client);
      const specs = await fetchSpecializations(client);
      const partners = await fetchPartners(client, collectPartnerIds(courses));
      return {
        totalCourses: courses.length,
        levels: tallyLevels(courses),
        domains: groupByDomain(courses),
        institutions: tallyPartners(courses, partners).map((entry) => ({
          name: entry.partner.name,
          courses: entry.courses,
        })),
        specializations: specializationProgress(specs, courses).map((spec) => ({
          name: spec.name,
          slug: spec.slug,
          enrolled: spec.enrolled,
          total: spec.courseIds.length,
          missing: spec.missing,
        })),
        note: "A course with two branches counts in both. Hours are estimated from Coursera's own text.",
      };
    }

    case "get_course_outline": {
      const { client } = requireSession();
      const slug = String(args.slug);
      const outline = await fetchOutline(client, slug);
      const course = (await listCourses(client)).find((candidate) => candidate.slug === slug);
      const partners = course ? await fetchPartners(client, course.partnerIds ?? []) : new Map();
      const instructors = course
        ? await fetchInstructors(client, collectInstructorIds([course]))
        : new Map();
      return {
        ...outline,
        itemCount: countItems(outline),
        level: course?.level,
        workload: course?.workload,
        institutions: [...partners.values()].map((partner) => partner.name),
        instructors: [...instructors.values()].map((person) => person.fullName),
      };
    }

    case "fetch_transcripts": {
      const { client } = requireSession();
      const manifest = await downloadCourse(client, String(args.slug), {
        limit: typeof args.limit === "number" ? args.limit : undefined,
        langs: asString(args.lang)?.split(","),
      });
      return {
        dir: manifest.dir,
        downloaded: manifest.items.length,
        skipped: manifest.skipped.length,
        totalBytes: manifest.items.reduce((sum, item) => sum + item.bytes, 0),
        items: manifest.items.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          kind: item.kind,
          bytes: item.bytes,
        })),
      };
    }

    case "read_transcript": {
      const manifest = readManifest(String(args.slug));
      if (!manifest) {
        return { error: "that course is not downloaded yet; run fetch_transcripts first" };
      }
      const needle = asString(args.name)?.toLowerCase();
      const item = manifest.items.find(
        (candidate) =>
          candidate.itemId === args.itemId ||
          (needle !== undefined && candidate.name.toLowerCase().includes(needle)),
      );
      if (!item) {
        return {
          error: "item not found in the manifest",
          available: manifest.items.map((candidate) => ({
            itemId: candidate.itemId,
            name: candidate.name,
          })),
        };
      }
      return { itemId: item.itemId, name: item.name, text: fs.readFileSync(item.file, "utf8") };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}

const server = new Server({ name: "coursera-cli", version: VERSION }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handle(request.params.name, (request.params.arguments ?? {}) as Args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    };
  }
});

await server.connect(new StdioServerTransport());
