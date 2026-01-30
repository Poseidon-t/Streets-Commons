/**
 * Premium Access Management
 * Handles JWT token storage and verification in localStorage
 */

const TOKEN_KEY = 'safestreets_access_token';
const TIER_KEY = 'safestreets_tier';
const EMAIL_KEY = 'safestreets_email';

export type PremiumTier = 'free' | 'advocate' | 'professional';

export interface AccessInfo {
  tier: PremiumTier;
  email: string | null;
  isValid: boolean;
}

/**
 * Store access token in localStorage
 */
export function storeAccessToken(token: string, tier: PremiumTier, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TIER_KEY, tier);
  localStorage.setItem(EMAIL_KEY, email);
  console.log(`✅ Access activated: ${tier} tier for ${email}`);
}

/**
 * Get current access info
 */
export function getAccessInfo(): AccessInfo {
  const token = localStorage.getItem(TOKEN_KEY);
  const tier = (localStorage.getItem(TIER_KEY) as PremiumTier) || 'free';
  const email = localStorage.getItem(EMAIL_KEY);

  if (!token) {
    return { tier: 'free', email: null, isValid: false };
  }

  return {
    tier,
    email,
    isValid: true,
  };
}

/**
 * Check if user has specific tier access
 */
export function hasAccess(requiredTier: 'advocate' | 'professional'): boolean {
  const { tier, isValid } = getAccessInfo();

  if (!isValid) return false;

  if (requiredTier === 'advocate') {
    return tier === 'advocate' || tier === 'professional';
  }

  if (requiredTier === 'professional') {
    return tier === 'professional';
  }

  return false;
}

/**
 * Verify token with backend
 */
export async function verifyTokenWithBackend(token: string): Promise<{
  valid: boolean;
  tier?: PremiumTier;
  email?: string;
  error?: string;
}> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUrl}/api/verify-token?token=${encodeURIComponent(token)}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { valid: false, error: error.error };
    }

    const data = await response.json();
    return {
      valid: true,
      tier: data.tier,
      email: data.email,
    };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Clear access (logout)
 */
export function clearAccess() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TIER_KEY);
  localStorage.removeItem(EMAIL_KEY);
  console.log('Access cleared');
}

/**
 * Request new magic link for email
 */
export async function requestNewMagicLink(email: string): Promise<{
  success: boolean;
  message: string;
  tier?: PremiumTier;
}> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUrl}/api/resend-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || 'Failed to send magic link',
      };
    }

    return {
      success: true,
      message: data.message,
      tier: data.tier,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Network error. Please try again.',
    };
  }
}
