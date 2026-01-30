/**
 * Surface temperature service using NASA POWER meteorological data
 * Requires: Backend API running on localhost:3002 (development) or production URL
 *
 * Data source: NASA POWER (30-day average temperature)
 * 100% FREE - No API keys required
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface NASAPowerResponse {
  success: boolean;
  data: {
    avgTemp: number;
    maxTemp: number;
    minTemp: number;
    // Legacy field names for backwards compatibility
    averageTemperature?: number;
    averageMaxTemperature?: number;
    averageMinTemperature?: number;
    location: { lat: number; lon: number };
    dataSource: string;
    timestamp: string;
  };
  error?: string;
}

/**
 * Fetch surface temperature from NASA POWER meteorological data
 * Returns score (0-10) for walkability
 */
export async function fetchSurfaceTemperature(
  lat: number,
  lon: number
): Promise<{ score: number; tempCelsius: number } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nasa-power-temperature?lat=${lat}&lon=${lon}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const result: NASAPowerResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid API response');
    }

    // Use average max temperature for walkability scoring (pedestrian comfort)
    // Support both new and legacy field names
    const tempCelsius = result.data.maxTemp || result.data.averageMaxTemperature || result.data.avgTemp || result.data.averageTemperature || 25;
    const score = scoreSurfaceTemperature(tempCelsius);

    return {
      score,
      tempCelsius,
    };
  } catch (error) {
    console.error('Failed to fetch surface temperature:', error);

    // Check if backend is running
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('⚠️  Backend API not available. Is the server running on', API_BASE_URL);
      console.warn('   Start the backend: cd api && npm install && npm run dev');
    }

    return null;
  }
}

/**
 * Score surface temperature for walkability
 * (This mirrors the backend scoring for consistency)
 *
 * Lower surface temp = better for pedestrians
 * - ≤25°C (comfortable) = 10 points
 * - 25-35°C (warm) = 5-10 points
 * - 35-45°C (hot) = 0-5 points
 * - >45°C (extreme heat) = 0 points
 */
export function scoreSurfaceTemperature(tempCelsius: number): number {
  if (tempCelsius <= 25) {
    return 10;
  } else if (tempCelsius <= 35) {
    return 10 - ((tempCelsius - 25) / 10) * 5;
  } else if (tempCelsius <= 45) {
    return 5 - ((tempCelsius - 35) / 10) * 5;
  } else {
    return 0;
  }
}
