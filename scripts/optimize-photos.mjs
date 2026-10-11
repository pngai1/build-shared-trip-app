#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const outputArg = process.argv[2];
if (!outputArg) {
  console.error("Usage: node scripts/optimize-photos.mjs GENERATED_APP_DIR");
  process.exit(2);
}
const root = resolve(outputArg);
const publicRoot = resolve(root, "public");
const output = resolve(publicRoot, "photos");
const input = JSON.parse(await readFile(resolve(root, "trip-input.json"), "utf8"));
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require("sharp"); }
catch {
  try {
    if (!process.env.CODEX_NODE_MODULES) throw new Error("unset");
    sharp = require(resolve(process.env.CODEX_NODE_MODULES, "sharp"));
  } catch {
    console.error("Photo optimization needs Sharp. Install sharp in your working tool environment or set CODEX_NODE_MODULES to a node_modules directory containing it.");
    process.exit(2);
  }
}
const { optimizedPhotoUrl } = await import(pathToFileURL(resolve(publicRoot, "photo-assets.js")));
const photos = new Set();
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (value.photo) {
    const url = typeof value.photo === "string" ? value.photo : value.photo.url;
    if (url) photos.add(url);
  }
  Object.values(value).forEach(collect);
}
collect(input.trip);
await mkdir(output, { recursive: true });
const manifest = {};
const images = [];

async function download(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Photo source must use HTTPS without credentials");
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const maxBytes = 4 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel();
    throw new Error("Source exceeds 4 MiB preview input budget");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error("Source exceeds 4 MiB preview input budget");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

for (const source of photos) {
  if (String(source).startsWith("/") && !String(source).startsWith("//")) {
    try {
      const file = resolve(publicRoot, decodeURIComponent(source.slice(1)));
      if (!file.startsWith(`${publicRoot}${sep}`)) throw new Error("Bundled path escapes public directory");
      const info = await stat(file);
      if (!info.isFile()) throw new Error("Bundled photo is not a file");
      images.push({ source, bundled: true, bytes: info.size });
    } catch (error) {
      images.push({ source, unavailable: true, error: String(error.message).slice(0, 200) });
    }
    continue;
  }
  let key;
  try { key = decodeURIComponent(new URL(source).href); }
  catch { images.push({ source, unavailable: true, error: "Invalid photo URL" }); continue; }
  const file = `${createHash("sha256").update(key).digest("hex").slice(0, 16)}.webp`;
  const destination = resolve(output, file);
  const assetUrl = `/photos/${file}`;
  try {
    let metadata;
    try {
      metadata = await sharp(destination).metadata();
      if (metadata.width > 640 || metadata.height > 640) throw new Error("Outdated oversized preview");
    } catch {
      // Bounded upstream thumbnails, never a fallback to huge Wikimedia originals.
      const sourceBytes = await download(optimizedPhotoUrl(source, {}));
      await sharp(sourceBytes).rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 76, effort: 5 }).toFile(destination);
      metadata = await sharp(destination).metadata();
    }
    const info = await stat(destination);
    manifest[key] = assetUrl;
    images.push({ source, file: assetUrl, bytes: info.size, width: metadata.width, height: metadata.height });
  } catch (error) {
    images.push({ source, unavailable: true, error: String(error.message).slice(0, 200) });
    console.warn(`Unavailable preview: ${source} (${error.message})`);
  }
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(resolve(output, "manifest.js"), `// Generated local previews. Original records retain attribution.\nexport const PHOTO_MANIFEST = Object.freeze(${JSON.stringify(sorted, null, 2)});\n`);
const report = { generatedAt: new Date().toISOString(), sourceCount: photos.size, optimized: Object.keys(manifest).length, bundled: images.filter((image) => image.bundled).length, totalBytes: images.reduce((sum, image) => sum + (image.bytes || 0), 0), images };
await writeFile(resolve(output, "optimization-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Optimized ${report.optimized} photos; ${report.bundled} already bundled; ${report.totalBytes} bytes. Original photo credits are unchanged.`);
console.log("Run scripts/bump-cache.mjs and scripts/qa-static.mjs on this output before deployment.");
if (images.some((image) => image.unavailable)) process.exitCode = 1;
