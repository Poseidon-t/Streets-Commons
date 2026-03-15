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
  const poiRadius = 1200; // 15-min walk radius for service availability

  // Split into two output groups to avoid downloading full geometry for POIs.
  // Group 1: Streets/crossings/sidewalks — need full node geometry for length calculation.
  // Group 2: POIs/amenities/transit — only need center coordinates (much lighter).
  const query = `[out:json][timeout:25];
(
  node(around:${radius},${lat},${lon})["highway"="crossing"];
  way(around:${radius},${lat},${lon})["footway"="sidewalk"];
  way(around:${radius},${lat},${lon})["highway"~"^(footway|primary|secondary|tertiary|residential|unclassified|service)$"];
);
out body; >; out skel qt;
(
  node(around:${poiRadius},${lat},${lon})["amenity"];
  node(around:${poiRadius},${lat},${lon})["shop"];
  way(around:${poiRadius},${lat},${lon})["shop"="supermarket"];
  way(around:${poiRadius},${lat},${lon})["amenity"="school"];
  way(around:${poiRadius},${lat},${lon})["leisure"="park"];
  way(around:${poiRadius},${lat},${lon})["leisure"="garden"];
  way(around:${poiRadius},${lat},${lon})["leisure"="playground"];
  way(around:${poiRadius},${lat},${lon})["leisure"="pitch"];
  way(around:${poiRadius},${lat},${lon})["leisure"="sports_centre"];
  way(around:${poiRadius},${lat},${lon})["leisure"="fitness_centre"];
  way(around:${poiRadius},${lat},${lon})["landuse"="forest"];
  way(around:${poiRadius},${lat},${lon})["landuse"="meadow"];
  way(around:${poiRadius},${lat},${lon})["landuse"="grass"];
  way(around:${poiRadius},${lat},${lon})["natural"="wood"];
  node(around:${poiRadius},${lat},${lon})["leisure"="park"];
  node(around:${poiRadius},${lat},${lon})["leisure"="garden"];
  node(around:${poiRadius},${lat},${lon})["public_transport"="stop_position"];
  node(around:${poiRadius},${lat},${lon})["public_transport"="platform"];
  node(around:${poiRadius},${lat},${lon})["highway"="bus_stop"];
  node(around:${poiRadius},${lat},${lon})["railway"="station"];
  node(around:${poiRadius},${lat},${lon})["railway"="tram_stop"];
  node(around:${poiRadius},${lat},${lon})["railway"="subway_entrance"];
);
out center;`;

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

export interface HistoricalSnapshot {
  isoDate: string;
  intersectionCount: number;
  deadEndCount: number;
  totalStreetLengthKm: number;
  amenityCount: number;
}

/**
 * Fetch a lightweight street-topology + amenity count snapshot from OSM
 * as it existed on a specific date, using the Overpass `[date:"..."]` filter.
 * Used for "how has this area changed?" comparisons.
 */
export async function fetchHistoricalSnapshot(
  lat: number,
  lon: number,
  isoDate: string,   // e.g. "2022-01-01T00:00:00Z"
): Promise<HistoricalSnapshot> {
  const radius = ANALYSIS_RADIUS;
  const poiRadius = 1200;

  // Streets + crossings for network topology
  const streetQuery = `[out:json][date:"${isoDate}"][timeout:20];
(
  way(around:${radius},${lat},${lon})["highway"~"^(primary|secondary|tertiary|residential|unclassified|service|living_street)$"];
);
out body; >; out skel qt;`;

  // Amenity node count only (lightweight)
  const amenityQuery = `[out:json][date:"${isoDate}"][timeout:15];
(
  node(around:${poiRadius},${lat},${lon})["amenity"];
  node(around:${poiRadius},${lat},${lon})["shop"];
);
out count;`;

  const apiUrl = import.meta.env.VITE_API_URL || '';

  async function runQuery(q: string): Promise<any> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 18000);
      const res = await fetch(`${apiUrl}/api/overpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch {
      return await queryOverpassDirect(q);
    }
  }

  const [streetData, amenityData] = await Promise.all([
    runQuery(streetQuery),
    runQuery(amenityQuery),
  ]);

  // Build node map from street data
  const nodes = new Map<string, { lat: number; lon: number }>();
  streetData.elements
    .filter((e: any) => e.type === 'node' && e.lat !== undefined)
    .forEach((n: any) => nodes.set(n.id.toString(), { lat: n.lat, lon: n.lon }));

  const streetWays = streetData.elements.filter(
    (e: any) => e.type === 'way' && STREET_HIGHWAY_TYPES.includes(e.tags?.highway) && e.nodes?.length >= 2,
  );

  // Degree map → intersections + dead-ends
  const nodeDegree = new Map<string, number>();
  for (const way of streetWays) {
    for (const nodeId of way.nodes) {
      const k = nodeId.toString();
      nodeDegree.set(k, (nodeDegree.get(k) || 0) + 1);
    }
  }

  let intersections = 0;
  let deadEnds = 0;
  for (const [, deg] of nodeDegree) {
    if (deg >= 3) intersections++;
    else if (deg === 1) deadEnds++;
  }

  let totalLenM = 0;
  for (const way of streetWays) {
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const a = nodes.get(way.nodes[i].toString());
      const b = nodes.get(way.nodes[i + 1].toString());
      if (a && b) totalLenM += haversineM(a.lat, a.lon, b.lat, b.lon);
    }
  }

  // Amenity count — Overpass `out count;` returns a single element with tags.total
  const amenityCount =
    parseInt(amenityData?.elements?.[0]?.tags?.total ?? '0', 10);

  return {
    isoDate,
    intersectionCount: intersections,
    deadEndCount: deadEnds,
    totalStreetLengthKm: totalLenM / 1000,
    amenityCount,
  };
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

// Default speeds by highway type (km/h) when maxspeed tag is absent
const HIGHWAY_DEFAULT_SPEED: Record<string, number> = {
  living_street: 10,
  pedestrian: 5,
  footway: 5,
  service: 20,
  residential: 30,
  unclassified: 40,
  tertiary: 50,
  secondary: 50,
  primary: 60,
};

function parseMaxspeedKmh(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === 'walk' || lower.includes('living_street')) return 10;
  if (lower === 'none' || lower === 'signals') return undefined;
  if (lower.includes('urban')) return 50;
  if (lower.includes('rural')) return 90;
  const match = raw.match(/^(\d+)/);
  if (!match) return undefined;
  const val = parseInt(match[1], 10);
  return lower.includes('mph') ? Math.round(val * 1.609) : val;
}

// Road noise model (dB Leq) by highway type — WHO road traffic noise estimates
const ROAD_NOISE_DB: Record<string, number> = {
  motorway:     76,
  trunk:        73,
  primary:      69,
  secondary:    65,
  tertiary:     61,
  unclassified: 57,
  residential:  54,
  service:      49,
  living_street: 44,
  pedestrian:   37,
  footway:      32,
  cycleway:     30,
};

function scoreNoiseEnvironment(avgDb: number): number {
  // WHO guideline: <53 dB daytime recommended for residential areas
  if (avgDb <= 44) return 10;  // living streets / pedestrian zones
  if (avgDb <= 49) return 9;   // very quiet service/residential mix
  if (avgDb <= 54) return 8;   // quiet residential
  if (avgDb <= 57) return 6;   // mixed residential/unclassified
  if (avgDb <= 61) return 5;   // tertiary roads mixed in
  if (avgDb <= 65) return 3;   // secondary roads dominant
  if (avgDb <= 70) return 2;   // primary/trunk arteries
  return 1;                    // motorway/expressway
}

function scoreSpeedEnvironment(avgKmh: number, lowSpeedPct: number): number {
  let base: number;
  if (avgKmh <= 15)      base = 10;
  else if (avgKmh <= 25) base = 9;
  else if (avgKmh <= 30) base = 8;
  else if (avgKmh <= 35) base = 7;
  else if (avgKmh <= 40) base = 6;
  else if (avgKmh <= 45) base = 5;
  else if (avgKmh <= 50) base = 4;
  else if (avgKmh <= 60) base = 2;
  else                   base = 1;
  // Bonus when most of the network is genuinely calm
  if (lowSpeedPct >= 80) return Math.min(10, base + 1);
  return base;
}

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

  // Speed + noise environment: single loop over all street ways
  let speedLengthTotal = 0;
  let speedWeightedSum = 0;
  let lowSpeedLength = 0; // ≤30 km/h
  let noiseWeightedSum = 0;
  // OSM lit tag tracking
  let litYes = 0, litNo = 0, litTagged = 0;

  for (const way of streetWays) {
    let wayLen = 0;
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const a = nodes.get(way.nodes[i].toString());
      const b = nodes.get(way.nodes[i + 1].toString());
      if (a && b) wayLen += haversineM(a.lat, a.lon, b.lat, b.lon);
    }
    const hwType = way.tags?.highway ?? 'unclassified';
    const speed = parseMaxspeedKmh(way.tags?.maxspeed) ?? HIGHWAY_DEFAULT_SPEED[hwType] ?? 50;
    const noiseDb = ROAD_NOISE_DB[hwType] ?? 57;

    speedLengthTotal += wayLen;
    speedWeightedSum += speed * wayLen;
    noiseWeightedSum += noiseDb * wayLen;
    if (speed <= 30) lowSpeedLength += wayLen;

    // OSM lit tag (count ways, not length — proxy for street coverage)
    const lit = way.tags?.lit;
    if (lit) {
      litTagged++;
      if (lit === 'yes') litYes++;
      else if (lit === 'no') litNo++;
    }
  }

  const avgSpeedKmh = speedLengthTotal > 0 ? Math.round(speedWeightedSum / speedLengthTotal) : 50;
  const lowSpeedPct = speedLengthTotal > 0 ? Math.round((lowSpeedLength / speedLengthTotal) * 100) : 0;
  const avgNoiseDb = speedLengthTotal > 0 ? Math.round(noiseWeightedSum / speedLengthTotal) : 60;

  // OSM lit fallback: use only if ≥30% of ways have lit tags
  let osmLitScore: number | null = null;
  if (streetWays.length > 0 && litTagged / streetWays.length >= 0.3) {
    const litPct = litTagged > 0 ? litYes / litTagged : 0;
    if (litPct >= 0.9) osmLitScore = 9;
    else if (litPct >= 0.75) osmLitScore = 8;
    else if (litPct >= 0.6) osmLitScore = 6;
    else if (litPct >= 0.4) osmLitScore = 4;
    else if (litPct >= 0.2) osmLitScore = 3;
    else osmLitScore = 2;
  }

  // ── Betweenness Centrality (Brandes' algorithm on junction graph) ──
  // Junction nodes = intersections (degree ≥ 3) + dead-ends (degree 1)
  // We collapse internal way nodes (degree 2) into weighted edges between junctions.
  const junctionIds = new Set<string>();
  for (const [nodeId, deg] of nodeDegree) {
    if (deg !== 2) junctionIds.add(nodeId);
  }

  // Build weighted adjacency list between junction nodes
  const adj = new Map<string, Map<string, number>>(); // nodeId → { neighborId → distance }
  for (const way of streetWays) {
    const wayNodes: string[] = way.nodes.map((n: number) => n.toString());
    // Walk through way, accumulating distance between consecutive junction nodes
    let lastJunction: string | null = null;
    let distSinceJunction = 0;
    for (let i = 0; i < wayNodes.length; i++) {
      if (i > 0) {
        const a = nodes.get(wayNodes[i - 1]);
        const b = nodes.get(wayNodes[i]);
        if (a && b) distSinceJunction += haversineM(a.lat, a.lon, b.lat, b.lon);
      }
      if (junctionIds.has(wayNodes[i])) {
        if (lastJunction !== null && lastJunction !== wayNodes[i] && distSinceJunction > 0) {
          // Add edge (keep shortest if multiple ways connect same junctions)
          if (!adj.has(lastJunction)) adj.set(lastJunction, new Map());
          if (!adj.has(wayNodes[i])) adj.set(wayNodes[i], new Map());
          const existing1 = adj.get(lastJunction)!.get(wayNodes[i]);
          if (existing1 === undefined || distSinceJunction < existing1) {
            adj.get(lastJunction)!.set(wayNodes[i], distSinceJunction);
            adj.get(wayNodes[i])!.set(lastJunction, distSinceJunction);
          }
        }
        lastJunction = wayNodes[i];
        distSinceJunction = 0;
      }
    }
  }

  // Brandes' algorithm for betweenness centrality (unweighted BFS variant for speed)
  const jNodes = Array.from(adj.keys());
  const n = jNodes.length;
  const bc = new Map<string, number>();
  for (const id of jNodes) bc.set(id, 0);

  if (n >= 3) {
    for (const s of jNodes) {
      const stack: string[] = [];
      const pred = new Map<string, string[]>();
      const sigma = new Map<string, number>();
      const dist = new Map<string, number>();
      const delta = new Map<string, number>();

      for (const v of jNodes) {
        pred.set(v, []);
        sigma.set(v, 0);
        dist.set(v, -1);
        delta.set(v, 0);
      }
      sigma.set(s, 1);
      dist.set(s, 0);

      const queue: string[] = [s];
      let qi = 0;
      while (qi < queue.length) {
        const v = queue[qi++];
        stack.push(v);
        const neighbors = adj.get(v);
        if (!neighbors) continue;
        for (const w of neighbors.keys()) {
          if (dist.get(w)! < 0) {
            dist.set(w, dist.get(v)! + 1);
            queue.push(w);
          }
          if (dist.get(w) === dist.get(v)! + 1) {
            sigma.set(w, sigma.get(w)! + sigma.get(v)!);
            pred.get(w)!.push(v);
          }
        }
      }

      while (stack.length > 0) {
        const w = stack.pop()!;
        for (const v of pred.get(w)!) {
          delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
        }
        if (w !== s) {
          bc.set(w, bc.get(w)! + delta.get(w)!);
        }
      }
    }

    // Normalize: divide by (n-1)(n-2) for undirected graph
    const normFactor = (n - 1) * (n - 2);
    if (normFactor > 0) {
      for (const id of jNodes) {
        bc.set(id, bc.get(id)! / normFactor);
      }
    }
  }

  // Compute summary statistics
  let betweennessCentrality: NetworkGraph['betweennessCentrality'];
  if (n >= 3) {
    const values = Array.from(bc.values());
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    // Gini coefficient
    const sorted = [...values].sort((a, b) => a - b);
    let giniNum = 0;
    for (let i = 0; i < sorted.length; i++) {
      giniNum += (2 * (i + 1) - sorted.length - 1) * sorted[i];
    }
    const giniDen = sorted.length * sorted.reduce((a, b) => a + b, 0);
    const gini = giniDen > 0 ? giniNum / giniDen : 0;
    betweennessCentrality = {
      mean: Math.round(mean * 10000) / 10000,
      max: Math.round(max * 10000) / 10000,
      gini: Math.round(gini * 1000) / 1000,
    };
  }

  const networkGraph: NetworkGraph = {
    intersections,
    deadEnds,
    totalStreetLengthKm,
    areaKm2,
    averageBlockLengthM,
    speedEnvironment: {
      score: scoreSpeedEnvironment(avgSpeedKmh, lowSpeedPct),
      avgSpeedKmh,
      lowSpeedPct,
    },
    noiseEnvironment: {
      score: scoreNoiseEnvironment(avgNoiseDb),
      avgNoiseDb,
    },
    osmLitScore,
    betweennessCentrality,
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
    rawElements: data.elements,
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
