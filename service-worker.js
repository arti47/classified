/* service-worker.js — network-first with an offline app-shell fallback.
 * Bump CACHE_VERSION whenever any shipped file changes. */

const CACHE_VERSION = "classified-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./data.js",
  "./data-monsters.js",
  "./data-npcs.js",
  "./firebase-config.js",
  "./src/main.js",
  "./src/core.js",
  "./src/ui.js",
  "./src/rules.js",
  "./src/derived.js",
  "./src/settings.js",
  "./src/store.js",
  "./src/sync.js",
  "./src/wizard.js",
  "./src/roller.js",
  "./src/sheet.js",
  "./src/combat.js",
  "./src/gm.js",
  "./src/screens.js",
  "./src/router.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never cache Firebase or CDN traffic

  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
