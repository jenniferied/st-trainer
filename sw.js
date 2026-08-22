// Offline-Cache für den ST-Trainer.
// Strategie: network-first mit Cache-Fallback — Rose bekommt immer die neueste
// Version, wenn sie online ist, und kann offline weiterüben (z.B. unterwegs).
const CACHE = "st-trainer-v2";
// geteilt-tages-hub.js baut seit dem 22.08. den Kasten "Heute dran" und den Kopf
// jeder Spielrunde; ohne ihn steht die Startseite offline ohne Tageskacheln da.
// geteilt.css und geteilt-tagesstand.js gehoeren seit dem 12.08. abends in die
// Huelle: das geteilte Paket traegt jetzt Kasten, Ueberschriften, Kopfzeile und
// Seitenrahmen. Ohne es faellt die App auf nackte Browser-Voreinstellungen
// zurueck — vorher waren dort nur Farben drin und ein Fehlen fiel kaum auf.
// CACHE bleibt bewusst auf v2: der geaenderte sw.js loest die Installation
// ohnehin aus, und ein neuer Name wuerde die zur Laufzeit gecachten Fragen und
// Folien wegwerfen.
const SHELL = [
  ".",
  "index.html",
  "css/geteilt.css",
  "css/style.css",
  "js/config.js",
  "js/geteilt-tages-hub.js",
  "js/geteilt-tagesstand.js",
  "js/geteilt-zuordnen.js",
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
