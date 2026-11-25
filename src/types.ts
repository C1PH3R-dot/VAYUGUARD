// ============================================================================
// Strict Types & Domain Interfaces for VayuGuard
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
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    so2: number;
    co: number;
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

export type TelemetryLogger = (entry: Omit<ApiTelemetryLog, 'id' | 'timestamp'>) => void;
