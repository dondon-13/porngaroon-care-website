// Streams a media file from Blobs. Public (the same images are public on the site).
import { mediaStore, pool } from "../lib/store.mjs";

export default async (req) => {
  // Admin previews call ?path=...; site pages reach here via the /images/uploads/* rewrite in
  // src/_redirects, where req.url is still the original /images/uploads/<file> URL.
  const url = new URL(req.url);
  let path = url.searchParams.get("path");
  if (!path && url.pathname.startsWith("/images/uploads/")) path = "src" + decodeURIComponent(url.pathname);
  if (!path || !path.startsWith("src/images/uploads/") || path.includes("..")) return new Response("Bad request", { status: 400 });
  const { rows } = await pool().query(`SELECT content_type FROM cms_media WHERE path=$1`, [path]);
  const bytes = await mediaStore().get(path, { type: "arrayBuffer" });
  if (!rows[0] || !bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, { headers: { "content-type": rows[0].content_type, "cache-control": "public, max-age=604800" } });
};
