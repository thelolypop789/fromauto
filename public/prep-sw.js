// Service worker for /prep only (registered with scope "/prep"; the teacher app is never controlled).
// - Page loads: network first, cached app shell when offline.
// - Hashed build assets and fonts: cache first (file names change on every build).
// - Supabase / API calls: never touched, always live.
const VERSION = "prep-v1";
const SHELL = "/prep";

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

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(SHELL, copy)); }
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  const cacheable =
    (url.origin === location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/prep-icons/"))) ||
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })),
  );
});
