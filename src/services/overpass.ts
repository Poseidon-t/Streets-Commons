import { OVERPASS_URL, ANALYSIS_RADIUS } from '../constants';
import type { OSMData } from '../types';

export async function fetchOSMData(lat: number, lon: number): Promise<OSMData> {
  const radius = ANALYSIS_RADIUS;

  // Comprehensive query for all walkability-related features
  const query = `
    [out:json][timeout:25];
    (
      // Pedestrian crossings
      node(around:${radius},${lat},${lon})["highway"="crossing"];
      node(around:${radius},${lat},${lon})["crossing"];

      // Sidewalks and footways
      way(around:${radius},${lat},${lon})["footway"="sidewalk"];
      way(around:${radius},${lat},${lon})["sidewalk"];
      way(around:${radius},${lat},${lon})["highway"="footway"];

      // Streets and roads
      way(around:${radius},${lat},${lon})["highway"~"^(primary|secondary|tertiary|residential|living_street|pedestrian)$"];

      // Green spaces and trees
      node(around:${radius},${lat},${lon})["natural"="tree"];
      way(around:${radius},${lat},${lon})["landuse"="forest"];
      way(around:${radius},${lat},${lon})["landuse"="grass"];
      way(around:${radius},${lat},${lon})["leisure"="park"];

      // Points of interest - destinations
      node(around:${radius},${lat},${lon})["amenity"~"^(school|kindergarten|college|university)$"];
      node(around:${radius},${lat},${lon})["amenity"~"^(bus_station|ferry_terminal)$"];
      node(around:${radius},${lat},${lon})["railway"="station"];
      node(around:${radius},${lat},${lon})["shop"];
      node(around:${radius},${lat},${lon})["amenity"~"^(hospital|clinic|doctors|pharmacy)$"];
      node(around:${radius},${lat},${lon})["amenity"~"^(restaurant|cafe|bar|fast_food)$"];
      node(around:${radius},${lat},${lon})["leisure"~"^(park|playground|sports_centre)$"];
    );
    out body;
    >;
    out skel qt;
  `;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch OSM data');
  }

  const data = await response.json();

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
