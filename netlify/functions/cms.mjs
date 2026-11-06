// Backend for the custom Decap CMS "netlify-db" backend (src/admin/netlify-db-backend.js).
// One endpoint, JSON body { action, ...params }. Every call requires a valid Netlify Identity token.
import { pool, mediaStore, saveMedia, publishFile, deletePublishedFile } from "../lib/store.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function identify(req) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new HttpError(401, "Not signed in");
  const base = process.env.IDENTITY_URL || new URL("/.netlify/identity", req.url).toString();
  const res = await fetch(`${base}/user`, { headers: { authorization: auth } });
  if (!res.ok) throw new HttpError(401, "Invalid or expired login");
  const user = await res.json();
  return user.email;
}

async function triggerBuild() {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) return false;
  try {
    return (await fetch(hook, { method: "POST" })).ok;
  } catch {
    return false;
  }
}

const STATUSES = ["draft", "pending_review", "pending_publish"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 1024 * 1024;

const safePath = (p, prefix) => {
  if (typeof p !== "string" || !p.startsWith(prefix) || p.includes("..")) throw new HttpError(400, `Bad path: ${p}`);
  return p;
};
const safeContentPath = (p) => {
  if (typeof p !== "string" || p.includes("..") || !/^src\/(news|_data)\//.test(p)) throw new HttpError(400, `Bad path: ${p}`);
  return p;
};

const actions = {
  async listFolder({ folder, extension }) {
    const prefix = `${folder.replace(/\/$/, "")}/`;
    const { rows } = await pool().query(`SELECT path, content FROM cms_files WHERE path LIKE $1 ORDER BY path DESC`, [prefix.replace(/[%_\\]/g, "\\$&") + "%"]);
    return rows.filter((r) => !r.path.slice(prefix.length).includes("/") && (!extension || r.path.endsWith(`.${extension}`)));
  },

  async getFiles({ paths }) {
    const { rows } = await pool().query(`SELECT path, content FROM cms_files WHERE path = ANY($1)`, [paths]);
    const byPath = Object.fromEntries(rows.map((r) => [r.path, r.content]));
    return paths.map((path) => ({ path, content: byPath[path] ?? null }));
  },

  async listUnpublished() {
    const { rows } = await pool().query(`SELECT key FROM cms_unpublished ORDER BY updated_at DESC`);
    return rows.map((r) => r.key);
  },

  async getUnpublished({ key }) {
    const { rows } = await pool().query(`SELECT * FROM cms_unpublished WHERE key=$1`, [key]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      slug: r.slug,
      collection: r.collection,
      status: r.status,
      hasSubfolders: r.has_subfolders,
      updatedAt: r.updated_at,
      pullRequestAuthor: r.updated_by,
      // content stays server-side for data files until requested (see getUnpublishedData)
      diffs: r.diffs.map(({ content, ...d }) => d),
    };
  },

  async getUnpublishedData({ key, path }) {
    const { rows } = await pool().query(`SELECT diffs FROM cms_unpublished WHERE key=$1`, [key]);
    const diff = rows[0]?.diffs.find((d) => d.path === path);
    if (!diff) throw new HttpError(404, "Not found");
    return diff.content ?? "";
  },

  // dataFiles: [{path, newPath?, raw}], assets: [path] (already uploaded via uploadMedia)
  async saveUnpublished({ collection, slug, dataFiles, assets = [], status, hasSubfolders }, user) {
    const key = `${collection}/${slug}`;
    if (status && !STATUSES.includes(status)) throw new HttpError(400, "Bad status");
    const db = pool();
    const { rows } = await db.query(`SELECT status, diffs FROM cms_unpublished WHERE key=$1`, [key]);
    const existing = rows[0];

    const diffs = [];
    for (const f of dataFiles) {
      safeContentPath(f.path);
      if (f.newPath) safeContentPath(f.newPath);
      const prev = existing?.diffs.find((d) => d.path === f.path);
      const originalPath = prev ? prev.originalPath : f.path;
      const published = await db.query(`SELECT 1 FROM cms_files WHERE path=$1`, [originalPath]);
      diffs.push({ id: f.newPath || f.path, path: f.newPath || f.path, originalPath, newFile: published.rowCount === 0, content: f.raw });
    }
    // keep assets from previous saves of this draft too
    const assetPaths = new Set([...(existing?.diffs ?? []).filter((d) => d.media).map((d) => d.path), ...assets]);
    for (const p of assetPaths) diffs.push({ id: p, path: safePath(p, "src/images/uploads/"), newFile: true, media: true });

    await db.query(
      `INSERT INTO cms_unpublished (key, collection, slug, status, has_subfolders, diffs, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (key) DO UPDATE SET diffs=$6, has_subfolders=$5, updated_by=$7, updated_at=now()`,
      [key, collection, slug, existing?.status || status || "draft", hasSubfolders !== false, JSON.stringify(diffs), user]
    );
    return { ok: true };
  },

  async setStatus({ collection, slug, status }, user) {
    if (!STATUSES.includes(status)) throw new HttpError(400, "Bad status");
    await pool().query(`UPDATE cms_unpublished SET status=$2, updated_by=$3, updated_at=now() WHERE key=$1`, [`${collection}/${slug}`, status, user]);
    return { ok: true };
  },

  async deleteUnpublished({ collection, slug }) {
    await pool().query(`DELETE FROM cms_unpublished WHERE key=$1`, [`${collection}/${slug}`]);
    return { ok: true };
  },

  async publish({ collection, slug }, user) {
    const key = `${collection}/${slug}`;
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT diffs FROM cms_unpublished WHERE key=$1 FOR UPDATE`, [key]);
      if (!rows[0]) throw new HttpError(404, "Draft not found");
      for (const d of rows[0].diffs) {
        if (d.media) continue;
        if (d.originalPath && !d.newFile && d.originalPath !== d.path) await deletePublishedFile(client, d.originalPath, user);
        await publishFile(client, d.path, d.content ?? "", user);
      }
      await client.query(`DELETE FROM cms_unpublished WHERE key=$1`, [key]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return { ok: true, buildTriggered: await triggerBuild() };
  },

  async deleteFiles({ paths }, user) {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      for (const p of paths) await deletePublishedFile(client, safeContentPath(p), user);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return { ok: true, buildTriggered: await triggerBuild() };
  },

  async listMedia({ folder }) {
    const prefix = `${folder.replace(/\/$/, "")}/`;
    const { rows } = await pool().query(`SELECT path, size FROM cms_media WHERE path LIKE $1 ORDER BY created_at DESC`, [prefix.replace(/[%_\\]/g, "\\$&") + "%"]);
    return rows;
  },

  async uploadMedia({ path, contentType, base64 }, user) {
    safePath(path, "src/images/uploads/");
    if (!ALLOWED_TYPES.includes(contentType)) throw new HttpError(400, "รองรับเฉพาะไฟล์รูป JPG, PNG, WebP, GIF");
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > MAX_BYTES) throw new HttpError(400, "ไฟล์ใหญ่เกิน 1 MB");
    await saveMedia({ path, contentType, bytes, user });
    return { ok: true, size: bytes.byteLength };
  },

  async deleteMedia({ paths }) {
    for (const p of paths) {
      safePath(p, "src/images/uploads/");
      await mediaStore().delete(p);
      await pool().query(`DELETE FROM cms_media WHERE path=$1`, [p]);
    }
    return { ok: true };
  },
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const user = await identify(req);
    const { action, ...params } = await req.json();
    const handler = actions[action];
    if (!handler) throw new HttpError(400, `Unknown action: ${action}`);
    return json(await handler(params, user));
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return json({ error: e.message }, e instanceof HttpError ? e.status : 500);
  }
};
