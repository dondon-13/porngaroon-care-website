// Shared admin setup: preview styles, article preview, YouTube block
(function () {
  var DEFAULT_COVER = window.CMS_DEFAULT_COVER || "/images/site/news-default.jpg";
  if (window.CMS_PREVIEW_CSS) CMS.registerPreviewStyle(window.CMS_PREVIEW_CSS, { raw: true });
  else CMS.registerPreviewStyle("/css/style.css");
  CMS.registerPreviewStyle(
    "body{background:#F5FBFA;margin:0}.pv-label{font:600 13px sans-serif;color:#4A5A60;margin:24px 0 8px}" +
    ".pv-card{max-width:340px}.post{padding-top:24px}", { raw: true });

  function youtubeId(url) {
    var m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  CMS.registerEditorComponent({
    id: "youtube",
    label: "วิดีโอ YouTube",
    fields: [{ name: "url", label: "ลิงก์ YouTube", widget: "string" }],
    pattern: /^\{% youtube "(.*?)" %\}$/,
    fromBlock: function (m) { return { url: m[1] }; },
    toBlock: function (o) { return '{% youtube "' + (o.url || "") + '" %}'; },
    toPreview: function (o) {
      var id = youtubeId(o.url);
      return id ? '<iframe src="https://www.youtube.com/embed/' + id + '" style="width:100%;aspect-ratio:16/9;border:0" allowfullscreen></iframe>' : "";
    }
  });

  var NewsPreview = createClass({
    render: function () {
      var e = this.props.entry;
      var d = function (k) { return e.getIn(["data", k]); };
      var cover = d("cover");
      var src = cover ? String(this.props.getAsset(cover)) : DEFAULT_COVER;
      var pos = d("cover_position") || "center";
      var img = function (cls) { return h("img", { className: cls, src: src, alt: "", style: { objectPosition: "center " + pos } }); };
      return h("div", { className: "wrap-narrow" },
        h("p", { className: "pv-label" }, "ตัวอย่างการ์ดบนหน้าแรก / หน้าข่าวสาร"),
        h("div", { className: "news-card pv-card" },
          img(""),
          h("span", { className: "news-card__meta" }, d("category") || ""),
          h("span", { className: "news-card__title" }, d("title") || "หัวข้อบทความ"),
          d("summary") ? h("span", { className: "news-card__summary" }, d("summary")) : null
        ),
        h("p", { className: "pv-label" }, "ตัวอย่างหน้าบทความ"),
        h("article", { className: "post" },
          h("p", { className: "post__meta" }, d("category") || ""),
          h("h1", { className: "post__title" }, d("title") || "หัวข้อบทความ"),
          img("post__cover"),
          h("div", { className: "post__body" }, this.props.widgetFor("body"))
        )
      );
    }
  });
  CMS.registerPreviewTemplate("news", NewsPreview);
})();
