import type { OSMData, WalkabilityMetrics } from '../types';
import {
  MAX_CROSSING_GAP,
  MIN_TREE_CANOPY,
  METRIC_WEIGHTS,
} from '../constants';

// Calculate distance between two points (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
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
 * Metric 1: Crossing Gaps
 * Measures maximum distance between pedestrian crossings
 * Standard: ≤200m gaps
 */
function calculateCrossingGaps(data: OSMData, centerLat: number, centerLon: number): number {
  if (data.crossings.length === 0) return 0;

  // Find largest gap by checking distance from center to nearest crossing
  const crossingsWithDistance = data.crossings.map(c => ({
    ...c,
    distance: calculateDistance(centerLat, centerLon, c.lat, c.lon),
  }));

  // Group crossings by direction (N, S, E, W, NE, NW, SE, SW)
  const directions = [
    { name: 'N', angle: 0 },
    { name: 'NE', angle: 45 },
    { name: 'E', angle: 90 },
    { name: 'SE', angle: 135 },
    { name: 'S', angle: 180 },
    { name: 'SW', angle: 225 },
    { name: 'W', angle: 270 },
    { name: 'NW', angle: 315 },
  ];

  let maxGap = 0;
  directions.forEach(dir => {
    // Find nearest crossing in this direction
    const crossingsInDir = crossingsWithDistance.filter(c => {
      const angle = Math.atan2(c.lat - centerLat, c.lon - centerLon) * 180 / Math.PI;
      const normalizedAngle = (angle + 360) % 360;
      const diff = Math.abs(normalizedAngle - dir.angle);
      return diff < 45 || diff > 315;
    });

    if (crossingsInDir.length > 0) {
      const nearest = Math.min(...crossingsInDir.map(c => c.distance));
      maxGap = Math.max(maxGap, nearest);
    } else {
      maxGap = MAX_CROSSING_GAP * 3; // No crossing in this direction
    }
  });

  // Score: 10 at 0m gap, 5 at 200m gap, 0 at 400m+ gap
  const score = Math.max(0, 10 - (maxGap / MAX_CROSSING_GAP) * 5);
  return Math.round(score * 10) / 10;
}

/**
 * Metric 2: Tree Canopy
 * Would use Sentinel-2 NDVI in production
 * For MVP: estimate from OSM landuse=forest, natural=tree_row, etc.
 */
function calculateTreeCanopy(data: OSMData): number {
  if (data.streets.length === 0) return 0;

  // Count tree-related OSM features
  const greenElements = data.pois.filter(p =>
    p.tags?.natural === 'tree' ||
    p.tags?.landuse === 'forest' ||
    p.tags?.landuse === 'grass' ||
    p.tags?.leisure === 'park'
  );

  // Estimate coverage based on green element density
  const estimatedCoverage = Math.min(100, (greenElements.length / data.streets.length) * 50);

  // Score: 10 at 30%+, 5 at 15%, 0 at 0%
  const score = Math.min(10, (estimatedCoverage / MIN_TREE_CANOPY) * 10);
  return Math.round(score * 10) / 10;
}

/**
 * Metric 3: Surface Temperature
 * Would use Landsat 8 thermal in production
 * For MVP: return placeholder based on tree canopy (more trees = cooler)
 */
function calculateSurfaceTemp(treeCanopyScore: number): number {
  // Inverse relationship: more trees = better temp score
  // Tree score 10 → temp score 10, tree score 0 → temp score 0
  return treeCanopyScore;
}

/**
 * Metric 4: Network Efficiency
 * Measures detour factor (actual walking distance vs straight-line)
 * Uses intersection density as proxy
 */
function calculateNetworkEfficiency(data: OSMData): number {
  if (data.streets.length === 0) return 0;

  const intersectionDensity = data.crossings.length / data.streets.length;

  // High density (>0.5) = grid-like = efficient (low detour)
  // Low density (<0.2) = winding = inefficient (high detour)
  // Score: 10 at 0.5+, 5 at 0.25, 0 at 0
  const score = Math.min(10, (intersectionDensity / 0.5) * 10);
  return Math.round(score * 10) / 10;
}

/**
 * Metric 5: Slope
 * Would use SRTM elevation data in production
 * For MVP: return moderate score (most urban areas are <5% slope)
 */
function calculateSlope(): number {
  // Placeholder: assume moderate slope (7-8 score)
  return Math.round((7 + Math.random()) * 10) / 10;
}

/**
 * Metric 6: Destination Access
 * Counts types of destinations within 800m
 * Categories: school, transit, shop, healthcare, etc.
 */
function calculateDestinationAccess(data: OSMData): number {
  const categories = {
    school: false,
    transit: false,
    shop: false,
    healthcare: false,
    food: false,
    recreation: false,
  };

  data.pois.forEach(poi => {
    if (poi.tags?.amenity === 'school') categories.school = true;
    if (poi.tags?.amenity === 'bus_station' || poi.tags?.railway === 'station') categories.transit = true;
    if (poi.tags?.shop) categories.shop = true;
    if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') categories.healthcare = true;
    if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') categories.food = true;
    if (poi.tags?.leisure === 'park' || poi.tags?.leisure === 'playground') categories.recreation = true;
  });

  const typeCount = Object.values(categories).filter(Boolean).length;

  // Score: 10 at 6 types, 5 at 3 types, 0 at 0 types
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

export function calculateMetrics(
  data: OSMData,
  centerLat: number,
  centerLon: number
): WalkabilityMetrics {
  const crossingGaps = calculateCrossingGaps(data, centerLat, centerLon);
  const treeCanopy = calculateTreeCanopy(data);
  const surfaceTemp = calculateSurfaceTemp(treeCanopy);
  const networkEfficiency = calculateNetworkEfficiency(data);
  const slope = calculateSlope();
  const destinationAccess = calculateDestinationAccess(data);

  // Weighted average (excluding surface temp for now since it's derived)
  const overallScore = Math.round(
    (crossingGaps * METRIC_WEIGHTS.crossingGaps +
      treeCanopy * METRIC_WEIGHTS.treeCanopy +
      networkEfficiency * METRIC_WEIGHTS.networkEfficiency +
      slope * METRIC_WEIGHTS.slope +
      destinationAccess * METRIC_WEIGHTS.destinationAccess +
      (data.sidewalks.length / Math.max(1, data.streets.length) * 10) * METRIC_WEIGHTS.sidewalkCoverage) *
      10
  ) / 10;

  return {
    crossingGaps,
    treeCanopy,
    surfaceTemp,
    networkEfficiency,
    slope,
    destinationAccess,
    overallScore,
    label: getScoreLabel(overallScore),
  };
}
