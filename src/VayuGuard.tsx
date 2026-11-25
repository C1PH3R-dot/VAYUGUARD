import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Wind,
  ShieldAlert,
  ShieldCheck,
  Search,
  MapPin,
  Users,
  HeartPulse,
  Sparkles,
  Home,
  Route,
  Building2,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Info,
  Sun,
  Moon,
  Send,
  RefreshCw,
  ThermometerSnowflake,
  Leaf,
  Activity,
  Award,
  Sliders,
  ChevronRight,
  Check,
  BookOpen,
  FlaskConical,
  X,
  KeyRound,
  Radio,
  Compass,
  Droplets,
  Gauge,
} from 'lucide-react';
import type {
  SensitivityProfileId,
  CommuteModeId,
  HomeSetupId,
  CityLocation,
  AirQualitySnapshot,
  ApiTelemetryLog,
  ChatMessage,
} from './types';
import { getAqiCategoryInfo, runEngineVerificationTests } from './lib/aqi-engine';
import { analyzeCleanAirWindows } from './lib/clean-air-analyzer';
import { SENSITIVITY_PROFILES, COMMUTE_MODES, HOME_SETUPS } from './lib/profiles';
import {
  detectLiveUserLocation,
  searchCitiesLive,
  fetchLiveAirQualityAndWeather,
} from './lib/api-services';
import { buildTailoredRecommendations } from './lib/recommendations';
import { generateGroundedSmogAdvice } from './lib/gemini-advisor';
import AqiRadialGauge from './components/AqiRadialGauge';
import HourlyForecastChart from './components/HourlyForecastChart';

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export function VayuGuard() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Live location & search states (zero pre-fed static snapshot)
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CityLocation[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Live air quality & weather states
  const [snapshot, setSnapshot] = useState<AirQualitySnapshot | null>(null);
  const [isLoadingAqi, setIsLoadingAqi] = useState<boolean>(true);
  const [aqiError, setAqiError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');

  // Live API Telemetry Log (proves every call is real-time)
  const [telemetryLogs, setTelemetryLogs] = useState<ApiTelemetryLog[]>([]);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState<boolean>(false);

  // Session-only Gemini API Key (optional override if env key is not bundled)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('vayuguard_gemini_key') ||
        (import.meta.env.VITE_GEMINI_API_KEY as string) ||
        ''
      );
    }
    return (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>('');

  // Household & Lifestyle Profile state
  const [profileId, setProfileId] = useState<SensitivityProfileId>('children');
  const [commuteId, setCommuteId] = useState<CommuteModeId>('car');
  const [homeSetupId, setHomeSetupId] = useState<HomeSetupId>('natural');

  // Action Planner state
  const [activeTab, setActiveTab] = useState<'routine' | 'indoor' | 'community'>('routine');
  const [committedIds, setCommittedIds] = useState<string[]>([
    'routine-window-shift',
    'indoor-filtration',
  ]);

  // Live Gemini Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Unit Test Verification Modal
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const appendTelemetryLog = useCallback(
    (entry: Omit<ApiTelemetryLog, 'id' | 'timestamp'>) => {
      const logItem: ApiTelemetryLog = {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      setTelemetryLogs((prev) => [logItem, ...prev.slice(0, 24)]);
    },
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  // 1. Auto-detect live location on initial load
  const handleDetectMyLocation = useCallback(async () => {
    setIsDetectingLocation(true);
    setAqiError(null);
    const detected = await detectLiveUserLocation(appendTelemetryLog);
    setSelectedCity(detected);
    setIsDetectingLocation(false);
  }, [appendTelemetryLog]);

  useEffect(() => {
    handleDetectMyLocation();
  }, [handleDetectMyLocation]);

  // 2. Fetch live Open-Meteo Air Quality & Weather whenever selectedCity updates
  const loadCityAirQuality = useCallback(
    async (city: CityLocation, force = false) => {
      setIsLoadingAqi(true);
      setAqiError(null);
      try {
        const data = await fetchLiveAirQualityAndWeather(city, appendTelemetryLog, force);
        setSnapshot(data);
        const cat = getAqiCategoryInfo(data.current.usAqi);
        setStatusAnnouncement(
          `Live air quality loaded for ${city.name}, ${city.country}. US EPA AQI is ${data.current.usAqi}, ${cat.label}. PM2.5 is ${data.current.pm25} micrograms per cubic meter.`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to load live telemetry';
        setAqiError(msg);
      } finally {
        setIsLoadingAqi(false);
      }
    },
    [appendTelemetryLog]
  );

  useEffect(() => {
    if (selectedCity) {
      loadCityAirQuality(selectedCity);
    }
  }, [selectedCity, loadCityAirQuality]);

  // 3. Live Debounced Open-Meteo Geocoding Search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const matches = await searchCitiesLive(trimmed, appendTelemetryLog);
        setSearchResults(matches);
        if (matches.length === 0) {
          setSearchError(`No matching cities found for "${trimmed}"`);
        }
        setShowDropdown(true);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setShowDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [searchQuery, appendTelemetryLog]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derived analytics
  const categoryInfo = useMemo(() => {
    return getAqiCategoryInfo(snapshot?.current.usAqi ?? 0);
  }, [snapshot]);

  const cleanWindow = useMemo(() => {
    if (!snapshot) {
      return {
        safestWindow: { startHour: '--:--', endHour: '--:--', avgAqi: 0, avgPm25: 0 },
        peakSmogWindow: { startHour: '--:--', endHour: '--:--', avgAqi: 0, avgPm25: 0 },
        inversionRisk: 'Low' as const,
        inversionExplanation: 'Awaiting live atmospheric telemetry...',
      };
    }
    return analyzeCleanAirWindows(
      snapshot.hourly,
      snapshot.current.pm25,
      snapshot.current.no2,
      snapshot.weather
    );
  }, [snapshot]);

  const allRecommendations = useMemo(() => {
    if (!snapshot) return [];
    return buildTailoredRecommendations(
      snapshot,
      cleanWindow,
      profileId,
      commuteId,
      homeSetupId
    );
  }, [snapshot, cleanWindow, profileId, commuteId, homeSetupId]);

  const visibleRecommendations = useMemo(
    () => allRecommendations.filter((r) => r.category === activeTab),
    [allRecommendations, activeTab]
  );

  // Live-scaled Cumulative Exposure & Carbon Impact Calculator
  const cumulativeImpact = useMemo(() => {
    const chosen = allRecommendations.filter((r) => committedIds.includes(r.id));
    if (chosen.length === 0 || !snapshot) {
      return {
        count: 0,
        combinedExposureDropPct: 0,
        dailyUgSaved: 0,
        totalCo2SavedKgWeek: 0,
        annualCo2SavedKg: 0,
      };
    }
    const profileObj =
      SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];
    const baselineUgPerDay = snapshot.current.pm25 * profileObj.dailyVentilationM3;

    let remainingExposure = 1.0;
    let weeklyCo2 = 0;
    for (const item of chosen) {
      remainingExposure *= 1 - item.pm25ExposureReductionPct / 100;
      weeklyCo2 += item.co2AvoidedKgPerWeek;
    }
    const combinedDrop = Math.min(89, Math.round((1 - remainingExposure) * 100));
    const dailyUgSaved = Math.round(baselineUgPerDay * (combinedDrop / 100) * 10) / 10;

    return {
      count: chosen.length,
      combinedExposureDropPct: combinedDrop,
      dailyUgSaved,
      totalCo2SavedKgWeek: Number(weeklyCo2.toFixed(1)),
      annualCo2SavedKg: Math.round(weeklyCo2 * 52),
    };
  }, [allRecommendations, committedIds, snapshot, profileId]);

  const toggleCommitAction = (id: string) => {
    setCommittedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Live Gemini Grounded Advisor Handler
  const handleAskAdvisor = async (promptText: string) => {
    const question = promptText.trim();
    if (!question || !snapshot || isGeneratingAi) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsGeneratingAi(true);

    const profileObj =
      SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];
    const commuteObj = COMMUTE_MODES.find((c) => c.id === commuteId) || COMMUTE_MODES[0];
    const homeObj = HOME_SETUPS.find((h) => h.id === homeSetupId) || HOME_SETUPS[0];
    const selectedActions = allRecommendations.filter((r) => committedIds.includes(r.id));

    const { text: replyText, isLiveGemini } = await generateGroundedSmogAdvice({
      userQuestion: question,
      userApiKey: geminiApiKey,
      snapshot,
      category: categoryInfo,
      cleanWindow,
      profileLabel: profileObj.label,
      commuteLabel: commuteObj.label,
      homeSetupLabel: homeObj.label,
      selectedActions,
      onLog: appendTelemetryLog,
    });

    const aiMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      groundedMetricsSnapshot: `${snapshot.location.name} • Live AQI ${snapshot.current.usAqi} • PM2.5 ${snapshot.current.pm25} µg/m³`,
      isLiveGemini,
    };

    setChatMessages((prev) => [...prev, aiMsg]);
    setIsGeneratingAi(false);
    setStatusAnnouncement('VayuGuard AI advisor has generated a live response.');
    window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, 80);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tempKeyInput.trim();
    setGeminiApiKey(cleaned);
    if (cleaned) {
      sessionStorage.setItem('vayuguard_gemini_key', cleaned);
    } else {
      sessionStorage.removeItem('vayuguard_gemini_key');
    }
    setShowApiKeyModal(false);
  };

  const quickPrompts = [
    "Plan my family's low-smog schedule today",
    'Best indoor air hacks under $50 for our home',
    'Safe school commute & outdoor timing plan',
    'Calculate how my selected actions cut lung dose',
  ];

  const diagnosticResults = useMemo(() => runEngineVerificationTests(), []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200 font-sans">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      {/* ====================================================================
          TOP NAVIGATION HEADER
      ==================================================================== */}
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
                  <Radio className="w-3 h-3 animate-pulse text-emerald-600 dark:text-emerald-400" />
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
                  value={searchQuery}
                  onFocus={() => {
                    if (searchResults.length > 0 || searchError) setShowDropdown(true);
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type any city live (e.g., Tokyo, London)..."
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setSearchError(null);
                      setShowDropdown(false);
                    }}
                    aria-label="Clear city search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Live Geocoding Dropdown */}
              {showDropdown && (
                <div
                  role="listbox"
                  aria-label="Live geocoding search results"
                  className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-40"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                    {isSearching ? 'Querying Live Open-Meteo Geocoding...' : 'Live City Matches'}
                  </div>

                  {searchError ? (
                    <div className="p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{searchError}</span>
                    </div>
                  ) : (
                    <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {searchResults.map((city) => (
                        <li key={city.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCity(city);
                              setSearchQuery('');
                              setShowDropdown(false);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center justify-between gap-2 transition-colors"
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
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Detect GPS Location Button */}
            <button
              type="button"
              onClick={handleDetectMyLocation}
              disabled={isDetectingLocation}
              title="Auto-detect my live GPS / IP location"
              aria-label="Detect my current location"
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Compass
                className={`w-4 h-4 text-teal-600 dark:text-teal-400 ${
                  isDetectingLocation ? 'animate-spin' : ''
                }`}
              />
            </button>

            {/* Connect Live Gemini Key Button */}
            <button
              type="button"
              onClick={() => {
                setTempKeyInput(geminiApiKey);
                setShowApiKeyModal(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                geminiApiKey
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                  : 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {geminiApiKey ? 'Gemini Key Active' : 'Connect Gemini Key'}
              </span>
            </button>

            {/* Live Network Telemetry Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowTelemetryDrawer(true)}
              title="Inspect live outbound API requests & latency"
              aria-label="Inspect live API telemetry log"
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium"
            >
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">API Log ({telemetryLogs.length})</span>
            </button>

            {/* Unit Test Suite Button */}
            <button
              type="button"
              onClick={() => setShowDiagnostics(true)}
              title="Verify US EPA AQI Engine & Unit Tests"
              aria-label="Open AQI Engine Verification Diagnostics"
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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

      {/* ====================================================================
          MAIN DASHBOARD CONTENT
      ==================================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error Banner if API unreachable */}
        {aqiError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 p-4 flex items-center justify-between gap-3 text-sm text-rose-900 dark:text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>
                <strong>Live Stream Error:</strong> {aqiError}. Check network connectivity or
                retry.
              </span>
            </div>
            {selectedCity && (
              <button
                type="button"
                onClick={() => loadCityAirQuality(selectedCity, true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
              >
                Retry Live Fetch
              </button>
            )}
          </div>
        )}

        {/* TOP ROW: LIVE AIR QUALITY TELEMETRY & CLEAN AIR WINDOW FINDER */}
        <section
          aria-labelledby="telemetry-heading"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Left 7 Cols: Live Current AQI + Weather + 6 Pollutants */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <h2
                      id="telemetry-heading"
                      className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
                    >
                      {selectedCity
                        ? `${selectedCity.name}${
                            selectedCity.admin1 ? `, ${selectedCity.admin1}` : ''
                          }`
                        : 'Detecting Live Location...'}
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
                    onClick={() => selectedCity && loadCityAirQuality(selectedCity, true)}
                    disabled={isLoadingAqi || !selectedCity}
                    aria-label="Force refresh live air quality readings"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingAqi ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Loading Skeleton or Live Gauge */}
              {isLoadingAqi && !snapshot ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
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

                      {/* Live Weather & Mask Telemetry Pills */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                          {categoryInfo.maskGuidance}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-medium">
                          <Gauge className="w-3.5 h-3.5 text-sky-600" />
                          {snapshot.weather.temperatureC}°C • Wind {snapshot.weather.windSpeedKmh}{' '}
                          km/h
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-medium">
                          <Droplets className="w-3.5 h-3.5 text-sky-600" />
                          {snapshot.weather.humidityPct}% RH
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* 6-Pollutant Live Breakdown Grid */}
            {snapshot && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Live Pollutant Concentrations (µg/m³)
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {[
                    {
                      code: 'PM2.5',
                      val: snapshot.current.pm25,
                      desc: 'Fine Soot',
                      warn: snapshot.current.pm25 > 35.4,
                    },
                    {
                      code: 'PM10',
                      val: snapshot.current.pm10,
                      desc: 'Coarse Dust',
                      warn: snapshot.current.pm10 > 154,
                    },
                    {
                      code: 'NO₂',
                      val: snapshot.current.no2,
                      desc: 'Traffic Exhaust',
                      warn: snapshot.current.no2 > 40,
                    },
                    {
                      code: 'O₃',
                      val: snapshot.current.o3,
                      desc: 'Ground Ozone',
                      warn: snapshot.current.o3 > 100,
                    },
                    {
                      code: 'SO₂',
                      val: snapshot.current.so2,
                      desc: 'Fuel Sulfur',
                      warn: snapshot.current.so2 > 40,
                    },
                    {
                      code: 'CO',
                      val: snapshot.current.co,
                      desc: 'Combustion',
                      warn: snapshot.current.co > 4000,
                    },
                  ].map((pol) => (
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

          {/* Right 5 Cols: Live Atmospheric Inversion & 24h Clean Air Window Finder */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ThermometerSnowflake className="w-5 h-5 text-sky-500" aria-hidden="true" />
                  Inversion Risk &amp; Clean Air Windows
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    cleanWindow.inversionRisk === 'High'
                      ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
                      : cleanWindow.inversionRisk === 'Moderate'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
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
                    <Clock className="w-3.5 h-3.5" />
                    Safest Outdoor Window
                  </div>
                  <div className="text-lg font-extrabold text-emerald-950 dark:text-white mt-1">
                    {cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour}
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Avg AQI {cleanWindow.safestWindow.avgAqi} ({cleanWindow.safestWindow.avgPm25}{' '}
                    µg/m³)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
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

            <HourlyForecastChart hourly={snapshot?.hourly || []} cleanWindow={cleanWindow} />
          </div>
        </section>

        {/* ====================================================================
            MIDDLE BAR: HOUSEHOLD & LIFESTYLE PROFILE SELECTOR
        ==================================================================== */}
        <section
          aria-labelledby="profile-selector-heading"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2
                id="profile-selector-heading"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Tailor Advice to Your Household &amp; Daily Lifestyle
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Recalculates µg inhaled/day saved &amp; grounds Gemini AI prompts in real time
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="sensitivity-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                1. Household Sensitivity Profile
              </label>
              <select
                id="sensitivity-select"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value as SensitivityProfileId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {SENSITIVITY_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {SENSITIVITY_PROFILES.find((p) => p.id === profileId)?.shortDesc}
              </p>
            </div>

            <div>
              <label
                htmlFor="commute-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                2. Daily Commute &amp; Mobility
              </label>
              <select
                id="commute-select"
                value={commuteId}
                onChange={(e) => setCommuteId(e.target.value as CommuteModeId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {COMMUTE_MODES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Shapes cold-start tailpipe &amp; commuter inhalation reductions
              </p>
            </div>

            <div>
              <label
                htmlFor="home-setup-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                3. Current Indoor Air &amp; Cooking Setup
              </label>
              <select
                id="home-setup-select"
                value={homeSetupId}
                onChange={(e) => setHomeSetupId(e.target.value as HomeSetupId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {HOME_SETUPS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Targets filtration CADR &amp; indoor combustion source control
              </p>
            </div>
          </div>
        </section>

        {/* ====================================================================
            BOTTOM GRID: LIVE IMPACT SIMULATOR + ACTIONABLE CARDS (LEFT) & GEMINI AI (RIGHT)
        ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLS */}
          <section
            aria-labelledby="action-modules-heading"
            className="lg:col-span-7 space-y-5"
          >
            {/* Live Exposure & Carbon Impact Simulator */}
            <div className="rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 dark:from-teal-900 dark:to-emerald-900 text-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-300" aria-hidden="true" />
                  <h2 id="action-modules-heading" className="text-base font-bold">
                    Live Exposure &amp; Emissions Impact Simulator
                  </h2>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 font-medium">
                  {cumulativeImpact.count} of {allRecommendations.length} Actions Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
                    Inhaled PM2.5 Cut
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    -{cumulativeImpact.combinedExposureDropPct}%
                  </div>
                  <div className="text-[11px] text-teal-100 mt-0.5">
                    {cumulativeImpact.dailyUgSaved} µg PM2.5/day spared
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
                    Weekly CO₂ Avoided
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    {cumulativeImpact.totalCo2SavedKgWeek} kg
                  </div>
                  <div className="text-[11px] text-teal-100 mt-0.5">
                    Local combustion cut
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
                    Annualized Impact
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    {cumulativeImpact.annualCo2SavedKg} kg
                  </div>
                  <div className="text-[11px] text-teal-100 mt-0.5">
                    CO₂ equivalent/year
                  </div>
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            <div
              role="tablist"
              aria-label="Actionable smog reduction categories"
              className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-800/90"
            >
              {[
                {
                  id: 'routine' as const,
                  label: 'Low-Emission Routines',
                  icon: Route,
                },
                {
                  id: 'indoor' as const,
                  label: 'Indoor Air Hacks',
                  icon: Home,
                },
                {
                  id: 'community' as const,
                  label: 'Community Actions',
                  icon: Building2,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Action Cards List */}
            <div className="space-y-3.5" role="tabpanel">
              {visibleRecommendations.map((rec) => {
                const isCommitted = committedIds.includes(rec.id);
                return (
                  <article
                    key={rec.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isCommitted
                        ? 'border-teal-500 dark:border-teal-600 bg-teal-50/40 dark:bg-teal-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleCommitAction(rec.id)}
                          aria-pressed={isCommitted}
                          aria-label={`${isCommitted ? 'Remove' : 'Commit to'} ${rec.title}`}
                          className="mt-0.5 text-teal-600 dark:text-teal-400 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full"
                        >
                          {isCommitted ? (
                            <CheckCircle2 className="w-6 h-6 fill-teal-600 text-white dark:fill-teal-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {rec.title}
                            </h3>
                            {rec.budgetTier && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {rec.budgetTier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-teal-700 dark:text-teal-300 mt-0.5">
                            {rec.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Direct Impact Pills */}
                    <div className="mt-3.5 pl-9 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        <Activity className="w-3.5 h-3.5" />
                        -{rec.pm25ExposureReductionPct}% (-{rec.ugInhaledSavedPerDay} µg/day)
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-100/90 text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                        <Leaf className="w-3.5 h-3.5" />
                        -{rec.co2AvoidedKgPerWeek} kg CO₂/wk
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {rec.cadrOrEquivalent}
                      </span>
                    </div>

                    {/* Mechanism & Tailored Note */}
                    <div className="mt-3 pl-9 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <p>
                        <strong className="text-slate-800 dark:text-slate-200">
                          Why it works:
                        </strong>{' '}
                        {rec.whyItWorks}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-2 rounded-lg">
                        <strong className="text-teal-700 dark:text-teal-300">
                          For your profile:
                        </strong>{' '}
                        {rec.tailoredNote}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* RIGHT 5 COLS: LIVE GROUNDED GEMINI ADVISOR */}
          <section
            aria-labelledby="ai-advisor-heading"
            className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-hidden lg:sticky lg:top-24"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="ai-advisor-heading"
                      className="text-base font-bold text-slate-900 dark:text-white"
                    >
                      Live Gemini 2.0 Flash Advisor
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Grounded on real-time {selectedCity?.name || 'local'} telemetry
                    </p>
                  </div>
                </div>
              </div>

              {snapshot && (
                <div className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate">
                    Live Context: AQI {snapshot.current.usAqi} • PM2.5 {snapshot.current.pm25} µg/m³
                    • Safe {cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour}
                  </span>
                </div>
              )}
            </div>

            {/* Chat Transcript */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[380px] overflow-y-auto bg-slate-50/40 dark:bg-slate-950/40">
              {chatMessages.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 max-w-xs mx-auto">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Ask for a Real-Time Action Plan
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Every prompt sends live pollutant concentrations, weather, and your household
                      selections directly to Gemini 2.0 Flash.
                    </p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-teal-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.role === 'assistant' && msg.groundedMetricsSnapshot
                        ? `${msg.groundedMetricsSnapshot} • `
                        : ''}
                      {msg.timestamp}
                    </span>
                  </div>
                ))
              )}

              {isGeneratingAi && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Calling Gemini 2.0 Flash with live {selectedCity?.name} readings...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-4 pt-3 pb-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Live Grounded Prompts:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    disabled={isGeneratingAi || !snapshot}
                    onClick={() => handleAskAdvisor(qp)}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-colors disabled:opacity-50"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Free-Form Question Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAdvisor(chatInput);
              }}
              className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
            >
              <label htmlFor="advisor-question-input" className="sr-only">
                Ask VayuGuard AI about air quality, indoor hacks, or low-emission routines
              </label>
              <input
                id="advisor-question-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a live question for Gemini..."
                className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isGeneratingAi || !snapshot}
                aria-label="Send question to Gemini AI advisor"
                className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </div>
      </main>

      {/* ====================================================================
          FOOTER
      ==================================================================== */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>
            100% Real-Time Open-Meteo CAMS Air Quality + Weather Telemetry &amp; 2024 US EPA PM2.5
            AQI Standard.
          </span>
        </div>
        <div>
          Click <strong>API Log</strong> in the top bar to inspect live network calls in real time.
        </div>
      </footer>

      {/* ====================================================================
          MODAL 1: SESSION GEMINI API KEY CONNECTOR
      ==================================================================== */}
      {showApiKeyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveApiKey}
            className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="api-key-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <KeyRound className="w-5 h-5 text-indigo-600" />
                Connect Live Gemini API Key
              </h2>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                aria-label="Close API key modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              In runtime environments without a pre-injected key, paste your Google AI Studio
              Gemini API key below. It is held strictly in browser <code>sessionStorage</code> and
              never committed to Git.
            </p>
            <div>
              <label htmlFor="gemini-key-field" className="sr-only">
                Gemini API Key
              </label>
              <input
                id="gemini-key-field"
                type="password"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Save to Session
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: LIVE NETWORK TELEMETRY INSPECTOR
      ==================================================================== */}
      {showTelemetryDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telemetry-log-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-2xl w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="telemetry-log-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <Activity className="w-5 h-5 text-teal-600" />
                Live Outbound API Request Log
              </h2>
              <button
                type="button"
                onClick={() => setShowTelemetryDrawer(false)}
                aria-label="Close telemetry log modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Every geolocation lookup, atmospheric pollutant stream, weather feed, and Gemini
              inference executed during your session:
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {telemetryLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No requests logged yet.</p>
              ) : (
                telemetryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        [{log.timestamp}] {log.service}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{log.note}</div>
                      <div className="text-[11px] font-mono text-slate-400">{log.endpoint}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          log.status >= 200 && log.status < 300
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                        }`}
                      >
                        HTTP {log.status}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {log.latencyMs}ms
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: DETERMINISTIC ENGINE VERIFICATION (UNIT TEST SUITE)
      ==================================================================== */}
      {showDiagnostics && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diagnostics-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="diagnostics-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <FlaskConical className="w-5 h-5 text-teal-600" />
                US EPA PM2.5 AQI Engine Verification
              </h2>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                aria-label="Close diagnostics modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deterministic breakpoint assertions verifying exact compliance with the 2024 US EPA
              PM2.5 AQI standard:
            </p>
            <ul className="space-y-2">
              {diagnosticResults.map((t) => (
                <li
                  key={t.name}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {t.name}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">{t.detail}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    <Check className="w-3.5 h-3.5" />
                    {t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default VayuGuard;
