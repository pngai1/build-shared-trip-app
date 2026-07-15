const seedTrip = readSeedTrip();

function readSeedTrip() {
  try {
    return JSON.parse(document.getElementById("trip-data")?.textContent || "{}");
  } catch {
    return {};
  }
}

function localized(value, language) {
  if (Array.isArray(value)) return value.map((item) => localized(item, language));
  if (!value || typeof value !== "object") return value;
  const base = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "i18n")
      .map(([key, child]) => [key, localized(child, language)])
  );
  return value.i18n?.[language]
    ? { ...base, ...localized(value.i18n[language], language) }
    : base;
}

export function getFlightBookings(language = "en") {
  return localized(seedTrip.flightBookings || [], language);
}
