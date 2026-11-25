import { describe, it, expect } from 'vitest';
import {
  calculateCumulativeImpact,
  buildPollutantCards,
  MAX_COMBINED_EXPOSURE_DROP_PCT,
} from '../lib/impact-calculator';
import type { ActionRecommendation, AirQualitySnapshot } from '../types';

const sampleSnapshot: AirQualitySnapshot = {
  location: {
    id: 'om-paris',
    name: 'Paris',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
  },
  fetchedAt: Date.now(),
  source: 'live-open-meteo',
  current: {
    pm25: 40,
    pm10: 160,
    no2: 45,
    o3: 80,
    so2: 10,
    co: 300,
    usAqi: 112,
  },
  weather: { temperatureC: 9, humidityPct: 70, windSpeedKmh: 7 },
  hourly: [],
};

const makeRec = (id: string, dropPct: number, co2: number): ActionRecommendation => ({
  id,
  category: 'routine',
  title: id,
  subtitle: 'sub',
  pm25ExposureReductionPct: dropPct,
  ugInhaledSavedPerDay: 10,
  co2AvoidedKgPerWeek: co2,
  cadrOrEquivalent: 'test',
  whyItWorks: 'test',
  tailoredNote: 'test',
});

describe('Impact Calculator & Pollutant Cards', () => {
  it('returns zeroed summary when snapshot is null or no actions committed', () => {
    const recs = [makeRec('a', 50, 10)];
    expect(calculateCumulativeImpact(recs, [], sampleSnapshot, 'general')).toEqual({
      count: 0,
      combinedExposureDropPct: 0,
      dailyUgSaved: 0,
      totalCo2SavedKgWeek: 0,
      annualCo2SavedKg: 0,
    });
    expect(calculateCumulativeImpact(recs, ['a'], null, 'general').count).toBe(0);
  });

  it('calculates multiplicative exposure reduction and caps at 89%', () => {
    const recs = [makeRec('a', 60, 5.5), makeRec('b', 80, 4.5)];
    const impact = calculateCumulativeImpact(recs, ['a', 'b'], sampleSnapshot, 'general');
    // 1 - (0.4 * 0.2) = 0.92 -> capped at 89%
    expect(impact.count).toBe(2);
    expect(impact.combinedExposureDropPct).toBe(MAX_COMBINED_EXPOSURE_DROP_PCT);
    expect(impact.totalCo2SavedKgWeek).toBe(10);
    expect(impact.annualCo2SavedKg).toBe(520);
    // baseline = 40 * 14 = 560; 560 * 0.89 = 498.4
    expect(impact.dailyUgSaved).toBe(498.4);
  });

  it('builds 6 pollutant cards with threshold warning flags', () => {
    const cards = buildPollutantCards(sampleSnapshot.current);
    expect(cards).toHaveLength(6);
    expect(cards.find((c) => c.code === 'PM2.5')?.warn).toBe(true);
    expect(cards.find((c) => c.code === 'PM10')?.warn).toBe(true);
    expect(cards.find((c) => c.code === 'NO₂')?.warn).toBe(true);
    expect(cards.find((c) => c.code === 'O₃')?.warn).toBe(false);
    expect(cards.find((c) => c.code === 'SO₂')?.warn).toBe(false);
    expect(cards.find((c) => c.code === 'CO')?.warn).toBe(false);
  });
});
