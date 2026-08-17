import { fail } from "../errors.ts";
import { emit, isHuman, type Flags } from "../output.ts";
import { downloadCourse } from "../services/download.ts";
import { requireSession } from "../session.ts";

export async function run(flags: Flags): Promise<void> {
  const slug = flags.positional[0];
  if (!slug) fail("MISSING_ARGUMENT", "expected a course slug");

  const { client } = requireSession();
  const showProgress = isHuman(flags) && !flags.quiet;

  const manifest = await downloadCourse(client, slug, {
    outDir: flags.values.out,
    langs: flags.values.lang?.split(","),
    limit: flags.values.limit ? Number(flags.values.limit) : undefined,
    onProgress: showProgress
      ? (done, total, item) => {
          process.stderr.write(`\r[${done}/${total}] ${item.name.slice(0, 60).padEnd(60)}`);
        }
      : undefined,
  });
  if (showProgress) process.stderr.write("\n");

  const bytes = manifest.items.reduce((sum, item) => sum + item.bytes, 0);
  emit(flags, { ...manifest, totalBytes: bytes }, () =>
    [
      `course     ${manifest.slug}`,
      `folder     ${manifest.dir}`,
      `downloaded ${manifest.items.length} items (${(bytes / 1024).toFixed(1)} KB)`,
      `skipped    ${manifest.skipped.length}`,
    ].join("\n"),
  );
}
