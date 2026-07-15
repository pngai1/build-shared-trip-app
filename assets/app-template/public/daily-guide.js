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
  const patch = value.i18n?.[language];
  if (!patch || typeof patch !== "object") return base;
  return { ...base, ...localized(patch, language) };
}

function dayFor(dayId) {
  return (seedTrip.days || []).find((day) => day.id === dayId);
}

function withCategory(items, category) {
  return (items || []).map((item) => ({
    ...item,
    categories: Array.isArray(item.categories) && item.categories.length ? item.categories : [category]
  }));
}

export function getDayArea(dayId, language = "en") {
  const day = localized(dayFor(dayId) || {}, language);
  return day.area || day.route || day.theme || "";
}

export function getDayGuide(dayId, language = "en") {
  const day = localized(dayFor(dayId) || {}, language);
  const recommendations = day.recommendations || day.guide || {};
  const restaurants = recommendations.restaurants || recommendations.eat || [];
  const extras = [
    ...withCategory(recommendations.seeGo || recommendations.see || [], "see"),
    ...withCategory(recommendations.buy || [], "buy"),
    ...withCategory(recommendations.do || [], "do"),
    ...withCategory(recommendations.snack || [], "snack")
  ];
  return {
    note: recommendations.note || "",
    restaurants,
    extras
  };
}

export function getPlacePhoto(slotId) {
  const slot = (seedTrip.days || [])
    .flatMap((day) => day.slots || day.plans || [])
    .find((candidate) => candidate.id === slotId);
  if (!slot?.photo) return null;
  return typeof slot.photo === "string" ? { url: slot.photo } : slot.photo;
}
