export default {
  layout: "post.njk",
  tags: "news",
  eleventyComputed: {
    // Hidden posts are not published at all
    permalink: (data) => (data.hidden ? false : `/news/${data.page.inputPath.split("/").pop().replace(/\.md$/, "")}/`),
    eleventyExcludeFromCollections: (data) => !!data.hidden,
  },
};
