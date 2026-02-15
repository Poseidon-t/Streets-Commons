/**
 * Clerk-based Access Management
 * Free tier = default. Advocate tier = $19 one-time payment (stored in Clerk publicMetadata).
 * Dev mode (localhost) auto-enables advocate tier for testing.
 */

// User type from useUser() hook
interface User {
  id: string;
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
  publicMetadata?: {
    tier?: string;
    [key: string]: unknown;
  };
}

export type PremiumTier = 'free' | 'advocate';

export interface AccessInfo {
  tier: PremiumTier;
  email: string | null;
  isValid: boolean;
}

/**
 * DEV MODE: Automatically enables advocate tier on localhost
 */
function getDevTierOverride(): PremiumTier | null {
  if (typeof window === 'undefined') return null;

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    console.log('🔓 DEV MODE: Auto-enabled advocate tier (localhost)');
    return 'advocate';
  }

  return null;
}

/**
 * Get access info from Clerk user.
 * Checks publicMetadata.tier set by Stripe webhook after payment.
 */
export function getAccessInfoFromUser(user: User | null | undefined): AccessInfo {
  const devOverride = getDevTierOverride();
  if (devOverride) {
    return {
      tier: devOverride,
      email: user?.primaryEmailAddress?.emailAddress || 'dev@test.com',
      isValid: true,
    };
  }

  if (!user) {
    return { tier: 'free', email: null, isValid: false };
  }

  // Check Clerk publicMetadata for paid tier (set by Stripe webhook)
  const email = user.primaryEmailAddress?.emailAddress || null;
  const metadataTier = user.publicMetadata?.tier as PremiumTier | undefined;

  return {
    tier: metadataTier === 'advocate' ? 'advocate' : 'free',
    email,
    isValid: true,
  };
}

/**
 * Premium = paid advocate tier (not just signed in).
 */
export function isPremium(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  return tier === 'advocate';
}

/**
 * Check if user is signed in (regardless of payment status).
 */
export function isSignedIn(user: User | null | undefined): boolean {
  return !!user;
}
