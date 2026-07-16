export function buildGoogleMapsUrl(location = {}) {
  const query = [location.name, location.address]
    .map((value) => String(value || "").trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(", ");

  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}
