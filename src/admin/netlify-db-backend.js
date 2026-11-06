// Custom Decap CMS backend: stores content in Netlify Database via /.netlify/functions/cms.
// Modeled on decap-cms-backend-test (same Implementation interface), authenticated with Netlify Identity.
// Registered in cms-setup.js as "netlify-db". Decap version is pinned in index.html.
(function () {
  const API = "/.netlify/functions/cms";
  const MEDIA_URL = (path) => `/.netlify/functions/cms-media?path=${encodeURIComponent(path)}`;
  const h = window.h;
  const createClass = window.createClass;

  // --- Netlify Identity helpers -------------------------------------------------
  const identityReady = new Promise((resolve) => {
    const ni = window.netlifyIdentity;
    if (!ni) return resolve();
    ni.on("init", () => resolve());
    // widget may already be initialised
    setTimeout(resolve, 1500);
  });

  async function token() {
    await identityReady;
    const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
    if (!user) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
    return user.jwt();
  }

  async function api(action, params) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ action, ...params }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `ผิดพลาด (${res.status})`);
    return body;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  const basename = (p) => p.split("/").pop();

  async function upload(assetProxy) {
    const file = assetProxy.fileObj;
    await api("uploadMedia", { path: assetProxy.path, contentType: file.type, base64: await fileToBase64(file) });
    return normalizeMedia(assetProxy.path, file.size);
  }

  function normalizeMedia(path, size) {
    const url = MEDIA_URL(path);
    return { id: path, name: basename(path), size, path, url, displayURL: url };
  }

  // --- Login screen -------------------------------------------------------------
  const AuthenticationPage = createClass({
    componentDidMount() {
      const ni = window.netlifyIdentity;
      if (!ni) return;
      this.onLogin = (user) => {
        if (user) {
          ni.close();
          this.props.onLogin(user);
        }
      };
      this.onError = (err) => console.error("[netlify-identity]", err);
      ni.on("login", this.onLogin);
      ni.on("error", this.onError);
      // Already signed in (e.g. token still valid): continue without showing the modal.
      identityReady.then(() => {
        const user = ni.currentUser();
        if (user) this.onLogin(user);
      });
    },
    componentWillUnmount() {
      const ni = window.netlifyIdentity;
      if (!ni) return;
      ni.off("login", this.onLogin);
      ni.off("error", this.onError);
    },
    render() {
      // The modal opens only from this click, so remounts during startup cannot close it.
      return h(
        "section",
        { className: "nc-githubAuthenticationPage-root" },
        h("h2", null, "ระบบหลังบ้าน พรการุญเฝ้าไข้"),
        h(
          "button",
          { className: "nc-githubAuthenticationPage-button", onClick: () => window.netlifyIdentity.open("login") },
          "เข้าสู่ระบบ"
        )
      );
    },
  });

  // --- Backend ------------------------------------------------------------------
  class NetlifyDbBackend {
    constructor(config, options = {}) {
      this.options = options;
      this.mediaFolder = config.media_folder;
    }

    isGitBackend() {
      return false;
    }
    status() {
      return api("listUnpublished").then(
        () => ({ auth: { status: true }, api: { status: true, statusPage: "" } }),
        () => ({ auth: { status: false }, api: { status: true, statusPage: "" } })
      );
    }
    authComponent() {
      return AuthenticationPage;
    }
    async restoreUser() {
      await identityReady;
      const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
      if (!user) throw new Error("session expired");
      return this.authenticate(user);
    }
    async authenticate(user) {
      return { name: (user.user_metadata && user.user_metadata.full_name) || user.email, email: user.email };
    }
    async logout() {
      if (window.netlifyIdentity) window.netlifyIdentity.logout();
    }
    getToken() {
      return token();
    }
    traverseCursor() {
      return Promise.resolve({ entries: [], cursor: null });
    }

    // published content
    async entriesByFolder(folder, extension) {
      const rows = await api("listFolder", { folder, extension });
      return rows.map((r) => ({ data: r.content, file: { path: r.path, id: r.path } }));
    }
    async entriesByFiles(files) {
      const rows = await api("getFiles", { paths: files.map((f) => f.path) });
      return rows.map((r, i) => ({ file: files[i], data: r.content ?? "" }));
    }
    async getEntry(path) {
      const [row] = await api("getFiles", { paths: [path] });
      if (row.content == null) throw new Error(`ไม่พบเนื้อหา ${path}`);
      return { file: { path, id: null }, data: row.content };
    }

    // editorial workflow
    unpublishedEntries() {
      return api("listUnpublished");
    }
    async unpublishedEntry({ id, collection, slug }) {
      if (id) [collection, slug] = id.split("/");
      const entry = await api("getUnpublished", { key: `${collection}/${slug}` });
      if (!entry) {
        // Same shape as decap-cms-lib-util's EditorialWorkflowError
        const err = new Error("content is not under editorial workflow");
        err.name = "EditorialWorkflowError";
        err.notUnderEditorialWorkflow = true;
        throw err;
      }
      return entry;
    }
    unpublishedEntryDataFile(collection, slug, path) {
      return api("getUnpublishedData", { key: `${collection}/${slug}`, path });
    }
    async unpublishedEntryMediaFile(collection, slug, path) {
      return normalizeMedia(path, 0);
    }
    deleteUnpublishedEntry(collection, slug) {
      return api("deleteUnpublished", { collection, slug });
    }
    updateUnpublishedEntryStatus(collection, slug, status) {
      return api("setStatus", { collection, slug, status });
    }
    publishUnpublishedEntry(collection, slug) {
      return api("publish", { collection, slug });
    }

    async persistEntry(entry, opts) {
      const assets = [];
      for (const a of entry.assets || []) {
        await upload(a);
        assets.push(a.path);
      }
      const dataFiles = entry.dataFiles.map(({ path, newPath, raw }) => ({ path, newPath, raw }));
      if (!opts.useWorkflow) {
        // Not used (config is editorial_workflow), but keep it correct: save + publish immediately.
        const slug = entry.dataFiles[0].slug;
        await api("saveUnpublished", { collection: opts.collectionName, slug, dataFiles, assets, status: "draft", hasSubfolders: opts.hasSubfolders });
        return api("publish", { collection: opts.collectionName, slug });
      }
      return api("saveUnpublished", {
        collection: opts.collectionName,
        slug: entry.dataFiles[0].slug,
        dataFiles,
        assets,
        status: opts.status || (this.options && this.options.initialWorkflowStatus) || "draft",
        hasSubfolders: opts.hasSubfolders,
      });
    }

    deleteFiles(paths) {
      const content = paths.filter((p) => !p.startsWith("src/images/"));
      const media = paths.filter((p) => p.startsWith("src/images/"));
      return Promise.all([content.length && api("deleteFiles", { paths: content }), media.length && api("deleteMedia", { paths: media })]);
    }

    // media
    async getMedia(folder = this.mediaFolder) {
      const rows = await api("listMedia", { folder });
      return rows.map((r) => normalizeMedia(r.path, r.size));
    }
    async getMediaFile(path) {
      const url = MEDIA_URL(path);
      const blob = await fetch(url, { headers: {} }).then((r) => r.blob());
      const name = basename(path);
      const file = new File([blob], name, { type: blob.type });
      return { id: path, displayURL: url, path, name, size: file.size, file, url };
    }
    async getMediaDisplayURL(displayURL) {
      return displayURL.url || displayURL;
    }
    persistMedia(assetProxy) {
      return upload(assetProxy);
    }

    async getDeployPreview() {
      return null;
    }
    async getNotes() {
      return [];
    }
  }

  window.NetlifyDbBackend = NetlifyDbBackend;
})();
