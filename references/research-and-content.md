# Research and content workflow

## Start from supplied material

Read every user-provided itinerary, folder, document, image, booking summary, and note. Record source facts separately from suggestions. Keep the user's confirmed ordering, dates, traveler groups, booked status, and public flight/hotel details unless evidence shows a conflict.

Never reuse data from a prior generated trip. Search the working files for old names, dates, participant labels, Firebase IDs, and destinations before delivery.

## Resolve locations

For every plan and recommendation:

1. Open the named place's Google Maps review/address/photo page in a desktop browser.
2. Copy the full address-bar URL.
3. Confirm it contains `/maps/place/` and final `!3d`/`!4d` POI coordinates.
4. Confirm the page name and address match the intended facility.
5. Store that exact URL. Do not substitute a coordinate search, generic search query, shortened Share link, or nearby branch.

If a venue has several branches, choose the branch on the route. Airports, stations, hotels, rental-car counters, and restaurants are POIs too.

## Photos and licensing

Add one representative image for every plan and recommendation. Prefer, in order:

1. user-supplied photos;
2. official venue or tourism media with reuse permission;
3. Wikimedia Commons with a compatible license;
4. other clearly licensed sources.

Do not copy photos from Google Maps, Tabelog, social media, or commercial photo libraries without permission. Record `sourceUrl` and a concise creator/license credit. Use the source page, not a raw image URL, for attribution.

## Recommendations

Build at least five `eat`, five `seeGo`, and five `buy` options for each day, close to that day's active area and realistic schedule.

- For food, cover the area's representative categories, not five near-identical choices.
- Prefer currently well-regarded places and verify branch, opening days, reservation requirements, and current rating.
- For see/go, include famous sights, short detours, seasonal items, and weather alternatives where useful.
- For buy, include locally characteristic food, craft, design, or practical trip items.
- Remove anything already in the itinerary and deduplicate across the day.
- Record `ratingCheckedAt`. Omit a rating if it cannot be verified.

Ratings and recommendations change. Browse current sources for every new trip; never copy old rankings.

## Payments and apps

Research actual payment support for the facilities and transport modes on this route. Use official operator, venue, issuer, or government sources. Describe caveats travelers can act on, such as cash-only counters, reserved-ticket requirements, IC-card limits, foreign-card support, or physical-card backups.

Recommend only iPhone apps that materially help this trip and link directly to the local Apple App Store listing. Favor official regional transit, ticketing, airline, ferry, taxi, parking, or reservation apps. Exclude Maps, Weather, and Translate when native iOS features cover the need.

## Flights and stays

Put flights and stays in the correct day's timeline. Include public operational details and direct official status/detail links. Never embed booking references, confirmation codes, ticket numbers, passport data, or private booking URLs.

Use `booked: true` only when confirmed by the user's material. Keep whole-group plans free of a redundant participant tag.

## Translation

English is the base content. Translate all traveler-facing fields into:

- Simplified Chinese (`zh-Hans`);
- Traditional Chinese (`zh-Hant`);
- Japanese (`ja`).

Keep place names recognizable. Use official local names where available, followed by a useful translated descriptor only when needed. Preserve flight numbers, hotel brands, URLs, times, prices, and IDs.

Do not translate the app name. Review every language in the rendered UI, not just the JSON. Check line wrapping, button widths, date cards, tags, dialogs, and resource cards.

## Weather and time

Use the trip's IANA time zone to decide which trip day is current. Weather uses Open-Meteo with Celsius, precipitation probability/sum, hourly temperature, hourly rain probability, UV, wind, and sunrise/sunset.

The forecast only becomes available when dates enter the provider's forecast window. Do not present climate averages as an actual forecast. Show the fetch timestamp in the viewer's local time zone.

## Privacy and traveler-facing copy

Assume the hosted app URL can be shared. Include only information everyone with the link may see.

Redact booking codes and private identifiers even if a source document contains them. Firebase service-account JSON and private keys must never enter the input, template, repository, or browser.

Keep UI prose useful during the trip. Remove developer-facing explanations such as authentication architecture, synchronization implementation, schema notes, or citation commentary. Put legally required attribution in the collapsed sources disclosure.
