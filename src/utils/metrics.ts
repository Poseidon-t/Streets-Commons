import type { OSMData, WalkabilityMetrics, DataQuality } from '../types';
import { MAX_CROSSING_GAP } from '../constants';

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
 * Metric 1: Crossing Density
 * Measures density of marked pedestrian crossings
 * Source: OSM highway=crossing nodes
 */
function calculateCrossingDensity(data: OSMData, centerLat: number, centerLon: number): number {
  if (data.crossings.length === 0) return 0;
  if (data.streets.length === 0) return 0;

  // Calculate crossings per km of road
  const estimatedRoadKm = (data.streets.length * 100) / 1000;
  const crossingsPerKm = data.crossings.length / estimatedRoadKm;

  // Also check max gap from center
  let maxGap = 0;
  data.crossings.forEach(c => {
    if (c.lat && c.lon) {
      const distance = calculateDistance(centerLat, centerLon, c.lat, c.lon);
      maxGap = Math.max(maxGap, distance);
    }
  });

  // Score based on both density and max gap
  const densityScore = Math.min(10, (crossingsPerKm / 8) * 10);
  const gapScore = Math.max(0, 10 - (maxGap / MAX_CROSSING_GAP) * 5);

  const score = (densityScore + gapScore) / 2;
  return Math.round(score * 10) / 10;
}

/**
 * Metric 2: Sidewalk Coverage
 * Percentage of streets with sidewalk tags
 * Source: OSM sidewalk=* tags on ways
 */
function calculateSidewalkCoverage(data: OSMData): number {
  if (data.streets.length === 0) return 0;

  const streetsWithSidewalks = data.streets.filter(
    s => {
      const sw = s.tags?.sidewalk;
      return sw && sw !== 'no' && sw !== 'none';
    }
  );

  const coverage = (streetsWithSidewalks.length / data.streets.length) * 100;

  // Score: 90%+ = 10, 45% = 5, 0% = 0
  const score = Math.min(10, (coverage / 90) * 10);
  return Math.round(score * 10) / 10;
}

/**
 * Metric 3: Network Efficiency
 * Grid-like connectivity (intersection density)
 * Source: OSM crossings vs street segments
 */
function calculateNetworkEfficiency(data: OSMData): number {
  if (data.streets.length === 0) return 0;

  const connectivity = data.crossings.length / data.streets.length;

  // Grid networks: ~0.5 ratio (1 intersection per 2 streets)
  // Score: 0.5+ = 10, 0.25 = 5, 0 = 0
  const score = Math.min(10, (connectivity / 0.5) * 10);
  return Math.round(score * 10) / 10;
}

/**
 * Metric 4: Destination Access
 * Variety of destination types within 800m
 * Source: OSM amenity, shop, leisure tags
 */
function calculateDestinationAccess(data: OSMData): number {
  const categories = {
    education: false,
    transit: false,
    shopping: false,
    healthcare: false,
    food: false,
    recreation: false,
  };

  data.pois.forEach(poi => {
    if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten')
      categories.education = true;
    if (poi.tags?.amenity === 'bus_station' || poi.tags?.railway === 'station')
      categories.transit = true;
    if (poi.tags?.shop)
      categories.shopping = true;
    if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic' || poi.tags?.amenity === 'pharmacy')
      categories.healthcare = true;
    if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe' || poi.tags?.amenity === 'bar')
      categories.food = true;
    if (poi.tags?.leisure === 'park' || poi.tags?.leisure === 'playground' || poi.tags?.leisure === 'sports_centre')
      categories.recreation = true;
  });

  const typeCount = Object.values(categories).filter(Boolean).length;

  // Score: 6 types = 10, 3 types = 5, 0 = 0
  const score = Math.min(10, (typeCount / 6) * 10);
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

  // Assess confidence based on data completeness
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

export function calculateMetrics(
  data: OSMData,
  centerLat: number,
  centerLon: number
): WalkabilityMetrics {
  const crossingDensity = calculateCrossingDensity(data, centerLat, centerLon);
  const sidewalkCoverage = calculateSidewalkCoverage(data);
  const networkEfficiency = calculateNetworkEfficiency(data);
  const destinationAccess = calculateDestinationAccess(data);

  // Weighted average of 4 metrics
  const overallScore = Math.round(
    (crossingDensity * 0.30 +
      sidewalkCoverage * 0.30 +
      networkEfficiency * 0.20 +
      destinationAccess * 0.20) * 10
  ) / 10;

  return {
    crossingDensity,
    sidewalkCoverage,
    networkEfficiency,
    destinationAccess,
    overallScore,
    label: getScoreLabel(overallScore),
  };
}

export { assessDataQuality };
