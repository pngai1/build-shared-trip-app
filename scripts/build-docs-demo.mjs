#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const temporaryOutput = fs.mkdtempSync(path.join(os.tmpdir(), "shared-trip-docs-"));
const generatedPublic = path.join(temporaryOutput, "public");
const docsDirectory = path.join(root, "docs");

try {
  const generated = spawnSync(process.execPath, [
    path.join(scriptDirectory, "init-trip.mjs"),
    path.join(root, "assets", "trip.example.json"),
    temporaryOutput,
    "--allow-example"
  ], { encoding: "utf8" });
  if (generated.status !== 0) throw new Error((generated.stderr || generated.stdout).trim());

  fs.cpSync(generatedPublic, docsDirectory, { recursive: true, force: true });
  makeHtmlPathsRelative(path.join(docsDirectory, "index.html"));
  makeHtmlPathsRelative(path.join(docsDirectory, "resources.html"));
  makeServiceWorkerRegistrationRelative(path.join(docsDirectory, "app.js"));
  makeServiceWorkerRegistrationRelative(path.join(docsDirectory, "resources.js"));
  // The worker resolves shell/cache URLs against its own scope. Do not rewrite
  // JavaScript string literals: URL.pathname comparisons must stay absolute.
  makeManifestPathsRelative(path.join(docsDirectory, "manifest.webmanifest"));
  console.log(`Regenerated ${docsDirectory}`);
} finally {
  fs.rmSync(temporaryOutput, { recursive: true, force: true });
}

function makeHtmlPathsRelative(file) {
  const content = fs.readFileSync(file, "utf8")
    .replace(/\b(href|src)="\//g, '$1="./');
  fs.writeFileSync(file, content);
}

function makeServiceWorkerRegistrationRelative(file) {
  const content = fs.readFileSync(file, "utf8")
    .replace('navigator.serviceWorker.register("/service-worker.js")', 'navigator.serviceWorker.register("./service-worker.js")');
  fs.writeFileSync(file, content);
}

function makeManifestPathsRelative(file) {
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.start_url = "./";
  manifest.scope = "./";
  manifest.icons = (manifest.icons || []).map((icon) => ({
    ...icon,
    src: String(icon.src || "").replace(/^\//, "./")
  }));
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}
