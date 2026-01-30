import { NOMINATIM_URL, USER_AGENT } from '../constants';
import type { Location } from '../types';

// Cache user location to avoid repeated geolocation requests
let cachedUserLocation: { lat: number; lon: number } | null = null;

/**
 * Get user's current location (with permission)
 * Returns null if unavailable or permission denied
 */
async function getUserLocation(): Promise<{ lat: number; lon: number } | null> {
  // Return cached location if available
  if (cachedUserLocation) {
    return cachedUserLocation;
  }

  // Check if geolocation is supported
  if (!navigator.geolocation) {
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300000, // Cache for 5 minutes
      });
    });

    cachedUserLocation = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };

    return cachedUserLocation;
  } catch (error) {
    // User denied permission or timeout - continue without location bias
    return null;
  }
}

export async function searchAddress(query: string): Promise<Location[]> {
  // Try to get user location for local bias (non-blocking)
  const userLocation = await getUserLocation();

  // Build URL with location bias if available
  let url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;

  if (userLocation) {
    // Create viewbox: ~50km radius around user location
    // Format: <x1>,<y1>,<x2>,<y2> where x=lon, y=lat
    const radiusDegrees = 0.5; // ~50km
    const viewbox = `${userLocation.lon - radiusDegrees},${userLocation.lat - radiusDegrees},${userLocation.lon + radiusDegrees},${userLocation.lat + radiusDegrees}`;

    url += `&viewbox=${viewbox}&bounded=0`; // bounded=0 allows global results too
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to search address');
  }

  const data = await response.json();

  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name,
    city: item.address?.city || item.address?.town || item.address?.village,
    country: item.address?.country,
  }));
}
