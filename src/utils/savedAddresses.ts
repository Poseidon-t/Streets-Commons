const STORAGE_KEY = 'safestreets_saved_addresses';
const MAX_ADDRESSES = 10;

export interface SavedAddress {
  id: string;
  displayName: string;
  lat: number;
  lon: number;
  savedAt: string;
  overallScore?: number;
}

export function getSavedAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAddress(address: Omit<SavedAddress, 'id' | 'savedAt'>): SavedAddress | null {
  const addresses = getSavedAddresses();

  // Check for duplicate (same lat/lon within ~10m)
  const isDuplicate = addresses.some(
    (a) => Math.abs(a.lat - address.lat) < 0.0001 && Math.abs(a.lon - address.lon) < 0.0001
  );
  if (isDuplicate) return null;

  if (addresses.length >= MAX_ADDRESSES) return null;

  const newAddress: SavedAddress = {
    ...address,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };

  addresses.unshift(newAddress);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    return null;
  }
  return newAddress;
}

export function removeAddress(id: string): void {
  const addresses = getSavedAddresses().filter((a) => a.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    // Storage full or unavailable
  }
}

export { MAX_ADDRESSES };
