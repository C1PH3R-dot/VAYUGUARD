import { describe, it, expect } from 'vitest';
import { analyzeCleanAirWindows } from '../lib/clean-air-analyzer';
import type { HourlyForecastPoint, LiveWeatherMetrics } from '../types';

function makeHourlySeries(aqis: number[], startHour = 0): HourlyForecastPoint[] {
  return aqis.map((aqi, idx) => {
    const h = (startHour + idx) % 24;
    const hourLabel = `${String(h).padStart(2, '0')}:00`;
    return {
      time: `2026-01-15T${hourLabel}`,
      hourLabel,
      pm25: Math.round((aqi / 2) * 10) / 10,
      pm10: aqi,
      no2: 20,
      o3: 30,
      aqi,
    };
  });
}

describe('Clean Air Window Analyzer', () => {
  const calmColdWeather: LiveWeatherMetrics = {
    temperatureC: 8,
    humidityPct: 82,
    windSpeedKmh: 4.5,
  };

  const breezyMildWeather: LiveWeatherMetrics = {
    temperatureC: 20,
    humidityPct: 45,
    windSpeedKmh: 18.0,
  };

  it('identifies the cleanest and peak smog 3-hour windows', () => {
    // Hours 0..5: high smog (160), hours 6..11: moderate (90), hours 12..14: cleanest (40)
    const aqis = [160, 170, 180, 150, 120, 100, 90, 80, 70, 60, 50, 45, 40, 35, 40, 80, 110, 130];
    const hourly = makeHourlySeries(aqis, 0);

    const analysis = analyzeCleanAirWindows(hourly, 20, 15, breezyMildWeather);

    expect(analysis.safestWindow.startHour).toBe('12:00');
    expect(analysis.safestWindow.endHour).toBe('15:00');
    expect(analysis.safestWindow.avgAqi).toBe(38); // round((40+35+40)/3)

    expect(analysis.peakSmogWindow.startHour).toBe('00:00');
    expect(analysis.peakSmogWindow.endHour).toBe('03:00');
    expect(analysis.peakSmogWindow.avgAqi).toBe(170); // round((160+170+180)/3)
  });

  it('wraps endHour cleanly past midnight', () => {
    const hourly = makeHourlySeries([120, 110, 100, 40, 40, 40], 19);
    // index 3 starts at hour (19+3)%24 = 22:00 -> endHour should be 01:00
    const analysis = analyzeCleanAirWindows(hourly, 15, 10, breezyMildWeather);
    expect(analysis.safestWindow.startHour).toBe('22:00');
    expect(analysis.safestWindow.endHour).toBe('01:00');
  });

  it('uses fallback windows when fewer than 3 hourly points are provided', () => {
    const emptyResult = analyzeCleanAirWindows([], 60, 20, calmColdWeather);
    expect(emptyResult.safestWindow.startHour).toBe('13:00');
    expect(emptyResult.peakSmogWindow.startHour).toBe('07:00');
    expect(emptyResult.inversionRisk).toBe('High');

    const modResult = analyzeCleanAirWindows(makeHourlySeries([90, 95]), 40, 20, breezyMildWeather);
    expect(modResult.inversionRisk).toBe('Moderate');

    const lowResult = analyzeCleanAirWindows([], 10, 10, breezyMildWeather);
    expect(lowResult.inversionRisk).toBe('Low');
  });

  it('classifies High, Moderate, and Low inversion risk accurately', () => {
    const flatHourly = makeHourlySeries(Array(12).fill(50));

    // High: PM2.5 >= 55.5
    const highPm = analyzeCleanAirWindows(flatHourly, 56, 15, breezyMildWeather);
    expect(highPm.inversionRisk).toBe('High');

    // High: calm wind + cold surface + PM2.5 >= 28
    const highWeather = analyzeCleanAirWindows(flatHourly, 30, 15, calmColdWeather);
    expect(highWeather.inversionRisk).toBe('High');

    // Moderate: elevated NO2 >= 35 with breezy weather and low PM2.5
    const modNo2 = analyzeCleanAirWindows(flatHourly, 12, 40, breezyMildWeather);
    expect(modNo2.inversionRisk).toBe('Moderate');

    // Low: clean PM2.5, low NO2, breezy, minimal diurnal swing
    const lowRisk = analyzeCleanAirWindows(flatHourly, 10, 12, breezyMildWeather);
    expect(lowRisk.inversionRisk).toBe('Low');
    expect(lowRisk.inversionExplanation).toContain('18 km/h');
  });
});
