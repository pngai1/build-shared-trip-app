# One itinerary. Every screen.

A visual reference for the shared-trip framework: a spacious desktop workspace and an iOS-oriented planner that puts the map behind a swipeable itinerary sheet.

**[Agent instructions](../SKILL.md)** · [Feature contract](../references/feature-contract.md) · [Fictional demo](../docs/) · [Showcase page source](index.html)

To view the designed gallery, run `python3 -m http.server 4173 --bind 127.0.0.1` from the repository root and open [localhost:4173/showcase/](http://localhost:4173/showcase/). Python 3 is required for that preview command.

## Desktop / room to explore

The selected day's timeline and a large sticky map share the workspace. Selecting a plan focuses its marker; selecting a marker opens its plan. A compact header, aligned checklist, and all-date forecast strip keep the trip overview easy to scan.

![Desktop timeline and substantial map](desktop-itinerary.jpg)

<details>
<summary>Show the compact desktop overview</summary>

![Compact desktop overview](desktop-overview.jpg)

</details>

## Phone / the map and plan, in balance

Dates stay inside the rounded sheet. A vertical swipe changes its height; a tap on the handle does not. The itinerary scrolls separately, and the map reframes after the sheet moves.

<p align="center">
  <img src="phone-itinerary.jpg" width="250" alt="Phone planner in the balanced itinerary position">
  &nbsp;&nbsp;
  <img src="phone-map-expanded.jpg" width="250" alt="Phone planner lowered to reveal the map">
</p>

<details>
<summary>Show the compact phone homepage</summary>

<img src="phone-overview.jpg" width="300" alt="Phone overview with compact checklist and forecast cards">

</details>

## What you are seeing

| | Implementation screenshots | Reproducible demo |
| --- | --- | --- |
| Content | Approved winter-trip branding, dates, and destinations | Fictional **Tide Lines** itinerary |
| Format | Actual browser captures, taken October 10, 2026 | Generated application in [`../docs/`](../docs/) |
| Backend | Not included or linked | No live backend; local preview edits only |
| Phone | 390 × 844 responsive viewport | Resize the browser and open the interactive plan |
| Forecast | Unavailable at capture time for the future trip dates | Future fictional dates may have no forecast data |

The gallery is not a physical-iPhone installation test. Safari's Add to Home Screen flow, operating-system date picker, keyboard, and installed-app safe areas still require real-device verification.

## Verification record

The framework update captured on October 10, 2026 passed the regression suite and privacy scan, fresh generation/static QA, and optional photo-optimizer fixture tests. Browser checks covered:

- Four-language desktop and phone layouts without horizontal overflow.
- Compact checklist sizing, contained phone date input, and weather dialogs.
- Swipe-only sheet movement, with the bottom remaining flush to the viewport.
- The fictional demo under `/docs/`, including local images and date navigation.
- Service-worker asset scope and retention of unrelated application caches in automated tests.

Not re-tested for those captures: physical-iPhone installation, two-device Firebase synchronization, or an actual offline browser session. Follow the [responsive/performance guide](../references/responsive-performance.md) and [deployment verification](../references/firebase-deployment.md) for every new trip.
