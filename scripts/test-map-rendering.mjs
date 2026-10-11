#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const publicRoot = process.argv[2]
  ? pathToFileURL(`${resolve(process.argv[2], "public")}/`)
  : new URL("../assets/app-template/public/", import.meta.url);
const html = await readFile(new URL("index.html", publicRoot), "utf8");
const app = await readFile(new URL("app.js", publicRoot), "utf8");
const mapHelpers = html.slice(html.indexOf("    function escapeHTML("), html.indexOf("    function renderChecklistHTML("));
assert.ok(mapHelpers.includes("function initTravelMap("));
const calls = { maps: 0, tiles: 0, fits: [], views: [] };
const zoomButtons = Array.from({ length: 2 }, () => ({ attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }));
const L = {
  map() {
    calls.maps += 1;
    return {
      attributionControl: { setPrefix() {} },
      fitBounds(points, options) { calls.fits.push({ points, options }); },
      setView(center, zoom) { calls.views.push({ center, zoom }); }
    };
  },
  control: { zoom: () => ({ addTo() { return this; }, getContainer: () => ({ querySelectorAll: () => zoomButtons }) }) },
  tileLayer() { calls.tiles += 1; return { addTo() { return this; } }; },
  layerGroup: () => ({ layers: [], clearCount: 0, addTo() { return this; }, clearLayers() { this.layers = []; this.clearCount += 1; } }),
  point: (x, y) => ({ x, y }),
  divIcon: (options) => options,
  marker: (coordinates, options) => ({
    kind: "marker", coordinates, options, handlers: {},
    addTo(group) { group.layers.push(this); return this; },
    bindPopup(content, popupOptions) { this.popup = { content, options: popupOptions }; return this; },
    on(event, handler) { this.handlers[event] = handler; return this; }
  }),
  polyline: (coordinates) => ({ kind: "polyline", coordinates, addTo(group) { group.layers.push(this); return this; } })
};
const context = vm.createContext({ L });
vm.runInContext(mapHelpers, context);
const point = (id, lat, lng) => ({ id, lat, lng, name: `Venue ${id}`, time: "09:00", googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=Venue+${id}` });
const firstPoints = [point("a", 38.70, -9.13), point("b", 38.71, -9.14)];
const map = context.initTravelMap("map", firstPoints, { deferFrame: true });
const firstMarker = map.tripLayers.layers.find((layer) => layer.kind === "marker");
assert.equal(map.tripLayers.layers.filter((layer) => layer.kind === "marker").length, 2);
assert.equal(calls.fits.length + calls.views.length, 0);
let selected = null;
const nextPoint = { ...point("c", 38.72, -9.15), name: "Café <Old Town>", number: 4 };
const reused = context.initTravelMap("map", [nextPoint], {
  existingMap: map, deferFrame: true, googleMapsLabel: "查看地图", zoomInTitle: "放大", zoomOutTitle: "缩小",
  fitBoundsOptions: { paddingTopLeft: [20, 120], paddingBottomRight: [20, 400] },
  onPointClick: (value) => { selected = value; }
});
assert.equal(reused, map);
assert.equal(calls.maps, 1, "Date changes reuse the map");
assert.equal(calls.tiles, 1, "Date changes reuse the tile layer");
assert.equal(map.tripLayers.clearCount, 2);
assert.equal(map.tripLayers.layers.includes(firstMarker), false);
assert.equal(map.tripLayers.layers.length, 1, "Old markers and routes are removed");
const newMarker = map.tripLayers.layers[0];
assert.match(newMarker.popup.content, /4\. Café &lt;Old Town&gt;/);
assert.match(newMarker.popup.content, />查看地图<\/a>/);
assert.equal(newMarker.popup.options.autoPanPaddingBottomRight.y, 400);
assert.equal(zoomButtons[0].attributes["aria-label"], "放大");
assert.equal(zoomButtons[1].title, "缩小");
newMarker.handlers.click();
assert.equal(selected, nextPoint);
context.initTravelMap("map", [nextPoint], { existingMap: map, singlePointZoom: 11 });
assert.equal(calls.views.at(-1).zoom, 11);
context.initTravelMap("map", firstPoints, { existingMap: map });
assert.equal(calls.fits.length, 1);
assert.equal(calls.maps, 1);
assert.equal(calls.tiles, 1);

const framingSource = app.slice(app.indexOf("function frameMapToPoints("), app.indexOf("function focusMapPoint("));
const container = { clientWidth: 600, clientHeight: 600 };
const frames = [];
const framingContext = vm.createContext({
  currentMapPoints: [], displayTrip: { days: [] },
  mapInstance: { stop() {}, setView(center, zoom) { frames.push({ kind: "view", center, zoom }); }, fitBounds(points) { frames.push({ kind: "bounds", points }); } },
  window: { L: { latLngBounds: (points) => points } },
  document: { getElementById: () => container, documentElement: { classList: { contains: () => false } } },
  mapFitBoundsOptions: () => ({}),
  centerMapPointInVisibleArea: (lat, lng, zoom) => frames.push({ kind: "point", lat, lng, zoom })
});
vm.runInContext(framingSource, framingContext);
framingContext.frameMapToPoints([]);
assert.equal(frames.at(-1).kind, "view");
assert.equal(frames.at(-1).zoom, 2, "Entirely unmapped trips get a neutral world view");
framingContext.displayTrip.days = [{ slots: firstPoints }];
framingContext.frameMapToPoints([]);
assert.equal(frames.at(-1).kind, "bounds", "Placeholder days show the route without fake pins");
const frameCount = frames.length;
container.clientWidth = 0;
framingContext.frameMapToPoints(firstPoints);
assert.equal(frames.length, frameCount, "Hidden mobile maps are not reframed");

// Unopened recommendation disclosures must not create card/photo DOM.
let cards = 0;
const node = () => ({ children: [], listeners: {}, append(...children) { this.children.push(...children); }, addEventListener(name, listener) { this.listeners[name] = listener; } });
const guideContext = vm.createContext({
  currentLanguage: "en", getDayGuide: () => ({ restaurants: [{ name: "Dinner" }], extras: [{ name: "Walk" }] }),
  ui: (_, key) => key, element: node, textElement: node,
  renderRecommendationCard: () => { cards += 1; return node(); }
});
vm.runInContext(app.slice(app.indexOf("function renderDayGuide("), app.indexOf("function renderRecommendationCard(")), guideContext);
const guide = guideContext.renderDayGuide({ id: "day-one" });
assert.equal(cards, 0);
guide.open = true;
guide.listeners.toggle();
assert.equal(cards, 2);
guide.listeners.toggle();
assert.equal(cards, 2, "Reopening the disclosure must not duplicate cards");
console.log("Map reuse, marker lifecycle, hidden/empty map, and lazy recommendation tests passed.");
