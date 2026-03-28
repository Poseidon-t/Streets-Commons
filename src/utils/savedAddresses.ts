import { isPremiumUnlocked } from '../hooks/usePremium';

const STORAGE_KEY = 'safestreets_saved_addresses';
const MAX_ADDRESSES_FREE = 5;
const MAX_ADDRESSES_PREMIUM = 999;

export interface SavedAddress {
  id: string;
  displayName: string;
  lat: number;
  lon: number;
  savedAt: string;
  overallScore?: number;
}

export function getMaxAddresses(): number {
  return isPremiumUnlocked() ? MAX_ADDRESSES_PREMIUM : MAX_ADDRESSES_FREE;
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

  const max = getMaxAddresses();
  if (addresses.length >= max) return null;

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

export const MAX_ADDRESSES = MAX_ADDRESSES_FREE;
