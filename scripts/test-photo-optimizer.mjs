#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require("sharp"); }
catch {
  if (!process.env.CODEX_NODE_MODULES) {
    console.log("Photo optimizer test skipped: optional Sharp dependency not installed.");
    process.exit(0);
  }
  sharp = require(resolve(process.env.CODEX_NODE_MODULES, "sharp"));
}
const root = await mkdtemp(join(tmpdir(), "trip-photo-test-"));
try {
  await writeFile(join(root, "package.json"), JSON.stringify({ private: true, type: "module" }));
  const publicRoot = join(root, "public");
  await mkdir(join(publicRoot, "photos"), { recursive: true });
  await mkdir(join(publicRoot, "icons"));
  await copyFile(new URL("../assets/app-template/public/photo-assets.js", import.meta.url), join(publicRoot, "photo-assets.js"));
  await copyFile(new URL("../assets/app-template/public/photos/manifest.js", import.meta.url), join(publicRoot, "photos/manifest.js"));
  const fixture = await sharp({ create: { width: 1000, height: 800, channels: 3, background: "#17362f" } }).png().toBuffer();
  await writeFile(join(publicRoot, "icons/test.png"), fixture);
  const records = [
    { photo: { url: "https://images.unsplash.com/preview-test", sourceUrl: "https://example.test/source", credit: "Test fixture" } },
    { photo: { url: "/icons/test.png", sourceUrl: "https://example.test/source", credit: "Test fixture" } },
    { photo: { url: "https://images.unsplash.com/oversized-test", sourceUrl: "https://example.test/source", credit: "Test fixture" } }
  ];
  const input = JSON.stringify({ trip: { days: [{ plans: records }] } });
  await writeFile(join(root, "trip-input.json"), input);
  const preload = `globalThis.fetch = async (url) => new Response(Buffer.from(${JSON.stringify(fixture.toString("base64"))}, "base64"), { headers: { "content-length": String(url.includes("oversized") ? 5000000 : ${fixture.length}) } });`;
  const script = fileURLToPath(new URL("./optimize-photos.mjs", import.meta.url));
  const run = (mock) => spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(mock)}`, script, root], { encoding: "utf8", env: process.env });
  const first = run(preload);
  assert.equal(first.status, 1, first.stderr);
  const report = JSON.parse(await readFile(join(publicRoot, "photos/optimization-report.json"), "utf8"));
  assert.equal(report.optimized, 1);
  assert.equal(report.bundled, 1);
  assert.equal(report.images.filter((image) => image.unavailable).length, 1);
  const image = report.images.find((item) => item.file);
  assert.equal(image.width, 640);
  assert.ok(image.height <= 640);
  assert.ok(image.bytes < 200000);
  assert.equal(await readFile(join(root, "trip-input.json"), "utf8"), input, "Photo source and credit records stay intact");
  await writeFile(join(root, "trip-input.json"), JSON.stringify({ trip: { days: [{ plans: records.slice(0, 2) }] } }));
  const rerun = run('globalThis.fetch = async () => { throw new Error("Must reuse preview"); };');
  assert.equal(rerun.status, 0, `${rerun.stdout}\n${rerun.stderr}`);
  console.log("Photo optimizer resizing, byte limit, local assets, source preservation, and cache reuse tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
