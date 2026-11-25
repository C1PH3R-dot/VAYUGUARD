// ============================================================================
// Household Profiles & Lifestyle Constants
// ============================================================================

import type { SensitivityProfileId, CommuteModeId, HomeSetupId } from '../types';

export interface SensitivityProfile {
  id: SensitivityProfileId;
  label: string;
  shortDesc: string;
  dailyVentilationM3: number;
}

export interface CommuteMode {
  id: CommuteModeId;
  label: string;
}

export interface HomeSetup {
  id: HomeSetupId;
  label: string;
}

export const SENSITIVITY_PROFILES: readonly SensitivityProfile[] = [
  {
    id: 'general',
    label: 'General Adult / Family',
    shortDesc: 'Balanced daily protection & emissions cut (~14 m³/day inhaled)',
    dailyVentilationM3: 14.0,
  },
  {
    id: 'children',
    label: 'Children / School Commute',
    shortDesc: 'Higher breathing rate per kg body weight; school drop-off focus',
    dailyVentilationM3: 16.5,
  },
  {
    id: 'elderly',
    label: 'Elderly / Cardiovascular',
    shortDesc: 'Strict fine-particulate & NO2 vascular inflammation protection',
    dailyVentilationM3: 15.0,
  },
  {
    id: 'asthma',
    label: 'Asthma / Respiratory Sensitivity',
    shortDesc: 'Zero-trigger indoor air & peak-inversion avoidance',
    dailyVentilationM3: 17.5,
  },
  {
    id: 'outdoor',
    label: 'Outdoor Worker / Runner',
    shortDesc: 'High minute-ventilation dose reduction & timing shifts (~24 m³/day)',
    dailyVentilationM3: 24.0,
  },
] as const;

export const COMMUTE_MODES: readonly CommuteMode[] = [
  { id: 'car', label: 'Private Car / Rideshare' },
  { id: 'transit', label: 'Metro / Bus Transit' },
  { id: 'active', label: 'Bike / Walk' },
  { id: 'remote', label: 'Remote / Hybrid WFH' },
] as const;

export const HOME_SETUPS: readonly HomeSetup[] = [
  { id: 'natural', label: 'Natural Ventilation Only' },
  { id: 'hepa', label: 'True HEPA Air Purifier' },
  { id: 'corsi', label: 'DIY Corsi-Rosenthal Box' },
  { id: 'gas_incense', label: 'Gas Stove / Incense / Candles' },
] as const;
