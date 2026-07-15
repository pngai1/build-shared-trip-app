#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFullGoogleMapsPlaceUrl } from "../assets/app-template/public/google-maps-place-url.js";
import { validateTrip } from "./validate-trip.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.dirname(scriptDirectory);
const templateDirectory = path.join(skillDirectory, "assets", "app-template");
const TEXT_EXTENSIONS = new Set([".html", ".js", ".json", ".webmanifest", ".rules", ".css", ".svg"]);

function usage() {
  console.error("Usage: node scripts/init-trip.mjs INPUT_JSON OUTPUT_DIR [--force] [--allow-example]");
}

function readInput(inputFile) {
  try {
    return JSON.parse(fs.readFileSync(inputFile, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${inputFile}: ${error.message}`);
  }
}

function copyTemplate(outputDirectory, force) {
  if (fs.existsSync(outputDirectory)) {
    const entries = fs.readdirSync(outputDirectory);
    if (entries.length && !force) {
      throw new Error(`${outputDirectory} is not empty. Choose a new directory or pass --force.`);
    }
    if (force) fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(outputDirectory), { recursive: true });
  fs.cpSync(templateDirectory, outputDirectory, { recursive: true });
}

function normalizeTrip(input) {
  const trip = structuredClone(input.trip);
  trip.title = input.app.name;
  trip.shortName = input.app.shortName;
  trip.metaDescription = input.app.metaDescription;
  trip.theme = { ...(trip.theme || {}), ...(input.app.theme || {}) };
  trip.reminders = Array.isArray(trip.reminders) ? trip.reminders : [];
  trip.participantGroups = Array.isArray(trip.participantGroups) ? trip.participantGroups : [];
  trip.tips = Array.isArray(trip.tips) ? trip.tips : [];
  trip.disclaimer ||= "Check same-day conditions, opening hours, reservations, and transport notices before leaving.";
  trip.days = trip.days.map((day) => {
    const normalizedDay = structuredClone(day);
    const plans = Array.isArray(day.plans) ? day.plans : day.slots;
    normalizedDay.slots = plans.map((plan, index) => normalizePlan(plan, index));
    delete normalizedDay.plans;
    return normalizedDay;
  });
  return trip;
}

function normalizePlan(plan, index) {
  const normalized = structuredClone(plan);
  const parsed = parseFullGoogleMapsPlaceUrl(normalized.googleMapsUrl);
  if (!parsed.ok) throw new Error(`Could not normalize plan ${normalized.id || index}: invalid Google Maps link (${parsed.reason})`);
  Object.assign(normalized, {
    googleMapsUrl: parsed.url,
    googleMapsPlaceName: parsed.placeName,
    googleMapsPlaceLabel: parsed.placeLabel,
    googleMapsFeatureId: parsed.featureId,
    address: normalized.address || parsed.address,
    lat: parsed.lat,
    lng: parsed.lng,
    approximateLocation: false
  });
  normalized.photoSourceId ||= normalized.id;
  return normalized;
}

function generateDocumentPath(input, slug) {
  if (input.sync?.documentPath) return input.sync.documentPath;
  return `trips/${slug}-${crypto.randomBytes(12).toString("hex")}`;
}

function buildHash(trip) {
  const digest = crypto.createHash("sha256").update(JSON.stringify(trip));
  walkFiles(templateDirectory).sort().forEach((file) => {
    digest.update(path.relative(templateDirectory, file));
    digest.update(fs.readFileSync(file));
  });
  return digest.digest("hex").slice(0, 12);
}

function publicFirebaseConfig(config) {
  if (config) return config;
  return {
    apiKey: "REPLACE_FIREBASE_API_KEY",
    authDomain: "REPLACE_FIREBASE_AUTH_DOMAIN",
    projectId: "REPLACE_FIREBASE_PROJECT_ID",
    storageBucket: "REPLACE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "REPLACE_FIREBASE_MESSAGING_SENDER_ID",
    appId: "REPLACE_FIREBASE_APP_ID"
  };
}

export function scriptSafeJson(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function html(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactDateRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate || endDate === startDate) return startDate;
  return `${startDate} – ${endDate}`;
}

function replaceTokens(directory, replacements) {
  for (const file of walkFiles(directory)) {
    if (!TEXT_EXTENSIONS.has(path.extname(file))) continue;
    let content = fs.readFileSync(file, "utf8");
    for (const [token, value] of Object.entries(replacements)) {
      content = content.split(token).join(value);
    }
    fs.writeFileSync(file, content);
  }
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function applyCustomIcons(app, inputDirectory, outputDirectory) {
  if (!app.icons) return;
  const targets = {
    icon192: "icon-192.png",
    icon512: "icon-512.png",
    appleTouch: "apple-touch-icon.png",
    svg: "icon.svg"
  };
  for (const [key, outputName] of Object.entries(targets)) {
    if (!app.icons[key]) continue;
    const source = path.resolve(inputDirectory, app.icons[key]);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Custom icon not found: ${source}`);
    fs.copyFileSync(source, path.join(outputDirectory, "public", "icons", outputName));
  }
}

function writeBuildMetadata(outputDirectory, normalizedInput) {
  fs.writeFileSync(
    path.join(outputDirectory, "trip-input.json"),
    `${JSON.stringify(normalizedInput, null, 2)}\n`
  );
}

function main() {
  const [, , inputArg, outputArg, ...flags] = process.argv;
  if (!inputArg || !outputArg) {
    usage();
    process.exitCode = 2;
    return;
  }
  const inputFile = path.resolve(inputArg);
  const outputDirectory = path.resolve(outputArg);
  const input = readInput(inputFile);
  const allowExample = flags.includes("--allow-example");
  const validation = validateTrip(input, { allowExample });
  validation.warnings.forEach((message) => console.warn(`WARNING ${message}`));
  if (validation.errors.length) {
    validation.errors.forEach((message) => console.error(`ERROR ${message}`));
    throw new Error(`Input validation failed with ${validation.errors.length} error(s).`);
  }

  const trip = normalizeTrip(input);
  const contentHash = buildHash(trip);
  const cacheVersion = `v-${contentHash}`;
  trip.buildId = contentHash;
  const documentPath = generateDocumentPath(input, trip.slug);
  const [collection, documentId] = documentPath.split("/");
  const firestoreRegion = input.sync?.firestoreRegion || "nam5";
  const themeColor = input.app.theme?.ink || trip.theme?.ink || "#17362f";

  copyTemplate(outputDirectory, flags.includes("--force"));
  const normalizedInput = structuredClone(input);
  normalizedInput.sync ||= {};
  normalizedInput.sync.documentPath = documentPath;
  normalizedInput.trip = structuredClone(trip);
  delete normalizedInput.trip.title;
  delete normalizedInput.trip.shortName;
  delete normalizedInput.trip.metaDescription;
  delete normalizedInput.trip.buildId;
  normalizedInput.trip.days = normalizedInput.trip.days.map((day) => {
    const copy = structuredClone(day);
    copy.plans = copy.slots;
    delete copy.slots;
    return copy;
  });

  replaceTokens(outputDirectory, {
    "__APP_NAME_HTML__": html(input.app.name),
    "__APP_SHORT_NAME_HTML__": html(input.app.shortName),
    "__META_DESCRIPTION_HTML__": html(input.app.metaDescription),
    "__RESOURCES_DESCRIPTION_HTML__": html(`Payments and useful local apps for ${input.app.name}.`),
    "__TRIP_DATE_LINE_HTML__": html(`${trip.country} · ${compactDateRange(trip.startDate, trip.endDate)}`),
    "__ROUTE_DECORATION_HTML__": html(trip.routeDecoration),
    "__APP_NAME_JSON__": JSON.stringify(input.app.name),
    "__APP_SHORT_NAME_JSON__": JSON.stringify(input.app.shortName),
    "__META_DESCRIPTION_JSON__": JSON.stringify(input.app.metaDescription),
    "__THEME_COLOR_JSON__": JSON.stringify(themeColor),
    "__TRIP_DATA_JSON__": scriptSafeJson(trip),
    "__FIREBASE_CONFIG_JSON__": JSON.stringify(publicFirebaseConfig(input.sync?.firebaseConfig), null, 2),
    "__FIRESTORE_DOCUMENT_PATH_JSON__": JSON.stringify(documentPath),
    "__FIRESTORE_COLLECTION__": collection,
    "__FIRESTORE_DOCUMENT_ID__": documentId,
    "__FIRESTORE_REGION_JSON__": JSON.stringify(firestoreRegion),
    "__CACHE_NAME_JSON__": JSON.stringify(`${trip.slug}-${cacheVersion}`),
    "__CACHE_VERSION__": cacheVersion
  });
  applyCustomIcons(input.app, path.dirname(inputFile), outputDirectory);
  writeBuildMetadata(outputDirectory, normalizedInput);
  console.log(`Created ${outputDirectory}`);
  console.log(`Firestore document: ${documentPath}`);
  if (!input.sync?.firebaseConfig) console.log("Firebase is not configured; the app will use local-preview synchronization until web config is supplied.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
