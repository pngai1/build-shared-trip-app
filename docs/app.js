import { firebaseConfig, tripDocumentPath } from "./firebase-config.js?v=v-d7e4948348d0";
import { getGooglePlaceLinks } from "./google-place-links.js?v=v-d7e4948348d0";
import { buildGoogleMapsUrl } from "./map-links.js?v=v-d7e4948348d0";
import { parseFullGoogleMapsPlaceUrl } from "./google-maps-place-url.js?v=v-d7e4948348d0";
import {
  getInitialLanguage,
  languageStorageKey,
  languageMeta,
  localizeTrip,
  saveLanguage,
  ui
} from "./i18n.js?v=v-d7e4948348d0";
import {
  DAY_FORECAST_LOCATIONS,
  fetchTripForecast,
  loadCachedTripForecast,
  localizeForecastLocation,
  weatherCodeIcon,
  weatherCodeKey
} from "./weather-forecast.js?v=v-d7e4948348d0";
import { getFlightBookings } from "./flight-bookings.js?v=v-d7e4948348d0";
import { getDayArea, getDayGuide, getPlacePhoto } from "./daily-guide.js?v=v-d7e4948348d0";

const FIREBASE_SDK_VERSION = "12.15.0";
const seedTrip = JSON.parse(document.getElementById("trip-data").textContent);
const APP_NAME = seedTrip.title || "Shared trip";
const APP_NAMESPACE = seedTrip.slug || "shared-trip";
const APP_BUILD_ID = seedTrip.buildId || "preview";
const APP_STORAGE_KEY = `${APP_NAMESPACE}-${APP_BUILD_ID}`;
const APP_CHANNEL_NAME = `${APP_NAMESPACE}-${APP_BUILD_ID}`;
const TRIP_TIMEZONE = seedTrip.timezone || "UTC";
const itineraryViewMedia = window.matchMedia("(max-width: 679px), (max-height: 500px) and (pointer: coarse)");
const els = {
  title: document.getElementById("trip-title"),
  dateRange: document.getElementById("trip-date-range"),
  status: document.getElementById("sync-status"),
  statusText: document.getElementById("sync-status-text"),
  updated: document.getElementById("last-updated"),
  install: document.getElementById("install-app"),
  installDialog: document.getElementById("install-dialog"),
  reminders: document.getElementById("reminder-list"),
  reminderCount: document.getElementById("reminder-count"),
  addReminder: document.getElementById("add-reminder"),
  mapOffline: document.getElementById("map-offline"),
  itinerary: document.querySelector(".itinerary"),
  planWorkspace: document.querySelector(".plan-workspace"),
  itinerarySheet: document.querySelector(".itinerary-sheet"),
  itinerarySheetHandle: document.getElementById("itinerary-sheet-handle"),
  daysNav: document.getElementById("days-nav"),
  days: document.getElementById("itinerary-days"),
  itineraryPanel: document.getElementById("itinerary-days"),
  openPlanView: document.getElementById("open-plan-view"),
  closePlanView: document.getElementById("close-plan-view"),
  planLanguage: document.getElementById("plan-language-select"),
  activeWeather: document.getElementById("active-weather"),
  flights: document.getElementById("flight-list"),
  hotels: document.getElementById("hotel-list"),
  tips: document.getElementById("tips-list"),
  disclaimer: document.getElementById("trip-disclaimer"),
  credits: document.getElementById("credits-list"),
  dialog: document.getElementById("item-dialog"),
  dialogTitle: document.getElementById("dialog-title"),
  form: document.getElementById("item-form"),
  deleteItem: document.getElementById("delete-item"),
  googleMapsLinkError: document.getElementById("google-maps-link-error"),
  googleMapsLinkPreview: document.getElementById("google-maps-link-preview"),
  googleMapsPlaceLabel: document.getElementById("google-maps-place-label"),
  googleMapsPlaceCoordinates: document.getElementById("google-maps-place-coordinates"),
  todoDialog: document.getElementById("todo-dialog"),
  todoDialogTitle: document.getElementById("todo-dialog-title"),
  todoForm: document.getElementById("todo-form"),
  deleteReminder: document.getElementById("delete-reminder"),
  toast: document.getElementById("toast"),
  language: document.getElementById("language-select"),
  metaDescription: document.getElementById("meta-description"),
  mapTitle: document.getElementById("map-title"),
  mapDayLabel: document.getElementById("map-day-label"),
  routeDecoration: document.getElementById("trip-route-decoration")
};

let currentTrip = loadLocalTrip() || seedTrip;
let displayTrip = currentTrip;
let currentLanguage = getInitialLanguage();
let mapInstance = null;
let deferredInstallPrompt = null;
let syncRuntime = null;
let syncReady = false;
let currentSourceIsCache = false;
let toastTimer = null;
let toastKey = null;
let toastVariables = {};
let localChannel = null;
let currentStatusKey = "connecting";
let currentStatusVariables = {};
let lastUpdatedDate = null;
let activeDayId = initialDayId(currentTrip.days);
const cachedWeatherForecast = loadCachedTripForecast();
let weatherForecastState = {
  status: "loading",
  data: cachedWeatherForecast,
  error: null
};
let weatherRefreshPromise = null;
let currentMapPoints = [];
let mapResizeTimer = null;
const ITINERARY_SHEET_MODES = Object.freeze(["itinerary", "balanced", "map"]);
const ITINERARY_SHEET_DRAG_THRESHOLD_PX = 8;
let itinerarySheetMode = "itinerary";
let itinerarySheetDrag = null;
let itinerarySheetFrameTimer = null;
let itinerarySheetPositionFrame = null;
let pendingItinerarySheetTop = null;
const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const FLIGHT_BOOKING_REFS = Object.freeze({});
const HOTEL_BOOKING_REFS = Object.freeze({});

const PLAN_TYPES = Object.freeze(["flight", "stay", "restaurant", "transport", "car", "sight", "activity", "event", "shopping", "other"]);
const PLAN_TYPE_SET = new Set(PLAN_TYPES);
const SLOT_PLAN_TYPES = Object.freeze({});
const SLOT_PARTICIPANT_GROUPS = Object.freeze({});
const DINING_PLAN_REFS = Object.freeze({});
const DAY_SLOT_ORDER = Object.freeze({});

populateTimeOptions();
syncItineraryViewClass();
applyLanguageToDocument();
renderAll();
setupInteractionHandlers();
registerServiceWorker();
let syncStartupPromise = connectRealtimeSync();
refreshWeatherForecast();

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function uid(prefix = "item") {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isFirebaseConfigured() {
  return firebaseConfig.projectId
    && !Object.values(firebaseConfig).some((value) => String(value).startsWith("REPLACE_"));
}

function loadLocalTrip() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistLocalTrip() {
  try {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(currentTrip));
  } catch {
    // Storage can be unavailable in private browsing. The in-memory copy still works.
  }
}

function renderAll() {
  normalizeTrip(currentTrip);
  if (!currentTrip.days.some((day) => day.id === activeDayId)) activeDayId = initialDayId(currentTrip.days);
  displayTrip = localizeTrip(currentTrip, currentLanguage);
  applyStaticTranslations();
  renderHeader();
  renderReminders();
  renderEssentials();
  renderTravelLogistics();
  renderDayNavigation();
  renderItinerary();
  renderCredits();
  renderTips();
  renderMap();
}

function normalizeTrip(trip) {
  trip.title = APP_NAME;
  trip.days = Array.isArray(trip.days)
    ? trip.days.filter((day) => day && typeof day === "object" && !Array.isArray(day)).slice(0, 31)
    : [];
  trip.reminders = Array.isArray(trip.reminders)
    ? trip.reminders.filter((reminder) => reminder && typeof reminder === "object" && !Array.isArray(reminder)).slice(0, 80)
    : [];
  trip.days.forEach((day, dayIndex) => {
    day.id ||= `day-${day.date || dayIndex}`;
    day.slots = Array.isArray(day.slots)
      ? day.slots.filter((slot) => slot && typeof slot === "object" && !Array.isArray(slot)).slice(0, 80)
      : [];
    day.slots.forEach((slot, slotIndex) => {
      slot.id ||= `slot-${dayIndex}-${slotIndex}`;
      slot.booked = slot.booked === true || slot.booked === "true";
      slot.planType = normalizePlanType(slot.planType, slot);
      slot.time = canonicalTimelineTime(slot.time, slot.id);
    });
  });
  trip.reminders.forEach((reminder, index) => {
    reminder.id ||= `reminder-${index}`;
    reminder.item = String(reminder.item || "Reminder").slice(0, 200);
    const leadDays = Number(reminder.leadDays);
    reminder.leadDays = Number.isFinite(leadDays) ? Math.min(365, Math.max(0, Math.round(leadDays))) : 0;
    reminder.done = Boolean(reminder.done);
    reminder.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(reminder.dueDate || ""))
      ? reminder.dueDate
      : "";
  });
}

function renderHeader() {
  els.title.textContent = APP_NAME;
  if (els.routeDecoration) {
    els.routeDecoration.textContent = displayTrip.routeDecoration || displayTrip.country || "";
  }
  applyTripTheme(currentTrip.theme);
  const first = displayTrip.days[0]?.date || displayTrip.startDate;
  const last = displayTrip.days.at(-1)?.date || displayTrip.startDate;
  els.dateRange.textContent = ui(currentLanguage, "tripDateLine", {
    dateRange: formatCompactDateRange(first, last)
  });
  const activeDay = displayTrip.days.find((day) => day.id === activeDayId);
  const planUrl = new URL(window.location.href);
  planUrl.searchParams.set("view", "plan");
  if (activeDay?.date) planUrl.searchParams.set("day", activeDay.date);
  els.openPlanView.href = `${planUrl.pathname}${planUrl.search}${planUrl.hash}`;
}

function applyTripTheme(theme = {}) {
  const allowed = new Set([
    "ink", "ink-2", "paper", "paper-2", "card", "text", "muted", "line",
    "accent", "accent-text", "accent-soft", "moss", "moss-soft", "gold", "danger"
  ]);
  Object.entries(theme || {}).forEach(([name, value]) => {
    if (!allowed.has(name) || !/^#[0-9a-f]{3,8}$/i.test(String(value))) return;
    document.documentElement.style.setProperty(`--${name}`, String(value));
  });
}

function renderReminders() {
  const computed = computeReminders(displayTrip.startDate, displayTrip.reminders);
  els.reminders.innerHTML = renderChecklistHTML(computed, {
    formatBefore: (date) => ui(currentLanguage, "beforeDeadline", {
      date: formatDate(date, { year: "numeric", month: "long", day: "numeric" })
    }),
    formatDaysAhead: (count) => currentLanguage === "en"
      ? `${count} ${count === 1 ? "day" : "days"} ahead`
      : ui(currentLanguage, "daysAhead", { count })
  });

  const ordered = computed.map((item) => displayTrip.reminders.find((reminder) => reminder.id === item.id));
  els.reminders.querySelectorAll("li").forEach((item, index) => {
    const displayReminder = ordered[index];
    const reminder = currentTrip.reminders.find((candidate) => candidate.id === displayReminder?.id);
    if (!reminder || !displayReminder) return;
    item.dataset.reminderId = displayReminder.id;
    const input = item.querySelector("input");
    input.checked = reminder.done;
    input.setAttribute("aria-label", ui(currentLanguage, "markComplete", { item: displayReminder.item }));
    item.classList.toggle("is-complete", reminder.done);
    item.classList.toggle("is-overdue", !reminder.done && computed[index].deadline < todayISO());
    item.dataset.overdueLabel = ` · ${ui(currentLanguage, "due")}`;
    input.addEventListener("change", async () => {
      const desiredState = input.checked;
      const saved = await mutateTrip((trip) => {
        const target = trip.reminders.find((candidate) => candidate.id === reminder.id);
        if (target) target.done = desiredState;
      }, desiredState ? "markedComplete" : "reopenedReminder");
      if (!saved) input.checked = reminder.done;
    });
    const edit = textElement("button", "todo-edit", ui(currentLanguage, "edit"));
    edit.type = "button";
    edit.setAttribute("aria-label", `${ui(currentLanguage, "editTodo")}: ${displayReminder.item}`);
    edit.addEventListener("click", (event) => {
      event.stopPropagation();
      openTodoDialog(reminder.id);
    });
    item.append(edit);
    item.addEventListener("click", (event) => {
      if (event.target !== input && !event.target.closest("button")) input.click();
    });
  });

  const openCount = currentTrip.reminders.filter((item) => !item.done).length;
  els.reminderCount.textContent = ui(currentLanguage, "openCount", { count: openCount });
}

function renderEssentials() {
  const openWeatherKeys = new Set(
    [...els.activeWeather.querySelectorAll(".weather-peek[open]")]
      .map((peek) => peek.dataset.weatherKey)
      .filter(Boolean)
  );
  const day = displayTrip.days.find((candidate) => candidate.id === activeDayId) || displayTrip.days[0];
  els.activeWeather.replaceChildren();
  if (!day) return;

  const heading = element("div", "weather-compact__header");
  const headingCopy = element("div", "weather-compact__heading");
  const headingLabel = textElement("span", "eyebrow", ui(currentLanguage, "weatherForecast"));
  headingLabel.id = "weather-compact-title";
  headingCopy.append(
    headingLabel,
    textElement("strong", "", formatDate(day.date, { weekday: "short", month: "short", day: "numeric" }))
  );
  const weatherStatus = element("div", "weather-compact__status");
  const statusChip = weatherStatusChip();
  if (statusChip) weatherStatus.append(statusChip);
  const fetchedAt = weatherForecastState.data?.fetchedAt;
  const fetchedDate = fetchedAt ? new Date(fetchedAt) : null;
  if (fetchedDate && !Number.isNaN(fetchedDate.getTime())) {
    const freshness = textElement(
      "time",
      "weather-compact__updated",
      ui(currentLanguage, "forecastUpdated", { time: formatTimestamp(fetchedDate) })
    );
    freshness.dateTime = fetchedDate.toISOString();
    weatherStatus.append(freshness);
  }
  heading.append(headingCopy);
  if (weatherStatus.childNodes.length) heading.append(weatherStatus);
  els.activeWeather.append(heading);

  if (!weatherForecastState.data) {
    els.activeWeather.append(textElement("p", "weather-compact__empty", ui(
      currentLanguage,
      weatherForecastState.status === "loading" ? "loadingForecast" : "forecastUnavailable"
    )));
  } else {
    const peeks = element("div", "weather-peeks");
    const locations = DAY_FORECAST_LOCATIONS[day.id] || [];
    locations.forEach((locationId) => {
      const peek = renderWeatherPeek(day, locationId);
      if (openWeatherKeys.has(peek.dataset.weatherKey)) peek.open = true;
      peeks.append(peek);
    });
    if (!locations.length) peeks.append(textElement("p", "weather-compact__empty", ui(currentLanguage, "forecastNotAvailable")));
    els.activeWeather.append(peeks);
  }

}

async function refreshWeatherForecast({ force = true } = {}) {
  if (weatherRefreshPromise) return weatherRefreshPromise;
  const fetchedAt = Date.parse(weatherForecastState.data?.fetchedAt || "");
  if (!force && Number.isFinite(fetchedAt) && Date.now() - fetchedAt < WEATHER_REFRESH_INTERVAL_MS) return null;

  weatherRefreshPromise = (async () => {
    weatherForecastState = { ...weatherForecastState, status: "loading", error: null };
    renderEssentials();
    try {
      const data = await fetchTripForecast();
      weatherForecastState = { status: "live", data, error: null };
    } catch (error) {
      console.warn("Live weather forecast unavailable", error);
      weatherForecastState = {
        status: weatherForecastState.data ? "saved" : "error",
        data: weatherForecastState.data,
        error
      };
    }
    renderEssentials();
  })();

  try {
    return await weatherRefreshPromise;
  } finally {
    weatherRefreshPromise = null;
  }
}

function weatherStatusChip() {
  if (weatherForecastState.status === "live") return null;
  const key = weatherForecastState.status === "live"
    ? "liveForecast"
    : weatherForecastState.status === "saved"
      ? "savedForecast"
      : weatherForecastState.status === "error"
        ? "forecastUnavailableShort"
        : weatherForecastState.data
          ? "refreshingForecast"
          : "loadingForecastShort";
  const className = weatherForecastState.status === "live"
    ? "status-chip status-chip--live"
    : weatherForecastState.status === "error"
      ? "status-chip status-chip--warning"
      : "status-chip";
  return textElement("span", className, ui(currentLanguage, key));
}

function renderWeatherPeek(day, locationId) {
  const daily = dailyForecast(locationId, day.date);
  const disclosure = element("details", "weather-peek");
  disclosure.name = "active-day-weather";
  disclosure.dataset.weatherKey = `${day.id}:${locationId}`;
  const summary = element("summary", "weather-peek__summary");
  const identity = element("span", "weather-peek__identity");
  identity.append(
    textElement("span", "weather-peek__icon", daily ? weatherCodeIcon(daily.weatherCode) : "☁"),
    textElement("span", "weather-peek__place", localizeForecastLocation(locationId, currentLanguage))
  );
  summary.append(identity);

  if (!daily) {
    summary.append(textElement("span", "weather-peek__unavailable", ui(currentLanguage, day.date < todayISO() ? "forecastDatePassed" : "forecastNotAvailable")));
    disclosure.append(summary);
    return disclosure;
  }

  const temperature = element("span", "weather-peek__temperature");
  temperature.append(
    textElement("strong", "", `${formatNumber(daily.temperatureMax, 0)}°`),
    document.createTextNode(` / ${formatNumber(daily.temperatureMin, 0)}°C`)
  );
  const rain = textElement("span", "weather-peek__rain", `💧 ${formatNumber(daily.precipitationProbability, 0)}%`);
  summary.append(temperature, rain, textElement("span", "summary-chevron", "⌄"));

  const popover = element("div", "weather-popover");
  const overview = element("div", "weather-popover__overview");
  overview.append(
    textElement("strong", "", ui(currentLanguage, weatherCodeKey(daily.weatherCode))),
    textElement("span", "", `${formatNumber(daily.precipitationSum, 1)} mm · ${ui(currentLanguage, "uvIndex")} ${formatNumber(daily.uvIndexMax, 1)}`)
  );
  popover.append(overview);

  const samples = hourlyForecast(locationId, day.date).filter((point) => [6, 9, 12, 15, 18, 21].includes(Number(point.time.slice(0, 2))));
  if (samples.length) {
    const table = element("div", "weather-hours");
    const header = element("div", "weather-hours__row weather-hours__row--header");
    [ui(currentLanguage, "time"), "°C", ui(currentLanguage, "rainChance"), "UV"].forEach((label) => header.append(textElement("span", "", label)));
    table.append(header);
    samples.forEach((point) => {
      const row = element("div", "weather-hours__row");
      row.append(
        textElement("span", "", point.time),
        textElement("span", "", `${formatNumber(point.temperature, 0)}°`),
        textElement("span", "", `${formatNumber(point.precipitationProbability, 0)}%`),
        textElement("span", "", formatNumber(point.uvIndex, 1))
      );
      table.append(row);
    });
    popover.append(table);
  }
  popover.append(textElement("p", "weather-popover__meta", `${ui(currentLanguage, "wind")} ${formatNumber(daily.windSpeedMax, 0)} km/h · ${ui(currentLanguage, "sunriseSunset")} ${formatForecastTime(daily.sunrise)}–${formatForecastTime(daily.sunset)}`));
  disclosure.append(summary, popover);
  return disclosure;
}

function dailyForecast(locationId, date) {
  const location = weatherForecastState.data?.locations?.[locationId];
  return location?.daily?.[date] || location?.[date] || null;
}

function hourlyForecast(locationId, date) {
  return weatherForecastState.data?.locations?.[locationId]?.hourly?.[date] || [];
}

function renderTravelLogistics() {
  const openBookingKeys = new Set([
    ...els.flights.querySelectorAll(".booking-disclosure[open]"),
    ...els.hotels.querySelectorAll(".booking-disclosure[open]")
  ].map((item) => item.dataset.bookingKey).filter(Boolean));

  els.flights.replaceChildren();
  getFlightBookings(currentLanguage).forEach((bookingTeam) => {
    const teamCard = element("details", "flight-team booking-disclosure");
    teamCard.dataset.bookingKey = `flight:${bookingTeam.travelers}`;
    teamCard.open = openBookingKeys.has(teamCard.dataset.bookingKey);
    const teamHeader = element("summary", "flight-team__header");
    const teamCopy = element("div", "flight-team__copy");
    teamCopy.append(
      textElement("span", "traveler-chip", bookingTeam.travelers),
      textElement("strong", "flight-team__title", bookingTeam.title),
      textElement("span", "booking-route-count", ui(currentLanguage, "segmentCount", { count: bookingTeam.segments.length }))
    );
    const teamStatus = element("span", "booking-summary-status");
    teamStatus.append(
      textElement("span", "status-chip status-chip--booked", ui(currentLanguage, "allBooked")),
      textElement("span", "summary-chevron", "⌄")
    );
    teamHeader.append(teamCopy, teamStatus);
    teamCard.append(teamHeader);

    const segments = element("div", "flight-segments");
    segments.append(textElement("p", "booking-team-note muted", bookingTeam.note));
    bookingTeam.segments.forEach((segment) => {
      const item = element("article", "flight-segment");
      const modeIcon = ({ flight: "✈", bus: "🚌", train: "🚄" })[segment.mode] || "•";
      const route = element("div", "flight-segment__route");
      route.append(
        textElement("span", "flight-segment__icon", modeIcon),
        textElement("h4", "flight-segment__title", segment.route)
      );
      item.append(
        route,
        textElement("p", "flight-segment__service", segment.service),
        textElement("p", "flight-segment__schedule", segment.schedule),
        textElement("p", "muted", segment.detail)
      );
      if (segment.baggage) {
        const baggage = element("p", "flight-segment__baggage");
        baggage.append(
          textElement("strong", "", `${ui(currentLanguage, "baggage")}: `),
          document.createTextNode(segment.baggage)
        );
        item.append(baggage);
      }
      const links = element("div", "resource-links");
      segment.links.forEach((destination) => links.append(externalAnchor(destination.label, destination.url)));
      item.append(links);
      segments.append(item);
    });
    teamCard.append(segments);
    els.flights.append(teamCard);
  });

  els.hotels.replaceChildren();
  (displayTrip.hotelAreas || []).forEach((area, areaIndex) => {
    const group = element("details", "hotel-group booking-disclosure");
    group.dataset.bookingKey = `hotel:${areaIndex}`;
    group.open = openBookingKeys.has(group.dataset.bookingKey);
    const header = element("summary", "hotel-group__header");
    const headerCopy = element("span", "hotel-group__header-copy");
    headerCopy.append(
      textElement("strong", "hotel-group__title", area.area),
      textElement("span", "muted", area.reason || "")
    );
    header.append(
      headerCopy,
      textElement("span", "summary-chevron", "⌄")
    );
    const hotelCards = element("div", "hotel-group__cards");
    group.append(header, hotelCards);
    (area.options || []).forEach((hotel, hotelIndex) => {
      const canonicalHotel = currentTrip.hotelAreas?.[areaIndex]?.options?.[hotelIndex] || hotel;
      const matchingSlot = findCanonicalLocation(canonicalHotel.name);
      const item = element("article", "compact-card compact-card--hotel");
      item.append(
        textElement("span", "status-chip", translateTier(hotel.tier)),
        textElement("h3", "compact-card__title", hotel.name),
        textElement("p", "compact-card__meta", hotel.priceRange || ""),
        textElement("p", "muted", hotel.note || "")
      );
      item.append(googleMapsAnchor({
        googleMapsKey: `hotel:${canonicalHotel.name}`,
        name: hotel.name,
        lat: matchingSlot?.lat,
        lng: matchingSlot?.lng,
        address: matchingSlot?.address || canonicalHotel.name
      }));
      hotelCards.append(item);
    });
    els.hotels.append(group);
  });

  els.disclaimer.textContent = displayTrip.disclaimer;
}

function renderDayNavigation() {
  const today = todayInTripISO();
  els.daysNav.replaceChildren(...displayTrip.days.map((day, index) => {
    const button = element("button", "day-link");
    button.type = "button";
    button.dataset.dayId = day.id;
    button.classList.toggle("is-active", day.id === activeDayId);
    button.classList.toggle("is-today", day.date === today);
    button.setAttribute("aria-pressed", String(day.id === activeDayId));
    button.setAttribute("aria-label", ui(currentLanguage, "chooseDay", {
      number: index + 1,
      date: formatDate(day.date, { dateStyle: "full" }),
      area: getDayArea(day.id, currentLanguage)
    }));
    const compactDate = element("strong", "day-link__date");
    compactDate.append(
      textElement("span", "day-link__weekday", formatDate(day.date, { weekday: "short" })),
      document.createTextNode(" · "),
      textElement("span", "day-link__month-day", formatDate(day.date, { month: "numeric", day: "numeric" }))
    );
    button.append(
      textElement("span", "day-link__number", ui(currentLanguage, "dayShort", { number: index + 1 })),
      compactDate,
      textElement("span", "day-link__area", getDayArea(day.id, currentLanguage))
    );
    if (day.date === today) button.append(textElement("span", "day-link__today", ui(currentLanguage, "today")));
    button.addEventListener("click", () => selectActiveDay(day.id));
    return button;
  }));

  requestAnimationFrame(() => {
    const active = els.daysNav.querySelector(".day-link.is-active");
    if (!active) return;
    const target = active.offsetLeft - (els.daysNav.clientWidth - active.offsetWidth) / 2;
    els.daysNav.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  });
}

function orderedDaySlots(day) {
  if (!day) return [];
  const slots = [...(day.slots || []), ...builtInBookingSlots(day.id)].filter(Boolean);
  const order = DAY_SLOT_ORDER[day.id] || [];
  const orderById = new Map(order.map((id, index) => [id, index]));
  const fixed = slots
    .filter((slot) => orderById.has(slot.id))
    .sort((a, b) => orderById.get(a.id) - orderById.get(b.id));
  const additions = slots
    .filter((slot) => !orderById.has(slot.id))
    .sort(compareSlotSchedule);
  additions.forEach((slot) => {
    const nextSlot = fixed.findIndex((candidate) => compareSlotSchedule(candidate, slot) > 0);
    fixed.splice(nextSlot < 0 ? fixed.length : nextSlot, 0, slot);
  });
  return fixed;
}

function compareSlotSchedule(first, second) {
  const firstOrder = Number(first?.sortOrder);
  const secondOrder = Number(second?.sortOrder);
  if (Number.isFinite(firstOrder) && Number.isFinite(secondOrder) && firstOrder !== secondOrder) {
    return firstOrder - secondOrder;
  }
  const periodRank = (slot) => ({ morning: 0, noon: 1, evening: 2 })[slot?.period] ?? 3;
  const periodDifference = periodRank(first) - periodRank(second);
  if (periodDifference) return periodDifference;
  const firstMinutes = slotStartMinutes(first?.sortTime || first?.time);
  const secondMinutes = slotStartMinutes(second?.sortTime || second?.time);
  if (firstMinutes === secondMinutes) return 0;
  return firstMinutes < secondMinutes ? -1 : 1;
}

function slotStartMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? (hours * 60) + minutes : Number.POSITIVE_INFINITY;
}

function builtInBookingSlots() {
  return [];
}

function findDisplaySlot(slotId) {
  for (const day of displayTrip.days || []) {
    const slot = (day.slots || []).find((candidate) => candidate.id === slotId);
    if (slot) return slot;
  }
  return null;
}

function flightBookingForSlot(slot) {
  if (!slot?.booking || normalizePlanType(slot.planType, slot) !== "flight") return null;
  return {
    team: { travelers: slot.participants || slot.travelers || "" },
    segment: {
      route: slot.booking.route || slot.name || "",
      service: slot.booking.service || slot.booking.code || "",
      schedule: slot.booking.schedule || slot.time || "",
      detail: slot.booking.detail || slot.review || "",
      baggage: slot.booking.baggage || "",
      links: Array.isArray(slot.booking.links) ? slot.booking.links : []
    }
  };
}

function hotelBookingForSlot(slot) {
  if (!slot?.booking || normalizePlanType(slot.planType, slot) !== "stay") return null;
  return {
    area: { area: slot.booking.area || slot.address || "" },
    hotel: { name: slot.name || "", note: slot.booking.detail || slot.notes || "" },
    travelers: slot.participants || slot.travelers || ""
  };
}

function normalizePlanType(value, slot = {}) {
  const explicit = String(value || "").trim().toLowerCase();
  if (PLAN_TYPE_SET.has(explicit)) return explicit;
  if (SLOT_PLAN_TYPES[slot.id]) return SLOT_PLAN_TYPES[slot.id];
  if (String(slot.id || "").startsWith("stay-")) return "stay";
  if (slot.hotelBookingSlotId) return "stay";

  const searchable = [slot.name, slot.transport?.mode, slot.review]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\b(flight|airline|airport|terminal)\b/.test(searchable)) return "flight";
  if (/\b(hotel|inn|stay|check[ -]?in|check[ -]?out|onsen)\b/.test(searchable)) return "stay";
  if (/\b(restaurant|dinner|lunch|omakase|sushi|yakiniku|ramen|café|cafe)\b/.test(searchable)) return "restaurant";
  if (/\b(rent(?:al)? car|toyota)\b/.test(searchable)) return "car";
  if (/\b(bus|train|shinkansen|tram|subway|transit|transfer)\b/.test(searchable)) return "transport";
  if (/\b(festival|gion|market event)\b/.test(searchable)) return "event";
  if (/\b(shop|shopping|mall|store)\b/.test(searchable)) return "shopping";
  if (/\b(boat|cruise|tour|class|experience)\b/.test(searchable)) return "activity";
  if (/\b(shrine|temple|gorge|observatory|cape|lake|park|museum|garden|island)\b/.test(searchable)) return "sight";
  return "other";
}

function planTypeLabel(type) {
  return ui(currentLanguage, ({
    flight: "planTypeFlight",
    stay: "planTypeStay",
    restaurant: "planTypeRestaurant",
    transport: "planTypeTransport",
    car: "planTypeCar",
    sight: "planTypeSight",
    activity: "planTypeActivity",
    event: "planTypeEvent",
    shopping: "planTypeShopping",
    other: "planTypeOther"
  })[type] || "planTypeOther");
}

function normalizeParticipantGroup(value) {
  const raw = (Array.isArray(value) ? value.join(" · ") : String(value || "")).trim();
  if (!raw || /^(?:everyone|all|全員|全员)$/i.test(raw)) return "";
  const groups = currentTrip.participantGroups || [];
  const direct = groups.find((group) => group.id === raw || group.label === raw);
  if (direct) return direct.label || (direct.members || []).join(" · ");
  const tokens = raw.split(/[·•,，、/／&+]/).map((token) => token.trim()).filter(Boolean);
  const matching = groups.find((group) => group.alwaysTogether !== false
    && (group.members || []).some((member) => tokens.includes(String(member))));
  return matching?.label || (matching?.members || []).join(" · ") || tokens.join(" · ");
}

function timelineParticipants(slot, flightBooking, hotelBooking) {
  const groups = currentTrip.participantGroups || [];
  const groupIds = Array.isArray(slot?.participantGroupIds) ? slot.participantGroupIds : [];
  if (groupIds.length && groups.length && groupIds.length >= groups.length) return "";
  const grouped = groupIds
    .map((id) => groups.find((group) => group.id === id))
    .filter(Boolean)
    .map((group) => group.label || (group.members || []).join(" · "))
    .filter(Boolean)
    .join(" · ");
  const explicit = grouped
    || flightBooking?.team?.travelers
    || hotelBooking?.travelers
    || slot?.participants
    || slot?.travelers;
  return normalizeParticipantGroup(explicit);
}

function canonicalTimelineTime(value) {
  return String(value || "").trim();
}

function normalizedPlaceName(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(?:the|restaurant|area|station|branch|option)\b/g, " ")
    .replace(/[^a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diningMatchesSlot(meal, slot) {
  const canonicalSlot = currentTrip.days
    .flatMap((day) => day.slots || [])
    .find((candidate) => candidate.id === slot?.id) || slot;
  if (normalizePlanType(canonicalSlot?.planType, canonicalSlot) !== "restaurant") return false;
  const mealName = normalizedPlaceName(meal?.place);
  const slotName = normalizedPlaceName(timelineSlotName(canonicalSlot));
  if (mealName.length < 4 || slotName.length < 4) return false;
  return slotName.includes(mealName) || mealName.includes(slotName);
}

function timelineSlotName(slot) {
  return slot?.name || "";
}

function renderItinerary() {
  const index = displayTrip.days.findIndex((day) => day.id === activeDayId);
  const day = displayTrip.days[index] || displayTrip.days[0];
  const renderedDayId = els.days.querySelector(".day-section")?.id || "";
  const preserveDisclosureState = Boolean(day && renderedDayId === day.id);
  const openSlotIds = preserveDisclosureState
    ? new Set([...els.days.querySelectorAll(".timeline-card[open]")]
      .map((card) => card.closest(".timeline-item")?.dataset.slotId)
      .filter(Boolean))
    : new Set();
  const diningOpen = preserveDisclosureState && Boolean(els.days.querySelector(".dining-disclosure[open]"));
  const guideOpen = preserveDisclosureState && Boolean(els.days.querySelector(".day-guide[open]"));

  els.days.replaceChildren(day ? renderDay(day, Math.max(0, index)) : textElement("p", "empty-state", ui(currentLanguage, "emptyDay")));

  if (!preserveDisclosureState) return;
  els.days.querySelectorAll(".timeline-item").forEach((item) => {
    const card = item.querySelector(".timeline-card");
    if (card && openSlotIds.has(item.dataset.slotId)) card.open = true;
  });
  const dining = els.days.querySelector(".dining-disclosure");
  const guide = els.days.querySelector(".day-guide");
  if (dining) dining.open = diningOpen;
  if (guide) guide.open = guideOpen;
}

function renderDay(day, index) {
  const section = element("section", "day-section");
  section.id = day.id;

  const heading = element("header", "day-heading");
  const headingCopy = element("div", "day-heading__copy");
  headingCopy.append(
    textElement("p", "eyebrow", ui(currentLanguage, "dayNumber", { number: index + 1, weekday: day.weekday || formatDate(day.date, { weekday: "long" }) })),
    textElement("h2", "day-heading__title", day.theme || formatDate(day.date, { month: "long", day: "numeric" })),
    textElement("p", "active-day-area", `${formatDate(day.date, { month: "long", day: "numeric" })} · ${getDayArea(day.id, currentLanguage)}`)
  );
  if (day.date === todayInTripISO()) headingCopy.append(textElement("span", "today-chip", ui(currentLanguage, "today")));
  const add = textElement("button", "button button--quiet", ui(currentLanguage, "addPlanButton"));
  add.type = "button";
  add.setAttribute("aria-label", ui(currentLanguage, "addToDate", { date: formatDate(day.date, { dateStyle: "full" }) }));
  add.addEventListener("click", () => openItemDialog(day.id));
  heading.append(headingCopy, add);
  section.append(heading);

  if (day.summary) section.append(textElement("p", "day-summary", day.summary));

  const timeline = element("div", "timeline");
  const timelineSlots = orderedDaySlots(day);
  timelineSlots.forEach((slot, slotIndex) => timeline.append(renderSlot(day, slot, slotIndex)));
  if (!timelineSlots.length) {
    timeline.append(textElement("p", "empty-state", ui(currentLanguage, "emptyDay")));
  }
  section.append(timeline);

  const visibleDining = Array.isArray(day.dining)
    ? day.dining
      .map((meal, index) => ({ meal, index }))
      .filter(({ meal, index: mealIndex }) => {
        const canonicalMeal = currentTrip.days
          .find((candidate) => candidate.id === day.id)?.dining?.[mealIndex] || meal;
        return !timelineSlots.some((slot) => diningMatchesSlot(canonicalMeal, slot));
      })
    : [];
  if (visibleDining.length) {
    const dining = element("details", "dining-row dining-disclosure");
    const diningSummary = element("summary", "dining-summary");
    diningSummary.append(
      textElement("strong", "", ui(currentLanguage, "foodNotes")),
      textElement("span", "count-chip", String(visibleDining.length)),
      textElement("span", "summary-chevron", "⌄")
    );
    dining.append(diningSummary);
    visibleDining.forEach(({ meal, index: mealIndex }) => {
      const canonicalMeal = currentTrip.days.find((candidate) => candidate.id === day.id)?.dining?.[mealIndex] || meal;
      const matchingSlot = findCanonicalLocation(canonicalMeal.place);
      const line = element("p", "dining-item");
      line.append(
        textElement("strong", "", `${meal.meal}${currentLanguage === "en" ? ": " : "："}${meal.place}`),
        document.createTextNode(meal.hours ? ` · ${meal.hours}` : "")
      );
      const dishes = (meal.dishes || []).map((dish) => `${dish.name}${dish.price ? ` ${dish.price}` : ""}`).join(" · ");
      if (dishes) line.append(textElement("span", "muted", ` — ${dishes}`));
      line.append(document.createTextNode(" "), googleMapsAnchor({
        googleMapsKey: `dining:${canonicalMeal.place}`,
        name: meal.place,
        lat: matchingSlot?.lat,
        lng: matchingSlot?.lng,
        address: matchingSlot?.address || canonicalMeal.place
      }));
      dining.append(line);
    });
    section.append(dining);
  }

  if (Array.isArray(day.tips) && day.tips.length) {
    section.append(textElement("p", "day-tip", day.tips.join(" · ")));
  }
  const guide = renderDayGuide(day);
  if (guide) section.append(guide);
  return section;
}

function renderSlot(day, slot, slotIndex) {
  const article = element("article", "timeline-item");
  article.dataset.slotId = slot.id;
  const flightBooking = flightBookingForSlot(slot);
  const hotelBooking = hotelBookingForSlot(slot);
  const travelers = timelineParticipants(slot, flightBooking, hotelBooking);
  article.classList.toggle("timeline-item--booking", Boolean(flightBooking || hotelBooking));
  const marker = textElement("div", "timeline-marker", String(slotIndex + 1));
  marker.setAttribute("aria-hidden", "true");

  const card = element("details", "timeline-card");
  const summary = element("summary", "timeline-card__summary");
  const photo = renderLocationPhoto(slot);
  const summaryCopy = element("div", "timeline-card__summary-copy");
  const labels = element("div", "timeline-card__labels");
  const scheduleRow = element("div", "timeline-card__schedule-row");
  const tagRow = element("div", "timeline-card__tag-row");
  const period = periodLabel(slot.period);
  const time = canonicalTimelineTime(slot.time, slot.id) || ui(currentLanguage, "flexible");
  scheduleRow.append(textElement("span", "period-chip", period));
  if (normalizedLabel(time) !== normalizedLabel(period)) {
    scheduleRow.append(textElement("span", "time-label", time));
  }
  const planType = normalizePlanType(slot.planType, slot);
  tagRow.append(textElement("span", `plan-type-chip plan-type-chip--${planType}`, planTypeLabel(planType)));
  if (travelers) tagRow.append(textElement("span", "traveler-chip timeline-traveler-chip", travelers));
  if (slot.booked) tagRow.append(textElement("span", "status-chip status-chip--booked", ui(currentLanguage, "booked")));
  if (slot.alternative) tagRow.append(textElement("span", "status-chip", ui(currentLanguage, "chooseOne")));
  if (slot.approximateLocation) tagRow.append(textElement("span", "status-chip", ui(currentLanguage, "approximatePin")));
  if (slot.rating) tagRow.append(textElement("span", "rating-chip", `★ ${slot.rating}`));
  labels.append(scheduleRow, tagRow);
  const slotName = timelineSlotName(slot);
  summaryCopy.append(labels, textElement("h3", "timeline-card__title", slotName));
  summary.append(photo, summaryCopy, textElement("span", "timeline-card__chevron", "⌄"));

  const body = element("div", "timeline-card__body");
  if (slot.review) body.append(textElement("p", "timeline-card__review", slot.review));

  const meta = [
    slot.address,
    slot.openingHours && !slot.hideOpeningHours
      ? ui(currentLanguage, "hoursLabel", { value: slot.openingHours })
      : "",
    slot.seasonal ? ui(currentLanguage, "eventLabel", { value: slot.seasonal }) : "",
    slot.ticketPrice ? ui(currentLanguage, "referenceLabel", { value: slot.ticketPrice }) : "",
    slot.transport?.mode ? ui(currentLanguage, "nextLabel", { value: `${slot.transport.mode}${slot.transport.duration ? ` · ${slot.transport.duration}` : ""}` }) : ""
  ].filter(Boolean);
  if (meta.length) {
    const list = element("ul", "meta-list");
    meta.forEach((item) => list.append(textElement("li", "", item)));
    body.append(list);
  }
  if (slot.notes) body.append(textElement("p", "note-line", slot.notes));
  const bookingDetails = renderTimelineBookingDetails(flightBooking, hotelBooking);
  if (bookingDetails) body.append(bookingDetails);
  const actions = element("div", "timeline-card__actions");
  actions.append(googleMapsAnchor(slot));
  if (!slot.syntheticBooking) {
    const edit = textElement("button", "icon-button", ui(currentLanguage, "edit"));
    edit.type = "button";
    edit.setAttribute("aria-label", `${ui(currentLanguage, "editPlan")}: ${slotName}`);
    edit.addEventListener("click", () => openItemDialog(day.id, slot.id));
    actions.append(edit);
  }
  body.append(actions);
  if (slot.needsBooking && !slot.booked) {
    const reminder = element("div", "booking-reminder");
    const leadDays = Number(slot.leadDays);
    const safeLeadDays = Number.isFinite(leadDays) ? Math.min(365, Math.max(0, Math.round(leadDays))) : 0;
    reminder.append(textElement("span", "reminder-badge", ui(currentLanguage, "bookAhead", { count: safeLeadDays })));
    body.append(reminder);
  }

  card.append(summary, body);
  card.addEventListener("toggle", () => {
    if (card.open && Number.isFinite(slot.lat) && Number.isFinite(slot.lng) && mapInstance) {
      focusMapPoint(slot.lat, slot.lng, 13);
    }
  });
  article.append(marker, card);
  return article;
}

function renderTimelineBookingDetails(flightBooking, hotelBooking) {
  if (!flightBooking && !hotelBooking) return null;
  const panel = element("div", "timeline-booking-details");

  if (flightBooking) {
    const { segment } = flightBooking;
    if (segment.baggage) {
      const baggage = element("p", "timeline-booking-details__baggage");
      baggage.append(
        textElement("strong", "", `${ui(currentLanguage, "baggage")}: `),
        document.createTextNode(segment.baggage)
      );
      panel.append(baggage);
    }
    const links = element("div", "resource-links");
    segment.links.forEach((destination) => links.append(externalAnchor(destination.label, destination.url)));
    if (links.childNodes.length) panel.append(links);
  }

  if (hotelBooking) {
    panel.append(textElement("p", "muted", hotelBooking.area.area));
  }
  return panel.childNodes.length ? panel : null;
}

function isItinerarySheetActive() {
  return document.documentElement.classList.contains("is-itinerary-view");
}

function clampItinerarySheetTop(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function itinerarySheetSnapPoints() {
  const workspaceRect = els.planWorkspace?.getBoundingClientRect();
  const workspaceHeight = Math.max(1, workspaceRect?.height || window.innerHeight || 1);
  const shortLandscape = window.matchMedia("(max-height: 500px) and (pointer: coarse)").matches
    || (workspaceRect && workspaceRect.width > workspaceHeight && workspaceHeight <= 500);
  const viewportHeights = [
    Number(window.innerHeight),
    Number(window.visualViewport?.height),
    Number(document.documentElement.clientHeight)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const referenceHeight = Math.min(workspaceHeight, ...(viewportHeights.length ? viewportHeights : [workspaceHeight]));
  const handleHeight = els.itinerarySheetHandle?.getBoundingClientRect().height || 32;
  const daysHeight = els.daysNav?.parentElement?.getBoundingClientRect().height || 80;
  const minimumSheetHeight = Math.min(
    workspaceHeight,
    Math.max(shortLandscape ? 145 : 220, handleHeight + daysHeight + (shortLandscape ? 34 : 96))
  );
  const maximumTop = Math.max(0, workspaceHeight - minimumSheetHeight);
  const itineraryTop = Math.min(maximumTop, Math.round(referenceHeight * (shortLandscape ? 0.4 : 0.33)));
  const balancedTop = Math.min(maximumTop, Math.max(itineraryTop, Math.round(referenceHeight * 0.5)));
  const mapTop = Math.min(maximumTop, Math.max(balancedTop, Math.round(referenceHeight * (shortLandscape ? 0.6 : 0.68))));

  return [
    { mode: "itinerary", top: itineraryTop },
    { mode: "balanced", top: balancedTop },
    { mode: "map", top: mapTop }
  ];
}

function closestItinerarySheetSnap(top, points = itinerarySheetSnapPoints()) {
  return points.reduce((closest, point) => (
    Math.abs(point.top - top) < Math.abs(closest.top - top) ? point : closest
  ), points[0]);
}

function itinerarySheetModeLabel(mode) {
  const key = {
    itinerary: "sheetItineraryView",
    balanced: "sheetBalancedView",
    map: "sheetMapView"
  }[mode] || "sheetItineraryView";
  return ui(currentLanguage, key);
}

function updateItinerarySheetHandle(top, mode = itinerarySheetMode) {
  if (!els.itinerarySheetHandle || !els.planWorkspace) return;
  const workspaceHeight = Math.max(1, els.planWorkspace.getBoundingClientRect().height || 1);
  const points = itinerarySheetSnapPoints();
  const currentTop = Number.isFinite(top)
    ? top
    : (closestItinerarySheetSnap(
      els.itinerarySheet.getBoundingClientRect().top - els.planWorkspace.getBoundingClientRect().top,
      points
    ).top);
  els.itinerarySheetHandle.setAttribute("aria-valuemin", String(Math.round((points[0].top / workspaceHeight) * 100)));
  els.itinerarySheetHandle.setAttribute("aria-valuemax", String(Math.round((points.at(-1).top / workspaceHeight) * 100)));
  els.itinerarySheetHandle.setAttribute("aria-valuenow", String(Math.round((currentTop / workspaceHeight) * 100)));
  els.itinerarySheetHandle.setAttribute("aria-valuetext", itinerarySheetModeLabel(mode));
  els.itinerarySheetHandle.dataset.sheetMode = mode;
}

function applyItinerarySheetTop(top, mode = itinerarySheetMode) {
  if (!els.planWorkspace) return;
  const roundedTop = Math.round(top);
  els.planWorkspace.style.setProperty("--itinerary-sheet-top", `${roundedTop}px`);
  updateItinerarySheetHandle(roundedTop, mode);
}

function flushItinerarySheetTop() {
  if (itinerarySheetPositionFrame) cancelAnimationFrame(itinerarySheetPositionFrame);
  itinerarySheetPositionFrame = null;
  if (!Number.isFinite(pendingItinerarySheetTop)) return;
  const top = pendingItinerarySheetTop;
  pendingItinerarySheetTop = null;
  const nearest = closestItinerarySheetSnap(top);
  applyItinerarySheetTop(top, nearest.mode);
}

function queueItinerarySheetTop(top) {
  pendingItinerarySheetTop = top;
  if (itinerarySheetPositionFrame) return;
  itinerarySheetPositionFrame = requestAnimationFrame(() => {
    itinerarySheetPositionFrame = null;
    if (!Number.isFinite(pendingItinerarySheetTop)) return;
    const nextTop = pendingItinerarySheetTop;
    pendingItinerarySheetTop = null;
    const nearest = closestItinerarySheetSnap(nextTop);
    applyItinerarySheetTop(nextTop, nearest.mode);
  });
}

function refreshMapForItinerarySheet() {
  if (!isItinerarySheetActive() || !mapInstance || !window.L) return;
  const insets = mapFrameInsets();
  mapInstance.eachLayer((layer) => {
    const popup = typeof layer.getPopup === "function" ? layer.getPopup() : null;
    if (!popup) return;
    popup.options.autoPanPaddingTopLeft = window.L.point(insets.left, insets.top);
    popup.options.autoPanPaddingBottomRight = window.L.point(insets.right, insets.bottom);
  });
  frameMapToPoints(currentMapPoints, false);
}

function scheduleItinerarySheetMapFrame(delay = 260) {
  clearTimeout(itinerarySheetFrameTimer);
  itinerarySheetFrameTimer = setTimeout(() => {
    itinerarySheetFrameTimer = null;
    requestAnimationFrame(refreshMapForItinerarySheet);
  }, delay);
}

function applyItinerarySheetMode(mode, { reframe = true } = {}) {
  const points = itinerarySheetSnapPoints();
  const target = points.find((point) => point.mode === mode) || points[0];
  itinerarySheetMode = target.mode;
  applyItinerarySheetTop(target.top, target.mode);
  if (reframe) scheduleItinerarySheetMapFrame();
}

function syncItinerarySheetPosition({ reframe = true } = {}) {
  if (!isItinerarySheetActive()) return;
  applyItinerarySheetMode(itinerarySheetMode, { reframe });
}

function finishItinerarySheetDrag(event, { cancelled = false } = {}) {
  const drag = itinerarySheetDrag;
  if (!drag || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
  itinerarySheetDrag = null;
  flushItinerarySheetTop();
  document.documentElement.classList.remove("is-sheet-dragging");
  try {
    if (els.itinerarySheetHandle.hasPointerCapture?.(drag.pointerId)) {
      els.itinerarySheetHandle.releasePointerCapture(drag.pointerId);
    }
  } catch {
    // The capture may already have been released by iOS after an interrupted gesture.
  }

  if (!drag.moved) {
    updateItinerarySheetHandle(drag.startTop, itinerarySheetMode);
    return;
  }

  const points = itinerarySheetSnapPoints();
  let targetIndex = points.indexOf(closestItinerarySheetSnap(drag.currentTop, points));
  const recentVelocity = !cancelled && performance.now() - drag.lastTime <= 120 ? drag.velocity : 0;
  if (Math.abs(recentVelocity) >= 0.45) {
    targetIndex = clampItinerarySheetTop(targetIndex + (recentVelocity > 0 ? 1 : -1), 0, points.length - 1);
  }
  const target = points[targetIndex];
  void els.itinerarySheet.offsetTop;
  requestAnimationFrame(() => applyItinerarySheetMode(target.mode));
}

function setupItinerarySheetInteractions() {
  const handle = els.itinerarySheetHandle;
  if (!handle) return;

  handle.addEventListener("pointerdown", (event) => {
    if (!isItinerarySheetActive() || event.isPrimary === false) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const workspaceRect = els.planWorkspace.getBoundingClientRect();
    const currentTop = clampItinerarySheetTop(
      els.itinerarySheet.getBoundingClientRect().top - workspaceRect.top,
      itinerarySheetSnapPoints()[0].top,
      itinerarySheetSnapPoints().at(-1).top
    );
    itinerarySheetDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: currentTop,
      currentTop,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      moved: false
    };
    document.documentElement.classList.add("is-sheet-dragging");
    handle.focus({ preventScroll: true });
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; touch-action still isolates the handle gesture.
    }
  });

  const handlePointerMove = (event) => {
    const drag = itinerarySheetDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < ITINERARY_SHEET_DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    const points = itinerarySheetSnapPoints();
    const top = clampItinerarySheetTop(
      drag.startTop + deltaY,
      points[0].top,
      points.at(-1).top
    );
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    const instantaneousVelocity = (event.clientY - drag.lastY) / elapsed;
    drag.velocity = (drag.velocity * 0.65) + (instantaneousVelocity * 0.35);
    drag.lastY = event.clientY;
    drag.lastTime = now;
    drag.currentTop = top;
    queueItinerarySheetTop(top);
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", (event) => finishItinerarySheetDrag(event));
  window.addEventListener("pointercancel", (event) => finishItinerarySheetDrag(event, { cancelled: true }));
  handle.addEventListener("lostpointercapture", (event) => finishItinerarySheetDrag(event, { cancelled: true }));
  window.addEventListener("blur", () => finishItinerarySheetDrag(undefined, { cancelled: true }));
  handle.addEventListener("keydown", (event) => {
    if (!isItinerarySheetActive()) return;
    let targetIndex = ITINERARY_SHEET_MODES.indexOf(itinerarySheetMode);
    if (["ArrowUp", "PageUp"].includes(event.key)) targetIndex -= 1;
    else if (["ArrowDown", "PageDown"].includes(event.key)) targetIndex += 1;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = ITINERARY_SHEET_MODES.length - 1;
    else return;
    event.preventDefault();
    targetIndex = clampItinerarySheetTop(targetIndex, 0, ITINERARY_SHEET_MODES.length - 1);
    applyItinerarySheetMode(ITINERARY_SHEET_MODES[targetIndex]);
  });
  els.itinerarySheet.addEventListener("transitionend", (event) => {
    if (event.target !== els.itinerarySheet || event.propertyName !== "top") return;
    clearTimeout(itinerarySheetFrameTimer);
    itinerarySheetFrameTimer = null;
    refreshMapForItinerarySheet();
  });

  requestAnimationFrame(() => syncItinerarySheetPosition({ reframe: false }));
}

function mapFrameInsets() {
  const isPlanner = document.documentElement.classList.contains("is-itinerary-view");
  if (!isPlanner) return { top: 30, right: 30, bottom: 30, left: 30 };
  const sheet = document.querySelector(".itinerary-sheet");
  const mapElement = document.getElementById("map");
  const mapHeading = document.querySelector(".map-heading");
  if (!sheet || !mapElement) return { top: 24, right: 20, bottom: 24, left: 20 };
  const mapRect = mapElement.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();
  const headingRect = mapHeading?.getBoundingClientRect();
  const top = Math.max(24, Math.round((headingRect?.bottom || mapRect.top) - mapRect.top + 12));
  const sheetOverlap = Math.max(0, mapRect.bottom - Math.max(mapRect.top, sheetRect.top));
  const maxBottom = Math.max(24, Math.round(mapRect.height - top - 72));
  const bottom = Math.min(maxBottom, Math.max(24, Math.round(sheetOverlap + 20)));
  return { top, right: 20, bottom, left: 20 };
}

function mapFitBoundsOptions(animate = false) {
  const insets = mapFrameInsets();
  return {
    paddingTopLeft: [insets.left, insets.top],
    paddingBottomRight: [insets.right, insets.bottom],
    maxZoom: document.documentElement.classList.contains("is-itinerary-view") ? 11 : 13,
    animate
  };
}

function centerMapPointInVisibleArea(lat, lng, zoom, animate = false) {
  if (!mapInstance || !window.L) return;
  const insets = mapFrameInsets();
  const projected = mapInstance.project([lat, lng], zoom);
  const adjustedCenter = projected.add(window.L.point(0, (insets.bottom - insets.top) / 2));
  mapInstance.stop();
  mapInstance.setView(mapInstance.unproject(adjustedCenter, zoom), zoom, { animate });
}

function frameMapToPoints(points = currentMapPoints, animate = false) {
  if (!mapInstance || !window.L || !points.length) return;
  if (points.length === 1) {
    const zoom = document.documentElement.classList.contains("is-itinerary-view") ? 11 : 12;
    centerMapPointInVisibleArea(points[0].lat, points[0].lng, zoom, animate);
    return;
  }
  mapInstance.stop();
  mapInstance.fitBounds(
    window.L.latLngBounds(points.map((point) => [point.lat, point.lng])),
    mapFitBoundsOptions(animate)
  );
}

function focusMapPoint(lat, lng, zoom = 13) {
  if (!mapInstance) return;
  const targetZoom = document.documentElement.classList.contains("is-itinerary-view")
    ? 11
    : Math.min(13, Math.max(12, zoom));
  centerMapPointInVisibleArea(lat, lng, targetZoom, true);
}

function renderLocationPhoto(slot) {
  const record = getPlacePhoto(slot.photoSourceId || slot.id);
  const slotPhoto = typeof slot.photo === "string" ? slot.photo : slot.photo?.url;
  const url = slotPhoto || record?.url;
  const frame = element("div", "location-photo");
  frame.append(textElement("span", "location-photo__fallback", slot.name));
  if (!url) return frame;

  const image = document.createElement("img");
  image.src = url;
  image.alt = ui(currentLanguage, "representativePhoto", { name: slot.name });
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove());
  frame.append(image);
  return frame;
}

function renderDayGuide(day) {
  const guide = getDayGuide(day.id, currentLanguage);
  const restaurants = Array.isArray(guide.restaurants) ? guide.restaurants : [];
  const extras = Array.isArray(guide.extras) ? guide.extras : [];
  if (!guide.note && !restaurants.length && !extras.length) return null;

  const disclosure = element("details", "day-guide");
  const summary = element("summary", "day-guide__summary");
  const summaryCopy = element("span", "day-guide__summary-copy");
  summaryCopy.append(
    textElement("span", "eyebrow", ui(currentLanguage, "nearbyIdeas")),
    textElement("strong", "", ui(currentLanguage, "eatSeeDoMore"))
  );
  summary.append(
    summaryCopy,
    textElement("span", "count-chip", ui(currentLanguage, "ideaCount", { count: restaurants.length + extras.length })),
    textElement("span", "summary-chevron", "⌄")
  );
  disclosure.append(summary);

  const body = element("div", "day-guide__body");
  if (guide.note) body.append(textElement("p", "guide-note", guide.note));
  if (restaurants.length) {
    const section = element("section", "guide-section");
    section.append(textElement("h3", "guide-section__title", ui(currentLanguage, "additionalRestaurants")));
    const grid = element("div", "recommendation-grid");
    restaurants.forEach((restaurant) => grid.append(renderRecommendationCard(restaurant, true)));
    section.append(grid);
    body.append(section);
  }

  if (extras.length) {
    const section = element("section", "guide-section");
    section.append(textElement("h3", "guide-section__title", ui(currentLanguage, "famousNearby")));
    const grid = element("div", "recommendation-grid recommendation-grid--extras");
    extras.forEach((item) => grid.append(renderRecommendationCard(item, false)));
    section.append(grid);
    body.append(section);
  }

  disclosure.append(body);
  return disclosure;
}

function renderRecommendationCard(item, isRestaurant) {
  const card = element("article", "recommendation-card");
  const media = renderRecommendationPhoto(item);
  if (media) card.append(media);
  const categories = isRestaurant
    ? ["restaurant"]
    : (Array.isArray(item.categories) && item.categories.length ? item.categories : [item.category]).filter(Boolean);
  let categoryLabel = categories
    .map((category) => `${recommendationIcon(category)} ${recommendationCategory(category)}`)
    .join(" · ");
  if (item.categoryLabel) categoryLabel = `${categoryLabel} · ${item.categoryLabel}`;
  card.append(
    textElement("p", "recommendation-card__category", categoryLabel),
    textElement("h4", "recommendation-card__title", item.name),
    textElement("p", "recommendation-card__description", item.description || "")
  );

  const ratings = element("div", "recommendation-ratings");
  if (item.tabelogRating) ratings.append(textElement("span", "rating-chip rating-chip--tabelog", `食べログ ${item.tabelogRating}`));
  if (item.googleRating) ratings.append(textElement("span", "rating-chip", `Google ${item.googleRating}`));
  if (item.reviewCount) ratings.append(textElement("span", "muted", ui(currentLanguage, "reviewCount", { count: item.reviewCount })));
  if (ratings.childNodes.length) card.append(ratings);

  const links = element("div", "resource-links");
  if (item.mapsUrl) links.append(externalAnchor(ui(currentLanguage, "openGoogleMaps"), item.mapsUrl));
  if (item.tabelogUrl) links.append(externalAnchor(ui(currentLanguage, "openTabelog"), item.tabelogUrl));
  if (item.sourceUrl && !item.tabelogUrl) links.append(externalAnchor(ui(currentLanguage, "officialDetails"), item.sourceUrl));
  if (links.childNodes.length) card.append(links);
  return card;
}

function renderRecommendationPhoto(item) {
  const photoRecord = item?.photo;
  const photoUrl = typeof photoRecord === "string" ? photoRecord : photoRecord?.url;
  if (!photoUrl) return null;

  const media = element("div", "recommendation-card__media");
  const fallback = textElement("span", "recommendation-card__photo-fallback", item.name);
  fallback.setAttribute("aria-hidden", "true");
  media.append(fallback);

  const image = document.createElement("img");
  image.src = photoUrl;
  image.alt = ui(currentLanguage, "representativePhoto", { name: item.name });
  image.loading = "lazy";
  image.decoding = "async";
  image.fetchPriority = "low";
  if (photoRecord?.position) image.style.objectPosition = photoRecord.position;
  image.addEventListener("error", () => image.remove());
  media.append(image);

  return media;
}

function recommendationCategory(category) {
  return ui(currentLanguage, ({
    restaurant: "categoryRestaurant",
    eat: "categoryEat",
    snack: "categorySnack",
    do: "categoryDo",
    see: "categorySee",
    buy: "categoryBuy",
    go: "categoryGo"
  })[category] || "nearbyIdeas");
}

function recommendationIcon(category) {
  return ({ restaurant: "🍽️", eat: "🥢", snack: "🍡", do: "🎟️", see: "👀", buy: "🛍️", go: "📍" })[category] || "✦";
}

function renderTips() {
  els.tips.replaceChildren(...(displayTrip.tips || []).map((tip) => textElement("li", "", tip)));
}

function renderCredits() {
  const day = displayTrip.days.find((candidate) => candidate.id === activeDayId);
  const credits = new Map();
  const addPhotoCredit = (record, name) => {
    if (!record?.sourceUrl || !record?.credit || /\b(?:CC0|public domain)\b/i.test(record.credit)) return;
    if (!credits.has(record.sourceUrl)) credits.set(record.sourceUrl, `${name} — ${record.credit}`);
  };

  orderedDaySlots(day).forEach((slot) => {
    addPhotoCredit(getPlacePhoto(slot.photoSourceId || slot.id), timelineSlotName(slot));
  });

  const guide = day ? getDayGuide(day.id, currentLanguage) : null;
  [...(guide?.restaurants || []), ...(guide?.extras || [])].forEach((item) => {
    if (item?.photo && typeof item.photo === "object") addPhotoCredit(item.photo, item.name);
  });

  els.credits.replaceChildren(
    externalAnchor(ui(currentLanguage, "weatherDataBy"), "https://open-meteo.com/en/license", "footer-credit-link"),
    ...[...credits].map(([url, label]) => externalAnchor(label, url, "footer-credit-link"))
  );
  els.credits.closest("details").hidden = false;
}

function renderMap(attempt = 0) {
  if (!window.L || typeof initTravelMap !== "function") {
    if (attempt < 20) {
      setTimeout(() => renderMap(attempt + 1), 250);
    } else {
      els.mapOffline.textContent = ui(currentLanguage, "mapLoadError");
      els.mapOffline.hidden = false;
    }
    return;
  }

  const dayIndex = displayTrip.days.findIndex((day) => day.id === activeDayId);
  const day = displayTrip.days[dayIndex] || displayTrip.days[0];
  const points = orderedDaySlots(day)
    .map((slot, timelineIndex) => ({
      id: slot.id,
      number: timelineIndex + 1,
      lat: slot.lat,
      lng: slot.lng,
      name: timelineSlotName(slot),
      time: slot.time,
      routeGroup: slot.routeGroup || "shared-route",
      googleMapsUrl: googleMapsUrl(slot)
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  currentMapPoints = points;

  els.mapTitle.textContent = day ? getDayArea(day.id, currentLanguage) : ui(currentLanguage, "route");
  els.mapDayLabel.textContent = day
    ? `${ui(currentLanguage, "dayShort", { number: Math.max(1, dayIndex + 1) })} · ${formatDate(day.date, { weekday: "short", month: "short", day: "numeric" })}`
    : ui(currentLanguage, "activeDayRoute");

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  if (points.length) {
    mapInstance = initTravelMap("map", points, {
      googleMapsLabel: ui(currentLanguage, "openGoogleMaps"),
      zoomInTitle: ui(currentLanguage, "zoomIn"),
      zoomOutTitle: ui(currentLanguage, "zoomOut"),
      onPointClick: handleMapPointClick,
      fitBoundsOptions: mapFitBoundsOptions(false),
      singlePointZoom: document.documentElement.classList.contains("is-itinerary-view") ? 11 : 12
    });
    requestAnimationFrame(() => {
      mapInstance?.invalidateSize();
      frameMapToPoints(points, false);
    });
  }
  els.mapOffline.hidden = navigator.onLine;
}

function handleMapPointClick(point) {
  if (!point?.id) return;
  const item = [...els.days.querySelectorAll(".timeline-item")]
    .find((candidate) => candidate.dataset.slotId === point.id);
  if (!item) return;
  els.days.querySelectorAll(".timeline-item.is-map-selected")
    .forEach((candidate) => candidate.classList.remove("is-map-selected"));
  item.classList.add("is-map-selected");
  const card = item.querySelector(".timeline-card");
  if (card) card.open = true;
  if (document.documentElement.classList.contains("is-itinerary-view")) {
    const panelRect = els.itineraryPanel.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const target = Math.max(0, els.itineraryPanel.scrollTop + itemRect.top - panelRect.top - 12);
    els.itineraryPanel.scrollTo({ top: target, behavior: "smooth" });
  } else {
    item.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function isItineraryViewRequested() {
  try {
    return new URL(window.location.href).searchParams.get("view") === "plan";
  } catch {
    return false;
  }
}

function syncItineraryViewClass() {
  const active = itineraryViewMedia.matches && isItineraryViewRequested();
  document.documentElement.classList.toggle("is-itinerary-view", active);
  document.body.classList.toggle("is-itinerary-view", active);
  if (!active) {
    document.documentElement.classList.remove("is-sheet-dragging");
    itinerarySheetDrag = null;
  }
  return active;
}

function closeItineraryView() {
  if (window.history.state?.itineraryView) {
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  syncItineraryViewClass();
  requestAnimationFrame(() => renderMap());
}

function setupInteractionHandlers() {
  document.documentElement.classList.toggle("is-standalone", isStandaloneApp());
  document.documentElement.classList.toggle("is-ios", isIosDevice());
  syncStandaloneCanvasMetrics();
  setupItinerarySheetInteractions();
  els.language.value = currentLanguage;
  els.planLanguage.value = currentLanguage;
  els.language.addEventListener("change", () => switchLanguage(els.language.value));
  els.planLanguage.addEventListener("change", () => switchLanguage(els.planLanguage.value));
  els.openPlanView.addEventListener("click", (event) => {
    if (!itineraryViewMedia.matches) return;
    event.preventDefault();
    const url = new URL(window.location.href);
    const day = currentTrip.days.find((candidate) => candidate.id === activeDayId);
    url.searchParams.set("view", "plan");
    if (day?.date) url.searchParams.set("day", day.date);
    window.history.pushState({ ...(window.history.state || {}), itineraryView: true }, "", `${url.pathname}${url.search}${url.hash}`);
    syncItineraryViewClass();
    requestAnimationFrame(() => {
      syncItinerarySheetPosition({ reframe: false });
      renderMap();
      els.itineraryPanel.scrollTop = 0;
    });
  });
  els.closePlanView.addEventListener("click", closeItineraryView);
  window.addEventListener("popstate", () => {
    syncItineraryViewClass();
    requestAnimationFrame(() => {
      syncItinerarySheetPosition({ reframe: false });
      renderMap();
    });
  });
  itineraryViewMedia.addEventListener("change", () => {
    syncItineraryViewClass();
    requestAnimationFrame(() => {
      syncItinerarySheetPosition({ reframe: false });
      renderMap();
    });
  });
  const refreshMapGeometry = () => {
    clearTimeout(mapResizeTimer);
    mapResizeTimer = setTimeout(() => requestAnimationFrame(() => {
      syncItinerarySheetPosition({ reframe: false });
      mapInstance?.invalidateSize();
      frameMapToPoints(currentMapPoints, false);
    }), 120);
  };
  window.addEventListener("orientationchange", () => {
    requestAnimationFrame(() => {
      syncStandaloneCanvasMetrics();
      syncItinerarySheetPosition({ reframe: false });
      renderMap();
    });
    setTimeout(() => {
      syncStandaloneCanvasMetrics();
      syncItinerarySheetPosition();
    }, 250);
  });
  window.addEventListener("pageshow", () => {
    syncStandaloneCanvasMetrics();
    syncItinerarySheetPosition();
  });
  window.visualViewport?.addEventListener("resize", refreshMapGeometry);
  window.addEventListener("resize", refreshMapGeometry);
  window.addEventListener("storage", (event) => {
    if (event.key === languageStorageKey() && event.newValue && event.newValue !== currentLanguage) {
      switchLanguage(event.newValue, false);
    }
  });

  window.addEventListener("online", () => {
    els.mapOffline.hidden = true;
    setSyncStatus(syncReady && !currentSourceIsCache ? "online" : "syncing", "working");
    refreshWeatherForecast({ force: false });
  });
  window.addEventListener("offline", () => {
    syncReady = false;
    els.mapOffline.hidden = false;
    setSyncStatus("savedOffline", "offline");
  });
  const refreshWeatherOnResume = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      refreshWeatherForecast({ force: false });
    }
  };
  document.addEventListener("visibilitychange", refreshWeatherOnResume);
  window.addEventListener("pageshow", refreshWeatherOnResume);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (!isStandaloneApp()) els.install.hidden = false;
  });
  els.install.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.install.hidden = true;
      return;
    }
    if (isIosDevice() && !isStandaloneApp()) els.installDialog.showModal();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.install.hidden = true;
  });
  document.querySelectorAll("[data-close-install-dialog]").forEach((button) => {
    button.addEventListener("click", () => els.installDialog.close());
  });
  els.installDialog.addEventListener("click", (event) => {
    if (event.target === els.installDialog) els.installDialog.close();
  });

  if (isIosDevice() && !isStandaloneApp()) {
    els.install.dataset.installMethod = "ios";
    els.install.hidden = false;
  } else if (isStandaloneApp()) {
    els.install.hidden = true;
  }

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => els.dialog.close());
  });
  document.querySelectorAll("[data-close-todo-dialog]").forEach((button) => {
    button.addEventListener("click", () => els.todoDialog.close());
  });
  els.addReminder.addEventListener("click", () => openTodoDialog());
  const googleMapsInput = els.form.elements.googleMapsUrl;
  googleMapsInput.addEventListener("input", () => updateGoogleMapsLinkState());
  googleMapsInput.addEventListener("blur", () => updateGoogleMapsLinkState({ showError: true }));
  googleMapsInput.addEventListener("invalid", () => updateGoogleMapsLinkState({ showError: true }));
  els.form.addEventListener("submit", handleItemSubmit);
  els.deleteItem.addEventListener("click", handleItemDelete);
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) els.dialog.close();
  });
  els.todoForm.addEventListener("submit", handleTodoSubmit);
  els.deleteReminder.addEventListener("click", handleTodoDelete);
  els.todoDialog.addEventListener("click", (event) => {
    if (event.target === els.todoDialog) els.todoDialog.close();
  });
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function syncStandaloneCanvasMetrics() {
  const extensionProperty = "--standalone-canvas-extension";
  const heightProperty = "--standalone-canvas-height";
  const root = document.documentElement;
  if (!isStandaloneApp()) {
    root.style.removeProperty(extensionProperty);
    root.style.removeProperty(heightProperty);
    return;
  }

  const screenWidth = Number(window.screen?.width);
  const screenHeight = Number(window.screen?.height);
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  const screenCanvasHeight = Number.isFinite(screenWidth) && Number.isFinite(screenHeight)
    ? (portrait ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight))
    : 0;
  const viewportHeights = [
    Number(window.innerHeight),
    Number(window.visualViewport?.height),
    Number(document.documentElement.clientHeight)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const fixedViewportHeight = Math.min(...viewportHeights);
  const fullCanvasHeight = [
    fixedViewportHeight,
    screenCanvasHeight,
    Number(window.innerHeight),
    Number(window.outerHeight)
  ]
    .filter((value) => Number.isFinite(value)
      && value >= fixedViewportHeight
      && value - fixedViewportHeight <= 120)
    .reduce((largest, value) => Math.max(largest, value), fixedViewportHeight);
  const missingCanvas = Math.round(fullCanvasHeight - fixedViewportHeight);
  const extension = Math.min(120, Math.max(0, missingCanvas));
  const canvasHeight = Math.round(fixedViewportHeight + extension);

  if (extension >= 2) {
    root.style.setProperty(heightProperty, `${canvasHeight}px`);
    root.style.setProperty(extensionProperty, `${extension}px`);
  } else {
    root.style.removeProperty(heightProperty);
    root.style.removeProperty(extensionProperty);
  }
}

function openTodoDialog(reminderId = "") {
  const reminder = currentTrip.reminders.find((candidate) => candidate.id === reminderId);
  const displayReminder = displayTrip.reminders.find((candidate) => candidate.id === reminderId);
  const itemInput = els.todoForm.elements.namedItem("item");
  els.todoForm.reset();
  els.todoForm.elements.reminderId.value = reminderId;
  els.todoDialogTitle.textContent = ui(currentLanguage, reminder ? "editTodo" : "addTodo");
  els.deleteReminder.hidden = !reminder;
  els.todoForm.elements.dueDate.max = currentTrip.startDate;

  if (reminder) {
    itemInput.value = displayReminder?.item || reminder.item || "";
    els.todoForm.elements.dueDate.value = reminderDeadline(reminder);
  } else {
    const today = todayISO();
    els.todoForm.elements.dueDate.value = today <= currentTrip.startDate ? today : currentTrip.startDate;
  }

  els.todoDialog.showModal();
  focusDialogFieldOnDesktop(itemInput);
}

async function handleTodoSubmit(event) {
  event.preventDefault();
  const data = new FormData(els.todoForm);
  const reminderId = String(data.get("reminderId") || "");
  const submittedItem = String(data.get("item") || "").trim();
  const dueDate = String(data.get("dueDate") || "");
  if (!submittedItem || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate > currentTrip.startDate) return;
  const canonicalExisting = currentTrip.reminders.find((candidate) => candidate.id === reminderId);
  const displayExisting = displayTrip.reminders.find((candidate) => candidate.id === reminderId);
  const item = canonicalExisting && submittedItem === displayExisting?.item
    ? canonicalExisting.item
    : submittedItem;

  const saved = await mutateTrip((trip) => {
    const existing = trip.reminders.find((candidate) => candidate.id === reminderId);
    const next = {
      id: reminderId || uid("reminder"),
      item,
      dueDate,
      leadDays: leadDaysFromDeadline(trip.startDate, dueDate),
      done: existing?.done || false
    };
    if (existing) Object.assign(existing, next);
    else trip.reminders.push(next);
  }, reminderId ? "todoUpdated" : "todoAdded");
  if (saved) els.todoDialog.close();
}

async function handleTodoDelete() {
  const reminderId = els.todoForm.elements.reminderId.value;
  const reminder = displayTrip.reminders.find((candidate) => candidate.id === reminderId);
  if (!reminderId || !window.confirm(ui(currentLanguage, "deleteConfirm", { item: reminder?.item || ui(currentLanguage, "todoItem") }))) return;
  const saved = await mutateTrip((trip) => {
    trip.reminders = trip.reminders.filter((candidate) => candidate.id !== reminderId);
  }, "todoDeleted");
  if (saved) els.todoDialog.close();
}

function reminderDeadline(reminder) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(reminder?.dueDate || ""))) return reminder.dueDate;
  const deadline = new Date(`${currentTrip.startDate}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() - Number(reminder?.leadDays || 0));
  return deadline.toISOString().slice(0, 10);
}

function leadDaysFromDeadline(startDate, dueDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);
  return Math.min(365, Math.max(0, Math.round((start - due) / 86400000)));
}

function openItemDialog(dayId, slotId = "") {
  const day = currentTrip.days.find((candidate) => candidate.id === dayId);
  const slot = day?.slots.find((candidate) => candidate.id === slotId);
  if (!day) return;

  els.form.reset();
  populateTimeOptions(slot?.time || "");
  els.form.elements.dayId.value = dayId;
  els.form.elements.slotId.value = slotId;
  els.dialogTitle.textContent = ui(currentLanguage, slot ? "editPlan" : "addPlan");
  els.deleteItem.hidden = !slot;
  els.form.elements.planType.value = slot ? normalizePlanType(slot.planType, slot) : "sight";
  els.form.elements.booked.value = String(slot?.booked === true || slot?.booked === "true");

  const googleMapsInput = els.form.elements.googleMapsUrl;
  const storedMapsUrl = String(slot?.googleMapsUrl || slot?.mapsUrl || "").trim();
  const storedMapsPlace = parseFullGoogleMapsPlaceUrl(storedMapsUrl);
  const canPreserveLegacyLocation = Boolean(
    slot
    && !storedMapsPlace.ok
    && Number.isFinite(slot.lat)
    && Number.isFinite(slot.lng)
  );
  googleMapsInput.required = !canPreserveLegacyLocation;
  googleMapsInput.value = storedMapsPlace.ok ? storedMapsPlace.url : "";

  if (slot) {
    els.form.elements.name.value = slot.name || "";
    els.form.elements.period.value = slot.period || "morning";
    els.form.elements.time.value = slot.time || "";
    els.form.elements.review.value = slot.review || "";
  }

  updateGoogleMapsLinkState();
  els.dialog.showModal();
  focusDialogFieldOnDesktop(els.form.elements.name);
}

function populateTimeOptions(selectedValue = "") {
  const select = els.form?.elements?.time;
  if (!select) return;
  const value = String(selectedValue || "").trim();
  const standardTimes = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    standardTimes.push(`${hours}:${mins}`);
  }

  const options = [];
  const flexible = document.createElement("option");
  flexible.value = "";
  flexible.textContent = ui(currentLanguage, "flexible");
  options.push(flexible);

  if (value && !standardTimes.includes(value)) {
    const existing = document.createElement("option");
    existing.value = value;
    existing.textContent = value;
    options.push(existing);
  }

  standardTimes.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    options.push(option);
  });
  select.replaceChildren(...options);
  select.value = value;
}

function updateGoogleMapsLinkState({ showError = false, report = false } = {}) {
  const input = els.form.elements.googleMapsUrl;
  const parsed = parseFullGoogleMapsPlaceUrl(input.value);
  input.setCustomValidity("");
  input.removeAttribute("aria-invalid");
  els.googleMapsLinkError.hidden = true;
  els.googleMapsLinkError.textContent = "";
  els.googleMapsLinkPreview.hidden = true;
  els.googleMapsPlaceLabel.textContent = "";
  els.googleMapsPlaceCoordinates.textContent = "";

  if (parsed.ok) {
    els.googleMapsPlaceLabel.textContent = parsed.placeLabel;
    els.googleMapsPlaceCoordinates.textContent = `${coordinateLabel(parsed.lat)}, ${coordinateLabel(parsed.lng)}`;
    els.googleMapsLinkPreview.hidden = false;
    return parsed;
  }

  if (showError && (input.required || input.value.trim())) {
    const message = ui(currentLanguage, "googleMapsLinkInvalid");
    input.setCustomValidity(message);
    input.setAttribute("aria-invalid", "true");
    els.googleMapsLinkError.textContent = message;
    els.googleMapsLinkError.hidden = false;
    if (report) input.reportValidity();
  }
  return parsed;
}

function coordinateLabel(value) {
  return Number(value).toFixed(6).replace(/\.?0+$/, "");
}

function focusDialogFieldOnDesktop(field) {
  if (!field || window.matchMedia("(pointer: coarse)").matches || isIosDevice()) return;
  requestAnimationFrame(() => field.focus({ preventScroll: true }));
}

async function handleItemSubmit(event) {
  event.preventDefault();
  const data = new FormData(els.form);
  const dayId = data.get("dayId");
  const slotId = data.get("slotId");
  const existingSlot = currentTrip.days
    .find((day) => day.id === dayId)?.slots
    .find((slot) => slot.id === slotId);
  const nextSlotId = slotId || uid("slot");
  const googleMapsInput = els.form.elements.googleMapsUrl;
  const parsedMapsPlace = updateGoogleMapsLinkState({ showError: true, report: true });
  const preservingLegacyLocation = Boolean(existingSlot && !googleMapsInput.required && !googleMapsInput.value.trim());
  if (!parsedMapsPlace.ok && !preservingLegacyLocation) return;

  const slotPatch = {
    period: data.get("period"),
    planType: normalizePlanType(data.get("planType")),
    booked: data.get("booked") === "true",
    name: String(data.get("name")).trim(),
    time: String(data.get("time") || "").trim(),
    review: String(data.get("review") || "").trim()
  };
  if (parsedMapsPlace.ok) {
    Object.assign(slotPatch, {
      googleMapsUrl: parsedMapsPlace.url,
      googleMapsPlaceName: parsedMapsPlace.placeName,
      googleMapsPlaceLabel: parsedMapsPlace.placeLabel,
      googleMapsFeatureId: parsedMapsPlace.featureId,
      address: parsedMapsPlace.address,
      lat: parsedMapsPlace.lat,
      lng: parsedMapsPlace.lng,
      approximateLocation: false
    });
  }

  const saved = await mutateTrip((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) return;
    const existingIndex = day.slots.findIndex((candidate) => candidate.id === slotId);
    if (existingIndex >= 0) day.slots[existingIndex] = { ...day.slots[existingIndex], ...slotPatch };
    else day.slots.push({ id: nextSlotId, ...slotPatch });
  }, slotId ? "planUpdated" : "planAdded");
  if (saved) els.dialog.close();
}

async function handleItemDelete() {
  const dayId = els.form.elements.dayId.value;
  const slotId = els.form.elements.slotId.value;
  if (!slotId) return;
  const slot = currentTrip.days.find((day) => day.id === dayId)?.slots.find((item) => item.id === slotId);
  const displaySlot = displayTrip.days.find((day) => day.id === dayId)?.slots.find((item) => item.id === slotId);
  if (!window.confirm(ui(currentLanguage, "deleteConfirm", { item: displaySlot?.name || ui(currentLanguage, "plan") }))) return;

  const saved = await mutateTrip((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (day) day.slots = day.slots.filter((candidate) => candidate.id !== slotId);
  }, "planDeleted");
  if (saved) els.dialog.close();
}

async function connectRealtimeSync() {
  if (!isFirebaseConfigured()) {
    setupLocalPreviewSync();
    setSyncStatus("localPreview", "offline");
    return;
  }

  setSyncStatus("connecting", "working");
  try {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`)
    ]);

    const app = appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.getAuth(app);
    try {
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    } catch (persistenceError) {
      console.warn("Local auth persistence unavailable; using memory only", persistenceError);
      await authSdk.setPersistence(auth, authSdk.inMemoryPersistence);
    }
    const db = firestoreSdk.initializeFirestore(app, {
      localCache: firestoreSdk.memoryLocalCache()
    });
    const [collectionName, documentId] = tripDocumentPath.split("/");
    const ref = firestoreSdk.doc(db, collectionName, documentId);
    await ensureAnonymousUser(auth, authSdk);
    syncRuntime = { auth, db, ref, authSdk, firestoreSdk };
    firestoreSdk.onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
      currentSourceIsCache = snapshot.metadata.fromCache;
      if (!snapshot.exists()) {
        syncReady = !snapshot.metadata.fromCache;
        if (!snapshot.metadata.fromCache) {
          setSyncStatus("online", "synced");
        }
        return;
      }

      const data = snapshot.data();
      if (data.trip) {
        currentTrip = data.trip;
        persistLocalTrip();
        renderAll();
      }
      renderUpdatedAt(data.updatedAt);

      if (!snapshot.metadata.fromCache) {
        syncReady = true;
        if (["savedCopyNoSync", "syncTemporaryError", "listenerError", "initializationError"].includes(toastKey)) {
          hideToast();
        }
      }
      if (snapshot.metadata.hasPendingWrites) setSyncStatus("saving", "working");
      else if (snapshot.metadata.fromCache || !navigator.onLine) setSyncStatus("savedOffline", "offline");
      else setSyncStatus("synced", "synced");
    }, (error) => {
      console.error("Realtime listener failed", error);
      syncReady = false;
      setSyncStatus("offlineCopy", "offline");
      showToast("listenerError", true);
    });
  } catch (error) {
    console.error("Firebase setup failed", error);
    syncRuntime = null;
    syncReady = false;
    setupLocalPreviewSync();
    setSyncStatus(navigator.onLine ? "syncUnavailable" : "savedOffline", "offline");
    showToast("syncTemporaryError", true);
  }
}

function ensureAnonymousUser(auth, authSdk) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const stop = authSdk.onAuthStateChanged(auth, async (user) => {
      if (user) {
        stop();
        resolve(user);
        return;
      }
      try {
        const credential = await authSdk.signInAnonymously(auth);
        stop();
        resolve(credential.user);
      } catch (error) {
        stop();
        reject(error);
      }
    }, reject);
  });
}

function setupLocalPreviewSync() {
  if (!("BroadcastChannel" in window) || localChannel) return;
  localChannel = new BroadcastChannel(APP_CHANNEL_NAME);
  localChannel.addEventListener("message", (event) => {
    if (event.data?.type !== "trip-update") return;
    currentTrip = event.data.trip;
    persistLocalTrip();
    renderAll();
  });
}

async function mutateTrip(mutator, successMessage) {
  setSyncStatus("saving", "working");
  try {
    if (!syncRuntime && isFirebaseConfigured() && syncStartupPromise) {
      await syncStartupPromise;
    }
    if (isFirebaseConfigured() && (!syncRuntime || !syncReady || !navigator.onLine)) {
      setSyncStatus(syncRuntime ? "offlineCopy" : "syncUnavailable", "offline");
      showToast("editRequiresConnection", true);
      return false;
    }

    if (syncRuntime) {
      const { auth, db, ref, firestoreSdk } = syncRuntime;
      await firestoreSdk.runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const base = snapshot.exists() && snapshot.data().trip ? snapshot.data().trip : currentTrip;
        const next = clone(base);
        mutator(next);
        normalizeTrip(next);
        const payload = {
          trip: next,
          schemaVersion: 1,
          updatedAt: firestoreSdk.serverTimestamp(),
          updatedBy: auth.currentUser.uid
        };
        if (snapshot.exists()) transaction.update(ref, payload);
        else transaction.set(ref, { ...payload, createdAt: firestoreSdk.serverTimestamp() });
      });
    } else {
      const next = clone(currentTrip);
      mutator(next);
      currentTrip = next;
      persistLocalTrip();
      renderAll();
      localChannel?.postMessage({ type: "trip-update", trip: currentTrip });
      setSyncStatus("savedOnDevice", "offline");
    }
    showToast(successMessage);
    return true;
  } catch (error) {
    console.error("Save failed", error);
    setSyncStatus("saveFailed", "error");
    showToast("saveError", true);
    return false;
  }
}

function setSyncStatus(key, state, variables = {}) {
  currentStatusKey = key;
  currentStatusVariables = variables;
  els.statusText.textContent = ui(currentLanguage, key, variables);
  els.status.dataset.state = state;
}

function renderUpdatedAt(timestamp) {
  if (timestamp?.toDate) lastUpdatedDate = timestamp.toDate();
  if (!lastUpdatedDate) {
    els.updated.textContent = ui(currentLanguage, "liveTripBoard");
    return;
  }
  const time = formatTimestamp(lastUpdatedDate);
  els.updated.textContent = ui(currentLanguage, "updatedAt", { time });
}

function showToast(key, isError = false, variables = {}) {
  clearTimeout(toastTimer);
  toastKey = key;
  toastVariables = variables;
  els.toast.textContent = ui(currentLanguage, key, variables);
  els.toast.dataset.error = String(isError);
  els.toast.hidden = false;
  toastTimer = setTimeout(hideToast, 3200);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  els.toast.hidden = true;
  toastKey = null;
  toastVariables = {};
}

function applyLanguageToDocument() {
  const meta = languageMeta(currentLanguage);
  document.documentElement.lang = meta.htmlLang;
  document.title = ui(currentLanguage, "documentTitle");
  els.metaDescription.setAttribute("content", ui(currentLanguage, "metaDescription"));
  els.language.value = currentLanguage;
  els.language.setAttribute("aria-label", ui(currentLanguage, "language"));
  els.planLanguage.value = currentLanguage;
  els.planLanguage.setAttribute("aria-label", ui(currentLanguage, "language"));
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = ui(currentLanguage, node.dataset.i18n);
  });
  populateTimeOptions(els.form.elements.time.value);
  const installLabel = ui(currentLanguage, isIosDevice() ? "installIos" : "install");
  els.install.textContent = installLabel;
  els.install.setAttribute("aria-label", installLabel);
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", ui(currentLanguage, node.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", ui(currentLanguage, node.dataset.i18nPlaceholder));
  });

  if (els.dialog.open) {
    els.dialogTitle.textContent = ui(currentLanguage, els.form.elements.slotId.value ? "editPlan" : "addPlan");
    updateGoogleMapsLinkState({ showError: els.form.elements.googleMapsUrl.getAttribute("aria-invalid") === "true" });
  }
  if (els.todoDialog.open) {
    els.todoDialogTitle.textContent = ui(currentLanguage, els.todoForm.elements.reminderId.value ? "editTodo" : "addTodo");
  }
  if (!els.toast.hidden && toastKey) {
    els.toast.textContent = ui(currentLanguage, toastKey, toastVariables);
  }
  updateItinerarySheetHandle(undefined, itinerarySheetMode);
  setSyncStatus(currentStatusKey, els.status.dataset.state || "working", currentStatusVariables);
  renderUpdatedAt();
}

function initialDayId(days = []) {
  if (!days.length) return "";
  let requested = "";
  try {
    requested = new URL(window.location.href).searchParams.get("day") || "";
  } catch {
    // The current trip date remains a safe default if URL parsing is unavailable.
  }
  const requestedDay = days.find((day) => day.id === requested || day.date === requested);
  if (requestedDay) return requestedDay.id;

  const today = todayInTripISO();
  const currentDay = days.find((day) => day.date === today);
  if (currentDay) return currentDay.id;
  return (days.find((day) => day.date >= today) || days.at(-1)).id;
}

function selectActiveDay(dayId) {
  const day = currentTrip.days.find((candidate) => candidate.id === dayId);
  if (!day) return;
  activeDayId = day.id;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("day", day.date);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Day switching still works when history manipulation is unavailable.
  }
  displayTrip = localizeTrip(currentTrip, currentLanguage);
  renderEssentials();
  renderDayNavigation();
  renderItinerary();
  renderCredits();
  renderMap();
  if (document.documentElement.classList.contains("is-itinerary-view")) els.itineraryPanel.scrollTop = 0;
}

function todayInTripISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRIP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function switchLanguage(language, persist = true) {
  if (!Object.hasOwn({ en: true, "zh-Hans": true, "zh-Hant": true, ja: true }, language) || language === currentLanguage) return;
  const anchor = captureViewAnchor();
  currentLanguage = language;
  if (persist) saveLanguage(language);
  applyLanguageToDocument();
  renderAll();
  requestAnimationFrame(() => {
    syncItinerarySheetPosition({ reframe: false });
    restoreViewAnchor(anchor);
  });
}

function captureViewAnchor() {
  if (document.documentElement.classList.contains("is-itinerary-view")) {
    return { itineraryScrollTop: els.itineraryPanel.scrollTop };
  }
  const sections = [...document.querySelectorAll(".day-section")];
  const section = sections.find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.top <= 110 && rect.bottom > 110;
  });
  if (!section) return { scrollY: window.scrollY };
  return { id: section.id, offset: section.getBoundingClientRect().top };
}

function restoreViewAnchor(anchor) {
  if (Number.isFinite(anchor.itineraryScrollTop)) {
    els.itineraryPanel.scrollTop = anchor.itineraryScrollTop;
    return;
  }
  if (anchor.id) {
    const section = document.getElementById(anchor.id);
    if (section) {
      window.scrollBy(0, section.getBoundingClientRect().top - anchor.offset);
      return;
    }
  }
  window.scrollTo(0, anchor.scrollY || 0);
}

function translateTier(tier) {
  if (!tier) return ui(currentLanguage, "stays");
  if (/^confirmed$/i.test(tier)) return ui(currentLanguage, "confirmed");
  if (/^planned$/i.test(tier)) return ui(currentLanguage, "planned");
  return tier;
}

function findCanonicalLocation(name) {
  const needle = String(name || "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, " ")
    .trim();
  if (!needle) return null;

  const locations = (currentTrip.days || []).flatMap((day) => day.slots || []);
  return locations.find((location) => {
    const candidate = String(location.name || "")
      .toLocaleLowerCase("en")
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, " ")
      .trim();
    return candidate === needle || candidate.includes(needle) || needle.includes(candidate);
  }) || null;
}

function googleMapsUrl(location) {
  return googleMapsDestinations(location)[0]?.url || "";
}

function googleMapsAnchor(location) {
  const destinations = googleMapsDestinations(location);
  const links = destinations.map((destination) => {
    const label = destination.labels?.[currentLanguage] || "";
    const link = element("a", "google-maps-link");
    link.href = destination.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label
      ? `${ui(currentLanguage, "openGoogleMaps")} · ${label}`
      : ui(currentLanguage, "openGoogleMaps");
    link.setAttribute("aria-label", `${ui(currentLanguage, "openGoogleMaps")}: ${label || location?.name || location?.address || ""}`);
    return link;
  });

  if (links.length <= 1) return links[0] || document.createTextNode("");
  const group = element("span", "google-maps-links");
  group.append(...links);
  return group;
}

function googleMapsDestinations(location = {}) {
  const stored = parseFullGoogleMapsPlaceUrl(location.googleMapsUrl || location.mapsUrl || "");
  if (stored.ok) return [{ url: stored.url }];
  const verified = getGooglePlaceLinks(location);
  if (verified.length) return verified;
  const fallbackUrl = buildGoogleMapsUrl(location);
  return fallbackUrl ? [{ url: fallbackUrl }] : [];
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

function externalAnchor(label, url, className = "resource-link") {
  const link = element("a", className);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function element(tag, className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function textElement(tag, className, text) {
  const node = element(tag, className);
  node.textContent = text || "";
  return node;
}

function normalizedLabel(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase(languageMeta(currentLanguage).htmlLang)
    .replace(/[\s·・:：—–-]+/g, " ");
}

function formatDate(iso, options) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat(languageMeta(currentLanguage).dateLocale, { timeZone: "UTC", ...options }).format(date);
}

function formatCompactDateRange(first, last) {
  const start = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [first, last].filter(Boolean).join(" – ");
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const endMonth = end.getUTCMonth() + 1;
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const sameYear = startYear === endYear;
  const sameMonth = sameYear && startMonth === endMonth;

  if (currentLanguage === "zh-Hans" || currentLanguage === "zh-Hant") {
    if (sameMonth) return `${startYear}年${startMonth}月${startDay}日至${endDay}日`;
    if (sameYear) return `${startYear}年${startMonth}月${startDay}日至${endMonth}月${endDay}日`;
  }
  if (currentLanguage === "ja") {
    if (sameMonth) return `${startYear}年${startMonth}月${startDay}日〜${endDay}日`;
    if (sameYear) return `${startYear}年${startMonth}月${startDay}日〜${endMonth}月${endDay}日`;
  }
  if (currentLanguage === "en" && sameYear) {
    const month = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });
    if (sameMonth) return `${month.format(start)} ${startDay}–${endDay}, ${startYear}`;
    return `${month.format(start)} ${startDay}–${month.format(end)} ${endDay}, ${startYear}`;
  }
  const formatter = new Intl.DateTimeFormat(languageMeta(currentLanguage).dateLocale, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  return typeof formatter.formatRange === "function"
    ? formatter.formatRange(start, end)
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

function formatNumber(value, maximumFractionDigits = 0) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(languageMeta(currentLanguage).dateLocale, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 && !Number.isInteger(value) ? 1 : 0
  }).format(value);
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(languageMeta(currentLanguage).dateLocale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function formatForecastTime(value) {
  const match = String(value || "").match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "—";
}

function periodLabel(period) {
  return ({
    morning: ui(currentLanguage, "morning"),
    noon: ui(currentLanguage, "midday"),
    evening: ui(currentLanguage, "evening")
  })[period] || ui(currentLanguage, "plan");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeMarkup(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
