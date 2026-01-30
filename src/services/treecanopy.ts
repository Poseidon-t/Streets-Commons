/**
 * Tree canopy service - HYBRID APPROACH
 *
 * Strategy:
 * 1. TRY: Real Sentinel-2 satellite NDVI via backend API
 * 2. FALLBACK: OSM green space estimation (always works)
 *
 * 100% FREE - No API keys required for client
 *
 * NDVI (Normalized Difference Vegetation Index):
 * - Range: -1 to +1
 * - 0.2-0.4 = sparse vegetation
 * - 0.4-0.6 = moderate vegetation
 * - 0.6+ = dense vegetation (trees)
 *
 * Calculation: NDVI = (NIR - Red) / (NIR + Red)
 * - NIR = Sentinel-2 Band 8 (Near-Infrared)
 * - Red = Sentinel-2 Band 4
 */

/**
 * Create bounding box around a point
 */
function createBbox(lat: number, lon: number, radiusMeters: number = 800): [number, number, number, number] {
  // Approximate conversion (not perfectly accurate, but good enough)
  const latOffset = radiusMeters / 111000; // ~111km per degree latitude
  const lonOffset = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));

  // Return [minLon, minLat, maxLon, maxLat]
  return [
    lon - lonOffset,
    lat - latOffset,
    lon + lonOffset,
    lat + latOffset,
  ];
}

/**
 * Simple NDVI estimation from OpenStreetMap green spaces
 * Fallback when satellite data unavailable
 */
async function estimateNDVIFromOSM(lat: number, lon: number): Promise<number> {
  try {
    const bbox = createBbox(lat, lon, 800);
    const query = `
      [out:json][timeout:10];
      (
        way["landuse"="forest"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        way["landuse"="meadow"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        way["landuse"="grass"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        way["natural"="wood"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        way["leisure"="park"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        way["leisure"="garden"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
      );
      out geom;
    `;

    // Use backend proxy to avoid CORS issues
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUrl}/api/overpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return 0.3; // Default moderate vegetation
    }

    const result = await response.json();
    const data = result.data || result;
    const greenSpaces = data.elements || [];

    // Rough estimation based on green space coverage
    if (greenSpaces.length >= 10) return 0.6; // Dense vegetation
    if (greenSpaces.length >= 5) return 0.5; // Moderate-high
    if (greenSpaces.length >= 2) return 0.4; // Moderate
    if (greenSpaces.length >= 1) return 0.3; // Sparse
    return 0.2; // Very sparse
  } catch (error) {
    console.error('OSM estimation failed:', error);
    return 0.3; // Default
  }
}

/**
 * Fetch real Sentinel-2 NDVI from backend (Google Earth Engine)
 * Returns NDVI mean value or null if unavailable
 */
async function fetchSatelliteNDVI(lat: number, lon: number): Promise<number | null> {
  const apiUrl = import.meta.env.VITE_API_URL || '';

  try {
    const response = await fetch(`${apiUrl}/api/ndvi?lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!response.ok) {
      console.log('Backend NDVI unavailable, using OSM estimation');
      return null;
    }

    const result = await response.json();

    // Handle new backend response format
    if (result.success && result.data && result.data.ndvi !== undefined && result.data.ndvi !== null) {
      console.log(`✅ Real satellite NDVI: ${result.data.ndvi.toFixed(3)} (${result.data.category})`);
      return result.data.ndvi;
    }

    return null;
  } catch (error) {
    console.log('Satellite NDVI fetch failed, using OSM estimation');
    return null;
  }
}

/**
 * Fetch NDVI data for a location - HYBRID APPROACH
 * Returns NDVI mean value (0-1 scale)
 *
 * 1. TRY: Real Sentinel-2 satellite NDVI from backend
 * 2. FALLBACK: OSM green space estimation (always works)
 */
export async function fetchNDVI(lat: number, lon: number): Promise<number | null> {
  console.log(`Fetching tree canopy data for ${lat.toFixed(4)}, ${lon.toFixed(4)}...`);

  try {
    // STEP 1: Try to get real satellite NDVI from backend (Google Earth Engine)
    const satelliteNDVI = await fetchSatelliteNDVI(lat, lon);

    if (satelliteNDVI !== null) {
      console.log(`🛰️ Using real Sentinel-2 satellite data: NDVI ${satelliteNDVI.toFixed(2)}`);
      return satelliteNDVI;
    }

    // STEP 2: Fallback to OSM green space estimation
    console.log('🗺️ Using OSM green space estimation');
    const osmNDVI = await estimateNDVIFromOSM(lat, lon);
    console.log(`Tree canopy NDVI (OSM estimate): ${osmNDVI.toFixed(2)}`);
    return osmNDVI;
  } catch (error) {
    console.error('Failed to fetch tree canopy data:', error);

    // Last resort: try OSM estimation
    try {
      return await estimateNDVIFromOSM(lat, lon);
    } catch (fallbackError) {
      console.error('All NDVI methods failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Score tree canopy for walkability
 * Higher NDVI = more vegetation/trees = better walkability (shade, air quality)
 *
 * Scoring:
 * - NDVI ≥ 0.6 (dense trees) = 10 points
 * - NDVI 0.4-0.6 (moderate vegetation) = 5-10 points
 * - NDVI < 0.4 (sparse/none) = 0-5 points
 */
export function scoreTreeCanopy(ndvi: number): number {
  if (ndvi >= 0.6) {
    // Dense vegetation/trees: 10 points
    return 10;
  } else if (ndvi >= 0.4) {
    // Moderate vegetation: scale from 5 to 10
    const score = 5 + ((ndvi - 0.4) / 0.2) * 5;
    return Math.round(score * 10) / 10;
  } else if (ndvi >= 0.2) {
    // Sparse vegetation: scale from 0 to 5
    const score = (ndvi - 0.2) / 0.2 * 5;
    return Math.round(score * 10) / 10;
  } else {
    // No vegetation
    return 0;
  }
}
