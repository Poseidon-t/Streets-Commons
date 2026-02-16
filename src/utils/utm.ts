const UTM_SESSION_KEY = 'safestreets_utm';
const UTM_LAST_TOUCH_KEY = 'safestreets_last_utm';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Parse UTM parameters from the current URL and cache in sessionStorage.
 * Call once on app mount. Does not overwrite if already captured this session.
 */
export function captureUTMParams(): UTMParams {
  try {
    const cached = sessionStorage.getItem(UTM_SESSION_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* fall through */ }

  const params = new URLSearchParams(window.location.search);
  const utm: UTMParams = {};

  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
  for (const key of keys) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }

  if (utm.utm_source || utm.utm_medium || utm.utm_campaign) {
    try {
      sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utm));
      localStorage.setItem(UTM_LAST_TOUCH_KEY, JSON.stringify(utm));
    } catch { /* storage full or disabled */ }
  }

  return utm;
}

/**
 * Get the current session's UTM params (if any).
 */
export function getUTMParams(): UTMParams {
  try {
    const cached = sessionStorage.getItem(UTM_SESSION_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}
