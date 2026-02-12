/**
 * Network Design metrics — 4 pure functions scoring 0-100
 * Derived from OSM way topology (NetworkGraph).
 */
import type { NetworkGraph } from '../types';

/** Clamp a value between 0 and 100 */
function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Intersection Density: intersections per km²
 * ≥ 150/km² = 100, 0 = 0, linear scale
 */
export function scoreIntersectionDensity(graph: NetworkGraph): { score: number; raw: number } {
  const density = graph.areaKm2 > 0
    ? graph.intersections.length / graph.areaKm2
    : 0;
  return {
    score: clamp100((density / 150) * 100),
    raw: Math.round(density * 10) / 10,
  };
}

/**
 * Average Block Length: totalStreetLength / intersections
 * ≤ 100m = 100, ≥ 280m = 0, linear interpolation
 */
export function scoreBlockLength(graph: NetworkGraph): { score: number; raw: number } {
  const blockLen = graph.averageBlockLengthM;
  let score: number;
  if (blockLen <= 100) {
    score = 100;
  } else if (blockLen >= 280) {
    score = 0;
  } else {
    score = ((280 - blockLen) / (280 - 100)) * 100;
  }
  return {
    score: clamp100(score),
    raw: Math.round(blockLen),
  };
}

/**
 * Network Density: street km per km²
 * ≥ 20 km/km² = 100, 0 = 0, linear scale
 */
export function scoreNetworkDensity(graph: NetworkGraph): { score: number; raw: number } {
  const density = graph.areaKm2 > 0
    ? graph.totalStreetLengthKm / graph.areaKm2
    : 0;
  return {
    score: clamp100((density / 20) * 100),
    raw: Math.round(density * 10) / 10,
  };
}

/**
 * Dead-End Ratio: deadEnds / (deadEnds + intersections)
 * 0% = 100, ≥ 30% = 0, linear interpolation
 */
export function scoreDeadEndRatio(graph: NetworkGraph): { score: number; raw: number } {
  const total = graph.deadEnds.length + graph.intersections.length;
  if (total === 0) return { score: 50, raw: 0 }; // No data

  const ratio = graph.deadEnds.length / total;
  let score: number;
  if (ratio <= 0) {
    score = 100;
  } else if (ratio >= 0.3) {
    score = 0;
  } else {
    score = ((0.3 - ratio) / 0.3) * 100;
  }
  return {
    score: clamp100(score),
    raw: Math.round(ratio * 1000) / 10, // percentage with 1 decimal
  };
}
