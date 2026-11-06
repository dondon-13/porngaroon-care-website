// One-time (re-runnable) import of existing repo content into Netlify Database + Blobs.
// Usage: netlify dev:exec node scripts/seed-from-repo.mjs [--force]
// Outside Netlify's runtime also set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN (for Blobs).
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { pool, saveMedia } from "../netlify/lib/store.mjs";

export async function seed({ force = false } = {}) {
  const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  const db = pool();

  let files = 0, skipped = 0, media = 0;
  const put = async (path, content) => {
    const r = await db.query(
      `INSERT INTO cms_files (path, content, updated_by) VALUES ($1,$2,'seed')
       ON CONFLICT (path) DO ${force ? "UPDATE SET content=$2, updated_by='seed', updated_at=now()" : "NOTHING"}`,
      [path, content]
    );
    r.rowCount ? files++ : skipped++;
  };

  for (const f of await readdir("src/news")) if (f.endsWith(".md")) await put(`src/news/${f}`, await readFile(`src/news/${f}`, "utf8"));
  for (const f of await readdir("src/_data")) if (f.endsWith(".json")) await put(`src/_data/${f}`, await readFile(`src/_data/${f}`, "utf8"));

  for (const f of await readdir("src/images/uploads")) {
    const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
    if (!types[ext]) continue;
    await saveMedia({ path: `src/images/uploads/${f}`, contentType: types[ext], bytes: await readFile(`src/images/uploads/${f}`), user: "seed" });
    media++;
  }
  console.log(`seeded ${files} content files (${skipped} already existed), ${media} media files`);
  return { files, skipped, media };
}

// Run directly: node scripts/seed-from-repo.mjs [--force]
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seed({ force: process.argv.includes("--force") });
  process.exit(0);
}
