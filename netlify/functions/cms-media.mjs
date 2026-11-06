// Streams a media file from Blobs. Public (the same images are public on the site).
import { mediaStore, pool } from "../lib/store.mjs";

export default async (req) => {
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("src/images/uploads/") || path.includes("..")) return new Response("Bad request", { status: 400 });
  const { rows } = await pool().query(`SELECT content_type FROM cms_media WHERE path=$1`, [path]);
  const bytes = await mediaStore().get(path, { type: "arrayBuffer" });
  if (!rows[0] || !bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, { headers: { "content-type": rows[0].content_type, "cache-control": "private, max-age=60" } });
};
