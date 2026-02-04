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
 * Metric 1: Crossing Safety
 * Density of crossings weighted by protection level
 * Source: OSM highway=crossing nodes with crossing type tags
 */
function calculateCrossingSafety(data: OSMData, centerLat: number, centerLon: number): number {
  if (data.crossings.length === 0) return 0;
  if (data.streets.length === 0) return 0;

  // Weight crossings by protection level
  let weightedCrossings = 0;
  data.crossings.forEach(c => {
    const crossingType = c.tags?.crossing;
    if (crossingType === 'traffic_signals') {
      weightedCrossings += 1.0;
    } else if (crossingType === 'marked' || crossingType === 'zebra') {
      weightedCrossings += 0.7;
    } else if (crossingType === 'island') {
      weightedCrossings += 0.6;
    } else if (crossingType === 'uncontrolled') {
      weightedCrossings += 0.3;
    } else if (crossingType === 'unmarked') {
      weightedCrossings += 0.1;
    } else {
      weightedCrossings += 0.5; // Unknown type
    }
  });

  const estimatedRoadKm = (data.streets.length * 100) / 1000;
  const weightedPerKm = weightedCrossings / estimatedRoadKm;

  // Max gap penalty
  let maxGap = 0;
  data.crossings.forEach(c => {
    if (c.lat && c.lon) {
      const distance = calculateDistance(centerLat, centerLon, c.lat, c.lon);
      maxGap = Math.max(maxGap, distance);
    }
  });

  const densityScore = Math.min(10, (weightedPerKm / 8) * 10);
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
 * Metric 3: Speed Exposure
 * How dangerous traffic speeds are for pedestrians
 * Higher score = safer (lower speeds, fewer lanes)
 * Source: OSM maxspeed + lanes tags
 */
function calculateSpeedExposure(data: OSMData): number {
  if (data.streets.length === 0) return 5; // No data, neutral

  let totalDanger = 0;
  let streetCount = 0;

  data.streets.forEach(street => {
    const speed = street.tags?.maxspeed ? parseInt(street.tags.maxspeed, 10) : null;
    const lanes = street.tags?.lanes ? parseInt(street.tags.lanes, 10) : null;
    const highway = street.tags?.highway;

    // Infer speed from road classification if maxspeed not tagged
    let effectiveSpeed = speed;
    if (!effectiveSpeed || isNaN(effectiveSpeed)) {
      if (highway === 'primary') effectiveSpeed = 45;
      else if (highway === 'secondary') effectiveSpeed = 35;
      else if (highway === 'tertiary') effectiveSpeed = 30;
      else if (highway === 'residential') effectiveSpeed = 25;
      else if (highway === 'living_street') effectiveSpeed = 15;
      else effectiveSpeed = 30;
    }

    // Lane multiplier: more lanes = more dangerous
    const effectiveLanes = (lanes && !isNaN(lanes)) ? lanes : (highway === 'primary' ? 4 : highway === 'secondary' ? 2 : 2);
    const laneMultiplier = Math.min(2, effectiveLanes / 2);

    // Danger: (speed/20)^2 * laneMultiplier
    const speedDanger = Math.pow(effectiveSpeed / 20, 2) * laneMultiplier;
    totalDanger += speedDanger;
    streetCount++;
  });

  if (streetCount === 0) return 5;

  const avgDanger = totalDanger / streetCount;

  // Map to 0-10 (inverted: low danger = high score)
  // avgDanger ~1.0 (20mph, 2 lanes) → 10
  // avgDanger ~5.0 (45mph, 4 lanes) → 2
  // avgDanger ~8.0 (50mph, 6 lanes) → 0
  const score = Math.max(0, Math.min(10, 10 - (avgDanger - 1) * (10 / 7)));
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

/**
 * Metric 5: Night Safety
 * Street lighting coverage
 * Source: OSM lit=yes/no tags on ways
 */
function calculateNightSafety(data: OSMData): number {
  if (data.streets.length === 0) return 5;

  const litStreets = data.streets.filter(s => s.tags?.lit === 'yes');
  const unlitStreets = data.streets.filter(s => s.tags?.lit === 'no');
  const taggedStreets = litStreets.length + unlitStreets.length;

  // If very few streets have lit tag, use highway type as proxy
  if (taggedStreets < data.streets.length * 0.1) {
    let inferredLit = 0;
    data.streets.forEach(s => {
      const hw = s.tags?.highway;
      if (hw === 'primary' || hw === 'secondary') inferredLit += 0.8;
      else if (hw === 'tertiary') inferredLit += 0.5;
      else if (hw === 'residential') inferredLit += 0.3;
      else if (hw === 'living_street') inferredLit += 0.5;
    });
    const coverage = inferredLit / data.streets.length;
    // Cap at 6 when using inferred data
    return Math.round(Math.min(6, coverage * 10) * 10) / 10;
  }

  const litCoverage = litStreets.length / taggedStreets;
  const score = Math.min(10, litCoverage * 10);
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

export function calculateMetrics(
  data: OSMData,
  centerLat: number,
  centerLon: number,
  slopeScore?: number,
  treeCanopyScore?: number,
  surfaceTempScore?: number,
  _airQualityScore?: number, // kept for API compat, no longer scored
  heatIslandScore?: number
): WalkabilityMetrics {
  // 5 OSM safety metrics (always available)
  const crossingSafety = calculateCrossingSafety(data, centerLat, centerLon);
  const sidewalkCoverage = calculateSidewalkCoverage(data);
  const speedExposure = calculateSpeedExposure(data);
  const destinationAccess = calculateDestinationAccess(data);
  const nightSafety = calculateNightSafety(data);

  // 3 satellite/comfort metrics (loaded progressively)
  const slope = slopeScore ?? 0;
  const treeCanopy = treeCanopyScore ?? 0;

  // Consolidated thermal comfort: average of surfaceTemp and heatIsland
  let thermalComfort = 0;
  if (surfaceTempScore !== undefined && heatIslandScore !== undefined) {
    thermalComfort = (surfaceTempScore + heatIslandScore) / 2;
  } else if (surfaceTempScore !== undefined) {
    thermalComfort = surfaceTempScore;
  } else if (heatIslandScore !== undefined) {
    thermalComfort = heatIslandScore;
  }

  // Weights: Safety 55%, Access 10%, Comfort 35%
  //   crossingSafety: 15%, sidewalkCoverage: 15%, speedExposure: 15%
  //   nightSafety: 10%, destinationAccess: 10%
  //   slope: 10%, treeCanopy: 10%, thermalComfort: 15%
  let overallScore: number;

  const safetyScore = crossingSafety * 0.15 + sidewalkCoverage * 0.15 +
                      speedExposure * 0.15 + nightSafety * 0.10 +
                      destinationAccess * 0.10;

  const satelliteMetrics = [slopeScore, treeCanopyScore, surfaceTempScore, heatIslandScore];
  const availableSatellite = satelliteMetrics.filter(s => s !== undefined);

  if (availableSatellite.length >= 2) {
    overallScore = Math.round(
      (safetyScore + slope * 0.10 + treeCanopy * 0.10 + thermalComfort * 0.15) * 10
    ) / 10;
  } else {
    // OSM only: average the 5 OSM metrics
    overallScore = Math.round(
      ((crossingSafety + sidewalkCoverage + speedExposure + nightSafety + destinationAccess) / 5) * 10
    ) / 10;
  }

  return {
    crossingSafety,
    sidewalkCoverage,
    speedExposure,
    destinationAccess,
    nightSafety,
    slope,
    treeCanopy,
    thermalComfort,
    overallScore,
    label: getScoreLabel(overallScore),
  };
}

export { assessDataQuality };
