// ============================================================================
// Custom Accessible SVG Hourly Forecast Chart
// ============================================================================

import React from 'react';
import type { HourlyForecastPoint, CleanWindowAnalysis } from '../types';
import { getAqiCategoryInfo } from '../lib/aqi-engine';

interface HourlyForecastChartProps {
  hourly: HourlyForecastPoint[];
  cleanWindow: CleanWindowAnalysis;
}

const HourlyForecastChart: React.FC<HourlyForecastChartProps> = ({ hourly, cleanWindow }) => {
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
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" aria-hidden="true" />
            Cleanest ({cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" aria-hidden="true" />
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

export default HourlyForecastChart;
