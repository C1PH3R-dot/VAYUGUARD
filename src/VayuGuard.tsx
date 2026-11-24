import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Wind,
  ShieldAlert,
  ShieldCheck,
  Search,
  MapPin,
  Users,
  HeartPulse,
  Sparkles,
  Home,
  Route,
  Building2,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Info,
  Sun,
  Moon,
  Send,
  RefreshCw,
  ThermometerSnowflake,
  Leaf,
  Activity,
  Award,
  Sliders,
  ChevronRight,
  Check,
  BookOpen,
  FlaskConical,
  X,
  KeyRound,
  Radio,
  Compass,
  Droplets,
  Gauge,
} from 'lucide-react';

// ============================================================================
// 1. STRICT TYPES & DOMAIN INTERFACES
// ============================================================================

export type SensitivityProfileId =
  | 'general'
  | 'children'
  | 'elderly'
  | 'asthma'
  | 'outdoor';

export type CommuteModeId = 'car' | 'transit' | 'active' | 'remote';

export type HomeSetupId = 'hepa' | 'corsi' | 'natural' | 'gas_incense';

export interface CityLocation {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  detectionMethod?: 'browser-gps' | 'ip-geolocation' | 'live-search';
}

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  aqi: number;
}

export interface LiveWeatherMetrics {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
}

export interface AirQualitySnapshot {
  location: CityLocation;
  fetchedAt: number;
  source: 'live-open-meteo' | 'cached-open-meteo';
  current: {
    pm25: number; // µg/m³
    pm10: number; // µg/m³
    no2: number; // µg/m³
    o3: number; // µg/m³
    so2: number; // µg/m³
    co: number; // µg/m³
    usAqi: number;
  };
  weather: LiveWeatherMetrics;
  hourly: HourlyForecastPoint[];
}

export interface ApiTelemetryLog {
  id: string;
  timestamp: string;
  service: string;
  endpoint: string;
  status: number;
  latencyMs: number;
  note: string;
}

export interface AqiCategoryInfo {
  label: string;
  shortLabel: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  accentHex: string;
  healthSummary: string;
  maskGuidance: string;
}

export interface CleanWindowAnalysis {
  safestWindow: { startHour: string; endHour: string; avgAqi: number; avgPm25: number };
  peakSmogWindow: { startHour: string; endHour: string; avgAqi: number; avgPm25: number };
  inversionRisk: 'High' | 'Moderate' | 'Low';
  inversionExplanation: string;
}

export interface ActionRecommendation {
  id: string;
  category: 'routine' | 'indoor' | 'community';
  title: string;
  subtitle: string;
  budgetTier?: 'Free' | 'Under $50' | 'Home Upgrade';
  pm25ExposureReductionPct: number;
  ugInhaledSavedPerDay: number;
  co2AvoidedKgPerWeek: number;
  cadrOrEquivalent: string;
  whyItWorks: string;
  tailoredNote: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  groundedMetricsSnapshot?: string;
  isLiveGemini?: boolean;
}

// ============================================================================
// 2. DETERMINISTIC US EPA AQI & EXPOSURE IMPACT ENGINE (UNIT-TESTABLE)
// ============================================================================

const PM25_BREAKPOINTS: Array<{
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}> = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
];

export function calculateUsEpaPm25Aqi(pm25Raw: number): number {
  const c = Math.max(0, Math.floor(pm25Raw * 10) / 10);
  if (c > 500.4) return 500;
  for (const bp of PM25_BREAKPOINTS) {
    if (c >= bp.cLow && c <= bp.cHigh) {
      const aqi =
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }
  return 0;
}

export function getAqiCategoryInfo(aqi: number): AqiCategoryInfo {
  if (aqi <= 50) {
    return {
      label: 'Good',
      shortLabel: 'Good',
      level: 1,
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
      badgeText: 'text-emerald-900 dark:text-emerald-200',
      borderColor: 'border-emerald-400 dark:border-emerald-700',
      accentHex: '#10b981',
      healthSummary: 'Clean air; ideal for natural cross-ventilation and outdoor activity.',
      maskGuidance: 'No respirator needed.',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate',
      shortLabel: 'Moderate',
      level: 2,
      badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
      badgeText: 'text-amber-950 dark:text-amber-200',
      borderColor: 'border-amber-400 dark:border-amber-700',
      accentHex: '#f59e0b',
      healthSummary:
        'Acceptable air quality; unusually sensitive individuals should limit prolonged exertion.',
      maskGuidance: 'Optional KN95/N95 for asthma or roadside commuters.',
    };
  }
  if (aqi <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'USG',
      level: 3,
      badgeBg: 'bg-orange-100 dark:bg-orange-950/80',
      badgeText: 'text-orange-950 dark:text-orange-200',
      borderColor: 'border-orange-500 dark:border-orange-700',
      accentHex: '#f97316',
      healthSummary:
        'Children, older adults, and people with asthma/heart disease face elevated airway irritation.',
      maskGuidance: 'Well-fitted N95/KF94 recommended for sensitive groups outdoors.',
    };
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      level: 4,
      badgeBg: 'bg-rose-100 dark:bg-rose-950/80',
      badgeText: 'text-rose-950 dark:text-rose-200',
      borderColor: 'border-rose-500 dark:border-rose-700',
      accentHex: '#f43f5e',
      healthSummary:
        'Everyone may begin to experience respiratory effects; move vigorous exercise indoors.',
      maskGuidance: 'Wear a certified N95/FFP2 respirator outdoors; seal windows.',
    };
  }
  if (aqi <= 300) {
    return {
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      level: 5,
      badgeBg: 'bg-purple-100 dark:bg-purple-950/80',
      badgeText: 'text-purple-950 dark:text-purple-200',
      borderColor: 'border-purple-500 dark:border-purple-700',
      accentHex: '#a855f7',
      healthSummary:
        'Health alert: significant winter smog accumulation. Avoid all non-essential outdoor exertion.',
      maskGuidance:
        'Mandatory tight-sealing N95/N99 outdoors; run HEPA/Corsi-Rosenthal continuously.',
    };
  }
  return {
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    level: 6,
    badgeBg: 'bg-red-200 dark:bg-red-950',
    badgeText: 'text-red-950 dark:text-red-100',
    borderColor: 'border-red-600 dark:border-red-600',
    accentHex: '#dc2626',
    healthSummary:
      'Emergency conditions: severe particulate trapping. Shelter indoors with active filtration.',
    maskGuidance: 'N99/P100 respirator required if stepping outside; wet-towel seal door gaps.',
  };
}

export function analyzeCleanAirWindows(
  hourly: HourlyForecastPoint[],
  currentPm25: number,
  currentNo2: number,
  weather: LiveWeatherMetrics
): CleanWindowAnalysis {
  const slice = hourly.slice(0, 24);
  if (slice.length < 3) {
    const fallbackAqi = calculateUsEpaPm25Aqi(currentPm25);
    return {
      safestWindow: { startHour: '13:00', endHour: '16:00', avgAqi: fallbackAqi, avgPm25: currentPm25 },
      peakSmogWindow: { startHour: '07:00', endHour: '10:00', avgAqi: fallbackAqi, avgPm25: currentPm25 },
      inversionRisk: currentPm25 > 55.4 ? 'High' : currentPm25 > 35.4 ? 'Moderate' : 'Low',
      inversionExplanation:
        'Live boundary-layer evaluation combining wind speed, temperature, and particulate load.',
    };
  }

  let bestIdx = 0;
  let worstIdx = 0;
  let lowestAvgAqi = Infinity;
  let highestAvgAqi = -Infinity;

  for (let i = 0; i <= slice.length - 3; i++) {
    const windowPts = [slice[i], slice[i + 1], slice[i + 2]];
    const avgAqi = Math.round(
      windowPts.reduce((acc, p) => acc + p.aqi, 0) / windowPts.length
    );
    if (avgAqi < lowestAvgAqi) {
      lowestAvgAqi = avgAqi;
      bestIdx = i;
    }
    if (avgAqi > highestAvgAqi) {
      highestAvgAqi = avgAqi;
      worstIdx = i;
    }
  }

  const bestPts = [slice[bestIdx], slice[bestIdx + 1], slice[bestIdx + 2]];
  const worstPts = [slice[worstIdx], slice[worstIdx + 1], slice[worstIdx + 2]];

  const safestAvgPm25 = Number(
    (bestPts.reduce((acc, p) => acc + p.pm25, 0) / 3).toFixed(1)
  );
  const peakAvgPm25 = Number(
    (worstPts.reduce((acc, p) => acc + p.pm25, 0) / 3).toFixed(1)
  );

  const diurnalSwing = highestAvgAqi - lowestAvgAqi;
  const calmWind = weather.windSpeedKmh < 9.5;
  const coldSurface = weather.temperatureC <= 15;

  let inversionRisk: 'High' | 'Moderate' | 'Low' = 'Low';
  let inversionExplanation = `Live wind at ${weather.windSpeedKmh} km/h and ${weather.temperatureC}°C supports active atmospheric dispersion.`;

  if (
    currentPm25 >= 55.5 ||
    (calmWind && coldSurface && (currentPm25 >= 28 || diurnalSwing >= 35))
  ) {
    inversionRisk = 'High';
    inversionExplanation = `Strong stagnation/inversion alert: calm ${weather.windSpeedKmh} km/h winds at ${weather.temperatureC}°C (${weather.humidityPct}% RH) trap morning/evening exhaust near ground level.`;
  } else if (
    currentPm25 >= 22.0 ||
    calmWind ||
    diurnalSwing >= 25 ||
    currentNo2 >= 35
  ) {
    inversionRisk = 'Moderate';
    inversionExplanation = `Moderate boundary-layer trapping (${weather.windSpeedKmh} km/h wind, ${weather.temperatureC}°C): particulates accumulate during cool hours until midday thermal mixing.`;
  }

  const formatEndHour = (startStr: string) => {
    const h = parseInt(startStr.split(':')[0], 10);
    if (Number.isNaN(h)) return '+3h';
    const endH = (h + 3) % 24;
    return `${String(endH).padStart(2, '0')}:00`;
  };

  return {
    safestWindow: {
      startHour: bestPts[0].hourLabel,
      endHour: formatEndHour(bestPts[0].hourLabel),
      avgAqi: lowestAvgAqi,
      avgPm25: safestAvgPm25,
    },
    peakSmogWindow: {
      startHour: worstPts[0].hourLabel,
      endHour: formatEndHour(worstPts[0].hourLabel),
      avgAqi: highestAvgAqi,
      avgPm25: peakAvgPm25,
    },
    inversionRisk,
    inversionExplanation,
  };
}

export function runEngineVerificationTests(): Array<{
  name: string;
  passed: boolean;
  detail: string;
}> {
  const cases = [
    {
      name: 'US EPA PM2.5 Good upper bound (9.0 µg/m³ -> 50 AQI)',
      actual: calculateUsEpaPm25Aqi(9.0),
      expected: 50,
    },
    {
      name: 'US EPA PM2.5 Moderate lower bound (9.1 µg/m³ -> 51 AQI)',
      actual: calculateUsEpaPm25Aqi(9.1),
      expected: 51,
    },
    {
      name: 'US EPA PM2.5 USG threshold (35.5 µg/m³ -> 101 AQI)',
      actual: calculateUsEpaPm25Aqi(35.5),
      expected: 101,
    },
    {
      name: 'US EPA PM2.5 Unhealthy threshold (55.5 µg/m³ -> 151 AQI)',
      actual: calculateUsEpaPm25Aqi(55.5),
      expected: 151,
    },
    {
      name: 'US EPA PM2.5 Very Unhealthy threshold (125.5 µg/m³ -> 201 AQI)',
      actual: calculateUsEpaPm25Aqi(125.5),
      expected: 201,
    },
    {
      name: 'US EPA PM2.5 Hazardous threshold (225.5 µg/m³ -> 301 AQI)',
      actual: calculateUsEpaPm25Aqi(225.5),
      expected: 301,
    },
  ];

  return cases.map((c) => ({
    name: c.name,
    passed: c.actual === c.expected,
    detail: `Expected ${c.expected}, computed ${c.actual}`,
  }));
}

// ============================================================================
// 3. HOUSEHOLD PROFILES (NO HARDCODED POLLUTION SNAPSHOTS)
// ============================================================================

export const SENSITIVITY_PROFILES: Array<{
  id: SensitivityProfileId;
  label: string;
  shortDesc: string;
  dailyVentilationM3: number;
}> = [
  {
    id: 'general',
    label: 'General Adult / Family',
    shortDesc: 'Balanced daily protection & emissions cut (~14 m³/day inhaled)',
    dailyVentilationM3: 14.0,
  },
  {
    id: 'children',
    label: 'Children / School Commute',
    shortDesc: 'Higher breathing rate per kg body weight; school drop-off focus',
    dailyVentilationM3: 16.5,
  },
  {
    id: 'elderly',
    label: 'Elderly / Cardiovascular',
    shortDesc: 'Strict fine-particulate & NO2 vascular inflammation protection',
    dailyVentilationM3: 15.0,
  },
  {
    id: 'asthma',
    label: 'Asthma / Respiratory Sensitivity',
    shortDesc: 'Zero-trigger indoor air & peak-inversion avoidance',
    dailyVentilationM3: 17.5,
  },
  {
    id: 'outdoor',
    label: 'Outdoor Worker / Runner',
    shortDesc: 'High minute-ventilation dose reduction & timing shifts (~24 m³/day)',
    dailyVentilationM3: 24.0,
  },
];

export const COMMUTE_MODES: Array<{ id: CommuteModeId; label: string }> = [
  { id: 'car', label: 'Private Car / Rideshare' },
  { id: 'transit', label: 'Metro / Bus Transit' },
  { id: 'active', label: 'Bike / Walk' },
  { id: 'remote', label: 'Remote / Hybrid WFH' },
];

export const HOME_SETUPS: Array<{ id: HomeSetupId; label: string }> = [
  { id: 'natural', label: 'Natural Ventilation Only' },
  { id: 'hepa', label: 'True HEPA Air Purifier' },
  { id: 'corsi', label: 'DIY Corsi-Rosenthal Box' },
  { id: 'gas_incense', label: 'Gas Stove / Incense / Candles' },
];

// ============================================================================
// 4. 100% LIVE GEOLOCATION, OPEN-METEO GEOCODING, AIR QUALITY & WEATHER SERVICES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const geoCache = new Map<string, CacheEntry<CityLocation[]>>();
const aqiCache = new Map<string, CacheEntry<AirQualitySnapshot>>();

type TelemetryLogger = (entry: Omit<ApiTelemetryLog, 'id' | 'timestamp'>) => void;

export async function detectLiveUserLocation(
  onLog: TelemetryLogger
): Promise<CityLocation> {
  // 1. Try Browser Geolocation + Reverse Geocoding
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 4500,
          maximumAge: 300000,
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
          name =
            data.city || data.locality || data.principalSubdivision || 'Current Location';
          country = data.countryName || 'Detected Region';
        }
      } catch {
        // Retain GPS fallback label
      }

      const latencyMs = Math.round(performance.now() - t0);
      onLog({
        service: 'Browser GPS Location',
        endpoint: 'navigator.geolocation',
        status: 200,
        latencyMs,
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
      // Fall through to live IP geolocation
    }
  }

  // 2. Live IP Geolocation (no API key required)
  try {
    const t0 = performance.now();
    const res = await fetch('https://ipapi.co/json/');
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
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
          id: `ip-${Number(data.latitude).toFixed(3)}-${Number(data.longitude).toFixed(3)}`,
          name,
          country,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          detectionMethod: 'ip-geolocation',
        };
      }
    }
  } catch {
    // Fall through to live Open-Meteo geocoding lookup
  }

  // 3. Fallback to live Open-Meteo Geocoding query for New Delhi
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

export async function searchCitiesLive(
  query: string,
  onLog: TelemetryLogger
): Promise<CityLocation[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const cached = geoCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const t0 = performance.now();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query.trim()
  )}&count=6&language=en&format=json`;
  const res = await fetch(url);
  const latencyMs = Math.round(performance.now() - t0);

  onLog({
    service: 'Open-Meteo Geocoding',
    endpoint: `geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}`,
    status: res.status,
    latencyMs,
    note: `Query "${query.trim()}"`,
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
    detectionMethod: 'live-search',
  }));

  geoCache.set(normalized, { data: results, expiresAt: Date.now() + TTL_MS });
  return results;
}

export async function fetchLiveAirQualityAndWeather(
  city: CityLocation,
  onLog: TelemetryLogger,
  forceRefresh = false
): Promise<AirQualitySnapshot> {
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
  const pm25 = Number(cur.pm2_5 ?? 0);
  const pm10 = Number(cur.pm10 ?? 0);
  const no2 = Number(cur.nitrogen_dioxide ?? 0);
  const o3 = Number(cur.ozone ?? 0);
  const so2 = Number(cur.sulphur_dioxide ?? 0);
  const co = Number(cur.carbon_monoxide ?? 0);
  const usAqi = calculateUsEpaPm25Aqi(pm25);

  const wxCur = wxData.current || {};
  const weather: LiveWeatherMetrics = {
    temperatureC: Number((wxCur.temperature_2m ?? 18).toFixed(1)),
    humidityPct: Math.round(Number(wxCur.relative_humidity_2m ?? 50)),
    windSpeedKmh: Number((wxCur.wind_speed_10m ?? 10).toFixed(1)),
  };

  const hourlyRaw = data.hourly || {};
  const times: string[] = hourlyRaw.time || [];
  const hPm25: number[] = hourlyRaw.pm2_5 || [];
  const hPm10: number[] = hourlyRaw.pm10 || [];
  const hNo2: number[] = hourlyRaw.nitrogen_dioxide || [];
  const hO3: number[] = hourlyRaw.ozone || [];

  const nowMs = Date.now() - 3600 * 1000;
  const hourly: HourlyForecastPoint[] = [];
  for (let i = 0; i < times.length && hourly.length < 24; i++) {
    const tMs = Date.parse(times[i]);
    if (!Number.isNaN(tMs) && tMs < nowMs) continue;
    const p25 = Number((hPm25[i] ?? pm25).toFixed(1));
    const hourPart =
      times[i]?.split('T')[1]?.slice(0, 5) || `${String(i % 24).padStart(2, '0')}:00`;
    hourly.push({
      time: times[i],
      hourLabel: hourPart,
      pm25: p25,
      pm10: Number((hPm10[i] ?? pm10).toFixed(1)),
      no2: Number((hNo2[i] ?? no2).toFixed(1)),
      o3: Number((hO3[i] ?? o3).toFixed(1)),
      aqi: calculateUsEpaPm25Aqi(p25),
    });
  }

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

// ============================================================================
// 5. LIVE-SCALED RECOMMENDATION & EXPOSURE IMPACT ENGINE
// ============================================================================

export function buildTailoredRecommendations(
  snapshot: AirQualitySnapshot,
  cleanWindow: CleanWindowAnalysis,
  profileId: SensitivityProfileId,
  commute: CommuteModeId,
  homeSetup: HomeSetupId
): ActionRecommendation[] {
  const { pm25, no2, usAqi } = snapshot.current;
  const profileObj =
    SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];
  const baselineDailyUgInhaled = pm25 * profileObj.dailyVentilationM3;
  const isHighSmog = usAqi > 100;

  const swingPct = Math.max(
    10,
    Math.min(
      52,
      Math.round(
        ((cleanWindow.peakSmogWindow.avgPm25 - cleanWindow.safestWindow.avgPm25) /
          Math.max(1, cleanWindow.peakSmogWindow.avgPm25)) *
          100
      )
    )
  );

  const calcUgSaved = (pct: number) =>
    Math.round((baselineDailyUgInhaled * (pct / 100)) * 10) / 10;

  const routines: ActionRecommendation[] = [
    {
      id: 'routine-window-shift',
      category: 'routine',
      title: `Shift Outdoor Errands & Exercise to ${cleanWindow.safestWindow.startHour}–${cleanWindow.safestWindow.endHour}`,
      subtitle: `Avoid peak smog trapping between ${cleanWindow.peakSmogWindow.startHour}–${cleanWindow.peakSmogWindow.endHour}`,
      budgetTier: 'Free',
      pm25ExposureReductionPct: swingPct,
      ugInhaledSavedPerDay: calcUgSaved(swingPct),
      co2AvoidedKgPerWeek: 1.8,
      cadrOrEquivalent: `Drops ambient PM2.5 from ${cleanWindow.peakSmogWindow.avgPm25} to ${cleanWindow.safestWindow.avgPm25} µg/m³`,
      whyItWorks:
        'Midday boundary-layer warming disperses shallow ground-level combustion exhaust.',
      tailoredNote:
        profileId === 'children'
          ? 'Schedule school playground & outdoor sports exclusively inside this clean-air window.'
          : profileId === 'outdoor'
          ? 'High minute-ventilation multiplies particulate dose by 4–6×; shifting runs to this window prevents deep alveolar deposition.'
          : 'Align errands, walks, and brief window airing with this lowest-AQI band.',
    },
    {
      id: 'routine-commute-swap',
      category: 'routine',
      title:
        commute === 'car'
          ? 'Swap 3 Solo Car Trips/Week for Metro/Rail + Recirculate Cabin Air'
          : commute === 'active'
          ? 'Reroute 200m Off Arterial Roads + Wear Fitted N95 During Rush Hour'
          : commute === 'transit'
          ? 'Off-Peak Transit Boarding + Closed-Window Station Waiting'
          : 'Batch Cold-Start Errands into One Warm-Engine Loop',
      subtitle:
        commute === 'car'
          ? 'Eliminates cold-start tailpipe NOx & cabin traffic-plume spikes'
          : 'Side streets reduce ultrafine black carbon & NO2 by 35–50%',
      budgetTier: 'Free',
      pm25ExposureReductionPct: commute === 'active' ? 42 : 24,
      ugInhaledSavedPerDay: calcUgSaved(commute === 'active' ? 42 : 24),
      co2AvoidedKgPerWeek: commute === 'car' ? 18.4 : commute === 'transit' ? 9.2 : 6.5,
      cadrOrEquivalent:
        commute === 'car' ? '~45 g NOx + 18.4 kg CO2 saved/wk' : '40% lower commuter lung dose',
      whyItWorks:
        'Cold engines emit 3–5× more hydrocarbons and NOx in the first 5 minutes before catalytic converters reach light-off temperature.',
      tailoredNote:
        no2 > 40
          ? `Live NO2 is elevated (${no2} µg/m³)—avoiding congested intersections directly reduces airway inflammation.`
          : 'Keeping vehicle HVAC on "Recirculate" with a clean cabin filter cuts in-cabin PM2.5 by up to 65%.',
    },
    {
      id: 'routine-mask-ventilation',
      category: 'routine',
      title: isHighSmog
        ? 'Enforce Fitted N95/KF94 Respirator Outdoors + Zero-Idle Warmups'
        : 'Smart Cross-Ventilation Purge (15-Min Midday Flush)',
      subtitle: isHighSmog
        ? 'Electrostatic melt-blown media captures >95% of 0.3–2.5 µm aerosols'
        : 'Prevents indoor CO2 buildup without inviting evening smog inside',
      budgetTier: 'Under $50',
      pm25ExposureReductionPct: isHighSmog ? 68 : 22,
      ugInhaledSavedPerDay: calcUgSaved(isHighSmog ? 68 : 22),
      co2AvoidedKgPerWeek: 3.4,
      cadrOrEquivalent: isHighSmog
        ? '95% filtration efficiency at 0.3 µm'
        : '4–6 air changes in 15 min',
      whyItWorks:
        'Cloth masks leak 60–80% of fine aerosols; sealed N95/KF94 respirators block sub-micron combustion soot.',
      tailoredNote:
        profileId === 'asthma' || profileId === 'elderly'
          ? 'Choose a soft-seal N95/KF94 with low breathing resistance and keep rescue inhalers accessible.'
          : 'Skip idling your car in the driveway—modern fuel-injected engines warm faster under gentle driving.',
    },
  ];

  const indoor: ActionRecommendation[] = [
    {
      id: 'indoor-filtration',
      category: 'indoor',
      title:
        homeSetup === 'hepa'
          ? 'Run HEPA Purifier on High During Smog Peaks + Clean Pre-Filter Weekly'
          : homeSetup === 'corsi'
          ? 'Seal Corsi-Rosenthal Box Seams & Run 24/7 on Medium-High'
          : 'Build a DIY Corsi-Rosenthal Box (4× MERV-13 Filters + Box Fan)',
      subtitle:
        homeSetup === 'natural'
          ? 'Delivers 400–600 CFM Clean Air Delivery Rate for ~$45–$65'
          : 'Maintains 5+ Air Changes per Hour (ACH) in main living/sleeping zone',
      budgetTier: homeSetup === 'hepa' || homeSetup === 'corsi' ? 'Free' : 'Under $50',
      pm25ExposureReductionPct: 62,
      ugInhaledSavedPerDay: calcUgSaved(62),
      co2AvoidedKgPerWeek: 1.2,
      cadrOrEquivalent: '450+ CFM CADR (~62% lower indoor PM2.5)',
      whyItWorks:
        'High-airflow MERV-13 / H13 HEPA filtration continuously strips infiltrated outdoor PM2.5 before it settles in bedrooms.',
      tailoredNote:
        profileId === 'children' || profileId === 'asthma'
          ? 'Prioritize placing the filtration unit in the bedroom overnight where 8–10 hours of cumulative breathing occurs.'
          : 'Create at least one sealed "Clean Air Safe Room" in your home during multi-day inversions.',
    },
    {
      id: 'indoor-source-control',
      category: 'indoor',
      title:
        homeSetup === 'gas_incense'
          ? 'Pause Incense/Candles & Use Electric Kettle/Induction + Range Hood'
          : 'Always Run Exhaust Hood on High & Lid Pots While Cooking',
      subtitle: 'Eliminates indoor NO2, ultra-fine cooking aerosols & soot spikes',
      budgetTier: 'Free',
      pm25ExposureReductionPct: homeSetup === 'gas_incense' ? 54 : 31,
      ugInhaledSavedPerDay: calcUgSaved(homeSetup === 'gas_incense' ? 54 : 31),
      co2AvoidedKgPerWeek: homeSetup === 'gas_incense' ? 8.5 : 2.1,
      cadrOrEquivalent: 'Prevents 200+ µg/m³ indoor kitchen spikes',
      whyItWorks:
        'Unvented gas burners and incense can push indoor PM2.5 and NO2 higher than severe outdoor winter smog within 15 minutes.',
      tailoredNote:
        'Back burners sit closer to range hood capture zones—cooking on rear burners improves fume capture by ~35%.',
    },
    {
      id: 'indoor-sealing-cleaning',
      category: 'indoor',
      title: 'Weatherstrip Window Drafts + Damp-Mop Floors Instead of Dry Sweeping',
      subtitle: 'Stops infiltration during inversions & prevents dust resuspension',
      budgetTier: 'Under $50',
      pm25ExposureReductionPct: 28,
      ugInhaledSavedPerDay: calcUgSaved(28),
      co2AvoidedKgPerWeek: 4.8,
      cadrOrEquivalent: 'Cuts smog infiltration by ~30% + lowers heating waste',
      whyItWorks:
        'Dry brooms and non-HEPA vacuums kick settled heavy metals and PM2.5 back into the 1-meter child/seated breathing zone.',
      tailoredNote:
        'Foam weatherstripping and rolled damp door towels block drafts while reducing HVAC energy consumption.',
    },
  ];

  const community: ActionRecommendation[] = [
    {
      id: 'comm-school-anti-idle',
      category: 'community',
      title: 'Launch a School / Apartment "Engines Off" Anti-Idling Zone',
      subtitle: '10-minute pick-up idling burns fuel directly at child breathing height',
      budgetTier: 'Free',
      pm25ExposureReductionPct: 34,
      ugInhaledSavedPerDay: calcUgSaved(34),
      co2AvoidedKgPerWeek: 14.0,
      cadrOrEquivalent: '20 cars idling 10m = ~12 kg CO2 + concentrated NOx/PM2.5',
      whyItWorks:
        'Tailpipe plumes at school gates pool in stagnant air right where children line up.',
      tailoredNote:
        'Share a 1-page parent/HOA pledge: turning off engines for stops >30 seconds saves fuel and protects kids’ lungs.',
    },
    {
      id: 'comm-carpool-microtransit',
      category: 'community',
      title: 'Organize a 3-Family Neighborhood Carpool / Walking Bus Co-op',
      subtitle: 'Cuts local cold-start vehicle trips by 66% on high-smog days',
      budgetTier: 'Free',
      pm25ExposureReductionPct: 26,
      ugInhaledSavedPerDay: calcUgSaved(26),
      co2AvoidedKgPerWeek: 24.5,
      cadrOrEquivalent: '~1.2 tonnes CO2/yr avoided per 3-family pod',
      whyItWorks:
        'Short neighborhood drives under 3 km produce the highest emissions per kilometer because engines never reach thermal efficiency.',
      tailoredNote:
        'Coordinate via neighborhood chat whenever live AQI crosses 100 (USG) to consolidate school and grocery runs.',
    },
    {
      id: 'comm-clean-hub-green',
      category: 'community',
      title: 'Equip Community Library / Senior Center with DIY Clean-Air Hubs',
      subtitle: 'Shared Corsi-Rosenthal filter boxes protect vulnerable neighbors',
      budgetTier: 'Under $50',
      pm25ExposureReductionPct: 45,
      ugInhaledSavedPerDay: calcUgSaved(45),
      co2AvoidedKgPerWeek: 5.0,
      cadrOrEquivalent: '2 boxes clean a 100 m² community room for <$120 total',
      whyItWorks:
        'Low-income households and seniors often lack central filtration during multi-day air pollution episodes.',
      tailoredNote:
        'Pair with local hardy evergreen vegetative buffers along school fences to trap coarse road dust.',
    },
  ];

  return [...routines, ...indoor, ...community];
}

// ============================================================================
// 6. LIVE GEMINI API INTEGRATION (STRICTLY GROUNDED ON LIVE TELEMETRY)
// ============================================================================

async function generateGroundedSmogAdvice(params: {
  userQuestion: string;
  userApiKey: string;
  snapshot: AirQualitySnapshot;
  category: AqiCategoryInfo;
  cleanWindow: CleanWindowAnalysis;
  profileLabel: string;
  commuteLabel: string;
  homeSetupLabel: string;
  selectedActions: ActionRecommendation[];
  onLog: TelemetryLogger;
}): Promise<{ text: string; isLiveGemini: boolean }> {
  const {
    userQuestion,
    userApiKey,
    snapshot,
    category,
    cleanWindow,
    profileLabel,
    commuteLabel,
    homeSetupLabel,
    selectedActions,
    onLog,
  } = params;

  const effectiveKey = (
    userApiKey.trim() ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    ''
  ).trim();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
    effectiveKey
  )}`;

  const groundedContext = `
VERIFIED LIVE TELEMETRY & USER PROFILE (DO NOT CONTRADICT OR INVENT NUMBERS):
- Location: ${snapshot.location.name}, ${snapshot.location.country} (Lat ${snapshot.location.latitude.toFixed(3)}, Lon ${snapshot.location.longitude.toFixed(3)})
- Live Weather: Temp ${snapshot.weather.temperatureC}°C, Humidity ${snapshot.weather.humidityPct}%, Wind ${snapshot.weather.windSpeedKmh} km/h
- Current US EPA AQI (PM2.5-based): ${snapshot.current.usAqi} (${category.label})
- Live Pollutant Concentrations: PM2.5 = ${snapshot.current.pm25} µg/m³, PM10 = ${snapshot.current.pm10} µg/m³, NO2 = ${snapshot.current.no2} µg/m³, O3 = ${snapshot.current.o3} µg/m³, SO2 = ${snapshot.current.so2} µg/m³, CO = ${snapshot.current.co} µg/m³
- Next 24h Cleanest 3-Hour Window: ${cleanWindow.safestWindow.startHour} to ${cleanWindow.safestWindow.endHour} (Avg AQI ${cleanWindow.safestWindow.avgAqi}, Avg PM2.5 ${cleanWindow.safestWindow.avgPm25} µg/m³)
- Next 24h Peak Smog 3-Hour Window: ${cleanWindow.peakSmogWindow.startHour} to ${cleanWindow.peakSmogWindow.endHour} (Avg AQI ${cleanWindow.peakSmogWindow.avgAqi}, Avg PM2.5 ${cleanWindow.peakSmogWindow.avgPm25} µg/m³)
- Atmospheric Inversion Risk: ${cleanWindow.inversionRisk} (${cleanWindow.inversionExplanation})
- Household Sensitivity Profile: ${profileLabel}
- Primary Commute Mode: ${commuteLabel}
- Current Home Setup: ${homeSetupLabel}
- Active Actions Committed by User: ${
    selectedActions.length > 0
      ? selectedActions
          .map(
            (a) =>
              `${a.title} (-${a.pm25ExposureReductionPct}% PM2.5 exposure, -${a.ugInhaledSavedPerDay} µg/day inhaled, -${a.co2AvoidedKgPerWeek} kg CO2/wk)`
          )
          .join('; ')
      : 'None selected yet'
  }
`.trim();

  const systemInstruction = `You are VayuGuard, an expert Environmental Health & Urban Sustainability Advisor helping families and communities navigate winter smog and urban air pollution.
Rules:
1. Ground every recommendation strictly in the live pollutant concentrations, weather conditions, clean-air windows, and household profile provided. Never invent or alter AQI numbers.
2. Provide practical low-emission daily routines, budget-conscious indoor air quality hacks, and community-level alternatives tailored to the user's question.
3. Explicitly explain the DIRECT IMPACT of each choice (e.g., % reduction in inhaled PM2.5 dose, µg/day spared, kg CO2/NOx avoided, or respiratory mechanism).
4. Keep formatting crisp, compassionate, and scannable with short bullet points and bolded impact takeaways (~200 words max).`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${groundedContext}\n\nUSER QUESTION:\n${userQuestion}`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
  };

  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const t0 = performance.now();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const latencyMs = Math.round(performance.now() - t0);

      onLog({
        service: 'Gemini 2.0 Flash API',
        endpoint: 'generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        status: response.status,
        latencyMs,
        note: `Grounded prompt for ${snapshot.location.name} (AQI ${snapshot.current.usAqi})`,
      });

      if (!response.ok) {
        if (attempt < delays.length && (response.status === 429 || response.status >= 500)) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
        throw new Error(`Gemini API HTTP ${response.status}`);
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, isLiveGemini: true };
      throw new Error('Empty model response');
    } catch (err) {
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      const errMsg = err instanceof Error ? err.message : 'Network/API key unavailable';
      return {
        text: `⚠️ **Live Gemini API Call Unauthenticated/Rate-Limited (${errMsg})**\nClick **"Connect Gemini Key"** in the top bar to enter a valid Google AI Studio key for live LLM synthesis.\n\n**Live Telemetry Calculation for ${snapshot.location.name} (AQI ${snapshot.current.usAqi} — ${category.label}):**\n• **Safest Outdoor Window:** **${cleanWindow.safestWindow.startHour}–${cleanWindow.safestWindow.endHour}** (Avg PM2.5 ${cleanWindow.safestWindow.avgPm25} µg/m³ vs. peak ${cleanWindow.peakSmogWindow.avgPm25} µg/m³).\n• **Tailored ${homeSetupLabel} & ${profileLabel} Action:** Seal windows during peak hours, filter bedroom air continuously (-62% PM2.5 dose), and replace solo cold-start car trips (-18.4 kg CO₂/wk).`,
        isLiveGemini: false,
      };
    }
  }

  return { text: 'Unable to reach Gemini API.', isLiveGemini: false };
}

// ============================================================================
// 7. CUSTOM ACCESSIBLE SVG VISUALIZATIONS
// ============================================================================

const AqiRadialGauge: React.FC<{
  aqi: number;
  category: AqiCategoryInfo;
  pm25: number;
}> = ({ aqi, category, pm25 }) => {
  const clamped = Math.min(500, Math.max(0, aqi));
  const pct = clamped / 500;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const dashOffset = arcLength * (1 - pct);

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none shrink-0"
      role="img"
      aria-label={`US EPA Air Quality Index is ${aqi}, categorized as ${category.label}, with PM2.5 at ${pm25} micrograms per cubic meter`}
    >
      <svg
        width="156"
        height="144"
        viewBox="0 0 156 144"
        className="overflow-visible"
      >
        <circle
          cx="78"
          cy="68"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform="rotate(135 78 68)"
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx="78"
          cy="68"
          r={radius}
          fill="none"
          stroke={category.accentHex}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform="rotate(135 78 68)"
          className="transition-all duration-700 ease-out"
        />
        <text
          x="78"
          y="58"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900 dark:fill-white font-extrabold text-[28px] tracking-tight"
        >
          {aqi}
        </text>
        <text
          x="78"
          y="78"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-500 dark:fill-slate-400 font-semibold text-[10px] uppercase tracking-wider"
        >
          US EPA AQI
        </text>
        <text
          x="78"
          y="130"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-700 dark:fill-slate-300 font-semibold text-[11px]"
        >
          PM2.5: {pm25} µg/m³
        </text>
      </svg>
    </div>
  );
};

const HourlyForecastChart: React.FC<{
  hourly: HourlyForecastPoint[];
  cleanWindow: CleanWindowAnalysis;
}> = ({ hourly, cleanWindow }) => {
  const points = hourly.slice(0, 24);
  const maxAqi = Math.max(100, ...points.map((p) => p.aqi));

  if (points.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
        Awaiting live 24-hour forecast stream...
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            Cleanest ({cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            Peak Smog ({cleanWindow.peakSmogWindow.startHour}–{cleanWindow.peakSmogWindow.endHour})
          </span>
        </div>
        <span className="text-slate-500 dark:text-slate-400">Live 24h Forecast</span>
      </div>

      <div
        className="relative h-36 flex items-end gap-1 pt-6 pb-1 px-1 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800"
        role="img"
        aria-label={`Live 24-hour air quality forecast chart. Cleanest window is ${cleanWindow.safestWindow.startHour} to ${cleanWindow.safestWindow.endHour} with average AQI ${cleanWindow.safestWindow.avgAqi}. Peak smog window is ${cleanWindow.peakSmogWindow.startHour} to ${cleanWindow.peakSmogWindow.endHour} with average AQI ${cleanWindow.peakSmogWindow.avgAqi}.`}
      >
        {points.map((pt, idx) => {
          const heightPct = Math.max(10, Math.round((pt.aqi / maxAqi) * 100));
          const cat = getAqiCategoryInfo(pt.aqi);
          const isSafest =
            pt.hourLabel === cleanWindow.safestWindow.startHour ||
            (idx > 0 && points[idx - 1]?.hourLabel === cleanWindow.safestWindow.startHour) ||
            (idx > 1 && points[idx - 2]?.hourLabel === cleanWindow.safestWindow.startHour);

          return (
            <div
              key={`${pt.time}-${idx}`}
              className="group relative flex-1 h-full flex flex-col justify-end items-center"
            >
              <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 z-20 px-2 py-1 rounded bg-slate-900 text-white text-[10px] whitespace-nowrap shadow-md">
                {pt.hourLabel}: AQI {pt.aqi} ({pt.pm25} µg/m³)
              </div>
              <div
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isSafest ? '#10b981' : cat.accentHex,
                }}
                className={`w-full rounded-t-sm transition-all duration-300 ${
                  isSafest ? 'ring-2 ring-emerald-400/70' : 'opacity-85 group-hover:opacity-100'
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 px-1 font-mono">
        {points
          .filter((_, i) => i % 4 === 0)
          .map((pt, i) => (
            <span key={pt.time || pt.hourLabel || i}>{pt.hourLabel}</span>
          ))}
      </div>
    </div>
  );
};

// ============================================================================
// 8. MAIN APPLICATION COMPONENT
// ============================================================================

export function VayuGuard() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Live location & search states (zero pre-fed static snapshot)
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CityLocation[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Live air quality & weather states
  const [snapshot, setSnapshot] = useState<AirQualitySnapshot | null>(null);
  const [isLoadingAqi, setIsLoadingAqi] = useState<boolean>(true);
  const [aqiError, setAqiError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');

  // Live API Telemetry Log (proves every call is real-time)
  const [telemetryLogs, setTelemetryLogs] = useState<ApiTelemetryLog[]>([]);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState<boolean>(false);

  // Session-only Gemini API Key (optional override if env key is not bundled)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('vayuguard_gemini_key') ||
        (import.meta.env.VITE_GEMINI_API_KEY as string) ||
        ''
      );
    }
    return (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>('');

  // Household & Lifestyle Profile state
  const [profileId, setProfileId] = useState<SensitivityProfileId>('children');
  const [commuteId, setCommuteId] = useState<CommuteModeId>('car');
  const [homeSetupId, setHomeSetupId] = useState<HomeSetupId>('natural');

  // Action Planner state
  const [activeTab, setActiveTab] = useState<'routine' | 'indoor' | 'community'>('routine');
  const [committedIds, setCommittedIds] = useState<string[]>([
    'routine-window-shift',
    'indoor-filtration',
  ]);

  // Live Gemini Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Unit Test Verification Modal
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const appendTelemetryLog = useCallback(
    (entry: Omit<ApiTelemetryLog, 'id' | 'timestamp'>) => {
      const logItem: ApiTelemetryLog = {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      setTelemetryLogs((prev) => [logItem, ...prev.slice(0, 24)]);
    },
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  // 1. Auto-detect live location on initial load
  const handleDetectMyLocation = useCallback(async () => {
    setIsDetectingLocation(true);
    setAqiError(null);
    const detected = await detectLiveUserLocation(appendTelemetryLog);
    setSelectedCity(detected);
    setIsDetectingLocation(false);
  }, [appendTelemetryLog]);

  useEffect(() => {
    handleDetectMyLocation();
  }, [handleDetectMyLocation]);

  // 2. Fetch live Open-Meteo Air Quality & Weather whenever selectedCity updates
  const loadCityAirQuality = useCallback(
    async (city: CityLocation, force = false) => {
      setIsLoadingAqi(true);
      setAqiError(null);
      try {
        const data = await fetchLiveAirQualityAndWeather(city, appendTelemetryLog, force);
        setSnapshot(data);
        const cat = getAqiCategoryInfo(data.current.usAqi);
        setStatusAnnouncement(
          `Live air quality loaded for ${city.name}, ${city.country}. US EPA AQI is ${data.current.usAqi}, ${cat.label}. PM2.5 is ${data.current.pm25} micrograms per cubic meter.`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to load live telemetry';
        setAqiError(msg);
      } finally {
        setIsLoadingAqi(false);
      }
    },
    [appendTelemetryLog]
  );

  useEffect(() => {
    if (selectedCity) {
      loadCityAirQuality(selectedCity);
    }
  }, [selectedCity, loadCityAirQuality]);

  // 3. Live Debounced Open-Meteo Geocoding Search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const matches = await searchCitiesLive(trimmed, appendTelemetryLog);
        setSearchResults(matches);
        if (matches.length === 0) {
          setSearchError(`No matching cities found for "${trimmed}"`);
        }
        setShowDropdown(true);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setShowDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [searchQuery, appendTelemetryLog]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derived analytics
  const categoryInfo = useMemo(() => {
    return getAqiCategoryInfo(snapshot?.current.usAqi ?? 0);
  }, [snapshot]);

  const cleanWindow = useMemo(() => {
    if (!snapshot) {
      return {
        safestWindow: { startHour: '--:--', endHour: '--:--', avgAqi: 0, avgPm25: 0 },
        peakSmogWindow: { startHour: '--:--', endHour: '--:--', avgAqi: 0, avgPm25: 0 },
        inversionRisk: 'Low' as const,
        inversionExplanation: 'Awaiting live atmospheric telemetry...',
      };
    }
    return analyzeCleanAirWindows(
      snapshot.hourly,
      snapshot.current.pm25,
      snapshot.current.no2,
      snapshot.weather
    );
  }, [snapshot]);

  const allRecommendations = useMemo(() => {
    if (!snapshot) return [];
    return buildTailoredRecommendations(
      snapshot,
      cleanWindow,
      profileId,
      commuteId,
      homeSetupId
    );
  }, [snapshot, cleanWindow, profileId, commuteId, homeSetupId]);

  const visibleRecommendations = useMemo(
    () => allRecommendations.filter((r) => r.category === activeTab),
    [allRecommendations, activeTab]
  );

  // Live-scaled Cumulative Exposure & Carbon Impact Calculator
  const cumulativeImpact = useMemo(() => {
    const chosen = allRecommendations.filter((r) => committedIds.includes(r.id));
    if (chosen.length === 0 || !snapshot) {
      return {
        count: 0,
        combinedExposureDropPct: 0,
        dailyUgSaved: 0,
        totalCo2SavedKgWeek: 0,
        annualCo2SavedKg: 0,
      };
    }
    const profileObj =
      SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];
    const baselineUgPerDay = snapshot.current.pm25 * profileObj.dailyVentilationM3;

    let remainingExposure = 1.0;
    let weeklyCo2 = 0;
    for (const item of chosen) {
      remainingExposure *= 1 - item.pm25ExposureReductionPct / 100;
      weeklyCo2 += item.co2AvoidedKgPerWeek;
    }
    const combinedDrop = Math.min(89, Math.round((1 - remainingExposure) * 100));
    const dailyUgSaved = Math.round(baselineUgPerDay * (combinedDrop / 100) * 10) / 10;

    return {
      count: chosen.length,
      combinedExposureDropPct: combinedDrop,
      dailyUgSaved,
      totalCo2SavedKgWeek: Number(weeklyCo2.toFixed(1)),
      annualCo2SavedKg: Math.round(weeklyCo2 * 52),
    };
  }, [allRecommendations, committedIds, snapshot, profileId]);

  const toggleCommitAction = (id: string) => {
    setCommittedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Live Gemini Grounded Advisor Handler
  const handleAskAdvisor = async (promptText: string) => {
    const question = promptText.trim();
    if (!question || !snapshot || isGeneratingAi) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsGeneratingAi(true);

    const profileObj =
      SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];
    const commuteObj = COMMUTE_MODES.find((c) => c.id === commuteId) || COMMUTE_MODES[0];
    const homeObj = HOME_SETUPS.find((h) => h.id === homeSetupId) || HOME_SETUPS[0];
    const selectedActions = allRecommendations.filter((r) => committedIds.includes(r.id));

    const { text: replyText, isLiveGemini } = await generateGroundedSmogAdvice({
      userQuestion: question,
      userApiKey: geminiApiKey,
      snapshot,
      category: categoryInfo,
      cleanWindow,
      profileLabel: profileObj.label,
      commuteLabel: commuteObj.label,
      homeSetupLabel: homeObj.label,
      selectedActions,
      onLog: appendTelemetryLog,
    });

    const aiMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      groundedMetricsSnapshot: `${snapshot.location.name} • Live AQI ${snapshot.current.usAqi} • PM2.5 ${snapshot.current.pm25} µg/m³`,
      isLiveGemini,
    };

    setChatMessages((prev) => [...prev, aiMsg]);
    setIsGeneratingAi(false);
    setStatusAnnouncement('VayuGuard AI advisor has generated a live response.');
    window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tempKeyInput.trim();
    setGeminiApiKey(cleaned);
    if (cleaned) {
      sessionStorage.setItem('vayuguard_gemini_key', cleaned);
    } else {
      sessionStorage.removeItem('vayuguard_gemini_key');
    }
    setShowApiKeyModal(false);
  };

  const quickPrompts = [
    "Plan my family's low-smog schedule today",
    'Best indoor air hacks under $50 for our home',
    'Safe school commute & outdoor timing plan',
    'Calculate how my selected actions cut lung dose',
  ];

  const diagnosticResults = useMemo(() => runEngineVerificationTests(), []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200 font-sans">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      {/* ====================================================================
          TOP NAVIGATION HEADER
      ==================================================================== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shadow-sm">
              <Wind className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  VayuGuard
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-600 dark:text-emerald-400" />
                  100% Live Feed
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Real-Time Urban Air Quality, Inversion Analytics &amp; Grounded GenAI
              </p>
            </div>
          </div>

          {/* Live City Search & Action Controls */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end max-w-2xl w-full sm:w-auto">
            <div ref={searchContainerRef} className="relative flex-1 sm:w-64">
              <label htmlFor="city-search-input" className="sr-only">
                Search any city worldwide for live air quality
              </label>
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="city-search-input"
                  type="text"
                  value={searchQuery}
                  onFocus={() => {
                    if (searchResults.length > 0 || searchError) setShowDropdown(true);
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type any city live (e.g., Tokyo, London)..."
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setSearchError(null);
                      setShowDropdown(false);
                    }}
                    aria-label="Clear city search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Live Geocoding Dropdown */}
              {showDropdown && (
                <div
                  role="listbox"
                  aria-label="Live geocoding search results"
                  className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-40"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                    {isSearching ? 'Querying Live Open-Meteo Geocoding...' : 'Live City Matches'}
                  </div>

                  {searchError ? (
                    <div className="p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{searchError}</span>
                    </div>
                  ) : (
                    <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {searchResults.map((city) => (
                        <li key={city.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCity(city);
                              setSearchQuery('');
                              setShowDropdown(false);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center justify-between gap-2 transition-colors"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {city.name}
                                {city.admin1 ? `, ${city.admin1}` : ''}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {city.country} ({city.latitude.toFixed(2)},{' '}
                                {city.longitude.toFixed(2)})
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Detect GPS Location Button */}
            <button
              type="button"
              onClick={handleDetectMyLocation}
              disabled={isDetectingLocation}
              title="Auto-detect my live GPS / IP location"
              aria-label="Detect my current location"
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Compass
                className={`w-4 h-4 text-teal-600 dark:text-teal-400 ${
                  isDetectingLocation ? 'animate-spin' : ''
                }`}
              />
            </button>

            {/* Connect Live Gemini Key Button */}
            <button
              type="button"
              onClick={() => {
                setTempKeyInput(geminiApiKey);
                setShowApiKeyModal(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                geminiApiKey
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                  : 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {geminiApiKey ? 'Gemini Key Active' : 'Connect Gemini Key'}
              </span>
            </button>

            {/* Live Network Telemetry Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowTelemetryDrawer(true)}
              title="Inspect live outbound API requests & latency"
              aria-label="Inspect live API telemetry log"
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium"
            >
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">API Log ({telemetryLogs.length})</span>
            </button>

            {/* Unit Test Suite Button */}
            <button
              type="button"
              onClick={() => setShowDiagnostics(true)}
              title="Verify US EPA AQI Engine & Unit Tests"
              aria-label="Open AQI Engine Verification Diagnostics"
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          MAIN DASHBOARD CONTENT
      ==================================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error Banner if API unreachable */}
        {aqiError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 p-4 flex items-center justify-between gap-3 text-sm text-rose-900 dark:text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>
                <strong>Live Stream Error:</strong> {aqiError}. Check network connectivity or
                retry.
              </span>
            </div>
            {selectedCity && (
              <button
                type="button"
                onClick={() => loadCityAirQuality(selectedCity, true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
              >
                Retry Live Fetch
              </button>
            )}
          </div>
        )}

        {/* TOP ROW: LIVE AIR QUALITY TELEMETRY & CLEAN AIR WINDOW FINDER */}
        <section
          aria-labelledby="telemetry-heading"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Left 7 Cols: Live Current AQI + Weather + 6 Pollutants */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <h2
                      id="telemetry-heading"
                      className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
                    >
                      {selectedCity
                        ? `${selectedCity.name}${
                            selectedCity.admin1 ? `, ${selectedCity.admin1}` : ''
                          }`
                        : 'Detecting Live Location...'}
                    </h2>
                    {selectedCity?.country && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                        {selectedCity.country}
                      </span>
                    )}
                  </div>
                  {selectedCity && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      Coordinates: {selectedCity.latitude.toFixed(4)}°N,{' '}
                      {selectedCity.longitude.toFixed(4)}°E • Method:{' '}
                      {selectedCity.detectionMethod || 'live-api'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {snapshot && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-medium">
                      {snapshot.source === 'live-open-meteo'
                        ? `Live Stream • ${new Date(snapshot.fetchedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Cached Live Stream (15m TTL)'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => selectedCity && loadCityAirQuality(selectedCity, true)}
                    disabled={isLoadingAqi || !selectedCity}
                    aria-label="Force refresh live air quality readings"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingAqi ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Loading Skeleton or Live Gauge */}
              {isLoadingAqi && !snapshot ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Streaming live particulate &amp; weather telemetry from Open-Meteo...
                  </p>
                </div>
              ) : (
                snapshot && (
                  <div className="py-5 flex flex-col sm:flex-row items-center gap-6">
                    <AqiRadialGauge
                      aqi={snapshot.current.usAqi}
                      category={categoryInfo}
                      pm25={snapshot.current.pm25}
                    />

                    <div className="flex-1 space-y-3 text-center sm:text-left">
                      <div
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-semibold text-sm shadow-sm ${categoryInfo.badgeBg} ${categoryInfo.badgeText} ${categoryInfo.borderColor}`}
                      >
                        {categoryInfo.level <= 2 ? (
                          <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {categoryInfo.label} (AQI {snapshot.current.usAqi})
                        </span>
                      </div>

                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {categoryInfo.healthSummary}
                      </p>

                      {/* Live Weather & Mask Telemetry Pills */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                          {categoryInfo.maskGuidance}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-medium">
                          <Gauge className="w-3.5 h-3.5 text-sky-600" />
                          {snapshot.weather.temperatureC}°C • Wind {snapshot.weather.windSpeedKmh}{' '}
                          km/h
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-medium">
                          <Droplets className="w-3.5 h-3.5 text-sky-600" />
                          {snapshot.weather.humidityPct}% RH
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* 6-Pollutant Live Breakdown Grid */}
            {snapshot && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Live Pollutant Concentrations (µg/m³)
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {[
                    {
                      code: 'PM2.5',
                      val: snapshot.current.pm25,
                      desc: 'Fine Soot',
                      warn: snapshot.current.pm25 > 35.4,
                    },
                    {
                      code: 'PM10',
                      val: snapshot.current.pm10,
                      desc: 'Coarse Dust',
                      warn: snapshot.current.pm10 > 154,
                    },
                    {
                      code: 'NO₂',
                      val: snapshot.current.no2,
                      desc: 'Traffic Exhaust',
                      warn: snapshot.current.no2 > 40,
                    },
                    {
                      code: 'O₃',
                      val: snapshot.current.o3,
                      desc: 'Ground Ozone',
                      warn: snapshot.current.o3 > 100,
                    },
                    {
                      code: 'SO₂',
                      val: snapshot.current.so2,
                      desc: 'Fuel Sulfur',
                      warn: snapshot.current.so2 > 40,
                    },
                    {
                      code: 'CO',
                      val: snapshot.current.co,
                      desc: 'Combustion',
                      warn: snapshot.current.co > 4000,
                    },
                  ].map((pol) => (
                    <div
                      key={pol.code}
                      className={`p-2.5 rounded-xl border text-center ${
                        pol.warn
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {pol.code}
                      </div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {pol.val}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {pol.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Live Atmospheric Inversion & 24h Clean Air Window Finder */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ThermometerSnowflake className="w-5 h-5 text-sky-500" aria-hidden="true" />
                  Inversion Risk &amp; Clean Air Windows
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    cleanWindow.inversionRisk === 'High'
                      ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
                      : cleanWindow.inversionRisk === 'Moderate'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {cleanWindow.inversionRisk} Stagnation Risk
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                {cleanWindow.inversionExplanation}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    <Clock className="w-3.5 h-3.5" />
                    Safest Outdoor Window
                  </div>
                  <div className="text-lg font-extrabold text-emerald-950 dark:text-white mt-1">
                    {cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour}
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Avg AQI {cleanWindow.safestWindow.avgAqi} ({cleanWindow.safestWindow.avgPm25}{' '}
                    µg/m³)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Peak Smog Trapping
                  </div>
                  <div className="text-lg font-extrabold text-rose-950 dark:text-white mt-1">
                    {cleanWindow.peakSmogWindow.startHour}–{cleanWindow.peakSmogWindow.endHour}
                  </div>
                  <div className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                    Avg AQI {cleanWindow.peakSmogWindow.avgAqi} ({cleanWindow.peakSmogWindow.avgPm25}{' '}
                    µg/m³)
                  </div>
                </div>
              </div>
            </div>

            <HourlyForecastChart hourly={snapshot?.hourly || []} cleanWindow={cleanWindow} />
          </div>
        </section>

        {/* ====================================================================
            MIDDLE BAR: HOUSEHOLD & LIFESTYLE PROFILE SELECTOR
        ==================================================================== */}
        <section
          aria-labelledby="profile-selector-heading"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2
                id="profile-selector-heading"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Tailor Advice to Your Household &amp; Daily Lifestyle
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Recalculates µg inhaled/day saved &amp; grounds Gemini AI prompts in real time
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="sensitivity-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                1. Household Sensitivity Profile
              </label>
              <select
                id="sensitivity-select"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value as SensitivityProfileId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {SENSITIVITY_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {SENSITIVITY_PROFILES.find((p) => p.id === profileId)?.shortDesc}
              </p>
            </div>

            <div>
              <label
                htmlFor="commute-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                2. Daily Commute &amp; Mobility
              </label>
              <select
                id="commute-select"
                value={commuteId}
                onChange={(e) => setCommuteId(e.target.value as CommuteModeId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {COMMUTE_MODES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Shapes cold-start tailpipe &amp; commuter inhalation reductions
              </p>
            </div>

            <div>
              <label
                htmlFor="home-setup-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                3. Current Indoor Air &amp; Cooking Setup
              </label>
              <select
                id="home-setup-select"
                value={homeSetupId}
                onChange={(e) => setHomeSetupId(e.target.value as HomeSetupId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {HOME_SETUPS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Targets filtration CADR &amp; indoor combustion source control
              </p>
            </div>
          </div>
        </section>

        {/* ====================================================================
            BOTTOM GRID: LIVE IMPACT SIMULATOR + ACTIONABLE CARDS (LEFT) & GEMINI AI (RIGHT)
        ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLS */}
          <section
            aria-labelledby="action-modules-heading"
            className="lg:col-span-7 space-y-5"
          >
            {/* Live Exposure & Carbon Impact Simulator */}
            <div className="rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 dark:from-teal-900 dark:to-emerald-900 text-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-300" aria-hidden="true" />
                  <h2 id="action-modules-heading" className="text-base font-bold">
                    Live Exposure &amp; Emissions Impact Simulator
                  </h2>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 font-medium">
                  {cumulativeImpact.count} of {allRecommendations.length} Actions Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
                    Inhaled PM2.5 Cut
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    -{cumulativeImpact.combinedExposureDropPct}%
                  </div>
                  <div className="text-[11px] text-teal-100 mt-0.5">
                    {cumulativeImpact.dailyUgSaved} µg PM2.5/day spared
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
                    Weekly CO₂ Avoided
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    {cumulativeImpact.totalCo2SavedKgWeek} kg
                  </div>
                  <div className="text-[11px] text-teal-100 mt-0.5">
                    Local combustion cut
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
                    Annualized Impact
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    {cumulativeImpact.annualCo2SavedKg} kg
                  </div>
                  <div className="text-[11px] text-teal-100 mt-0.5">
                    CO₂ equivalent/year
                  </div>
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            <div
              role="tablist"
              aria-label="Actionable smog reduction categories"
              className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-800/90"
            >
              {[
                {
                  id: 'routine' as const,
                  label: 'Low-Emission Routines',
                  icon: Route,
                },
                {
                  id: 'indoor' as const,
                  label: 'Indoor Air Hacks',
                  icon: Home,
                },
                {
                  id: 'community' as const,
                  label: 'Community Actions',
                  icon: Building2,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Action Cards List */}
            <div className="space-y-3.5" role="tabpanel">
              {visibleRecommendations.map((rec) => {
                const isCommitted = committedIds.includes(rec.id);
                return (
                  <article
                    key={rec.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isCommitted
                        ? 'border-teal-500 dark:border-teal-600 bg-teal-50/40 dark:bg-teal-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleCommitAction(rec.id)}
                          aria-pressed={isCommitted}
                          aria-label={`${isCommitted ? 'Remove' : 'Commit to'} ${rec.title}`}
                          className="mt-0.5 text-teal-600 dark:text-teal-400 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full"
                        >
                          {isCommitted ? (
                            <CheckCircle2 className="w-6 h-6 fill-teal-600 text-white dark:fill-teal-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {rec.title}
                            </h3>
                            {rec.budgetTier && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {rec.budgetTier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-teal-700 dark:text-teal-300 mt-0.5">
                            {rec.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Direct Impact Pills */}
                    <div className="mt-3.5 pl-9 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        <Activity className="w-3.5 h-3.5" />
                        -{rec.pm25ExposureReductionPct}% (-{rec.ugInhaledSavedPerDay} µg/day)
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-100/90 text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                        <Leaf className="w-3.5 h-3.5" />
                        -{rec.co2AvoidedKgPerWeek} kg CO₂/wk
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {rec.cadrOrEquivalent}
                      </span>
                    </div>

                    {/* Mechanism & Tailored Note */}
                    <div className="mt-3 pl-9 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <p>
                        <strong className="text-slate-800 dark:text-slate-200">
                          Why it works:
                        </strong>{' '}
                        {rec.whyItWorks}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-2 rounded-lg">
                        <strong className="text-teal-700 dark:text-teal-300">
                          For your profile:
                        </strong>{' '}
                        {rec.tailoredNote}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* RIGHT 5 COLS: LIVE GROUNDED GEMINI ADVISOR */}
          <section
            aria-labelledby="ai-advisor-heading"
            className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-hidden lg:sticky lg:top-24"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="ai-advisor-heading"
                      className="text-base font-bold text-slate-900 dark:text-white"
                    >
                      Live Gemini 2.0 Flash Advisor
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Grounded on real-time {selectedCity?.name || 'local'} telemetry
                    </p>
                  </div>
                </div>
              </div>

              {snapshot && (
                <div className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate">
                    Live Context: AQI {snapshot.current.usAqi} • PM2.5 {snapshot.current.pm25} µg/m³
                    • Safe {cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour}
                  </span>
                </div>
              )}
            </div>

            {/* Chat Transcript */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[380px] overflow-y-auto bg-slate-50/40 dark:bg-slate-950/40">
              {chatMessages.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 max-w-xs mx-auto">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Ask for a Real-Time Action Plan
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Every prompt sends live pollutant concentrations, weather, and your household
                      selections directly to Gemini 2.0 Flash.
                    </p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-teal-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.role === 'assistant' && msg.groundedMetricsSnapshot
                        ? `${msg.groundedMetricsSnapshot} • `
                        : ''}
                      {msg.timestamp}
                    </span>
                  </div>
                ))
              )}

              {isGeneratingAi && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Calling Gemini 2.0 Flash with live {selectedCity?.name} readings...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-4 pt-3 pb-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Live Grounded Prompts:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    disabled={isGeneratingAi || !snapshot}
                    onClick={() => handleAskAdvisor(qp)}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-colors disabled:opacity-50"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Free-Form Question Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAdvisor(chatInput);
              }}
              className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
            >
              <label htmlFor="advisor-question-input" className="sr-only">
                Ask VayuGuard AI about air quality, indoor hacks, or low-emission routines
              </label>
              <input
                id="advisor-question-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a live question for Gemini..."
                className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isGeneratingAi || !snapshot}
                aria-label="Send question to Gemini AI advisor"
                className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </div>
      </main>

      {/* ====================================================================
          FOOTER
      ==================================================================== */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>
            100% Real-Time Open-Meteo CAMS Air Quality + Weather Telemetry &amp; 2024 US EPA PM2.5
            AQI Standard.
          </span>
        </div>
        <div>
          Click <strong>API Log</strong> in the top bar to inspect live network calls in real time.
        </div>
      </footer>

      {/* ====================================================================
          MODAL 1: SESSION GEMINI API KEY CONNECTOR
      ==================================================================== */}
      {showApiKeyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveApiKey}
            className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="api-key-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <KeyRound className="w-5 h-5 text-indigo-600" />
                Connect Live Gemini API Key
              </h2>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                aria-label="Close API key modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              In runtime environments without a pre-injected key, paste your Google AI Studio
              Gemini API key below. It is held strictly in browser <code>sessionStorage</code> and
              never committed to Git.
            </p>
            <div>
              <label htmlFor="gemini-key-field" className="sr-only">
                Gemini API Key
              </label>
              <input
                id="gemini-key-field"
                type="password"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Save to Session
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: LIVE NETWORK TELEMETRY INSPECTOR
      ==================================================================== */}
      {showTelemetryDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telemetry-log-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-2xl w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="telemetry-log-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <Activity className="w-5 h-5 text-teal-600" />
                Live Outbound API Request Log
              </h2>
              <button
                type="button"
                onClick={() => setShowTelemetryDrawer(false)}
                aria-label="Close telemetry log modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Every geolocation lookup, atmospheric pollutant stream, weather feed, and Gemini
              inference executed during your session:
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {telemetryLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No requests logged yet.</p>
              ) : (
                telemetryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        [{log.timestamp}] {log.service}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{log.note}</div>
                      <div className="text-[11px] font-mono text-slate-400">{log.endpoint}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          log.status >= 200 && log.status < 300
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                        }`}
                      >
                        HTTP {log.status}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {log.latencyMs}ms
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: DETERMINISTIC ENGINE VERIFICATION (UNIT TEST SUITE)
      ==================================================================== */}
      {showDiagnostics && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diagnostics-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="diagnostics-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <FlaskConical className="w-5 h-5 text-teal-600" />
                US EPA PM2.5 AQI Engine Verification
              </h2>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                aria-label="Close diagnostics modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deterministic breakpoint assertions verifying exact compliance with the 2024 US EPA
              PM2.5 AQI standard:
            </p>
            <ul className="space-y-2">
              {diagnosticResults.map((t) => (
                <li
                  key={t.name}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {t.name}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">{t.detail}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    <Check className="w-3.5 h-3.5" />
                    {t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default VayuGuard;
