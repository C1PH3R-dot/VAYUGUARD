// ============================================================================
// Inversion Risk & 24-Hour Clean Air Window Panel
// ============================================================================

import React from 'react';
import { ThermometerSnowflake, Clock, AlertTriangle } from 'lucide-react';
import type { CleanWindowAnalysis, HourlyForecastPoint } from '../types';
import HourlyForecastChart from './HourlyForecastChart';

interface InversionWindowPanelProps {
  cleanWindow: CleanWindowAnalysis;
  hourly: HourlyForecastPoint[];
}

const INVERSION_RISK_STYLES: Record<CleanWindowAnalysis['inversionRisk'], string> = {
  High: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
  Moderate:
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  Low: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
};

/**
 * Displays atmospheric stagnation/inversion risk, cleanest vs. peak smog 3-hour
 * windows, and the 24-hour hourly forecast bar chart.
 */
const InversionWindowPanel: React.FC<InversionWindowPanelProps> = ({
  cleanWindow,
  hourly,
}) => {
  return (
    <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ThermometerSnowflake className="w-5 h-5 text-sky-500" aria-hidden="true" />
            Inversion Risk &amp; Clean Air Windows
          </h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              INVERSION_RISK_STYLES[cleanWindow.inversionRisk]
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
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Safest Outdoor Window
            </div>
            <div className="text-lg font-extrabold text-emerald-950 dark:text-white mt-1">
              {cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour}
            </div>
            <div className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
              Avg AQI {cleanWindow.safestWindow.avgAqi} ({cleanWindow.safestWindow.avgPm25} µg/m³)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
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

      <HourlyForecastChart hourly={hourly} cleanWindow={cleanWindow} />
    </div>
  );
};

export default InversionWindowPanel;
