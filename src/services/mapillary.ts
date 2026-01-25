/**
 * Mapillary Service
 * Fetches street-level imagery data from Mapillary API
 * API Docs: https://www.mapillary.com/developer/api-documentation
 */

export interface MapillaryImage {
  id: string;
  lat: number;
  lon: number;
  capturedAt: number;
  compassAngle?: number;
  sequenceId?: string;
  thumb256Url?: string;
  thumb1024Url?: string;
  thumb2048Url?: string;
}

const MAPILLARY_API_BASE = 'https://graph.mapillary.com';

/**
 * Fetch Mapillary images within a bounding box
 * Note: bbox area must be smaller than 0.01 degrees square
 */
export async function fetchMapillaryImages(
  centerLat: number,
  centerLon: number,
  radiusMeters: number = 800
): Promise<MapillaryImage[]> {
  const accessToken = import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN;

  if (!accessToken) {
    console.warn('Mapillary access token not found. Street-level photos will be unavailable.');
    return [];
  }

  try {
    // Convert radius in meters to approximate degrees
    // 1 degree ≈ 111km, so 800m ≈ 0.0072 degrees
    const deltaLat = radiusMeters / 111000;
    const deltaLon = radiusMeters / (111000 * Math.cos((centerLat * Math.PI) / 180));

    const minLon = centerLon - deltaLon;
    const minLat = centerLat - deltaLat;
    const maxLon = centerLon + deltaLon;
    const maxLat = centerLat + deltaLat;

    // Check bbox size (must be < 0.01 degrees square)
    const bboxWidth = maxLon - minLon;
    const bboxHeight = maxLat - minLat;
    if (bboxWidth > 0.01 || bboxHeight > 0.01) {
      console.warn('Bounding box too large for Mapillary API. Reducing search radius.');
      // Reduce to max allowed
      const maxRadius = 555; // ~0.005 degrees
      return fetchMapillaryImages(centerLat, centerLon, maxRadius);
    }

    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

    // Fetch images with required fields
    const fields = 'id,geometry,captured_at,compass_angle,sequence,thumb_256_url,thumb_1024_url,thumb_2048_url';
    const url = `${MAPILLARY_API_BASE}/images?access_token=${accessToken}&fields=${fields}&bbox=${bbox}&limit=100`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapillary API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log('No Mapillary images found in this area');
      return [];
    }

    // Transform to our interface
    const images: MapillaryImage[] = data.data.map((img: any) => ({
      id: img.id,
      lat: img.geometry.coordinates[1],
      lon: img.geometry.coordinates[0],
      capturedAt: img.captured_at,
      compassAngle: img.compass_angle,
      sequenceId: img.sequence,
      thumb256Url: img.thumb_256_url,
      thumb1024Url: img.thumb_1024_url,
      thumb2048Url: img.thumb_2048_url,
    }));

    console.log(`Found ${images.length} Mapillary images in area`);
    return images;

  } catch (error) {
    console.error('Failed to fetch Mapillary images:', error);
    return [];
  }
}

/**
 * Get Mapillary viewer URL for a specific image
 */
export function getMapillaryViewerUrl(imageId: string): string {
  return `https://www.mapillary.com/app/?pKey=${imageId}`;
}

/**
 * Check if Mapillary is configured (has access token)
 */
export function isMapillaryConfigured(): boolean {
  return !!import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN;
}
