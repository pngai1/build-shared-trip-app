---
name: build-shared-trip-app
description: Build, regenerate, test, and optionally deploy a synchronized multilingual travel PWA from an itinerary, booking summaries, shared documents, place links, or trip notes. Use for shared trip apps, travel-plan visualization, interactive day-by-day maps, Firebase trip boards, mobile itinerary PWAs, or recreating the included map-and-bottom-sheet travel interface for a new destination.
---

# Build Shared Trip App

Turn a trip's source material into the included polished travel PWA: four languages, a day-by-day map, a date-flexible checklist, a compact all-trip weather slider with icon-opened hourly dialogs, expandable bookings and POIs, nearby ideas, optional exact Google Maps place links, credited photos, install support, offline shell, and no-account shared editing.

Treat every new trip as a clean-room build. Never carry itinerary content, travelers, Firebase identifiers, storage keys, or photos from another trip.

## Workflow

1. Inspect all supplied itinerary files, folders, booking summaries, and notes. Extract facts before filling gaps.
2. Read [research-and-content.md](references/research-and-content.md) before browsing or authoring traveler content.
3. Read [input-schema.md](references/input-schema.md), then copy `assets/trip.example.json` to a trip-specific working file outside this skill.
   Use `sampleData: true` and `--allow-example` only for disposable tooling tests. Remove them for any traveler-facing build.
4. Research missing places, current ratings, official payment support, useful local iOS apps, and representative photos. Prefer primary sources for operational facts.
5. Author the complete input JSON. Keep English as the base and add Simplified Chinese, Traditional Chinese, and Japanese patches. Keep the app name literal in every language.
6. Validate before generation:

   ```bash
   node scripts/validate-trip.mjs /absolute/path/to/trip.json
   ```

7. Generate into a new or intentionally replaceable directory:

   ```bash
   node scripts/init-trip.mjs /absolute/path/to/trip.json /absolute/path/to/output
   ```

8. Run static QA:

   ```bash
   node scripts/qa-static.mjs /absolute/path/to/output
   ```

9. Read [feature-contract.md](references/feature-contract.md). Serve the generated `public/` directory locally and verify the desktop and iPhone layouts, all languages, exact map markers, dialogs, weather states, offline shell, and swipe-only itinerary sheet.
10. If Firebase synchronization or deployment is requested, read [firebase-deployment.md](references/firebase-deployment.md). Deploy only to the explicitly chosen Firebase project and only after local QA passes.

## Authoring rules

- Put flights and stays in chronological `plans`; they are itinerary POIs, not a separate booking page.
- When a plan has a meaningful location, derive its address, label, and marker from a full Google Maps browser place URL. A deliberately locationless placeholder may omit the URL and remains timeline-only. Reject Share short links and viewport-only coordinates whenever a URL is supplied.
- Give checklist items an explicit `dueDate` without restricting it to the pre-departure period. Items due on a trip date also appear near the top of that day's itinerary.
- Include a credited representative photo for every itinerary plan and recommendation.
- Supply at least five `eat`, five `seeGo`, and five `buy` ideas per day. Do not repeat places already in that day's plan.
- Record ratings with their provider and `ratingCheckedAt` date. Do not invent ratings.
- Use participant groups. If everyone attends, omit participant groups from that plan so the UI shows no redundant “Everyone” chip.
- Never include reservation codes, confirmation numbers, ticket numbers, passport data, payment-card data, service accounts, private keys, or private document links in the public app.
- Keep user-facing copy traveler-focused. Do not add implementation explanations, account-model prose, citations in content cards, or developer notes to the interface.
- Preserve the default deer branding unless the user supplies replacement icons. Keep `shortName` concise because iOS controls the home-screen label font and truncation.

## Iteration

After changing generated app code, refresh its service-worker version:

```bash
node scripts/bump-cache.mjs /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
```

After changing trip content, update the authoring JSON and regenerate instead of hand-editing embedded seed data. Preserve the existing `sync.documentPath` when rebuilding the same shared trip.

## Delivery

Report:

- generated app path and deployed URL, if any;
- Firebase project and document path used, without presenting them as secrets;
- QA performed and any live services not tested;
- assumptions or traveler facts still awaiting confirmation.

Do not claim synchronization, weather, offline behavior, or install behavior was verified unless it was actually exercised.
