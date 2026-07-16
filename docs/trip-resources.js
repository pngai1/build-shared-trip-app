const seedTrip = readSeedTrip();

const EMPTY_RESOURCES = Object.freeze({
  payment: Object.freeze({ summary: "", facilities: Object.freeze([]) }),
  apps: Object.freeze({ summary: "", walletNote: "", items: Object.freeze([]) })
});

function readSeedTrip() {
  try {
    return JSON.parse(document.getElementById("trip-data")?.textContent || "{}");
  } catch {
    return {};
  }
}

export function getTripResources(language) {
  return seedTrip.resources?.[language] || seedTrip.resources?.en || EMPTY_RESOURCES;
}
