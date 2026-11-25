import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AqiRadialGauge from '../components/AqiRadialGauge';
import HourlyForecastChart from '../components/HourlyForecastChart';
import VayuGuard from '../VayuGuard';
import { getAqiCategoryInfo } from '../lib/aqi-engine';
import * as apiServices from '../lib/api-services';
import * as geminiAdvisor from '../lib/gemini-advisor';
import type { AirQualitySnapshot, CityLocation, CleanWindowAnalysis } from '../types';

const londonCity: CityLocation = {
  id: 'om-london',
  name: 'London',
  country: 'United Kingdom',
  latitude: 51.5074,
  longitude: -0.1278,
  detectionMethod: 'ip-geolocation',
};

const tokyoCity: CityLocation = {
  id: 'om-tokyo',
  name: 'Tokyo',
  country: 'Japan',
  latitude: 35.6895,
  longitude: 139.6917,
  detectionMethod: 'live-search',
};

function makeSnapshot(city: CityLocation, pm25: number, usAqi: number): AirQualitySnapshot {
  return {
    location: city,
    fetchedAt: Date.now(),
    source: 'live-open-meteo',
    current: {
      pm25,
      pm10: pm25 * 1.5,
      no2: 28,
      o3: 36,
      so2: 4,
      co: 290,
      usAqi,
    },
    weather: { temperatureC: 11, humidityPct: 68, windSpeedKmh: 9 },
    hourly: [
      { time: '2026-01-15T08:00', hourLabel: '08:00', pm25: 40, pm10: 60, no2: 35, o3: 25, aqi: 112 },
      { time: '2026-01-15T09:00', hourLabel: '09:00', pm25: 38, pm10: 55, no2: 32, o3: 28, aqi: 107 },
      { time: '2026-01-15T10:00', hourLabel: '10:00', pm25: 30, pm10: 45, no2: 28, o3: 32, aqi: 89 },
      { time: '2026-01-15T13:00', hourLabel: '13:00', pm25: 12, pm10: 22, no2: 18, o3: 40, aqi: 56 },
      { time: '2026-01-15T14:00', hourLabel: '14:00', pm25: 11, pm10: 20, no2: 16, o3: 42, aqi: 54 },
      { time: '2026-01-15T15:00', hourLabel: '15:00', pm25: 13, pm10: 24, no2: 19, o3: 38, aqi: 58 },
    ],
  };
}

describe('Visualization Components', () => {
  it('renders AqiRadialGauge with accessible label and values', () => {
    const cat = getAqiCategoryInfo(124);
    render(<AqiRadialGauge aqi={124} category={cat} pm25={44.8} />);

    const gauge = screen.getByRole('img', {
      name: /US EPA Air Quality Index is 124, categorized as Unhealthy for Sensitive Groups/i,
    });
    expect(gauge).toBeInTheDocument();
    expect(screen.getByText('124')).toBeInTheDocument();
    expect(screen.getByText('PM2.5: 44.8 µg/m³')).toBeInTheDocument();
  });

  it('renders HourlyForecastChart empty state and populated chart', () => {
    const cleanWindow: CleanWindowAnalysis = {
      safestWindow: { startHour: '13:00', endHour: '16:00', avgAqi: 56, avgPm25: 12 },
      peakSmogWindow: { startHour: '08:00', endHour: '11:00', avgAqi: 103, avgPm25: 36 },
      inversionRisk: 'Moderate',
      inversionExplanation: 'Test explanation',
    };

    const { rerender } = render(<HourlyForecastChart hourly={[]} cleanWindow={cleanWindow} />);
    expect(screen.getByText(/Awaiting live 24-hour forecast stream/i)).toBeInTheDocument();

    const snap = makeSnapshot(londonCity, 20, 70);
    rerender(<HourlyForecastChart hourly={snap.hourly} cleanWindow={cleanWindow} />);
    expect(
      screen.getByRole('img', { name: /Live 24-hour air quality forecast chart/i })
    ).toBeInTheDocument();
  });
});

describe('VayuGuard Dashboard Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(apiServices, 'detectLiveUserLocation').mockResolvedValue(londonCity);
    vi.spyOn(apiServices, 'fetchLiveAirQualityAndWeather').mockImplementation(async (city) =>
      city.name === 'Tokyo' ? makeSnapshot(tokyoCity, 12.0, 56) : makeSnapshot(londonCity, 38.0, 107)
    );
    vi.spyOn(apiServices, 'searchCitiesLive').mockResolvedValue([tokyoCity]);
    vi.spyOn(geminiAdvisor, 'generateGroundedSmogAdvice').mockResolvedValue({
      text: '• Keep windows sealed during 08:00–11:00.',
      isLiveGemini: true,
    });
  });

  it('loads detected city telemetry, allows profile updates, tab switches, and action toggles', async () => {
    const user = userEvent.setup();
    render(<VayuGuard />);

    // Wait for London telemetry to appear
    expect(await screen.findByRole('heading', { name: 'London' })).toBeInTheDocument();
    expect(await screen.findByText('107')).toBeInTheDocument();
    expect(screen.getByText(/2 of 9 Actions Active/i)).toBeInTheDocument();

    // Switch sensitivity profile to Outdoor Worker
    const profileSelect = screen.getByLabelText(/1\. Household Sensitivity Profile/i);
    await user.selectOptions(profileSelect, 'outdoor');
    expect(screen.getByText(/High minute-ventilation dose reduction/i)).toBeInTheDocument();

    // Switch action tab to Indoor Air Hacks and toggle an action
    const indoorTab = screen.getByRole('tab', { name: /Indoor Air Hacks/i });
    await user.click(indoorTab);
    expect(indoorTab).toHaveAttribute('aria-selected', 'true');

    const toggleBtn = screen.getByRole('button', {
      name: /Commit to Always Run Exhaust Hood/i,
    });
    await user.click(toggleBtn);
    expect(screen.getByText(/3 of 9 Actions Active/i)).toBeInTheDocument();
  });

  it('supports live city search and selection', async () => {
    const user = userEvent.setup();
    render(<VayuGuard />);
    await screen.findByRole('heading', { name: 'London' });

    const searchInput = screen.getByLabelText(/Search any city worldwide/i);
    await user.type(searchInput, 'Tokyo');

    const tokyoOption = await screen.findByRole('button', { name: /Tokyo/i });
    await user.click(tokyoOption);

    expect(await screen.findByRole('heading', { name: 'Tokyo' })).toBeInTheDocument();
  });

  it('opens modals, saves session Gemini key, and submits advisor prompt', async () => {
    const user = userEvent.setup();
    render(<VayuGuard />);
    await screen.findByRole('heading', { name: 'London' });

    // Open and save Gemini Key
    await user.click(screen.getByRole('button', { name: /Connect Gemini Key/i }));
    const keyField = screen.getByLabelText('Gemini API Key');
    await user.type(keyField, 'AIzaSyTestKey123');
    await user.click(screen.getByRole('button', { name: /Save to Session/i }));
    expect(sessionStorage.getItem('vayuguard_gemini_key')).toBe('AIzaSyTestKey123');

    // Submit a question to Gemini advisor
    const questionInput = screen.getByLabelText(/Ask VayuGuard AI/i);
    await user.type(questionInput, 'Should we open windows?');
    await user.click(screen.getByRole('button', { name: /Send question to Gemini AI advisor/i }));

    expect(await screen.findByText(/Keep windows sealed during 08:00–11:00/i)).toBeInTheDocument();

    // Open Diagnostics modal
    await user.click(screen.getByRole('button', { name: /Open AQI Engine Verification Diagnostics/i }));
    expect(screen.getByRole('dialog', { name: /US EPA PM2\.5 AQI Engine Verification/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Close diagnostics modal/i }));

    // Toggle dark mode
    const themeBtn = screen.getByRole('button', { name: /Switch to (dark|light) mode/i });
    await user.click(themeBtn);
  });
});
