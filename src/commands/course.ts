import { fail } from "../errors.ts";
import { emit, type Flags } from "../output.ts";
import { countItems, fetchOutline } from "../services/courses.ts";
import { listCourses } from "../services/memberships.ts";
import { fetchInstructors, fetchPartners } from "../services/partners.ts";
import { requireSession } from "../session.ts";

export async function run(flags: Flags): Promise<void> {
  const slug = flags.positional[0];
  if (!slug) fail("MISSING_ARGUMENT", "expected a course slug");

  const { client } = requireSession();
  const outline = await fetchOutline(client, slug);

  // Who teaches it is a separate lookup: memberships ignores those includes.
  const course = (await listCourses(client)).find((candidate) => candidate.slug === slug);
  const partners = course ? await fetchPartners(client, course.partnerIds ?? []) : new Map();
  const instructors = course ? await fetchInstructors(client, course.instructorIds ?? []) : new Map();

  const meta = {
    level: course?.level,
    certificates: course?.certificates,
    workload: course?.workload,
    institutions: [...partners.values()].map((partner) => partner.name),
    instructors: [...instructors.values()].map((person) => ({
      name: person.fullName,
      title: person.title,
    })),
  };

  emit(flags, { ...outline, ...meta, itemCount: countItems(outline) }, () => {
    const lines = [`${slug}  (courseId ${outline.courseId})`];
    if (meta.institutions.length > 0) lines.push(`by ${meta.institutions.join(", ")}`);
    if (meta.instructors.length > 0) {
      lines.push(`taught by ${meta.instructors.map((person) => person.name).join(", ")}`);
    }
    if (meta.level) lines.push(`level ${meta.level}`);
    if (meta.workload) lines.push(`workload ${meta.workload}`);
    lines.push("");
    outline.modules.forEach((module, index) => {
      lines.push(`M${index + 1}. ${module.name}`);
      for (const lesson of module.lessons) {
        lines.push(`    ${lesson.name}`);
        for (const item of lesson.items) lines.push(`      - [${item.type}] ${item.name}`);
      }
    });
    lines.push("", `${outline.modules.length} modules, ${countItems(outline)} items`);
    return lines.join("\n");
  });
}
