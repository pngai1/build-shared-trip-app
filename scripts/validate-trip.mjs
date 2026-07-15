#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFullGoogleMapsPlaceUrl } from "../assets/app-template/public/google-maps-place-url.js";

export const REQUIRED_LOCALES = Object.freeze(["en", "zh-Hans", "zh-Hant", "ja"]);
export const TRANSLATED_LOCALES = Object.freeze(REQUIRED_LOCALES.filter((locale) => locale !== "en"));
export const PLAN_TYPES = Object.freeze([
  "flight", "stay", "restaurant", "transport", "car", "sight", "activity", "event", "shopping", "other"
]);

const PERIODS = new Set(["morning", "noon", "evening"]);
const PLAN_TYPE_SET = new Set(PLAN_TYPES);
const FORBIDDEN_KEY = /(?:confirmation(?:number|code)?|booking(?:reference|code)|passport|ticketnumber|cardnumber|securitycode|cvv|privatekey|serviceaccount|clientemail)/i;
const FIREBASE_WEB_CONFIG_KEYS = new Set(["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"]);
const STRUCTURAL_TRANSLATION_KEYS = new Set([
  "id", "slug", "title", "date", "startDate", "endDate", "timezone", "period", "planType",
  "booked", "lat", "lng", "googleMapsUrl", "mapsUrl", "url", "sourceUrl", "participantGroupIds",
  "weatherLocationIds", "sortOrder", "sortTime"
]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateTrip(input, options = {}) {
  const errors = [];
  const warnings = [];
  const allowExample = options.allowExample === true;
  const error = (location, message) => errors.push(`${location}: ${message}`);
  const warn = (location, message) => warnings.push(`${location}: ${message}`);

  if (!isPlainObject(input)) {
    return { errors: ["$: expected a JSON object"], warnings };
  }

  scanSensitiveData(input, "$", error);

  if (input.schemaVersion !== 1) error("schemaVersion", "must be 1");
  if (input.sampleData === true && !allowExample) error("sampleData", "example data is not allowed for a production build");

  const app = objectAt(input, "app", error);
  requireString(app, "name", "app", error, { max: 160 });
  requireString(app, "shortName", "app", error, { max: 30 });
  requireString(app, "metaDescription", "app", error, { max: 300 });
  if (app.name && app.shortName && !app.name.startsWith(app.shortName) && app.shortName.length > app.name.length) {
    warn("app.shortName", "keep the home-screen label short enough for iOS; iOS controls the rendered font size");
  }
  if (app.theme != null) {
    const theme = objectAt(app, "theme", error, "app");
    ["ink", "accent", "background"].forEach((key) => {
      if (theme[key] != null && !HEX_COLOR.test(String(theme[key]))) error(`app.theme.${key}`, "must be a six-digit hex color");
    });
  }

  const sync = input.sync == null ? {} : objectAt(input, "sync", error);
  const documentPath = String(sync.documentPath || "");
  if (documentPath && !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(documentPath)) {
    error("sync.documentPath", "must contain exactly one Firestore collection and document ID");
  }
  if (sync.firebaseConfig != null) {
    const config = objectAt(sync, "firebaseConfig", error, "sync");
    Object.keys(config).forEach((key) => {
      if (!FIREBASE_WEB_CONFIG_KEYS.has(key)) error(`sync.firebaseConfig.${key}`, "is not part of the public Firebase web-client configuration allowlist");
    });
    ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"].forEach((key) => {
      requireString(config, key, "sync.firebaseConfig", error, { max: 300 });
    });
  } else {
    warn("sync.firebaseConfig", "missing; the generated app will run in local-preview mode until Firebase web config is supplied");
  }
  if (sync.firestoreRegion != null && !/^[a-z0-9-]{2,32}$/i.test(String(sync.firestoreRegion))) {
    error("sync.firestoreRegion", "must be a Firebase/Firestore region identifier such as nam5 or asia-northeast1");
  }

  const trip = objectAt(input, "trip", error);
  if (Buffer.byteLength(JSON.stringify(trip), "utf8") > 750_000) {
    error("trip", "serialized trip data must stay below 750 KB so synchronized writes remain safely under Firestore's 1 MiB document limit");
  }
  requireString(trip, "slug", "trip", error, { max: 80 });
  if (trip.slug && !SLUG.test(trip.slug)) error("trip.slug", "must be lowercase words separated by hyphens");
  requireString(trip, "country", "trip", error, { max: 120 });
  requireString(trip, "timezone", "trip", error, { max: 80 });
  validateTimezone(trip.timezone, "trip.timezone", error);
  requireDate(trip.startDate, "trip.startDate", error);
  requireDate(trip.endDate, "trip.endDate", error);
  if (validDate(trip.startDate) && validDate(trip.endDate) && trip.startDate > trip.endDate) {
    error("trip.endDate", "must be on or after startDate");
  }
  requireString(trip, "routeDecoration", "trip", error, { max: 240 });
  validateTranslations({ ...trip, metaDescription: app.metaDescription }, ["country", "routeDecoration", "metaDescription"], "trip", error);
  TRANSLATED_LOCALES.forEach((locale) => {
    if (trip.i18n?.[locale]?.title != null) error(`trip.i18n.${locale}.title`, "the app name is a literal brand and must not be translated");
  });

  const groups = arrayAt(trip, "participantGroups", error, "trip", { optional: true });
  const groupIds = new Set();
  groups.forEach((group, index) => {
    const location = `trip.participantGroups[${index}]`;
    if (!isPlainObject(group)) return error(location, "must be an object");
    requireString(group, "id", location, error, { max: 80 });
    if (group.id && !ID.test(group.id)) error(`${location}.id`, "must use letters, numbers, underscores, or hyphens");
    if (groupIds.has(group.id)) error(`${location}.id`, "must be unique");
    groupIds.add(group.id);
    const members = arrayAt(group, "members", error, location);
    if (!members.length) error(`${location}.members`, "must contain at least one traveler label");
    members.forEach((member, memberIndex) => {
      if (!nonEmptyString(member)) error(`${location}.members[${memberIndex}]`, "must be a non-empty string");
    });
  });

  const reminders = arrayAt(trip, "reminders", error, "trip", { optional: true });
  reminders.forEach((reminder, index) => {
    const location = `trip.reminders[${index}]`;
    if (!isPlainObject(reminder)) return error(location, "must be an object");
    requireString(reminder, "id", location, error, { max: 80 });
    requireString(reminder, "item", location, error, { max: 200 });
    if (reminder.dueDate != null) requireDate(reminder.dueDate, `${location}.dueDate`, error);
    if (typeof reminder.done !== "boolean") error(`${location}.done`, "must be true or false");
    validateTranslations(reminder, ["item"], location, error);
  });

  const weatherLocations = validateWeather(trip.weather, error);
  const days = arrayAt(trip, "days", error, "trip");
  if (!days.length) error("trip.days", "must contain at least one day");
  if (days.length > 31) error("trip.days", "supports at most 31 days");
  const dayIds = new Set();
  const dayDates = new Set();
  let priorDate = "";
  days.forEach((day, dayIndex) => {
    const location = `trip.days[${dayIndex}]`;
    if (!isPlainObject(day)) return error(location, "must be an object");
    requireString(day, "id", location, error, { max: 80 });
    if (day.id && !ID.test(day.id)) error(`${location}.id`, "must use letters, numbers, underscores, or hyphens");
    if (dayIds.has(day.id)) error(`${location}.id`, "must be unique");
    dayIds.add(day.id);
    requireDate(day.date, `${location}.date`, error);
    if (dayDates.has(day.date)) error(`${location}.date`, "must be unique");
    dayDates.add(day.date);
    if (priorDate && day.date < priorDate) error(`${location}.date`, "days must be sorted chronologically");
    priorDate = day.date;
    if (validDate(trip.startDate) && validDate(day.date) && (day.date < trip.startDate || day.date > trip.endDate)) {
      error(`${location}.date`, "must fall inside the trip date range");
    }
    requireString(day, "area", location, error, { max: 180 });
    requireString(day, "theme", location, error, { max: 180 });
    requireString(day, "summary", location, error, { max: 800 });
    validateTranslations(day, ["area", "theme", "summary"], location, error);

    const dayWeatherIds = Array.isArray(day.weatherLocationIds) ? day.weatherLocationIds : [];
    if (weatherLocations.size && !dayWeatherIds.length) error(`${location}.weatherLocationIds`, "must include at least one weather location ID");
    dayWeatherIds.forEach((id, idIndex) => {
      if (!weatherLocations.has(id)) error(`${location}.weatherLocationIds[${idIndex}]`, `unknown location ID ${JSON.stringify(id)}`);
    });

    const plans = day.plans ?? day.slots;
    if (!Array.isArray(plans)) {
      error(`${location}.plans`, "must be an array");
    } else {
      const planIds = new Set();
      plans.forEach((plan, planIndex) => validatePlan(plan, `${location}.plans[${planIndex}]`, {
        error, warn, groupIds, groupCount: groups.length, planIds, allowExample
      }));
    }

    validateRecommendations(day.recommendations, `${location}.recommendations`, {
      error, warn, allowExample, plans: Array.isArray(plans) ? plans : []
    });
  });

  validateResources(trip.resources, error, allowExample);
  return { errors, warnings };
}

function validatePlan(plan, location, context) {
  const { error, warn, groupIds, groupCount, planIds, allowExample } = context;
  if (!isPlainObject(plan)) return error(location, "must be an object");
  requireString(plan, "id", location, error, { max: 80 });
  if (plan.id && !ID.test(plan.id)) error(`${location}.id`, "must use letters, numbers, underscores, or hyphens");
  if (planIds.has(plan.id)) error(`${location}.id`, "must be unique within its day");
  planIds.add(plan.id);
  requireString(plan, "name", location, error, { max: 240 });
  requireString(plan, "period", location, error, { max: 20 });
  if (plan.period && !PERIODS.has(plan.period)) error(`${location}.period`, "must be morning, noon, or evening");
  requireString(plan, "planType", location, error, { max: 40 });
  if (plan.planType && !PLAN_TYPE_SET.has(plan.planType)) error(`${location}.planType`, `must be one of ${PLAN_TYPES.join(", ")}`);
  if (typeof plan.booked !== "boolean") error(`${location}.booked`, "must be true or false");
  if (plan.time != null && (typeof plan.time !== "string" || plan.time.length > 120)) error(`${location}.time`, "must be a string no longer than 120 characters");
  requireString(plan, "googleMapsUrl", location, error, { max: 4096 });
  const parsed = parseFullGoogleMapsPlaceUrl(plan.googleMapsUrl);
  if (!parsed.ok) error(`${location}.googleMapsUrl`, `must be a full Google Maps /maps/place/ URL with coordinates (${parsed.reason})`);
  if (parsed.ok && parsed.coordinateSource !== "place") error(`${location}.googleMapsUrl`, "must include the POI's !3d latitude and !4d longitude, not only the map viewport center");
  if (parsed.ok && Number.isFinite(plan.lat) && Math.abs(plan.lat - parsed.lat) > 0.0001) error(`${location}.lat`, "does not match the Google Maps place URL");
  if (parsed.ok && Number.isFinite(plan.lng) && Math.abs(plan.lng - parsed.lng) > 0.0001) error(`${location}.lng`, "does not match the Google Maps place URL");
  validatePhoto(plan.photo, `${location}.photo`, error, allowExample);
  validateTranslations(plan, ["name", "review", "notes"].filter((key) => nonEmptyString(plan[key])), location, error);
  if (plan.participantGroupIds != null && !Array.isArray(plan.participantGroupIds)) {
    error(`${location}.participantGroupIds`, "must be an array");
  } else if (Array.isArray(plan.participantGroupIds)) {
    const unique = new Set();
    plan.participantGroupIds.forEach((id, index) => {
      if (!groupIds.has(id)) error(`${location}.participantGroupIds[${index}]`, `unknown group ID ${JSON.stringify(id)}`);
      if (unique.has(id)) error(`${location}.participantGroupIds[${index}]`, "must not repeat a group");
      unique.add(id);
    });
    if (groupCount && unique.size >= groupCount) warn(`${location}.participantGroupIds`, "omit the participant tag when everyone is included");
  }
}

function validateRecommendations(recommendations, location, context) {
  const { error, warn, allowExample, plans } = context;
  if (!isPlainObject(recommendations)) return error(location, "must be an object with eat, seeGo, and buy arrays");
  const planNames = new Set(plans.map((plan) => normalizedName(plan?.name)).filter(Boolean));
  const recommendationNames = new Set();
  for (const key of ["eat", "seeGo", "buy"]) {
    const items = arrayAt(recommendations, key, error, location);
    const minimum = allowExample ? 1 : 5;
    if (items.length < minimum) error(`${location}.${key}`, `must contain at least ${minimum} recommendation${minimum === 1 ? "" : "s"}`);
    items.forEach((item, index) => {
      const itemLocation = `${location}.${key}[${index}]`;
      if (!isPlainObject(item)) return error(itemLocation, "must be an object");
      requireString(item, "name", itemLocation, error, { max: 240 });
      requireString(item, "description", itemLocation, error, { max: 800 });
      requireString(item, "mapsUrl", itemLocation, error, { max: 4096 });
      const parsed = parseFullGoogleMapsPlaceUrl(item.mapsUrl);
      if (!parsed.ok) error(`${itemLocation}.mapsUrl`, `must be a full Google Maps place URL with coordinates (${parsed.reason})`);
      if (parsed.ok && parsed.coordinateSource !== "place") error(`${itemLocation}.mapsUrl`, "must include the POI's !3d latitude and !4d longitude");
      validatePhoto(item.photo, `${itemLocation}.photo`, error, allowExample);
      validateTranslations(item, ["name", "description", "categoryLabel"].filter((field) => nonEmptyString(item[field])), itemLocation, error);
      const normalized = normalizedName(item.name);
      if (planNames.has(normalized)) error(`${itemLocation}.name`, "duplicates a place already in the itinerary");
      if (recommendationNames.has(normalized)) error(`${itemLocation}.name`, "duplicates another recommendation for this day");
      recommendationNames.add(normalized);
      validateRatings(item, itemLocation, error, warn);
    });
  }
}

function validateRatings(item, location, error, warn) {
  const hasRating = item.googleRating != null || item.tabelogRating != null;
  if (!hasRating) return;
  if (item.googleRating != null && !ratingValue(item.googleRating)) error(`${location}.googleRating`, "must be between 0 and 5");
  if (item.tabelogRating != null && !ratingValue(item.tabelogRating)) error(`${location}.tabelogRating`, "must be between 0 and 5");
  if (item.tabelogRating != null && !httpsUrl(item.tabelogUrl)) error(`${location}.tabelogUrl`, "is required when a Tabelog rating is shown");
  requireDate(item.ratingCheckedAt, `${location}.ratingCheckedAt`, error);
}

function validatePhoto(photo, location, error, allowExample = false) {
  if (!isPlainObject(photo)) return error(location, "must be an object with url, sourceUrl, and credit");
  requireString(photo, "url", location, error, { max: 2048 });
  if (photo.url && !(httpsUrl(photo.url) || String(photo.url).startsWith("/"))) error(`${location}.url`, "must be an HTTPS URL or a root-relative bundled asset");
  requireString(photo, "sourceUrl", location, error, { max: 2048 });
  if (photo.sourceUrl && !httpsUrl(photo.sourceUrl)) error(`${location}.sourceUrl`, "must be an HTTPS attribution/source URL");
  requireString(photo, "credit", location, error, { max: 300 });
  if (!allowExample && (photo.url === "/icons/icon-512.png" || isExampleUrl(photo.url) || isExampleUrl(photo.sourceUrl))) {
    error(location, "must use a real representative photo and attribution source, not an example or app-icon placeholder");
  }
}

function validateWeather(weather, error) {
  if (!isPlainObject(weather)) {
    error("trip.weather", "must be an object");
    return new Set();
  }
  const locations = arrayAt(weather, "locations", error, "trip.weather");
  const ids = new Set();
  locations.forEach((location, index) => {
    const where = `trip.weather.locations[${index}]`;
    if (!isPlainObject(location)) return error(where, "must be an object");
    requireString(location, "id", where, error, { max: 80 });
    requireString(location, "name", where, error, { max: 160 });
    if (ids.has(location.id)) error(`${where}.id`, "must be unique");
    ids.add(location.id);
    if (!coordinate(location.lat, -90, 90)) error(`${where}.lat`, "must be a latitude between -90 and 90");
    if (!coordinate(location.lng, -180, 180)) error(`${where}.lng`, "must be a longitude between -180 and 180");
    validateTranslations(location, ["name"], where, error);
  });
  return ids;
}

function validateResources(resources, error, allowExample = false) {
  if (!isPlainObject(resources)) return error("trip.resources", "must contain payment and app content for all four languages");
  REQUIRED_LOCALES.forEach((locale) => {
    const location = `trip.resources.${locale}`;
    const value = resources[locale];
    if (!isPlainObject(value)) return error(location, "is required");
    const payment = objectAt(value, "payment", error, location);
    requireString(payment, "summary", `${location}.payment`, error, { max: 1200 });
    const facilities = arrayAt(payment, "facilities", error, `${location}.payment`);
    facilities.forEach((facility, index) => {
      const where = `${location}.payment.facilities[${index}]`;
      if (!isPlainObject(facility)) return error(where, "must be an object");
      ["icon", "title", "summary", "details"].forEach((key) => requireString(facility, key, where, error, { max: key === "details" ? 1200 : 240 }));
      const sources = arrayAt(facility, "sources", error, where, { optional: true });
      sources.forEach((source, sourceIndex) => {
        const sourceLocation = `${where}.sources[${sourceIndex}]`;
        if (!isPlainObject(source)) return error(sourceLocation, "must be an object");
        requireString(source, "label", sourceLocation, error, { max: 160 });
        requireString(source, "url", sourceLocation, error, { max: 2048 });
        if (source.url && !httpsUrl(source.url)) error(`${sourceLocation}.url`, "must be HTTPS");
        if (!allowExample && isExampleUrl(source.url)) error(`${sourceLocation}.url`, "must link to a real official source");
      });
    });
    const apps = objectAt(value, "apps", error, location);
    requireString(apps, "summary", `${location}.apps`, error, { max: 800 });
    requireString(apps, "walletNote", `${location}.apps`, error, { max: 800 });
    const items = arrayAt(apps, "items", error, `${location}.apps`);
    items.forEach((app, index) => {
      const where = `${location}.apps.items[${index}]`;
      if (!isPlainObject(app)) return error(where, "must be an object");
      ["icon", "category", "name", "description", "url"].forEach((key) => requireString(app, key, where, error, { max: key === "description" ? 800 : 240 }));
      if (app.url && !/^https:\/\/apps\.apple\.com\//i.test(app.url)) error(`${where}.url`, "must be a direct Apple App Store URL");
    });
  });
}

function validateTranslations(value, fields, location, error) {
  if (!fields.length) return;
  if (!isPlainObject(value.i18n)) return error(`${location}.i18n`, `must translate ${fields.join(", ")} into zh-Hans, zh-Hant, and ja`);
  TRANSLATED_LOCALES.forEach((locale) => {
    const patch = value.i18n[locale];
    if (!isPlainObject(patch)) return error(`${location}.i18n.${locale}`, "is required");
    Object.keys(patch).forEach((key) => {
      if (STRUCTURAL_TRANSLATION_KEYS.has(key)) error(`${location}.i18n.${locale}.${key}`, "structural values and URLs must not be localized");
    });
    fields.forEach((field) => {
      if (!nonEmptyString(patch[field])) error(`${location}.i18n.${locale}.${field}`, "is required");
    });
  });
}

function scanSensitiveData(value, location, error) {
  if (Array.isArray(value)) return value.forEach((item, index) => scanSensitiveData(item, `${location}[${index}]`, error));
  if (typeof value === "string") {
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|@[^\s]+\.iam\.gserviceaccount\.com/i.test(value)) {
      error(location, "contains service-account or private-key material that must never be shipped to a browser");
    }
    if (/\b(?:confirmation|reservation|booking|passport|ticket|card)\s+(?:number|reference|code)\b/i.test(value)) {
      error(location, "appears to mention a private booking, identity, or payment reference; redact the value and keep only traveler-useful public details");
    }
    return;
  }
  if (!isPlainObject(value)) return;
  Object.entries(value).forEach(([key, child]) => {
    const next = `${location}.${key}`;
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
    if (FORBIDDEN_KEY.test(normalizedKey)) error(next, "do not put booking codes, identity documents, payment-card data, service accounts, or private keys in the app");
    scanSensitiveData(child, next, error);
  });
}

function objectAt(parent, key, error, parentLocation = "$") {
  const value = parent?.[key];
  if (!isPlainObject(value)) {
    error(`${parentLocation === "$" ? "" : `${parentLocation}.`}${key}`, "must be an object");
    return {};
  }
  return value;
}

function arrayAt(parent, key, error, parentLocation = "$", { optional = false } = {}) {
  const location = `${parentLocation === "$" ? "" : `${parentLocation}.`}${key}`;
  const value = parent?.[key];
  if (optional && value == null) return [];
  if (!Array.isArray(value)) {
    error(location, "must be an array");
    return [];
  }
  return value;
}

function requireString(parent, key, location, error, { max = 1000 } = {}) {
  const value = parent?.[key];
  if (!nonEmptyString(value)) return error(`${location}.${key}`, "must be a non-empty string");
  if (value.length > max) error(`${location}.${key}`, `must be no longer than ${max} characters`);
}

function requireDate(value, location, error) {
  if (!validDate(value)) error(location, "must be a real date in YYYY-MM-DD format");
}

function validDate(value) {
  if (!DATE.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateTimezone(value, location, error) {
  if (!nonEmptyString(value)) return;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    error(location, "must be a valid IANA time zone such as Asia/Tokyo");
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function httpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isExampleUrl(value) {
  try {
    const hostname = new URL(value, "https://invalid.local").hostname.toLowerCase();
    return hostname === "example.com" || hostname.endsWith(".example.com");
  } catch {
    return false;
  }
}

function coordinate(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function ratingValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 5;
}

function normalizedName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

async function main() {
  const [, , file, ...flags] = process.argv;
  if (!file) {
    console.error("Usage: node scripts/validate-trip.mjs INPUT_JSON [--allow-example]");
    process.exitCode = 2;
    return;
  }
  const absolute = path.resolve(file);
  let input;
  try {
    input = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    console.error(`Could not read ${absolute}: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const result = validateTrip(input, { allowExample: flags.includes("--allow-example") });
  result.warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
  if (result.errors.length) {
    result.errors.forEach((message) => console.error(`ERROR ${message}`));
    console.error(`Validation failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${absolute}${result.warnings.length ? ` with ${result.warnings.length} warning(s)` : ""}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
