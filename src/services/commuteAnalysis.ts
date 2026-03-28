/**
 * Commute Analysis Service
 * Analyzes the walking + transit commute between a home and work address.
 * Focuses on walking leg quality (sidewalks, speed limits, crossings, lighting)
 * and provides mode comparisons with annual savings estimates.
 */

import { executeOverpassQuery } from './overpassClient';
import type {
  CommuteJourneyLeg,
  CommuteWalkLegQuality,
  CommuteComparisonMode,
  CommuteAnalysisResult,
  RouteSegmentSafety,
} from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

const WALKING_SPEED_MPH = 3.1;
const TRANSIT_AVG_SPEED_MPH = 15;
const DRIVING_CITY_SPEED_MPH = 25;
const CYCLING_SPEED_MPH = 12;
const RUSH_HOUR_MULTIPLIER = 1.5;
const ROUTE_FACTOR = 1.4; // straight-line to actual route distance multiplier
const DRIVING_ROUTE_FACTOR = 1.3;

const TRANSIT_STOP_SEARCH_RADIUS_M = 800;
const WALK_QUALITY_RADIUS_M = 200;

const METERS_PER_MILE = 1609.34;

// Annual cost estimates (USD)
const ANNUAL_CAR_COST = 10700; // insurance + gas + maintenance + parking + depreciation
const ANNUAL_TRANSIT_PASS = 1200;

// ── Interfaces (internal) ────────────────────────────────────────────────────

interface TransitStop {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: 'bus' | 'rail';
  distanceM: number;
}

interface WalkLegStreetData {
  hasSidewalk: boolean;
  maxSpeed: number | null;
  isLit: boolean;
}

// ── Haversine Distance ───────────────────────────────────────────────────────

function haversineDistanceM(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

function milesToMinutes(miles: number, speedMph: number): number {
  return (miles / speedMph) * 60;
}

// ── Transit Stop Discovery ───────────────────────────────────────────────────

async function findNearestTransitStops(
  lat: number,
  lon: number
): Promise<TransitStop[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["highway"="bus_stop"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
      node["public_transport"="stop_position"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
      node["public_transport"="platform"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
      node["railway"="station"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
      node["railway"="halt"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
      node["station"="subway"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
      node["railway"="tram_stop"](around:${TRANSIT_STOP_SEARCH_RADIUS_M},${lat},${lon});
    );
    out center;
  `.trim();

  const data = await executeOverpassQuery(query, { maxRetries: 2, timeout: 20000 });

  const stops: TransitStop[] = [];
  const seen = new Set<string>();

  for (const el of data.elements) {
    const node = el as {
      id: number;
      lat: number;
      lon: number;
      tags?: Record<string, string>;
    };
    if (!node.lat || !node.lon) continue;

    const coordKey = `${node.lat.toFixed(5)},${node.lon.toFixed(5)}`;
    if (seen.has(coordKey)) continue;
    seen.add(coordKey);

    const tags = node.tags ?? {};
    const isRail =
      tags['railway'] === 'station' ||
      tags['railway'] === 'halt' ||
      tags['station'] === 'subway' ||
      tags['railway'] === 'tram_stop';

    const name =
      tags['name'] ??
      tags['description'] ??
      (isRail ? 'Rail Station' : 'Bus Stop');

    stops.push({
      id: node.id,
      lat: node.lat,
      lon: node.lon,
      name,
      type: isRail ? 'rail' : 'bus',
      distanceM: haversineDistanceM(lat, lon, node.lat, node.lon),
    });
  }

  stops.sort((a, b) => a.distanceM - b.distanceM);
  return stops;
}

// ── Walk Leg Quality Analysis ────────────────────────────────────────────────

async function analyzeWalkLegQuality(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  legLabel: string
): Promise<CommuteWalkLegQuality> {
  const midLat = (fromLat + toLat) / 2;
  const midLon = (fromLon + toLon) / 2;

  const query = `
    [out:json][timeout:20];
    (
      way["highway"~"^(residential|tertiary|secondary|primary|trunk|footway|path|pedestrian|living_street|service|unclassified)$"](around:${WALK_QUALITY_RADIUS_M},${midLat},${midLon});
      node["highway"="crossing"](around:${WALK_QUALITY_RADIUS_M},${midLat},${midLon});
    );
    out tags;
  `.trim();

  let streets: WalkLegStreetData[] = [];
  let crossingCount = 0;

  try {
    const data = await executeOverpassQuery(query, { maxRetries: 2, timeout: 15000 });

    for (const el of data.elements) {
      const element = el as {
        type: string;
        tags?: Record<string, string>;
      };

      if (element.type === 'node') {
        const tags = element.tags ?? {};
        if (tags['highway'] === 'crossing') {
          crossingCount++;
        }
        continue;
      }

      if (element.type === 'way') {
        const tags = element.tags ?? {};
        const sidewalkTag = tags['sidewalk'] ?? '';
        const hasSidewalk =
          sidewalkTag === 'both' ||
          sidewalkTag === 'left' ||
          sidewalkTag === 'right' ||
          tags['highway'] === 'footway' ||
          tags['highway'] === 'pedestrian' ||
          tags['highway'] === 'living_street';

        const maxSpeedRaw = tags['maxspeed'];
        const maxSpeed = maxSpeedRaw ? parseInt(maxSpeedRaw, 10) : null;

        const isLit = tags['lit'] === 'yes';

        streets.push({ hasSidewalk, maxSpeed, isLit });
      }
    }
  } catch {
    // If Overpass fails, return conservative defaults
    streets = [];
    crossingCount = 0;
  }

  const totalStreets = streets.length;

  const sidewalkCoverage =
    totalStreets > 0
      ? Math.round(
          (streets.filter((s) => s.hasSidewalk).length / totalStreets) * 100
        )
      : 50; // default assumption

  const speedValues = streets
    .map((s) => s.maxSpeed)
    .filter((v): v is number => v !== null);
  const maxSpeedMph = speedValues.length > 0 ? Math.max(...speedValues) : 25;

  const lightingPct =
    totalStreets > 0
      ? Math.round(
          (streets.filter((s) => s.isLit).length / totalStreets) * 100
        )
      : 50;

  const crossingLabel =
    crossingCount === 0
      ? 'None detected'
      : `${crossingCount} marked crossing${crossingCount > 1 ? 's' : ''}`;

  const lightingLabel =
    lightingPct >= 75
      ? 'Well lit'
      : lightingPct >= 40
        ? 'Partially lit'
        : 'Poorly lit';

  const safety = determineWalkSafety(sidewalkCoverage, maxSpeedMph, lightingPct);

  return {
    legLabel,
    sidewalkCoverage,
    maxSpeedMph,
    crossings: crossingLabel,
    lighting: lightingLabel,
    safety,
  };
}

function determineWalkSafety(
  sidewalkCoverage: number,
  maxSpeedMph: number,
  lightingPct: number
): RouteSegmentSafety {
  let issues = 0;

  if (sidewalkCoverage < 50) issues += 2;
  else if (sidewalkCoverage < 75) issues += 1;

  if (maxSpeedMph > 40) issues += 2;
  else if (maxSpeedMph > 30) issues += 1;

  if (lightingPct < 30) issues += 1;

  if (issues >= 3) return 'danger';
  if (issues >= 1) return 'caution';
  return 'safe';
}

// ── Commute Mode Selection ───────────────────────────────────────────────────

function selectTransitMode(
  homeStops: TransitStop[],
  workStops: TransitStop[]
): 'rail' | 'bus' {
  const homeHasRail = homeStops.some((s) => s.type === 'rail');
  const workHasRail = workStops.some((s) => s.type === 'rail');
  return homeHasRail && workHasRail ? 'rail' : 'bus';
}

function pickBestStop(stops: TransitStop[], preferredType: 'rail' | 'bus'): TransitStop | null {
  const preferred = stops.filter((s) => s.type === preferredType);
  if (preferred.length > 0) return preferred[0];
  return stops.length > 0 ? stops[0] : null;
}

// ── Journey Builder ──────────────────────────────────────────────────────────

function buildJourneyLegs(
  homeLat: number,
  homeLon: number,
  workLat: number,
  workLon: number,
  homeStop: TransitStop,
  workStop: TransitStop,
  transitMode: 'rail' | 'bus'
): CommuteJourneyLeg[] {
  const legs: CommuteJourneyLeg[] = [];

  // Walk leg 1: home → transit stop
  const walk1DistM = homeStop.distanceM;
  const walk1Mi = metersToMiles(walk1DistM);
  const walk1Min = Math.round(milesToMinutes(walk1Mi, WALKING_SPEED_MPH));

  legs.push({
    mode: 'walk',
    label: 'Walk',
    durationMinutes: Math.max(walk1Min, 1),
    detail: `To ${homeStop.name} \u00b7 ${walk1Mi.toFixed(1)} mi`,
    icon: '\ud83d\udeb6',
  });

  // Transit leg
  const transitDistM =
    haversineDistanceM(homeStop.lat, homeStop.lon, workStop.lat, workStop.lon) *
    ROUTE_FACTOR;
  const transitMi = metersToMiles(transitDistM);
  const transitMin = Math.round(milesToMinutes(transitMi, TRANSIT_AVG_SPEED_MPH));

  if (transitMode === 'rail') {
    legs.push({
      mode: 'train',
      label: homeStop.name.includes('Line')
        ? homeStop.name
        : `${homeStop.name} Line`,
      durationMinutes: Math.max(transitMin, 2),
      detail: `${transitMi.toFixed(1)} mi \u00b7 ${Math.max(Math.round(transitMi / TRANSIT_AVG_SPEED_MPH * 2), 1)} stops est.`,
      icon: '\ud83d\ude89',
    });
  } else {
    legs.push({
      mode: 'bus',
      label: `Bus via ${homeStop.name}`,
      durationMinutes: Math.max(transitMin, 3),
      detail: `${transitMi.toFixed(1)} mi \u00b7 ${Math.max(Math.round(transitMi / 0.5), 2)} stops est.`,
      icon: '\ud83d\ude8c',
    });
  }

  // Transfer if mode types differ between home and work stops
  if (homeStop.type !== workStop.type) {
    legs.push({
      mode: 'transfer',
      label: 'Transfer',
      durationMinutes: 5,
      detail: `At ${workStop.name}`,
      icon: '\ud83d\udd04',
    });
  }

  // Walk leg 2: transit stop → work
  const walk2DistM = workStop.distanceM;
  const walk2Mi = metersToMiles(walk2DistM);
  const walk2Min = Math.round(milesToMinutes(walk2Mi, WALKING_SPEED_MPH));

  legs.push({
    mode: 'walk',
    label: 'Walk',
    durationMinutes: Math.max(walk2Min, 1),
    detail: `To destination \u00b7 ${walk2Mi.toFixed(1)} mi`,
    icon: '\ud83d\udeb6',
  });

  return legs;
}

// ── Mode Comparison ──────────────────────────────────────────────────────────

function buildModeComparison(
  straightLineDistM: number,
  transitTotalMin: number
): CommuteComparisonMode[] {
  const straightLineMi = metersToMiles(straightLineDistM);
  const drivingMi = straightLineMi * DRIVING_ROUTE_FACTOR;

  const drivingNoTrafficMin = Math.round(
    milesToMinutes(drivingMi, DRIVING_CITY_SPEED_MPH)
  );
  const drivingRushMin = Math.round(drivingNoTrafficMin * RUSH_HOUR_MULTIPLIER);
  const cyclingMin = Math.round(
    milesToMinutes(drivingMi, CYCLING_SPEED_MPH)
  );

  return [
    {
      mode: 'Transit',
      icon: '\ud83d\ude8d',
      durationMinutes: transitTotalMin,
      isThisRoute: true,
    },
    {
      mode: 'Driving (no traffic)',
      icon: '\ud83d\ude97',
      durationMinutes: drivingNoTrafficMin,
    },
    {
      mode: 'Driving (rush hour)',
      icon: '\ud83d\ude99',
      durationMinutes: drivingRushMin,
    },
    {
      mode: 'Cycling',
      icon: '\ud83d\udeb4',
      durationMinutes: cyclingMin,
    },
  ];
}

// ── Assessment Text ──────────────────────────────────────────────────────────

function generateAssessment(
  transitMin: number,
  drivingRushMin: number,
  walkLegs: CommuteWalkLegQuality[],
  annualSavings: number
): string {
  const timeDiff = transitMin - drivingRushMin;
  const timeComparison =
    timeDiff <= 5
      ? 'comparable to rush-hour driving'
      : timeDiff <= 15
        ? `about ${timeDiff} minutes longer than rush-hour driving`
        : `${timeDiff} minutes longer than rush-hour driving, but avoids the stress of traffic`;

  const worstSafety = walkLegs.reduce<RouteSegmentSafety>(
    (worst, leg) => {
      const rank: Record<RouteSegmentSafety, number> = {
        safe: 0,
        caution: 1,
        danger: 2,
      };
      return rank[leg.safety] > rank[worst] ? leg.safety : worst;
    },
    'safe'
  );

  const safetyNote =
    worstSafety === 'safe'
      ? 'Walking segments have good sidewalk coverage and lighting.'
      : worstSafety === 'caution'
        ? 'Some walking segments have limited sidewalks or higher traffic speeds\u2014use caution.'
        : 'Walking segments include high-speed roads with poor pedestrian infrastructure\u2014consider alternative routes.';

  return `This transit commute is ${timeComparison}. ${safetyNote} Switching from driving could save approximately $${annualSavings.toLocaleString()} per year.`;
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

export async function analyzeCommute(
  homeLat: number,
  homeLon: number,
  homeName: string,
  workLat: number,
  workLon: number,
  workName: string
): Promise<CommuteAnalysisResult> {
  // Step 1: Find transit stops near home and work in parallel
  const [homeStops, workStops] = await Promise.all([
    findNearestTransitStops(homeLat, homeLon),
    findNearestTransitStops(workLat, workLon),
  ]);

  // Step 2: Select transit mode and best stops
  const transitMode = selectTransitMode(homeStops, workStops);
  const homeStop = pickBestStop(homeStops, transitMode);
  const workStop = pickBestStop(workStops, transitMode);

  // Fallback if no transit stops found
  const effectiveHomeStop: TransitStop = homeStop ?? {
    id: 0,
    lat: homeLat + 0.003,
    lon: homeLon + 0.003,
    name: 'Nearest Stop',
    type: 'bus',
    distanceM: 350,
  };

  const effectiveWorkStop: TransitStop = workStop ?? {
    id: 0,
    lat: workLat + 0.003,
    lon: workLon + 0.003,
    name: 'Nearest Stop',
    type: 'bus',
    distanceM: 350,
  };

  // Step 3: Build journey legs
  const journeyLegs = buildJourneyLegs(
    homeLat, homeLon, workLat, workLon,
    effectiveHomeStop, effectiveWorkStop, transitMode
  );

  const totalMinutes = journeyLegs.reduce(
    (sum, leg) => sum + leg.durationMinutes,
    0
  );

  // Step 4: Analyze walk leg quality in parallel
  const [walkLeg1Quality, walkLeg2Quality] = await Promise.all([
    analyzeWalkLegQuality(
      homeLat, homeLon,
      effectiveHomeStop.lat, effectiveHomeStop.lon,
      `Home to ${effectiveHomeStop.name}`
    ),
    analyzeWalkLegQuality(
      effectiveWorkStop.lat, effectiveWorkStop.lon,
      workLat, workLon,
      `${effectiveWorkStop.name} to Work`
    ),
  ]);

  const walkLegs = [walkLeg1Quality, walkLeg2Quality];

  // Step 5: Mode comparison
  const straightLineDistM = haversineDistanceM(homeLat, homeLon, workLat, workLon);
  const comparison = buildModeComparison(straightLineDistM, totalMinutes);

  // Step 6: Annual savings
  const annualSavings = ANNUAL_CAR_COST - ANNUAL_TRANSIT_PASS;

  // Step 7: Assessment
  const drivingRushMin =
    comparison.find((c) => c.mode === 'Driving (rush hour)')?.durationMinutes ?? totalMinutes;
  const assessment = generateAssessment(
    totalMinutes, drivingRushMin, walkLegs, annualSavings
  );

  return {
    homeName,
    workName,
    journeyLegs,
    totalMinutes,
    walkLegs,
    comparison,
    annualSavingsVsDriving: annualSavings,
    assessment,
  };
}
