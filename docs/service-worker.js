const CACHE_NAME = "tide-lines-sample-v-d7e4948348d0";
const VERSIONED_RESOURCES_URL = "./resources.html?v=v-d7e4948348d0";
const LOCAL_SHELL = [
  "./",
  "./index.html",
  VERSIONED_RESOURCES_URL,
  "./styles.css?v=v-d7e4948348d0",
  "./app.js?v=v-d7e4948348d0",
  "./resources.js?v=v-d7e4948348d0",
  "./daily-guide.js?v=v-d7e4948348d0",
  "./i18n.js?v=v-d7e4948348d0",
  "./map-links.js?v=v-d7e4948348d0",
  "./google-place-links.js?v=v-d7e4948348d0",
  "./google-maps-place-url.js?v=v-d7e4948348d0",
  "./weather-forecast.js?v=v-d7e4948348d0",
  "./trip-resources.js?v=v-d7e4948348d0",
  "./flight-bookings.js?v=v-d7e4948348d0",
  "./translations-zh-hant.js?v=v-d7e4948348d0",
  "./translations-zh-hans.js?v=v-d7e4948348d0",
  "./translations-ja.js?v=v-d7e4948348d0",
  "./firebase-config.js?v=v-d7e4948348d0",
  "./manifest.webmanifest?v=v-d7e4948348d0",
  "./icons/icon-192.png?v=v-d7e4948348d0",
  "./icons/icon-512.png?v=v-d7e4948348d0",
  "./icons/apple-touch-icon.png?v=v-d7e4948348d0",
  "./icons/icon.svg?v=v-d7e4948348d0"
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
        if (resourcesPage) await cache.put("./resources.html", resourcesPage.clone());
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
    || (isAppShell && url.pathname === "./firebase-config.js");

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            const cacheKey = event.request.mode === "navigate"
              ? (url.pathname === "./" ? "./index.html" : url.pathname)
              : event.request;
            caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match(url.pathname === "./" ? "./index.html" : url.pathname)
              .then((page) => page || caches.match("./index.html"));
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
        .catch(() => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined));

      return cached || network;
    })
  );
});
