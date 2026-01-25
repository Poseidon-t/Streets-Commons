import { NOMINATIM_URL, USER_AGENT } from '../constants';
import type { Location } from '../types';

export async function searchAddress(query: string): Promise<Location[]> {
  const response = await fetch(
    `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
    {
      headers: {
        'User-Agent': USER_AGENT,
      },
    }
  );

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
