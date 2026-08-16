import { emit, table, type Flags } from "../output.ts";
import { listCourses, searchCourses } from "../services/memberships.ts";
import { requireSession } from "../session.ts";

export async function run(flags: Flags): Promise<void> {
  const { client } = requireSession();
  const all = await listCourses(client);
  const query = flags.values.buscar ?? flags.values.search ?? flags.positional[0];
  const matches = query ? searchCourses(all, query) : all;

  emit(flags.output, { total: all.length, matches: matches.length, courses: matches }, () =>
    [
      table(
        matches.map((course) => ({ slug: course.slug, nombre: course.name })),
        ["slug", "nombre"],
      ),
      "",
      query
        ? `${matches.length} de ${all.length} cursos matchean "${query}"`
        : `${all.length} cursos`,
    ].join("\n"),
  );
}
