/**
 * Elevation data service using NASADEM via backend API
 * Free, no API key required
 * Data source: NASADEM 30m resolution (NASA's Digital Elevation Model)
 * Backend provides both elevation and slope calculation
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const OPEN_ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup'; // Fallback

interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

interface ElevationResponse {
  results: ElevationPoint[];
}

/**
 * Fetch elevation for a single point using NASADEM backend API
 */
export async function fetchElevation(lat: number, lon: number): Promise<number> {
  try {
    // Try NASADEM backend first
    const response = await fetch(`${API_BASE_URL}/api/elevation?lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`NASADEM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && typeof data.data.elevation === 'number') {
      return data.data.elevation;
    }

    throw new Error('No elevation data returned from NASADEM');
  } catch (error) {
    console.warn('NASADEM elevation fetch failed, trying fallback:', error);

    // Fallback to Open-Elevation API
    try {
      const fallbackResponse = await fetch(`${OPEN_ELEVATION_API}?locations=${lat},${lon}`);

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback elevation API error: ${fallbackResponse.status}`);
      }

      const fallbackData: ElevationResponse = await fallbackResponse.json();

      if (fallbackData.results && fallbackData.results.length > 0) {
        return fallbackData.results[0].elevation;
      }
    } catch (fallbackError) {
      console.error('Both elevation APIs failed:', fallbackError);
    }

    throw error;
  }
}

/**
 * Fetch elevation for multiple points (for slope calculation)
 * Returns elevation profile around center point
 */
export async function fetchElevationProfile(
  centerLat: number,
  centerLon: number,
  radius: number = 800 // meters
): Promise<number[]> {
  // Create a grid of points around center (N, S, E, W, NE, NW, SE, SW)
  const latOffset = radius / 111000; // ~111km per degree latitude
  const lonOffset = radius / (111000 * Math.cos(centerLat * Math.PI / 180));

  const points = [
    { lat: centerLat, lon: centerLon }, // Center
    { lat: centerLat + latOffset, lon: centerLon }, // North
    { lat: centerLat - latOffset, lon: centerLon }, // South
    { lat: centerLat, lon: centerLon + lonOffset }, // East
    { lat: centerLat, lon: centerLon - lonOffset }, // West
    { lat: centerLat + latOffset, lon: centerLon + lonOffset }, // NE
    { lat: centerLat + latOffset, lon: centerLon - lonOffset }, // NW
    { lat: centerLat - latOffset, lon: centerLon + lonOffset }, // SE
    { lat: centerLat - latOffset, lon: centerLon - lonOffset }, // SW
  ];

  const locations = points.map(p => `${p.lat},${p.lon}`).join('|');

  try {
    const response = await fetch(`${OPEN_ELEVATION_API}?locations=${locations}`);

    if (!response.ok) {
      throw new Error(`Elevation API error: ${response.status}`);
    }

    const data: ElevationResponse = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results.map(r => r.elevation);
    }

    throw new Error('No elevation data returned');
  } catch (error) {
    console.error('Failed to fetch elevation profile:', error);
    throw error;
  }
}

/**
 * Calculate average slope from elevation profile
 * Returns slope as percentage (rise/run * 100)
 */
export function calculateSlope(elevations: number[], radius: number = 800): number {
  if (elevations.length < 2) {
    return 0;
  }

  const centerElevation = elevations[0];
  const otherElevations = elevations.slice(1);

  // Calculate average elevation difference
  const avgElevationDiff = otherElevations.reduce((sum, elev) => {
    return sum + Math.abs(elev - centerElevation);
  }, 0) / otherElevations.length;

  // Calculate slope as percentage
  // slope = (rise / run) * 100
  const slope = (avgElevationDiff / radius) * 100;

  return Math.round(slope * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate max slope from elevation profile
 * Returns maximum slope percentage in the area
 */
export function calculateMaxSlope(elevations: number[], radius: number = 800): number {
  if (elevations.length < 2) {
    return 0;
  }

  const centerElevation = elevations[0];
  const otherElevations = elevations.slice(1);

  // Find maximum elevation difference
  const maxElevationDiff = Math.max(...otherElevations.map(elev =>
    Math.abs(elev - centerElevation)
  ));

  // Calculate slope as percentage
  const slope = (maxElevationDiff / radius) * 100;

  return Math.round(slope * 10) / 10;
}

/**
 * Fetch slope directly from NASADEM backend API (real terrain gradient calculation)
 * Returns slope in degrees (more accurate than elevation profile method)
 */
export async function fetchSlope(lat: number, lon: number): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/slope?lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Slope API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && typeof data.data.slope === 'number') {
      return data.data.slope; // Slope in degrees
    }

    throw new Error('No slope data returned');
  } catch (error) {
    console.warn('NASADEM slope fetch failed:', error);
    throw error;
  }
}

/**
 * Convert slope from degrees to percentage
 */
export function degreesToPercent(degrees: number): number {
  return Math.tan(degrees * Math.PI / 180) * 100;
}

/**
 * Score slope for walkability (wheelchair accessibility)
 * Target: ≤5% gradient
 * Returns 0-10 score
 */
export function scoreSlopeForWalkability(avgSlope: number, maxSlope: number): number {
  // Penalize both average and maximum slope
  // Average slope should be low, max slope shouldn't exceed 8%

  const avgScore = Math.max(0, 10 - (avgSlope / 5) * 10); // 5% = 0 points
  const maxScore = Math.max(0, 10 - (maxSlope / 8) * 10); // 8% = 0 points

  // Weighted average: avg slope 70%, max slope 30%
  const score = (avgScore * 0.7 + maxScore * 0.3);

  return Math.round(score * 10) / 10;
}

/**
 * Score slope from degrees (for NASADEM backend data)
 * Returns 0-10 score based on real terrain slope
 */
export function scoreSlopeFromDegrees(slopeDegrees: number): number {
  // Scoring based on slope angle in degrees:
  // 0-2°: 10 points (Flat, ideal)
  // 2-5°: 8 points (Gentle)
  // 5-10°: 6 points (Moderate)
  // 10-15°: 4 points (Steep)
  // >15°: 2 points (Very steep)

  if (slopeDegrees <= 2) return 10;
  if (slopeDegrees <= 5) return 8;
  if (slopeDegrees <= 10) return 6;
  if (slopeDegrees <= 15) return 4;
  return 2;
}
