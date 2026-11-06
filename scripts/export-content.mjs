// Off-platform backup: dumps all published content and media to backups/<timestamp>/.
// Usage: netlify dev:exec node scripts/export-content.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pool, mediaStore } from "../netlify/lib/store.mjs";

const out = `backups/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const db = pool();
const { rows: files } = await db.query(`SELECT path, content FROM cms_files`);
const { rows: media } = await db.query(`SELECT path FROM cms_media`);
for (const { path, content } of files) {
  await mkdir(dirname(`${out}/${path}`), { recursive: true });
  await writeFile(`${out}/${path}`, content);
}
for (const { path } of media) {
  const bytes = await mediaStore().get(path, { type: "arrayBuffer" });
  if (!bytes) continue;
  await mkdir(dirname(`${out}/${path}`), { recursive: true });
  await writeFile(`${out}/${path}`, Buffer.from(bytes));
}
console.log(`exported ${files.length} files + ${media.length} media to ${out}`);
process.exit(0);
