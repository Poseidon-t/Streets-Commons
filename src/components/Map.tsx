import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location, OSMData } from '../types';
import { ANALYSIS_RADIUS, COLORS } from '../constants';
import { generateMapStyle } from '../utils/maplibreStyle';

// ── SafeStreets earth-tone theme ─────────────────────────────────────────────
const THEME = {
  ui: { bg: '#f8f6f1', text: '#2a3a2a' },
  map: {
    land: '#f0ece3',
    water: '#c5dce8',
    waterway: '#a8c4d8',
    parks: '#d4e8c8',
    buildings: '#e4ddd0',
    aeroway: '#e8e4d8',
    rail: '#8a9a8a',
    roads: {
      major: '#ccc0a8',
      minor_high: '#d4c8b0',
      minor_mid: '#ddd4be',
      minor_low: '#e4dace',
      path: '#ddd8cc',
      outline: '#f0ece3',
    },
  },
};

interface MapProps {
  location: Location | null;
  osmData?: OSMData | null;
  seamless?: boolean;
}

// ── POI helpers (unchanged from Leaflet version) ──────────────────────────────
function getPOIColor(poi: any): string {
  if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten') return '#3b82f6';
  if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') return '#ef4444';
  if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') return '#f59e0b';
  if (poi.tags?.shop) return '#8b5cf6';
  if (poi.tags?.leisure === 'park') return '#22c55e';
  if (poi.tags?.railway === 'station' || poi.tags?.amenity === 'bus_station') return '#06b6d4';
  return '#6b7280';
}

function getPOILabel(poi: any): string {
  if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten') return 'School';
  if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') return 'Healthcare';
  if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') return 'Food & Drink';
  if (poi.tags?.shop) return 'Shop';
  if (poi.tags?.leisure === 'park') return 'Park';
  if (poi.tags?.railway === 'station' || poi.tags?.amenity === 'bus_station') return 'Transit';
  return 'POI';
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
export default function Map({ location, osmData, seamless }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Keep refs current so the load callback always sees latest props
  const locationRef = useRef(location);
  const osmDataRef = useRef(osmData);
  locationRef.current = location;
  osmDataRef.current = osmData;

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

    const poiSrc = map.getSource('pois') as maplibregl.GeoJSONSource | undefined;
    if (poiSrc) {
      const pois = (data?.pois ?? []).map((poi: any) => {
        const lat = poi.lat ?? poi.center?.lat;
        const lon = poi.lon ?? poi.center?.lon;
        if (!lat || !lon) return null;
        return { lat, lon, color: getPOIColor(poi), label: getPOILabel(poi) };
      }).filter(Boolean) as { lat: number; lon: number; color: string; label: string }[];

      poiSrc.setData({
        type: 'FeatureCollection',
        features: pois.map(p => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { color: p.color, label: p.label },
        })),
      });
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
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // Add overlay sources (empty until data arrives)
      map.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('crossings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // Analysis radius
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius',
        paint: { 'fill-color': COLORS.accent, 'fill-opacity': 0.07 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius',
        paint: { 'line-color': COLORS.accent, 'line-width': 2, 'line-opacity': 0.55 } });

      // Crossings
      map.addLayer({ id: 'crossings', type: 'circle', source: 'crossings',
        paint: { 'circle-radius': 5, 'circle-color': '#22c55e',
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.85 } });

      // POIs (data-driven color from feature property)
      map.addLayer({ id: 'pois', type: 'circle', source: 'pois',
        paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.75 } });

      // Apply whatever data is already loaded
      applyOverlays(map);

      // Place location pin if available
      const loc = locationRef.current;
      if (loc) {
        const el = document.createElement('div');
        el.style.cssText = `width:20px;height:20px;background:${COLORS.accent};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)`;
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([loc.lon, loc.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(loc.displayName))
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
      const el = document.createElement('div');
      el.style.cssText = `width:20px;height:20px;background:${COLORS.accent};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)`;
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([location.lon, location.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(location.displayName))
        .addTo(map);
      map.flyTo({ center: [location.lon, location.lat], zoom: 14, duration: 700 });
    }

    if (map.loaded()) applyOverlays(map);
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to OSM data changes ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    applyOverlays(map);
  }, [osmData]); // eslint-disable-line react-hooks/exhaustive-deps

  const crossings = osmData?.crossings?.filter((c: any) => c.lat && c.lon) ?? [];

  return (
    <div className={`w-full overflow-hidden${seamless ? '' : ' rounded-2xl shadow-lg border-2'}`}
      style={seamless ? {} : { borderColor: '#e0dbd0' }}>

      {/* Legend */}
      {osmData && (
        <div className="px-4 py-3 border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#e0dbd0' }}>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#4a5a4a' }}>
            {[
              { color: '#22c55e', label: `Crossings (${crossings.length})` },
              { color: '#3b82f6', label: 'Schools' },
              { color: '#ef4444', label: 'Healthcare' },
              { color: '#f59e0b', label: 'Food' },
              { color: '#8b5cf6', label: 'Shops' },
              { color: '#22c55e', label: 'Parks', outline: true },
              { color: '#06b6d4', label: 'Transit' },
            ].map(({ color, label, outline }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color, border: outline ? '1.5px solid #16a34a' : 'none' }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-[300px] sm:h-[400px] md:h-[500px]" />
    </div>
  );
}
