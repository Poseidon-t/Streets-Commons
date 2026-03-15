import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location, OSMData } from '../types';
import type { MapGeometry } from '../services/overpass';
import { ANALYSIS_RADIUS, COLORS } from '../constants';
import { generateMapStyle } from '../utils/maplibreStyle';

// ── SafeStreets earth-tone theme ─────────────────────────────────────────────
const THEME = {
  ui: { bg: '#f8f6f1', text: '#1a2a1a' },
  map: {
    land: '#f0ece3',
    water: '#c5dce8',
    waterway: '#a8c4d8',
    parks: '#d4e8c8',
    buildings: '#e4ddd0',
    aeroway: '#e8e4d8',
    rail: '#8a9a8a',
    roads: {
      major: '#a89878',
      minor_high: '#b8a888',
      minor_mid: '#c8b898',
      minor_low: '#d0c4a8',
      path: '#c8c0b0',
      outline: '#e8e2d6',
    },
  },
};

interface MapProps {
  location: Location | null;
  osmData?: OSMData | null;
  mapGeometry?: MapGeometry | null;
  seamless?: boolean;
}

/** Create a pulsing location marker element */
function createPulsingMarker(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:40px;height:40px';
  // Pulse ring
  const pulse = document.createElement('div');
  pulse.style.cssText = `position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;background:${COLORS.accent};opacity:0;animation:marker-pulse 2s ease-out infinite`;
  el.appendChild(pulse);
  // Core dot
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;top:10px;left:10px;width:20px;height:20px;background:${COLORS.accent};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)`;
  el.appendChild(dot);
  return el;
}

/** Approximate a geodesic circle as a closed GeoJSON polygon */
function circlePolygon(lat: number, lon: number, radiusM: number) {
  const R = 6371000;
  const n = 64;
  const coords = Array.from({ length: n + 1 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / n;
    const dLat = (radiusM / R) * (180 / Math.PI);
    const dLon = dLat / Math.cos((lat * Math.PI) / 180);
    return [lon + dLon * Math.sin(angle), lat + dLat * Math.cos(angle)];
  });
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Map({ location, osmData, mapGeometry, seamless }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Keep refs current so the load callback always sees latest props
  const locationRef = useRef(location);
  const osmDataRef = useRef(osmData);
  const geometryRef = useRef(mapGeometry);
  locationRef.current = location;
  osmDataRef.current = osmData;
  geometryRef.current = mapGeometry;

  // Push current data into MapLibre GeoJSON sources
  function applyOverlays(map: maplibregl.Map) {
    const loc = locationRef.current;
    const data = osmDataRef.current;

    const radiusSrc = map.getSource('radius') as maplibregl.GeoJSONSource | undefined;
    if (radiusSrc) {
      radiusSrc.setData(
        loc ? circlePolygon(loc.lat, loc.lon, ANALYSIS_RADIUS)
            : { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] }, properties: {} }
      );
    }

    const crossingsSrc = map.getSource('crossings') as maplibregl.GeoJSONSource | undefined;
    if (crossingsSrc) {
      const crossings = (data?.crossings ?? []).filter((c: any) => c.lat && c.lon);
      crossingsSrc.setData({
        type: 'FeatureCollection',
        features: crossings.map((c: any) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: {},
        })),
      });
    }

  }

  // Haversine distance in meters between two [lon, lat] points
  function distanceM(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLon = (b[0] - a[0]) * Math.PI / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const h = sinLat * sinLat + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * sinLon * sinLon;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Centroid of a polygon ring [[lon, lat], ...]
  function centroid(ring: [number, number][]): [number, number] {
    let lon = 0, lat = 0;
    const n = ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1] ? ring.length - 1 : ring.length;
    for (let i = 0; i < n; i++) { lon += ring[i][0]; lat += ring[i][1]; }
    return [lon / n, lat / n];
  }

  // Color based on distance to nearest crossing: green (close) → amber → terra (far)
  function crossingProximityColor(dist: number): string {
    if (dist < 100) return '#7ab87a'; // sage green — safe crossing nearby
    if (dist < 250) return '#c4a882'; // warm tan — moderate
    return '#c87a5a'; // terra — far from crossings
  }

  // Push geometry data (buildings, parks, water) into MapLibre sources
  function applyGeometry(map: maplibregl.Map) {
    const geo = geometryRef.current;
    const data = osmDataRef.current;
    const empty = { type: 'FeatureCollection' as const, features: [] as any[] };

    // Build crossing lookup for proximity coloring
    const crossingPts: [number, number][] = (data?.crossings ?? [])
      .filter((c: any) => c.lat && c.lon)
      .map((c: any) => [c.lon, c.lat] as [number, number]);

    const buildingSrc = map.getSource('buildings-geo') as maplibregl.GeoJSONSource | undefined;
    if (buildingSrc) {
      buildingSrc.setData(geo ? {
        type: 'FeatureCollection',
        features: geo.buildings.map(b => {
          const c = centroid(b.coords[0]);
          let minDist = Infinity;
          for (const cp of crossingPts) { const d = distanceM(c, cp); if (d < minDist) minDist = d; }
          return {
            type: 'Feature', geometry: { type: 'Polygon', coordinates: b.coords },
            properties: { name: b.name || '', color: crossingProximityColor(minDist), dist: Math.round(minDist) },
          };
        }),
      } : empty);
    }

    const parkSrc = map.getSource('parks-geo') as maplibregl.GeoJSONSource | undefined;
    if (parkSrc) {
      parkSrc.setData(geo ? {
        type: 'FeatureCollection',
        features: geo.parks.map(p => ({
          type: 'Feature', geometry: { type: 'Polygon', coordinates: p.coords }, properties: { name: p.name || '' },
        })),
      } : empty);
    }

    const waterSrc = map.getSource('water-geo') as maplibregl.GeoJSONSource | undefined;
    if (waterSrc) {
      waterSrc.setData(geo ? {
        type: 'FeatureCollection',
        features: geo.water.map(w => ({
          type: 'Feature', geometry: { type: 'Polygon', coordinates: w.coords }, properties: { name: w.name || '' },
        })),
      } : empty);
    }

    const waterwaySrc = map.getSource('waterways-geo') as maplibregl.GeoJSONSource | undefined;
    if (waterwaySrc) {
      waterwaySrc.setData(geo ? {
        type: 'FeatureCollection',
        features: geo.waterways.map(w => ({
          type: 'Feature', geometry: { type: 'LineString', coordinates: w.coords }, properties: { name: w.name || '' },
        })),
      } : empty);
    }
  }

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const center: [number, number] = locationRef.current
      ? [locationRef.current.lon, locationRef.current.lat]
      : [100.5018, 13.7563]; // Bangkok fallback

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: generateMapStyle(THEME),
      center,
      zoom: 15,
      pitch: 55,
      bearing: -15,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // Add overlay sources (empty until data arrives)
      map.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('crossings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // Geometry overlay sources
      map.addSource('buildings-geo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('parks-geo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('water-geo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('waterways-geo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // Building footprints — hidden in 3D mode (default)
      map.addLayer({ id: 'buildings-fill', type: 'fill', source: 'buildings-geo',
        layout: { visibility: 'none' },
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.55 } });
      map.addLayer({ id: 'buildings-outline', type: 'line', source: 'buildings-geo',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#b8a890', 'line-width': 0.5, 'line-opacity': 0.7 } });

      // 3D extruded buildings — visible by default
      map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings-geo',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': 12,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.7,
        } });

      // Parks
      map.addLayer({ id: 'parks-fill', type: 'fill', source: 'parks-geo',
        paint: { 'fill-color': '#b8d9a0', 'fill-opacity': 0.5 } });
      map.addLayer({ id: 'parks-outline', type: 'line', source: 'parks-geo',
        paint: { 'line-color': '#7cb35a', 'line-width': 1, 'line-opacity': 0.6 } });

      // Water bodies
      map.addLayer({ id: 'water-fill', type: 'fill', source: 'water-geo',
        paint: { 'fill-color': '#a3c8d8', 'fill-opacity': 0.55 } });
      map.addLayer({ id: 'water-outline', type: 'line', source: 'water-geo',
        paint: { 'line-color': '#7aadbe', 'line-width': 1, 'line-opacity': 0.6 } });

      // Waterways (rivers, streams, canals)
      map.addLayer({ id: 'waterways-line', type: 'line', source: 'waterways-geo',
        paint: { 'line-color': '#7aadbe', 'line-width': 2, 'line-opacity': 0.6 } });

      // Analysis radius
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius',
        paint: { 'fill-color': COLORS.accent, 'fill-opacity': 0.07 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius',
        paint: { 'line-color': COLORS.accent, 'line-width': 2, 'line-opacity': 0.55 } });

      // Crossings
      map.addLayer({ id: 'crossings', type: 'circle', source: 'crossings',
        paint: { 'circle-radius': 5, 'circle-color': '#22c55e',
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.85 } });

      // Hover tooltips for geometry layers
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: 'geo-tooltip' });
      const hoverLayers = ['buildings-fill', 'parks-fill', 'water-fill'] as const;
      for (const layerId of hoverLayers) {
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
        map.on('mousemove', layerId, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties || {};
          let html = '';
          if (layerId === 'buildings-fill') {
            const name = props.name || 'Building';
            const dist = props.dist;
            html = `<strong>${name}</strong><br/><span style="font-size:11px;color:#666">${dist}m to nearest crossing</span>`;
          } else if (layerId === 'parks-fill') {
            html = `<strong>${props.name || 'Park'}</strong>`;
          } else {
            html = `<strong>${props.name || 'Water'}</strong>`;
          }
          popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
      }

      // Apply whatever data is already loaded
      applyOverlays(map);
      applyGeometry(map);

      // Place location pin if available
      const loc = locationRef.current;
      if (loc) {
        markerRef.current = new maplibregl.Marker({ element: createPulsingMarker() })
          .setLngLat([loc.lon, loc.lat])
          .setPopup(new maplibregl.Popup({ offset: 20 }).setText(loc.displayName))
          .addTo(map);
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to location changes ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }

    if (location) {
      markerRef.current = new maplibregl.Marker({ element: createPulsingMarker() })
        .setLngLat([location.lon, location.lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setText(location.displayName))
        .addTo(map);
      map.flyTo({ center: [location.lon, location.lat], zoom: 15, duration: 900 });
    }

    if (map.loaded()) applyOverlays(map);
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to OSM data changes ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    applyOverlays(map);
  }, [osmData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to geometry data changes ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    applyGeometry(map);
  }, [mapGeometry]); // eslint-disable-line react-hooks/exhaustive-deps

  const crossings = osmData?.crossings?.filter((c: any) => c.lat && c.lon) ?? [];
  const showControls = osmData || mapGeometry;

  // Layer visibility state — all on by default
  const [layers, setLayers] = useState<Record<string, boolean>>({
    crossings: true,
    buildings: true,
    parks: true,
    water: true,
    radius: true,
  });

  // 3D mode state — on by default
  const [is3D, setIs3D] = useState(true);

  const toggle3D = useCallback(() => {
    setIs3D(prev => {
      const next = !prev;
      const map = mapRef.current;
      if (!map || !map.loaded()) return next;

      if (next) {
        // Switch to 3D
        map.easeTo({ pitch: 55, bearing: -15, duration: 800 });
        if (map.getLayer('buildings-fill')) map.setLayoutProperty('buildings-fill', 'visibility', 'none');
        if (map.getLayer('buildings-outline')) map.setLayoutProperty('buildings-outline', 'visibility', 'none');
        if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', layers.buildings ? 'visible' : 'none');
      } else {
        // Back to 2D
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
        if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', 'none');
        if (map.getLayer('buildings-fill')) map.setLayoutProperty('buildings-fill', 'visibility', layers.buildings ? 'visible' : 'none');
        if (map.getLayer('buildings-outline')) map.setLayoutProperty('buildings-outline', 'visibility', layers.buildings ? 'visible' : 'none');
      }
      return next;
    });
  }, [layers.buildings]);

  // Toggle a layer group on/off
  const toggleLayer = useCallback((key: string) => {
    setLayers(prev => {
      const next = { ...prev, [key]: !prev[key] };
      const map = mapRef.current;
      if (!map || !map.loaded()) return next;

      const vis = next[key] ? 'visible' : 'none';
      const layerMap: Record<string, string[]> = {
        crossings: ['crossings'],
        buildings: is3D ? ['buildings-3d'] : ['buildings-fill', 'buildings-outline'],
        parks: ['parks-fill', 'parks-outline'],
        water: ['water-fill', 'water-outline', 'waterways-line'],
        radius: ['radius-fill', 'radius-line'],
      };
      for (const id of layerMap[key] || []) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      }
      return next;
    });
  }, []);

  // Layer toggle definitions
  const layerToggles: Array<{ key: string; color: string; label: string; square?: boolean; gradient?: boolean; available: boolean }> = [
    { key: 'crossings', color: '#22c55e', label: `Crossings (${crossings.length})`, available: !!osmData },
    { key: 'buildings', color: '', label: `Buildings${mapGeometry ? ` (${mapGeometry.buildings.length})` : ''}`, gradient: true, available: !!mapGeometry },
    { key: 'parks', color: '#b8d9a0', label: `Parks${mapGeometry ? ` (${mapGeometry.parks.length})` : ''}`, square: true, available: !!mapGeometry },
    { key: 'water', color: '#a3c8d8', label: 'Water', square: true, available: !!mapGeometry },
    { key: 'radius', color: COLORS.accent, label: 'Analysis radius', available: !!osmData },
  ];

  return (
    <div className={`w-full overflow-hidden${seamless ? '' : ' rounded-2xl shadow-lg border-2'}`}
      style={seamless ? {} : { borderColor: '#e0dbd0' }}>

      {/* Layer toggles */}
      {showControls && (
        <div className="px-4 py-3 border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#e0dbd0' }}>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: '#4a5a4a' }}>
            {layerToggles.filter(t => t.available).map(({ key, color, label, gradient }) => (
              <label
                key={key}
                className="flex items-center gap-1.5 cursor-pointer select-none"
                style={{ opacity: layers[key] ? 1 : 0.5 }}
              >
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => toggleLayer(key)}
                  className="sr-only"
                />
                {/* Custom checkbox */}
                <div
                  className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border"
                  style={{
                    borderColor: gradient ? '#c4a882' : color,
                    background: layers[key]
                      ? (gradient ? 'linear-gradient(135deg, #7ab87a, #c4a882, #c87a5a)' : color)
                      : 'transparent',
                  }}
                >
                  {layers[key] && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <div ref={containerRef} className="w-full h-[300px] sm:h-[400px] md:h-[500px]" />
        {/* 3D toggle button */}
        {showControls && (
          <button
            onClick={toggle3D}
            className="absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all"
            style={{
              background: is3D ? '#e07850' : 'rgba(255,255,255,0.92)',
              color: is3D ? '#fff' : '#4a5a4a',
              border: is3D ? '1px solid #c86840' : '1px solid #d4cbb8',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
            title={is3D ? 'Switch to 2D view' : 'Switch to 3D view'}
          >
            {is3D ? '2D' : '3D'}
          </button>
        )}
      </div>
    </div>
  );
}
