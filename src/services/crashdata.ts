/**
 * Crash Data Service
 *
 * Fetches fatal crash/death data:
 * - US locations: Street-level data from NHTSA FARS (crashes within 800m)
 * - International: Country-level WHO road traffic death rates
 */

import type { CrashData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetch crash/fatality data for a location.
 * Returns null on error — never blocks the main analysis.
 */
export async function fetchCrashData(
  lat: number,
  lon: number,
  countryCode?: string,
): Promise<CrashData | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    if (countryCode) {
      params.set('country', countryCode);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/crash-data?${params.toString()}`,
      { signal: AbortSignal.timeout(15000) },
    );

    if (!response.ok) {
      console.warn(`Crash data API returned ${response.status}`);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return null;
    }

    return result.data as CrashData;
  } catch (error) {
    console.warn('Crash data fetch failed (non-blocking):', error);
    return null;
  }
}
