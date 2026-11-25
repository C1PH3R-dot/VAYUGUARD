// ============================================================================
// Exposure & Carbon Impact Calculator + Pollutant Threshold Constants
// ============================================================================

import type {
  ActionRecommendation,
  AirQualitySnapshot,
  SensitivityProfileId,
} from '../types';
import { SENSITIVITY_PROFILES } from './profiles';

/** Upper bound on combined multiplicative PM2.5 exposure reduction (%). */
export const MAX_COMBINED_EXPOSURE_DROP_PCT = 89;

/** Number of weeks per year used for annualized CO2 savings. */
export const WEEKS_PER_YEAR = 52;

/**
 * Advisory thresholds (µg/m³) for highlighting elevated live pollutants.
 * Based on US EPA 24-hour / WHO short-term guideline references.
 */
export const POLLUTANT_WARN_THRESHOLDS = {
  pm25: 35.4,
  pm10: 154,
  no2: 40,
  o3: 100,
  so2: 40,
  co: 4000,
} as const;

export interface CumulativeImpactSummary {
  count: number;
  combinedExposureDropPct: number;
  dailyUgSaved: number;
  totalCo2SavedKgWeek: number;
  annualCo2SavedKg: number;
}

export interface PollutantCardData {
  code: string;
  val: number;
  desc: string;
  warn: boolean;
}

/**
 * Compute cumulative PM2.5 exposure reduction and CO2 savings for committed actions.
 * Uses multiplicative independence: R_total = 1 - prod(1 - r_i), capped at 89%.
 */
export function calculateCumulativeImpact(
  allRecommendations: readonly ActionRecommendation[],
  committedIds: readonly string[],
  snapshot: AirQualitySnapshot | null,
  profileId: SensitivityProfileId
): CumulativeImpactSummary {
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
    const boundedPct = Math.max(0, Math.min(100, item.pm25ExposureReductionPct));
    remainingExposure *= 1 - boundedPct / 100;
    weeklyCo2 += item.co2AvoidedKgPerWeek;
  }

  const combinedDrop = Math.min(
    MAX_COMBINED_EXPOSURE_DROP_PCT,
    Math.round((1 - remainingExposure) * 100)
  );
  const dailyUgSaved = Math.round(baselineUgPerDay * (combinedDrop / 100) * 10) / 10;

  return {
    count: chosen.length,
    combinedExposureDropPct: combinedDrop,
    dailyUgSaved,
    totalCo2SavedKgWeek: Number(weeklyCo2.toFixed(1)),
    annualCo2SavedKg: Math.round(weeklyCo2 * WEEKS_PER_YEAR),
  };
}

/** Build structured display cards for the 6 monitored live pollutants. */
export function buildPollutantCards(
  current: AirQualitySnapshot['current']
): PollutantCardData[] {
  return [
    {
      code: 'PM2.5',
      val: current.pm25,
      desc: 'Fine Soot',
      warn: current.pm25 > POLLUTANT_WARN_THRESHOLDS.pm25,
    },
    {
      code: 'PM10',
      val: current.pm10,
      desc: 'Coarse Dust',
      warn: current.pm10 > POLLUTANT_WARN_THRESHOLDS.pm10,
    },
    {
      code: 'NO₂',
      val: current.no2,
      desc: 'Traffic Exhaust',
      warn: current.no2 > POLLUTANT_WARN_THRESHOLDS.no2,
    },
    {
      code: 'O₃',
      val: current.o3,
      desc: 'Ground Ozone',
      warn: current.o3 > POLLUTANT_WARN_THRESHOLDS.o3,
    },
    {
      code: 'SO₂',
      val: current.so2,
      desc: 'Fuel Sulfur',
      warn: current.so2 > POLLUTANT_WARN_THRESHOLDS.so2,
    },
    {
      code: 'CO',
      val: current.co,
      desc: 'Combustion',
      warn: current.co > POLLUTANT_WARN_THRESHOLDS.co,
    },
  ];
}
