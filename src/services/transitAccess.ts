const API_URL = import.meta.env.VITE_API_URL || '';

export interface TransitAccessResult {
  score: number;        // 0-10 (10 = excellent transit access)
  totalStops: number;
  busStops: number;
  railStops: number;
  ferryStops: number;
  dataSource: string;
}

export async function fetchTransitAccess(lat: number, lon: number): Promise<TransitAccessResult | null> {
  const res = await fetch(`${API_URL}/api/transit-access?lat=${lat}&lon=${lon}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.success && json.data ? json.data : null;
}
