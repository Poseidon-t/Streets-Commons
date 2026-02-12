/**
 * Population Density service — fetches GHS-POP data from backend
 */

export interface PopulationDensityResult {
  populationDensity: number | null;
  score: number;
  category: string;
  dataSource: string;
}

export async function fetchPopulationDensity(
  lat: number,
  lon: number,
): Promise<PopulationDensityResult> {
  const apiUrl = import.meta.env.VITE_API_URL || '';

  const response = await fetch(
    `${apiUrl}/api/population-density?lat=${lat}&lon=${lon}`,
  );

  if (!response.ok) {
    throw new Error(`Population density API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Population density request failed');
  }

  return result.data;
}
