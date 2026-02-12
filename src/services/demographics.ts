import type { DemographicData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function fetchDemographicData(
  lat: number,
  lon: number,
  countryCode?: string,
): Promise<DemographicData | null> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    if (countryCode) params.set('countryCode', countryCode);

    const response = await fetch(`${API_BASE_URL}/api/demographics?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('Demographics API error:', response.status);
      return null;
    }

    const result = await response.json();
    if (!result.success || !result.data) return null;

    return result.data as DemographicData;
  } catch (error) {
    console.error('Failed to fetch demographic data:', error);
    return null;
  }
}
