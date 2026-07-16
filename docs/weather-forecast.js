const seedTrip = readSeedTrip();
const WEATHER_CONFIG = seedTrip.weather || {};
const CACHE_KEY = `${seedTrip.slug || "shared-trip"}-weather-v1`;
const TRIP_TIMEZONE = seedTrip.timezone || "UTC";

export const FORECAST_LOCATIONS = Object.freeze(
  (WEATHER_CONFIG.locations || []).map((location) => Object.freeze(location))
);

export const DAY_FORECAST_LOCATIONS = Object.freeze(Object.fromEntries(
  (seedTrip.days || []).map((day) => [
    day.id,
    Object.freeze(
      WEATHER_CONFIG.dayLocations?.[day.id]
        || day.weatherLocationIds
        || []
    )
  ])
));

function readSeedTrip() {
  try {
    return JSON.parse(document.getElementById("trip-data")?.textContent || "{}");
  } catch {
    return {};
  }
}

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_probability_max",
  "precipitation_sum",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "uv_index_max",
  "sunrise",
  "sunset"
];

const HOURLY_FIELDS = [
  "temperature_2m",
  "precipitation_probability",
  "uv_index"
];

export async function fetchTripForecast() {
  if (!FORECAST_LOCATIONS.length) {
    return { fetchedAt: new Date().toISOString(), locations: {} };
  }
  const params = new URLSearchParams({
    latitude: FORECAST_LOCATIONS.map((location) => location.lat).join(","),
    longitude: FORECAST_LOCATIONS.map((location) => location.lng).join(","),
    daily: DAILY_FIELDS.join(","),
    hourly: HOURLY_FIELDS.join(","),
    timezone: TRIP_TIMEZONE,
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    forecast_days: "16"
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(payload.reason || "Weather API error");
  const results = Array.isArray(payload) ? payload : [payload];
  if (results.length !== FORECAST_LOCATIONS.length) throw new Error("Weather location count did not match");

  const locations = {};
  results.forEach((result, index) => {
    const location = FORECAST_LOCATIONS[result?.location_id ?? index] || FORECAST_LOCATIONS[index];
    if (location) {
      locations[location.id] = {
        daily: normalizeDailyForecast(result?.daily),
        hourly: normalizeHourlyForecast(result?.hourly)
      };
    }
  });
  const forecast = { fetchedAt: new Date().toISOString(), locations };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(forecast));
  } catch {
    // The fresh in-memory forecast is still available when local storage is blocked.
  }
  return forecast;
}

export function loadCachedTripForecast() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return value?.locations ? value : null;
  } catch {
    return null;
  }
}

export function localizeForecastLocation(locationId, language) {
  const location = FORECAST_LOCATIONS.find((candidate) => candidate.id === locationId);
  const localizedName = location?.i18n?.[language]?.name;
  if (localizedName) return localizedName;
  if (typeof location?.name === "string") return location.name;
  return location?.name?.[language] || location?.name?.en || locationId;
}

export function weatherCodeKey(code) {
  return ({
    0: "weatherClear",
    1: "weatherMainlyClear",
    2: "weatherPartlyCloudy",
    3: "weatherOvercast",
    45: "weatherFog",
    48: "weatherRimeFog",
    51: "weatherLightDrizzle",
    53: "weatherModerateDrizzle",
    55: "weatherDenseDrizzle",
    56: "weatherLightFreezingDrizzle",
    57: "weatherDenseFreezingDrizzle",
    61: "weatherLightRain",
    63: "weatherModerateRain",
    65: "weatherHeavyRain",
    66: "weatherLightFreezingRain",
    67: "weatherHeavyFreezingRain",
    71: "weatherLightSnow",
    73: "weatherModerateSnow",
    75: "weatherHeavySnow",
    77: "weatherSnowGrains",
    80: "weatherLightShowers",
    81: "weatherModerateShowers",
    82: "weatherViolentShowers",
    85: "weatherLightSnowShowers",
    86: "weatherHeavySnowShowers",
    95: "weatherThunderstorm",
    96: "weatherThunderstormLightHail",
    99: "weatherThunderstormHeavyHail"
  })[code] || "weatherUnknown";
}

export function weatherCodeIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌧️";
}

function normalizeDailyForecast(daily = {}) {
  const dates = Array.isArray(daily.time) ? daily.time : [];
  return Object.fromEntries(dates.map((date, index) => [date, {
    weatherCode: numericValue(daily.weather_code?.[index]),
    temperatureMax: numericValue(daily.temperature_2m_max?.[index]),
    temperatureMin: numericValue(daily.temperature_2m_min?.[index]),
    apparentMax: numericValue(daily.apparent_temperature_max?.[index]),
    apparentMin: numericValue(daily.apparent_temperature_min?.[index]),
    precipitationProbability: numericValue(daily.precipitation_probability_max?.[index]),
    precipitationSum: numericValue(daily.precipitation_sum?.[index]),
    windSpeedMax: numericValue(daily.wind_speed_10m_max?.[index]),
    windGustMax: numericValue(daily.wind_gusts_10m_max?.[index]),
    uvIndexMax: numericValue(daily.uv_index_max?.[index]),
    sunrise: daily.sunrise?.[index] || null,
    sunset: daily.sunset?.[index] || null
  }]));
}

function normalizeHourlyForecast(hourly = {}) {
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const days = {};
  times.forEach((value, index) => {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (!match) return;
    const point = {
      time: match[2],
      temperature: numericValue(hourly.temperature_2m?.[index]),
      precipitationProbability: numericValue(hourly.precipitation_probability?.[index]),
      uvIndex: numericValue(hourly.uv_index?.[index])
    };
    (days[match[1]] ||= []).push(point);
  });
  return days;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
