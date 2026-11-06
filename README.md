# พรการุญเฝ้าไข้ อุดรธานี — Website

Website for **Porngaroon Elderly Care Services** (ศูนย์เฝ้าไข้ พรการุญ) in Udon Thani, Thailand. The service provides caregivers for elderly people, bedridden patients and patients recovering at home or in hospital.

Live site: https://www.พรการุญเฝ้าไข้.com

It is a static site built with [Eleventy](https://www.11ty.dev/) and hosted on Netlify. Staff edit the content without touching code, through [Decap CMS](https://decapcms.org/) at `/admin`.

## Quick start

Requires Node.js 20.

```sh
npm install
npm start        # dev server with live reload at http://localhost:8080
npm run build    # production build into _site/
```

## Project structure

```
eleventy.config.js     Eleventy setup: collections, filters, youtube shortcode
netlify.toml           Netlify build settings and cache headers
src/
  index.njk            Home page (one page with every section)
  news-index.njk       /news/ — list of all articles
  news/                Articles as Markdown files (one file per article)
  _data/               Home page content and site settings (JSON, edited via CMS)
  _includes/           Layouts: base.njk (shell, SEO, JSON-LD), post.njk, news-card.njk
  admin/               Decap CMS: config.yml (editor fields), cms-setup.js (previews)
  css/ js/ images/     Static assets, copied as-is
  _redirects           301 redirects from the old WordPress URLs
  404.njk robots.njk sitemap.njk
```

### Pages

- **Home (`/`)**: hero, trust points, patient types (walking / bedridden), services, pricing, photo carousel of past cases, latest news, FAQ, about and contact. Each section reads from a file in `src/_data/`:

  | File | Content |
  |---|---|
  | `home.json` | Hero text and images, trust points, about section |
  | `services.json` | List of services |
  | `pricing.json` | Service plans. Each plan's button opens LINE with a pre-filled message |
  | `cases.json` | Case photos and captions for the carousel |
  | `faq.json` | Questions and answers |
  | `settings.json` | Phone, LINE, email, address, map location, social links, SEO title and description |

- **News (`/news/` and `/news/<file-name>/`)**: articles from `src/news/*.md`, newest first.

## Editing content (for staff)

1. Go to `https://www.พรการุญเฝ้าไข้.com/admin/` and log in with your Netlify Identity account.
2. **ข้อมูลข่าวสาร / บทความ** to write or edit articles. **เนื้อหาหน้าเว็บ** to edit the home page, prices, FAQ, contact details and so on.
3. Press **Publish**. The site updates within 1–2 minutes.

To embed a YouTube video in an article, press **+** in the editor and choose **วิดีโอ YouTube**. To hide an article without deleting it, tick **ซ่อนบทความนี้**.

Behind the scenes, the CMS uses the editorial workflow: each change becomes a `cms/...` branch and a pull request on GitHub, and publishing merges it into `main`. Netlify rebuilds the site whenever `main` changes.

## Writing articles by hand

Create `src/news/<name>.md`. The file name becomes the URL (`/news/<name>/`).

```markdown
---
title: หัวข้อบทความ
date: 2026-11-06
category: ความรู้การดูแล        # or: ข่าวสาร / โปรโมชั่น, กิจกรรม, วิดีโอ
cover: /images/uploads/photo.jpg   # optional, 16:9 (1600×900 recommended)
cover_position: center             # top | center | bottom
summary: สรุป 1-2 ประโยค สำหรับ Google
hidden: false                      # true = not published anywhere
---
เนื้อหาบทความ...

{% youtube "https://youtu.be/VIDEO_ID" %}
```

## Notes for developers

- `src/admin/config.yml` must stay in sync with the templates and `_data` files. If you add or rename a content field, update both sides.
- Use `collections.posts` in templates. It excludes hidden articles and sorts newest first.
- `sitemap.xml` and `robots.txt` are generated from `settings.site_url` and the published articles.
- Images for the CMS are limited to 1 MB. Blur patients' faces before uploading case photos.

## Deployment

Netlify builds every push to `main` with `npm run build` and publishes `_site/`. Netlify Identity and Git Gateway must stay enabled for the CMS login to work.
