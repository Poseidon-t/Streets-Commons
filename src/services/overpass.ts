import { ANALYSIS_RADIUS } from '../constants';
import type { OSMData, StreetAttributes, IntersectionNode, NetworkGraph } from '../types';

// Direct Overpass mirrors (called from browser as fallback)
// Note: .fr removed due to frequent CORS blocks from browser
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/**
 * Race multiple Overpass mirrors directly from the browser.
 * Returns the first valid JSON response.
 */
async function queryOverpassDirect(query: string): Promise<any> {
  const MIRROR_TIMEOUT = 15000;

  return new Promise((resolve, reject) => {
    let pending = OVERPASS_MIRRORS.length;
    let settled = false;
    const controllers: AbortController[] = [];

    OVERPASS_MIRRORS.forEach((endpoint, i) => {
      const controller = new AbortController();
      controllers.push(controller);

      const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT);

      fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
        .then(async (response) => {
          clearTimeout(timer);
          if (settled) return;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((json) => {
          if (settled || !json) return;
          settled = true;
          console.log(`✅ Overpass direct: ${endpoint}`);
          controllers.forEach((c, j) => { if (j !== i) c.abort(); });
          resolve(json);
        })
        .catch(() => {
          clearTimeout(timer);
          pending--;
          if (!settled && pending === 0) {
            reject(new Error('All Overpass mirrors failed'));
          }
        });
    });
  });
}

export async function fetchOSMData(lat: number, lon: number): Promise<OSMData> {
  const radius = ANALYSIS_RADIUS;

  const query = `[out:json][timeout:15];(node(around:${radius},${lat},${lon})["highway"="crossing"];way(around:${radius},${lat},${lon})["footway"="sidewalk"];way(around:${radius},${lat},${lon})["highway"~"^(footway|primary|secondary|tertiary|residential|unclassified|service)$"];node(around:${radius},${lat},${lon})["amenity"];node(around:${radius},${lat},${lon})["shop"];way(around:${radius},${lat},${lon})["leisure"="park"];way(around:${radius},${lat},${lon})["leisure"="garden"];way(around:${radius},${lat},${lon})["leisure"="playground"];way(around:${radius},${lat},${lon})["leisure"="pitch"];way(around:${radius},${lat},${lon})["landuse"="forest"];way(around:${radius},${lat},${lon})["landuse"="meadow"];way(around:${radius},${lat},${lon})["landuse"="grass"];way(around:${radius},${lat},${lon})["natural"="wood"];node(around:${radius},${lat},${lon})["leisure"="park"];node(around:${radius},${lat},${lon})["leisure"="garden"];);out body; >; out skel qt;`;

  const apiUrl = import.meta.env.VITE_API_URL || '';

  // Strategy 1: Backend proxy (has server-side cache + all mirrors)
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

    if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);

    const result = await response.json();
    return processOSMData(result.data);
  } catch (proxyError: any) {
    console.warn('Backend proxy failed, trying direct Overpass mirrors:', proxyError.message);
  }

  // Strategy 2: Direct browser → Overpass mirrors (bypasses backend entirely)
  try {
    const data = await queryOverpassDirect(query);
    return processOSMData(data);
  } catch (directError: any) {
    console.error('All Overpass strategies failed:', directError);

    if (directError.name === 'AbortError') {
      throw new Error('Request timed out. The OpenStreetMap servers are busy. Please try again in a moment.');
    }

    throw new Error('Failed to fetch OSM data. All Overpass mirrors failed. Please try again in a moment.');
  }
}

/** Haversine distance in meters between two lat/lon points */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STREET_HIGHWAY_TYPES = [
  'primary', 'secondary', 'tertiary', 'residential',
  'living_street', 'pedestrian', 'unclassified', 'service',
];

function processOSMData(data: any): OSMData {
  // Build node lookup map (all nodes with coordinates)
  const nodes = new Map<string, { lat: number; lon: number }>();
  data.elements
    .filter((e: any) => e.type === 'node' && e.lat !== undefined)
    .forEach((node: any) => {
      nodes.set(node.id.toString(), { lat: node.lat, lon: node.lon });
    });

  // Identify street ways for network graph
  const streetWays = data.elements.filter(
    (e: any) =>
      e.type === 'way' &&
      e.tags?.highway &&
      STREET_HIGHWAY_TYPES.includes(e.tags.highway) &&
      e.nodes?.length >= 2
  );

  // Build node-degree map: count how many street ways pass through each node
  const nodeDegree = new Map<string, number>();
  for (const way of streetWays) {
    for (const nodeId of way.nodes) {
      const key = nodeId.toString();
      nodeDegree.set(key, (nodeDegree.get(key) || 0) + 1);
    }
    // Endpoint nodes of a single way count as connections too —
    // but only endpoint-to-endpoint matters for dead-end detection.
    // The degree count above already handles this: a dead-end cul-de-sac
    // endpoint appears in exactly 1 way → degree 1.
  }

  // Identify intersections (degree >= 3) and dead-ends (degree == 1)
  const intersections: IntersectionNode[] = [];
  const deadEnds: IntersectionNode[] = [];

  for (const [nodeId, degree] of nodeDegree) {
    const coords = nodes.get(nodeId);
    if (!coords) continue;

    if (degree >= 3) {
      intersections.push({ id: nodeId, lat: coords.lat, lon: coords.lon, degree });
    } else if (degree === 1) {
      deadEnds.push({ id: nodeId, lat: coords.lat, lon: coords.lon, degree: 1 });
    }
  }

  // Calculate total street length via haversine on way node sequences
  let totalStreetLengthM = 0;
  for (const way of streetWays) {
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const a = nodes.get(way.nodes[i].toString());
      const b = nodes.get(way.nodes[i + 1].toString());
      if (a && b) {
        totalStreetLengthM += haversineM(a.lat, a.lon, b.lat, b.lon);
      }
    }
  }

  // Analysis area: circle with ANALYSIS_RADIUS (800m)
  const areaKm2 = Math.PI * (ANALYSIS_RADIUS / 1000) ** 2;
  const totalStreetLengthKm = totalStreetLengthM / 1000;
  const averageBlockLengthM =
    intersections.length > 1
      ? totalStreetLengthM / intersections.length
      : totalStreetLengthM;

  const networkGraph: NetworkGraph = {
    intersections,
    deadEnds,
    totalStreetLengthKm,
    areaKm2,
    averageBlockLengthM,
  };

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
    networkGraph,
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
    name: tags['name:en'] || tags.name || 'Unnamed Street',
    nameEn: tags['name:en'] || undefined,
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

    // Try backend proxy first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${apiUrl}/api/overpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        const ways = (result.data?.elements || []).filter(
          (e: any) => e.type === 'way' && e.tags?.highway,
        );

        if (ways.length > 0) {
          ways.sort(
            (a: any, b: any) =>
              (HIGHWAY_PRIORITY[a.tags.highway] ?? 99) -
              (HIGHWAY_PRIORITY[b.tags.highway] ?? 99),
          );
          return mapToStreetAttributes(ways[0].tags, ways[0].id);
        }
        continue;
      }
    } catch {
      // Backend failed, fall through to direct
    }

    // Direct fallback
    try {
      const data = await queryOverpassDirect(query);
      const ways = (data?.elements || []).filter(
        (e: any) => e.type === 'way' && e.tags?.highway,
      );

      if (ways.length > 0) {
        ways.sort(
          (a: any, b: any) =>
            (HIGHWAY_PRIORITY[a.tags.highway] ?? 99) -
            (HIGHWAY_PRIORITY[b.tags.highway] ?? 99),
        );
        return mapToStreetAttributes(ways[0].tags, ways[0].id);
      }
    } catch {
      continue;
    }
  }

  return null;
}
