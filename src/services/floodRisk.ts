import type { FloodRiskData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function fetchFloodRisk(lat: number, lon: number): Promise<FloodRiskData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/flood-risk?lat=${lat}&lon=${lon}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('FEMA flood risk API error:', response.status);
      return null;
    }

    const result = await response.json();
    if (!result.success || !result.data) return null;

    return result.data as FloodRiskData;
  } catch (error) {
    console.error('Failed to fetch flood risk data:', error);
    return null;
  }
}
