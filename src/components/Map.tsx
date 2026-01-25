import { MapContainer, TileLayer, Circle, Marker, Popup, CircleMarker } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, OSMData } from '../types';
import { ANALYSIS_RADIUS, COLORS } from '../constants';

interface MapProps {
  location: Location | null;
  osmData?: OSMData | null;
}

const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function Map({ location, osmData }: MapProps) {
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Bangkok
  const center: [number, number] = location
    ? [location.lat, location.lon]
    : defaultCenter;

  // Get POI icon based on type
  const getPOIIcon = (poi: any): string => {
    if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten') return '🏫';
    if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') return '🏥';
    if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') return '🍽️';
    if (poi.tags?.shop) return '🛒';
    if (poi.tags?.leisure === 'park') return '🌳';
    if (poi.tags?.railway === 'station' || poi.tags?.amenity === 'bus_station') return '🚉';
    return '📍';
  };

  const getPOIColor = (poi: any): string => {
    if (poi.tags?.amenity === 'school' || poi.tags?.amenity === 'kindergarten') return '#3b82f6';
    if (poi.tags?.amenity === 'hospital' || poi.tags?.amenity === 'clinic') return '#ef4444';
    if (poi.tags?.amenity === 'restaurant' || poi.tags?.amenity === 'cafe') return '#f59e0b';
    if (poi.tags?.shop) return '#8b5cf6';
    if (poi.tags?.leisure === 'park') return '#22c55e';
    if (poi.tags?.railway === 'station' || poi.tags?.amenity === 'bus_station') return '#06b6d4';
    return '#6b7280';
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-lg border-2 border-gray-100">
      {/* Map Legend */}
      {osmData && (
        <div className="bg-white px-4 py-3 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Crossings ({osmData.crossings.filter(c => c.lat && c.lon).length})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Schools</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Healthcare</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span>Food</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Shops</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span>Parks</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
              <span>Transit</span>
            </div>
          </div>
        </div>
      )}
      <div className="w-full h-[500px]">
      <MapContainer
        center={center}
        zoom={15}
        className="w-full h-full"
        key={location ? `${location.lat}-${location.lon}` : 'default'}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {location && (
          <>
            {/* Center marker */}
            <Marker position={[location.lat, location.lon]} icon={defaultIcon}>
              <Popup>{location.displayName}</Popup>
            </Marker>

            {/* Analysis radius circle */}
            <Circle
              center={[location.lat, location.lon]}
              radius={ANALYSIS_RADIUS}
              pathOptions={{
                color: COLORS.accent,
                fillColor: COLORS.accent,
                fillOpacity: 0.1,
                weight: 2,
              }}
            />

            {/* Pedestrian crossings */}
            {osmData?.crossings.map((crossing: any, idx: number) => {
              if (!crossing.lat || !crossing.lon) return null;
              return (
                <CircleMarker
                  key={`crossing-${idx}`}
                  center={[crossing.lat, crossing.lon]}
                  radius={6}
                  pathOptions={{
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.8,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>Pedestrian Crossing</strong>
                    <br />
                    OSM ID: {crossing.id}
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Points of Interest */}
            {osmData?.pois.map((poi: any, idx: number) => {
              // Get coordinates from the poi object or nodes map
              let lat, lon;
              if (poi.lat && poi.lon) {
                lat = poi.lat;
                lon = poi.lon;
              } else if (poi.center) {
                lat = poi.center.lat;
                lon = poi.center.lon;
              }

              if (!lat || !lon) return null;

              const color = getPOIColor(poi);
              const icon = getPOIIcon(poi);

              return (
                <CircleMarker
                  key={`poi-${idx}`}
                  center={[lat, lon]}
                  radius={8}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.6,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{icon} {poi.tags?.name || 'POI'}</strong>
                    <br />
                    {poi.tags?.amenity && `Type: ${poi.tags.amenity}`}
                    {poi.tags?.shop && `Shop: ${poi.tags.shop}`}
                    {poi.tags?.leisure && `Leisure: ${poi.tags.leisure}`}
                  </Popup>
                </CircleMarker>
              );
            })}
          </>
        )}
      </MapContainer>
      </div>
    </div>
  );
}
