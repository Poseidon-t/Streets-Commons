/**
 * 4-Component Walkability Scoring (0-100 + A-F Grade)
 *
 * Only high-accuracy (>90% ground-truth) metrics are scored:
 *
 * Components:
 *   Network Design   35%  — intersection density, block length, network density, dead-end ratio (OSM topology)
 *   Environment      25%  — tree canopy (Sentinel-2 NDVI)
 *   Street Design    15%  — EPA National Walkability Index (intersection density, transit proximity, land use mix)
 *   Accessibility    25%  — commute mode (Census ACS), destination access (OSM POIs)
 *
 * Each sub-metric is 0-100. Components are weighted averages of their sub-metrics.
 * Overall = weighted sum of components → 0-100 + letter grade.
 */

import type {
  WalkabilityMetrics,
  WalkabilityScoreV2,
  ComponentScore,
  SubMetric,
  LetterGrade,
  NetworkGraph,
} from '../types';
import {
  scoreIntersectionDensity,
  scoreBlockLength,
  scoreNetworkDensity,
  scoreDeadEndRatio,
} from './networkMetrics';

// ---------- helpers ----------

function letterGrade(score: number): LetterGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

/** Scale a 0-10 legacy metric to 0-100 */
function scale10to100(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v * 10)));
}

/** Weighted average that redistributes missing-metric weight proportionally */
function weightedAvg(items: { score: number | null; weight: number }[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const { score, weight } of items) {
    if (score !== null && score !== undefined) {
      totalWeight += weight;
      weightedSum += score * weight;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ---------- input interface ----------

export interface CompositeScoreInput {
  legacy: WalkabilityMetrics;
  networkGraph?: NetworkGraph;
  populationDensityScore?: number;   // 0-100 from Census ACS
  streetDesignScore?: number;        // 0-100 from EPA Walkability Index
  transitAccessScore?: number;       // 0-100 from Transitland/OSM (0-10 × 10)
  terrainScore?: number;             // 0-100 from OpenTopoData (0-10 × 10)
  streetLightingScore?: number;      // 0-100 from Mapillary CV (0-10 × 10)
}

// ---------- main function ----------

export function calculateCompositeScore(input: CompositeScoreInput): WalkabilityScoreV2 {
  const { legacy, networkGraph, populationDensityScore, streetDesignScore, transitAccessScore, terrainScore, streetLightingScore } = input;

  // ===== 1. Network Design (35%) =====
  let networkMetrics: SubMetric[];

  if (networkGraph) {
    const intDensity = scoreIntersectionDensity(networkGraph);
    const blockLen = scoreBlockLength(networkGraph);
    const netDensity = scoreNetworkDensity(networkGraph);
    const deadEnd = scoreDeadEndRatio(networkGraph);
    const speedEnv = networkGraph.speedEnvironment;

    networkMetrics = [
      { name: 'Intersection Density', score: intDensity.score, rawValue: `${intDensity.raw}/km²`, weight: 0.25 },
      { name: 'Block Length', score: blockLen.score, rawValue: `${blockLen.raw}m avg`, weight: 0.25 },
      { name: 'Network Density', score: netDensity.score, rawValue: `${netDensity.raw} km/km²`, weight: 0.15 },
      { name: 'Dead-End Ratio', score: deadEnd.score, rawValue: `${deadEnd.raw}%`, weight: 0.15 },
      { name: 'Speed Environment', score: speedEnv ? speedEnv.score * 10 : 0, rawValue: speedEnv ? `${speedEnv.avgSpeedKmh} km/h avg` : undefined, weight: 0.20 },
    ];
  } else {
    networkMetrics = [
      { name: 'Intersection Density', score: 0, weight: 0.25 },
      { name: 'Block Length', score: 0, weight: 0.25 },
      { name: 'Network Density', score: 0, weight: 0.15 },
      { name: 'Dead-End Ratio', score: 0, weight: 0.15 },
      { name: 'Speed Environment', score: 0, weight: 0.20 },
    ];
  }

  const networkScore = weightedAvg(networkMetrics.map(m => ({ score: m.score, weight: m.weight })));

  const networkDesign: ComponentScore = {
    label: 'Network Design',
    score: Math.round(networkScore),
    weight: 0.35,
    metrics: networkMetrics,
  };

  // ===== 2. Environment (25%) — Tree Canopy + Terrain + Street Lighting =====
  const treeScore = scale10to100(legacy.treeCanopy);
  const terrainS = terrainScore ?? 0;
  const lightingS = streetLightingScore ?? 0;

  const envMetrics: SubMetric[] = [
    { name: 'Tree Canopy',     score: treeScore, weight: 0.55 },
    { name: 'Terrain',         score: terrainS,  weight: 0.20 },
    { name: 'Street Lighting', score: lightingS, weight: 0.25 },
  ];

  const envItems = [
    { score: legacy.treeCanopy > 0 ? treeScore : null, weight: 0.55 },
    { score: terrainS > 0 ? terrainS : null,           weight: 0.20 },
    { score: lightingS > 0 ? lightingS : null,          weight: 0.25 },
  ];

  const envScore = weightedAvg(envItems) || (legacy.treeCanopy > 0 ? treeScore : 50);

  const environmentalComfort: ComponentScore = {
    label: 'Environment',
    score: Math.round(envScore),
    weight: 0.25,
    metrics: envMetrics,
  };

  // ===== 3. Street Design (15%) — EPA Walkability Index =====
  const sdScore = streetDesignScore ?? 0;

  const safetyMetrics: SubMetric[] = [
    { name: 'Street Design', score: sdScore, weight: 1.0 },
  ];

  const safety: ComponentScore = {
    label: 'Street Design',
    score: Math.round(sdScore),
    weight: 0.15,
    metrics: safetyMetrics,
  };

  // ===== 4. Accessibility (25%) — Commute Mode + Destinations + Transit =====
  const popScore = populationDensityScore ?? 0;
  const destScore = scale10to100(legacy.destinationAccess);
  const transitS = transitAccessScore ?? 0;

  const densityMetrics: SubMetric[] = [
    { name: 'Commute Mode', score: popScore, weight: 0.37 },
    { name: 'Nearby Destinations', score: destScore, weight: 0.37 },
    { name: 'Transit Access', score: transitS, weight: 0.26 },
  ];

  const densityItems = [
    { score: popScore > 0 ? popScore : null, weight: 0.37 },
    { score: legacy.destinationAccess > 0 ? destScore : null, weight: 0.37 },
    { score: transitS > 0 ? transitS : null, weight: 0.26 },
  ];

  const densityContext: ComponentScore = {
    label: 'Accessibility',
    score: Math.round(weightedAvg(densityItems)),
    weight: 0.25,
    metrics: densityMetrics,
  };

  // ===== Overall =====
  const components = [
    { score: networkDesign.score, weight: networkDesign.weight },
    { score: environmentalComfort.score, weight: environmentalComfort.weight },
    { score: safety.score, weight: safety.weight },
    { score: densityContext.score, weight: densityContext.weight },
  ];

  // Redistribute weight of components that have no data
  const overallScore = Math.round(weightedAvg(
    components.map(c => ({ score: c.score > 0 ? c.score : null, weight: c.weight }))
  ));

  // Confidence: percentage of sub-metrics with real data
  const allSubMetrics = [...networkMetrics, ...envMetrics, ...safetyMetrics, ...densityMetrics];
  const withData = allSubMetrics.filter(m => m.score > 0).length;
  const confidence = Math.round((withData / allSubMetrics.length) * 100);

  return {
    overallScore,
    grade: letterGrade(overallScore),
    components: {
      networkDesign,
      environmentalComfort,
      safety,
      densityContext,
    },
    confidence,
    legacy,
  };
}
