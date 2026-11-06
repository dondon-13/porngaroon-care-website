// Build step: materialise published CMS content from Netlify Database into src/ so Eleventy
// (templates, collections, filters) works unchanged. Fails the build if the DB is unreachable
// or empty, so a bad deploy never replaces the live site.
import { mkdir, writeFile, readdir, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { pool, mediaStore } from "../netlify/lib/store.mjs";

// First-deploy escape hatch: Netlify applies migrations AFTER the build command, so on the very
// first production deploy the tables don't exist yet. With CMS_BOOTSTRAP=1 (set it only until the
// database is migrated and seeded) an unusable/empty DB falls back to the content committed in git.
const bootstrap = process.env.CMS_BOOTSTRAP === "1";

try {
  const db = pool();
  const { rows: files } = await db.query(`SELECT path, content FROM cms_files`);
  if (files.length === 0 && bootstrap) {
    console.warn("[cms] BOOTSTRAP: database is empty, building from content committed in git");
    process.exit(0);
  }
  if (files.length === 0) throw new Error("cms_files is empty — run `npm run seed` first");

  // Remove stale generated news (keeps news.11tydata.js)
  for (const f of await readdir("src/news").catch(() => [])) if (f.endsWith(".md")) await rm(`src/news/${f}`);

  for (const { path, content } of files) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  const { rows: media } = await db.query(`SELECT path, size FROM cms_media`);
  const store = mediaStore();
  let downloaded = 0;
  for (const { path, size } of media) {
    const existing = await stat(path).catch(() => null);
    if (existing && existing.size === size) continue;
    const bytes = await store.get(path, { type: "arrayBuffer" });
    if (!bytes) throw new Error(`Missing blob for ${path}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(bytes));
    downloaded++;
  }
  console.log(`[cms] wrote ${files.length} content files, ${downloaded}/${media.length} media downloaded`);
  process.exit(0);
} catch (e) {
  if (bootstrap) {
    console.warn(`[cms] BOOTSTRAP: ${e.message} — building from content committed in git`);
    process.exit(0);
  }
  console.error(`[cms] Could not pull content from Netlify Database: ${e.message}`);
  process.exit(1);
}
