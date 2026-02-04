/**
 * Crash Data Service Tests
 *
 * Tests fetchCrashData for US (FARS), international (WHO), error, and timeout cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCrashData } from '../crashdata';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
});

describe('fetchCrashData', () => {
  it('should return LocalCrashData for a US location', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'local',
          totalCrashes: 4,
          totalFatalities: 6,
          yearRange: { from: 2018, to: 2022 },
          yearlyBreakdown: [
            { year: 2018, crashes: 1, fatalities: 1 },
            { year: 2019, crashes: 0, fatalities: 0 },
            { year: 2020, crashes: 2, fatalities: 3 },
            { year: 2021, crashes: 1, fatalities: 2 },
            { year: 2022, crashes: 0, fatalities: 0 },
          ],
          nearestCrash: { distance: 230, year: 2021, fatalities: 2, road: 'Westheimer Rd' },
          radiusMeters: 800,
          dataSource: 'NHTSA FARS',
        },
      }),
    });

    const result = await fetchCrashData(29.7372, -95.4608, 'us');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('local');
    if (result!.type === 'local') {
      expect(result!.totalCrashes).toBe(4);
      expect(result!.totalFatalities).toBe(6);
      expect(result!.nearestCrash?.road).toBe('Westheimer Rd');
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/crash-data');
    expect(url).toContain('country=us');
  });

  it('should return CountryCrashData for a non-US location', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'country',
          deathRatePer100k: 4.7,
          totalDeaths: 0,
          countryName: 'France',
          year: 2021,
          dataSource: 'WHO Global Health Observatory',
        },
      }),
    });

    const result = await fetchCrashData(48.8566, 2.3522, 'fr');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('country');
    if (result!.type === 'country') {
      expect(result!.deathRatePer100k).toBe(4.7);
      expect(result!.countryName).toBe('France');
    }
  });

  it('should return null when API returns no data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: null }),
    });

    const result = await fetchCrashData(0, 0, 'xx');
    expect(result).toBeNull();
  });

  it('should return null on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await fetchCrashData(29.7372, -95.4608, 'us');
    expect(result).toBeNull();
  });

  it('should return null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchCrashData(29.7372, -95.4608, 'us');
    expect(result).toBeNull();
  });

  it('should pass country code in query params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: null }),
    });

    await fetchCrashData(48.8566, 2.3522, 'FR');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('country=FR');
  });

  it('should work without country code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: null }),
    });

    await fetchCrashData(29.7372, -95.4608);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('lat=29.7372');
    expect(url).toContain('lon=-95.4608');
    expect(url).not.toContain('country=');
  });
});
