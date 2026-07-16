import { UI_ZH_HANT } from "./translations-zh-hant.js?v=__CACHE_VERSION__";
import { UI_ZH_HANS } from "./translations-zh-hans.js?v=__CACHE_VERSION__";
import { UI_JA } from "./translations-ja.js?v=__CACHE_VERSION__";

const seedTrip = readSeedTrip();
const LANGUAGE_STORAGE_KEY = `${seedTrip.slug || "shared-trip"}-language`;

function readSeedTrip() {
  try {
    return JSON.parse(document.getElementById("trip-data")?.textContent || "{}");
  } catch {
    return {};
  }
}

export const LANGUAGES = {
  en: { label: "English", htmlLang: "en", dateLocale: "en-US" },
  "zh-Hans": { label: "简体中文", htmlLang: "zh-Hans", dateLocale: "zh-CN" },
  "zh-Hant": { label: "繁體中文", htmlLang: "zh-Hant", dateLocale: "zh-Hant" },
  ja: { label: "日本語", htmlLang: "ja", dateLocale: "ja-JP" }
};

export const UI_EN = {
  language: "Language",
  brandName: "Shared trip",
  jumpDayNav: "Jump to a day",
  resizeItineraryPanel: "Resize map and itinerary panels",
  sheetItineraryView: "More itinerary",
  sheetBalancedView: "Balanced view",
  sheetMapView: "More map",
  documentTitle: "Shared trip",
  metaDescription: "Shared trip map, timeline and live notes.",
  skipToItinerary: "Skip to itinerary",
  tripDateLine: "{dateRange}",
  liveTripBoard: "Live trip board",
  sharedChecklist: "Shared checklist",
  openCount: "{count} open",
  addTodoButton: "+ Add to-do",
  addTodo: "Add a to-do",
  editTodo: "Edit to-do",
  todoItem: "To-do",
  dueDate: "Due date",
  todoDateHint: "Choose any date.",
  todoPlaceholder: "What needs to be done?",
  goodToKnow: "Good to know",
  bookingsAtGlance: "Bookings at a glance",
  flights: "Flights",
  stays: "Stays",
  route: "The route",
  routeTitle: "Trip route",
  mapAria: "Interactive map of the active itinerary day",
  mapOffline: "The written itinerary remains available offline. Map tiles return when you reconnect.",
  mapLoadError: "The map could not load. The written itinerary and addresses are still available below.",
  dayByDay: "Day by day",
  sharedPlan: "The shared plan",
  itineraryTitle: "Itinerary",
  tripNotes: "Trip notes",
  anonymousFooter: "If we get lost, the deer is officially our tour guide. 🦌",
  editPlan: "Edit plan",
  edit: "Edit",
  addPlan: "Add a plan",
  addPlanButton: "+ Add plan",
  name: "Name",
  partOfDay: "Part of day",
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  time: "Time",
  planType: "Type",
  planTypeFlight: "Flight",
  planTypeStay: "Hotel",
  planTypeRestaurant: "Restaurant",
  planTypeTransport: "Transport",
  planTypeCar: "Car",
  planTypeSight: "Sight",
  planTypeActivity: "Activity",
  planTypeEvent: "Event",
  planTypeShopping: "Shopping",
  planTypeOther: "Other",
  everyone: "Everyone",
  googleMapsLink: "Full Google Maps link · optional",
  googleMapsLinkPlaceholder: "https://www.google.com/maps/place/…/@latitude,longitude",
  googleMapsLinkHint: "Leave blank for a timeline-only placeholder. To add a map marker, paste the exact full place URL from a computer browser; short Share links do not work.",
  googleMapsLinkInvalid: "Paste a full Google Maps place link containing /maps/place/ and coordinates.",
  placeReady: "Location ready",
  whatToKnow: "What to know",
  address: "Address",
  transport: "Transport",
  reservation: "Reservation",
  notBooked: "Not booked / not needed",
  booked: "Booked",
  planned: "Planned",
  confirmed: "Confirmed",
  latitudeOptional: "Latitude · optional",
  longitudeOptional: "Longitude · optional",
  coordinatesHint: "Leave coordinates blank if you only want the item on the timeline. Add both to place it on the map.",
  quickNote: "Quick note",
  editsAsEntered: "New notes stay in the language you type.",
  delete: "Delete",
  cancel: "Cancel",
  saveForEveryone: "Save for everyone",
  close: "Close",
  install: "Install",
  installIos: "Add to iPhone",
  iosInstallTitle: "Add to iPhone Home Screen",
  iosInstallIntro: "Add this trip as an app from Safari:",
  iosInstallSafariNote: "If you opened this inside another app, open it in Safari first. Already in Safari? Skip this step.",
  iosInstallStepShare: "Tap More, then Share. If Share is already visible in the toolbar, tap it directly.",
  iosInstallStepHomeScreen: "Scroll and choose Add to Home Screen.",
  iosInstallStepOpenAsApp: "Turn on Open as Web App, then tap Add.",
  iosInstallDone: "Got it",
  connecting: "Connecting…",
  syncing: "Syncing…",
  online: "Online",
  savedOffline: "Saved offline",
  saving: "Saving…",
  synced: "Synced",
  offlineCopy: "Offline copy",
  syncUnavailable: "Sync unavailable",
  savedOnDevice: "Saved on device",
  saveFailed: "Save failed",
  setupFailed: "Setup failed",
  localPreview: "Saved on this device",
  weather: "Weather",
  tripForecast: "Trip forecast by day and stop",
  forecastDetailsFor: "Forecast details for {date}",
  forecastRefreshNote: "A fresh forecast is requested whenever someone opens the app. Times use the trip timezone; temperatures use Celsius.",
  loadingForecast: "Loading the latest forecast…",
  loadingForecastShort: "Loading…",
  refreshingForecast: "Refreshing…",
  liveForecast: "Latest forecast",
  savedForecast: "Saved forecast",
  forecastUnavailable: "The live forecast is unavailable right now. Try again when connected.",
  forecastUnavailableShort: "Unavailable",
  forecastNotAvailable: "Forecast not available yet.",
  forecastDatePassed: "Forecast date has passed.",
  forecastUpdated: "Forecast fetched {time}",
  weatherDataBy: "Weather: Open-Meteo",
  feelsLike: "Feels like high / low",
  precipitation: "Precipitation chance / total",
  wind: "Max wind",
  gusts: "Max gusts",
  uvIndex: "Max UV",
  sunriseSunset: "Sunrise / sunset",
  weatherClear: "Clear",
  weatherMainlyClear: "Mainly clear",
  weatherPartlyCloudy: "Partly cloudy",
  weatherOvercast: "Overcast",
  weatherFog: "Fog",
  weatherRimeFog: "Rime fog",
  weatherDrizzle: "Drizzle",
  weatherLightDrizzle: "Light drizzle",
  weatherModerateDrizzle: "Moderate drizzle",
  weatherDenseDrizzle: "Dense drizzle",
  weatherLightFreezingDrizzle: "Light freezing drizzle",
  weatherDenseFreezingDrizzle: "Dense freezing drizzle",
  weatherRain: "Rain",
  weatherLightRain: "Light rain",
  weatherModerateRain: "Moderate rain",
  weatherHeavyRain: "Heavy rain",
  weatherLightFreezingRain: "Light freezing rain",
  weatherHeavyFreezingRain: "Heavy freezing rain",
  weatherSnow: "Snow",
  weatherLightSnow: "Light snow",
  weatherModerateSnow: "Moderate snow",
  weatherHeavySnow: "Heavy snow",
  weatherSnowGrains: "Snow grains",
  weatherShowers: "Showers",
  weatherLightShowers: "Light showers",
  weatherModerateShowers: "Moderate showers",
  weatherViolentShowers: "Violent showers",
  weatherLightSnowShowers: "Light snow showers",
  weatherHeavySnowShowers: "Heavy snow showers",
  weatherThunderstorm: "Thunderstorm",
  weatherThunderstormLightHail: "Thunderstorm with light hail",
  weatherThunderstormHeavyHail: "Thunderstorm with heavy hail",
  weatherUnknown: "Conditions unavailable",
  pack: "Pack",
  payment: "Payment",
  routePaymentGuide: "Payment methods along the route",
  usefulApps: "Useful apps",
  iosAppsForTrip: "Useful local apps",
  openAppStore: "Open in App Store ↗",
  beforeYouGo: "Before you go",
  allBooked: "All booked",
  baggage: "Baggage",
  chooseOne: "Choose one",
  approximatePin: "Approx. pin",
  hoursLabel: "Hours: {value}",
  eventLabel: "Event: {value}",
  referenceLabel: "Admission / reference: {value}",
  nextLabel: "Transport: {value}",
  openGoogleMaps: "Open in Google Maps",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  dayNumber: "Day {number} · {weekday}",
  jumpToDay: "Jump to day {number}, {date}",
  addToDate: "Add a plan to {date}",
  emptyDay: "Nothing planned yet. Add the first stop for this day.",
  foodNotes: "Food notes",
  flexible: "Flexible",
  plan: "Plan",
  updatedAt: "Plan last changed {time}",
  markComplete: "Mark {item} complete",
  markedComplete: "Marked complete",
  reopenedReminder: "Reopened reminder",
  todoAdded: "To-do added",
  todoUpdated: "To-do updated",
  todoDeleted: "To-do deleted",
  planUpdated: "Plan updated",
  planAdded: "Plan added",
  planDeleted: "Plan deleted",
  deleteConfirm: "Delete {item}? This syncs for everyone.",
  listenerError: "Could not reach the shared trip. Showing the saved copy.",
  syncTemporaryError: "Shared sync is temporarily unavailable. Editing is paused until the app reconnects.",
  savedCopyNoSync: "Showing the saved itinerary. Live changes are unavailable right now.",
  editRequiresConnection: "Reconnect before editing so the change can sync for everyone.",
  initializationError: "Showing the saved itinerary while live sync reconnects.",
  saveError: "That change could not be saved. Please try again.",
  dueOnDate: "Due {date}",
  todosDueOnDate: "To-dos due {date}",
  due: "due",
  bookAhead: "Book about {count} days ahead",
  namePlaceholder: "Short name",
  timePlaceholder: "09:30–11:00",
  reviewPlaceholder: "Short description or plan",
  transportPlaceholder: "Drive · about 90 min",
  notePlaceholder: "Anything the group should remember",
  paymentsAndApps: "Payments & apps",
  checklistSyncHint: "Changes sync automatically.",
  oneDayAtATime: "Choose a date to see that day’s plan. Today opens automatically during the trip.",
  openInteractivePlan: "Open interactive plan",
  openInteractivePlanHint: "Map, compact dates and today’s ordered itinerary",
  backToOverview: "Back to overview",
  dailyItinerary: "Selected day itinerary",
  flightBookingDetails: "Flight booking",
  stayBookingDetails: "Stay booking",
  returnToHotel: "Return to {name}",
  checkOutHotel: "Check out · {name}",
  overnight: "Overnight",
  morningCheckOut: "Morning check-out",
  activeDayRoute: "Active day",
  bookedAndReady: "Booked and ready",
  bookingsSummary: "Bookings are included in the daily itinerary",
  backToTrip: "← Back to the trip",
  travelResources: "Payments & useful apps",
  resourcesPageIntro: "Payment methods and useful iPhone apps for this trip.",
  resourceFreshness: "Payment support and app availability can change; use the linked official pages to verify important details.",
  weatherForecast: "Weather forecast",
  rainChance: "Rain",
  chooseDay: "Choose day {number}, {date}, {area}",
  dayShort: "Day {number}",
  today: "Today",
  photoCredit: "Photo",
  credits: "Sources & photo credits",
  representativePhoto: "Representative photo of {name}",
  nearbyIdeas: "Nearby ideas",
  eatSeeDoMore: "Eat, see, do & bring home",
  ideaCount: "{count} ideas",
  tabelogShortlist: "Tabelog shortlist",
  additionalRestaurants: "Tabelog restaurant shortlist",
  localShortlist: "Local shortlist",
  famousNearby: "Famous nearby food, sights & buys",
  ratingsDisclaimer: "Ratings are snapshots and can change. Confirm hours and fit before going.",
  reviewCount: "{count} reviews",
  openTabelog: "Open Tabelog",
  officialDetails: "Official details",
  categoryRestaurant: "Restaurant",
  categoryEat: "Must eat",
  categorySnack: "Snack",
  categoryDo: "To do",
  categorySee: "To see",
  categoryBuy: "To buy",
  categoryGo: "To go",
  segmentCount: "{count} segments"
};

const UI_BY_LANGUAGE = {
  en: UI_EN,
  "zh-Hans": UI_ZH_HANS,
  "zh-Hant": UI_ZH_HANT,
  ja: UI_JA
};

const STRUCTURAL_STRING_KEYS = new Set([
  "id", "date", "startDate", "period", "planType", "photo", "colorScheme",
  "googleMapsUrl", "mapsUrl", "googleMapsFeatureId", "googleMapsPlaceLabel", "googleMapsPlaceName"
]);

export function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && LANGUAGES[saved]) return saved;
  } catch {
    // Storage can be unavailable; browser-language detection still works.
  }

  const browserLanguage = (navigator.language || "en").toLowerCase();
  if (/^zh(?:-|$)/.test(browserLanguage)) {
    return /(?:hant|tw|hk|mo)/.test(browserLanguage) ? "zh-Hant" : "zh-Hans";
  }
  if (browserLanguage.startsWith("ja")) return "ja";
  return "en";
}

export function saveLanguage(language) {
  if (!LANGUAGES[language]) return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selection remains active for this page even without storage.
  }
}

export function languageStorageKey() {
  return LANGUAGE_STORAGE_KEY;
}

export function ui(language, key, variables = {}) {
  if (["brandName", "documentTitle"].includes(key)) return seedTrip.title || "Shared trip";
  if (key === "metaDescription") {
    return localizeTrip(seedTrip, language).metaDescription || "Shared trip map, timeline and live notes.";
  }
  if (key === "tripDateLine") {
    const localizedTrip = localizeTrip(seedTrip, language);
    return [localizedTrip.country, variables.dateRange].filter(Boolean).join(" · ");
  }
  const dictionary = UI_BY_LANGUAGE[language] || UI_EN;
  const template = dictionary[key] || UI_EN[key] || key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ""));
}

export function languageMeta(language) {
  return LANGUAGES[language] || LANGUAGES.en;
}

export function localizeTrip(trip, language) {
  function walk(value, key = "", isRoot = false) {
    if (typeof value === "string") {
      if (STRUCTURAL_STRING_KEYS.has(key)) return value;
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => walk(item));
    if (value && typeof value === "object") {
      const localized = Object.fromEntries(
        Object.entries(value)
          .filter(([childKey]) => childKey !== "i18n")
          .map(([childKey, childValue]) => [childKey, walk(childValue, childKey)])
      );
      const patch = value.i18n?.[language];
      if (patch && typeof patch === "object") {
        Object.entries(patch).forEach(([childKey, childValue]) => {
          if (isRoot && childKey === "title") return;
          localized[childKey] = walk(childValue, childKey);
        });
      }
      return localized;
    }
    return value;
  }

  return walk(trip, "", true);
}

function cloneValue(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
