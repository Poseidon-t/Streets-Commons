import type { OSMData, WalkabilityMetrics, DataQuality } from '../types';

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Destination Access
 * Density and proximity of 6 destination categories within walking distance.
 * Each category scored by: how many exist (density) + how close the nearest is (proximity).
 * Source: OSM amenity, shop, leisure tags
 */
function calculateDestinationAccess(data: OSMData, centerLat: number, centerLon: number): number {
  function getPoiCoords(poi: any): { lat: number; lon: number } | null {
    if (poi.lat !== undefined && poi.lon !== undefined) return { lat: poi.lat, lon: poi.lon };
    if (poi.center?.lat !== undefined && poi.center?.lon !== undefined) return { lat: poi.center.lat, lon: poi.center.lon };
    return null;
  }

  type Category = 'education' | 'transit' | 'shopping' | 'healthcare' | 'food' | 'recreation';
  const categoryPOIs: Record<Category, number[]> = {
    education: [],
    transit: [],
    shopping: [],
    healthcare: [],
    food: [],
    recreation: [],
  };

  for (const poi of data.pois) {
    const coords = getPoiCoords(poi);
    if (!coords) continue;
    const dist = calculateDistance(centerLat, centerLon, coords.lat, coords.lon);

    if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten')
      categoryPOIs.education.push(dist);
    if (poi.tags?.amenity === 'bus_station' || poi.tags?.railway === 'station')
      categoryPOIs.transit.push(dist);
    if (poi.tags?.shop)
      categoryPOIs.shopping.push(dist);
    if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic' || poi.tags?.amenity === 'pharmacy')
      categoryPOIs.healthcare.push(dist);
    if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe' || poi.tags?.amenity === 'bar')
      categoryPOIs.food.push(dist);
    if (poi.tags?.leisure === 'park' || poi.tags?.leisure === 'playground' || poi.tags?.leisure === 'sports_centre')
      categoryPOIs.recreation.push(dist);
  }

  let totalCategoryScore = 0;
  const maxRadius = 1200; // meters

  for (const distances of Object.values(categoryPOIs)) {
    if (distances.length === 0) continue;

    const count = distances.length;
    const nearest = Math.min(...distances);

    const density = Math.min(count / 3, 1);
    const proximity = Math.max(0, 1 - nearest / maxRadius);
    totalCategoryScore += density * 0.4 + proximity * 0.6;
  }

  const score = Math.min(10, (totalCategoryScore / 6) * 10);
  return Math.round(score * 10) / 10;
}

function getScoreLabel(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Fair';
  if (score >= 2) return 'Poor';
  return 'Critical';
}

function assessDataQuality(data: OSMData): DataQuality {
  const crossingCount = data.crossings.length;
  const streetCount = data.streets.length;
  const sidewalkCount = data.sidewalks.length;
  const poiCount = data.pois.length;

  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (streetCount > 50 && crossingCount > 10 && poiCount > 20) {
    confidence = 'high';
  } else if (streetCount > 20 && crossingCount > 5 && poiCount > 10) {
    confidence = 'medium';
  }

  return {
    crossingCount,
    streetCount,
    sidewalkCount,
    poiCount,
    confidence,
  };
}

/**
 * Calculate the 3 frontend-visible legacy metrics.
 * The composite score (V2) handles the full scoring independently.
 * This legacy overallScore is only used as a fallback.
 */
export function calculateMetrics(
  data: OSMData,
  centerLat: number,
  centerLon: number,
  treeCanopyScore?: number,
): WalkabilityMetrics {
  const destinationAccess = calculateDestinationAccess(data, centerLat, centerLon);
  const treeCanopy = treeCanopyScore ?? 0;

  // Simple average of available metrics for legacy fallback score
  const available = [destinationAccess, treeCanopy].filter(s => s > 0);
  const overallScore = available.length > 0
    ? Math.round((available.reduce((a, b) => a + b, 0) / available.length) * 10) / 10
    : 0;

  return {
    destinationAccess,
    treeCanopy,
    speedEnvironment: data.networkGraph?.speedEnvironment?.score,
    overallScore,
    label: getScoreLabel(overallScore),
  };
}

export { assessDataQuality };
