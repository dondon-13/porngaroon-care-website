export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("year", () => new Date().getFullYear());
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });

  // Published news only (hidden posts are excluded everywhere), newest first
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByTag("news")
      .filter((p) => !p.data.hidden)
      .sort((a, b) => b.date - a.date)
  );

  // {% youtube "https://youtu.be/..." %} inside articles
  eleventyConfig.addShortcode("youtube", (url) => {
    const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? `<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="วิดีโอ YouTube" loading="lazy" allowfullscreen></iframe>` : "";
  });
  eleventyConfig.addFilter("thaiDate", (d) =>
    new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Bangkok" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("telHref", (p) => "tel:" + String(p || "").replace(/[^0-9+]/g, ""));
  eleventyConfig.addFilter("lineMessage", (msg, id) =>
    "https://line.me/R/oaMessage/" + encodeURIComponent(id) + "/?" + encodeURIComponent(msg)
  );
  eleventyConfig.addFilter("nl2br", (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")
  );
  eleventyConfig.addFilter("chunk", (arr, n) => {
    const out = [];
    for (let i = 0; i < (arr || []).length; i += n) out.push(arr.slice(i, i + n));
    return out;
  });
  eleventyConfig.addFilter("head", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("excerpt", (html, len = 120) => {
    const t = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return t.length > len ? t.slice(0, len) + "…" : t;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
