import type { WalkabilityMetrics } from '../types';

export type MetricKey =
  | 'destinationAccess'
  | 'slope'
  | 'treeCanopy'
  | 'streetGrid'
  | 'crashHistory'
  | 'commuteMode';

export const METRIC_KEYS: MetricKey[] = [
  'destinationAccess', 'slope', 'treeCanopy',
  'streetGrid', 'crashHistory', 'commuteMode',
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
  const r = (key: MetricKey): number => fieldData[key].adjustedScore ?? (original[key] as number ?? 0);

  // Simple average of available metrics
  const available: number[] = [];
  for (const key of METRIC_KEYS) {
    const val = r(key);
    if (val > 0) available.push(val);
  }
  const overallScore = available.length > 0
    ? Math.round((available.reduce((a, b) => a + b, 0) / available.length) * 10) / 10
    : original.overallScore;

  const label: WalkabilityMetrics['label'] =
    overallScore >= 8 ? 'Excellent' :
    overallScore >= 6 ? 'Good' :
    overallScore >= 4 ? 'Fair' :
    overallScore >= 2 ? 'Poor' : 'Critical';

  return { overallScore, label };
}
