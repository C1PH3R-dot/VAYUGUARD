import { describe, it, expect } from 'vitest';
import {
  PM25_BREAKPOINTS,
  calculateUsEpaPm25Aqi,
  getAqiCategoryInfo,
  runEngineVerificationTests,
} from '../lib/aqi-engine';

describe('US EPA PM2.5 AQI Engine', () => {
  it('defines contiguous 2024 US EPA PM2.5 breakpoints', () => {
    expect(PM25_BREAKPOINTS).toHaveLength(6);
    expect(PM25_BREAKPOINTS[0].cLow).toBe(0.0);
    expect(PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1].cHigh).toBe(500.4);
  });

  it('computes exact AQI at all category boundaries', () => {
    expect(calculateUsEpaPm25Aqi(0)).toBe(0);
    expect(calculateUsEpaPm25Aqi(9.0)).toBe(50);
    expect(calculateUsEpaPm25Aqi(9.1)).toBe(51);
    expect(calculateUsEpaPm25Aqi(35.4)).toBe(100);
    expect(calculateUsEpaPm25Aqi(35.5)).toBe(101);
    expect(calculateUsEpaPm25Aqi(55.4)).toBe(150);
    expect(calculateUsEpaPm25Aqi(55.5)).toBe(151);
    expect(calculateUsEpaPm25Aqi(125.4)).toBe(200);
    expect(calculateUsEpaPm25Aqi(125.5)).toBe(201);
    expect(calculateUsEpaPm25Aqi(225.4)).toBe(300);
    expect(calculateUsEpaPm25Aqi(225.5)).toBe(301);
    expect(calculateUsEpaPm25Aqi(500.4)).toBe(500);
  });

  it('truncates PM2.5 to 1 decimal place before lookup', () => {
    expect(calculateUsEpaPm25Aqi(9.09)).toBe(50);
    expect(calculateUsEpaPm25Aqi(35.49)).toBe(100);
  });

  it('handles out-of-range, negative, and non-finite inputs safely', () => {
    expect(calculateUsEpaPm25Aqi(-10)).toBe(0);
    expect(calculateUsEpaPm25Aqi(-0.1)).toBe(0);
    expect(calculateUsEpaPm25Aqi(650)).toBe(500);
    expect(calculateUsEpaPm25Aqi(Number.NaN)).toBe(0);
    expect(calculateUsEpaPm25Aqi(Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateUsEpaPm25Aqi(undefined as unknown as number)).toBe(0);
  });

  it('maps AQI values to all 6 category levels', () => {
    expect(getAqiCategoryInfo(0)).toMatchObject({ level: 1, label: 'Good', shortLabel: 'Good' });
    expect(getAqiCategoryInfo(50).level).toBe(1);
    expect(getAqiCategoryInfo(51)).toMatchObject({ level: 2, label: 'Moderate' });
    expect(getAqiCategoryInfo(100).level).toBe(2);
    expect(getAqiCategoryInfo(101)).toMatchObject({
      level: 3,
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'USG',
    });
    expect(getAqiCategoryInfo(150).level).toBe(3);
    expect(getAqiCategoryInfo(151)).toMatchObject({ level: 4, label: 'Unhealthy' });
    expect(getAqiCategoryInfo(200).level).toBe(4);
    expect(getAqiCategoryInfo(201)).toMatchObject({ level: 5, label: 'Very Unhealthy' });
    expect(getAqiCategoryInfo(300).level).toBe(5);
    expect(getAqiCategoryInfo(301)).toMatchObject({ level: 6, label: 'Hazardous' });
    expect(getAqiCategoryInfo(500).level).toBe(6);
  });

  it('passes all built-in engine verification assertions', () => {
    const results = runEngineVerificationTests();
    expect(results.length).toBeGreaterThanOrEqual(6);
    for (const testCase of results) {
      expect(testCase.passed).toBe(true);
    }
  });
});
