const seedTrip = readSeedTrip();

function readSeedTrip() {
  try {
    return JSON.parse(document.getElementById("trip-data")?.textContent || "{}");
  } catch {
    return {};
  }
}

function normalizeEntry(entry) {
  if (typeof entry === "string") return { url: entry };
  if (!entry || typeof entry !== "object" || !entry.url) return null;
  return { url: entry.url, labels: entry.labels || null };
}

export function getGooglePlaceLinks(location = {}) {
  const key = String(location.googleMapsKey || location.id || "");
  const raw = seedTrip.googlePlaceLinks?.[key] || [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.map(normalizeEntry).filter(Boolean);
}
