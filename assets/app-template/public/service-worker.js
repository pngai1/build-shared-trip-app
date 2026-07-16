const CACHE_NAME = __CACHE_NAME_JSON__;
const VERSIONED_RESOURCES_URL = "/resources.html?v=__CACHE_VERSION__";
const LOCAL_SHELL = [
  "/",
  "/index.html",
  VERSIONED_RESOURCES_URL,
  "/styles.css?v=__CACHE_VERSION__",
  "/app.js?v=__CACHE_VERSION__",
  "/resources.js?v=__CACHE_VERSION__",
  "/daily-guide.js?v=__CACHE_VERSION__",
  "/i18n.js?v=__CACHE_VERSION__",
  "/map-links.js?v=__CACHE_VERSION__",
  "/google-place-links.js?v=__CACHE_VERSION__",
  "/google-maps-place-url.js?v=__CACHE_VERSION__",
  "/reminder-dates.js?v=__CACHE_VERSION__",
  "/weather-forecast.js?v=__CACHE_VERSION__",
  "/trip-resources.js?v=__CACHE_VERSION__",
  "/flight-bookings.js?v=__CACHE_VERSION__",
  "/translations-zh-hant.js?v=__CACHE_VERSION__",
  "/translations-zh-hans.js?v=__CACHE_VERSION__",
  "/translations-ja.js?v=__CACHE_VERSION__",
  "/firebase-config.js?v=__CACHE_VERSION__",
  "/manifest.webmanifest?v=__CACHE_VERSION__",
  "/icons/icon-192.png?v=__CACHE_VERSION__",
  "/icons/icon-512.png?v=__CACHE_VERSION__",
  "/icons/apple-touch-icon.png?v=__CACHE_VERSION__",
  "/icons/icon.svg?v=__CACHE_VERSION__"
];

const OPTIONAL_CDN_SHELL = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(LOCAL_SHELL);
        const resourcesPage = await cache.match(VERSIONED_RESOURCES_URL);
        if (resourcesPage) await cache.put("/resources.html", resourcesPage.clone());
        await Promise.allSettled(OPTIONAL_CDN_SHELL.map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;
  const isStaticCdn = ["unpkg.com", "www.gstatic.com"].includes(url.hostname)
    && ["script", "style"].includes(event.request.destination);

  if (!isAppShell && !isStaticCdn) return;

  const networkFirst = event.request.mode === "navigate"
    || (isAppShell && url.pathname === "/firebase-config.js");

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            const cacheKey = event.request.mode === "navigate"
              ? (url.pathname === "/" ? "/index.html" : url.pathname)
              : event.request;
            caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match(url.pathname === "/" ? "/index.html" : url.pathname)
              .then((page) => page || caches.match("/index.html"));
          }
          return Promise.reject(new Error("Network and cached configuration are unavailable"));
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || (event.request.mode === "navigate" ? caches.match("/index.html") : undefined));

      return cached || network;
    })
  );
});
