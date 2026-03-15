/**
 * Network Design metrics  -  5 pure functions scoring 0-100
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

/**
 * Betweenness Centrality: how evenly distributed connectivity is across the network.
 * Uses Gini coefficient of normalized betweenness centrality values.
 *
 * Low Gini (≤0.3) = uniform connectivity, no chokepoints = excellent walkability grid
 * High Gini (≥0.7) = few nodes carry most traffic = fragile, chokepoint-heavy network
 *
 * Gini ≤ 0.20 → 100 (perfectly distributed grid)
 * Gini ≥ 0.70 → 0 (dominated by chokepoints)
 * Linear interpolation between
 */
export function scoreBetweennessCentrality(graph: NetworkGraph): { score: number; raw: string } | null {
  if (!graph.betweennessCentrality) return null;
  const { gini } = graph.betweennessCentrality;

  let score: number;
  if (gini <= 0.20) {
    score = 100;
  } else if (gini >= 0.70) {
    score = 0;
  } else {
    score = ((0.70 - gini) / (0.70 - 0.20)) * 100;
  }
  return {
    score: clamp100(score),
    raw: `${(gini * 100).toFixed(0)}% Gini`,
  };
}
