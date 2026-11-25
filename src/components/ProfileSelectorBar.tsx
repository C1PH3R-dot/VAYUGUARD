// ============================================================================
// Household & Lifestyle Profile Selector Bar
// ============================================================================

import React from 'react';
import { Sliders } from 'lucide-react';
import type { SensitivityProfileId, CommuteModeId, HomeSetupId } from '../types';
import { SENSITIVITY_PROFILES, COMMUTE_MODES, HOME_SETUPS } from '../lib/profiles';

interface ProfileSelectorBarProps {
  profileId: SensitivityProfileId;
  onProfileChange: (id: SensitivityProfileId) => void;
  commuteId: CommuteModeId;
  onCommuteChange: (id: CommuteModeId) => void;
  homeSetupId: HomeSetupId;
  onHomeSetupChange: (id: HomeSetupId) => void;
}

/**
 * Provides accessible selectors for household sensitivity, commute mode, and
 * indoor air/cooking setup to personalize exposure impact and Gemini prompts.
 */
const ProfileSelectorBar: React.FC<ProfileSelectorBarProps> = ({
  profileId,
  onProfileChange,
  commuteId,
  onCommuteChange,
  homeSetupId,
  onHomeSetupChange,
}) => {
  const activeProfile =
    SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];

  return (
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
            onChange={(e) => onProfileChange(e.target.value as SensitivityProfileId)}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {SENSITIVITY_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {activeProfile.shortDesc}
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
            onChange={(e) => onCommuteChange(e.target.value as CommuteModeId)}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
            onChange={(e) => onHomeSetupChange(e.target.value as HomeSetupId)}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
  );
};

export default ProfileSelectorBar;
