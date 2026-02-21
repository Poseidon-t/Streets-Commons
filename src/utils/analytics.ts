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
