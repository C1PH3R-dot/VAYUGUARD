// ============================================================================
// Top Navigation Header & Live City Search Bar
// ============================================================================

import React, { useRef, useEffect } from 'react';
import {
  Wind,
  Search,
  AlertTriangle,
  Sun,
  Moon,
  Activity,
  ChevronRight,
  FlaskConical,
  X,
  KeyRound,
  Radio,
  Compass,
} from 'lucide-react';
import type { CityLocation } from '../types';

interface HeaderBarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: CityLocation[];
  isSearching: boolean;
  searchError: string | null;
  showDropdown: boolean;
  onShowDropdownChange: (open: boolean) => void;
  onSelectCity: (city: CityLocation) => void;
  onClearSearch: () => void;
  isDetectingLocation: boolean;
  onDetectLocation: () => void;
  hasGeminiKey: boolean;
  onOpenApiKeyModal: () => void;
  telemetryCount: number;
  onOpenTelemetryDrawer: () => void;
  onOpenDiagnostics: () => void;
}

const CITY_SEARCH_LISTBOX_ID = 'city-search-listbox';

/**
 * Sticky top navigation bar containing brand identity, live Open-Meteo city search,
 * GPS location detection, Gemini key modal trigger, telemetry log, and theme toggle.
 */
const HeaderBar: React.FC<HeaderBarProps> = ({
  darkMode,
  onToggleDarkMode,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
  searchError,
  showDropdown,
  onShowDropdownChange,
  onSelectCity,
  onClearSearch,
  isDetectingLocation,
  onDetectLocation,
  hasGeminiKey,
  onOpenApiKeyModal,
  telemetryCount,
  onOpenTelemetryDrawer,
  onOpenDiagnostics,
}) => {
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        onShowDropdownChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onShowDropdownChange]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shadow-sm">
            <Wind className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                VayuGuard
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                <Radio
                  className="w-3 h-3 animate-pulse text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                100% Live Feed
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Real-Time Urban Air Quality, Inversion Analytics &amp; Grounded GenAI
            </p>
          </div>
        </div>

        {/* Live City Search & Action Controls */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end max-w-2xl w-full sm:w-auto">
          <div ref={searchContainerRef} className="relative flex-1 sm:w-64">
            <label htmlFor="city-search-input" className="sr-only">
              Search any city worldwide for live air quality
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="city-search-input"
                type="text"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls={CITY_SEARCH_LISTBOX_ID}
                aria-autocomplete="list"
                value={searchQuery}
                onFocus={() => {
                  if (searchResults.length > 0 || searchError) onShowDropdownChange(true);
                }}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onShowDropdownChange(false);
                }}
                placeholder="Type any city live (e.g., Tokyo, London)..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  aria-label="Clear city search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {showDropdown && (
              <div
                id={CITY_SEARCH_LISTBOX_ID}
                role="listbox"
                aria-label="Live geocoding search results"
                className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-40"
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                  {isSearching ? 'Querying Live Open-Meteo Geocoding...' : 'Live City Matches'}
                </div>

                {searchError ? (
                  <div
                    role="status"
                    className="p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{searchError}</span>
                  </div>
                ) : (
                  <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {searchResults.map((city) => (
                      <li key={city.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          onClick={() => onSelectCity(city)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {city.name}
                              {city.admin1 ? `, ${city.admin1}` : ''}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {city.country} ({city.latitude.toFixed(2)},{' '}
                              {city.longitude.toFixed(2)})
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onDetectLocation}
            disabled={isDetectingLocation}
            title="Auto-detect my live GPS / IP location"
            aria-label="Detect my current location"
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Compass
              aria-hidden="true"
              className={`w-4 h-4 text-teal-600 dark:text-teal-400 ${
                isDetectingLocation ? 'animate-spin' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={onOpenApiKeyModal}
            aria-label={hasGeminiKey ? 'Gemini Key Active, click to update' : 'Connect Gemini Key'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              hasGeminiKey
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                : 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:inline">
              {hasGeminiKey ? 'Gemini Key Active' : 'Connect Gemini Key'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenTelemetryDrawer}
            title="Inspect live outbound API requests & latency"
            aria-label={`Inspect live API telemetry log (${telemetryCount} entries)`}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span className="hidden sm:inline">API Log ({telemetryCount})</span>
          </button>

          <button
            type="button"
            onClick={onOpenDiagnostics}
            title="Verify US EPA AQI Engine & Unit Tests"
            aria-label="Open AQI Engine Verification Diagnostics"
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <FlaskConical className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={darkMode}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
