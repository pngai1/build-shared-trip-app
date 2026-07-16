# Build Shared Trip App

Turn an itinerary, booking notes, and optional Google Maps place links into a polished, synchronized, multilingual travel PWA.

The root README is for people browsing the repository. AI agents should follow [`SKILL.md`](SKILL.md).

## Example

[`docs/`](docs/) contains **Tide Lines**, a fictional two-day coastal trip generated from [`assets/trip.example.json`](assets/trip.example.json). It demonstrates the real interface without exposing travelers, reservations, credentials, or private links.

Preview it locally:

```bash
python3 -m http.server 4173 --directory docs
```

Then open [http://localhost:4173](http://localhost:4173). The checked-in demo uses local-preview storage rather than a Firebase backend, so it does not claim live multi-device synchronization.

The `docs/` output is also ready to use as a GitHub Pages source. Publishing Pages is intentionally left off because Pages visibility is separate from this private repository's visibility.

Regenerate the checked-in demo after template or example-data changes:

```bash
node scripts/build-docs-demo.mjs
```

## What it builds

- A mobile-first itinerary with an interactive daily map and swipeable bottom sheet
- Flights, stays, restaurants, transport, and POIs in one chronological timeline
- English, Simplified Chinese, Traditional Chinese, and Japanese UI and trip content
- Date-flexible checklist with due items surfaced in each itinerary day
- Compact all-date weather slider with icon-opened hourly detail dialogs
- Exact Google Maps place links when supplied, plus timeline-only placeholder plans
- Nearby eat, see/go, and buy ideas for every day
- Firebase anonymous synchronization without an account screen
- Installable PWA shell with offline itinerary support

## Try the generator

Requirements: Node.js 18 or newer. The scripts use only built-in Node modules.

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

## Use it as an agent skill

Clone or copy the repository as one skill directory, then invoke `$build-shared-trip-app` with an itinerary, trip documents, or destination and dates. The trigger metadata is in [`SKILL.md`](SKILL.md), with Codex UI metadata in [`agents/openai.yaml`](agents/openai.yaml).

## Repository layout

| Path | Purpose |
| --- | --- |
| [`SKILL.md`](SKILL.md) | Agent workflow and quality rules |
| [`assets/app-template/`](assets/app-template/) | Reusable Firebase/PWA application template |
| [`assets/trip.example.json`](assets/trip.example.json) | Fictional multilingual input example |
| [`scripts/`](scripts/) | Validation, generation, QA, privacy, cache, and parser tools |
| [`references/`](references/) | Input schema, feature contract, research, and deployment guidance |
| [`docs/`](docs/) | Generated fictional example page for local preview or GitHub Pages |
