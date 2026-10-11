# Responsive and performance regression guide

Use this for template changes and final browser QA. Preserve behavior across desktop, mobile browser, and installed iOS PWA; a desktop screenshot alone is not enough.

## Layout invariants

- Home: concise brand header; compact checklist row above the all-date forecast slider; one Itinerary heading; plan-change timestamp in the footer.
- Checklist and weather share the same outer width. Their content heights are independent. Never fix a closed checklist to weather height.
- Desktop: readable timeline beside a large, sticky map, approximately a 52/48 split on wide screens. Map height should respond to available viewport height without putting controls outside it.
- Phone: dedicated map-background planner with dates inside the bottom sheet. Preserve the approved initial map/sheet boundary. The sheet fills the bottom safe area and has no separate empty guard panel.
- Handle: a tap does nothing; a vertical swipe snaps between positions. Timeline scrolling is separate. Retain keyboard resizing and a visible keyboard focus treatment without a touch-only focus border.
- Dialogs: close actions stay below the top safe area; native date inputs stay inside their own grid cell. Test the software keyboard and date picker on a real iPhone before claiming device verification.
- Language switching: stable control widths, readable dates, no horizontal page overflow. Do not translate the brand. Do not use fixed heights to hide translated content.

## Avoid lag

1. Create Leaflet and its tile layer once. Replace only the active day's marker/route layers. Separate content changes from geometry changes; preserve a user's exploration view until a day, marker, or viewport change requires reframing.
2. Skip rendering a hidden/zero-sized map. Invalidate size and fit the visible area after sheet snaps or orientation changes. Empty/locationless days must not show false marker coordinates.
3. Ignore Firestore metadata-only snapshots for content rendering. Status can change without rebuilding cards, resetting open sections, or interrupting scrolling.
4. Render Nearby ideas lazily, only once its disclosure opens. Use native lazy loading and asynchronous image decoding.
5. Small cards need thumbnails, not full-resolution originals. Prefer local URL-hashed WebP previews (around 640 px wide, usually below 150 KB) using `scripts/optimize-photos.mjs GENERATED_APP_DIR`. This optional script needs Sharp and reports failures and total bytes in `public/photos/optimization-report.json`. Keep the original source URL, author, and license for attribution. Bounded remote thumbnails are a fallback, not proof of an asset budget.
6. Cache versioned local modules and local previews first. Avoid a background refetch for every cached asset. Keep navigation refreshable and bump the service-worker version after changing assets. Preview filenames identify their source URL, not their content: when a source image changes, regenerate that preview and bump the cache.
7. Avoid backdrop blur on large sticky regions. Inspect actual request counts and image bytes; don't infer performance solely from a smooth empty demo.

## Google Maps link integrity

The map preview's latitude/longitude is not a Google Maps venue identity. A constructed `/maps/place/Name/@lat,lng` can open a blank information card even when the general area is correct.

- Author new mapped plans from verified full browser place URLs with final POI coordinates, not viewport coordinates. The form intentionally rejects shortened Share links.
- Preserve genuine venue identifiers when present. Never invent `!1s`, CID, or `query_place_id` values.
- For legacy malformed links, runtime normalization may use Google's documented named-search URL. Treat it as a recovery path: verify and replace with the exact venue page when possible; do not describe a search result as an exact-place link.
- Locationless placeholders have neither a fabricated marker nor a Maps action.
- Verify at least one affected venue in the actual Google Maps interface (correct name, address, photos/reviews), not only an HTTP success response.

## Verification and evidence

Run static QA and parser/contract tests, then serve the generated app. Check:

- Desktop around 1280 px and a narrow desktop/tablet breakpoint: homepage alignment, map size, sticky behavior, date changes, plan expansion, all languages.
- Phone widths 390 px and 375 px: homepage, interactive planner, all sheet states, swipe versus tap, date overflow, add/edit form, weather details, footer controls.
- Long trip: every forecast date is reachable horizontally; the selected itinerary date does not filter the weather slider. Unavailable distant forecasts must remain honest, not sample weather presented as live.
- Local preview: verify edits persist locally, but do not call it multi-device sync. Live sync needs two independent authenticated clients and an authorized disposable test entry.
- Capture desktop and phone-width screenshots from the rendered app. Label phone-width desktop-browser captures as responsive previews, not physical-iPhone or installation tests.

Record what actually passed and anything untested. Do not publish a live shared-edit link, private trip input, or Firebase credentials into a public demo by accident. The checked-in demo should remain fictional and backend-free; publishing GitHub Pages is a separate user decision.
