import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateGroundedSmogAdvice } from '../lib/gemini-advisor';
import { getAqiCategoryInfo } from '../lib/aqi-engine';
import type { AirQualitySnapshot, CleanWindowAnalysis } from '../types';

const mockSnapshot: AirQualitySnapshot = {
  location: {
    id: 'om-1',
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
  },
  fetchedAt: 1700000000000,
  source: 'live-open-meteo',
  current: {
    pm25: 25.0,
    pm10: 40.0,
    no2: 30.0,
    o3: 35.0,
    so2: 4.0,
    co: 250.0,
    usAqi: 81,
  },
  weather: { temperatureC: 9, humidityPct: 74, windSpeedKmh: 8 },
  hourly: [],
};

const mockCleanWindow: CleanWindowAnalysis = {
  safestWindow: { startHour: '13:00', endHour: '16:00', avgAqi: 62, avgPm25: 16.0 },
  peakSmogWindow: { startHour: '08:00', endHour: '11:00', avgAqi: 105, avgPm25: 37.0 },
  inversionRisk: 'Moderate',
  inversionExplanation: 'Moderate boundary-layer trapping',
};

describe('Gemini Grounded Smog Advisor', () => {
  const onLog = vi.fn();

  beforeEach(() => {
    onLog.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns live Gemini text when API responds with valid candidate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '• Shift walks to 13:00–16:00 (-35% PM2.5 dose).' }],
              },
            },
          ],
        }),
      })
    );

    const result = await generateGroundedSmogAdvice({
      userQuestion: 'Plan my day',
      userApiKey: 'test-key',
      snapshot: mockSnapshot,
      category: getAqiCategoryInfo(81),
      cleanWindow: mockCleanWindow,
      profileLabel: 'Children / School Commute',
      commuteLabel: 'Private Car',
      homeSetupLabel: 'Natural Ventilation Only',
      selectedActions: [],
      onLog,
    });

    expect(result.isLiveGemini).toBe(true);
    expect(result.text).toContain('13:00–16:00');
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'Gemini 2.0 Flash API',
        status: 200,
      })
    );
  });

  it('retries on HTTP 429 and succeeds on subsequent attempt', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Recovered advice' }] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    const promise = generateGroundedSmogAdvice({
      userQuestion: 'Retry test',
      userApiKey: 'test-key',
      snapshot: mockSnapshot,
      category: getAqiCategoryInfo(81),
      cleanWindow: mockCleanWindow,
      profileLabel: 'General Adult',
      commuteLabel: 'Transit',
      homeSetupLabel: 'HEPA',
      selectedActions: [],
      onLog,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ text: 'Recovered advice', isLiveGemini: true });
  });

  it('returns deterministic fallback guidance when Gemini fails or returns empty payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] }),
      })
    );

    const promise = generateGroundedSmogAdvice({
      userQuestion: 'Fallback test',
      userApiKey: '',
      snapshot: mockSnapshot,
      category: getAqiCategoryInfo(81),
      cleanWindow: mockCleanWindow,
      profileLabel: 'Asthma',
      commuteLabel: 'Bike / Walk',
      homeSetupLabel: 'DIY Corsi-Rosenthal Box',
      selectedActions: [],
      onLog,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isLiveGemini).toBe(false);
    expect(result.text).toContain('London');
    expect(result.text).toContain('13:00–16:00');
  });

  it('does not retry on non-retryable HTTP 401 and sends API key in header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await generateGroundedSmogAdvice({
      userQuestion: 'Auth check',
      userApiKey: 'secret-key-123',
      snapshot: mockSnapshot,
      category: getAqiCategoryInfo(81),
      cleanWindow: mockCleanWindow,
      profileLabel: 'General Adult',
      commuteLabel: 'Transit',
      homeSetupLabel: 'HEPA',
      selectedActions: [],
      onLog,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).not.toContain('secret-key-123');
    expect(calledInit.headers['x-goog-api-key']).toBe('secret-key-123');
    expect(result.isLiveGemini).toBe(false);
    expect(result.text).toContain('HTTP 401');
  });
});
