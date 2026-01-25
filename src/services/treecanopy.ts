/**
 * Tree canopy service using OpenWeather Agro API
 * Data source: Sentinel-2 and Landsat 8 NDVI
 *
 * Free tier: 1,000 calls/day
 * Requires: Free API key from OpenWeather (openweathermap.org)
 *
 * NDVI (Normalized Difference Vegetation Index):
 * - Range: -1 to +1
 * - 0.2-0.4 = sparse vegetation
 * - 0.4-0.6 = moderate vegetation
 * - 0.6+ = dense vegetation (trees)
 */

const AGRO_API_BASE = 'https://api.agromonitoring.com/agro/1.0';

interface NDVIStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
}

interface SatelliteImagery {
  dt: number; // Unix timestamp
  type: string;
  dc: number; // Cloud coverage percentage
  cl: number; // Cloud coverage percentage
  sun: {
    azimuth: number;
    elevation: number;
  };
  image: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
  stats: {
    ndvi: NDVIStats;
    evi: NDVIStats;
  };
}

/**
 * Create a polygon around a point (800m radius square)
 */
function createPolygon(lat: number, lon: number, radiusMeters: number = 800): number[][] {
  // Approximate conversion (not perfectly accurate, but good enough)
  const latOffset = radiusMeters / 111000; // ~111km per degree latitude
  const lonOffset = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));

  // Create a square polygon
  return [
    [lon - lonOffset, lat + latOffset], // NW
    [lon + lonOffset, lat + latOffset], // NE
    [lon + lonOffset, lat - latOffset], // SE
    [lon - lonOffset, lat - latOffset], // SW
    [lon - lonOffset, lat + latOffset], // Close polygon
  ];
}

/**
 * Fetch NDVI data for a location
 * Returns NDVI mean value (0-1 scale)
 */
export async function fetchNDVI(lat: number, lon: number): Promise<number | null> {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn('OpenWeather API key not found. Tree canopy metric will be unavailable.');
    console.warn('Get a free API key at: https://openweathermap.org/api');
    return null;
  }

  try {
    // Step 1: Create a polygon
    const polygon = createPolygon(lat, lon, 800);
    const polygonData = {
      name: `Analysis area ${lat.toFixed(4)},${lon.toFixed(4)}`,
      geo_json: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [polygon],
        },
      },
    };

    const createResponse = await fetch(`${AGRO_API_BASE}/polygons?appid=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(polygonData),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create polygon: ${createResponse.status}`);
    }

    const polygonResult = await createResponse.json();
    const polygonId = polygonResult.id;

    // Step 2: Get satellite imagery for this polygon
    // Use last 30 days to ensure we get recent cloud-free images
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const imageryResponse = await fetch(
      `${AGRO_API_BASE}/image/search?start=${thirtyDaysAgo}&end=${now}&polyid=${polygonId}&appid=${apiKey}`
    );

    if (!imageryResponse.ok) {
      throw new Error(`Failed to fetch imagery: ${imageryResponse.status}`);
    }

    const images: SatelliteImagery[] = await imageryResponse.json();

    // Step 3: Delete the polygon (cleanup)
    await fetch(`${AGRO_API_BASE}/polygons/${polygonId}?appid=${apiKey}`, {
      method: 'DELETE',
    });

    // Step 4: Find the most recent image with low cloud cover
    const clearImages = images
      .filter(img => img.dc < 20 && img.stats?.ndvi) // Less than 20% cloud cover
      .sort((a, b) => b.dt - a.dt); // Most recent first

    if (clearImages.length === 0) {
      console.warn('No clear satellite images found for this location in the last 30 days');
      return null;
    }

    const bestImage = clearImages[0];
    const ndviMean = bestImage.stats.ndvi.mean;

    return ndviMean;
  } catch (error) {
    console.error('Failed to fetch NDVI data:', error);
    return null;
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
