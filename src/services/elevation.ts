/**
 * Elevation data service using Open-Elevation API
 * Free, no API key required
 * Data source: SRTM 30m resolution
 */

const OPEN_ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup';

interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

interface ElevationResponse {
  results: ElevationPoint[];
}

/**
 * Fetch elevation for a single point
 */
export async function fetchElevation(lat: number, lon: number): Promise<number> {
  try {
    const response = await fetch(`${OPEN_ELEVATION_API}?locations=${lat},${lon}`);

    if (!response.ok) {
      throw new Error(`Elevation API error: ${response.status}`);
    }

    const data: ElevationResponse = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0].elevation;
    }

    throw new Error('No elevation data returned');
  } catch (error) {
    console.error('Failed to fetch elevation:', error);
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
