// Shared storage helpers for CMS functions and build scripts.
import { readFileSync } from "node:fs";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";

// Connection string: NETLIFY_DB_URL (set by Netlify at build/runtime and by `netlify dev`),
// else CMS_DB_URL (explicit override, e.g. a production URL for seeding),
// else the local dev database recorded by the Netlify CLI in .netlify/state.json.
function connectionString() {
  if (process.env.NETLIFY_DB_URL) return undefined; // getDatabase() reads it itself
  if (process.env.CMS_DB_URL) return process.env.CMS_DB_URL;
  try {
    const url = JSON.parse(readFileSync(".netlify/state.json", "utf8")).dbConnectionString;
    if (url) console.warn("[cms] NETLIFY_DB_URL not set, using local dev database from .netlify/state.json");
    return url;
  } catch {
    return undefined;
  }
}

let _db;
export function pool() {
  if (!_db) _db = getDatabase({ connectionString: connectionString() });
  return _db.pool;
}

export function mediaStore() {
  // Inside Netlify (functions/build) Blobs is auto-configured. Elsewhere (seed script) pass credentials.
  let siteID = process.env.NETLIFY_SITE_ID;
  if (!siteID) {
    try {
      siteID = JSON.parse(readFileSync(".netlify/state.json", "utf8")).siteId;
    } catch {}
  }
  const token = process.env.NETLIFY_AUTH_TOKEN; // personal access token, only needed outside Netlify
  if (siteID && token) return getStore({ name: "cms-media", siteID, token });
  return getStore("cms-media");
}

export async function saveMedia({ path, contentType, bytes, user }) {
  await mediaStore().set(path, bytes, { metadata: { contentType } });
  await pool().query(
    `INSERT INTO cms_media (path, content_type, size, uploaded_by) VALUES ($1,$2,$3,$4)
     ON CONFLICT (path) DO UPDATE SET content_type=$2, size=$3, uploaded_by=$4, created_at=now()`,
    [path, contentType, bytes.byteLength, user || null]
  );
}

export async function publishFile(client, path, content, user) {
  await client.query(
    `INSERT INTO cms_files (path, content, updated_by) VALUES ($1,$2,$3)
     ON CONFLICT (path) DO UPDATE SET content=$2, updated_by=$3, updated_at=now()`,
    [path, content, user || null]
  );
  await client.query(`INSERT INTO cms_history (path, content, changed_by) VALUES ($1,$2,$3)`, [path, content, user || null]);
}

export async function deletePublishedFile(client, path, user) {
  await client.query(`DELETE FROM cms_files WHERE path=$1`, [path]);
  await client.query(`INSERT INTO cms_history (path, content, changed_by) VALUES ($1,NULL,$2)`, [path, user || null]);
}
