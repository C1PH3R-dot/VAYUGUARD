// ============================================================================
// Live Grounded Gemini 2.0 Flash Advisor Panel
// ============================================================================

import React, { useRef } from 'react';
import { Sparkles, Info, Users, Send } from 'lucide-react';
import type { AirQualitySnapshot, ChatMessage, CleanWindowAnalysis } from '../types';

interface GeminiAdvisorPanelProps {
  cityName: string;
  snapshot: AirQualitySnapshot | null;
  cleanWindow: CleanWindowAnalysis;
  chatMessages: readonly ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  isGeneratingAi: boolean;
  onAskAdvisor: (prompt: string) => Promise<void>;
}

const QUICK_PROMPTS: readonly string[] = [
  "Plan my family's low-smog schedule today",
  'Best indoor air hacks under $50 for our home',
  'Safe school commute & outdoor timing plan',
  'Calculate how my selected actions cut lung dose',
];

/**
 * Interactive chat advisor panel that grounds Gemini 2.0 Flash responses on
 * live air quality telemetry, clean-air windows, and household selections.
 */
const GeminiAdvisorPanel: React.FC<GeminiAdvisorPanelProps> = ({
  cityName,
  snapshot,
  cleanWindow,
  chatMessages,
  chatInput,
  onChatInputChange,
  isGeneratingAi,
  onAskAdvisor,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  const submitPrompt = async (prompt: string) => {
    await onAskAdvisor(prompt);
    window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, 80);
  };

  return (
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
                Grounded on real-time {cityName} telemetry
              </p>
            </div>
          </div>
        </div>

        {snapshot && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className="truncate">
              Live Context: AQI {snapshot.current.usAqi} • PM2.5 {snapshot.current.pm25} µg/m³ •
              Safe {cleanWindow.safestWindow.startHour}–{cleanWindow.safestWindow.endHour}
            </span>
          </div>
        )}
      </div>

      {/* Chat Transcript */}
      <div
        aria-live="polite"
        aria-label="Gemini advisor conversation"
        className="p-4 sm:p-5 space-y-4 max-h-[380px] overflow-y-auto bg-slate-50/40 dark:bg-slate-950/40"
      >
        {chatMessages.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" aria-hidden="true" />
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
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
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
          <div
            role="status"
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 animate-pulse"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            <span>Calling Gemini 2.0 Flash with live {cityName} readings...</span>
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
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp}
              type="button"
              disabled={isGeneratingAi || !snapshot}
              onClick={() => submitPrompt(qp)}
              className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
          submitPrompt(chatInput);
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
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Type a live question for Gemini..."
          className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        />
        <button
          type="submit"
          disabled={!chatInput.trim() || isGeneratingAi || !snapshot}
          aria-label="Send question to Gemini AI advisor"
          className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
};

export default GeminiAdvisorPanel;
