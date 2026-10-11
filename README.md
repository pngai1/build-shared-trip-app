# Build Shared Trip App

Turn an itinerary, booking notes, and optional Google Maps place links into a polished, synchronized, multilingual travel PWA.

The root README is for people browsing the repository. AI agents should follow [`SKILL.md`](SKILL.md).

## Desktop and iPhone interface

The same responsive application uses a spacious map-and-timeline layout on desktop and a map behind a swipeable itinerary sheet on phones. These screenshots show the current **Winter, from the Alps to Paris** implementation; its private itinerary data and backend configuration are not included in the template.

![Desktop itinerary with a large sticky map](showcase/desktop-itinerary.jpg)

<p>
  <img src="showcase/phone-itinerary.jpg" width="260" alt="Phone-width itinerary over the map">
  <img src="showcase/phone-map-expanded.jpg" width="260" alt="Swipe the sheet down to reveal more of the map">
</p>

The phone images are **390 × 844 browser viewport previews**, not screenshots from a physical iPhone. They demonstrate the iOS-oriented layout and swipe interaction; installation and operating-system safe areas still require a real-device check. [See the full showcase and verification notes](showcase/README.md).

The latest template includes:

- A compact, full-width checklist above the all-date weather slider—aligned edges without an empty stretched card.
- A tighter header and the plan-change timestamp in the footer.
- A larger desktop map while retaining the phone's swipe-only bottom sheet.
- Reused map layers, lazy recommendations, bounded photo previews, and cache-first versioned assets.
- Recovery for legacy malformed Maps links, without fabricating venue identifiers.

## Example

[`docs/`](docs/) contains **Tide Lines**, a fictional two-day coastal trip generated from [`assets/trip.example.json`](assets/trip.example.json). It demonstrates the real interface without exposing travelers, reservations, credentials, or private links.

Preview it locally:

```bash
python3 -m http.server 4173 --directory docs
```

Then open [http://localhost:4173](http://localhost:4173). The checked-in demo uses local-preview storage rather than a Firebase backend, so it does not claim live multi-device synchronization.

The `docs/` output uses relative paths so it can be served below a repository path as well as at the site root. Publishing GitHub Pages is intentionally left off because Pages visibility is separate from this private repository's visibility.

Regenerate the checked-in demo after template or example-data changes:

```bash
node scripts/build-docs-demo.mjs
```

## What it builds

- A responsive itinerary with a large desktop map and a swipe-only mobile bottom sheet
- Flights, stays, restaurants, transport, and POIs in one chronological timeline
- English, Simplified Chinese, Traditional Chinese, and Japanese UI and trip content
- Date-flexible checklist with due items surfaced in each itinerary day
- Compact all-date weather slider with icon-opened hourly detail dialogs
- Exact Google Maps place links when supplied, plus timeline-only placeholder plans
- Nearby eat, see/go, and buy ideas for every day
- Firebase anonymous synchronization without an account screen
- Installable PWA shell with offline itinerary support

## Try the generator

Requirements: Node.js 18 or newer. Generation and validation use built-in Node modules. The optional local-photo optimizer also needs Sharp.

```bash
node scripts/validate-trip.mjs assets/trip.example.json --allow-example
node scripts/init-trip.mjs assets/trip.example.json /tmp/tide-lines-demo --allow-example
node scripts/qa-static.mjs /tmp/tide-lines-demo
python3 -m http.server 4173 --directory /tmp/tide-lines-demo/public
```

Open [http://localhost:4173](http://localhost:4173) to explore the generated app.

## Build a real trip

1. Copy [`assets/trip.example.json`](assets/trip.example.json) to a separate working file.
2. Replace every sample field with verified trip data and remove `sampleData`.
3. Follow [`references/input-schema.md`](references/input-schema.md) for the input contract.
4. Validate, generate, and run static QA:

```bash
node scripts/validate-trip.mjs /absolute/path/to/trip.json
node scripts/init-trip.mjs /absolute/path/to/trip.json /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
```

For synchronized editing and hosting, follow [`references/firebase-deployment.md`](references/firebase-deployment.md). Use a new Firestore document for every trip and never put reservation codes, identity documents, payment data, service-account credentials, or private Drive links into the public app.

For a photo-heavy trip, generate small local previews before deployment:

```bash
# Sharp must be available in the tool environment; alternatively set CODEX_NODE_MODULES.
node scripts/optimize-photos.mjs /absolute/path/to/output
node scripts/bump-cache.mjs /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
```

Review `public/photos/optimization-report.json` for failures and size totals. The optimizer retains the original source and credit records; it does not grant image reuse rights. Without local previews, the app requests bounded thumbnails from supported image hosts.

## Use it as an agent skill

Clone or copy the repository as one skill directory, then invoke `$build-shared-trip-app` with an itinerary, trip documents, or destination and dates. The trigger metadata is in [`SKILL.md`](SKILL.md), with Codex UI metadata in [`agents/openai.yaml`](agents/openai.yaml).

An example request:

> Use build-shared-trip-app with the attached itinerary. Preserve this framework's desktop and mobile interactions, adapt the colors and icon to our trip theme, and prepare English, Simplified Chinese, Traditional Chinese, and Japanese. Keep uncertain bookings marked as pending. Show me desktop and phone-width previews before deploying.

The core instructions, JSON schema, and Node scripts are also usable by Claude: ask it to read `SKILL.md` first and follow the linked references. No Codex-specific runtime is required by the generated app.

## Verify a framework update

```bash
node scripts/validate-trip.mjs assets/trip.example.json --allow-example
node scripts/init-trip.mjs assets/trip.example.json /tmp/shared-trip-check --allow-example
node scripts/qa-static.mjs /tmp/shared-trip-check
node scripts/audit-privacy.mjs .
node scripts/build-docs-demo.mjs
```

Use a fresh output directory, then follow the [responsive and performance checklist](references/responsive-performance.md). The generated sample is deliberately small and fictional; live Firebase synchronization, installation, and real-device iOS behavior are separate checks, not implied by static tests.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`SKILL.md`](SKILL.md) | Agent workflow and quality rules |
| [`assets/app-template/`](assets/app-template/) | Reusable Firebase/PWA application template |
| [`assets/trip.example.json`](assets/trip.example.json) | Fictional multilingual input example |
| [`scripts/`](scripts/) | Validation, generation, QA, privacy, cache, and parser tools |
| [`references/`](references/) | Input schema, feature contract, research, and deployment guidance |
| [`docs/`](docs/) | Generated fictional example page for local preview or GitHub Pages |
| [`showcase/`](showcase/) | Desktop and phone-width screenshots, with capture context |
