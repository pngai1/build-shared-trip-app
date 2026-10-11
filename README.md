# Build Shared Trip App

**An agent-ready framework for turning a trip itinerary into a shared, multilingual travel app.**

Provide the itinerary. Your agent researches the missing details, adapts the visual theme, and builds a responsive PWA with the same desktop and phone interactions shown below. The application runs independently of the agent that created it.

**[Agent entry point → SKILL.md](SKILL.md)** · [Setup for Codex & Claude](references/agent-setup.md) · [Interface showcase](showcase/README.md) · [Input contract](references/input-schema.md)

## Start here, agents

Read [`SKILL.md`](SKILL.md) first. It defines the workflow, required reference files, privacy boundaries, and verification gates. Do not infer a real trip from the showcase screenshots or deploy without the user's approval.

Give your agent this task, together with the itinerary or trip documents:

```text
Read SKILL.md and follow build-shared-trip-app for the attached itinerary.
Preserve the framework's desktop map and swipe-only phone planner.
Adapt the colors, icon, and literal app name to our trip's theme.
Prepare English, Simplified Chinese, Traditional Chinese, and Japanese.
Keep uncertain details visibly pending; do not invent bookings or place IDs.
Show desktop and phone-width previews, and report the checks performed.
Prepare a separate Firebase project, but ask before deploying.
```

| Stage | Agent reference | Result |
| --- | --- | --- |
| 1 · Understand | [Research & content](references/research-and-content.md) | Verified itinerary; explicit unknowns |
| 2 · Structure | [Input schema](references/input-schema.md) · [Fictional example](assets/trip.example.json) | Complete multilingual trip JSON |
| 3 · Generate | [Agent workflow](SKILL.md) · [Feature contract](references/feature-contract.md) | Self-contained application folder |
| 4 · Verify | [Responsive & performance checks](references/responsive-performance.md) | Tested desktop and phone previews |
| 5 · Deploy | [Firebase setup](references/firebase-deployment.md) | User-owned hosting and synchronization |

## The interface

The desktop workspace balances an ordered itinerary with a substantial, sticky map. The phone planner uses that same itinerary inside a swipeable sheet: pull it down to explore the map, or up to read the plan.

![Desktop itinerary and large map](showcase/desktop-itinerary.jpg)

<p align="center">
  <img src="showcase/phone-itinerary.jpg" width="250" alt="Phone planner with the itinerary sheet open">
  &nbsp;&nbsp;
  <img src="showcase/phone-map-expanded.jpg" width="250" alt="Phone planner with its sheet lowered to reveal more map">
</p>

These are real rendered views of the winter-trip implementation. Phone images were captured at **390 × 844 in a responsive browser**, not on a physical iPhone. The screenshots are visual references; their itinerary and backend are not the generator's sample data.

**[Full gallery & verification notes](showcase/README.md)** · [Showcase page source](showcase/index.html)

### Included in every trip

- **One coordinated plan:** flights, stays, transport, restaurants, and sights in a single editable timeline, with optional Maps links and placeholder plans.
- **Useful trip context:** date-flexible to-dos, an all-date forecast strip with hourly detail dialogs, and nearby eat / see / buy ideas.
- **Four languages:** English, Simplified Chinese, Traditional Chinese, and Japanese, with a literal, untranslated app name.
- **A shared, installable app:** Firebase-backed edits, a PWA home-screen experience, and an offline-readable itinerary shell. Maps, weather, and remote photos may still require a connection.

## Explore the fictional demo

[`docs/`](docs/) contains **Tide Lines**, a fictional two-day trip generated from [`assets/trip.example.json`](assets/trip.example.json). It uses **local-only preview storage**, not a Firebase backend. Edits in this demo do not synchronize between devices.

With Python 3 installed, run this from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open **[the showcase](http://localhost:4173/showcase/)** or **[the interactive demo](http://localhost:4173/docs/)**. To preview the phone planner, narrow the browser and choose **Open interactive plan**.

No hosted demo is implied by these links. GitHub Pages is not enabled by this guide; publication requires a separate visibility decision.

## Generate your own app

The generator requires **Node.js 18+** and uses built-in modules. Copy the fictional input to a private working location, replace its content, and remove `sampleData`. Follow the [input contract](references/input-schema.md), then run:

```bash
node scripts/validate-trip.mjs /absolute/path/to/trip.json
node scripts/init-trip.mjs /absolute/path/to/trip.json /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
```

For a no-account-setup trial, use the included fixture and a fresh output folder:

```bash
node scripts/validate-trip.mjs assets/trip.example.json --allow-example
node scripts/init-trip.mjs assets/trip.example.json /tmp/tide-lines-demo --allow-example
node scripts/qa-static.mjs /tmp/tide-lines-demo
```

The [agent setup guide](references/agent-setup.md) covers installation and handoff. The [Firebase guide](references/firebase-deployment.md) covers the separate CLI requirements, project setup, region, authentication, rules, and deployment. Colleagues must use **their own account, project, and trip data**.

For photo-heavy trips, the optional [photo optimizer](references/responsive-performance.md) produces small local previews. It needs Sharp and preserves source/credit records; it does not grant image reuse rights.

## Sharing & access boundaries

The reusable template and fictional demo must not contain live backend configuration, source-document links, reservation codes, or credentials. Approved showcase images may show trip branding, dates, and destinations. Never copy private source documents into a generated public app.

A deployed app's anonymous synchronization is **link-based trust, not private membership control**. Anyone who can access that app may be able to edit it. Do not use the default model for sensitive travel records without adding appropriate access controls. See the [deployment guide](references/firebase-deployment.md) and [sharing & privacy checklist](references/sharing-and-privacy.md).

## Maintain the framework

```bash
npm test
node scripts/build-docs-demo.mjs
node scripts/qa-static.mjs /absolute/path/to/fresh-generated-output
```

Run generation against a fresh folder before the final command. Rebuild the checked-in demo whenever its input or application template changes. Static tests do not replace desktop/phone interaction checks, physical-iPhone installation tests, or two-device Firebase verification.

| Location | Purpose |
| --- | --- |
| [`SKILL.md`](SKILL.md) · [`agents/`](agents/) | Agent instructions and discovery metadata |
| [`references/`](references/) | Setup, input, content, UI, performance, and deployment contracts |
| [`assets/app-template/`](assets/app-template/) | Reusable application source |
| [`assets/trip.example.json`](assets/trip.example.json) | Fictional multilingual input fixture |
| [`scripts/`](scripts/) | Generation, validation, tests, privacy, photo, and cache tools |
| [`docs/`](docs/) | Reproducible fictional app |
| [`showcase/`](showcase/) | Professional gallery and approved implementation screenshots |
