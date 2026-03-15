/**
 * Commute Mode service  -  fetches Census ACS commute data from backend
 * (Endpoint kept as /api/population-density for backward compatibility)
 */

export interface CommuteModeResult {
  score: number;
  category: string;
  walkPct?: number;
  bikePct?: number;
  transitPct?: number;
  altPct?: number;
  medianIncome?: number | null;
  medianHomeValue?: number | null;
  totalPop?: number;
  dataSource: string;
}

export async function fetchCommuteMode(
  lat: number,
  lon: number,
): Promise<CommuteModeResult> {
  const apiUrl = import.meta.env.VITE_API_URL || '';

  const response = await fetch(
    `${apiUrl}/api/population-density?lat=${lat}&lon=${lon}`,
  );

  if (!response.ok) {
    throw new Error(`Commute mode API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Commute mode request failed');
  }

  return result.data;
}

// Legacy export for backward compatibility
export const fetchPopulationDensity = fetchCommuteMode;
export type PopulationDensityResult = CommuteModeResult;
