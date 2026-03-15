import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { searchAddress } from '../services/nominatim';
import { fetchOSMData } from '../services/overpass';
import { calculateMetrics } from '../utils/metrics';
import { calculateCompositeScore } from '../utils/compositeScore';
import { fetchNDVI, scoreTreeCanopy } from '../services/treecanopy';
import type { Location, OSMData } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface StreetSegment {
  x1: number; y1: number; x2: number; y2: number;
  highway?: string;
  lanes?: number;
  name?: string;
}

interface StreetLabel {
  name: string;
  x: number; y: number;
  angle: number; // degrees
}

interface WaterFeature {
  type: 'polygon' | 'line';
  points: Array<{ x: number; y: number }>;
  waterType?: string;
  name?: string;
}

interface PolygonFeature {
  points: Array<{ x: number; y: number }>;
  type?: string;
  name?: string;
}

interface PointFeature {
  x: number; y: number;
  type?: string;
  name?: string;
}

interface MapData {
  name: string;
  address: string;
  score: number;
  streets: StreetSegment[];
  streetLabels: StreetLabel[];
  buildings: PolygonFeature[];
  parks: PolygonFeature[];
  water: WaterFeature[];
  trees: PointFeature[];
  crossings: PointFeature[];
  transit: PointFeature[];
  pois: PointFeature[];
  // Geo info for measurements
  metersPerPx: number;
}

// ─── Historical map palette ─────────────────────────────────────────────────────

const PARCHMENT  = '#f4edd4';
const PARCHMENT2 = '#ede4c8';
const SEPIA      = '#3d2b1f';
const SEPIA_MED  = '#6b5344';
const SEPIA_LT   = '#8b7355';
const ROAD_FILL  = '#e8dfc4';
const BLDG_FILL  = '#d4c9ad';
const BLDG_STROKE= '#6b5344';
const PARK_FILL  = '#c5d4a0';
const PARK_STROKE= '#5a6e3a';
const WATER_FILL = '#a3c4d9';
const WATER_STROKE= '#5a7d96';
const TREE_FILL  = '#b5c78a';
const TREE_STROKE= '#5a6e3a';

// Street widths by highway type
const HW_WIDTH: Record<string, number> = {
  trunk: 3.0, primary: 2.4, secondary: 1.8, tertiary: 1.4,
  residential: 0.9, unclassified: 0.9, living_street: 0.7,
  service: 0.5, footway: 0.3, pedestrian: 0.8,
};

function getStreetWidth(seg: StreetSegment): number {
  if (seg.lanes && seg.lanes >= 4) return 3.0;
  if (seg.lanes && seg.lanes >= 3) return 2.2;
  return HW_WIDTH[seg.highway || ''] ?? 0.8;
}

// Road casing (thicker behind actual road for border effect)
function getRoadCasingWidth(seg: StreetSegment): number {
  return getStreetWidth(seg) + 1.0;
}

// ─── Canvas constants ───────────────────────────────────────────────────────────

const MAP_W = 800;
const MAP_H = 800;
const FRAME = 40;     // ornamental border width
const INNER_W = MAP_W - FRAME * 2;
const INNER_H = MAP_H - FRAME * 2;
const TITLE_H = 90;   // title cartouche height at bottom
const DRAW_W = INNER_W;
const DRAW_H = INNER_H - TITLE_H;
const DRAW_PAD = 20;

// ─── Projection ─────────────────────────────────────────────────────────────────

interface Bounds {
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
}

function createProjection(bounds: Bounds, padX = DRAW_PAD, padY = DRAW_PAD, w = DRAW_W - DRAW_PAD * 2, h = DRAW_H - DRAW_PAD * 2) {
  const latRange = bounds.maxLat - bounds.minLat || 0.001;
  const lonRange = bounds.maxLon - bounds.minLon || 0.001;
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const effLonRange = lonRange * lonScale;
  const scale = Math.min(w / effLonRange, h / latRange);
  const projW = effLonRange * scale;
  const projH = latRange * scale;
  const ox = padX + (w - projW) / 2;
  const oy = padY + (h - projH) / 2;

  // meters per pixel (approximate)
  const latMeters = latRange * 111320;
  const metersPerPx = latMeters / projH;

  const project = (lat: number, lon: number) => ({
    x: ox + (lon - bounds.minLon) * lonScale * scale,
    y: oy + (bounds.maxLat - lat) * scale,
  });

  return { project, metersPerPx };
}

// ─── Overpass polygon fetch ─────────────────────────────────────────────────────

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchSketchData(lat: number, lon: number, radius = 500): Promise<{
  buildings: Array<{ nodes: number[]; tags?: any }>;
  parks: Array<{ nodes: number[]; tags?: any }>;
  water: Array<{ nodes: number[]; tags?: any; type: string }>;
  waterways: Array<{ nodes: number[]; tags?: any }>;
  nodes: Map<string, { lat: number; lon: number }>;
}> {
  const query = `[out:json][timeout:20];
(
  way(around:${radius},${lat},${lon})["building"];
  way(around:${radius},${lat},${lon})["leisure"~"^(park|garden|playground)$"];
  way(around:${radius},${lat},${lon})["natural"="water"];
  way(around:${radius},${lat},${lon})["water"];
  way(around:${radius},${lat},${lon})["waterway"~"^(river|stream|canal)$"];
);
out body; >; out skel qt;`;

  const apiUrl = import.meta.env.VITE_API_URL || '';
  let data: any;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`${apiUrl}/api/overpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) { const json = await res.json(); data = json.data; }
    else throw new Error('proxy failed');
  } catch {
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(mirror, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        clearTimeout(t);
        if (res.ok) { data = await res.json(); break; }
      } catch { /* try next */ }
    }
  }

  const empty = { buildings: [] as any[], parks: [] as any[], water: [] as any[], waterways: [] as any[], nodes: new Map<string, { lat: number; lon: number }>() };
  if (!data) return empty;

  const elements = data.elements || [];
  const nodeMap = new Map<string, { lat: number; lon: number }>();
  for (const el of elements) {
    if (el.type === 'node' && el.lat !== undefined) {
      nodeMap.set(el.id.toString(), { lat: el.lat, lon: el.lon });
    }
  }

  const buildings: any[] = [], parks: any[] = [], water: any[] = [], waterways: any[] = [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.nodes || el.nodes.length < 2) continue;
    if (el.tags?.waterway) { waterways.push({ nodes: el.nodes, tags: el.tags }); continue; }
    if (el.nodes.length < 3) continue;
    if (el.tags?.natural === 'water' || el.tags?.water) water.push({ nodes: el.nodes, tags: el.tags, type: el.tags?.water || 'water' });
    else if (el.tags?.building) buildings.push({ nodes: el.nodes, tags: el.tags });
    else if (['park', 'garden', 'playground'].includes(el.tags?.leisure)) parks.push({ nodes: el.nodes, tags: el.tags });
  }

  return { buildings, parks, water, waterways, nodes: nodeMap };
}

// ─── Geometry extraction ────────────────────────────────────────────────────────

const MAJOR_HIGHWAYS = new Set(['primary', 'secondary', 'trunk']);

function extractMapData(
  osmData: OSMData,
  treeCanopyPct: number,
  sketchPolys: Awaited<ReturnType<typeof fetchSketchData>>,
  name: string,
  address: string,
  score: number,
): MapData {
  const nodes = osmData.nodes;

  // Bounding box
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const way of osmData.streets) {
    if (!way.nodes) continue;
    for (const nid of way.nodes) {
      const c = nodes.get(nid.toString());
      if (c) { minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat); minLon = Math.min(minLon, c.lon); maxLon = Math.max(maxLon, c.lon); }
    }
  }
  if (osmData.networkGraph?.intersections) {
    for (const ix of osmData.networkGraph.intersections) {
      minLat = Math.min(minLat, ix.lat); maxLat = Math.max(maxLat, ix.lat);
      minLon = Math.min(minLon, ix.lon); maxLon = Math.max(maxLon, ix.lon);
    }
  }

  if (!isFinite(minLat)) return { name, address, score, streets: [], streetLabels: [], buildings: [], parks: [], water: [], trees: [], crossings: [], transit: [], pois: [], metersPerPx: 1 };

  const margin = 0.05;
  const bounds: Bounds = {
    minLat: minLat - (maxLat - minLat) * margin,
    maxLat: maxLat + (maxLat - minLat) * margin,
    minLon: minLon - (maxLon - minLon) * margin,
    maxLon: maxLon + (maxLon - minLon) * margin,
  };

  const { project, metersPerPx } = createProjection(bounds);

  // Streets + street names
  const streets: StreetSegment[] = [];
  const streetNameMap = new Map<string, { segs: StreetSegment[]; midLat: number; midLon: number }>();

  for (const way of osmData.streets) {
    if (!way.nodes || way.nodes.length < 2) continue;
    const hw = way.tags?.highway;
    const lanes = way.tags?.lanes ? parseInt(way.tags.lanes, 10) : undefined;
    const streetName = way.tags?.name;

    const wayPoints: Array<{ x: number; y: number; lat: number; lon: number }> = [];
    for (const nid of way.nodes) {
      const c = nodes.get(nid.toString());
      if (c) { const p = project(c.lat, c.lon); wayPoints.push({ ...p, lat: c.lat, lon: c.lon }); }
    }

    for (let i = 0; i < wayPoints.length - 1; i++) {
      const a = wayPoints[i], b = wayPoints[i + 1];
      streets.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, highway: hw, lanes, name: streetName });
    }

    if (streetName && !streetNameMap.has(streetName) && wayPoints.length >= 2) {
      const mid = wayPoints[Math.floor(wayPoints.length / 2)];
      streetNameMap.set(streetName, { segs: [], midLat: mid.lat, midLon: mid.lon });
    }
    if (streetName && streetNameMap.has(streetName)) {
      for (let i = 0; i < wayPoints.length - 1; i++) {
        streetNameMap.get(streetName)!.segs.push({ x1: wayPoints[i].x, y1: wayPoints[i].y, x2: wayPoints[i + 1].x, y2: wayPoints[i + 1].y, highway: hw });
      }
    }
  }

  // Extract street labels  -  one per unique name, placed at midpoint with angle
  const streetLabels: StreetLabel[] = [];
  const placedLabelPositions: Array<{ x: number; y: number }> = [];

  for (const [sName, info] of streetNameMap.entries()) {
    // Find longest segment for this street
    let best = info.segs[0];
    let bestLen = 0;
    for (const s of info.segs) {
      const len = Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2);
      if (len > bestLen) { bestLen = len; best = s; }
    }
    if (bestLen < 20) continue; // Skip very short streets

    const mx = (best.x1 + best.x2) / 2;
    const my = (best.y1 + best.y2) / 2;

    // Check overlap with existing labels
    const tooClose = placedLabelPositions.some(p => Math.abs(p.x - mx) < 40 && Math.abs(p.y - my) < 12);
    if (tooClose) continue;

    // Angle along street
    let angle = Math.atan2(best.y2 - best.y1, best.x2 - best.x1) * (180 / Math.PI);
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;

    // Only label if within drawing area
    if (mx > 5 && mx < DRAW_W - 5 && my > 5 && my < DRAW_H - 5) {
      streetLabels.push({ name: sName, x: mx, y: my, angle });
      placedLabelPositions.push({ x: mx, y: my });
    }
  }

  // Helper to project polygon nodes from sketch data
  const projectPoly = (nodeIds: number[], nodeMap: Map<string, { lat: number; lon: number }>) => {
    const pts: Array<{ x: number; y: number }> = [];
    for (const nid of nodeIds) {
      const c = nodeMap.get(nid.toString());
      if (c) pts.push(project(c.lat, c.lon));
    }
    return pts;
  };

  // Buildings
  const buildings: PolygonFeature[] = sketchPolys.buildings
    .map(b => ({ points: projectPoly(b.nodes, sketchPolys.nodes), type: b.tags?.building, name: b.tags?.name }))
    .filter(b => b.points.length >= 3);

  // Parks
  const parks: PolygonFeature[] = sketchPolys.parks
    .map(p => ({ points: projectPoly(p.nodes, sketchPolys.nodes), type: p.tags?.leisure, name: p.tags?.name }))
    .filter(p => p.points.length >= 3);

  // Water
  const water: WaterFeature[] = [
    ...sketchPolys.water.map(w => ({ type: 'polygon' as const, points: projectPoly(w.nodes, sketchPolys.nodes), waterType: w.type, name: w.tags?.name })).filter(w => w.points.length >= 3),
    ...sketchPolys.waterways.map(w => ({ type: 'line' as const, points: projectPoly(w.nodes, sketchPolys.nodes), waterType: w.tags?.waterway, name: w.tags?.name })).filter(w => w.points.length >= 2),
  ];

  // Trees  -  sparse, along residential streets only
  const trees: PointFeature[] = [];
  const treeTarget = Math.max(3, Math.round((treeCanopyPct / 100) * 25));
  const treeCandidates: PointFeature[] = [];
  for (const seg of streets) {
    if (seg.highway === 'trunk' || seg.highway === 'primary') continue;
    const len = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
    if (len < 30) continue;
    const steps = Math.max(1, Math.floor(len / 55));
    for (let s = 1; s <= steps; s++) {
      const t = s / (steps + 1);
      const mx = seg.x1 + (seg.x2 - seg.x1) * t;
      const my = seg.y1 + (seg.y2 - seg.y1) * t;
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const norm = Math.sqrt(dx * dx + dy * dy) || 1;
      const side = s % 2 === 0 ? 1 : -1;
      const off = 6 + (s * 3) % 4;
      treeCandidates.push({ x: mx + (-dy / norm) * off * side, y: my + (dx / norm) * off * side });
    }
  }
  const shuffled = treeCandidates
    .filter(p => p.x >= 5 && p.x <= DRAW_W - 5 && p.y >= 5 && p.y <= DRAW_H - 5)
    .sort((a, b) => ((a.x * 73 + a.y * 37) % 1000) - ((b.x * 73 + b.y * 37) % 1000));
  for (const s of shuffled) {
    if (trees.length >= treeTarget) break;
    if (!trees.some(t => Math.abs(t.x - s.x) < 12 && Math.abs(t.y - s.y) < 12)) trees.push(s);
  }

  // Crossings
  const crossings: PointFeature[] = osmData.crossings
    .filter(cr => cr.lat != null && cr.lon != null)
    .map(cr => project(cr.lat!, cr.lon!));

  // Transit
  const transit: PointFeature[] = osmData.pois
    .filter(p => p.tags?.public_transport || p.tags?.highway === 'bus_stop' || p.tags?.railway)
    .map(p => ({ lat: p.lat ?? p.center?.lat, lon: p.lon ?? p.center?.lon, name: p.tags?.name }))
    .filter(p => p.lat != null && p.lon != null)
    .map(p => ({ ...project(p.lat!, p.lon!), name: p.name }));

  // POIs
  const pois: PointFeature[] = osmData.pois
    .filter(p => !p.tags?.public_transport && p.tags?.highway !== 'bus_stop' && !p.tags?.railway && p.tags?.leisure !== 'park' && p.tags?.leisure !== 'garden')
    .map(p => ({ lat: p.lat ?? p.center?.lat, lon: p.lon ?? p.center?.lon, type: p.tags?.amenity || p.tags?.shop, name: p.tags?.name }))
    .filter(p => p.lat != null && p.lon != null)
    .map(p => ({ ...project(p.lat!, p.lon!), type: p.type, name: p.name }));

  return { name, address, score, streets, streetLabels, buildings, parks, water, trees, crossings, transit, pois, metersPerPx };
}

// ─── SVG Map Components ─────────────────────────────────────────────────────────

function OrnamentalBorder() {
  // Outer frame with double-rule border like vintage survey maps
  return (
    <g>
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill={PARCHMENT} />
      {/* Outer rule */}
      <rect x={4} y={4} width={MAP_W - 8} height={MAP_H - 8} fill="none" stroke={SEPIA} strokeWidth={2} />
      {/* Inner rule */}
      <rect x={FRAME - 2} y={FRAME - 2} width={INNER_W + 4} height={INNER_H + 4} fill="none" stroke={SEPIA} strokeWidth={1} />
      {/* Corner ornaments */}
      {[[FRAME, FRAME], [MAP_W - FRAME, FRAME], [FRAME, MAP_H - FRAME], [MAP_W - FRAME, MAP_H - FRAME]].map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx},${cy})`}>
          <line x1={-8} y1={0} x2={8} y2={0} stroke={SEPIA} strokeWidth={1.5} />
          <line x1={0} y1={-8} x2={0} y2={8} stroke={SEPIA} strokeWidth={1.5} />
          <circle r={2} fill={SEPIA} />
        </g>
      ))}
      {/* Tick marks along edges (like survey gridlines) */}
      {Array.from({ length: 7 }).map((_, i) => {
        const t = (i + 1) / 8;
        return (
          <g key={`tick-${i}`}>
            <line x1={FRAME + t * INNER_W} y1={FRAME - 6} x2={FRAME + t * INNER_W} y2={FRAME} stroke={SEPIA} strokeWidth={0.5} />
            <line x1={FRAME + t * INNER_W} y1={MAP_H - FRAME} x2={FRAME + t * INNER_W} y2={MAP_H - FRAME + 6} stroke={SEPIA} strokeWidth={0.5} />
            <line x1={FRAME - 6} y1={FRAME + t * INNER_H} x2={FRAME} y2={FRAME + t * INNER_H} stroke={SEPIA} strokeWidth={0.5} />
            <line x1={MAP_W - FRAME} y1={FRAME + t * INNER_H} x2={MAP_W - FRAME + 6} y2={FRAME + t * INNER_H} stroke={SEPIA} strokeWidth={0.5} />
          </g>
        );
      })}
    </g>
  );
}

function CompassRose({ x, y, size = 28 }: { x: number; y: number; size?: number }) {
  const s = size;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={s + 4} fill={PARCHMENT} stroke={SEPIA} strokeWidth={0.5} />
      <circle r={s} fill="none" stroke={SEPIA} strokeWidth={0.6} />
      <circle r={s * 0.4} fill="none" stroke={SEPIA_LT} strokeWidth={0.3} />
      {/* Cardinal points */}
      <path d={`M 0,${-s * 0.9} L ${s * 0.12},${-s * 0.15} L 0,${-s * 0.25} L ${-s * 0.12},${-s * 0.15} Z`} fill={SEPIA} />
      <path d={`M 0,${s * 0.9} L ${s * 0.12},${s * 0.15} L 0,${s * 0.25} L ${-s * 0.12},${s * 0.15} Z`} fill="none" stroke={SEPIA} strokeWidth={0.5} />
      <path d={`M ${s * 0.9},0 L ${s * 0.15},${s * 0.12} L ${s * 0.25},0 L ${s * 0.15},${-s * 0.12} Z`} fill="none" stroke={SEPIA} strokeWidth={0.5} />
      <path d={`M ${-s * 0.9},0 L ${-s * 0.15},${s * 0.12} L ${-s * 0.25},0 L ${-s * 0.15},${-s * 0.12} Z`} fill="none" stroke={SEPIA} strokeWidth={0.5} />
      {/* Intercardinal lines */}
      {[45, 135, 225, 315].map(a => {
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={0} y1={0} x2={Math.cos(rad) * s * 0.6} y2={Math.sin(rad) * s * 0.6} stroke={SEPIA_LT} strokeWidth={0.4} />;
      })}
      {/* Labels */}
      <text y={-s - 6} textAnchor="middle" fontSize={8} fontWeight="bold" fill={SEPIA} fontFamily="Georgia, serif">N</text>
      <text y={s + 11} textAnchor="middle" fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif">S</text>
      <text x={s + 7} y={3} textAnchor="start" fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif">E</text>
      <text x={-s - 7} y={3} textAnchor="end" fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif">W</text>
      <circle r={2} fill={SEPIA} />
    </g>
  );
}

function ScaleBar({ x, y, metersPerPx }: { x: number; y: number; metersPerPx: number }) {
  // Pick a nice round distance for the scale bar
  const px100m = 100 / metersPerPx;
  let barMeters = 100;
  let barPx = px100m;
  if (barPx > 120) { barMeters = 50; barPx = 50 / metersPerPx; }
  if (barPx < 30) { barMeters = 200; barPx = 200 / metersPerPx; }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={-6} fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif" fontStyle="italic">Scale</text>
      <rect x={0} y={0} width={barPx / 2} height={4} fill={SEPIA} />
      <rect x={barPx / 2} y={0} width={barPx / 2} height={4} fill="none" stroke={SEPIA} strokeWidth={0.6} />
      <text x={0} y={12} fontSize={5.5} fill={SEPIA} fontFamily="Georgia, serif">0</text>
      <text x={barPx / 2} y={12} textAnchor="middle" fontSize={5.5} fill={SEPIA} fontFamily="Georgia, serif">{barMeters / 2}m</text>
      <text x={barPx} y={12} textAnchor="end" fontSize={5.5} fill={SEPIA} fontFamily="Georgia, serif">{barMeters}m</text>
    </g>
  );
}

function TitleCartouche({ name, address, score, dateStr }: { name: string; address: string; score: number; dateStr: string }) {
  const tier =
    score >= 8 ? 'WALKABLE' : score >= 6 ? 'MODERATE' : score >= 4 ? 'CAR-DEPENDENT' : score >= 2 ? 'DIFFICULT' : 'HOSTILE';
  const tierColor =
    score >= 8 ? '#2d6a2e' : score >= 6 ? '#5a6e3a' : score >= 4 ? '#8b7355' : '#8b4513';

  return (
    <g transform={`translate(${FRAME},${MAP_H - FRAME - TITLE_H})`}>
      {/* Cartouche box */}
      <rect width={INNER_W} height={TITLE_H} fill={PARCHMENT2} stroke={SEPIA} strokeWidth={1.5} />
      <line x1={0} y1={0} x2={INNER_W} y2={0} stroke={SEPIA} strokeWidth={2} />
      {/* Decorative rule */}
      <line x1={10} y1={5} x2={INNER_W - 10} y2={5} stroke={SEPIA_LT} strokeWidth={0.3} />

      {/* Left: Name + address */}
      <text x={16} y={30} fontSize={16} fontWeight="bold" fill={SEPIA} fontFamily="Georgia, serif" letterSpacing={1}>
        {name.toUpperCase()}
      </text>
      <text x={16} y={47} fontSize={8} fill={SEPIA_MED} fontFamily="Georgia, serif" fontStyle="italic">
        {address}
      </text>
      <text x={16} y={62} fontSize={6.5} fill={SEPIA_LT} fontFamily="Georgia, serif" letterSpacing={0.5}>
        WALKABILITY SURVEY  -  PLAN VIEW
      </text>
      <text x={16} y={76} fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif" letterSpacing={0.5}>
        SOURCE: OPENSTREETMAP / SENTINEL-2 IMAGERY
      </text>

      {/* Center: Score */}
      <line x1={340} y1={10} x2={340} y2={80} stroke={SEPIA_LT} strokeWidth={0.5} />
      <text x={420} y={38} textAnchor="middle" fontSize={32} fontWeight="bold" fill={SEPIA} fontFamily="Georgia, serif">
        {score.toFixed(1)}
      </text>
      <text x={420} y={52} textAnchor="middle" fontSize={7} fill={SEPIA_LT} fontFamily="Georgia, serif" letterSpacing={1}>
        WALKABILITY SCORE / 10
      </text>
      <text x={420} y={70} textAnchor="middle" fontSize={9} fontWeight="bold" fill={tierColor} fontFamily="Georgia, serif" letterSpacing={2}>
        {tier}
      </text>

      {/* Right: Attribution */}
      <line x1={500} y1={10} x2={500} y2={80} stroke={SEPIA_LT} strokeWidth={0.5} />
      <text x={INNER_W - 16} y={28} textAnchor="end" fontSize={11} fontWeight="bold" fill={SEPIA} fontFamily="Georgia, serif" letterSpacing={1}>
        SAFESTREETS
      </text>
      <text x={INNER_W - 16} y={43} textAnchor="end" fontSize={7} fill={SEPIA_MED} fontFamily="Georgia, serif" fontStyle="italic">
        Streets &amp; Commons
      </text>
      <text x={INNER_W - 16} y={58} textAnchor="end" fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif">
        safestreets.streetsandcommons.com
      </text>
      <text x={INNER_W - 16} y={72} textAnchor="end" fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif">
        {dateStr}
      </text>
    </g>
  );
}

// ─── Map SVG ────────────────────────────────────────────────────────────────────

function HistoricalMap({
  data,
  svgRef,
  zoom,
  pan,
}: {
  data: MapData;
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoom: number;
  pan: { x: number; y: number };
}) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase();

  // Compute the transform for zoom/pan on the drawing area
  const cx = DRAW_W / 2, cy = DRAW_H / 2;
  const tx = cx - (cx - pan.x) * zoom;
  const ty = cy - (cy - pan.y) * zoom;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      width={MAP_W}
      height={MAP_H}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      fontFamily="Georgia, serif"
    >
      {/* Parchment texture base */}
      <defs>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="4" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feBlend in="SourceGraphic" in2="gray" mode="multiply" />
        </filter>
      </defs>

      <OrnamentalBorder />

      {/* Drawing area with clip */}
      <defs>
        <clipPath id="map-clip">
          <rect x={FRAME} y={FRAME} width={INNER_W} height={DRAW_H} />
        </clipPath>
      </defs>

      <g clipPath="url(#map-clip)">
        <g transform={`translate(${FRAME},${FRAME})`}>
          {/* Zoom/pan transform */}
          <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
            {/* Road surface background */}
            <rect x={-50} y={-50} width={DRAW_W + 100} height={DRAW_H + 100} fill={PARCHMENT} />

            {/* Water features (lowest) */}
            {data.water.map((wf, i) => {
              if (wf.type === 'polygon') {
                const d = wf.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
                return <path key={`w-${i}`} d={d} fill={WATER_FILL} stroke={WATER_STROKE} strokeWidth={0.6 / zoom} strokeLinejoin="round" opacity={0.7} />;
              }
              const d = wf.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
              const sw = wf.waterType === 'river' ? 2.0 : wf.waterType === 'canal' ? 1.4 : 0.8;
              return <path key={`w-${i}`} d={d} fill="none" stroke={WATER_FILL} strokeWidth={sw / zoom} strokeLinecap="round" opacity={0.7} />;
            })}

            {/* Parks */}
            {data.parks.map((pk, i) => {
              const d = pk.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
              return (
                <g key={`pk-${i}`}>
                  <path d={d} fill={PARK_FILL} stroke={PARK_STROKE} strokeWidth={0.5 / zoom} strokeLinejoin="round" opacity={0.6} />
                  {/* Cross-hatch */}
                  <clipPath id={`pk-clip-${i}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#pk-clip-${i})`} opacity={0.08}>
                    {Array.from({ length: 15 }).map((_, j) => {
                      const cx = pk.points[0].x + j * 14 - 80;
                      return <line key={j} x1={cx} y1={pk.points[0].y - 80} x2={cx + 120} y2={pk.points[0].y + 40} stroke={PARK_STROKE} strokeWidth={0.5 / zoom} />;
                    })}
                  </g>
                </g>
              );
            })}

            {/* Road casings (thicker behind lines for that engraved look) */}
            {data.streets.map((seg, i) => (
              <line key={`rc-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                stroke={PARCHMENT2} strokeWidth={getRoadCasingWidth(seg) / zoom} strokeLinecap="round" />
            ))}

            {/* Street lines */}
            {data.streets.map((seg, i) => (
              <line key={`st-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                stroke={SEPIA} strokeWidth={getStreetWidth(seg) / zoom} strokeLinecap="round"
                opacity={seg.highway === 'footway' ? 0.3 : 0.7} />
            ))}

            {/* Buildings */}
            {data.buildings.map((b, i) => {
              const d = b.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
              return (
                <g key={`b-${i}`}>
                  <path d={d} fill={BLDG_FILL} stroke={BLDG_STROKE} strokeWidth={0.4 / zoom} strokeLinejoin="round" />
                </g>
              );
            })}

            {/* Trees */}
            {data.trees.map((t, i) => {
              const r = (3 + i % 2) / zoom;
              return (
                <g key={`tr-${i}`} transform={`translate(${t.x},${t.y})`}>
                  <circle r={r} fill={TREE_FILL} stroke={TREE_STROKE} strokeWidth={0.3 / zoom} opacity={0.7} />
                  <circle r={r * 0.3} fill={TREE_STROKE} opacity={0.3} />
                </g>
              );
            })}

            {/* Crossings */}
            {data.crossings.map((c, i) => (
              <g key={`cr-${i}`} transform={`translate(${c.x},${c.y})`}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <rect key={j} x={(-3 + j * 2.5) / zoom} y={-1.5 / zoom} width={1.5 / zoom} height={3 / zoom} fill={SEPIA_LT} opacity={0.4} />
                ))}
              </g>
            ))}

            {/* Transit stops */}
            {data.transit.map((t, i) => (
              <g key={`ts-${i}`} transform={`translate(${t.x},${t.y})`}>
                <circle r={4 / zoom} fill={PARCHMENT} stroke={SEPIA} strokeWidth={0.6 / zoom} />
                <circle r={1.5 / zoom} fill={SEPIA} />
              </g>
            ))}

            {/* POI dots */}
            {data.pois.slice(0, 15).map((p, i) => (
              <circle key={`poi-${i}`} cx={p.x} cy={p.y} r={1.5 / zoom} fill={SEPIA} opacity={0.35} />
            ))}

            {/* Street name labels */}
            {data.streetLabels.map((lbl, i) => (
              <g key={`lbl-${i}`} transform={`translate(${lbl.x},${lbl.y}) rotate(${lbl.angle})`}>
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={5 / zoom}
                  fill={SEPIA_MED}
                  fontFamily="Georgia, serif"
                  fontStyle="italic"
                  letterSpacing={0.8 / zoom}
                  opacity={0.75}
                  paintOrder="stroke"
                  stroke={PARCHMENT}
                  strokeWidth={2 / zoom}
                >
                  {lbl.name.toUpperCase()}
                </text>
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* Title cartouche (not affected by zoom) */}
      <TitleCartouche name={data.name} address={data.address} score={data.score} dateStr={dateStr} />

      {/* Compass rose (not affected by zoom) */}
      <CompassRose x={MAP_W - FRAME - 40} y={FRAME + 40} size={22} />

      {/* Scale bar (not affected by zoom) */}
      <ScaleBar x={FRAME + 12} y={MAP_H - FRAME - TITLE_H - 20} metersPerPx={data.metersPerPx / zoom} />

      {/* Zoom level indicator */}
      {zoom !== 1 && (
        <text x={MAP_W - FRAME - 10} y={MAP_H - FRAME - TITLE_H - 8} textAnchor="end" fontSize={6} fill={SEPIA_LT} fontFamily="Georgia, serif">
          {zoom.toFixed(1)}x
        </text>
      )}
    </svg>
  );
}

// ─── Address search bar ─────────────────────────────────────────────────────────

function AddressSearch({ onAnalyze, isAnalyzing }: { onAnalyze: (loc: Location) => void; isAnalyzing: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 3) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchAddress(query)); } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search any address..."
        disabled={isAnalyzing}
        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-400 disabled:opacity-50"
        style={{ fontFamily: 'Georgia, serif' }}
      />
      {searching && (
        <div className="absolute right-3 top-3.5">
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((loc, i) => (
            <button key={i}
              onClick={() => { onAnalyze(loc); setQuery(loc.displayName.split(',').slice(0, 2).join(',')); setResults([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
            >
              {loc.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function SketchGenerator() {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, px: 0, py: 0 });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.5, Math.min(5, z * delta)));
  }, []);

  // Pan with mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: pan.x, y: pan.y, px: e.clientX, py: e.clientY });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = (e.clientX - panStart.px) / zoom;
    const dy = (e.clientY - panStart.py) / zoom;
    setPan({ x: panStart.x + dx, y: panStart.y + dy });
  }, [isPanning, panStart, zoom]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  async function analyzeLocation(loc: Location) {
    setIsAnalyzing(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAnalysisStatus('Fetching street network & buildings...');

    try {
      const [osmData, sketchPolys] = await Promise.all([
        fetchOSMData(loc.lat, loc.lon),
        fetchSketchData(loc.lat, loc.lon, 500).catch(() => ({ buildings: [], parks: [], water: [], waterways: [], nodes: new Map<string, { lat: number; lon: number }>() })),
      ]);

      const metrics = calculateMetrics(osmData, loc.lat, loc.lon);
      setAnalysisStatus('Computing walkability score...');

      let treeCanopyScore = metrics.treeCanopy;
      try {
        setAnalysisStatus('Reading satellite imagery...');
        const ndvi = await fetchNDVI(loc.lat, loc.lon);
        if (ndvi !== null) treeCanopyScore = scoreTreeCanopy(ndvi);
      } catch { /* use OSM-derived */ }

      const composite = calculateCompositeScore({
        legacy: { ...metrics, treeCanopy: treeCanopyScore },
        networkGraph: osmData.networkGraph,
      });

      setAnalysisStatus('Rendering map...');
      const treeCanopyPct = Math.round(treeCanopyScore * 10);
      const shortName = loc.displayName.split(',')[0].trim();
      const shortAddr = loc.displayName.split(',').slice(0, 3).join(',').trim();
      const score = Math.round((composite.overallScore / 10) * 10) / 10;

      const data = extractMapData(osmData, treeCanopyPct, sketchPolys, shortName, shortAddr, score);
      setMapData(data);
      setAnalysisStatus(null);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysisStatus('Analysis failed  -  please try again');
      setTimeout(() => setAnalysisStatus(null), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // ── Export functions ──

  function getSvgDataUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!svgRef.current) return reject('No SVG');
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement('canvas');
      canvas.width = MAP_W * 3;
      canvas.height = MAP_H * 3;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, MAP_W * 3, MAP_H * 3); resolve(canvas.toDataURL('image/png')); };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  }

  function getFileName(ext: string) {
    return `${(mapData?.name || 'sketch').toLowerCase().replace(/\s+/g, '-')}-walkability-map.${ext}`;
  }

  async function exportPNG() {
    try { const url = await getSvgDataUrl(); const a = document.createElement('a'); a.href = url; a.download = getFileName('png'); a.click(); }
    catch (e) { console.error('PNG export failed:', e); }
  }

  function exportSVG() {
    if (!svgRef.current) return;
    const data = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = getFileName('svg'); a.click();
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard() {
    try {
      const dataUrl = await getSvgDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback('Copy failed');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }

  async function shareSketch() {
    try {
      const dataUrl = await getSvgDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], getFileName('png'), { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${mapData?.name}  -  Walkability Map`,
          text: `${mapData?.name} scored ${mapData?.score.toFixed(1)}/10 on walkability. Generated by SafeStreets.`,
          files: [file],
        });
      } else {
        await copyToClipboard();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Share failed:', err);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold" style={{ color: SEPIA, fontFamily: 'Georgia, serif' }}>
          Neighborhood Map
        </h1>
        <p className="text-sm mt-1" style={{ color: SEPIA_LT, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          Historical-style walkability maps from real urban data
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <AddressSearch onAnalyze={analyzeLocation} isAnalyzing={isAnalyzing} />
        {isAnalyzing && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: SEPIA_LT }}>{analysisStatus}</span>
          </div>
        )}
        {analysisStatus && !isAnalyzing && (
          <p className="mt-2 text-sm text-center text-red-500">{analysisStatus}</p>
        )}
      </div>

      {/* Map */}
      {mapData && (
        <div className="space-y-4">
          <div
            ref={mapContainerRef}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 overflow-hidden"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <HistoricalMap data={mapData} svgRef={svgRef} zoom={zoom} pan={pan} />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setZoom(z => Math.max(0.5, z * 0.8))}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-mono">
              -
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
              style={{ fontFamily: 'Georgia, serif' }}>
              {Math.round(zoom * 100)}%  -  Reset
            </button>
            <button onClick={() => setZoom(z => Math.min(5, z * 1.2))}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-mono">
              +
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={exportPNG}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
              style={{ backgroundColor: '#e07850' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PNG
            </button>
            <button onClick={copyToClipboard}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] border-2"
              style={{ borderColor: '#e07850', color: '#e07850' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copyFeedback || 'Copy'}
            </button>
            <button onClick={shareSketch}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>

          <div className="text-center">
            <button onClick={exportSVG} className="text-xs underline underline-offset-2 transition-colors" style={{ color: SEPIA_LT }}>
              Download as SVG vector
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!mapData && !isAnalyzing && (
        <div className="rounded-xl shadow-sm border border-gray-100 p-16 text-center" style={{ backgroundColor: PARCHMENT }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={SEPIA_LT} strokeWidth="1" className="mx-auto mb-4 opacity-40">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 3v18" />
          </svg>
          <p style={{ color: SEPIA_LT, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            Search any address to generate a historical walkability map
          </p>
        </div>
      )}
    </div>
  );
}
