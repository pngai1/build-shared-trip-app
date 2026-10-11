#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { validateTrip } from "./validate-trip.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scripts);
const example = JSON.parse(fs.readFileSync(path.join(root, "assets/trip.example.json"), "utf8"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shared-trip-isolation-"));

function generate(input, label) {
  const inputPath = path.join(temporary, `${label}.json`);
  const output = path.join(temporary, label);
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const result = spawnSync(process.execPath, [path.join(scripts, "init-trip.mjs"), inputPath, output, "--allow-example"], { encoding: "utf8" });
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
  const index = fs.readFileSync(path.join(output, "public/index.html"), "utf8");
  const trip = JSON.parse(index.match(/<script[^>]*id="trip-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const sw = fs.readFileSync(path.join(output, "public/service-worker.js"), "utf8");
  return {
    output, trip,
    buildId: trip.buildId,
    cacheName: vm.runInNewContext(`${sw}\nCACHE_NAME`, {
      URL, self: { location: { href: "https://example.test/service-worker.js" }, addEventListener() {} }
    }),
    input: JSON.parse(fs.readFileSync(path.join(output, "trip-input.json"), "utf8")),
    config: fs.readFileSync(path.join(output, "public/firebase-config.js"), "utf8")
  };
}

try {
  const baseline = generate(example, "baseline");
  const duplicate = generate(example, "duplicate");
  assert.equal(baseline.buildId, duplicate.buildId, "identical effective inputs must yield a stable build ID");
  assert.equal(baseline.cacheName, duplicate.cacheName);

  const newDocument = structuredClone(example);
  newDocument.sync.documentPath = "trips/another-isolated-example-board";
  const switched = generate(newDocument, "document-change");
  assert.notEqual(baseline.buildId, switched.buildId, "a new board must invalidate cached configuration");
  assert.notEqual(baseline.cacheName, switched.cacheName);
  assert.ok(switched.config.includes(newDocument.sync.documentPath));
  assert.ok(!switched.config.includes(example.sync.documentPath));

  const configured = structuredClone(example);
  configured.sync.firebaseConfig = {
    apiKey: "PUBLIC_WEB_CONFIG_TEST_VALUE",
    authDomain: "sample-preview.firebaseapp.com",
    projectId: "sample-preview",
    storageBucket: "sample-preview.firebasestorage.app",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:test"
  };
  const firebaseBuild = generate(configured, "firebase-config");
  assert.notEqual(firebaseBuild.buildId, baseline.buildId, "Firebase config changes must invalidate cached assets");
  configured.sync.firebaseConfig.projectId = "other-sample-preview";
  assert.notEqual(generate(configured, "firebase-project-change").buildId, firebaseBuild.buildId);

  const fresh = structuredClone(example);
  delete fresh.sync.documentPath;
  const firstFresh = generate(fresh, "fresh-one");
  const secondFresh = generate(fresh, "fresh-two");
  assert.notEqual(firstFresh.input.sync.documentPath, secondFresh.input.sync.documentPath, "new boards need independent IDs");
  assert.notEqual(firstFresh.buildId, secondFresh.buildId, "distinct generated boards must not share a cache version");
  const regenerated = generate(firstFresh.input, "regenerated");
  assert.equal(regenerated.input.sync.documentPath, firstFresh.input.sync.documentPath, "a build record preserves its shared board");
  assert.equal(regenerated.buildId, firstFresh.buildId, "regenerating the same normalized input must be stable");

  const iconInput = structuredClone(example);
  iconInput.app.icons = { svg: "custom-icon.svg" };
  fs.writeFileSync(path.join(temporary, "custom-icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
  const iconOne = generate(iconInput, "icon-one");
  fs.writeFileSync(path.join(temporary, "custom-icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><circle r="20"/></svg>');
  const iconTwo = generate(iconInput, "icon-two");
  assert.notEqual(iconOne.buildId, iconTwo.buildId, "changing icon bytes at the same path must invalidate the icon cache");
  assert.equal(iconTwo.input.app.icons.svg, "public/icons/icon.svg", "build records must reference their own bundled icons");
  assert.equal(iconInput.app.icons.svg, "custom-icon.svg", "generation must not mutate the authoring input");
  const iconRebuildPath = path.join(temporary, "icon-rebuild");
  const iconRebuild = spawnSync(process.execPath, [
    path.join(scripts, "init-trip.mjs"), path.join(iconTwo.output, "trip-input.json"), iconRebuildPath, "--allow-example"
  ], { encoding: "utf8" });
  assert.equal(iconRebuild.status, 0, iconRebuild.stderr || iconRebuild.stdout);
  const rebuiltIconInput = JSON.parse(fs.readFileSync(path.join(iconRebuildPath, "trip-input.json"), "utf8"));
  assert.equal(rebuiltIconInput.sync.documentPath, iconTwo.input.sync.documentPath);
  assert.deepEqual(fs.readFileSync(path.join(iconRebuildPath, "public/icons/icon.svg")), fs.readFileSync(path.join(iconTwo.output, "public/icons/icon.svg")));
  const rebuiltIndex = fs.readFileSync(path.join(iconRebuildPath, "public/index.html"), "utf8");
  assert.ok(rebuiltIndex.includes(`"buildId": "${iconTwo.buildId}"`), "icon-based rebuild should preserve the effective build version");

  const mapless = structuredClone(example);
  const plan = mapless.trip.days[0].plans[0];
  delete plan.googleMapsUrl;
  plan.lat = 1;
  plan.lng = 2;
  plan.address = "Unwanted stale location";
  const maplessBuild = generate(mapless, "mapless");
  const generatedPlan = maplessBuild.trip.days[0].slots[0];
  for (const key of ["googleMapsUrl", "lat", "lng", "address"]) {
    assert.equal(Object.hasOwn(generatedPlan, key), false, `locationless plans must not inherit ${key}`);
  }

  const unsafeConfig = structuredClone(configured);
  unsafeConfig.sync.firebaseConfig.private_key = "not-a-real-key";
  assert.ok(validateTrip(unsafeConfig, { allowExample: true }).errors.some((message) => message.includes("private_key")), "private config fields must be rejected");
  console.log("Generator isolation and cache invalidation tests passed.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
