/**
 * 4-Component Walkability Scoring (0-100 + A-F Grade)
 *
 * Components:
 *   Network Design        35%  — intersection density, block length, network density, dead-end ratio
 *   Environmental Comfort 25%  — tree canopy, building density (NDBI), thermal comfort
 *   Safety                25%  — speed exposure, crossing safety, night safety, crash severity
 *   Density Context       15%  — population density
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
  CrashData,
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

// ---------- crash data → 0-100 score ----------

function scoreCrashData(crash: CrashData | null): number | null {
  if (!crash) return null;

  if (crash.type === 'local') {
    // FARS local: fewer fatalities per year = better
    const years = crash.yearRange.to - crash.yearRange.from + 1;
    const fatalitiesPerYear = years > 0 ? crash.totalFatalities / years : crash.totalFatalities;
    if (fatalitiesPerYear === 0) return 100;
    if (fatalitiesPerYear <= 1) return 80;
    if (fatalitiesPerYear <= 3) return 60;
    if (fatalitiesPerYear <= 5) return 40;
    return 20;
  }

  // Country-level WHO: deaths per 100k
  const rate = crash.deathRatePer100k;
  if (rate <= 3) return 95;
  if (rate <= 6) return 80;
  if (rate <= 10) return 60;
  if (rate <= 15) return 40;
  return 20;
}

// ---------- input interface ----------

export interface CompositeScoreInput {
  legacy: WalkabilityMetrics;
  networkGraph?: NetworkGraph;
  buildingDensityScore?: number;     // 0-100 from NDBI
  populationDensityScore?: number;   // 0-100 from GHS-POP
  crashData?: CrashData | null;
}

// ---------- main function ----------

export function calculateCompositeScore(input: CompositeScoreInput): WalkabilityScoreV2 {
  const { legacy, networkGraph, buildingDensityScore, populationDensityScore, crashData } = input;

  // ===== 1. Network Design (35%) =====
  let networkMetrics: SubMetric[];

  if (networkGraph) {
    const intDensity = scoreIntersectionDensity(networkGraph);
    const blockLen = scoreBlockLength(networkGraph);
    const netDensity = scoreNetworkDensity(networkGraph);
    const deadEnd = scoreDeadEndRatio(networkGraph);

    networkMetrics = [
      { name: 'Intersection Density', score: intDensity.score, rawValue: `${intDensity.raw}/km²`, weight: 0.30 },
      { name: 'Block Length', score: blockLen.score, rawValue: `${blockLen.raw}m avg`, weight: 0.30 },
      { name: 'Network Density', score: netDensity.score, rawValue: `${netDensity.raw} km/km²`, weight: 0.20 },
      { name: 'Dead-End Ratio', score: deadEnd.score, rawValue: `${deadEnd.raw}%`, weight: 0.20 },
    ];
  } else {
    networkMetrics = [
      { name: 'Intersection Density', score: 0, weight: 0.30 },
      { name: 'Block Length', score: 0, weight: 0.30 },
      { name: 'Network Density', score: 0, weight: 0.20 },
      { name: 'Dead-End Ratio', score: 0, weight: 0.20 },
    ];
  }

  const networkScore = weightedAvg(networkMetrics.map(m => ({ score: m.score, weight: m.weight })));

  const networkDesign: ComponentScore = {
    label: 'Network Design',
    score: Math.round(networkScore),
    weight: 0.35,
    metrics: networkMetrics,
  };

  // ===== 2. Environmental Comfort (25%) =====
  const treeScore = scale10to100(legacy.treeCanopy);
  const thermalScore = scale10to100(legacy.thermalComfort);

  const envMetrics: SubMetric[] = [
    { name: 'Tree Canopy', score: treeScore, weight: 0.50 },
    { name: 'Building Density', score: buildingDensityScore ?? 0, rawValue: buildingDensityScore !== undefined ? `NDBI` : undefined, weight: 0.30 },
    { name: 'Thermal Comfort', score: thermalScore, weight: 0.20 },
  ];

  // Only include metrics that have real data
  const envItems = [
    { score: legacy.treeCanopy > 0 ? treeScore : null, weight: 0.50 },
    { score: buildingDensityScore !== undefined ? buildingDensityScore : null, weight: 0.30 },
    { score: legacy.thermalComfort > 0 ? thermalScore : null, weight: 0.20 },
  ];
  const envScore = weightedAvg(envItems);

  const environmentalComfort: ComponentScore = {
    label: 'Environmental Comfort',
    score: Math.round(envScore),
    weight: 0.25,
    metrics: envMetrics,
  };

  // ===== 3. Safety (25%) =====
  const speedScore = scale10to100(legacy.speedExposure);
  const crossingScore = scale10to100(legacy.crossingSafety);
  const nightScore = scale10to100(legacy.nightSafety);
  const crashScore = scoreCrashData(crashData ?? null);

  const safetyMetrics: SubMetric[] = [
    { name: 'Speed Exposure', score: speedScore, weight: 0.25 },
    { name: 'Crossing Safety', score: crossingScore, weight: 0.25 },
    { name: 'Night Safety', score: nightScore, weight: 0.25 },
    { name: 'Crash Data', score: crashScore ?? 0, weight: 0.25 },
  ];

  const safetyItems = [
    { score: speedScore, weight: 0.25 },
    { score: crossingScore, weight: 0.25 },
    { score: nightScore, weight: 0.25 },
    { score: crashScore, weight: 0.25 },
  ];
  const safetyScore = weightedAvg(safetyItems);

  const safety: ComponentScore = {
    label: 'Safety',
    score: Math.round(safetyScore),
    weight: 0.25,
    metrics: safetyMetrics,
  };

  // ===== 4. Density Context (15%) =====
  const popScore = populationDensityScore ?? 0;

  const densityMetrics: SubMetric[] = [
    { name: 'Population Density', score: popScore, weight: 1.0 },
  ];

  const densityContext: ComponentScore = {
    label: 'Density Context',
    score: Math.round(popScore),
    weight: 0.15,
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
