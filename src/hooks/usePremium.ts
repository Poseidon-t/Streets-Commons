/**
 * usePremium — manages premium purchase state.
 *
 * Purchase verification flow:
 * 1. User clicks "Unlock" → redirected to Stripe Checkout
 * 2. Stripe redirects back with ?premium_session=SESSION_ID
 * 3. We verify the session with our API and store the purchase
 * 4. On subsequent visits, we check localStorage for the purchase record
 *
 * For MVP: we also support a simple localStorage-based unlock
 * that can be verified server-side later.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'safestreets_premium';

interface PremiumPurchase {
  addressKey: string; // "lat,lon" — purchase is per-address
  purchasedAt: string;
  sessionId?: string;
}

function getPurchases(): PremiumPurchase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePurchase(purchase: PremiumPurchase) {
  const purchases = getPurchases();
  // Avoid duplicates
  if (!purchases.some(p => p.addressKey === purchase.addressKey)) {
    purchases.push(purchase);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(purchases));
}

export function isPremiumUnlocked(lat: number, lon: number): boolean {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return getPurchases().some(p => p.addressKey === key);
}

export function usePremium(lat: number | null, lon: number | null) {
  const addressKey = lat !== null && lon !== null
    ? `${lat.toFixed(4)},${lon.toFixed(4)}`
    : null;

  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check on mount + when address changes
  useEffect(() => {
    if (!addressKey) {
      setUnlocked(false);
      return;
    }
    const purchased = getPurchases().some(p => p.addressKey === addressKey);
    setUnlocked(purchased);
  }, [addressKey]);

  // Check URL for return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('premium_session');
    if (sessionId && addressKey) {
      verifySession(sessionId, addressKey).then(valid => {
        if (valid) {
          savePurchase({ addressKey, purchasedAt: new Date().toISOString(), sessionId });
          setUnlocked(true);
          // Clean URL
          const url = new URL(window.location.href);
          url.searchParams.delete('premium_session');
          window.history.replaceState({}, '', url.toString());
        }
      });
    }
  }, [addressKey]);

  const startCheckout = useCallback(async () => {
    if (!addressKey) return;
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/create-premium-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressKey,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Fallback: unlock directly for MVP (no Stripe configured)
        savePurchase({ addressKey, purchasedAt: new Date().toISOString() });
        setUnlocked(true);
      }
    } catch {
      // Fallback: unlock directly for MVP
      savePurchase({ addressKey, purchasedAt: new Date().toISOString() });
      setUnlocked(true);
    } finally {
      setLoading(false);
    }
  }, [addressKey]);

  return { unlocked, loading, startCheckout };
}

async function verifySession(sessionId: string, addressKey: string): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/verify-premium?session_id=${sessionId}&address_key=${addressKey}`);
    const data = await res.json();
    return data.verified === true;
  } catch {
    // If verification fails, still unlock for MVP
    return true;
  }
}
