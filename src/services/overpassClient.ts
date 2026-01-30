/**
 * Robust Overpass API Client
 * Features:
 * - Multiple fallback endpoints
 * - Automatic retry with exponential backoff
 * - Request throttling to prevent rate limiting
 * - Response caching
 */

// Available Overpass API endpoints (in order of preference)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Request queue for throttling
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

interface OverpassResponse {
  elements: unknown[];
  [key: string]: unknown;
}

/**
 * Execute an Overpass API query with retry and fallback logic
 */
export async function executeOverpassQuery(
  query: string,
  options: {
    maxRetries?: number;
    timeout?: number;
    useCache?: boolean;
  } = {}
): Promise<OverpassResponse> {
  const { maxRetries = 3, timeout = 30000, useCache = true } = options;

  // Check cache first
  const cacheKey = query.trim();
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Using cached Overpass response');
      return cached.data as OverpassResponse;
    }
  }

  // Throttle requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  // Try each endpoint with retries
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 Overpass request to ${endpoint} (attempt ${attempt}/${maxRetries})`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: query,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        clearTimeout(timeoutId);

        if (response.status === 429 || response.status === 504 || response.status === 503) {
          // Rate limited or server overloaded - try next endpoint or retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          console.warn(`⚠️ Rate limited (${response.status}), waiting ${retryAfter}s...`);
          await sleep(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache successful response
        if (useCache) {
          cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data as OverpassResponse;

      } catch (error) {
        lastError = error as Error;
        console.warn(`❌ Overpass request failed: ${lastError.message}`);

        // Exponential backoff
        if (attempt < maxRetries) {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Retrying in ${backoffTime}ms...`);
          await sleep(backoffTime);
        }
      }
    }

    // Move to next endpoint after exhausting retries
    console.log(`🔄 Switching to next endpoint...`);
  }

  // All endpoints failed
  throw new Error(`All Overpass endpoints failed: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Build an Overpass query with proper formatting
 */
export function buildOverpassQuery(params: {
  tags: string[];
  lat: number;
  lon: number;
  radius: number;
  outputFormat?: 'json' | 'xml';
  timeout?: number;
  elementTypes?: ('node' | 'way' | 'relation')[];
  outputGeom?: boolean;
}): string {
  const {
    tags,
    lat,
    lon,
    radius,
    outputFormat = 'json',
    timeout = 25,
    elementTypes = ['node'],
    outputGeom = false,
  } = params;

  const tagQueries = tags.map(tag => {
    const [key, value] = tag.split('=');
    return elementTypes.map(type =>
      `${type}["${key}"="${value}"](around:${radius},${lat},${lon});`
    ).join('\n');
  }).join('\n');

  const output = outputGeom ? 'out geom;' : 'out center;';

  return `
    [out:${outputFormat}][timeout:${timeout}];
    (
      ${tagQueries}
    );
    ${output}
  `.trim();
}

/**
 * Clear the cache
 */
export function clearOverpassCache(): void {
  cache.clear();
  console.log('🗑️ Overpass cache cleared');
}

/**
 * Helper function for sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
