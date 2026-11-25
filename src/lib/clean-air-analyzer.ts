// ============================================================================
// Clean Air Window Analyzer
// ============================================================================

import type { HourlyForecastPoint, LiveWeatherMetrics, CleanWindowAnalysis } from '../types';
import { calculateUsEpaPm25Aqi } from './aqi-engine';

/**
 * Analyze 24-hour hourly data to find the cleanest and worst 3-hour windows,
 * and assess atmospheric inversion risk.
 */
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
