import type { WalkabilityMetrics } from '../types';

export type MetricKey =
  | 'crossingSafety'
  | 'sidewalkCoverage'
  | 'speedExposure'
  | 'destinationAccess'
  | 'nightSafety'
  | 'slope'
  | 'treeCanopy'
  | 'thermalComfort';

export const METRIC_KEYS: MetricKey[] = [
  'crossingSafety', 'sidewalkCoverage', 'speedExposure', 'destinationAccess',
  'nightSafety', 'slope', 'treeCanopy', 'thermalComfort',
];

export interface FieldEntry {
  adjustedScore: number | null;
  observation: string;
}

export type FieldData = Record<MetricKey, FieldEntry>;

export function createEmptyFieldData(): FieldData {
  const result = {} as FieldData;
  for (const key of METRIC_KEYS) {
    result[key] = { adjustedScore: null, observation: '' };
  }
  return result;
}

/**
 * Recalculate overall score using field-verified overrides.
 * Same weights as metrics.ts lines 274-296.
 */
export function recalculateScore(
  original: WalkabilityMetrics,
  fieldData: FieldData,
): { overallScore: number; label: WalkabilityMetrics['label'] } {
  const r = (key: MetricKey): number => fieldData[key].adjustedScore ?? original[key];

  const safetyScore = r('crossingSafety') * 0.15 + r('sidewalkCoverage') * 0.15 +
    r('speedExposure') * 0.15 + r('nightSafety') * 0.10 + r('destinationAccess') * 0.10;

  // Check if satellite data was available in original analysis
  const hasSatellite = [original.slope, original.treeCanopy, original.thermalComfort]
    .filter(s => s > 0).length >= 2;

  let overallScore: number;
  if (hasSatellite) {
    overallScore = Math.round(
      (safetyScore + r('slope') * 0.10 + r('treeCanopy') * 0.10 + r('thermalComfort') * 0.15) * 10
    ) / 10;
  } else {
    overallScore = Math.round(
      ((r('crossingSafety') + r('sidewalkCoverage') + r('speedExposure') + r('nightSafety') + r('destinationAccess')) / 5) * 10
    ) / 10;
  }

  const label: WalkabilityMetrics['label'] =
    overallScore >= 8 ? 'Excellent' :
    overallScore >= 6 ? 'Good' :
    overallScore >= 4 ? 'Fair' :
    overallScore >= 2 ? 'Poor' : 'Critical';

  return { overallScore, label };
}
