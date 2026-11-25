import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearApiCaches,
  detectLiveUserLocation,
  searchCitiesLive,
  fetchLiveAirQualityAndWeather,
} from '../lib/api-services';
import type { CityLocation } from '../types';

describe('API Services (Open-Meteo & Geolocation)', () => {
  const onLog = vi.fn();

  beforeEach(() => {
    clearApiCaches();
    onLog.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('searchCitiesLive', () => {
    it('returns empty array for queries shorter than 2 characters without fetching', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      expect(await searchCitiesLive('', onLog)).toEqual([]);
      expect(await searchCitiesLive(' a ', onLog)).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('maps Open-Meteo geocoding results and caches subsequent queries', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 2643743,
              name: 'London',
              country: 'United Kingdom',
              admin1: 'England',
              latitude: 51.50853,
              longitude: -0.12574,
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const first = await searchCitiesLive('London', onLog);
      expect(first).toHaveLength(1);
      expect(first[0]).toMatchObject({
        id: 'om-2643743',
        name: 'London',
        country: 'United Kingdom',
        admin1: 'England',
        detectionMethod: 'live-search',
      });
      expect(onLog).toHaveBeenCalledTimes(1);

      // Second call hits cache
      const second = await searchCitiesLive('  london ', onLog);
      expect(second).toEqual(first);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when results field is missing and throws on HTTP error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
      );
      expect(await searchCitiesLive('Nowhere', onLog)).toEqual([]);

      clearApiCaches();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({}),
        })
      );
      await expect(searchCitiesLive('Tokyo', onLog)).rejects.toThrow(
        'Geocoding service returned HTTP 503'
      );
    });
  });

  describe('fetchLiveAirQualityAndWeather', () => {
    const city: CityLocation = {
      id: 'om-1850147',
      name: 'Tokyo',
      country: 'Japan',
      latitude: 35.6895,
      longitude: 139.6917,
      detectionMethod: 'live-search',
    };

    it('fetches and parses air quality, weather, and hourly forecast', async () => {
      const futureIso = `${new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16)}Z`;
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            current: {
              pm2_5: 18.5,
              pm10: 30.2,
              nitrogen_dioxide: 24.0,
              ozone: 42.0,
              sulphur_dioxide: 3.1,
              carbon_monoxide: 220.0,
            },
            hourly: {
              time: [futureIso],
              pm2_5: [19.0],
              pm10: [31.0],
              nitrogen_dioxide: [22.0],
              ozone: [40.0],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            current: {
              temperature_2m: 14.3,
              relative_humidity_2m: 61,
              wind_speed_10m: 11.4,
            },
          }),
        });
      vi.stubGlobal('fetch', fetchSpy);

      const snapshot = await fetchLiveAirQualityAndWeather(city, onLog);
      expect(snapshot.source).toBe('live-open-meteo');
      expect(snapshot.current.pm25).toBe(18.5);
      expect(snapshot.current.usAqi).toBe(69);
      expect(snapshot.weather).toEqual({
        temperatureC: 14.3,
        humidityPct: 61,
        windSpeedKmh: 11.4,
      });
      expect(snapshot.hourly).toHaveLength(1);

      // Cached on second call
      const cached = await fetchLiveAirQualityAndWeather(city, onLog);
      expect(cached.source).toBe('cached-open-meteo');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('falls back to default weather if weather endpoint fails, and throws if AQ fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ current: {}, hourly: {} }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
          })
      );

      const snapshot = await fetchLiveAirQualityAndWeather(city, onLog, true);
      expect(snapshot.current.pm25).toBe(0);
      expect(snapshot.weather).toEqual({
        temperatureC: 18,
        humidityPct: 50,
        windSpeedKmh: 10,
      });

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: false, status: 502 })
          .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      );
      await expect(fetchLiveAirQualityAndWeather(city, onLog, true)).rejects.toThrow(
        'Open-Meteo Air Quality API returned HTTP 502'
      );
    });
  });

  describe('detectLiveUserLocation', () => {
    it('uses browser geolocation + reverse geocoding when available', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: (success: PositionCallback) =>
            success({
              coords: { latitude: 48.8566, longitude: 2.3522 },
            } as GeolocationPosition),
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ city: 'Paris', countryName: 'France' }),
        })
      );

      const loc = await detectLiveUserLocation(onLog);
      expect(loc).toMatchObject({
        name: 'Paris',
        country: 'France',
        latitude: 48.8566,
        longitude: 2.3522,
        detectionMethod: 'browser-gps',
      });
    });

    it('falls back to IP geolocation when browser geolocation rejects', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: (_s: PositionCallback, error: PositionErrorCallback) =>
            error({ code: 1, message: 'Denied' } as GeolocationPositionError),
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            city: 'Berlin',
            country_name: 'Germany',
            latitude: 52.52,
            longitude: 13.405,
          }),
        })
      );

      const loc = await detectLiveUserLocation(onLog);
      expect(loc).toMatchObject({
        name: 'Berlin',
        country: 'Germany',
        detectionMethod: 'ip-geolocation',
      });
    });

    it('falls back to coordinate default when IP and geocoding fail', async () => {
      vi.stubGlobal('navigator', {});
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValueOnce(new Error('IP blocked'))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ results: [] }),
          })
      );

      const loc = await detectLiveUserLocation(onLog);
      expect(loc.name).toBe('New Delhi');
      expect(loc.detectionMethod).toBe('live-search');
    });
  });
});
