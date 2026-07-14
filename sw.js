// Offline-Cache für den ST-Trainer.
// Strategie: network-first mit Cache-Fallback — Rose bekommt immer die neueste
// Version, wenn sie online ist, und kann offline weiterüben (z.B. unterwegs).
const CACHE = "st-trainer-v1";
const SHELL = [
  ".",
  "index.html",
  "css/style.css",
  "js/config.js",
  "js/main.js",
  "js/core.js",
  "manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Nur eigene GET-Requests cachen — Supabase & Fremd-Hosts (Fonts) unangetastet durchlassen
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: false }))
  );
});
