// ============================================================================
// Live Air Quality Telemetry Panel (AQI Gauge, Weather & 6-Pollutant Grid)
// ============================================================================

import React, { useMemo } from 'react';
import {
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  HeartPulse,
  Gauge,
  Droplets,
} from 'lucide-react';
import type { AirQualitySnapshot, AqiCategoryInfo, CityLocation } from '../types';
import { buildPollutantCards } from '../lib/impact-calculator';
import AqiRadialGauge from './AqiRadialGauge';

interface TelemetryPanelProps {
  selectedCity: CityLocation | null;
  snapshot: AirQualitySnapshot | null;
  categoryInfo: AqiCategoryInfo;
  isLoadingAqi: boolean;
  onForceRefresh: () => void;
}

/**
 * Displays live city metadata, US EPA AQI radial gauge, weather pills,
 * and the 6-pollutant concentration grid.
 */
const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  selectedCity,
  snapshot,
  categoryInfo,
  isLoadingAqi,
  onForceRefresh,
}) => {
  const pollutantCards = useMemo(
    () => (snapshot ? buildPollutantCards(snapshot.current) : []),
    [snapshot]
  );

  const cityHeading = selectedCity
    ? `${selectedCity.name}${selectedCity.admin1 ? `, ${selectedCity.admin1}` : ''}`
    : 'Detecting Live Location...';

  return (
    <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2
                id="telemetry-heading"
                className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
              >
                {cityHeading}
              </h2>
              {selectedCity?.country && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                  {selectedCity.country}
                </span>
              )}
            </div>
            {selectedCity && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                Coordinates: {selectedCity.latitude.toFixed(4)}°N,{' '}
                {selectedCity.longitude.toFixed(4)}°E • Method:{' '}
                {selectedCity.detectionMethod || 'live-api'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {snapshot && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-medium">
                {snapshot.source === 'live-open-meteo'
                  ? `Live Stream • ${new Date(snapshot.fetchedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Cached Live Stream (15m TTL)'}
              </span>
            )}
            <button
              type="button"
              onClick={onForceRefresh}
              disabled={isLoadingAqi || !selectedCity}
              aria-label="Force refresh live air quality readings"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RefreshCw
                aria-hidden="true"
                className={`w-3.5 h-3.5 ${isLoadingAqi ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {isLoadingAqi && !snapshot ? (
          <div
            role="status"
            aria-live="polite"
            className="py-12 flex flex-col items-center justify-center text-center space-y-3"
          >
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Streaming live particulate &amp; weather telemetry from Open-Meteo...
            </p>
          </div>
        ) : (
          snapshot && (
            <div className="py-5 flex flex-col sm:flex-row items-center gap-6">
              <AqiRadialGauge
                aqi={snapshot.current.usAqi}
                category={categoryInfo}
                pm25={snapshot.current.pm25}
              />

              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-semibold text-sm shadow-sm ${categoryInfo.badgeBg} ${categoryInfo.badgeText} ${categoryInfo.borderColor}`}
                >
                  {categoryInfo.level <= 2 ? (
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {categoryInfo.label} (AQI {snapshot.current.usAqi})
                  </span>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {categoryInfo.healthSummary}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                    {categoryInfo.maskGuidance}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-medium">
                    <Gauge className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                    {snapshot.weather.temperatureC}°C • Wind {snapshot.weather.windSpeedKmh} km/h
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-medium">
                    <Droplets className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                    {snapshot.weather.humidityPct}% RH
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {snapshot && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Live Pollutant Concentrations (µg/m³)
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {pollutantCards.map((pol) => (
              <div
                key={pol.code}
                className={`p-2.5 rounded-xl border text-center ${
                  pol.warn
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {pol.code}
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {pol.val}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {pol.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TelemetryPanel;
