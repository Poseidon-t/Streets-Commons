/**
 * Clerk-based Access Management
 * All features are free. Premium features require sign-in only (no payment).
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
 * Any signed-in user gets advocate tier (all features free).
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

  // Signed-in users get full access — no payment required
  const email = user.primaryEmailAddress?.emailAddress || null;
  return {
    tier: 'advocate',
    email,
    isValid: true,
  };
}

/**
 * Premium = signed in. All features are free with a Google sign-in.
 */
export function isPremium(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  return tier !== 'free';
}
