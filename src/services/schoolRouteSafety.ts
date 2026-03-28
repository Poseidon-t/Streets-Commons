/**
 * School Route Safety Analysis
 * Analyzes walking route safety from home to school using OpenStreetMap data.
 * Uses Overpass API for road network, crossings, sidewalks, and speed data.
 * No Google APIs — OSM only.
 */

import { executeOverpassQuery } from './overpassClient';
import type {
  RouteSegment,
  CrossingAlert,
  SchoolRouteSafetyResult,
  SchoolRouteVerdict,
  RouteSegmentSafety,
} from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

const WALKING_SPEED_MPH = 3.1;
const WALKING_SPEED_M_PER_MIN = (WALKING_SPEED_MPH * 1609.34) / 60;
const CORRIDOR_WIDTH_M = 200;
const METERS_PER_MILE = 1609.34;

/** Default speed limits (mph) inferred from OSM highway type */
const DEFAULT_SPEED_MPH: Record<string, number> = {
  living_street: 15,
  residential: 25,
  tertiary: 30,
  tertiary_link: 30,
  secondary: 35,
  secondary_link: 35,
  primary: 40,
  primary_link: 40,
  trunk: 45,
  trunk_link: 45,
};

/** Default lane counts inferred from OSM highway type */
const DEFAULT_LANES: Record<string, number> = {
  living_street: 1,
  residential: 2,
  tertiary: 2,
  tertiary_link: 1,
  secondary: 2,
  secondary_link: 1,
  primary: 4,
  primary_link: 1,
  trunk: 4,
  trunk_link: 2,
};

/** Maps OSM highway type to a readable street classification */
const STREET_TYPE_LABEL: Record<string, string> = {
  living_street: 'living street',
  residential: 'residential',
  tertiary: 'collector',
  tertiary_link: 'collector',
  secondary: 'collector',
  secondary_link: 'collector',
  primary: 'arterial',
  primary_link: 'arterial',
  trunk: 'arterial',
  trunk_link: 'arterial',
  unclassified: 'local road',
  service: 'service road',
  footway: 'footpath',
  path: 'path',
  pedestrian: 'pedestrian',
  cycleway: 'cycleway',
};

// ── Internal OSM element interfaces ──────────────────────────────────────────

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassWayGeometry {
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassWayGeometry[];
  nodes?: number[];
}

type OverpassElement = OverpassNode | OverpassWay;

interface WaySegment {
  wayId: number;
  streetName: string;
  highwayType: string;
  speedMph: number;
  lanes: number;
  sidewalk: string;
  geometry: OverpassWayGeometry[];
  distanceFromHome: number;
  lengthM: number;
}

interface CrossingNode {
  lat: number;
  lon: number;
  hasSignal: boolean;
  hasMarkings: boolean;
  hasMedianRefuge: boolean;
  nearestStreet: string;
}

// ── Haversine distance (meters) ──────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse OSM maxspeed tag to mph. Handles "30 mph", "50", "40 km/h" */
function parseMaxspeedMph(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  const numMatch = cleaned.match(/^(\d+)/);
  if (!numMatch) return null;
  const value = parseInt(numMatch[1], 10);
  if (cleaned.includes('km/h') || cleaned.includes('kph')) {
    return Math.round(value * 0.621371);
  }
  // Default: assume mph for US, or raw number for countries using km/h
  // OSM convention: bare number = km/h in most of the world, but mph in US/UK
  // We treat bare numbers as mph since SafeStreets is US-focused
  return value;
}

/** Determine sidewalk coverage string from OSM tags */
function parseSidewalk(tags: Record<string, string> | undefined): string {
  if (!tags) return 'unknown';
  const sw = tags['sidewalk'] ?? tags['sidewalk:both'] ?? '';
  if (sw === 'both') return 'both sides';
  if (sw === 'left' || sw === 'right') return 'one side';
  if (sw === 'no' || sw === 'none') return 'none';
  // Fallback: check for separate sidewalk tags
  const left = tags['sidewalk:left'];
  const right = tags['sidewalk:right'];
  if (left && right && left !== 'no' && right !== 'no') return 'both sides';
  if ((left && left !== 'no') || (right && right !== 'no')) return 'one side';
  return 'unknown';
}

/** Calculate the midpoint of a geometry array */
function geometryMidpoint(geom: OverpassWayGeometry[]): { lat: number; lon: number } {
  const mid = Math.floor(geom.length / 2);
  return { lat: geom[mid].lat, lon: geom[mid].lon };
}

/** Calculate total length of a geometry in meters */
function geometryLengthM(geom: OverpassWayGeometry[]): number {
  let total = 0;
  for (let i = 0; i < geom.length - 1; i++) {
    total += haversineM(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
  }
  return total;
}

/** Minimum distance from a point to a polyline (meters) */
function distanceToPolyline(
  lat: number,
  lon: number,
  geom: OverpassWayGeometry[]
): number {
  let minDist = Infinity;
  for (const pt of geom) {
    const d = haversineM(lat, lon, pt.lat, pt.lon);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** Distance from a point to the straight line between home and school */
function distanceToLine(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  // Project point onto the line segment and compute perpendicular distance
  const dx = bLon - aLon;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineM(pLat, pLon, aLat, aLon);

  let t = ((pLon - aLon) * dx + (pLat - aLat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * dy;
  const projLon = aLon + t * dx;
  return haversineM(pLat, pLon, projLat, projLon);
}

/** Build a bounding box with padding around two points */
function boundingBox(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  paddingM: number
): { south: number; west: number; north: number; east: number } {
  const paddingDeg = paddingM / 111320; // approximate degrees per meter
  const south = Math.min(lat1, lat2) - paddingDeg;
  const north = Math.max(lat1, lat2) + paddingDeg;
  const west = Math.min(lon1, lon2) - paddingDeg;
  const east = Math.max(lon1, lon2) + paddingDeg;
  return { south, west, north, east };
}

// ── Safety classification ────────────────────────────────────────────────────

function classifySegmentSafety(
  highwayType: string,
  speedMph: number,
  lanes: number,
  sidewalk: string
): RouteSegmentSafety {
  const isLowSpeed = speedMph <= 25;
  const isMidSpeed = speedMph >= 30 && speedMph <= 35;
  const isHighSpeed = speedMph >= 40;
  const hasSidewalks = sidewalk === 'both sides';
  const hasPartialSidewalk = sidewalk === 'one side';
  const noSidewalk = sidewalk === 'none';

  const safeTypes = new Set(['residential', 'living_street', 'footway', 'pedestrian', 'path', 'cycleway', 'service']);
  const arterialTypes = new Set(['primary', 'primary_link', 'trunk', 'trunk_link']);

  // Danger conditions
  if (arterialTypes.has(highwayType)) return 'danger';
  if (isHighSpeed) return 'danger';
  if (noSidewalk && !safeTypes.has(highwayType)) return 'danger';
  if (lanes >= 4) return 'danger';

  // Safe conditions
  if (safeTypes.has(highwayType) && isLowSpeed && (hasSidewalks || sidewalk === 'unknown')) return 'safe';

  // Caution conditions
  if (isMidSpeed) return 'caution';
  if (hasPartialSidewalk) return 'caution';
  if (highwayType === 'tertiary' || highwayType === 'tertiary_link') return 'caution';
  if (highwayType === 'secondary' || highwayType === 'secondary_link') return 'caution';

  return 'safe';
}

function buildSegmentBadges(
  safety: RouteSegmentSafety,
  speedMph: number,
  lanes: number,
  sidewalk: string,
  highwayType: string
): { label: string; type: RouteSegmentSafety | 'info' }[] {
  const badges: { label: string; type: RouteSegmentSafety | 'info' }[] = [];

  if (speedMph >= 40) badges.push({ label: `${speedMph} mph`, type: 'danger' });
  else if (speedMph >= 30) badges.push({ label: `${speedMph} mph`, type: 'caution' });
  else badges.push({ label: `${speedMph} mph`, type: 'info' });

  if (sidewalk === 'none') badges.push({ label: 'No sidewalk', type: 'danger' });
  else if (sidewalk === 'one side') badges.push({ label: 'Sidewalk one side', type: 'caution' });
  else if (sidewalk === 'both sides') badges.push({ label: 'Sidewalks both sides', type: 'safe' });

  if (lanes >= 4) badges.push({ label: `${lanes} lanes`, type: 'danger' });
  else if (lanes > 0) badges.push({ label: `${lanes} lanes`, type: 'info' });

  const label = STREET_TYPE_LABEL[highwayType] ?? highwayType;
  badges.push({ label, type: safety === 'danger' ? 'danger' : 'info' });

  return badges;
}

// ── Overpass queries ─────────────────────────────────────────────────────────

function buildStreetNetworkQuery(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:30];
(
  way["highway"~"^(residential|living_street|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link|trunk|trunk_link|unclassified|service|footway|path|pedestrian|cycleway)$"](${south},${west},${north},${east});
);
out geom;
  `.trim();
}

function buildCrossingsQuery(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:20];
(
  node["highway"="crossing"](${south},${west},${north},${east});
  node["crossing"](${south},${west},${north},${east});
);
out body;
  `.trim();
}

// ── Main function ────────────────────────────────────────────────────────────

export async function analyzeSchoolRoute(
  homeLat: number,
  homeLon: number,
  schoolLat: number,
  schoolLon: number,
  schoolName: string
): Promise<SchoolRouteSafetyResult> {
  // 1. Build bounding box around the corridor between home and school
  const straightLineM = haversineM(homeLat, homeLon, schoolLat, schoolLon);
  const padding = Math.max(CORRIDOR_WIDTH_M, straightLineM * 0.15);
  const bbox = boundingBox(homeLat, homeLon, schoolLat, schoolLon, padding);

  // 2. Fetch streets and crossings in parallel
  const [streetData, crossingData] = await Promise.all([
    executeOverpassQuery(buildStreetNetworkQuery(bbox), { maxRetries: 3, timeout: 30000 }),
    executeOverpassQuery(buildCrossingsQuery(bbox), { maxRetries: 2, timeout: 20000 }),
  ]);

  // 3. Parse ways and filter to corridor
  const ways = (streetData.elements as OverpassElement[]).filter(
    (el): el is OverpassWay => el.type === 'way' && !!el.geometry && el.geometry.length > 0
  );

  const corridorWays = ways.filter((way) => {
    const mid = geometryMidpoint(way.geometry!);
    return distanceToLine(mid.lat, mid.lon, homeLat, homeLon, schoolLat, schoolLon) <= CORRIDOR_WIDTH_M;
  });

  // If corridor is too narrow and no ways found, widen to all ways in bbox
  const routeWays = corridorWays.length >= 2 ? corridorWays : ways;

  // 4. Build way segments with safety attributes
  const waySegments: WaySegment[] = routeWays.map((way) => {
    const tags = way.tags ?? {};
    const highwayType = tags['highway'] ?? 'unclassified';
    const speedMph = parseMaxspeedMph(tags['maxspeed']) ?? DEFAULT_SPEED_MPH[highwayType] ?? 25;
    const lanes = tags['lanes'] ? parseInt(tags['lanes'], 10) : (DEFAULT_LANES[highwayType] ?? 2);
    const sidewalk = parseSidewalk(tags);
    const geom = way.geometry!;
    const lengthM = geometryLengthM(geom);
    const startPt = geom[0];
    const distFromHome = haversineM(homeLat, homeLon, startPt.lat, startPt.lon);

    return {
      wayId: way.id,
      streetName: tags['name'] ?? 'Unnamed road',
      highwayType,
      speedMph,
      lanes,
      sidewalk,
      geometry: geom,
      distanceFromHome: distFromHome,
      lengthM,
    };
  });

  // 5. Sort segments by distance from home
  waySegments.sort((a, b) => a.distanceFromHome - b.distanceFromHome);

  // 6. Deduplicate by street name to merge consecutive segments of same road
  const mergedSegments = mergeConsecutiveSegments(waySegments);

  // 7. Parse crossings
  const crossingNodes = (crossingData.elements as OverpassElement[])
    .filter((el): el is OverpassNode => el.type === 'node')
    .map((node): CrossingNode => {
      const tags = node.tags ?? {};
      return {
        lat: node.lat,
        lon: node.lon,
        hasSignal:
          tags['crossing'] === 'traffic_signals' ||
          tags['crossing:signals'] === 'yes' ||
          tags['traffic_signals'] === 'signal',
        hasMarkings:
          tags['crossing'] === 'marked' ||
          tags['crossing'] === 'zebra' ||
          tags['crossing:markings'] === 'yes' ||
          tags['crossing'] === 'traffic_signals',
        hasMedianRefuge:
          tags['crossing:island'] === 'yes' ||
          tags['traffic_calming'] === 'island',
        nearestStreet: findNearestStreetName(node.lat, node.lon, waySegments),
      };
    });

  // Filter crossings to those near the route corridor
  const routeCrossings = crossingNodes.filter((c) =>
    distanceToLine(c.lat, c.lon, homeLat, homeLon, schoolLat, schoolLon) <= CORRIDOR_WIDTH_M
  );

  // 8. Build RouteSegment results
  const totalDistanceM = mergedSegments.reduce((sum, s) => sum + s.lengthM, 0);
  const totalDistanceMi = totalDistanceM / METERS_PER_MILE;
  const totalWalkMinutes = Math.round(totalDistanceM / WALKING_SPEED_M_PER_MIN);

  const segments: RouteSegment[] = mergedSegments.map((seg) => {
    const distMi = seg.lengthM / METERS_PER_MILE;
    const walkMin = seg.lengthM / WALKING_SPEED_M_PER_MIN;
    const safety = classifySegmentSafety(seg.highwayType, seg.speedMph, seg.lanes, seg.sidewalk);
    const streetTypeLabel = STREET_TYPE_LABEL[seg.highwayType] ?? seg.highwayType;
    const badges = buildSegmentBadges(safety, seg.speedMph, seg.lanes, seg.sidewalk, seg.highwayType);

    return {
      streetName: seg.streetName,
      streetType: streetTypeLabel,
      description: buildSegmentDescription(seg.streetName, streetTypeLabel, seg.speedMph, seg.sidewalk, safety),
      distanceMi: Math.round(distMi * 100) / 100,
      walkMinutes: Math.round(walkMin * 10) / 10,
      isCrossing: false,
      sidewalkCoverage: seg.sidewalk,
      speedLimit: seg.speedMph,
      lanes: seg.lanes,
      signal: null,
      safety,
      badges,
    };
  });

  // 9. Build CrossingAlert results
  const crossingAlerts: CrossingAlert[] = buildCrossingAlerts(routeCrossings, waySegments);
  const highSpeedCrossings = crossingAlerts.filter((c) => c.speedLimit >= 35).length;

  // 10. Calculate sidewalk coverage percentage
  const sidewalkCoverage = calculateSidewalkCoverage(mergedSegments);

  // 11. Determine verdict
  const { verdict, verdictReason } = determineVerdict(segments, crossingAlerts, highSpeedCrossings, sidewalkCoverage);

  return {
    schoolName,
    schoolLat,
    schoolLon,
    totalDistanceMi: Math.round(totalDistanceMi * 100) / 100,
    totalWalkMinutes,
    totalCrossings: routeCrossings.length,
    highSpeedCrossings,
    sidewalkCoverage: Math.round(sidewalkCoverage),
    segments,
    crossingAlerts,
    verdict,
    verdictReason,
  };
}

// ── Segment merging ──────────────────────────────────────────────────────────

function mergeConsecutiveSegments(segments: WaySegment[]): WaySegment[] {
  if (segments.length === 0) return [];

  const merged: WaySegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.streetName === current.streetName && seg.highwayType === current.highwayType) {
      // Merge: extend geometry and accumulate length
      current.lengthM += seg.lengthM;
      current.geometry = [...current.geometry, ...seg.geometry];
      // Keep the worse sidewalk
      if (seg.sidewalk === 'none') current.sidewalk = 'none';
      else if (seg.sidewalk === 'one side' && current.sidewalk !== 'none') current.sidewalk = 'one side';
      // Keep higher speed and more lanes
      current.speedMph = Math.max(current.speedMph, seg.speedMph);
      current.lanes = Math.max(current.lanes, seg.lanes);
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }
  merged.push(current);

  return merged;
}

// ── Description builders ─────────────────────────────────────────────────────

function buildSegmentDescription(
  streetName: string,
  streetType: string,
  speedMph: number,
  sidewalk: string,
  safety: RouteSegmentSafety
): string {
  const parts: string[] = [];
  parts.push(`${streetName} (${streetType})`);

  if (safety === 'danger') {
    if (speedMph >= 40) parts.push(`High speed ${speedMph} mph road`);
    if (sidewalk === 'none') parts.push('no sidewalks');
  } else if (safety === 'caution') {
    if (sidewalk === 'one side') parts.push('sidewalk on one side only');
    if (speedMph >= 30) parts.push(`${speedMph} mph`);
  } else {
    parts.push('safe walking environment');
  }

  return parts.join(' - ');
}

function findNearestStreetName(lat: number, lon: number, ways: WaySegment[]): string {
  let nearest = 'Unknown street';
  let minDist = Infinity;

  for (const way of ways) {
    const d = distanceToPolyline(lat, lon, way.geometry);
    if (d < minDist) {
      minDist = d;
      nearest = way.streetName;
    }
  }

  return nearest;
}

function buildCrossingAlerts(
  crossings: CrossingNode[],
  ways: WaySegment[]
): CrossingAlert[] {
  return crossings.map((crossing) => {
    // Find the way this crossing is on
    let nearestWay: WaySegment | null = null;
    let minDist = Infinity;

    for (const way of ways) {
      const d = distanceToPolyline(crossing.lat, crossing.lon, way.geometry);
      if (d < minDist) {
        minDist = d;
        nearestWay = way;
      }
    }

    const speedLimit = nearestWay?.speedMph ?? 25;
    const lanes = nearestWay?.lanes ?? 2;
    const streetName = crossing.nearestStreet;

    let signal = 'none';
    if (crossing.hasSignal) signal = 'signal';
    else if (crossing.hasMarkings) signal = 'marked crosswalk';

    const isHighSpeed = speedLimit >= 35;
    const isWide = lanes >= 4;

    let description = `Crossing at ${streetName}`;
    if (isHighSpeed) description += ` (${speedLimit} mph)`;
    if (isWide) description += `, ${lanes} lanes`;
    if (crossing.hasSignal) description += ', signalized';
    else if (crossing.hasMarkings) description += ', marked crosswalk';
    else description += ', no signal or markings';

    return {
      streetName,
      intersection: streetName,
      speedLimit,
      lanes,
      signal,
      hasCrosswalk: crossing.hasMarkings,
      hasMedianRefuge: crossing.hasMedianRefuge,
      description,
    };
  });
}

// ── Sidewalk coverage ────────────────────────────────────────────────────────

function calculateSidewalkCoverage(segments: WaySegment[]): number {
  const totalLength = segments.reduce((sum, s) => sum + s.lengthM, 0);
  if (totalLength === 0) return 0;

  let coveredLength = 0;
  for (const seg of segments) {
    if (seg.sidewalk === 'both sides') {
      coveredLength += seg.lengthM;
    } else if (seg.sidewalk === 'one side') {
      coveredLength += seg.lengthM * 0.5;
    }
    // 'none' and 'unknown' contribute 0
  }

  return (coveredLength / totalLength) * 100;
}

// ── Verdict logic ────────────────────────────────────────────────────────────

function determineVerdict(
  segments: RouteSegment[],
  crossingAlerts: CrossingAlert[],
  highSpeedCrossings: number,
  sidewalkCoverage: number
): { verdict: SchoolRouteVerdict; verdictReason: string } {
  const hasDanger = segments.some((s) => s.safety === 'danger');
  const dangerCount = segments.filter((s) => s.safety === 'danger').length;
  const cautionCount = segments.filter((s) => s.safety === 'caution').length;
  const unsignaledHighSpeed = crossingAlerts.filter(
    (c) => c.speedLimit >= 35 && c.signal === 'none'
  ).length;
  const signaledHighSpeed = crossingAlerts.filter(
    (c) => c.speedLimit >= 35 && c.signal === 'signal'
  ).length;

  // Not Recommended
  if (unsignaledHighSpeed > 0) {
    return {
      verdict: 'Not Recommended',
      verdictReason: `Route includes ${unsignaledHighSpeed} high-speed crossing(s) without signals.`,
    };
  }
  if (sidewalkCoverage < 50) {
    return {
      verdict: 'Not Recommended',
      verdictReason: `Only ${Math.round(sidewalkCoverage)}% sidewalk coverage along the route.`,
    };
  }
  if (hasDanger) {
    return {
      verdict: 'Not Recommended',
      verdictReason: `Route includes ${dangerCount} dangerous segment(s) — high speed, missing sidewalks, or wide roads.`,
    };
  }
  if (highSpeedCrossings >= 2) {
    return {
      verdict: 'Not Recommended',
      verdictReason: `Route requires crossing ${highSpeedCrossings} high-speed roads.`,
    };
  }

  // Walk with Caution
  if (cautionCount > 0) {
    return {
      verdict: 'Walk with Caution',
      verdictReason: `Route includes ${cautionCount} segment(s) requiring extra attention.`,
    };
  }
  if (signaledHighSpeed >= 1) {
    return {
      verdict: 'Walk with Caution',
      verdictReason: `Route crosses ${signaledHighSpeed} high-speed road(s), but signals are present.`,
    };
  }
  if (sidewalkCoverage < 80) {
    return {
      verdict: 'Walk with Caution',
      verdictReason: `Sidewalk coverage is ${Math.round(sidewalkCoverage)}% — some segments lack sidewalks.`,
    };
  }

  // Safe
  return {
    verdict: 'Safe',
    verdictReason: 'Route has good sidewalk coverage, low speeds, and safe crossings.',
  };
}
