// ============================================================================
// Application Modal Dialogs (API Key, Telemetry Inspector, Engine Diagnostics)
// ============================================================================

import React from 'react';
import { KeyRound, Activity, FlaskConical, Check } from 'lucide-react';
import type { ApiTelemetryLog } from '../types';
import ModalShell from './ModalShell';

interface ApiKeyModalProps {
  tempKeyInput: string;
  onTempKeyChange: (value: string) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

/** Modal for configuring a session-only Google AI Studio Gemini API key. */
export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  tempKeyInput,
  onTempKeyChange,
  onSave,
  onClose,
}) => (
  <ModalShell
    titleId="api-key-modal-title"
    title={
      <>
        <KeyRound className="w-5 h-5 text-indigo-600" aria-hidden="true" />
        Connect Live Gemini API Key
      </>
    }
    closeLabel="Close API key modal"
    maxWidthClass="max-w-md"
    onClose={onClose}
  >
    <form onSubmit={onSave} className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        In runtime environments without a pre-injected key, paste your Google AI Studio Gemini API
        key below. It is held strictly in browser <code>sessionStorage</code> and never committed to
        Git.
      </p>
      <div>
        <label htmlFor="gemini-key-field" className="sr-only">
          Gemini API Key
        </label>
        <input
          id="gemini-key-field"
          type="password"
          value={tempKeyInput}
          onChange={(e) => onTempKeyChange(e.target.value)}
          placeholder="AIzaSy..."
          autoComplete="off"
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Save to Session
        </button>
      </div>
    </form>
  </ModalShell>
);

interface TelemetryModalProps {
  logs: readonly ApiTelemetryLog[];
  onClose: () => void;
}

/** Modal displaying live outbound API request logs and latencies. */
export const TelemetryModal: React.FC<TelemetryModalProps> = ({ logs, onClose }) => (
  <ModalShell
    titleId="telemetry-log-title"
    title={
      <>
        <Activity className="w-5 h-5 text-teal-600" aria-hidden="true" />
        Live Outbound API Request Log
      </>
    }
    closeLabel="Close telemetry log modal"
    maxWidthClass="max-w-2xl"
    onClose={onClose}
  >
    <p className="text-xs text-slate-600 dark:text-slate-300">
      Every geolocation lookup, atmospheric pollutant stream, weather feed, and Gemini inference
      executed during your session:
    </p>
    <div className="max-h-80 overflow-y-auto space-y-2">
      {logs.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No requests logged yet.</p>
      ) : (
        logs.map((log) => (
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
              <span className="font-mono text-[11px] text-slate-500">{log.latencyMs}ms</span>
            </div>
          </div>
        ))
      )}
    </div>
  </ModalShell>
);

interface DiagnosticsModalProps {
  results: ReadonlyArray<{ name: string; passed: boolean; detail: string }>;
  onClose: () => void;
}

/** Modal showing deterministic 2024 US EPA PM2.5 AQI breakpoint verification checks. */
export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ results, onClose }) => (
  <ModalShell
    titleId="diagnostics-title"
    title={
      <>
        <FlaskConical className="w-5 h-5 text-teal-600" aria-hidden="true" />
        US EPA PM2.5 AQI Engine Verification
      </>
    }
    closeLabel="Close diagnostics modal"
    maxWidthClass="max-w-lg"
    onClose={onClose}
  >
    <p className="text-xs text-slate-600 dark:text-slate-300">
      Deterministic breakpoint assertions verifying exact compliance with the 2024 US EPA PM2.5
      AQI standard:
    </p>
    <ul className="space-y-2">
      {results.map((t) => (
        <li
          key={t.name}
          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
        >
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{t.name}</div>
            <div className="text-slate-500 dark:text-slate-400">{t.detail}</div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            {t.passed ? 'PASS' : 'FAIL'}
          </span>
        </li>
      ))}
    </ul>
  </ModalShell>
);
