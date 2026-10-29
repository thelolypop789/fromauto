// Service worker for /prep only (registered with scope "/prep"; the teacher app is never controlled).
// - App pages (/prep, /prep/stats, ... all served by prep.html): network first, the cached app shell when offline.
// - Static pages (/prep/welcome/, /prep/sample/...): network first, cached under their own URL. They must never be
//   stored as the app shell, or an offline launch of the app opens the landing page instead.
// - Hashed build assets, icons and fonts: cache first (file names change on every build); old assets are pruned.
// - Supabase / API calls: never touched, always live.
const VERSION = "prep-v3";
const SHELL = "/prep";
const MAX_ASSETS = 120;
const isStatic = path => /^\/prep\/(welcome|sample)(\/|$)/.test(path);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(c => c.add(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("prep-") && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Keeps the newest MAX_ASSETS build files: cache.keys() lists entries in insertion order, oldest first.
async function prune(cache) {
  const keys = (await cache.keys()).filter(r => new URL(r.url).pathname.startsWith("/assets/"));
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map(r => cache.delete(r)));
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === location.origin) {
    const key = isStatic(url.pathname) ? url.pathname : SHELL;
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
          return res;
        })
        .catch(() => caches.match(key).then(hit => hit || caches.match(SHELL))),
    );
    return;
  }

  const cacheable =
    (url.origin === location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/prep-icons/"))) ||
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy).then(() => (url.pathname.startsWith("/assets/") ? prune(c) : undefined)));
      }
      return res;
    })),
  );
});
