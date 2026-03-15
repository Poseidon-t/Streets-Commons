/**
 * Centralized score → color utilities.
 *
 * Two scales exist in the codebase:
 *   scoreColor10   -  legacy WalkabilityMetrics  (0-10)
 *   scoreColor100  -  WalkabilityScoreV2 / SubMetric (0-100)
 */

export function scoreColor10(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

export function scoreColor100(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}
