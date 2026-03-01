/**
 * Street Design service — fetches EPA National Walkability Index data from backend
 */

export interface StreetDesignResult {
  score: number;
  category: string;
  d3bRank: number;         // Street intersection density (1-20)
  d4aRank: number;         // Transit proximity (1-20)
  d2bRank: number;         // Land use mix (1-20)
  natWalkInd: number;      // EPA composite walkability (1-20)
  natWalkIndRank: number | null;  // National percentile
  zeroCarPct: number | null;
  totalPop: number | null;
  metroArea: string | null;
  dataSource: string;
}

export async function fetchStreetDesign(
  lat: number,
  lon: number,
): Promise<StreetDesignResult | null> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';

    const response = await fetch(
      `${apiUrl}/api/street-design?lat=${lat}&lon=${lon}`,
    );

    if (!response.ok) {
      console.warn(`Street design API error: ${response.status}`);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return null;
    }

    return result.data;
  } catch (error) {
    console.warn('Street design fetch failed (non-blocking):', error);
    return null;
  }
}
