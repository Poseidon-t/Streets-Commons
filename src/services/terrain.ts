const API_URL = import.meta.env.VITE_API_URL || '';

export interface TerrainResult {
  score: number;           // 0-10 (10 = flat, 1 = very steep)
  stdDev: number;          // elevation standard deviation in metres
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  elevationRange: number;
  dataSource: string;
}

export async function fetchTerrain(lat: number, lon: number): Promise<TerrainResult | null> {
  const res = await fetch(`${API_URL}/api/terrain?lat=${lat}&lon=${lon}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.success && json.data ? json.data : null;
}
