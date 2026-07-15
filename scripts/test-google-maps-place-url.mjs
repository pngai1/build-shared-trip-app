#!/usr/bin/env node

import assert from "node:assert/strict";
import { parseFullGoogleMapsPlaceUrl } from "../assets/app-template/public/google-maps-place-url.js";

const placeUrl = "https://www.google.com/maps/place/Harbor+Museum,+1+Quay+Road/@40.000000,10.000000,14z/data=!4m6!3m5!1s0x123:0x456!8m2!3d38.707750!4d-9.136590!16s%2Fg%2Fsample";
const parsed = parseFullGoogleMapsPlaceUrl(placeUrl);
assert.equal(parsed.ok, true);
assert.equal(parsed.coordinateSource, "place");
assert.equal(parsed.lat, 38.70775);
assert.equal(parsed.lng, -9.13659);
assert.equal(parsed.placeName, "Harbor Museum");
assert.equal(parsed.address, "1 Quay Road");

const regional = parseFullGoogleMapsPlaceUrl(placeUrl.replace("www.google.com", "www.google.co.jp"));
assert.equal(regional.ok, true);

const viewportOnly = parseFullGoogleMapsPlaceUrl("https://www.google.com/maps/place/Harbor+Museum/@38.707750,-9.136590,14z");
assert.equal(viewportOnly.ok, true);
assert.equal(viewportOnly.coordinateSource, "viewport");

for (const invalid of [
  "https://maps.app.goo.gl/short-link",
  "https://example.com/maps/place/Fake/@1,2,10z",
  "http://www.google.com/maps/place/Fake/@1,2,10z",
  "https://www.google.com/maps/search/Fake/@1,2,10z",
  "not a URL"
]) {
  assert.equal(parseFullGoogleMapsPlaceUrl(invalid).ok, false, invalid);
}

console.log("Google Maps place URL parser tests passed.");
