import type { Location } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface PlaceSuggestion {
  placeId: string;
  description: string;
  primaryText: string;
  secondaryText: string;
}

/**
 * Fetch autocomplete suggestions from Google Places API (via backend proxy).
 * Returns empty array if the backend has no Google API key configured.
 */
export async function googleAutocomplete(
  input: string,
  locationBias?: { lat: number; lon: number } | null,
): Promise<PlaceSuggestion[]> {
  const res = await fetch(`${API_URL}/api/places/autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, locationBias }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.suggestions || [];
}

/**
 * Resolve a Google Place ID to a Location (lat/lon + address).
 */
export async function googlePlaceDetails(placeId: string): Promise<Location | null> {
  const res = await fetch(`${API_URL}/api/places/details?placeId=${encodeURIComponent(placeId)}`);

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.lat || !data.lon) return null;

  return {
    lat: data.lat,
    lon: data.lon,
    displayName: data.formattedAddress,
    city: data.city || undefined,
    country: data.country || undefined,
    countryCode: data.countryCode || undefined,
  };
}
