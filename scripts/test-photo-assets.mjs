#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const publicRoot = process.argv[2]
  ? pathToFileURL(`${resolve(process.argv[2], "public")}/`)
  : new URL("../assets/app-template/public/", import.meta.url);
const { optimizedPhotoUrl } = await import(new URL("photo-assets.js", publicRoot));
const original = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg";
assert.equal(optimizedPhotoUrl(original, {}), "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/500px-Example.jpg");
assert.equal(optimizedPhotoUrl("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/2048px-Example.jpg", {}), optimizedPhotoUrl(original, {}));
assert.equal(new URL(optimizedPhotoUrl("https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg", {})).searchParams.get("width"), "500");
assert.equal(new URL(optimizedPhotoUrl("https://images.unsplash.com/photo-demo?w=3000", {})).searchParams.get("w"), "640");
const realPublicRoot = pathToFileURL(`${realpathSync(fileURLToPath(publicRoot))}/`);
assert.equal(optimizedPhotoUrl("/icons/icon-512.png", {}), new URL("icons/icon-512.png", realPublicRoot).href);
assert.equal(optimizedPhotoUrl(original, { [original]: "/photos/abc123.webp" }), new URL("photos/abc123.webp", realPublicRoot).href);
assert.equal(optimizedPhotoUrl("https://example.test/photo.jpg", {}), "https://example.test/photo.jpg");
assert.equal(optimizedPhotoUrl("javascript:alert(1)", {}), "");
assert.equal(optimizedPhotoUrl("", {}), "");
console.log("Bounded photo URL and local-preview mapping tests passed.");
