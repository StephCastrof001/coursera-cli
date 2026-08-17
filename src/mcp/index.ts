/**
 * MCP server. Tools granulares (patrón interbank), no un tool con subcommand:
 * Claude puede llamar `list_courses` sin saber que es un subcomando de nada.
 *
 * Regla de contexto: `fetch_transcripts` NO devuelve el texto — devuelve dónde
 * quedó. Un curso son ~130 KB (≈35k tokens) y reventaría la conversación.
 * Para leer, `read_transcript` entrega UN item.
 */
import fs from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { countItems, fetchOutline } from "../services/courses.ts";
import {
  fetchSpecializations,
  groupByDomain,
  specializationProgress,
} from "../services/library.ts";
import { downloadCourse, readManifest } from "../services/download.ts";
import { listCourses, searchCourses } from "../services/memberships.ts";
import { checkSession, requireSession } from "../session.ts";

const TOOLS = [
  {
    name: "session_status",
    description:
      "Estado de la sesión de Coursera: si la cookie sigue viva, de dónde salió y cuántos cursos ve.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_courses",
    description:
      "Lista los cursos en los que el usuario está inscrito. Con `query` filtra por nombre o slug. " +
      "Devuelve el slug, que es lo que piden las demás tools.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "texto a buscar (opcional)" } },
    },
  },
  {
    name: "get_library_map",
    description:
      "Mapa de la biblioteca del usuario: cuántos cursos y horas tiene por rama y subrama, " +
      "más el avance en cada una de sus especializaciones (cuántos cursos tiene de cada una y cuántos le faltan). " +
      "Sirve para responder en qué se formó de verdad y qué dejó a medias.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_course_outline",
    description:
      "Árbol de un curso: módulos, lecciones e items con su tipo. Útil para decidir qué vale la pena leer.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "fetch_transcripts",
    description:
      "Baja transcripts y lecturas del curso al disco. Devuelve el índice de lo bajado (rutas y tamaños), NO el texto. " +
      "Usá `read_transcript` para leer un item.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        limit: { type: "number", description: "cortar después de N items" },
        lang: { type: "string", description: "idiomas por orden, ej. 'es,en'" },
      },
      required: ["slug"],
    },
  },
  {
    name: "read_transcript",
    description:
      "Devuelve el texto de UN item ya bajado. Se busca por itemId o por parte del nombre.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        itemId: { type: "string" },
        name: { type: "string", description: "parte del nombre del item" },
      },
      required: ["slug"],
    },
  },
] as const;

type Args = Record<string, unknown>;

async function handle(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case "session_status":
      return checkSession();

    case "list_courses": {
      const { client } = requireSession();
      const all = await listCourses(client);
      const query = typeof args.query === "string" ? args.query : undefined;
      const matches = query ? searchCourses(all, query) : all;
      return {
        total: all.length,
        matches: matches.length,
        courses: matches.map((course) => ({ slug: course.slug, name: course.name })),
      };
    }

    case "get_library_map": {
      const { client } = requireSession();
      const courses = await listCourses(client);
      const specs = await fetchSpecializations(client);
      return {
        totalCourses: courses.length,
        domains: groupByDomain(courses),
        specializations: specializationProgress(specs, courses).map((spec) => ({
          name: spec.name,
          slug: spec.slug,
          enrolled: spec.enrolled,
          total: spec.courseIds.length,
          missing: spec.missing,
        })),
        nota: "Un curso con dos ramas cuenta en las dos. Las horas son estimadas del texto de Coursera.",
      };
    }

    case "get_course_outline": {
      const { client } = requireSession();
      const outline = await fetchOutline(client, String(args.slug));
      return { ...outline, itemCount: countItems(outline) };
    }

    case "fetch_transcripts": {
      const { client } = requireSession();
      const manifest = await downloadCourse(client, String(args.slug), {
        limit: typeof args.limit === "number" ? args.limit : undefined,
        langs: typeof args.lang === "string" ? args.lang.split(",") : undefined,
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
        return { error: "ese curso no está bajado todavía; corré fetch_transcripts primero" };
      }
      const needle = typeof args.name === "string" ? args.name.toLowerCase() : undefined;
      const item = manifest.items.find(
        (candidate) =>
          candidate.itemId === args.itemId ||
          (needle !== undefined && candidate.name.toLowerCase().includes(needle)),
      );
      if (!item) {
        return {
          error: "item no encontrado en el manifiesto",
          available: manifest.items.map((candidate) => ({
            itemId: candidate.itemId,
            name: candidate.name,
          })),
        };
      }
      return { itemId: item.itemId, name: item.name, text: fs.readFileSync(item.file, "utf8") };
    }

    default:
      return { error: `tool desconocida: ${name}` };
  }
}

const server = new Server(
  { name: "coursera-cli", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handle(request.params.name, (request.params.arguments ?? {}) as Args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      isError: true,
      content: [
        { type: "text", text: error instanceof Error ? error.message : String(error) },
      ],
    };
  }
});

await server.connect(new StdioServerTransport());
