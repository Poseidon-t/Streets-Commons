/**
 * Clerk-based user utilities.
 * All features are free — this module handles agent profile storage only.
 */

// Agent profile stored in Clerk unsafeMetadata (client-writable)
export interface AgentProfile {
  name: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  logoBase64?: string;   // Base64 encoded logo (< 200KB)
  brandColor?: string;   // Hex color e.g. "#1e3a5f"
}

// User type from useUser() hook
interface User {
  unsafeMetadata?: {
    agentProfile?: AgentProfile;
    [key: string]: unknown;
  };
}

/**
 * Get agent profile from Clerk unsafeMetadata.
 */
export function getAgentProfile(user: User | null | undefined): AgentProfile | null {
  return (user?.unsafeMetadata?.agentProfile as AgentProfile) || null;
}
