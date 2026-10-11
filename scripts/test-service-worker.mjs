#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const publicRoot = process.argv[2]
  ? pathToFileURL(`${resolve(process.argv[2], "public")}/`)
  : new URL("../assets/app-template/public/", import.meta.url);
const source = (await readFile(new URL("service-worker.js", publicRoot), "utf8"))
  .replace("__CACHE_NAME_JSON__", '"test-cache"').replaceAll("__CACHE_VERSION__", "test-build");
for (const scope of ["/", "/docs/"]) {
  const origin = "https://example.test";
  const callbacks = {};
  const cacheEntries = new Map();
  const requests = [];
  const deleted = [];
  const prefix = `shared-trip:${scope}:`;
  const response = () => ({ ok: true, marker: "network", clone() { return this; } });
  const cached = { marker: "cached" };
  const key = (request) => typeof request === "string" ? request : request.url;
  const cache = {
    addAll: async (urls) => urls.forEach((url) => cacheEntries.set(url, cached)),
    add: async (url) => cacheEntries.set(url, cached),
    match: async (request) => cacheEntries.get(key(request)),
    put: async (request, value) => cacheEntries.set(key(request), value)
  };
  cached.clone = () => cached;
  const context = vm.createContext({
    URL, console,
    self: {
      location: { origin, href: `${origin}${scope}service-worker.js` },
      addEventListener: (name, callback) => { callbacks[name] = callback; },
      skipWaiting: async () => {}, clients: { claim: async () => {} }
    },
    caches: { open: async () => cache, match: cache.match, keys: async () => [`${prefix}old-build`, "other-app-cache"], delete: async (name) => { deleted.push(name); return true; } },
    fetch: async (request) => { requests.push(key(request)); return response(); }
  });
  vm.runInContext(source, context);
  let installing;
  callbacks.install({ waitUntil: (promise) => { installing = promise; } });
  await installing;
  let activating;
  callbacks.activate({ waitUntil: (promise) => { activating = promise; } });
  await activating;
  assert.deepEqual(deleted, [`${prefix}old-build`], "Activation retains caches belonging to other apps");
  assert.ok([...cacheEntries.keys()].filter((url) => url.startsWith(origin)).every((url) => url.startsWith(`${origin}${scope}`)), "Shell assets remain under app scope");
  const jsUrl = [...cacheEntries.keys()].find((url) => url.includes(`${scope}app.js?v=`));
  assert.ok(jsUrl);
  const request = async (url, overrides = {}) => {
    let promise;
    callbacks.fetch({ request: { url, method: "GET", mode: "cors", destination: "script", ...overrides }, respondWith: (value) => { promise = value; } });
    return promise;
  };
  assert.equal((await request(jsUrl)).marker, "cached");
  assert.equal(requests.length, 0, "Warm versioned modules cause zero background fetches");
  const photo = `${origin}${scope}photos/abc123.webp`;
  await request(photo, { destination: "image" });
  assert.equal(requests.length, 1);
  await request(photo, { destination: "image" });
  assert.equal(requests.length, 1, "Warm local preview causes zero background fetches");
  await request(`${origin}${scope}firebase-config.js?v=test-build`);
  assert.equal(requests.length, 2, "Firebase configuration remains network-first");
  await request(`${origin}${scope}?day=2030-06-01`, { mode: "navigate", destination: "document" });
  assert.equal(requests.length, 3, "HTML navigations remain network-first");
}
console.log("Root/subpath service-worker scope and warm-cache request tests passed.");
