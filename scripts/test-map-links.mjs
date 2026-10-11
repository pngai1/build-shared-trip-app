#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const publicRoot = process.argv[2]
  ? pathToFileURL(`${resolve(process.argv[2], "public")}/`)
  : new URL("../assets/app-template/public/", import.meta.url);
const { normalizeGoogleMapsUrl, buildGoogleMapsUrl } = await import(new URL("map-links.js", publicRoot));
const real = "https://www.google.com/maps/place/Example+Hotel/@46.0,7.7,16z/data=!4m6!3m5!1s0x111:0x222!8m2!3d46.02!4d7.75";
assert.equal(normalizeGoogleMapsUrl(real), real);
for (const host of ["www.google.co.jp", "www.google.co.uk", "maps.google.com.hk"]) {
  const localized = real.replace("www.google.com", host);
  assert.equal(normalizeGoogleMapsUrl(localized), localized);
}
const synthetic = normalizeGoogleMapsUrl("https://www.google.com/maps/place/Example+Hotel/@46.0,7.7,16z");
assert.equal(new URL(synthetic).pathname, "/maps/search/");
assert.equal(new URL(synthetic).searchParams.get("query"), "Example Hotel");
assert.equal(normalizeGoogleMapsUrl(synthetic), synthetic);
assert.equal(normalizeGoogleMapsUrl("https://www.google.com/maps?cid=1234"), "https://www.google.com/maps?cid=1234");
for (const unsafe of ["javascript:alert(1)", "https://google.com.evil.test/maps?cid=1", "https://user@www.google.com/maps?cid=1", "http://www.google.com/maps?cid=1", "https://maps.app.goo.gl/demo", "https://www.google.com/maps/search/?query=Venue", "https://www.google.com/maps/place/%ZZ/@1,2,3z"]) {
  assert.equal(normalizeGoogleMapsUrl(unsafe), "", unsafe);
}
assert.equal(buildGoogleMapsUrl({ name: "Placeholder", mapLocationOmitted: true, googleMapsUrl: real }), "");
assert.equal(buildGoogleMapsUrl({ googleMapsUrl: real }), real);
assert.equal(new URL(buildGoogleMapsUrl({ name: "A & B", address: "Main Street" })).searchParams.get("query"), "A & B, Main Street");
assert.equal(buildGoogleMapsUrl({}), "");
const app = await readFile(new URL("app.js", publicRoot), "utf8");
const destinations = app.slice(app.indexOf("function googleMapsDestinations("), app.indexOf("function registerServiceWorker("));
const context = vm.createContext({ normalizeGoogleMapsUrl, buildGoogleMapsUrl, getGooglePlaceLinks: () => [] });
vm.runInContext(destinations, context);
assert.equal(context.googleMapsDestinations({ name: "Free afternoon" }).length, 0, "Locationless plans must not acquire a Maps action");
assert.equal(context.googleMapsDestinations({ name: "Omitted", lat: 1, lng: 2, mapLocationOmitted: true, googleMapsUrl: real }).length, 0);
assert.equal(context.googleMapsDestinations({ googleMapsUrl: real })[0].url, real);
assert.equal(context.googleMapsDestinations({ name: "Place", lat: 1, lng: 2 }, { allowSearchFallback: false }).length, 0);
console.log("Google Maps destination normalization tests passed.");
