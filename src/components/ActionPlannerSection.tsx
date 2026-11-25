// ============================================================================
// Live Exposure & Emissions Impact Simulator + Actionable Recommendations
// ============================================================================

import React from 'react';
import {
  Award,
  Route,
  Home,
  Building2,
  CheckCircle2,
  Circle,
  Activity,
  Leaf,
} from 'lucide-react';
import type { ActionRecommendation } from '../types';
import type { CumulativeImpactSummary } from '../lib/impact-calculator';

export type ActionCategoryTab = ActionRecommendation['category'];

interface ActionPlannerSectionProps {
  activeTab: ActionCategoryTab;
  onTabChange: (tab: ActionCategoryTab) => void;
  allRecommendations: readonly ActionRecommendation[];
  visibleRecommendations: readonly ActionRecommendation[];
  committedIds: readonly string[];
  onToggleCommit: (id: string) => void;
  cumulativeImpact: CumulativeImpactSummary;
}

const ACTION_TABS: ReadonlyArray<{
  id: ActionCategoryTab;
  label: string;
  icon: typeof Route;
}> = [
  { id: 'routine', label: 'Low-Emission Routines', icon: Route },
  { id: 'indoor', label: 'Indoor Air Hacks', icon: Home },
  { id: 'community', label: 'Community Actions', icon: Building2 },
];

/**
 * Renders the cumulative exposure & CO2 impact simulator, category tabs,
 * and interactive recommendation cards.
 */
const ActionPlannerSection: React.FC<ActionPlannerSectionProps> = ({
  activeTab,
  onTabChange,
  allRecommendations,
  visibleRecommendations,
  committedIds,
  onToggleCommit,
  cumulativeImpact,
}) => {
  return (
    <section aria-labelledby="action-modules-heading" className="lg:col-span-7 space-y-5">
      {/* Live Exposure & Carbon Impact Simulator */}
      <div
        aria-live="polite"
        className="rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 dark:from-teal-900 dark:to-emerald-900 text-white p-5 shadow-sm"
      >
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
            <div className="text-[11px] text-teal-100 mt-0.5">Local combustion cut</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">
              Annualized Impact
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
              {cumulativeImpact.annualCo2SavedKg} kg
            </div>
            <div className="text-[11px] text-teal-100 mt-0.5">CO₂ equivalent/year</div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div
        role="tablist"
        aria-label="Actionable smog reduction categories"
        className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-800/90"
      >
        {ACTION_TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls="action-tabpanel"
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  onTabChange(ACTION_TABS[(idx + 1) % ACTION_TABS.length].id);
                } else if (e.key === 'ArrowLeft') {
                  onTabChange(ACTION_TABS[(idx - 1 + ACTION_TABS.length) % ACTION_TABS.length].id);
                }
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
      <div
        id="action-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="space-y-3.5"
      >
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
                    onClick={() => onToggleCommit(rec.id)}
                    aria-pressed={isCommitted}
                    aria-label={`${isCommitted ? 'Remove' : 'Commit to'} ${rec.title}`}
                    className="mt-0.5 text-teal-600 dark:text-teal-400 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-full"
                  >
                    {isCommitted ? (
                      <CheckCircle2
                        aria-hidden="true"
                        className="w-6 h-6 fill-teal-600 text-white dark:fill-teal-500"
                      />
                    ) : (
                      <Circle aria-hidden="true" className="w-6 h-6 text-slate-400" />
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

              <div className="mt-3.5 pl-9 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                  -{rec.pm25ExposureReductionPct}% (-{rec.ugInhaledSavedPerDay} µg/day)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-100/90 text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                  <Leaf className="w-3.5 h-3.5" aria-hidden="true" />
                  -{rec.co2AvoidedKgPerWeek} kg CO₂/wk
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {rec.cadrOrEquivalent}
                </span>
              </div>

              <div className="mt-3 pl-9 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-slate-800 dark:text-slate-200">Why it works:</strong>{' '}
                  {rec.whyItWorks}
                </p>
                <p className="text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-2 rounded-lg">
                  <strong className="text-teal-700 dark:text-teal-300">For your profile:</strong>{' '}
                  {rec.tailoredNote}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ActionPlannerSection;
