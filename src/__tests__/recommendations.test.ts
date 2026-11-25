import { describe, it, expect } from 'vitest';
import { SENSITIVITY_PROFILES, COMMUTE_MODES, HOME_SETUPS } from '../lib/profiles';
import { buildTailoredRecommendations } from '../lib/recommendations';
import type { AirQualitySnapshot, CleanWindowAnalysis } from '../types';

const baseSnapshot: AirQualitySnapshot = {
  location: {
    id: 'test-london',
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    detectionMethod: 'live-search',
  },
  fetchedAt: Date.now(),
  source: 'live-open-meteo',
  current: {
    pm25: 42.0,
    pm10: 65.0,
    no2: 45.0,
    o3: 32.0,
    so2: 6.0,
    co: 380.0,
    usAqi: 117,
  },
  weather: {
    temperatureC: 7.5,
    humidityPct: 78,
    windSpeedKmh: 6.2,
  },
  hourly: [],
};

const baseCleanWindow: CleanWindowAnalysis = {
  safestWindow: { startHour: '13:00', endHour: '16:00', avgAqi: 72, avgPm25: 22.0 },
  peakSmogWindow: { startHour: '07:00', endHour: '10:00', avgAqi: 152, avgPm25: 56.0 },
  inversionRisk: 'High',
  inversionExplanation: 'Calm cold inversion',
};

describe('Profiles & Recommendation Engine', () => {
  it('provides valid sensitivity profiles, commute modes, and home setups', () => {
    expect(SENSITIVITY_PROFILES.length).toBeGreaterThanOrEqual(5);
    for (const p of SENSITIVITY_PROFILES) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.dailyVentilationM3).toBeGreaterThan(0);
    }
    expect(COMMUTE_MODES.map((c) => c.id)).toEqual(['car', 'transit', 'active', 'remote']);
    expect(HOME_SETUPS.map((h) => h.id)).toEqual(['natural', 'hepa', 'corsi', 'gas_incense']);
  });

  it('builds 9 tailored recommendations across 3 categories', () => {
    const recs = buildTailoredRecommendations(
      baseSnapshot,
      baseCleanWindow,
      'children',
      'car',
      'natural'
    );
    expect(recs).toHaveLength(9);
    expect(recs.filter((r) => r.category === 'routine')).toHaveLength(3);
    expect(recs.filter((r) => r.category === 'indoor')).toHaveLength(3);
    expect(recs.filter((r) => r.category === 'community')).toHaveLength(3);

    const windowShift = recs.find((r) => r.id === 'routine-window-shift');
    expect(windowShift?.title).toContain('13:00–16:00');
    expect(windowShift?.tailoredNote).toContain('school playground');
  });

  it('adapts commute, home setup, and high-smog mask advice', () => {
    const recsActive = buildTailoredRecommendations(
      baseSnapshot,
      baseCleanWindow,
      'outdoor',
      'active',
      'hepa'
    );
    const commuteRec = recsActive.find((r) => r.id === 'routine-commute-swap');
    expect(commuteRec?.pm25ExposureReductionPct).toBe(42);
    expect(commuteRec?.tailoredNote).toContain('Live NO2 is elevated');

    const indoorRec = recsActive.find((r) => r.id === 'indoor-filtration');
    expect(indoorRec?.title).toContain('Run HEPA Purifier');
    expect(indoorRec?.budgetTier).toBe('Free');

    const maskRec = recsActive.find((r) => r.id === 'routine-mask-ventilation');
    expect(maskRec?.pm25ExposureReductionPct).toBe(68);
  });

  it('handles zero PM2.5 and low AQI gracefully', () => {
    const cleanSnapshot: AirQualitySnapshot = {
      ...baseSnapshot,
      current: { ...baseSnapshot.current, pm25: 0, no2: 5, usAqi: 0 },
    };
    const recs = buildTailoredRecommendations(
      cleanSnapshot,
      baseCleanWindow,
      'general',
      'remote',
      'gas_incense'
    );
    for (const r of recs) {
      expect(r.ugInhaledSavedPerDay).toBe(0);
    }
    const maskRec = recs.find((r) => r.id === 'routine-mask-ventilation');
    expect(maskRec?.pm25ExposureReductionPct).toBe(22);

    const sourceRec = recs.find((r) => r.id === 'indoor-source-control');
    expect(sourceRec?.pm25ExposureReductionPct).toBe(54);
  });
});
