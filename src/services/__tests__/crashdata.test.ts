/**
 * Crash Data Service Tests
 *
 * Tests fetchCrashData for US (FARS via FCC+NHTSA), international (WHO static JSON),
 * error handling, and edge cases.
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
    // Mock FCC Census API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [{ state_fips: '48', county_fips: '201', county_name: 'Harris' }],
      }),
    });

    // Mock FARS API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { LATITUDE: '29.7370', LONGITUD: '-95.4610', FATALS: '2', CaseYear: '2021', TWAY_ID: 'Westheimer Rd' },
        { LATITUDE: '29.7380', LONGITUD: '-95.4600', FATALS: '1', CaseYear: '2020', TWAY_ID: 'Richmond Ave' },
        { LATITUDE: '50.0000', LONGITUD: '-90.0000', FATALS: '1', CaseYear: '2019', TWAY_ID: 'Far Away Rd' }, // outside 800m
      ]),
    });

    const result = await fetchCrashData(29.7372, -95.4608, 'us');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('local');
    if (result!.type === 'local') {
      expect(result!.totalCrashes).toBe(2); // Only 2 within 800m
      expect(result!.totalFatalities).toBe(3);
      expect(result!.dataSource).toBe('NHTSA FARS');
      expect(result!.yearRange).toEqual({ from: 2018, to: 2022 });
      expect(result!.yearlyBreakdown).toHaveLength(5);
    }

    // Should have called FCC first, then FARS
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain('geo.fcc.gov');
    expect(mockFetch.mock.calls[1][0]).toContain('crashviewer.nhtsa.dot.gov');
  });

  it('should return CountryCrashData for a non-US location (WHO static lookup)', async () => {
    // WHO lookup is from static JSON — no fetch calls needed
    const result = await fetchCrashData(48.8566, 2.3522, 'fr');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('country');
    if (result!.type === 'country') {
      expect(result!.deathRatePer100k).toBeGreaterThan(0);
      expect(result!.countryName).toBe('France');
      expect(result!.dataSource).toBe('WHO Global Health Observatory');
    }

    // No network calls for WHO data
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return null for unknown country code', async () => {
    const result = await fetchCrashData(0, 0, 'xx');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return null on FCC API error for US location', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await fetchCrashData(29.7372, -95.4608, 'us');
    expect(result).toBeNull();
  });

  it('should return null on FARS API error for US location', async () => {
    // FCC succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [{ state_fips: '48', county_fips: '201' }],
      }),
    });

    // FARS fails
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

  it('should return null when no country code is provided', async () => {
    const result = await fetchCrashData(29.7372, -95.4608);
    expect(result).toBeNull();
  });

  it('should handle WHO lookup with alpha-3 codes', async () => {
    const result = await fetchCrashData(51.5074, -0.1278, 'gb');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('country');
    if (result!.type === 'country') {
      expect(result!.countryName).toContain('United Kingdom');
    }
  });
});
