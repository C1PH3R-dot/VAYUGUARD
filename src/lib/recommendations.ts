// ============================================================================
// Live-Scaled Recommendation & Exposure Impact Engine
// ============================================================================

import type {
  AirQualitySnapshot,
  CleanWindowAnalysis,
  SensitivityProfileId,
  CommuteModeId,
  HomeSetupId,
  ActionRecommendation,
} from '../types';
import { SENSITIVITY_PROFILES } from './profiles';

/**
 * Build tailored action recommendations based on live air quality data,
 * clean-air window analysis, and the user's household profile.
 */
export function buildTailoredRecommendations(
  snapshot: AirQualitySnapshot,
  cleanWindow: CleanWindowAnalysis,
  profileId: SensitivityProfileId,
  commute: CommuteModeId,
  homeSetup: HomeSetupId
): ActionRecommendation[] {
  const { pm25, no2, usAqi } = snapshot.current;
  const profileObj =
    SENSITIVITY_PROFILES.find((p) => p.id === profileId) || SENSITIVITY_PROFILES[0];
  const baselineDailyUgInhaled = pm25 * profileObj.dailyVentilationM3;
  const isHighSmog = usAqi > 100;

  const swingPct = Math.max(
    10,
    Math.min(
      52,
      Math.round(
        ((cleanWindow.peakSmogWindow.avgPm25 - cleanWindow.safestWindow.avgPm25) /
          Math.max(1, cleanWindow.peakSmogWindow.avgPm25)) *
          100
      )
    )
  );

  const calcUgSaved = (pct: number) =>
    Math.round((baselineDailyUgInhaled * (pct / 100)) * 10) / 10;

  const routines: ActionRecommendation[] = [
    {
      id: 'routine-window-shift',
      category: 'routine',
      title: `Shift Outdoor Errands & Exercise to ${cleanWindow.safestWindow.startHour}–${cleanWindow.safestWindow.endHour}`,
      subtitle: `Avoid peak smog trapping between ${cleanWindow.peakSmogWindow.startHour}–${cleanWindow.peakSmogWindow.endHour}`,
      budgetTier: 'Free',
      pm25ExposureReductionPct: swingPct,
      ugInhaledSavedPerDay: calcUgSaved(swingPct),
      co2AvoidedKgPerWeek: 1.8,
      cadrOrEquivalent: `Drops ambient PM2.5 from ${cleanWindow.peakSmogWindow.avgPm25} to ${cleanWindow.safestWindow.avgPm25} µg/m³`,
      whyItWorks:
        'Midday boundary-layer warming disperses shallow ground-level combustion exhaust.',
      tailoredNote:
        profileId === 'children'
          ? 'Schedule school playground & outdoor sports exclusively inside this clean-air window.'
          : profileId === 'outdoor'
          ? 'High minute-ventilation multiplies particulate dose by 4–6×; shifting runs to this window prevents deep alveolar deposition.'
          : 'Align errands, walks, and brief window airing with this lowest-AQI band.',
    },
    {
      id: 'routine-commute-swap',
      category: 'routine',
      title:
        commute === 'car'
          ? 'Swap 3 Solo Car Trips/Week for Metro/Rail + Recirculate Cabin Air'
          : commute === 'active'
          ? 'Reroute 200m Off Arterial Roads + Wear Fitted N95 During Rush Hour'
          : commute === 'transit'
          ? 'Off-Peak Transit Boarding + Closed-Window Station Waiting'
          : 'Batch Cold-Start Errands into One Warm-Engine Loop',
      subtitle:
        commute === 'car'
          ? 'Eliminates cold-start tailpipe NOx & cabin traffic-plume spikes'
          : 'Side streets reduce ultrafine black carbon & NO2 by 35–50%',
      budgetTier: 'Free',
      pm25ExposureReductionPct: commute === 'active' ? 42 : 24,
      ugInhaledSavedPerDay: calcUgSaved(commute === 'active' ? 42 : 24),
      co2AvoidedKgPerWeek: commute === 'car' ? 18.4 : commute === 'transit' ? 9.2 : 6.5,
      cadrOrEquivalent:
        commute === 'car' ? '~45 g NOx + 18.4 kg CO2 saved/wk' : '40% lower commuter lung dose',
      whyItWorks:
        'Cold engines emit 3–5× more hydrocarbons and NOx in the first 5 minutes before catalytic converters reach light-off temperature.',
      tailoredNote:
        no2 > 40
          ? `Live NO2 is elevated (${no2} µg/m³)—avoiding congested intersections directly reduces airway inflammation.`
          : 'Keeping vehicle HVAC on "Recirculate" with a clean cabin filter cuts in-cabin PM2.5 by up to 65%.',
    },
    {
      id: 'routine-mask-ventilation',
      category: 'routine',
      title: isHighSmog
        ? 'Enforce Fitted N95/KF94 Respirator Outdoors + Zero-Idle Warmups'
        : 'Smart Cross-Ventilation Purge (15-Min Midday Flush)',
      subtitle: isHighSmog
        ? 'Electrostatic melt-blown media captures >95% of 0.3–2.5 µm aerosols'
        : 'Prevents indoor CO2 buildup without inviting evening smog inside',
      budgetTier: 'Under $50',
      pm25ExposureReductionPct: isHighSmog ? 68 : 22,
      ugInhaledSavedPerDay: calcUgSaved(isHighSmog ? 68 : 22),
      co2AvoidedKgPerWeek: 3.4,
      cadrOrEquivalent: isHighSmog
        ? '95% filtration efficiency at 0.3 µm'
        : '4–6 air changes in 15 min',
      whyItWorks:
        'Cloth masks leak 60–80% of fine aerosols; sealed N95/KF94 respirators block sub-micron combustion soot.',
      tailoredNote:
        profileId === 'asthma' || profileId === 'elderly'
          ? 'Choose a soft-seal N95/KF94 with low breathing resistance and keep rescue inhalers accessible.'
          : 'Skip idling your car in the driveway—modern fuel-injected engines warm faster under gentle driving.',
    },
  ];

  const indoor: ActionRecommendation[] = [
    {
      id: 'indoor-filtration',
      category: 'indoor',
      title:
        homeSetup === 'hepa'
          ? 'Run HEPA Purifier on High During Smog Peaks + Clean Pre-Filter Weekly'
          : homeSetup === 'corsi'
          ? 'Seal Corsi-Rosenthal Box Seams & Run 24/7 on Medium-High'
          : 'Build a DIY Corsi-Rosenthal Box (4× MERV-13 Filters + Box Fan)',
      subtitle:
        homeSetup === 'natural'
          ? 'Delivers 400–600 CFM Clean Air Delivery Rate for ~$45–$65'
          : 'Maintains 5+ Air Changes per Hour (ACH) in main living/sleeping zone',
      budgetTier: homeSetup === 'hepa' || homeSetup === 'corsi' ? 'Free' : 'Under $50',
      pm25ExposureReductionPct: 62,
      ugInhaledSavedPerDay: calcUgSaved(62),
      co2AvoidedKgPerWeek: 1.2,
      cadrOrEquivalent: '450+ CFM CADR (~62% lower indoor PM2.5)',
      whyItWorks:
        'High-airflow MERV-13 / H13 HEPA filtration continuously strips infiltrated outdoor PM2.5 before it settles in bedrooms.',
      tailoredNote:
        profileId === 'children' || profileId === 'asthma'
          ? 'Prioritize placing the filtration unit in the bedroom overnight where 8–10 hours of cumulative breathing occurs.'
          : 'Create at least one sealed "Clean Air Safe Room" in your home during multi-day inversions.',
    },
    {
      id: 'indoor-source-control',
      category: 'indoor',
      title:
        homeSetup === 'gas_incense'
          ? 'Pause Incense/Candles & Use Electric Kettle/Induction + Range Hood'
          : 'Always Run Exhaust Hood on High & Lid Pots While Cooking',
      subtitle: 'Eliminates indoor NO2, ultra-fine cooking aerosols & soot spikes',
      budgetTier: 'Free',
      pm25ExposureReductionPct: homeSetup === 'gas_incense' ? 54 : 31,
      ugInhaledSavedPerDay: calcUgSaved(homeSetup === 'gas_incense' ? 54 : 31),
      co2AvoidedKgPerWeek: homeSetup === 'gas_incense' ? 8.5 : 2.1,
      cadrOrEquivalent: 'Prevents 200+ µg/m³ indoor kitchen spikes',
      whyItWorks:
        'Unvented gas burners and incense can push indoor PM2.5 and NO2 higher than severe outdoor winter smog within 15 minutes.',
      tailoredNote:
        'Back burners sit closer to range hood capture zones—cooking on rear burners improves fume capture by ~35%.',
    },
    {
      id: 'indoor-sealing-cleaning',
      category: 'indoor',
      title: 'Weatherstrip Window Drafts + Damp-Mop Floors Instead of Dry Sweeping',
      subtitle: 'Stops infiltration during inversions & prevents dust resuspension',
      budgetTier: 'Under $50',
      pm25ExposureReductionPct: 28,
      ugInhaledSavedPerDay: calcUgSaved(28),
      co2AvoidedKgPerWeek: 4.8,
      cadrOrEquivalent: 'Cuts smog infiltration by ~30% + lowers heating waste',
      whyItWorks:
        'Dry brooms and non-HEPA vacuums kick settled heavy metals and PM2.5 back into the 1-meter child/seated breathing zone.',
      tailoredNote:
        'Foam weatherstripping and rolled damp door towels block drafts while reducing HVAC energy consumption.',
    },
  ];

  const community: ActionRecommendation[] = [
    {
      id: 'comm-school-anti-idle',
      category: 'community',
      title: 'Launch a School / Apartment "Engines Off" Anti-Idling Zone',
      subtitle: '10-minute pick-up idling burns fuel directly at child breathing height',
      budgetTier: 'Free',
      pm25ExposureReductionPct: 34,
      ugInhaledSavedPerDay: calcUgSaved(34),
      co2AvoidedKgPerWeek: 14.0,
      cadrOrEquivalent: '20 cars idling 10m = ~12 kg CO2 + concentrated NOx/PM2.5',
      whyItWorks:
        'Tailpipe plumes at school gates pool in stagnant air right where children line up.',
      tailoredNote:
        'Share a 1-page parent/HOA pledge: turning off engines for stops >30 seconds saves fuel and protects kids\' lungs.',
    },
    {
      id: 'comm-carpool-microtransit',
      category: 'community',
      title: 'Organize a 3-Family Neighborhood Carpool / Walking Bus Co-op',
      subtitle: 'Cuts local cold-start vehicle trips by 66% on high-smog days',
      budgetTier: 'Free',
      pm25ExposureReductionPct: 26,
      ugInhaledSavedPerDay: calcUgSaved(26),
      co2AvoidedKgPerWeek: 24.5,
      cadrOrEquivalent: '~1.2 tonnes CO2/yr avoided per 3-family pod',
      whyItWorks:
        'Short neighborhood drives under 3 km produce the highest emissions per kilometer because engines never reach thermal efficiency.',
      tailoredNote:
        'Coordinate via neighborhood chat whenever live AQI crosses 100 (USG) to consolidate school and grocery runs.',
    },
    {
      id: 'comm-clean-hub-green',
      category: 'community',
      title: 'Equip Community Library / Senior Center with DIY Clean-Air Hubs',
      subtitle: 'Shared Corsi-Rosenthal filter boxes protect vulnerable neighbors',
      budgetTier: 'Under $50',
      pm25ExposureReductionPct: 45,
      ugInhaledSavedPerDay: calcUgSaved(45),
      co2AvoidedKgPerWeek: 5.0,
      cadrOrEquivalent: '2 boxes clean a 100 m² community room for <$120 total',
      whyItWorks:
        'Low-income households and seniors often lack central filtration during multi-day air pollution episodes.',
      tailoredNote:
        'Pair with local hardy evergreen vegetative buffers along school fences to trap coarse road dust.',
    },
  ];

  return [...routines, ...indoor, ...community];
}
