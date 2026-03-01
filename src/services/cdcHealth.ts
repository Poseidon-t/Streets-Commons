import type { CDCHealthData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function fetchCDCHealth(tractFips: string): Promise<CDCHealthData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cdc-health?tractFips=${tractFips}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('CDC PLACES API error:', response.status);
      return null;
    }

    const result = await response.json();
    if (!result.success || !result.data) return null;

    return result.data as CDCHealthData;
  } catch (error) {
    console.error('Failed to fetch CDC health data:', error);
    return null;
  }
}
