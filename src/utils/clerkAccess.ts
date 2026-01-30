/**
 * Clerk-based Premium Access Management
 * Uses Clerk user metadata for tier management
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

export type PremiumTier = 'free' | 'advocate' | 'professional';

export interface AccessInfo {
  tier: PremiumTier;
  email: string | null;
  isValid: boolean;
}

/**
 * DEV MODE: Automatically enables professional tier on localhost
 * Set localStorage.setItem('dev_premium_tier', 'free') to disable
 */
function getDevTierOverride(): PremiumTier | null {
  if (typeof window === 'undefined') return null;

  // Check if running on localhost (development)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Check for explicit override in localStorage
  const override = localStorage.getItem('dev_premium_tier');

  // If explicitly set to 'free', disable dev premium
  if (override === 'free') {
    return null;
  }

  // If explicitly set to a tier, use that
  if (override === 'advocate' || override === 'professional') {
    console.log(`🔓 DEV MODE: Premium tier overridden to "${override}"`);
    return override;
  }

  // Auto-enable professional on localhost for testing
  if (isLocalhost) {
    console.log('🔓 DEV MODE: Auto-enabled professional tier (localhost)');
    return 'professional';
  }

  return null;
}

/**
 * Get access info from Clerk user
 */
export function getAccessInfoFromUser(user: User | null | undefined): AccessInfo {
  // Check for dev mode override first
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

  const tier = (user.publicMetadata?.tier as PremiumTier) || 'free';
  const email = user.primaryEmailAddress?.emailAddress || null;

  return {
    tier,
    email,
    isValid: true,
  };
}

/**
 * Check if user has specific tier access
 */
export function hasAccess(user: User | null | undefined, requiredTier: 'advocate' | 'professional'): boolean {
  const { tier } = getAccessInfoFromUser(user);

  if (tier === 'free') return false;

  if (requiredTier === 'advocate') {
    return tier === 'advocate' || tier === 'professional';
  }

  if (requiredTier === 'professional') {
    return tier === 'professional';
  }

  return false;
}

/**
 * Get premium status (for backward compatibility with existing components)
 */
export function isPremium(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  return tier !== 'free';
}

/**
 * Get professional status
 */
export function isProfessional(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  return tier === 'professional';
}
