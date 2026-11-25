// ============================================================================
// Deterministic US EPA AQI & Exposure Impact Engine (Unit-Testable)
// ============================================================================

import type { AqiCategoryInfo } from '../types';

/** PM2.5 breakpoint table per 2024 US EPA standard. */
export const PM25_BREAKPOINTS: ReadonlyArray<{
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

/**
 * Compute the US EPA AQI from a raw PM2.5 concentration (µg/m³).
 * Truncates to one decimal, clamps negatives to 0, caps at 500.
 */
export function calculateUsEpaPm25Aqi(pm25Raw: number): number {
  if (!Number.isFinite(pm25Raw)) return 0;
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

/** Map an AQI value to its category metadata (label, colors, guidance). */
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

/** Built-in verification test suite for the AQI engine. */
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
