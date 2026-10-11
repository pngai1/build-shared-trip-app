import { isGoogleMapsHost } from "./google-maps-place-url.js?v=v-7cf2776e77f3";

export function normalizeGoogleMapsUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { return ""; }
  if (url.protocol !== "https:" || url.username || url.password
    || !isGoogleMapsHost(url.hostname)) return "";
  if (/^\/maps\/search\/?$/.test(url.pathname)) {
    return url.searchParams.get("api") === "1" && url.searchParams.get("query") ? url.href : "";
  }
  if (url.pathname === "/maps" && (url.searchParams.has("cid") || url.searchParams.has("q"))) return url.href;
  const place = url.pathname.match(/^\/maps\/place\/([^/]+)/);
  if (!place) return "";
  // A copied venue URL includes an identifier; a name and viewport alone can
  // open a blank place card. Resolve those legacy links by their venue name.
  if (/!1s[^!/?#]+/.test(url.pathname) || url.searchParams.has("query_place_id")) return url.href;
  let label;
  try { label = decodeURIComponent(place[1].replace(/\+/g, " ")).trim(); } catch { return ""; }
  return label ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}` : "";
}

export function buildGoogleMapsUrl(location = {}) {
  if (location.mapLocationOmitted) return "";
  const stored = normalizeGoogleMapsUrl(location.googleMapsUrl || location.mapsUrl);
  if (stored) return stored;
  const query = [location.name, location.address]
    .map((value) => String(value || "").trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(", ");

  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}
