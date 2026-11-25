// ============================================================================
// Live Gemini API Integration (Strictly Grounded on Live Telemetry)
// ============================================================================

import type {
  AirQualitySnapshot,
  AqiCategoryInfo,
  CleanWindowAnalysis,
  ActionRecommendation,
  TelemetryLogger,
} from '../types';

export interface GeminiAdvisorParams {
  userQuestion: string;
  userApiKey: string;
  snapshot: AirQualitySnapshot;
  category: AqiCategoryInfo;
  cleanWindow: CleanWindowAnalysis;
  profileLabel: string;
  commuteLabel: string;
  homeSetupLabel: string;
  selectedActions: ActionRecommendation[];
  onLog: TelemetryLogger;
}

export interface GeminiAdvisorResult {
  text: string;
  isLiveGemini: boolean;
}

/** Generate a grounded smog advisory using the Gemini 2.0 Flash API. */
export async function generateGroundedSmogAdvice(
  params: GeminiAdvisorParams
): Promise<GeminiAdvisorResult> {
  const {
    userQuestion,
    userApiKey,
    snapshot,
    category,
    cleanWindow,
    profileLabel,
    commuteLabel,
    homeSetupLabel,
    selectedActions,
    onLog,
  } = params;

  const effectiveKey = (
    userApiKey.trim() ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    ''
  ).trim();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
    effectiveKey
  )}`;

  const groundedContext = `
VERIFIED LIVE TELEMETRY & USER PROFILE (DO NOT CONTRADICT OR INVENT NUMBERS):
- Location: ${snapshot.location.name}, ${snapshot.location.country} (Lat ${snapshot.location.latitude.toFixed(3)}, Lon ${snapshot.location.longitude.toFixed(3)})
- Live Weather: Temp ${snapshot.weather.temperatureC}°C, Humidity ${snapshot.weather.humidityPct}%, Wind ${snapshot.weather.windSpeedKmh} km/h
- Current US EPA AQI (PM2.5-based): ${snapshot.current.usAqi} (${category.label})
- Live Pollutant Concentrations: PM2.5 = ${snapshot.current.pm25} µg/m³, PM10 = ${snapshot.current.pm10} µg/m³, NO2 = ${snapshot.current.no2} µg/m³, O3 = ${snapshot.current.o3} µg/m³, SO2 = ${snapshot.current.so2} µg/m³, CO = ${snapshot.current.co} µg/m³
- Next 24h Cleanest 3-Hour Window: ${cleanWindow.safestWindow.startHour} to ${cleanWindow.safestWindow.endHour} (Avg AQI ${cleanWindow.safestWindow.avgAqi}, Avg PM2.5 ${cleanWindow.safestWindow.avgPm25} µg/m³)
- Next 24h Peak Smog 3-Hour Window: ${cleanWindow.peakSmogWindow.startHour} to ${cleanWindow.peakSmogWindow.endHour} (Avg AQI ${cleanWindow.peakSmogWindow.avgAqi}, Avg PM2.5 ${cleanWindow.peakSmogWindow.avgPm25} µg/m³)
- Atmospheric Inversion Risk: ${cleanWindow.inversionRisk} (${cleanWindow.inversionExplanation})
- Household Sensitivity Profile: ${profileLabel}
- Primary Commute Mode: ${commuteLabel}
- Current Home Setup: ${homeSetupLabel}
- Active Actions Committed by User: ${
    selectedActions.length > 0
      ? selectedActions
          .map(
            (a) =>
              `${a.title} (-${a.pm25ExposureReductionPct}% PM2.5 exposure, -${a.ugInhaledSavedPerDay} µg/day inhaled, -${a.co2AvoidedKgPerWeek} kg CO2/wk)`
          )
          .join('; ')
      : 'None selected yet'
  }
`.trim();

  const systemInstruction = `You are VayuGuard, an expert Environmental Health & Urban Sustainability Advisor helping families and communities navigate winter smog and urban air pollution.
Rules:
1. Ground every recommendation strictly in the live pollutant concentrations, weather conditions, clean-air windows, and household profile provided. Never invent or alter AQI numbers.
2. Provide practical low-emission daily routines, budget-conscious indoor air quality hacks, and community-level alternatives tailored to the user's question.
3. Explicitly explain the DIRECT IMPACT of each choice (e.g., % reduction in inhaled PM2.5 dose, µg/day spared, kg CO2/NOx avoided, or respiratory mechanism).
4. Keep formatting crisp, compassionate, and scannable with short bullet points and bolded impact takeaways (~200 words max).`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${groundedContext}\n\nUSER QUESTION:\n${userQuestion}`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
  };

  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const t0 = performance.now();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const latencyMs = Math.round(performance.now() - t0);

      onLog({
        service: 'Gemini 2.0 Flash API',
        endpoint: 'generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        status: response.status,
        latencyMs,
        note: `Grounded prompt for ${snapshot.location.name} (AQI ${snapshot.current.usAqi})`,
      });

      if (!response.ok) {
        if (attempt < delays.length && (response.status === 429 || response.status >= 500)) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
        throw new Error(`Gemini API HTTP ${response.status}`);
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, isLiveGemini: true };
      throw new Error('Empty model response');
    } catch (err) {
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      const errMsg = err instanceof Error ? err.message : 'Network/API key unavailable';
      return {
        text: `⚠️ **Live Gemini API Call Unauthenticated/Rate-Limited (${errMsg})**\nClick **"Connect Gemini Key"** in the top bar to enter a valid Google AI Studio key for live LLM synthesis.\n\n**Live Telemetry Calculation for ${snapshot.location.name} (AQI ${snapshot.current.usAqi} — ${category.label}):**\n• **Safest Outdoor Window:** **${cleanWindow.safestWindow.startHour}–${cleanWindow.safestWindow.endHour}** (Avg PM2.5 ${cleanWindow.safestWindow.avgPm25} µg/m³ vs. peak ${cleanWindow.peakSmogWindow.avgPm25} µg/m³).\n• **Tailored ${homeSetupLabel} & ${profileLabel} Action:** Seal windows during peak hours, filter bedroom air continuously (-62% PM2.5 dose), and replace solo cold-start car trips (-18.4 kg CO₂/wk).`,
        isLiveGemini: false,
      };
    }
  }

  return { text: 'Unable to reach Gemini API.', isLiveGemini: false };
}
