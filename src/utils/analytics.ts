import posthog from 'posthog-js';

export function trackEvent(event: string, data: Record<string, unknown> = {}) {
  posthog.capture(event, data);
}

export function identifyUser(userId: string, traits: Record<string, unknown> = {}) {
  posthog.identify(userId, traits);
}

export function reportError(error: Error | string, context?: string) {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;
  posthog.capture('$exception', {
    $exception_message: context ? `[${context}] ${message}` : message,
    $exception_stack: stack,
    url: window.location.href,
  });
}

export function installErrorReporter() {
  window.addEventListener('error', (e) => {
    reportError(e.error || e.message, 'uncaught');
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError(String(e.reason), 'unhandled-promise');
  });
}
