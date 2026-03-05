const API_URL = import.meta.env.VITE_API_URL || '';

export interface StreetFeaturesResult {
  coverageInsufficient: boolean;
  imageCount: number;
  hasRecentData?: boolean;
  streetLighting?: {
    score: number;    // 0-10
    count: number;    // detected street lights
    perKm2: number;   // lights per km²
  };
  crosswalkMarkings?: number;
  pedestrianAmenities?: { benches: number; bollards: number };
  speedSignValues?: number[];  // extracted posted speeds (km/h) from detected signs
  totalFeatures?: number;
  dataSource: string;
}

export async function fetchStreetFeatures(lat: number, lon: number): Promise<StreetFeaturesResult | null> {
  const res = await fetch(`${API_URL}/api/street-features?lat=${lat}&lon=${lon}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.success && json.data ? json.data : null;
}
