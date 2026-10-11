import { PHOTO_MANIFEST } from "./photos/manifest.js?v=__CACHE_VERSION__";

function photoKey(value) {
  try { return decodeURIComponent(new URL(value, import.meta.url).href); }
  catch { return String(value || ""); }
}

// Prefer small local previews. For supported image hosts, request thumbnails
// rather than multi-megabyte originals without changing attribution links.
export function optimizedPhotoUrl(value, manifest = PHOTO_MANIFEST) {
  if (!value) return "";
  // Bundled assets are relative to the app, including a /docs/ demo deployment.
  if (String(value).startsWith("/") && !String(value).startsWith("//")) {
    return new URL(String(value).slice(1), import.meta.url).href;
  }
  const local = manifest[photoKey(value)];
  if (local) return new URL(local.replace(/^\//, ""), import.meta.url).href;
  try {
    const url = new URL(value, import.meta.url);
    if (!["http:", "https:", "file:"].includes(url.protocol)) return "";
    if (url.hostname === "commons.wikimedia.org" && /\/Special:FilePath\//i.test(url.pathname)) {
      url.searchParams.set("width", "500");
      return url.href;
    }
    if (url.hostname === "upload.wikimedia.org") {
      const parts = url.pathname.replace(/\/thumb\//, "/").split("/");
      if (/^\d+px-/.test(parts.at(-1) || "")) parts.pop();
      const filename = parts.at(-1);
      if (parts[2] === "commons" && filename && /\.(?:jpe?g|png|webp)$/i.test(filename)) {
        parts.splice(3, 0, "thumb");
        url.pathname = `${parts.join("/")}/500px-${filename}`;
        return url.href;
      }
    }
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", "640");
      url.searchParams.set("q", "76");
      url.searchParams.set("fit", "max");
      url.searchParams.set("auto", "format");
    }
    return url.href;
  } catch { return ""; }
}
