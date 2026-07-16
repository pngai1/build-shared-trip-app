# Feature contract

Preserve these behaviors unless the user explicitly requests a design change.

## Header and main page

- Show the literal app name once, on one line when the viewport permits, beside the deer icon.
- Do not translate the app name.
- Combine country and trip dates into one concise line.
- Use localized decorative route/place names, not a redundant explanatory route sentence.
- Keep language selection, sync state, install action, and the separate Payments & apps link compact and stable across languages.
- Keep the collapsed checklist and weather cards equal-height at desktop sizes. Weather details must open without reflowing the page or overlapping the date navigation.
- Show every itinerary date together in a horizontally scrollable weather summary, independent of the selected itinerary day. Use one equal-height narrow card per date with one aggregate row: wettest-stop icon, maximum high, minimum low, maximum rain chance, and a primary stop label plus `+N` for additional stops. A small timetable icon opens a native dialog or mobile bottom sheet; location chips switch one stop's semantic hourly table at a time, including temperature, precipitation chance, UV, wind, and sunrise/sunset.
- Display plan-change and forecast-fetch timestamps in the viewer's current device time zone. Determine the active trip day in `trip.timezone`.
- Keep required external attributions inside the collapsed Sources & photo credits disclosure.

## Itinerary

- Use one heading: “Itinerary.”
- Open the current trip date automatically; otherwise open the first day.
- Show one selected day at a time, with large date/day/area controls.
- Place flights and stays in the same chronological timeline as every other POI.
- Order by explicit `sortOrder` when complete, otherwise by period and `sortTime`/time.
- Keep plan details collapsed until selected.
- Keep the map synchronized to the active day and reframe all current markers.
- Opening a timeline item focuses its marker without hiding it behind the mobile sheet.
- A map-marker selection opens and scrolls to the corresponding plan.
- Show checklist items due on the selected itinerary date near the top of that day's content, before the timeline. Checklist dates may be before, during, or after the trip.

Timeline summary tags have two rows:

1. period chip, then detailed time;
2. type chip, participant chip when not everyone, Booked chip, then any remaining status chips.

Use a light, visually distinct participant color. Do not reuse the period green. Expand an always-together participant group when a member alias is used. Omit the participant chip when all groups attend.

Do not duplicate a restaurant in Food notes when it is already a plan.

## Mobile planner

- The dedicated `?view=plan` page uses the map as the background and a rounded itinerary sheet above it.
- Keep date controls inside the sheet.
- The sheet exposes three snap states: itinerary, balanced, and more map.
- Move the sheet only after a real vertical swipe. A tap or movement below the drag threshold must move it zero pixels.
- Do not show a black focus/active border after touching the handle.
- Keep keyboard Arrow/Page/Home/End resizing for accessibility.
- Do not let timeline scrolling drag the sheet.
- Reframe map markers after every snap, resize, rotation, or day change.
- Keep dialogs and close buttons inside iPhone safe areas.
- Keep native date inputs within the dialog's content width on iPhone. Preserve the operating-system date picker.
- Prevent page-level pinch zoom and canvas drift while leaving map gestures functional.
- Do not add a bottom filler panel. Extend scrollable itinerary content to the visible safe area without moving the map/sheet border.

## Add and edit plan

Show only:

- name;
- part of day;
- time dropdown;
- plan type;
- Booked / not booked;
- optional full Google Maps browser place URL;
- What to know.

When a full place URL is supplied, parse and save place name, address, final POI coordinates, feature ID, and original URL, then update the timeline and map. When it is blank, save a timeline-only plan with no marker or Maps action. Preserve legacy coordinates only when editing an older item that already has coordinates but no URL.

## Recommendations

- Keep Nearby ideas collapsed by default.
- Provide at least five eat, five see/go, and five buy cards for every day.
- Show a preview photo, short reason, exact Google Maps link, and current rating when available.
- Use three cards per row on wide desktop and two per row on iPhone.
- Keep cards compact and aligned across languages.

## Resources page

- Put detailed payments and useful local iOS apps on the separate page.
- Include only methods and apps relevant to the route.
- Use official sources for facility payment support and direct Apple App Store links.
- Keep the app page traveler-focused; no implementation notes or account explanations.

## Synchronization and install

- Use Firebase anonymous authentication with one shared Firestore document.
- Allow the first authenticated client to create a missing document.
- Synchronize checklist completion, checklist edits, and itinerary add/edit/delete changes.
- Treat this as link-based trust: anyone who can access the app may be able to edit. It is not private account-based access control.
- Keep the Firebase web config and document path out of prose, but do not mislabel them as secrets.
- Cache the written shell and core assets with a service worker. Online maps, weather, and remote photos may need connectivity.
- Show the native install prompt where supported and clear Add to Home Screen instructions on iOS.
- The iOS home-screen name may truncate because the operating system controls its font and layout; use a concise `shortName`.

## Regression checklist

- Four languages render without shifting boxes, clipping dates, or translating the brand.
- Every supplied plan link and every recommendation link opens an exact place page.
- Every mapped plan marker matches its exact link; a plan without a link has neither a marker nor a generated Maps action.
- All plan photos and credits render; missing photos fail gracefully.
- Tap-only handle interaction does not move the sheet.
- Add/edit close controls remain reachable on iPhone.
- First Firestore create and two-client live updates work.
- Weather freshness and plan update timestamps are current.
- Long trips expose every equal-height compact weather date card through horizontal scrolling. Each card has one aggregate day row, and the per-date timetable icon opens a contained, scrollable details dialog on desktop and iPhone without shifting the page. Location chips switch one semantic hourly table at a time while preserving dialog scroll and returning focus to the opener.
- Native date inputs never widen a dialog or extend beyond the iPhone viewport.
- Checklist items can be created before, during, or after the trip, and trip-date items appear in the matching itinerary day.
- No developer-facing sentences, personal booking references, or citations clutter traveler content.
