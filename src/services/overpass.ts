import { OVERPASS_URL, ANALYSIS_RADIUS } from '../constants';
import type { OSMData, StreetAttributes } from '../types';

export async function fetchOSMData(lat: number, lon: number): Promise<OSMData> {
  const radius = ANALYSIS_RADIUS;

  // Optimized query - faster, less likely to timeout
  // CRITICAL: [out:json] at the start ensures JSON response format
  const query = `[out:json][timeout:15];(node(around:${radius},${lat},${lon})["highway"="crossing"];way(around:${radius},${lat},${lon})["footway"="sidewalk"];way(around:${radius},${lat},${lon})["highway"~"^(footway|primary|secondary|tertiary|residential)$"];node(around:${radius},${lat},${lon})["amenity"];node(around:${radius},${lat},${lon})["shop"];way(around:${radius},${lat},${lon})["leisure"="park"];way(around:${radius},${lat},${lon})["leisure"="garden"];way(around:${radius},${lat},${lon})["leisure"="playground"];way(around:${radius},${lat},${lon})["leisure"="pitch"];way(around:${radius},${lat},${lon})["landuse"="forest"];way(around:${radius},${lat},${lon})["landuse"="meadow"];way(around:${radius},${lat},${lon})["landuse"="grass"];way(around:${radius},${lat},${lon})["natural"="wood"];node(around:${radius},${lat},${lon})["leisure"="park"];node(around:${radius},${lat},${lon})["leisure"="garden"];);out center;`;

  // Use backend proxy to avoid CORS issues
  const apiUrl = import.meta.env.VITE_API_URL || '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${apiUrl}/api/overpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return processOSMData(result.data);

  } catch (error: any) {
    console.error('Failed to fetch OSM data:', error);

    // Better error message based on error type
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The OpenStreetMap servers are busy. Please try again in a moment.');
    }

    throw new Error(`Failed to fetch OSM data. ${error.message || 'Unknown error'}. Please try again in a moment.`);
  }
}

function processOSMData(data: any): OSMData {

  // Build node lookup map
  const nodes = new Map();
  data.elements
    .filter((e: any) => e.type === 'node')
    .forEach((node: any) => {
      nodes.set(node.id.toString(), { lat: node.lat, lon: node.lon });
    });

  return {
    crossings: data.elements.filter(
      (e: any) => e.tags?.highway === 'crossing' || e.tags?.crossing
    ),
    sidewalks: data.elements.filter(
      (e: any) =>
        e.tags?.footway === 'sidewalk' ||
        e.tags?.sidewalk ||
        e.tags?.highway === 'footway'
    ),
    streets: data.elements.filter(
      (e: any) =>
        e.type === 'way' &&
        e.tags?.highway &&
        ['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'pedestrian'].includes(
          e.tags.highway
        )
    ),
    pois: data.elements.filter(
      (e: any) =>
        e.tags?.amenity ||
        e.tags?.shop ||
        e.tags?.leisure ||
        e.tags?.railway === 'station' ||
        e.tags?.landuse === 'forest' ||
        e.tags?.landuse === 'grass' ||
        e.tags?.natural === 'tree'
    ),
    nodes,
  };
}

const HIGHWAY_PRIORITY: Record<string, number> = {
  primary: 0,
  secondary: 1,
  tertiary: 2,
  residential: 3,
  living_street: 4,
};

function mapToStreetAttributes(tags: any, osmId?: number): StreetAttributes {
  return {
    name: tags.name || 'Unnamed Street',
    highway: tags.highway,
    lanes: tags.lanes ? parseInt(tags.lanes, 10) : undefined,
    width: tags.width ? parseFloat(tags.width) : undefined,
    cycleway: tags.cycleway,
    cyclewayLeft: tags['cycleway:left'],
    cyclewayRight: tags['cycleway:right'],
    surface: tags.surface,
    maxspeed: tags.maxspeed ? parseInt(tags.maxspeed, 10) : undefined,
    parkingLeft: tags['parking:lane:left'],
    parkingRight: tags['parking:lane:right'],
    sidewalk: tags.sidewalk,
    oneway: tags.oneway === 'yes',
    lit: tags.lit === 'yes',
    osmId,
  };
}

export async function fetchNearestStreetDetails(
  lat: number,
  lon: number,
): Promise<StreetAttributes | null> {
  const apiUrl = import.meta.env.VITE_API_URL || '';

  for (const radius of [50, 150]) {
    const query = `[out:json][timeout:10];way(around:${radius},${lat},${lon})["highway"~"^(primary|secondary|tertiary|residential|living_street)$"];out tags;`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${apiUrl}/api/overpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const result = await response.json();
      const ways = (result.data?.elements || []).filter(
        (e: any) => e.type === 'way' && e.tags?.highway,
      );

      if (ways.length === 0) continue;

      ways.sort(
        (a: any, b: any) =>
          (HIGHWAY_PRIORITY[a.tags.highway] ?? 99) -
          (HIGHWAY_PRIORITY[b.tags.highway] ?? 99),
      );

      return mapToStreetAttributes(ways[0].tags, ways[0].id);
    } catch {
      continue;
    }
  }

  return null;
}
