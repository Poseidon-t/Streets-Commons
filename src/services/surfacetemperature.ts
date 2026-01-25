/**
 * Surface temperature service using Landsat thermal data via backend API
 * Requires: Backend API running on localhost:3001 (development) or production URL
 *
 * Data source: Landsat 8/9 Collection 2 Surface Temperature
 * Via: Google Earth Engine (cloud processing)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SurfaceTemperatureResponse {
  success: boolean;
  data: {
    temperatureCelsius: number;
    temperatureFahrenheit: number;
    score: number;
    location: { lat: number; lon: number };
    dataSource: string;
    timestamp: string;
  };
  error?: string;
}

/**
 * Fetch surface temperature from Landsat thermal data
 * Returns score (0-10) for walkability
 */
export async function fetchSurfaceTemperature(
  lat: number,
  lon: number
): Promise<{ score: number; tempCelsius: number } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/surface-temperature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lon }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const result: SurfaceTemperatureResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid API response');
    }

    return {
      score: result.data.score,
      tempCelsius: result.data.temperatureCelsius,
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
