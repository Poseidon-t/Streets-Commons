import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../types';
import { ANALYSIS_RADIUS, COLORS } from '../constants';

interface MapProps {
  location: Location | null;
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

export default function Map({ location }: MapProps) {
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Bangkok
  const center: [number, number] = location
    ? [location.lat, location.lon]
    : defaultCenter;

  return (
    <div className="w-full h-[500px] rounded-2xl overflow-hidden shadow-lg border-2 border-gray-100">
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
            <Marker position={[location.lat, location.lon]} icon={defaultIcon}>
              <Popup>{location.displayName}</Popup>
            </Marker>
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
          </>
        )}
      </MapContainer>
    </div>
  );
}
