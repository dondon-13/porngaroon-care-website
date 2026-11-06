# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static marketing site for พรการุญเฝ้าไข้ อุดรธานี (a Thai elderly/patient care service), built with Eleventy 3 (Nunjucks templates) and deployed on Netlify. Non-technical staff edit content through Decap CMS at `/admin`. All user-facing text is Thai; keep new copy in Thai.

## Commands

- `npm start` — dev server with live reload (`eleventy --serve`)
- `npm run build` — build to `_site/` (this is what Netlify runs, Node 20)

There are no tests or linters.

## Architecture

- **Config:** `eleventy.config.js` defines everything custom: the `posts` collection, filters (`thaiDate`, `isoDate`, `telHref`, `lineMessage`, `nl2br`, `chunk`, `head`, `excerpt`) and the `{% youtube "url" %}` shortcode. Input is `src/`, output `_site/`. Markdown and HTML are pre-processed with Nunjucks, so `{% %}` works inside news articles.
- **Single-page home:** `src/index.njk` renders every home section (hero, services, pricing, cases carousel, FAQ, about, contact) from the JSON files in `src/_data/`. `settings.json` (phone, LINE, map, SEO, site URL) is used globally, including in `_includes/base.njk` for meta/OG tags and the `MedicalBusiness` JSON-LD.
- **News:** `src/news/*.md` with `src/news/news.11tydata.js` setting layout `post.njk`, tag `news`, and the permalink `/news/<filename>/`. Posts with `hidden: true` get no permalink and are left out of collections. Always use `collections.posts` (filtered and sorted newest first), not `collections.news`.
- **Static assets:** `src/images`, `src/css`, `src/js`, `src/admin` are copied through as-is. `src/admin/**` is ignored as templates. `src/_redirects` (Netlify 301s from the old WordPress URLs) is copied to the site root.

## Decap CMS coupling

`src/admin/config.yml` is the schema the editors use. It must stay in sync with the templates:

- Each field under the `pages` collection maps 1:1 onto a key in a `src/_data/*.json` file. If you add, rename or remove a data key that a template uses, update the CMS field too (and the other way round), or editors will lose or break content.
- News front matter fields: `title`, `date`, `category` (fixed option list), `cover`, `cover_position` (top/center/bottom → CSS `object-position`), `summary`, `hidden`, body.
- Uploads go to `src/images/uploads` and are served at `/images/uploads`.
- `src/admin/cms-setup.js` registers the preview styles, the news preview template (it reuses the site's `news-card` / `post` CSS classes, so renaming those classes breaks the preview), and the YouTube editor component. Its regex and output format must match the `youtube` shortcode in `eleventy.config.js`.
- The backend is `git-gateway` with `publish_mode: editorial_workflow`: each CMS edit opens a `cms/<collection>/<slug>` branch and PR against `main`, and merging it publishes. Most commits on `main` come from these PRs. News filenames are timestamp slugs (`YYYY-MM-DD-HHmmss.md`).
