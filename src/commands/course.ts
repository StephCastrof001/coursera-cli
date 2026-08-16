import { emit, fail, type Flags } from "../output.ts";
import { countItems, fetchOutline } from "../services/courses.ts";
import { requireSession } from "../session.ts";

export async function run(flags: Flags): Promise<void> {
  const slug = flags.positional[0];
  if (!slug) fail("falta el slug del curso", 'probá: coursera courses --buscar "machine learning"');

  const { client } = requireSession();
  const outline = await fetchOutline(client, slug);

  emit(flags.output, outline, () => {
    const lines = [`${slug}  (courseId ${outline.courseId})`, ""];
    outline.modules.forEach((module, index) => {
      lines.push(`M${index + 1}. ${module.name}`);
      for (const lesson of module.lessons) {
        lines.push(`    ${lesson.name}`);
        for (const item of lesson.items) lines.push(`      - [${item.type}] ${item.name}`);
      }
    });
    lines.push("", `${outline.modules.length} módulos, ${countItems(outline)} items`);
    return lines.join("\n");
  });
}
