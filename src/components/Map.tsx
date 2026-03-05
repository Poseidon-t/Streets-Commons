import { useState, useCallback, useMemo } from 'react';
import MapGL, { Marker, Popup, Source, Layer } from 'react-map-gl/maplibre';
import type { CircleLayerSpecification, FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location, OSMData } from '../types';
import { ANALYSIS_RADIUS, COLORS } from '../constants';

interface MapProps {
  location: Location | null;
  osmData?: OSMData | null;
}

// OpenFreeMap — free, no API key, OpenStreetMap-based vector tiles
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Generate a GeoJSON polygon approximating a circle (64 points)
function makeCircleGeoJSON(lat: number, lon: number, radiusMeters: number) {
  const points = 64;
  const coords: [number, number][] = [];
  const earthRadius = 6371000;
  const angularRadius = radiusMeters / earthRadius;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const latR = (lat * Math.PI) / 180;
    const dlat = angularRadius * Math.cos(angle);
    const dlon = angularRadius * Math.sin(angle) / Math.cos(latR);
    coords.push([lon + (dlon * 180) / Math.PI, lat + (dlat * 180) / Math.PI]);
  }
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} };
}

function getPOIColor(poi: any): string {
  if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten') return '#3b82f6';
  if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') return '#ef4444';
  if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') return '#f59e0b';
  if (poi.tags?.shop) return '#8b5cf6';
  if (poi.tags?.leisure === 'park') return '#22c55e';
  if (poi.tags?.railway === 'station' || poi.tags?.amenity === 'bus_station') return '#06b6d4';
  return '#6b7280';
}

function getPOIIcon(poi: any): string {
  if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten') return '🏫';
  if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') return '🏥';
  if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') return '🍽️';
  if (poi.tags?.shop) return '🛒';
  if (poi.tags?.leisure === 'park') return '🌳';
  if (poi.tags?.railway === 'station' || poi.tags?.amenity === 'bus_station') return '🚉';
  return '📍';
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

export default function Map({ location, osmData }: MapProps) {
  const [popupInfo, setPopupInfo] = useState<{ lon: number; lat: number; title: string; subtitle: string } | null>(null);

  const initialViewState = useMemo(() => ({
    longitude: location?.lon ?? 100.5018,
    latitude: location?.lat ?? 13.7563,
    zoom: 15,
  }), [location?.lat, location?.lon]);

  // Radius circle GeoJSON
  const circleGeoJSON = useMemo(() => {
    if (!location) return null;
    return makeCircleGeoJSON(location.lat, location.lon, ANALYSIS_RADIUS);
  }, [location?.lat, location?.lon]);

  // Crossings GeoJSON
  const crossingsGeoJSON = useMemo(() => {
    if (!osmData?.crossings) return null;
    const features = osmData.crossings
      .filter((c: any) => c.lat && c.lon)
      .map((c: any) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
        properties: { id: c.id },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [osmData?.crossings]);

  // POIs GeoJSON
  const poisGeoJSON = useMemo(() => {
    if (!osmData?.pois) return null;
    const features = osmData.pois
      .map((poi: any) => {
        const lat = poi.lat ?? poi.center?.lat;
        const lon = poi.lon ?? poi.center?.lon;
        if (!lat || !lon) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lon, lat] },
          properties: {
            color: getPOIColor(poi),
            name: poi.tags?.name || getPOILabel(poi),
            icon: getPOIIcon(poi),
            label: getPOILabel(poi),
          },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[];
    return { type: 'FeatureCollection' as const, features };
  }, [osmData?.pois]);

  const handleCrossingClick = useCallback((e: any) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const [lon, lat] = feature.geometry.coordinates;
    setPopupInfo({ lon, lat, title: 'Pedestrian Crossing', subtitle: `OSM ID: ${feature.properties.id}` });
  }, []);

  const handlePOIClick = useCallback((e: any) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const [lon, lat] = feature.geometry.coordinates;
    setPopupInfo({ lon, lat, title: `${feature.properties.icon} ${feature.properties.name}`, subtitle: feature.properties.label });
  }, []);

  // Layer specs
  const radiusFillLayer: FillLayerSpecification = {
    id: 'radius-fill',
    type: 'fill',
    source: 'radius',
    paint: { 'fill-color': COLORS.accent, 'fill-opacity': 0.08 },
  };
  const radiusLineLayer: LineLayerSpecification = {
    id: 'radius-line',
    type: 'line',
    source: 'radius',
    paint: { 'line-color': COLORS.accent, 'line-width': 2, 'line-opacity': 0.6 },
  };
  const crossingsLayer: CircleLayerSpecification = {
    id: 'crossings',
    type: 'circle',
    source: 'crossings',
    paint: {
      'circle-radius': 5,
      'circle-color': '#22c55e',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.85,
    },
  };
  const poisLayer: CircleLayerSpecification = {
    id: 'pois',
    type: 'circle',
    source: 'pois',
    paint: {
      'circle-radius': 7,
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.75,
    },
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-lg border-2" style={{ borderColor: '#e0dbd0' }}>
      {/* Legend */}
      {osmData && (
        <div className="px-4 py-3 border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#e0dbd0' }}>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#4a5a4a' }}>
            {[
              { color: '#22c55e', label: `Crossings (${osmData.crossings.filter((c: any) => c.lat && c.lon).length})` },
              { color: '#3b82f6', label: 'Schools' },
              { color: '#ef4444', label: 'Healthcare' },
              { color: '#f59e0b', label: 'Food' },
              { color: '#8b5cf6', label: 'Shops' },
              { color: '#22c55e', label: 'Parks', outline: true },
              { color: '#06b6d4', label: 'Transit' },
            ].map(({ color, label, outline }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color, border: outline ? '1.5px solid #16a34a' : 'none' }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full h-[300px] sm:h-[400px] md:h-[500px]">
        <MapGL
          key={location ? `${location.lat}-${location.lon}` : 'default'}
          initialViewState={initialViewState}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={crossingsGeoJSON ? ['crossings', 'pois'] : []}
          onClick={(e: any) => {
            const features = e.features ?? [];
            const crossing = features.find((f: any) => f.layer.id === 'crossings');
            const poi = features.find((f: any) => f.layer.id === 'pois');
            if (crossing) handleCrossingClick({ features: [crossing] });
            else if (poi) handlePOIClick({ features: [poi] });
            else setPopupInfo(null);
          }}
          cursor={popupInfo ? 'pointer' : 'grab'}
          attributionControl={false}
        >
          {/* Analysis radius */}
          {circleGeoJSON && (
            <Source id="radius" type="geojson" data={circleGeoJSON}>
              <Layer {...radiusFillLayer} />
              <Layer {...radiusLineLayer} />
            </Source>
          )}

          {/* Crossings */}
          {crossingsGeoJSON && (
            <Source id="crossings" type="geojson" data={crossingsGeoJSON}>
              <Layer {...crossingsLayer} />
            </Source>
          )}

          {/* POIs */}
          {poisGeoJSON && (
            <Source id="pois" type="geojson" data={poisGeoJSON}>
              <Layer {...poisLayer} />
            </Source>
          )}

          {/* Location pin */}
          {location && (
            <Marker longitude={location.lon} latitude={location.lat} anchor="bottom">
              <div
                className="w-8 h-8 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: COLORS.accent, border: '3px solid white' }}
                title={location.displayName}
              >
                📍
              </div>
            </Marker>
          )}

          {/* Popup */}
          {popupInfo && (
            <Popup
              longitude={popupInfo.lon}
              latitude={popupInfo.lat}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeOnClick={false}
            >
              <div className="text-sm">
                <div className="font-semibold">{popupInfo.title}</div>
                {popupInfo.subtitle && <div className="text-xs text-gray-500 mt-0.5">{popupInfo.subtitle}</div>}
              </div>
            </Popup>
          )}
        </MapGL>
      </div>
    </div>
  );
}
