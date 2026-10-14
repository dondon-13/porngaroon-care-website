export default {
  layout: "post.njk",
  tags: "news",
  eleventyComputed: {
    // Hidden posts are not published at all
    permalink: (data) => (data.hidden ? false : `/news/${data.page.fileSlug}/`),
    eleventyExcludeFromCollections: (data) => !!data.hidden,
  },
};
