#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlan } from "./init-trip.mjs";
import { isSensitiveKey, validateTrip } from "./validate-trip.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const example = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "..", "assets", "trip.example.json"), "utf8"));

const baseline = validateTrip(example, { allowExample: true });
assert.deepEqual(baseline.errors, [], baseline.errors.join("\n"));

const unrestrictedReminder = structuredClone(example);
unrestrictedReminder.trip.reminders[0].dueDate = "2031-01-15";
const reminderResult = validateTrip(unrestrictedReminder, { allowExample: true });
assert.equal(reminderResult.errors.some((message) => message.includes("reminders[0].dueDate")), false);

const maplessPlan = normalizePlan({
  id: "location-tbd",
  name: "Location to be decided",
  period: "noon",
  planType: "other",
  booked: false,
  googleMapsUrl: "   ",
  mapsUrl: "https://www.google.com/maps/place/Stale+Place/@38.7,-9.1,17z",
  googleMapsPlaceName: "Stale Place",
  googleMapsPlaceLabel: "Stale Place, Old Address",
  googleMapsFeatureId: "0x1:0x2",
  address: "Old Address",
  lat: 38.7,
  lng: -9.1,
  approximateLocation: true
}, 0);
[
  "googleMapsUrl", "mapsUrl", "googleMapsPlaceName", "googleMapsPlaceLabel",
  "googleMapsFeatureId", "address", "lat", "lng", "approximateLocation"
].forEach((key) => assert.equal(Object.hasOwn(maplessPlan, key), false, `${key} should be removed`));

const invalidLink = structuredClone(example);
invalidLink.trip.days[0].plans[0].googleMapsUrl = "https://maps.app.goo.gl/short-link";
const invalidResult = validateTrip(invalidLink, { allowExample: true });
assert.equal(invalidResult.errors.some((message) => message.includes("days[0].plans[0].googleMapsUrl")), true);
assert.throws(
  () => normalizePlan({ id: "bad-map", googleMapsUrl: "https://maps.app.goo.gl/short-link" }, 0),
  /invalid Google Maps link/
);

for (const parts of [["client", "secret"], ["refresh", "token"], ["access", "token"], ["private", "key"], ["passport", "number"], ["secret", "access", "key"]]) {
  const variants = [parts.join("_"), parts.join("-"), parts.join(""), parts.map((part, i) => i ? part[0].toUpperCase() + part.slice(1) : part).join("")];
  for (const key of variants) {
    assert.equal(isSensitiveKey(key), true, `${key} must be recognized regardless of formatting`);
    const unsafe = structuredClone(example);
    unsafe.trip.days[0].plans[0].extra = [{ [key]: "invented-private-value" }];
    const result = validateTrip(unsafe, { allowExample: true });
    assert.ok(result.errors.some((message) => message.includes(`extra[0].${key}`) && message.includes("credentials")), `nested ${key} must not be published`);
    assert.ok(!result.errors.join("\n").includes("invented-private-value"), "errors must not echo values");
  }
}
for (const key of ["auth", "authDomain", "apiKey", "projectId", "booked", "participantGroupIds"]) {
  assert.equal(isSensitiveKey(key), false, `${key} is an innocuous or public web-config key`);
}

console.log("Trip contract tests passed.");
