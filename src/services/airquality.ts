/**
 * Air quality service using OpenAQ monitoring stations
 * Requires: Backend API running on localhost:3002 (development) or production URL
 *
 * Data source: OpenAQ (15,000+ global monitoring stations)
 * 100% FREE - No API keys required
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

interface OpenAQResponse {
  success: boolean;
  data: {
    measurements: Record<string, {
      value: number;
      unit: string;
      stationCount: number;
    }>;
    aqiScore: number | null;
    aqiCategory: string | null;
    nearestStationDistance: number | null;
    stationsFound: number;
    location: { lat: number; lon: number };
    dataSource: string;
    timestamp: string;
  } | null;
  message?: string;
  error?: string;
}

/**
 * Fetch air quality from OpenAQ monitoring stations
 * Returns score (0-10) for walkability
 */
export async function fetchAirQuality(
  lat: number,
  lon: number
): Promise<{ score: number; pm25: number | null; category: string | null } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/air-quality?lat=${lat}&lon=${lon}`, {
      method: 'GET',
      signal: AbortSignal.timeout(12000), // 12 second timeout
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const result: OpenAQResponse = await response.json();

    if (!result.success) {
      throw new Error('Invalid API response');
    }

    // No data available
    if (!result.data || !result.data.aqiScore) {
      console.log('No air quality data available within 25km');
      return null;
    }

    const pm25Value = result.data.measurements.pm25?.value || null;

    return {
      score: result.data.aqiScore,
      pm25: pm25Value,
      category: result.data.aqiCategory,
    };
  } catch (error) {
    console.error('Failed to fetch air quality:', error);

    // Check if backend is running
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('⚠️  Backend API not available. Is the server running on', API_BASE_URL);
      console.warn('   Start the backend: cd api && npm install && npm run dev');
    }

    return null;
  }
}

/**
 * Score air quality for walkability
 * Based on PM2.5 levels (US EPA AQI)
 *
 * - 0-12 µg/m³ (Good) = 10 points
 * - 12-35 µg/m³ (Moderate) = 8 points
 * - 35-55 µg/m³ (Unhealthy for Sensitive) = 6 points
 * - 55-150 µg/m³ (Unhealthy) = 4 points
 * - 150-250 µg/m³ (Very Unhealthy) = 2 points
 * - 250+ µg/m³ (Hazardous) = 0 points
 */
export function scoreAirQuality(pm25: number): number {
  if (pm25 <= 12) {
    return 10;
  } else if (pm25 <= 35.4) {
    return 8;
  } else if (pm25 <= 55.4) {
    return 6;
  } else if (pm25 <= 150.4) {
    return 4;
  } else if (pm25 <= 250.4) {
    return 2;
  } else {
    return 0;
  }
}
