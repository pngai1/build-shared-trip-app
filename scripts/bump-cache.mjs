#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [, , outputArg] = process.argv;
if (!outputArg) {
  console.error("Usage: node scripts/bump-cache.mjs GENERATED_APP_DIR");
  process.exit(2);
}

const root = path.resolve(outputArg);
const publicDirectory = path.join(root, "public");
const serviceWorkerPath = path.join(publicDirectory, "service-worker.js");
const files = walkFiles(publicDirectory).filter((file) => !file.endsWith("service-worker.js"));
const digest = crypto.createHash("sha256");
files.sort().forEach((file) => digest.update(path.relative(publicDirectory, file)).update(fs.readFileSync(file)));
const nextVersion = `v-${digest.digest("hex").slice(0, 12)}`;
const versionPattern = /v-[a-f0-9]{12}/g;

for (const file of walkFiles(root)) {
  if (!new Set([".js", ".html", ".webmanifest"]).has(path.extname(file))) continue;
  const content = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, content.replace(versionPattern, nextVersion));
}

if (!fs.existsSync(serviceWorkerPath)) throw new Error(`Missing ${serviceWorkerPath}`);
console.log(`Cache version is ${nextVersion}.`);

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}
