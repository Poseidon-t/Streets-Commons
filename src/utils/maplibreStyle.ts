/**
 * MapLibre GL style for SafeStreets — adapted from TerraInk (MIT).
 * Uses OpenFreeMap vector tiles (free, no API key required).
 */
import type { StyleSpecification } from 'maplibre-gl';

// ── Inline blendHex (from TerraInk shared/utils/color) ───────────────────────
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let n = hex.trim().replace('#', '');
  if (n.length === 3) n = n.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return null;
  const v = parseInt(n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function blendHex(hexA: string, hexB: string, weight = 0.5): string {
  const a = parseHex(hexA), b = parseHex(hexB);
  if (!a || !b) return hexA || hexB || '#888888';
  const t = Math.min(Math.max(weight, 0), 1);
  const mix = (x: number, y: number) => Math.round(x * (1 - t) + y * t).toString(16).padStart(2, '0');
  return `#${mix(a.r, b.r)}${mix(a.g, b.g)}${mix(a.b, b.b)}`;
}

// ── Theme type ────────────────────────────────────────────────────────────────
export interface MapTheme {
  map: {
    land: string; water: string; waterway: string;
    parks: string; buildings: string; aeroway: string; rail: string;
    roads: {
      major: string; minor_high: string; minor_mid: string;
      minor_low: string; path: string; outline: string;
    };
  };
  ui: { bg: string; text: string };
}

// ── Constants (overzoom = 1 for live map, no scaling needed) ──────────────────
const OPENFREEMAP_SOURCE = 'https://tiles.openfreemap.org/planet';
const SOURCE_ID = 'openfreemap';
const SOURCE_MAX_ZOOM = 14;
const BUILDING_BLEND_FACTOR = 0.14;
const BUILDING_FILL_OPACITY = 0.84;

const MAP_ROAD_MAJOR_CLASSES = ['motorway'];
const MAP_ROAD_MINOR_HIGH_CLASSES = ['primary','primary_link','secondary','secondary_link','motorway_link','trunk','trunk_link'];
const MAP_ROAD_MINOR_MID_CLASSES = ['tertiary','tertiary_link','minor'];
const MAP_ROAD_MINOR_LOW_CLASSES = ['residential','living_street','unclassified','road','street','street_limited','service'];
const MAP_ROAD_PATH_CLASSES = ['path','pedestrian','cycleway','track'];
const MAP_RAIL_CLASSES = ['rail','transit'];

const MAP_WATERWAY_WIDTH_STOPS: [number,number][] = [[0,.2],[6,.34],[12,.8],[18,2.4]];
const MAP_RAIL_WIDTH_STOPS: [number,number][] = [[3,.4],[6,.7],[10,1],[18,1.5]];
const MAP_ROAD_MINOR_HIGH_OVERVIEW: [number,number][] = [[0,.1],[4,.18],[8,.3],[11,.46]];
const MAP_ROAD_MINOR_MID_OVERVIEW: [number,number][] = [[0,.08],[4,.14],[8,.24],[11,.36]];
const MAP_ROAD_MINOR_LOW_OVERVIEW: [number,number][] = [[0,.06],[4,.1],[8,.18],[11,.3]];
const MAP_ROAD_MINOR_HIGH_DETAIL: [number,number][] = [[6,.46],[10,.8],[14,1.48],[18,2.7]];
const MAP_ROAD_MINOR_MID_DETAIL: [number,number][] = [[6,.34],[10,.62],[14,1.2],[18,2.35]];
const MAP_ROAD_MINOR_LOW_DETAIL: [number,number][] = [[6,.24],[10,.44],[14,.84],[18,1.65]];
const MAP_ROAD_PATH_OVERVIEW: [number,number][] = [[5,.06],[8,.1],[11,.2]];
const MAP_ROAD_PATH_DETAIL: [number,number][] = [[8,.2],[12,.42],[16,.85],[18,1.3]];
const MAP_ROAD_MAJOR_WIDTH: [number,number][] = [[0,.36],[3,.52],[9,1.1],[14,2.05],[18,3.3]];

function widthExpr(stops: [number,number][]): any {
  return ['interpolate',['linear'],['zoom'],...stops.flat()];
}
function opacityExpr(stops: [number,number][]): any {
  return ['interpolate',['linear'],['zoom'],...stops.flat()];
}
function scaled(stops: [number,number][], s: number): [number,number][] {
  return stops.map(([z,w]) => [z, w * s]);
}
function lineFilter(classes: string[]): any {
  return ['all',['match',['geometry-type'],['LineString','MultiLineString'],true,false],['match',['get','class'],classes,true,false]];
}

// ── Main style generator ──────────────────────────────────────────────────────
export function generateMapStyle(theme: MapTheme): StyleSpecification {
  const buildingFill = theme.map.buildings ||
    blendHex(theme.map.land || '#ffffff', theme.ui.text || '#111111', BUILDING_BLEND_FACTOR);

  const majorCasing = scaled(MAP_ROAD_MAJOR_WIDTH, 1.38);
  const minorHighCasing = scaled(MAP_ROAD_MINOR_HIGH_DETAIL, 1.45);
  const minorMidCasing = scaled(MAP_ROAD_MINOR_MID_DETAIL, 1.15);
  const pathCasing = scaled(MAP_ROAD_PATH_DETAIL, 1.6);

  return {
    version: 8,
    sources: {
      [SOURCE_ID]: { type: 'vector', url: OPENFREEMAP_SOURCE, maxzoom: SOURCE_MAX_ZOOM },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': theme.map.land } },

      // Parks
      { id: 'park', source: SOURCE_ID, 'source-layer': 'park', type: 'fill', paint: { 'fill-color': theme.map.parks } },

      // Water
      { id: 'water', source: SOURCE_ID, 'source-layer': 'water', type: 'fill', paint: { 'fill-color': theme.map.water } },
      { id: 'waterway', source: SOURCE_ID, 'source-layer': 'waterway', type: 'line',
        filter: lineFilter(['river','canal','stream','ditch']),
        paint: { 'line-color': theme.map.waterway, 'line-width': widthExpr(MAP_WATERWAY_WIDTH_STOPS) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },

      // Aeroway
      { id: 'aeroway', source: SOURCE_ID, 'source-layer': 'aeroway', type: 'fill',
        filter: ['match',['geometry-type'],['MultiPolygon','Polygon'],true,false],
        paint: { 'fill-color': theme.map.aeroway, 'fill-opacity': 0.85 } },

      // Buildings
      { id: 'building', source: SOURCE_ID, 'source-layer': 'building', type: 'fill', minzoom: 8,
        paint: { 'fill-color': buildingFill, 'fill-opacity': BUILDING_FILL_OPACITY } },

      // Rail
      { id: 'rail', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        filter: lineFilter(MAP_RAIL_CLASSES),
        paint: { 'line-color': theme.map.rail, 'line-width': widthExpr(MAP_RAIL_WIDTH_STOPS),
          'line-opacity': opacityExpr([[0,.56],[12,.62],[18,.72]]), 'line-dasharray': [2,1.6] },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },

      // Road overview (thin lines at low zoom)
      { id: 'road-minor-overview-high', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 0, maxzoom: 11.8, filter: lineFilter(MAP_ROAD_MINOR_HIGH_CLASSES),
        paint: { 'line-color': theme.map.roads.minor_high, 'line-width': widthExpr(MAP_ROAD_MINOR_HIGH_OVERVIEW),
          'line-opacity': opacityExpr([[0,.66],[8,.76],[12,0]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-overview-mid', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 0, maxzoom: 11.8, filter: lineFilter(MAP_ROAD_MINOR_MID_CLASSES),
        paint: { 'line-color': theme.map.roads.minor_mid, 'line-width': widthExpr(MAP_ROAD_MINOR_MID_OVERVIEW),
          'line-opacity': opacityExpr([[0,.46],[8,.56],[12,0]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-overview-low', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 0, maxzoom: 11.8, filter: lineFilter(MAP_ROAD_MINOR_LOW_CLASSES),
        paint: { 'line-color': theme.map.roads.minor_low, 'line-width': widthExpr(MAP_ROAD_MINOR_LOW_OVERVIEW),
          'line-opacity': opacityExpr([[0,.26],[8,.34],[12,0]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-path-overview', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 5, maxzoom: 11.8, filter: lineFilter(MAP_ROAD_PATH_CLASSES),
        paint: { 'line-color': theme.map.roads.path, 'line-width': widthExpr(MAP_ROAD_PATH_OVERVIEW),
          'line-opacity': opacityExpr([[5,.45],[9,.58],[12,0]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },

      // Road casings
      { id: 'road-major-casing', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        filter: lineFilter(MAP_ROAD_MAJOR_CLASSES),
        paint: { 'line-color': theme.map.roads.outline, 'line-width': widthExpr(majorCasing), 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-high-casing', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 6, filter: lineFilter(MAP_ROAD_MINOR_HIGH_CLASSES),
        paint: { 'line-color': theme.map.roads.outline, 'line-width': widthExpr(minorHighCasing),
          'line-opacity': opacityExpr([[6,.72],[12,.85],[18,.92]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-mid-casing', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 6, filter: lineFilter(MAP_ROAD_MINOR_MID_CLASSES),
        paint: { 'line-color': theme.map.roads.outline, 'line-width': widthExpr(minorMidCasing),
          'line-opacity': opacityExpr([[6,.42],[12,.56],[18,.66]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-path-casing', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 8, filter: lineFilter(MAP_ROAD_PATH_CLASSES),
        paint: { 'line-color': theme.map.roads.outline, 'line-width': widthExpr(pathCasing),
          'line-opacity': opacityExpr([[8,.62],[12,.72],[18,.85]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },

      // Roads
      { id: 'road-major', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        filter: lineFilter(MAP_ROAD_MAJOR_CLASSES),
        paint: { 'line-color': theme.map.roads.major, 'line-width': widthExpr(MAP_ROAD_MAJOR_WIDTH) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-high', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 6, filter: lineFilter(MAP_ROAD_MINOR_HIGH_CLASSES),
        paint: { 'line-color': theme.map.roads.minor_high, 'line-width': widthExpr(MAP_ROAD_MINOR_HIGH_DETAIL),
          'line-opacity': opacityExpr([[6,.84],[10,.92],[18,1]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-mid', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 6, filter: lineFilter(MAP_ROAD_MINOR_MID_CLASSES),
        paint: { 'line-color': theme.map.roads.minor_mid, 'line-width': widthExpr(MAP_ROAD_MINOR_MID_DETAIL),
          'line-opacity': opacityExpr([[6,.62],[10,.74],[18,.86]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-minor-low', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 6, filter: lineFilter(MAP_ROAD_MINOR_LOW_CLASSES),
        paint: { 'line-color': theme.map.roads.minor_low, 'line-width': widthExpr(MAP_ROAD_MINOR_LOW_DETAIL),
          'line-opacity': opacityExpr([[6,.34],[10,.46],[18,.58]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-path', source: SOURCE_ID, 'source-layer': 'transportation', type: 'line',
        minzoom: 8, filter: lineFilter(MAP_ROAD_PATH_CLASSES),
        paint: { 'line-color': theme.map.roads.path, 'line-width': widthExpr(MAP_ROAD_PATH_DETAIL),
          'line-opacity': opacityExpr([[8,.7],[12,.82],[18,.95]]) },
        layout: { 'line-cap': 'round', 'line-join': 'round' } },
    ],
  };
}
