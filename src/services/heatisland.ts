/**
 * Heat Island service using Sentinel-2 SWIR surface temperature estimation
 * Requires: Backend API running on localhost:3002 (development) or production URL
 *
 * Data source: Sentinel-2 SWIR bands via Microsoft Planetary Computer
 * 100% FREE - No API keys required
 *
 * Measures: Urban heat island effect (temperature difference between urban and vegetated areas)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface HeatIslandResponse {
  success: boolean;
  data: {
    heatIslandEffect: number; // Temperature difference in °C
    category: string; // e.g., "Minimal Heat Island"
    score: number; // 0-10 walkability score
    urbanTemp: number;
    vegetationTemp: number;
    urbanPixels: number;
    vegetationPixels: number;
    buildingDensity?: { ndbi: number | null; score: number }; // NDBI building density
    imageDate: string;
    cloudCover: number;
    location: { lat: number; lon: number };
    dataSource: string;
    dataQuality: string;
    timestamp: string;
  } | null;
  error?: string;
  message?: string;
}

/**
 * Fetch heat island data from Sentinel-2 SWIR backend API
 * Returns score (0-10) for walkability
 */
export async function fetchHeatIsland(
  lat: number,
  lon: number
): Promise<{ score: number; effect: number | null; category: string | null; buildingDensity?: { ndbi: number | null; score: number } } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/heat-island?lat=${lat}&lon=${lon}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000), // 15 second timeout (satellite data can be slow)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const result: HeatIslandResponse = await response.json();

    if (!result.success) {
      console.log('No heat island data available for this location');
      return null;
    }

    // No data available
    if (!result.data) {
      console.log('Heat island data not available (cloud cover or no satellite imagery)');
      return null;
    }

    return {
      score: result.data.score,
      effect: result.data.heatIslandEffect,
      category: result.data.category,
      buildingDensity: result.data.buildingDensity,
    };
  } catch (error) {
    console.error('Failed to fetch heat island data:', error);

    // Check if backend is running
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('⚠️  Backend API not available. Is the server running on', API_BASE_URL);
      console.warn('   Start the backend: cd api && npm install && npm run dev');
    }

    return null;
  }
}

/**
 * Score heat island effect for walkability
 * Lower heat island effect = better for pedestrians
 *
 * Scoring:
 * - <2°C (Minimal) = 10 points
 * - 2-5°C (Low) = 8 points
 * - 5-8°C (Moderate) = 6 points
 * - 8-12°C (Significant) = 4 points
 * - >12°C (Severe) = 2 points
 */
export function scoreHeatIsland(effectCelsius: number): number {
  if (effectCelsius < 2) {
    return 10;
  } else if (effectCelsius < 5) {
    return 8;
  } else if (effectCelsius < 8) {
    return 6;
  } else if (effectCelsius < 12) {
    return 4;
  } else {
    return 2;
  }
}
