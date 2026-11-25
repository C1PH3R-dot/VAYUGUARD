// ============================================================================
// VayuGuard — Main Urban Air Quality & Winter Smog Assistant Container
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, BookOpen } from 'lucide-react';
import type {
  SensitivityProfileId,
  CommuteModeId,
  HomeSetupId,
  CityLocation,
  AirQualitySnapshot,
  ApiTelemetryLog,
  ChatMessage,
  CleanWindowAnalysis,
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
import { calculateCumulativeImpact } from './lib/impact-calculator';
import { generateGroundedSmogAdvice } from './lib/gemini-advisor';
import HeaderBar from './components/HeaderBar';
import TelemetryPanel from './components/TelemetryPanel';
import InversionWindowPanel from './components/InversionWindowPanel';
import ProfileSelectorBar from './components/ProfileSelectorBar';
import ActionPlannerSection, { type ActionCategoryTab } from './components/ActionPlannerSection';
import GeminiAdvisorPanel from './components/GeminiAdvisorPanel';
import { ApiKeyModal, TelemetryModal, DiagnosticsModal } from './components/Modals';

const SEARCH_DEBOUNCE_MS = 320;
const MIN_SEARCH_CHARS = 2;
const MAX_TELEMETRY_LOGS = 25;
const GEMINI_KEY_STORAGE_KEY = 'vayuguard_gemini_key';

const DEFAULT_CLEAN_WINDOW: CleanWindowAnalysis = {
  safestWindow: { startHour: '--:--', endHour: '--:--', avgAqi: 0, avgPm25: 0 },
  peakSmogWindow: { startHour: '--:--', endHour: '--:--', avgAqi: 0, avgPm25: 0 },
  inversionRisk: 'Low',
  inversionExplanation: 'Awaiting live atmospheric telemetry...',
};

/**
 * Top-level VayuGuard dashboard component coordinating live geolocation,
 * Open-Meteo air quality & weather streams, personalized impact simulation,
 * and Gemini 2.0 Flash grounded advisory.
 */
export function VayuGuard() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Live location & search states
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

  // Live API Telemetry Log
  const [telemetryLogs, setTelemetryLogs] = useState<ApiTelemetryLog[]>([]);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState<boolean>(false);

  // Session-only Gemini API Key (optional override if env key is not bundled)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(GEMINI_KEY_STORAGE_KEY) || envKey;
    }
    return envKey;
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>('');

  // Household & Lifestyle Profile state
  const [profileId, setProfileId] = useState<SensitivityProfileId>('children');
  const [commuteId, setCommuteId] = useState<CommuteModeId>('car');
  const [homeSetupId, setHomeSetupId] = useState<HomeSetupId>('natural');

  // Action Planner state
  const [activeTab, setActiveTab] = useState<ActionCategoryTab>('routine');
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
      setTelemetryLogs((prev) => [logItem, ...prev.slice(0, MAX_TELEMETRY_LOGS - 1)]);
    },
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

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

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_SEARCH_CHARS) {
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
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery, appendTelemetryLog]);

  const categoryInfo = useMemo(
    () => getAqiCategoryInfo(snapshot?.current.usAqi ?? 0),
    [snapshot]
  );

  const cleanWindow = useMemo(() => {
    if (!snapshot) return DEFAULT_CLEAN_WINDOW;
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

  const cumulativeImpact = useMemo(
    () => calculateCumulativeImpact(allRecommendations, committedIds, snapshot, profileId),
    [allRecommendations, committedIds, snapshot, profileId]
  );

  const toggleCommitAction = (id: string) => {
    setCommittedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tempKeyInput.trim();
    setGeminiApiKey(cleaned);
    if (cleaned) {
      sessionStorage.setItem(GEMINI_KEY_STORAGE_KEY, cleaned);
    } else {
      sessionStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    }
    setShowApiKeyModal(false);
  };

  const diagnosticResults = useMemo(() => runEngineVerificationTests(), []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200 font-sans">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      <HeaderBar
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        searchError={searchError}
        showDropdown={showDropdown}
        onShowDropdownChange={setShowDropdown}
        onSelectCity={(city) => {
          setSelectedCity(city);
          setSearchQuery('');
          setShowDropdown(false);
        }}
        onClearSearch={() => {
          setSearchQuery('');
          setSearchResults([]);
          setSearchError(null);
          setShowDropdown(false);
        }}
        isDetectingLocation={isDetectingLocation}
        onDetectLocation={handleDetectMyLocation}
        hasGeminiKey={Boolean(geminiApiKey)}
        onOpenApiKeyModal={() => {
          setTempKeyInput(geminiApiKey);
          setShowApiKeyModal(true);
        }}
        telemetryCount={telemetryLogs.length}
        onOpenTelemetryDrawer={() => setShowTelemetryDrawer(true)}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {aqiError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 p-4 flex items-center justify-between gap-3 text-sm text-rose-900 dark:text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" aria-hidden="true" />
              <span>
                <strong>Live Stream Error:</strong> {aqiError}. Check network connectivity or
                retry.
              </span>
            </div>
            {selectedCity && (
              <button
                type="button"
                onClick={() => loadCityAirQuality(selectedCity, true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry Live Fetch
              </button>
            )}
          </div>
        )}

        <section
          aria-labelledby="telemetry-heading"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          <TelemetryPanel
            selectedCity={selectedCity}
            snapshot={snapshot}
            categoryInfo={categoryInfo}
            isLoadingAqi={isLoadingAqi}
            onForceRefresh={() => selectedCity && loadCityAirQuality(selectedCity, true)}
          />
          <InversionWindowPanel
            cleanWindow={cleanWindow}
            hourly={snapshot?.hourly || []}
          />
        </section>

        <ProfileSelectorBar
          profileId={profileId}
          onProfileChange={setProfileId}
          commuteId={commuteId}
          onCommuteChange={setCommuteId}
          homeSetupId={homeSetupId}
          onHomeSetupChange={setHomeSetupId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <ActionPlannerSection
            activeTab={activeTab}
            onTabChange={setActiveTab}
            allRecommendations={allRecommendations}
            visibleRecommendations={visibleRecommendations}
            committedIds={committedIds}
            onToggleCommit={toggleCommitAction}
            cumulativeImpact={cumulativeImpact}
          />
          <GeminiAdvisorPanel
            cityName={selectedCity?.name || 'local'}
            snapshot={snapshot}
            cleanWindow={cleanWindow}
            chatMessages={chatMessages}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            isGeneratingAi={isGeneratingAi}
            onAskAdvisor={handleAskAdvisor}
          />
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <span>
            100% Real-Time Open-Meteo CAMS Air Quality + Weather Telemetry &amp; 2024 US EPA PM2.5
            AQI Standard.
          </span>
        </div>
        <div>
          Click <strong>API Log</strong> in the top bar to inspect live network calls in real time.
        </div>
      </footer>

      {showApiKeyModal && (
        <ApiKeyModal
          tempKeyInput={tempKeyInput}
          onTempKeyChange={setTempKeyInput}
          onSave={handleSaveApiKey}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}

      {showTelemetryDrawer && (
        <TelemetryModal
          logs={telemetryLogs}
          onClose={() => setShowTelemetryDrawer(false)}
        />
      )}

      {showDiagnostics && (
        <DiagnosticsModal
          results={diagnosticResults}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
}

export default VayuGuard;
