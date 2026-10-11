const NUMBER_PATTERN = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
const DATA_COORDINATES_PATTERN = new RegExp(`!3d(${NUMBER_PATTERN})!4d(${NUMBER_PATTERN})(?=!|/|$)`, "g");
const PLACE_PATH_PATTERN = /^\/maps\/place\/([^/]+)/i;
const MAX_GOOGLE_MAPS_URL_LENGTH = 4096;

export function parseFullGoogleMapsPlaceUrl(input) {
  const value = String(input || "").trim();
  if (!value) return invalid("empty");
  if (value.length > MAX_GOOGLE_MAPS_URL_LENGTH) return invalid("tooLong");

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    return invalid("invalidUrl");
  }

  if (parsedUrl.protocol !== "https:") return invalid("invalidProtocol");
  if (parsedUrl.username || parsedUrl.password) return invalid("invalidCredentials");
  if (!isGoogleMapsHost(parsedUrl.hostname)) return invalid("invalidHost");

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return invalid("invalidEncoding");
  }

  const placeMatch = decodedPath.match(PLACE_PATH_PATTERN);
  if (!placeMatch?.[1]) return invalid("notPlaceUrl");

  const coordinates = extractCoordinates(decodedPath);
  if (!coordinates) return invalid("missingCoordinates");
  if (!validCoordinates(coordinates.lat, coordinates.lng)) return invalid("invalidCoordinates");

  const placeLabel = decodePlaceLabel(parsedUrl.pathname);
  if (!placeLabel) return invalid("missingPlace");
  const [placeName, ...addressParts] = placeLabel.split(",").map((part) => part.trim());
  const address = addressParts.filter(Boolean).join(", ");

  return {
    ok: true,
    url: value,
    lat: coordinates.lat,
    lng: coordinates.lng,
    coordinateSource: coordinates.source,
    placeLabel,
    placeName: placeName || placeLabel,
    address,
    featureId: extractLastFeatureId(decodedPath)
  };
}

function extractCoordinates(decodedPath) {
  const dataMatches = [...decodedPath.matchAll(DATA_COORDINATES_PATTERN)];
  for (let index = dataMatches.length - 1; index >= 0; index -= 1) {
    const lat = Number(dataMatches[index][1]);
    const lng = Number(dataMatches[index][2]);
    if (validCoordinates(lat, lng)) return { lat, lng, source: "place" };
  }

  // @lat,lng is the browser viewport, not necessarily the selected place.
  return null;
}

function decodePlaceLabel(pathname) {
  const rawMatch = pathname.match(PLACE_PATH_PATTERN);
  if (!rawMatch?.[1]) return "";
  try {
    return decodeURIComponent(rawMatch[1].replace(/\+/g, " "))
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function extractLastFeatureId(decodedPath) {
  const matches = [...decodedPath.matchAll(/!1s([^!/?#]+)/g)];
  return matches.at(-1)?.[1] || "";
}

function validCoordinates(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
}

export function isGoogleMapsHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/.test(host);
}

function invalid(reason) {
  return { ok: false, reason };
}
