import { getUTMParams } from './utm';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Send a tracking event to the backend.
 * Automatically includes UTM params from the current session.
 */
export function trackEvent(event: string, data: Record<string, unknown> = {}) {
  const utm = getUTMParams();
  fetch(`${API_URL}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      ...data,
      utm: Object.keys(utm).length > 0 ? utm : undefined,
    }),
    keepalive: true,
  }).catch(() => {});
}
