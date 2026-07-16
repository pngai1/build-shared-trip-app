#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateTrip } from "./validate-trip.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const [, , outputArg] = process.argv;
if (!outputArg) {
  console.error("Usage: node scripts/qa-static.mjs GENERATED_APP_DIR");
  process.exit(2);
}

const root = path.resolve(outputArg);
const failures = [];
const fail = (message) => failures.push(message);

if (!fs.existsSync(root)) fail(`missing generated app directory: ${root}`);
const inputPath = path.join(root, "trip-input.json");
if (!fs.existsSync(inputPath)) fail("missing trip-input.json build record");

if (!failures.length) {
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const result = validateTrip(input, { allowExample: input.sampleData === true });
  result.warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
  result.errors.forEach((error) => fail(`trip-input.json: ${error}`));
}

for (const file of walkFiles(root)) {
  if (isText(file)) {
    const content = fs.readFileSync(file, "utf8");
    const unresolved = content.match(/__[A-Z0-9_]+__/g);
    if (unresolved) fail(`${relative(file)} contains unresolved token(s): ${[...new Set(unresolved)].join(", ")}`);
  }
  if (path.extname(file) === ".js") {
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (check.status !== 0) fail(`${relative(file)} failed node --check: ${check.stderr.trim()}`);
  }
}

for (const jsonFile of ["firebase.json", "firestore.indexes.json", "public/manifest.webmanifest", "trip-input.json"]) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, jsonFile), "utf8"));
  } catch (error) {
    fail(`${jsonFile} is not valid JSON: ${error.message}`);
  }
}

for (const htmlFile of ["public/index.html", "public/resources.html"]) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const match = html.match(/<script(?=[^>]*\bid="trip-data")(?=[^>]*\btype="application\/json")[^>]*>\s*([\s\S]*?)\s*<\/script>/);
  if (!match) {
    fail(`${htmlFile} is missing embedded trip JSON`);
    continue;
  }
  try {
    JSON.parse(match[1]);
  } catch (error) {
    fail(`${htmlFile} contains invalid embedded trip JSON: ${error.message}`);
  }
  if (/<\/script/i.test(match[1])) fail(`${htmlFile} embedded JSON can terminate its script element`);
}

const generatedIndex = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const generatedApp = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const generatedStyles = fs.readFileSync(path.join(root, "public/styles.css"), "utf8");
const generatedLocales = [
  "public/i18n.js",
  "public/translations-zh-hans.js",
  "public/translations-zh-hant.js",
  "public/translations-ja.js"
].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
if (!generatedIndex.includes('id="weather-dialog"')) fail("public/index.html is missing the per-date weather details dialog");
if (!generatedApp.includes("renderWeatherPeek(day, locationIds)")) fail("public/app.js is missing the aggregate per-date weather summary");
if (!generatedApp.includes("Math.max(...available.map")) fail("public/app.js does not aggregate the daily maximum high/rain values");
if (!generatedApp.includes("Math.min(...available.map")) fail("public/app.js does not aggregate the daily minimum low value");
if (!generatedApp.includes('element("table", "weather-hours")')) fail("public/app.js weather details are missing a semantic hourly table");
if (!generatedApp.includes('setAttribute("role", "tablist")')) fail("public/app.js weather details are missing per-location tabs");
if (!generatedApp.includes("preserveScroll")) fail("public/app.js weather dialog does not preserve scroll during refreshes");
if (!generatedApp.includes('setAttribute("aria-haspopup", "dialog")')) fail("public/app.js weather details trigger is missing dialog semantics");
if (generatedLocales.includes("tripForecast")) fail("weather locale dictionaries still contain the removed tripForecast phrase");
if (!generatedIndex.includes('class="todo-date-control"')) fail("public/index.html is missing the iOS-safe date control wrapper");
if (!generatedStyles.includes('.todo-date-control input[type="date"]')) fail("public/styles.css is missing native date input containment");
if (!generatedStyles.includes("contain: inline-size")) fail("public/styles.css is missing inline-size containment for iOS date controls");
if (!generatedStyles.includes("-webkit-appearance: none")) fail("public/styles.css is missing the iOS intrinsic date-control reset");
if (!generatedStyles.includes("::-webkit-date-and-time-value")) fail("public/styles.css is missing iOS date value containment");
if (!generatedStyles.includes("align-items: stretch")) fail("public/styles.css does not keep weather date cards equal-height");

const swPath = path.join(root, "public", "service-worker.js");
if (fs.existsSync(swPath)) {
  const serviceWorker = fs.readFileSync(swPath, "utf8");
  const assetPattern = /^\s*"(\/[^"\n]+)"[,)]?\s*$/gm;
  for (const match of serviceWorker.matchAll(assetPattern)) {
    const assetPath = match[1].split("?")[0];
    if (assetPath === "/" || assetPath === "/resources.html") continue;
    if (!fs.existsSync(path.join(root, "public", assetPath.slice(1)))) fail(`service worker references missing asset ${assetPath}`);
  }
}

const parserTest = spawnSync(process.execPath, [path.join(scriptDirectory, "test-google-maps-place-url.mjs")], { encoding: "utf8" });
if (parserTest.status !== 0) fail(`Google Maps parser tests failed: ${(parserTest.stderr || parserTest.stdout).trim()}`);

const generatorSafety = spawnSync(process.execPath, [path.join(scriptDirectory, "test-generator-safety.mjs")], { encoding: "utf8" });
if (generatorSafety.status !== 0) fail(`generator safety tests failed: ${(generatorSafety.stderr || generatorSafety.stdout).trim()}`);

const reminderDates = spawnSync(process.execPath, [path.join(scriptDirectory, "test-reminder-dates.mjs")], { encoding: "utf8" });
if (reminderDates.status !== 0) fail(`reminder date tests failed: ${(reminderDates.stderr || reminderDates.stdout).trim()}`);

const tripContract = spawnSync(process.execPath, [path.join(scriptDirectory, "test-trip-contract.mjs")], { encoding: "utf8" });
if (tripContract.status !== 0) fail(`trip contract tests failed: ${(tripContract.stderr || tripContract.stdout).trim()}`);

const privacy = spawnSync(process.execPath, [path.join(scriptDirectory, "audit-privacy.mjs"), root], { encoding: "utf8" });
if (privacy.status !== 0) fail(`privacy audit failed:\n${(privacy.stderr || privacy.stdout).trim()}`);

if (failures.length) {
  failures.forEach((message) => console.error(`ERROR ${message}`));
  console.error(`Static QA failed with ${failures.length} error(s).`);
  process.exitCode = 1;
} else {
  console.log(`Static QA passed for ${root}.`);
}

function relative(file) {
  return path.relative(root, file);
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function isText(file) {
  return new Set([".js", ".json", ".html", ".css", ".rules", ".webmanifest", ".svg", ".md"]).has(path.extname(file));
}
