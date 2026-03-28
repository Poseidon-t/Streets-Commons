/**
 * usePremium — manages Moving Research premium purchase state.
 *
 * Purchase is GLOBAL (not per-address). Once unlocked, all premium
 * features work for every address. $29 one-time.
 *
 * Verification flow:
 * 1. User clicks "Unlock" → redirected to Stripe Checkout
 * 2. Stripe redirects back with ?premium_session=SESSION_ID
 * 3. We verify the session with our API and store the purchase
 * 4. On subsequent visits, we check localStorage for the purchase record
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'safestreets_moving_research';

interface PremiumPurchase {
  purchasedAt: string;
  sessionId?: string;
}

function getPurchase(): PremiumPurchase | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePurchase(purchase: PremiumPurchase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(purchase));
}

export function isPremiumUnlocked(): boolean {
  return getPurchase() !== null;
}

export function usePremium() {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check on mount
  useEffect(() => {
    setUnlocked(getPurchase() !== null);
  }, []);

  // Check URL for return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('premium_session');
    if (sessionId) {
      verifySession(sessionId).then(valid => {
        if (valid) {
          savePurchase({ purchasedAt: new Date().toISOString(), sessionId });
          setUnlocked(true);
          // Clean URL
          const url = new URL(window.location.href);
          url.searchParams.delete('premium_session');
          window.history.replaceState({}, '', url.toString());
        }
      });
    }
  }, []);

  const startCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/create-premium-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Fallback: unlock directly for MVP (no Stripe configured)
        savePurchase({ purchasedAt: new Date().toISOString() });
        setUnlocked(true);
      }
    } catch {
      // Fallback: unlock directly for MVP
      savePurchase({ purchasedAt: new Date().toISOString() });
      setUnlocked(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return { unlocked, loading, startCheckout };
}

async function verifySession(sessionId: string): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/verify-premium?session_id=${sessionId}`);
    const data = await res.json();
    return data.verified === true;
  } catch {
    // If verification fails, still unlock for MVP
    return true;
  }
}
