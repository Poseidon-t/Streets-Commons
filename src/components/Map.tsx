import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, OSMData } from '../types';
import { ANALYSIS_RADIUS, COLORS } from '../constants';

interface MapProps {
  location: Location | null;
  osmData?: OSMData | null;
  /** When true: no own border/rounded/shadow — renders flush inside a parent container */
  seamless?: boolean;
}

// ── POI helpers ──────────────────────────────────────────────────────────────
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

// ── Recenter map when location changes ──────────────────────────────────────
function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 15, { animate: false });
  }, [lat, lon, map]);
  return null;
}

// ── Custom pin icon ──────────────────────────────────────────────────────────
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:${COLORS.accent};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// ── Component ────────────────────────────────────────────────────────────────
export default function Map({ location, osmData, seamless }: MapProps) {
  const center: [number, number] = location
    ? [location.lat, location.lon]
    : [13.7563, 100.5018]; // Bangkok fallback

  const crossings = osmData?.crossings?.filter((c: any) => c.lat && c.lon) ?? [];
  const pois = (osmData?.pois ?? []).map((poi: any) => {
    const lat = poi.lat ?? poi.center?.lat;
    const lon = poi.lon ?? poi.center?.lon;
    if (!lat || !lon) return null;
    return { lat, lon, color: getPOIColor(poi), name: poi.tags?.name || getPOILabel(poi), label: getPOILabel(poi) };
  }).filter(Boolean) as { lat: number; lon: number; color: string; name: string; label: string }[];

  return (
    <div className={`w-full overflow-hidden${seamless ? '' : ' rounded-2xl shadow-lg border-2'}`} style={seamless ? {} : { borderColor: '#e0dbd0' }}>
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
        <MapContainer
          center={center}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          {/* Carto Positron — clean, light, free, no API key */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />

          {/* Recenter when location changes */}
          {location && <RecenterMap lat={location.lat} lon={location.lon} />}

          {/* Analysis radius */}
          {location && (
            <Circle
              center={[location.lat, location.lon]}
              radius={ANALYSIS_RADIUS}
              pathOptions={{ color: COLORS.accent, fillColor: COLORS.accent, fillOpacity: 0.07, weight: 2, opacity: 0.55 }}
            />
          )}

          {/* Pedestrian crossings */}
          {crossings.map((c: any) => (
            <CircleMarker
              key={c.id ?? `${c.lat}-${c.lon}`}
              center={[c.lat, c.lon]}
              radius={5}
              pathOptions={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 0.85, weight: 1.5 }}
            >
              <Popup>
                <div className="text-sm font-semibold">Pedestrian Crossing</div>
                {c.id && <div className="text-xs text-gray-500 mt-0.5">OSM ID: {c.id}</div>}
              </Popup>
            </CircleMarker>
          ))}

          {/* POIs */}
          {pois.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lon]}
              radius={7}
              pathOptions={{ color: '#fff', fillColor: p.color, fillOpacity: 0.75, weight: 1.5 }}
            >
              <Popup>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.label}</div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Location pin */}
          {location && (
            <Marker position={[location.lat, location.lon]} icon={pinIcon}>
              <Popup>{location.displayName}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
