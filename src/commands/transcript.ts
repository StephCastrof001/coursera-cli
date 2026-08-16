import { emit, fail, type Flags } from "../output.ts";
import { downloadCourse } from "../services/download.ts";
import { requireSession } from "../session.ts";

export async function run(flags: Flags): Promise<void> {
  const slug = flags.positional[0];
  if (!slug) fail("falta el slug del curso", 'probá: coursera courses --buscar "machine learning"');

  const { client } = requireSession();
  const verbose = process.stdout.isTTY && flags.output !== "json";

  const manifest = await downloadCourse(client, slug, {
    outDir: flags.values.out,
    langs: flags.values.lang?.split(","),
    limit: flags.values.limit ? Number(flags.values.limit) : undefined,
    onProgress: verbose
      ? (done, total, item) => {
          process.stderr.write(`\r[${done}/${total}] ${item.name.slice(0, 60).padEnd(60)}`);
        }
      : undefined,
  });
  if (verbose) process.stderr.write("\n");

  const bytes = manifest.items.reduce((sum, item) => sum + item.bytes, 0);
  emit(
    flags.output,
    { ...manifest, totalBytes: bytes },
    () =>
      [
        `curso     ${manifest.slug}`,
        `carpeta   ${manifest.dir}`,
        `bajados   ${manifest.items.length} items (${(bytes / 1024).toFixed(1)} KB)`,
        `salteados ${manifest.skipped.length}`,
      ].join("\n"),
  );
}
