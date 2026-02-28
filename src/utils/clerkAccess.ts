/**
 * Clerk-based Access Management
 * Free tier = default. Pro tier = $99 one-time.
 * Dev mode (localhost) auto-enables pro tier for testing.
 */

// Agent profile stored in Clerk unsafeMetadata (client-writable)
export interface AgentProfile {
  name: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
}

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
  unsafeMetadata?: {
    agentProfile?: AgentProfile;
    proTrialReportsUsed?: number;
    [key: string]: unknown;
  };
}

export type PremiumTier = 'free' | 'pro';

export interface AccessInfo {
  tier: PremiumTier;
  email: string | null;
  isValid: boolean;
}

/**
 * DEV MODE: Automatically enables pro tier on localhost (development only)
 */
function getDevTierOverride(): PremiumTier | null {
  if (typeof window === 'undefined') return null;
  if (import.meta.env.PROD) return null;

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    return 'pro';
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
  const validTiers: PremiumTier[] = ['pro'];
  const tier: PremiumTier = metadataTier && validTiers.includes(metadataTier) ? metadataTier : 'free';

  return { tier, email, isValid: true };
}

/**
 * Premium = paid pro tier (not just signed in).
 */
export function isPremium(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  return tier === 'pro';
}

/**
 * Pro = $99 one-time purchase tier.
 */
export function isPro(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  return tier === 'pro';
}

/**
 * Check if user is signed in (regardless of payment status).
 */
export function isSignedIn(user: User | null | undefined): boolean {
  return !!user;
}

/**
 * Get agent profile from Clerk unsafeMetadata.
 */
export function getAgentProfile(user: User | null | undefined): AgentProfile | null {
  return (user?.unsafeMetadata?.agentProfile as AgentProfile) || null;
}

/**
 * Get count of pro trial reports used.
 */
export function getProTrialReportsUsed(user: User | null | undefined): number {
  return (user?.unsafeMetadata?.proTrialReportsUsed as number) || 0;
}

/**
 * Check if user can generate an agent report (is pro, or has trial remaining).
 */
export function canGenerateAgentReport(user: User | null | undefined): boolean {
  const { tier } = getAccessInfoFromUser(user);
  if (tier === 'pro') return true;
  if (!user) return false;
  const used = getProTrialReportsUsed(user);
  return used < 3;
}
