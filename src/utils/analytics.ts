import { getUTMParams } from './utm';
import posthog from 'posthog-js';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Send a tracking event to the backend and PostHog.
 * Automatically includes UTM params from the current session.
 */
export function trackEvent(event: string, data: Record<string, unknown> = {}) {
  const utm = getUTMParams();
  // Backend tracking (unique visitors, IP geolocation, Airtable persistence)
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
  // PostHog tracking (funnels, retention, session recordings)
  posthog.capture(event, { ...data, ...(Object.keys(utm).length > 0 ? { utm } : {}) });
}

/**
 * Identify a signed-in user in PostHog.
 */
export function identifyUser(userId: string, traits: Record<string, unknown> = {}) {
  posthog.identify(userId, traits);
}

/**
 * Report a client-side error to the backend for tracking.
 */
export function reportError(error: Error | string, context?: string) {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;
  fetch(`${API_URL}/api/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: context ? `[${context}] ${message}` : message,
      stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Install global error handler. Call once on app mount.
 */
export function installErrorReporter() {
  window.addEventListener('error', (e) => {
    reportError(e.error || e.message, 'uncaught');
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError(String(e.reason), 'unhandled-promise');
  });
}
