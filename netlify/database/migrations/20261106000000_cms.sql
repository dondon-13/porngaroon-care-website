-- CMS storage: a virtual file tree (published) + editorial-workflow drafts + media index.
-- Decap serialises entries (front matter / JSON); we store the raw text per path.

CREATE TABLE cms_files (
  path        text PRIMARY KEY,           -- e.g. src/news/2026-11-05-170000.md, src/_data/home.json
  content     text NOT NULL,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms_unpublished (
  key             text PRIMARY KEY,       -- "<collection>/<slug>"
  collection      text NOT NULL,
  slug            text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',  -- draft | pending_review | pending_publish
  has_subfolders  boolean NOT NULL DEFAULT true,
  diffs           jsonb NOT NULL DEFAULT '[]',    -- [{id, path, originalPath, newFile, content?}]
  updated_by      text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms_media (
  path          text PRIMARY KEY,         -- e.g. src/images/uploads/photo.jpg (bytes live in Netlify Blobs)
  content_type  text NOT NULL,
  size          integer NOT NULL,
  uploaded_by   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Audit trail / rollback safety net for published content
CREATE TABLE cms_history (
  id          bigserial PRIMARY KEY,
  path        text NOT NULL,
  content     text,                       -- NULL = deleted
  changed_by  text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cms_history_path_idx ON cms_history (path, changed_at DESC);
