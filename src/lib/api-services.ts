// ============================================================================
// 100% Live Geolocation, Open-Meteo Geocoding, Air Quality & Weather Services
// ============================================================================

import type {
  CityLocation,
  AirQualitySnapshot,
  LiveWeatherMetrics,
  HourlyForecastPoint,
  TelemetryLogger,
} from '../types';
import { calculateUsEpaPm25Aqi } from './aqi-engine';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const GEOLOCATION_TIMEOUT_MS = 4500;
const GEOLOCATION_MAX_AGE_MS = 300000;
const MAX_SEARCH_QUERY_LEN = 100;
const MAX_HOURLY_FORECAST_POINTS = 24;
const ONE_HOUR_MS = 3600 * 1000;
const DEFAULT_FALLBACK_TEMP_C = 18;
const DEFAULT_FALLBACK_HUMIDITY_PCT = 50;
const DEFAULT_FALLBACK_WIND_KMH = 10;

const geoCache = new Map<string, CacheEntry<CityLocation[]>>();
const aqiCache = new Map<string, CacheEntry<AirQualitySnapshot>>();

/** Sanitize user-entered city search text by removing control characters and capping length. */
export function sanitizeSearchQuery(rawQuery: string): string {
  return rawQuery
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_SEARCH_QUERY_LEN);
}

/** Validate geographic coordinates before constructing external API URLs. */
function assertValidCoordinates(latitude: number, longitude: number): void {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid geographic coordinates');
  }
}

/** Safely coerce an untrusted API numeric field to a finite rounded number. */
function toFiniteRounded(raw: unknown, fallback: number, decimals = 1): number {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return fallback;
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

/** Clear internal geocoding and air quality caches (primarily for testing). */
export function clearApiCaches(): void {
  geoCache.clear();
  aqiCache.clear();
}

async function tryBrowserGpsLocation(onLog: TelemetryLogger): Promise<CityLocation | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: GEOLOCATION_MAX_AGE_MS,
      });
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const t0 = performance.now();
    let name = 'Current Location';
    let country = 'Detected via GPS';

    try {
      const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res = await fetch(revUrl);
      if (res.ok) {
        const data = await res.json();
        name = data.city || data.locality || data.principalSubdivision || 'Current Location';
        country = data.countryName || 'Detected Region';
      }
    } catch {
      // Retain GPS fallback label
    }

    onLog({
      service: 'Browser GPS Location',
      endpoint: 'navigator.geolocation',
      status: 200,
      latencyMs: Math.round(performance.now() - t0),
      note: `Detected ${name}, ${country} (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
    });

    return {
      id: `gps-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      name,
      country,
      latitude: lat,
      longitude: lon,
      detectionMethod: 'browser-gps',
    };
  } catch {
    return null;
  }
}

async function tryIpGeolocation(onLog: TelemetryLogger): Promise<CityLocation | null> {
  try {
    const t0 = performance.now();
    const res = await fetch('https://ipapi.co/json/');
    const latencyMs = Math.round(performance.now() - t0);
    if (!res.ok) return null;

    const data = await res.json();
    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const name = String(data.city || 'Detected City');
    const country = String(data.country_name || '');
    onLog({
      service: 'IP Geolocation',
      endpoint: 'ipapi.co/json',
      status: res.status,
      latencyMs,
      note: `Resolved ${name}, ${country}`,
    });

    return {
      id: `ip-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      name,
      country,
      latitude: lat,
      longitude: lon,
      detectionMethod: 'ip-geolocation',
    };
  } catch {
    return null;
  }
}

/** Detect user's location via browser GPS, then IP geolocation, then fallback. */
export async function detectLiveUserLocation(
  onLog: TelemetryLogger
): Promise<CityLocation> {
  const gpsLocation = await tryBrowserGpsLocation(onLog);
  if (gpsLocation) return gpsLocation;

  const ipLocation = await tryIpGeolocation(onLog);
  if (ipLocation) return ipLocation;

  const fallbackResults = await searchCitiesLive('New Delhi', onLog);
  if (fallbackResults.length > 0) return fallbackResults[0];

  return {
    id: 'coord-28.61-77.21',
    name: 'New Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    detectionMethod: 'live-search',
  };
}

/** Search for cities via the Open-Meteo Geocoding API, with caching. */
export async function searchCitiesLive(
  query: string,
  onLog: TelemetryLogger
): Promise<CityLocation[]> {
  const sanitized = sanitizeSearchQuery(query);
  const normalized = sanitized.toLowerCase();
  if (normalized.length < 2) return [];

  const cached = geoCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const t0 = performance.now();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    sanitized
  )}&count=6&language=en&format=json`;
  const res = await fetch(url);
  const latencyMs = Math.round(performance.now() - t0);

  onLog({
    service: 'Open-Meteo Geocoding',
    endpoint: `geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sanitized)}`,
    status: res.status,
    latencyMs,
    note: `Query "${sanitized}"`,
  });

  if (!res.ok) {
    throw new Error(`Geocoding service returned HTTP ${res.status}`);
  }

  const json = await res.json();
  const results: CityLocation[] = (json.results || []).map((r: Record<string, unknown>) => ({
    id: `om-${r.id}`,
    name: String(r.name || ''),
    country: String(r.country || ''),
    admin1: r.admin1 ? String(r.admin1) : undefined,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    detectionMethod: 'live-search' as const,
  }));

  geoCache.set(normalized, { data: results, expiresAt: Date.now() + TTL_MS });
  return results;
}

function parseHourlyForecast(
  hourlyRaw: Record<string, unknown>,
  fallbackPollutants: { pm25: number; pm10: number; no2: number; o3: number }
): HourlyForecastPoint[] {
  const times = Array.isArray(hourlyRaw.time) ? (hourlyRaw.time as string[]) : [];
  const hPm25 = Array.isArray(hourlyRaw.pm2_5) ? (hourlyRaw.pm2_5 as unknown[]) : [];
  const hPm10 = Array.isArray(hourlyRaw.pm10) ? (hourlyRaw.pm10 as unknown[]) : [];
  const hNo2 = Array.isArray(hourlyRaw.nitrogen_dioxide)
    ? (hourlyRaw.nitrogen_dioxide as unknown[])
    : [];
  const hO3 = Array.isArray(hourlyRaw.ozone) ? (hourlyRaw.ozone as unknown[]) : [];

  const nowMs = Date.now() - ONE_HOUR_MS;
  const hourly: HourlyForecastPoint[] = [];

  for (let i = 0; i < times.length && hourly.length < MAX_HOURLY_FORECAST_POINTS; i++) {
    const timeStr = String(times[i] ?? '');
    const tMs = Date.parse(timeStr);
    if (!Number.isNaN(tMs) && tMs < nowMs) continue;

    const p25 = toFiniteRounded(hPm25[i], fallbackPollutants.pm25);
    const hourPart =
      timeStr.split('T')[1]?.slice(0, 5) || `${String(i % 24).padStart(2, '0')}:00`;

    hourly.push({
      time: timeStr,
      hourLabel: hourPart,
      pm25: p25,
      pm10: toFiniteRounded(hPm10[i], fallbackPollutants.pm10),
      no2: toFiniteRounded(hNo2[i], fallbackPollutants.no2),
      o3: toFiniteRounded(hO3[i], fallbackPollutants.o3),
      aqi: calculateUsEpaPm25Aqi(p25),
    });
  }

  return hourly;
}

/** Fetch live air quality and weather data from Open-Meteo, with caching. */
export async function fetchLiveAirQualityAndWeather(
  city: CityLocation,
  onLog: TelemetryLogger,
  forceRefresh = false
): Promise<AirQualitySnapshot> {
  assertValidCoordinates(city.latitude, city.longitude);
  const cacheKey = `${city.latitude.toFixed(3)},${city.longitude.toFixed(3)}`;
  if (!forceRefresh) {
    const cached = aqiCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, source: 'cached-open-meteo' };
    }
  }

  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.latitude}&longitude=${city.longitude}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&hourly=pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto&forecast_days=2`;
  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;

  const t0 = performance.now();
  const [aqRes, wxRes] = await Promise.all([fetch(aqUrl), fetch(wxUrl)]);
  const latencyMs = Math.round(performance.now() - t0);

  onLog({
    service: 'Open-Meteo Air Quality + Weather',
    endpoint: `air-quality-api.open-meteo.com (${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)})`,
    status: aqRes.status,
    latencyMs,
    note: `Live atmospheric & weather stream for ${city.name}`,
  });

  if (!aqRes.ok) {
    throw new Error(`Open-Meteo Air Quality API returned HTTP ${aqRes.status}`);
  }

  const data = await aqRes.json();
  const wxData = wxRes.ok ? await wxRes.json() : { current: {} };

  const cur = data.current || {};
  const pm25 = toFiniteRounded(cur.pm2_5, 0);
  const pm10 = toFiniteRounded(cur.pm10, 0);
  const no2 = toFiniteRounded(cur.nitrogen_dioxide, 0);
  const o3 = toFiniteRounded(cur.ozone, 0);
  const so2 = toFiniteRounded(cur.sulphur_dioxide, 0);
  const co = toFiniteRounded(cur.carbon_monoxide, 0);
  const usAqi = calculateUsEpaPm25Aqi(pm25);

  const wxCur = wxData.current || {};
  const weather: LiveWeatherMetrics = {
    temperatureC: toFiniteRounded(wxCur.temperature_2m, DEFAULT_FALLBACK_TEMP_C),
    humidityPct: Math.round(toFiniteRounded(wxCur.relative_humidity_2m, DEFAULT_FALLBACK_HUMIDITY_PCT, 0)),
    windSpeedKmh: toFiniteRounded(wxCur.wind_speed_10m, DEFAULT_FALLBACK_WIND_KMH),
  };

  const hourly = parseHourlyForecast(data.hourly || {}, { pm25, pm10, no2, o3 });

  const snapshot: AirQualitySnapshot = {
    location: city,
    fetchedAt: Date.now(),
    source: 'live-open-meteo',
    current: { pm25, pm10, no2, o3, so2, co, usAqi },
    weather,
    hourly,
  };

  aqiCache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + TTL_MS });
  return snapshot;
}
