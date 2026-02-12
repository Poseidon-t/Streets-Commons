/**
 * SafeStreets API - Free Data Sources
 *
 * This backend provides access to:
 * - NASA POWER meteorological data (temperature)
 * - NASADEM elevation data via Microsoft Planetary Computer
 * - OpenStreetMap infrastructure via Overpass API
 * - NHTSA FARS fatal crash data (US)
 * - WHO road traffic death rates (international)
 * - Sentinel-2 NDVI + heat island data
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fromUrl } from 'geotiff';
import Stripe from 'stripe';
import helmet from 'helmet';

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (project root)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// PDF parsing function using pdfjs-dist (proper ESM support)
async function parsePDF(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';

  // Extract text from each page
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return { text: fullText, numpages: pdfDoc.numPages };
}

// Configure multer for file uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Stripe (only if key is configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();
const PORT = process.env.PORT || 3002;

// In-memory cache for Overpass responses (30-minute TTL, max 1000 entries)
const overpassCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — OSM data rarely changes
const CACHE_MAX = 1000;

function getCacheKey(query) {
  // Simple hash: use first 200 chars + length as key
  return query.slice(0, 200) + ':' + query.length;
}

function getFromCache(key) {
  const entry = overpassCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    overpassCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict oldest if at capacity
  if (overpassCache.size >= CACHE_MAX) {
    const oldest = overpassCache.keys().next().value;
    overpassCache.delete(oldest);
  }
  overpassCache.set(key, { data, time: Date.now() });
}

// ─── Built-in Analytics ──────────────────────────────────────────────────────
import { createHash } from 'crypto';
import fs from 'fs';

const ANALYTICS_FILE = process.env.ANALYTICS_FILE || '/data/analytics.json';
const ANALYTICS_SECRET = process.env.ANALYTICS_SECRET || (process.env.STRIPE_SECRET_KEY?.slice(0, 16) || 'dev-secret-key');

// In-memory analytics store
const analyticsStore = {
  daily: {},  // { "2026-02-05": { pageViews: 0, ... } }
  allTime: { pageViews: 0, analyses: 0, firstSeen: null },
};

// Track which IPs we've seen today (hashed, for unique visitor count)
const todayVisitors = new Set();
let lastVisitorReset = new Date().toDateString();

// Load analytics from disk on startup
function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
      Object.assign(analyticsStore, data);
      console.log('📊 Analytics loaded from disk');
    }
  } catch (err) {
    console.warn('⚠️ Could not load analytics:', err.message);
  }
}

// Save analytics to disk
function saveAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsStore, null, 2));
  } catch (err) {
    // Silently fail if no volume mounted — analytics still works in-memory
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Could not save analytics:', err.message);
    }
  }
}

// Get today's date key
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Ensure today's entry exists
function ensureTodayExists() {
  const today = getToday();
  if (!analyticsStore.daily[today]) {
    analyticsStore.daily[today] = {
      pageViews: 0,
      uniqueVisitors: 0,
      analyses: 0,
      chatMessages: 0,
      pdfUploads: 0,
      advocacyLetters: 0,
      payments: 0,
      topCountries: {},
      topReferrers: {},
    };
  }
  // Reset visitor tracking at midnight
  const todayStr = new Date().toDateString();
  if (todayStr !== lastVisitorReset) {
    todayVisitors.clear();
    lastVisitorReset = todayStr;
  }
  if (!analyticsStore.allTime.firstSeen) {
    analyticsStore.allTime.firstSeen = today;
  }
  return analyticsStore.daily[today];
}

// Hash IP for privacy (never store raw IP)
function hashIP(ip) {
  return createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
}

// Extract country from Accept-Language header (rough approximation)
function guessCountry(req) {
  const lang = req.get('accept-language') || '';
  const match = lang.match(/[a-z]{2}-([A-Z]{2})/);
  return match ? match[1] : 'XX';
}

// Extract domain from referrer
function getReferrerDomain(referrer) {
  if (!referrer) return 'direct';
  try {
    return new URL(referrer).hostname.replace('www.', '');
  } catch {
    return 'direct';
  }
}

// Track an event
function trackEvent(eventType, req, extra = {}) {
  const today = ensureTodayExists();

  switch (eventType) {
    case 'pageview': {
      today.pageViews++;
      analyticsStore.allTime.pageViews++;

      // Track unique visitors
      const ipHash = hashIP(req.ip || req.headers['x-forwarded-for']);
      if (!todayVisitors.has(ipHash)) {
        todayVisitors.add(ipHash);
        today.uniqueVisitors++;
        analyticsStore.allTime.uniqueVisitors = (analyticsStore.allTime.uniqueVisitors || 0) + 1;
      }

      // Track country
      const country = guessCountry(req);
      today.topCountries[country] = (today.topCountries[country] || 0) + 1;

      // Track referrer
      const referrer = getReferrerDomain(extra.referrer);
      today.topReferrers[referrer] = (today.topReferrers[referrer] || 0) + 1;
      break;
    }
    case 'analysis':
      today.analyses++;
      analyticsStore.allTime.analyses++;
      break;
    case 'chat':
      today.chatMessages++;
      break;
    case 'pdf':
      today.pdfUploads++;
      break;
    case 'advocacy':
      today.advocacyLetters++;
      break;
    case 'payment':
      today.payments++;
      break;
  }
}

// Flush to disk every 60 seconds
loadAnalytics();
setInterval(saveAnalytics, 60 * 1000);

// Also save on shutdown
process.on('SIGTERM', () => {
  console.log('📊 Saving analytics before shutdown...');
  saveAnalytics();
  process.exit(0);
});

// Middleware

// Security headers (Helmet.js)
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for Plausible Analytics
  crossOriginEmbedderPolicy: false, // Allow external resources
}));

// CORS: Restrict to your domain only
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting: 300 requests per minute per IP
// (one analysis = ~6 API calls; supports ~50 analyses/min per user)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
});
app.use('/api/', apiLimiter);

// Parse JSON for all routes EXCEPT Stripe webhook (needs raw body for signature verification)
// Limit body size to prevent DoS attacks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe-webhook') {
    return next();
  }
  express.json({ limit: '1mb' })(req, res, next);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apis: {
      nasaPower: 'available',
      openaq: process.env.OPENAQ_API_KEY ? 'configured' : 'missing key',
      overpass: 'available',
      nasadem: 'available (placeholder)',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Analytics Endpoints ─────────────────────────────────────────────────────

// Frontend beacon — track page views
app.post('/api/track', (req, res) => {
  const { event, referrer } = req.body || {};
  if (event === 'pageview') {
    trackEvent('pageview', req, { referrer });
  }
  res.status(204).end();
});

// JSON stats API (password-protected)
app.get('/api/admin/stats', (req, res) => {
  if (req.query.key !== ANALYTICS_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  ensureTodayExists();
  res.json(analyticsStore);
});

// HTML Dashboard (password-protected)
app.get('/admin', (req, res) => {
  if (req.query.key !== ANALYTICS_SECRET) {
    return res.status(401).send('Unauthorized. Add ?key=YOUR_SECRET to access.');
  }

  ensureTodayExists();
  const today = analyticsStore.daily[getToday()] || {};
  const allTime = analyticsStore.allTime;

  // Get last 7 days for chart
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const day = analyticsStore.daily[key] || {};
    last7Days.push({ date: key.slice(5), views: day.pageViews || 0, analyses: day.analyses || 0 });
  }

  // Sort top items
  const topCountries = Object.entries(today.topCountries || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topReferrers = Object.entries(today.topReferrers || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxViews = Math.max(...last7Days.map(d => d.views), 1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeStreets Analytics</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 20px; color: #1e3a5f; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat { font-size: 36px; font-weight: 700; color: #1e3a5f; }
    .stat-small { font-size: 24px; }
    .label { font-size: 12px; color: #888; margin-top: 4px; }
    .chart { display: flex; align-items: flex-end; gap: 8px; height: 100px; margin-top: 16px; }
    .bar { flex: 1; background: #e8f4f8; border-radius: 4px 4px 0 0; position: relative; min-height: 4px; }
    .bar-fill { position: absolute; bottom: 0; left: 0; right: 0; background: #1e3a5f; border-radius: 4px 4px 0 0; }
    .bar-label { font-size: 10px; text-align: center; color: #666; margin-top: 4px; }
    .list { font-size: 14px; }
    .list-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
    .list-item:last-child { border: none; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SafeStreets Analytics</h1>

    <div class="grid">
      <div class="card">
        <h2>Today</h2>
        <div class="stat">${today.uniqueVisitors || 0}</div>
        <div class="label">unique visitors</div>
        <div class="stat-small" style="margin-top:12px">${today.pageViews || 0}</div>
        <div class="label">page views</div>
      </div>
      <div class="card">
        <h2>Analyses Today</h2>
        <div class="stat">${today.analyses || 0}</div>
        <div class="label">walkability analyses</div>
        <div class="stat-small" style="margin-top:12px">${today.chatMessages || 0}</div>
        <div class="label">AI chat messages</div>
      </div>
      <div class="card">
        <h2>All Time</h2>
        <div class="stat">${allTime.pageViews || 0}</div>
        <div class="label">total page views</div>
        <div class="stat-small" style="margin-top:12px">${allTime.analyses || 0}</div>
        <div class="label">total analyses</div>
      </div>
      <div class="card">
        <h2>Other Today</h2>
        <div class="list">
          <div class="list-item"><span>PDF uploads</span><span>${today.pdfUploads || 0}</span></div>
          <div class="list-item"><span>Advocacy letters</span><span>${today.advocacyLetters || 0}</span></div>
          <div class="list-item"><span>Payment attempts</span><span>${today.payments || 0}</span></div>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Last 7 Days (Page Views)</h2>
        <div class="chart">
          ${last7Days.map(d => `
            <div style="flex:1">
              <div class="bar" style="height:100px">
                <div class="bar-fill" style="height:${(d.views / maxViews) * 100}%"></div>
              </div>
              <div class="bar-label">${d.date}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <h2>Top Referrers (Today)</h2>
        <div class="list">
          ${topReferrers.length ? topReferrers.map(([r, c]) => `<div class="list-item"><span>${r}</span><span>${c}</span></div>`).join('') : '<div class="list-item"><span>No data yet</span></div>'}
        </div>
      </div>
      <div class="card">
        <h2>Top Countries (Today)</h2>
        <div class="list">
          ${topCountries.length ? topCountries.map(([c, n]) => `<div class="list-item"><span>${c}</span><span>${n}</span></div>`).join('') : '<div class="list-item"><span>No data yet</span></div>'}
        </div>
      </div>
    </div>

    <div class="footer">
      Auto-refreshes every 30 seconds · Since ${allTime.firstSeen || 'today'}
    </div>
  </div>
</body>
</html>`;

  res.type('html').send(html);
});

// Overpass API proxy with caching
app.post('/api/overpass', async (req, res) => {
  // Track analysis (every analysis calls overpass)
  trackEvent('analysis', req);

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required parameter: query' });
    }

    // Check cache first
    const cacheKey = getCacheKey(query);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Race all mirrors simultaneously — use the first valid JSON response
    const endpoints = [
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
      'https://overpass.openstreetmap.ru/cgi/interpreter',
      'https://overpass.openstreetmap.fr/api/interpreter',
    ];

    const MIRROR_TIMEOUT = 8000; // 8s per mirror

    // Fire all mirrors at once, resolve with first valid JSON result
    const data = await new Promise((resolve, reject) => {
      let pending = endpoints.length;
      let settled = false;
      const controllers = [];

      endpoints.forEach((endpoint, i) => {
        const controller = new AbortController();
        controllers.push(controller);

        const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT);

        fetch(endpoint, {
          method: 'POST',
          body: query,
          signal: controller.signal,
          headers: { 'Content-Type': 'text/plain', 'Accept': 'application/json' },
        })
          .then(async (response) => {
            clearTimeout(timer);
            if (settled) return;
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const ct = response.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
              await response.text(); // drain body
              throw new Error(`Non-JSON response: ${ct}`);
            }
            return response.json();
          })
          .then((json) => {
            if (settled || !json) return;
            settled = true;
            console.log(`✅ Overpass: ${endpoint} won the race`);
            // Abort remaining mirrors
            controllers.forEach((c, j) => { if (j !== i) c.abort(); });
            resolve(json);
          })
          .catch((err) => {
            clearTimeout(timer);
            pending--;
            if (!settled && pending === 0) {
              reject(new Error('All Overpass mirrors failed'));
            }
          });
      });
    });

    setCache(cacheKey, data);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Overpass error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch Overpass data',
    });
  }
});

// NASA POWER API - Free meteorological data
app.get('/api/nasa-power-temperature', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`☀️  Fetching NASA POWER temperature for: ${lat}, ${lon}`);

    // Get last 30 days of temperature data
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN&community=RE&longitude=${lon}&latitude=${lat}&start=${formatDate(startDate)}&end=${formatDate(endDate)}&format=JSON`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SafeStreets/1.0' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NASA POWER API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.properties || !data.properties.parameter) {
      throw new Error('Invalid response from NASA POWER API');
    }

    // Calculate average temperature from last 30 days
    const temps = data.properties.parameter.T2M;
    const maxTemps = data.properties.parameter.T2M_MAX;
    const minTemps = data.properties.parameter.T2M_MIN;

    const tempValues = Object.values(temps).filter(v => v !== -999);
    const avgTemp = tempValues.reduce((a, b) => a + b, 0) / tempValues.length;

    const maxTempValues = Object.values(maxTemps).filter(v => v !== -999);
    const avgMaxTemp = maxTempValues.reduce((a, b) => a + b, 0) / maxTempValues.length;

    const minTempValues = Object.values(minTemps).filter(v => v !== -999);
    const avgMinTemp = minTempValues.reduce((a, b) => a + b, 0) / minTempValues.length;

    console.log(`✅ NASA POWER temperature: ${avgTemp.toFixed(1)}°C`);

    res.json({
      success: true,
      data: {
        averageTemperature: Math.round(avgTemp * 10) / 10,
        averageMaxTemperature: Math.round(avgMaxTemp * 10) / 10,
        averageMinTemperature: Math.round(avgMinTemp * 10) / 10,
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'NASA POWER (30-day average)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching NASA POWER temperature:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch NASA POWER temperature',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// OpenAQ Air Quality API - Requires API key (V3)
// NOTE: OpenAQ V2 was deprecated Jan 31, 2025. V3 requires free API key from explore.openaq.org
app.get('/api/air-quality', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Check if API key is configured
    const apiKey = process.env.OPENAQ_API_KEY;
    if (!apiKey) {
      console.log(`🌫️  OpenAQ API key not configured - air quality unavailable`);
      return res.json({
        success: true,
        data: null,
        message: 'Air quality data requires OpenAQ API key. Get free key at explore.openaq.org',
      });
    }

    console.log(`🌫️  Fetching OpenAQ air quality for: ${lat}, ${lon}`);

    // OpenAQ V3 API with API key
    const radiusKm = 25;
    const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radiusKm * 1000}&limit=10`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OpenAQ API returned ${response.status} - air quality unavailable`);
      return res.json({
        success: true,
        data: null,
        message: 'Air quality data temporarily unavailable',
      });
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No air quality monitoring stations found within 25km',
      });
    }

    // OpenAQ V3: Fetch latest measurements for each location
    const measurementsPromises = data.results.slice(0, 5).map(async (location) => {
      try {
        const latestUrl = `https://api.openaq.org/v3/locations/${location.id}/latest`;
        const latestResponse = await fetch(latestUrl, {
          headers: {
            'X-API-Key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (!latestResponse.ok) return null;
        const latestData = await latestResponse.json();
        return { location, measurements: latestData.results || [] };
      } catch (error) {
        console.warn(`Failed to fetch measurements for location ${location.id}:`, error.message);
        return null;
      }
    });

    const locationsWithMeasurements = (await Promise.all(measurementsPromises)).filter(Boolean);

    if (locationsWithMeasurements.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No recent air quality measurements available',
      });
    }

    // Aggregate measurements from all stations
    const measurements = {};
    const stationCount = {};

    locationsWithMeasurements.forEach(({ location, measurements: latestMeasurements }) => {
      latestMeasurements.forEach(measurement => {
        // Match sensor ID to parameter name from location.sensors
        const sensor = location.sensors?.find(s => s.id === measurement.sensorsId);
        if (!sensor || !measurement.value) return;

        const paramName = sensor.parameter.name;
        if (!measurements[paramName]) {
          measurements[paramName] = [];
          stationCount[paramName] = 0;
        }
        measurements[paramName].push(measurement.value);
        stationCount[paramName]++;
      });
    });

    // Calculate averages
    const airQuality = {};
    for (const [param, values] of Object.entries(measurements)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      airQuality[param] = {
        value: Math.round(avg * 10) / 10,
        unit: param.includes('ppm') ? 'ppm' : 'µg/m³',
        stationCount: stationCount[param],
      };
    }

    // Calculate AQI score (simplified US EPA formula for PM2.5)
    let aqiScore = null;
    let aqiCategory = null;

    if (airQuality.pm25) {
      const pm25 = airQuality.pm25.value;
      if (pm25 <= 12) {
        aqiScore = 10;
        aqiCategory = 'Good';
      } else if (pm25 <= 35.4) {
        aqiScore = 8;
        aqiCategory = 'Moderate';
      } else if (pm25 <= 55.4) {
        aqiScore = 6;
        aqiCategory = 'Unhealthy for Sensitive Groups';
      } else if (pm25 <= 150.4) {
        aqiScore = 4;
        aqiCategory = 'Unhealthy';
      } else if (pm25 <= 250.4) {
        aqiScore = 2;
        aqiCategory = 'Very Unhealthy';
      } else {
        aqiScore = 0;
        aqiCategory = 'Hazardous';
      }
    }

    console.log(`✅ Air quality: PM2.5 ${airQuality.pm25?.value || 'N/A'} µg/m³`);

    res.json({
      success: true,
      data: {
        measurements: airQuality,
        aqiScore,
        aqiCategory,
        nearestStationDistance: data.results[0]?.distance ? Math.round(data.results[0].distance / 1000) : null,
        stationsFound: data.results.length,
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'OpenAQ (live monitoring stations)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching air quality:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch air quality data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// NASADEM Elevation API - Free elevation data from Microsoft Planetary Computer
app.get('/api/elevation', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`⛰️  Fetching NASADEM elevation for: ${lat}, ${lon}`);

    // Create small bounding box around point (100m buffer)
    const buffer = 100 / 111000; // ~111km per degree
    const bbox = [
      parseFloat(lon) - buffer,
      parseFloat(lat) - buffer,
      parseFloat(lon) + buffer,
      parseFloat(lat) + buffer
    ];

    // Search Microsoft Planetary Computer STAC API for NASADEM
    const searchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['nasadem'],
      bbox: bbox,
      limit: 1
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!searchResponse.ok) {
      throw new Error(`STAC search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.features || searchData.features.length === 0) {
      return res.json({
        success: true,
        data: {
          elevation: 0,
          location: { lat: parseFloat(lat), lon: parseFloat(lon) },
          dataSource: 'NASADEM (default: sea level, no data available)',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Extract elevation asset URL from STAC response
    const feature = searchData.features[0];
    const elevationAsset = feature.assets?.elevation;

    if (!elevationAsset || !elevationAsset.href) {
      throw new Error('No elevation asset found in NASADEM tile');
    }

    // Microsoft Planetary Computer requires signing the URL
    // Use their public SAS signing service
    const signingEndpoint = `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(elevationAsset.href)}`;

    const signResponse = await fetch(signingEndpoint);

    if (!signResponse.ok) {
      throw new Error(`Failed to sign NASADEM URL: ${signResponse.status}`);
    }

    const signedData = await signResponse.json();
    const geotiffUrl = signedData.href;

    console.log(`📡 Fetching signed GeoTIFF...`);

    // Read GeoTIFF and extract pixel value at coordinates
    const tiff = await fromUrl(geotiffUrl);
    const image = await tiff.getImage();

    // Get the bounding box of the GeoTIFF
    const geoBbox = image.getBoundingBox();
    const [minX, minY, maxX, maxY] = geoBbox;

    // Convert lat/lon to pixel coordinates
    const width = image.getWidth();
    const height = image.getHeight();

    const pixelX = Math.floor(((parseFloat(lon) - minX) / (maxX - minX)) * width);
    const pixelY = Math.floor(((maxY - parseFloat(lat)) / (maxY - minY)) * height);

    // Validate pixel coordinates are within bounds
    if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
      throw new Error('Coordinates outside GeoTIFF bounds');
    }

    // Read pixel value (elevation in meters)
    const window = [pixelX, pixelY, pixelX + 1, pixelY + 1];
    const data = await image.readRasters({ window });
    const elevation = Math.round(data[0][0]); // NASADEM has single band

    console.log(`✅ NASADEM elevation: ${elevation}m`);

    res.json({
      success: true,
      data: {
        elevation,
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'NASADEM (Microsoft Planetary Computer)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching NASADEM elevation:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch elevation data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// NASADEM Slope API - Calculate terrain slope from elevation data
app.get('/api/slope', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`🏔️  Calculating slope for: ${lat}, ${lon}`);

    // Helper function to get elevation at a point
    async function getElevationAt(latitude, longitude) {
      // Create small bounding box
      const buffer = 100 / 111000;
      const bbox = [
        parseFloat(longitude) - buffer,
        parseFloat(latitude) - buffer,
        parseFloat(longitude) + buffer,
        parseFloat(latitude) + buffer
      ];

      // Search STAC API
      const searchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: ['nasadem'], bbox, limit: 1 }),
      });

      if (!searchResponse.ok) throw new Error('STAC search failed');
      const searchData = await searchResponse.json();
      if (!searchData.features || searchData.features.length === 0) return null;

      const feature = searchData.features[0];
      const elevationAsset = feature.assets?.elevation;
      if (!elevationAsset) return null;

      // Sign URL
      const signingEndpoint = `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(elevationAsset.href)}`;
      const signResponse = await fetch(signingEndpoint);
      if (!signResponse.ok) throw new Error('Failed to sign URL');
      const signedData = await signResponse.json();

      // Read GeoTIFF
      const tiff = await fromUrl(signedData.href);
      const image = await tiff.getImage();
      const geoBbox = image.getBoundingBox();
      const [minX, minY, maxX, maxY] = geoBbox;

      const width = image.getWidth();
      const height = image.getHeight();

      const pixelX = Math.floor(((parseFloat(longitude) - minX) / (maxX - minX)) * width);
      const pixelY = Math.floor(((maxY - parseFloat(latitude)) / (maxY - minY)) * height);

      if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) return null;

      const window = [pixelX, pixelY, pixelX + 1, pixelY + 1];
      const data = await image.readRasters({ window });
      return data[0][0];
    }

    // Get elevations at 4 neighboring points (N, S, E, W)
    // Using ~30m offset (NASADEM resolution)
    const offset = 0.0003; // Approximately 30 meters at equator

    const [elevCenter, elevN, elevS, elevE, elevW] = await Promise.all([
      getElevationAt(parseFloat(lat), parseFloat(lon)),
      getElevationAt(parseFloat(lat) + offset, parseFloat(lon)),
      getElevationAt(parseFloat(lat) - offset, parseFloat(lon)),
      getElevationAt(parseFloat(lat), parseFloat(lon) + offset),
      getElevationAt(parseFloat(lat), parseFloat(lon) - offset),
    ]);

    if (elevCenter === null || elevN === null || elevS === null || elevE === null || elevW === null) {
      return res.json({
        success: true,
        data: {
          slope: 0,
          slopeCategory: 'Unknown',
          score: 5,
          location: { lat: parseFloat(lat), lon: parseFloat(lon) },
          dataSource: 'NASADEM (insufficient data)',
        },
      });
    }

    // Calculate slope using elevation differences
    const cellSize = 30; // NASADEM resolution in meters
    const dz_dx = (elevE - elevW) / (2 * cellSize); // Horizontal gradient
    const dz_dy = (elevN - elevS) / (2 * cellSize); // Vertical gradient

    // Calculate slope in degrees
    const slopeRadians = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
    const slopeDegrees = slopeRadians * (180 / Math.PI);

    // Categorize slope
    let slopeCategory = '';
    let score = 0;

    if (slopeDegrees < 2) {
      slopeCategory = 'Flat';
      score = 10;
    } else if (slopeDegrees < 5) {
      slopeCategory = 'Gentle';
      score = 8;
    } else if (slopeDegrees < 10) {
      slopeCategory = 'Moderate';
      score = 6;
    } else if (slopeDegrees < 15) {
      slopeCategory = 'Steep';
      score = 4;
    } else {
      slopeCategory = 'Very Steep';
      score = 2;
    }

    console.log(`✅ Slope: ${slopeDegrees.toFixed(2)}° (${slopeCategory})`);

    res.json({
      success: true,
      data: {
        slope: Math.round(slopeDegrees * 100) / 100,
        slopeCategory,
        score,
        elevations: {
          center: Math.round(elevCenter),
          north: Math.round(elevN),
          south: Math.round(elevS),
          east: Math.round(elevE),
          west: Math.round(elevW),
        },
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'NASADEM (Microsoft Planetary Computer)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error calculating slope:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate slope',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Sentinel-2 NDVI API - Calculate vegetation index for tree canopy
app.get('/api/ndvi', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`🌳 Calculating NDVI for: ${lat}, ${lon}`);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Define 800m radius bounding box (approximately 0.007 degrees)
    const radius = 0.007;
    const bbox = [
      longitude - radius,
      latitude - radius,
      longitude + radius,
      latitude + radius,
    ];

    // Search for recent Sentinel-2 imagery (last 60 days, cloud-free)
    const today = new Date();
    const startDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['sentinel-2-l2a'],
      bbox: bbox,
      datetime: `${startDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`,
      limit: 10,
      query: {
        'eo:cloud_cover': {
          lt: 20, // Less than 20% cloud cover
        },
      },
    };

    console.log(`📡 Searching Sentinel-2 imagery...`);
    const stacResponse = await fetch(stacSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!stacResponse.ok) {
      throw new Error(`STAC search failed: ${stacResponse.statusText}`);
    }

    const stacData = await stacResponse.json();

    if (!stacData.features || stacData.features.length === 0) {
      console.log('⚠️  No recent Sentinel-2 imagery found');
      return res.status(200).json({
        success: true,
        data: {
          ndvi: null,
          score: 5, // Default neutral score
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No recent cloud-free satellite imagery available',
        },
      });
    }

    // Get the most recent image
    const mostRecentImage = stacData.features[0];
    console.log(`✅ Found Sentinel-2 image from ${mostRecentImage.properties.datetime}`);

    console.log(`📡 Fetching NIR and Red visual band (lower resolution for speed)...`);

    // Use B8A (Narrow NIR at 20m resolution) and B04 (Red at 10m but we can downsample)
    // to reduce data transfer size
    const b8aAsset = mostRecentImage.assets.B8A; // Narrow NIR at 20m resolution (smaller file)
    const b04Asset = mostRecentImage.assets.B04; // Red at 10m

    if (!b8aAsset || !b04Asset) {
      throw new Error('Missing required spectral bands');
    }

    // Sign the asset URLs
    const signingEndpoint = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

    const [b8aSignedResponse, b04SignedResponse] = await Promise.all([
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b8aAsset.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b04Asset.href)}`),
    ]);

    const b8aSigned = await b8aSignedResponse.json();
    const b04Signed = await b04SignedResponse.json();

    // Read GeoTIFF bands with timeout increase
    const [tiffB8A, tiffB04] = await Promise.all([
      fromUrl(b8aSigned.href),
      fromUrl(b04Signed.href),
    ]);

    const [imageB8A, imageB04] = await Promise.all([
      tiffB8A.getImage(),
      tiffB04.getImage(),
    ]);

    // Get image metadata
    const width = imageB8A.getWidth();
    const height = imageB8A.getHeight();

    // Read a small center sample (100x100 pixels at 20m = 2km x 2km area)
    const sampleSize = 100;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const x0 = Math.max(0, centerX - Math.floor(sampleSize / 2));
    const y0 = Math.max(0, centerY - Math.floor(sampleSize / 2));
    const x1 = Math.min(width, x0 + sampleSize);
    const y1 = Math.min(height, y0 + sampleSize);

    console.log(`📐 Sampling ${x1-x0}x${y1-y0} pixels from center of ${width}x${height} image`);

    // Read small windows from both bands
    const [dataB8A, dataB04] = await Promise.all([
      imageB8A.readRasters({ window: [x0, y0, x1, y1] }),
      imageB04.readRasters({ window: [x0, y0, x1, y1] }),
    ]);

    const nirValues = dataB8A[0];
    const redValues = dataB04[0];

    let ndviSum = 0;
    let validPixels = 0;

    // Calculate NDVI for the sample
    for (let i = 0; i < nirValues.length; i++) {
      const nir = nirValues[i];
      const red = redValues[i];

      // Skip invalid pixels (nodata, clouds, water)
      // Sentinel-2 L2A values are scaled 0-10000
      if (nir > 0 && red > 0 && nir < 10000 && red < 10000) {
        const ndvi = (nir - red) / (nir + red);

        // Valid NDVI range: -1 to 1
        if (ndvi >= -1 && ndvi <= 1) {
          ndviSum += ndvi;
          validPixels++;
        }
      }
    }

    if (validPixels === 0) {
      console.log('⚠️  No valid NDVI pixels found');
      return res.status(200).json({
        success: true,
        data: {
          ndvi: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No valid vegetation data in this area',
        },
      });
    }

    const avgNDVI = ndviSum / validPixels;
    console.log(`✅ Processed ${validPixels}/${nirValues.length} pixels, avg NDVI: ${avgNDVI.toFixed(3)}`);

    // Score NDVI (0-10 scale)
    // NDVI ranges: -1 to 1
    // -1 to 0: Water/bare soil (0 points)
    // 0 to 0.2: Low vegetation (2 points)
    // 0.2 to 0.4: Moderate vegetation (5 points)
    // 0.4 to 0.6: Healthy vegetation (7 points)
    // 0.6 to 1.0: Dense/very healthy vegetation (10 points)

    let score;
    let category;

    if (avgNDVI < 0) {
      score = 0;
      category = 'No Vegetation';
    } else if (avgNDVI < 0.2) {
      score = Math.round((avgNDVI / 0.2) * 2);
      category = 'Sparse Vegetation';
    } else if (avgNDVI < 0.4) {
      score = Math.round(2 + ((avgNDVI - 0.2) / 0.2) * 3);
      category = 'Moderate Vegetation';
    } else if (avgNDVI < 0.6) {
      score = Math.round(5 + ((avgNDVI - 0.4) / 0.2) * 2);
      category = 'Healthy Vegetation';
    } else {
      score = Math.round(7 + ((avgNDVI - 0.6) / 0.4) * 3);
      category = 'Dense Vegetation';
    }

    console.log(`✅ NDVI: ${avgNDVI.toFixed(3)} (${category})`);

    res.json({
      success: true,
      data: {
        ndvi: parseFloat(avgNDVI.toFixed(3)),
        score: score,
        category: category,
        imageDate: mostRecentImage.properties.datetime,
        cloudCover: mostRecentImage.properties['eo:cloud_cover'],
        validPixels: validPixels,
        totalPixels: nirValues.length,
        location: { lat: latitude, lon: longitude },
        dataSource: 'Sentinel-2 L2A (Microsoft Planetary Computer)',
        dataQuality: 'verified',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error calculating NDVI:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate NDVI',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Sentinel-2 Urban Heat Assessment - Surface temperature estimation using SWIR bands
app.get('/api/heat-island', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`🔥 Calculating urban heat for: ${lat}, ${lon}`);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Define search area (800m radius = approximately 0.007 degrees)
    const radius = 0.007;
    const bbox = [
      longitude - radius,
      latitude - radius,
      longitude + radius,
      latitude + radius,
    ];

    // Search for recent Sentinel-2 imagery (last 60 days, cloud-free)
    const today = new Date();
    const startDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['sentinel-2-l2a'],
      bbox: bbox,
      datetime: `${startDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`,
      limit: 10,
      query: {
        'eo:cloud_cover': {
          lt: 20,
        },
      },
    };

    console.log(`📡 Searching Sentinel-2 imagery...`);
    const stacResponse = await fetch(stacSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!stacResponse.ok) {
      throw new Error(`STAC search failed: ${stacResponse.statusText}`);
    }

    const stacData = await stacResponse.json();

    if (!stacData.features || stacData.features.length === 0) {
      console.log('⚠️  No recent Sentinel-2 imagery found');
      return res.status(200).json({
        success: true,
        data: {
          heatIslandEffect: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No recent cloud-free satellite imagery available',
        },
      });
    }

    const mostRecentImage = stacData.features[0];
    console.log(`✅ Found Sentinel-2 image from ${mostRecentImage.properties.datetime}`);

    console.log(`📡 Fetching SWIR bands for surface temperature...`);

    // Get SWIR bands (B11 and B12 at 20m resolution) + NIR (B8A) and Red (B04) for NDVI
    const b11AssetHeat = mostRecentImage.assets.B11; // SWIR 1 (1610nm) - 20m
    const b12AssetHeat = mostRecentImage.assets.B12; // SWIR 2 (2190nm) - 20m
    const b8aAssetHeat = mostRecentImage.assets.B8A; // NIR (865nm) - 20m
    const b04AssetHeat = mostRecentImage.assets.B04; // Red (665nm) - 10m

    if (!b11AssetHeat || !b12AssetHeat || !b8aAssetHeat || !b04AssetHeat) {
      throw new Error('Missing required spectral bands');
    }

    // Sign the asset URLs
    const signingEndpoint = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

    const [b11SignedResponse, b12SignedResponse, b8aSignedResponseHeat, b04SignedResponseHeat] = await Promise.all([
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b11AssetHeat.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b12AssetHeat.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b8aAssetHeat.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b04AssetHeat.href)}`),
    ]);

    const [b11Signed, b12Signed, b8aSignedHeat, b04SignedHeat] = await Promise.all([
      b11SignedResponse.json(),
      b12SignedResponse.json(),
      b8aSignedResponseHeat.json(),
      b04SignedResponseHeat.json(),
    ]);

    // Read GeoTIFF bands
    const [tiffB11, tiffB12, tiffB8AHeat, tiffB04Heat] = await Promise.all([
      fromUrl(b11Signed.href),
      fromUrl(b12Signed.href),
      fromUrl(b8aSignedHeat.href),
      fromUrl(b04SignedHeat.href),
    ]);

    const [imageB11, imageB12, imageB8AHeat, imageB04Heat] = await Promise.all([
      tiffB11.getImage(),
      tiffB12.getImage(),
      tiffB8AHeat.getImage(),
      tiffB04Heat.getImage(),
    ]);

    // Get image metadata
    const width = imageB11.getWidth();
    const height = imageB11.getHeight();

    // Read a small center sample (100x100 pixels at 20m = 2km x 2km area)
    const sampleSize = 100;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const x0 = Math.max(0, centerX - Math.floor(sampleSize / 2));
    const y0 = Math.max(0, centerY - Math.floor(sampleSize / 2));
    const x1 = Math.min(width, x0 + sampleSize);
    const y1 = Math.min(height, y0 + sampleSize);

    console.log(`📐 Sampling ${x1-x0}x${y1-y0} pixels from center`);

    // Read small windows from all bands
    const [dataB11, dataB12, dataB8AHeat, dataB04Heat] = await Promise.all([
      imageB11.readRasters({ window: [x0, y0, x1, y1] }),
      imageB12.readRasters({ window: [x0, y0, x1, y1] }),
      imageB8AHeat.readRasters({ window: [x0, y0, x1, y1] }),
      imageB04Heat.readRasters({ window: [x0, y0, x1, y1] }),
    ]);

    const swir1Values = dataB11[0];
    const swir2Values = dataB12[0];
    const nirValues = dataB8AHeat[0];
    const redValues = dataB04Heat[0];

    // Calculate brightness temperature (proxy) and separate urban vs vegetation areas
    // Also compute NDBI (Normalized Difference Built-up Index)
    let urbanTempSum = 0;
    let urbanPixels = 0;
    let vegetationTempSum = 0;
    let vegetationPixels = 0;
    let ndbiSum = 0;
    let ndbiCount = 0;

    for (let i = 0; i < swir1Values.length; i++) {
      const swir1 = swir1Values[i];
      const swir2 = swir2Values[i];
      const nir = nirValues[i];
      const red = redValues[i];

      // Skip invalid pixels
      if (swir1 > 0 && swir2 > 0 && nir > 0 && red > 0 &&
          swir1 < 10000 && swir2 < 10000 && nir < 10000 && red < 10000) {

        // Calculate NDVI to distinguish vegetation from urban
        const ndvi = (nir - red) / (nir + red);

        // NDBI: (SWIR - NIR) / (SWIR + NIR) — measures built-up density
        const ndbiDenom = swir1 + nir;
        if (ndbiDenom > 0) {
          ndbiSum += (swir1 - nir) / ndbiDenom;
          ndbiCount++;
        }

        // Brightness temperature proxy (average of SWIR bands, normalized)
        const brightnessTemp = (swir1 + swir2) / 2;

        if (ndvi > 0.3) {
          // Vegetation pixel (NDVI > 0.3)
          vegetationTempSum += brightnessTemp;
          vegetationPixels++;
        } else {
          // Urban/bare soil pixel (NDVI <= 0.3)
          urbanTempSum += brightnessTemp;
          urbanPixels++;
        }
      }
    }

    // Building Density via NDBI
    const avgNdbi = ndbiCount > 0 ? ndbiSum / ndbiCount : null;
    let buildingDensityScore = 50; // default
    if (avgNdbi !== null) {
      // NDBI range: -1 to 1. Higher = more built-up.
      // Score inverted: less built-up = better for walkability comfort
      // NDBI > 0.2 = heavily built (score 20), < -0.1 = green (score 100)
      if (avgNdbi < -0.1) buildingDensityScore = 100;
      else if (avgNdbi < 0) buildingDensityScore = 85;
      else if (avgNdbi < 0.1) buildingDensityScore = 65;
      else if (avgNdbi < 0.2) buildingDensityScore = 40;
      else buildingDensityScore = 20;
    }

    if (urbanPixels === 0 && vegetationPixels === 0) {
      console.log('⚠️  No valid pixels found');
      return res.status(200).json({
        success: true,
        data: {
          heatIslandEffect: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No valid surface temperature data',
        },
      });
    }

    // Calculate average temperatures
    const avgUrbanTemp = urbanPixels > 0 ? urbanTempSum / urbanPixels : null;
    const avgVegetationTemp = vegetationPixels > 0 ? vegetationTempSum / vegetationPixels : null;

    // Calculate heat island effect (difference between urban and vegetation)
    let heatIslandEffect = null;
    let score = 5;
    let category = 'Unknown';

    if (avgUrbanTemp !== null && avgVegetationTemp !== null) {
      // Normalize the difference (SWIR values are 0-10000, scale to approximate °C difference)
      // Typical urban-vegetation difference is 5-15°C, SWIR difference ~500-1500
      heatIslandEffect = ((avgUrbanTemp - avgVegetationTemp) / 100);

      // Score based on heat island effect
      // Lower difference = better (cooler streets)
      if (heatIslandEffect < 2) {
        score = 10;
        category = 'Minimal Heat Island';
      } else if (heatIslandEffect < 5) {
        score = 8;
        category = 'Low Heat Island';
      } else if (heatIslandEffect < 8) {
        score = 6;
        category = 'Moderate Heat Island';
      } else if (heatIslandEffect < 12) {
        score = 4;
        category = 'Significant Heat Island';
      } else {
        score = 2;
        category = 'Severe Heat Island';
      }
    } else if (avgUrbanTemp !== null) {
      // Only urban pixels (no vegetation for comparison)
      score = 3;
      category = 'Dense Urban (No Vegetation Reference)';
    } else if (avgVegetationTemp !== null) {
      // Only vegetation pixels (ideal!)
      score = 10;
      category = 'Natural/Park Area';
    }

    console.log(`✅ Heat Island Effect: ${heatIslandEffect ? heatIslandEffect.toFixed(2) + '°C' : 'N/A'} (${category})`);

    res.json({
      success: true,
      data: {
        heatIslandEffect: heatIslandEffect ? parseFloat(heatIslandEffect.toFixed(2)) : null,
        score: score,
        category: category,
        urbanPixels: urbanPixels,
        vegetationPixels: vegetationPixels,
        totalPixels: swir1Values.length,
        buildingDensity: {
          ndbi: avgNdbi !== null ? parseFloat(avgNdbi.toFixed(3)) : null,
          score: buildingDensityScore,
        },
        imageDate: mostRecentImage.properties.datetime,
        cloudCover: mostRecentImage.properties['eo:cloud_cover'],
        location: { lat: latitude, lon: longitude },
        dataSource: 'Sentinel-2 L2A SWIR Bands (Microsoft Planetary Computer)',
        dataQuality: 'verified',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error calculating heat island:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate heat island effect',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// ====================
// POPULATION DENSITY
// ====================

app.get('/api/population-density', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    console.log(`👥 Fetching population density for: ${latitude}, ${longitude}`);

    // Search GHS-POP (Global Human Settlement Population) via Planetary Computer
    const buffer = 0.005; // ~500m
    const bbox = [longitude - buffer, latitude - buffer, longitude + buffer, latitude + buffer];

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['ghs-pop'],
      bbox,
      limit: 1,
      sortby: [{ field: 'datetime', direction: 'desc' }],
    };

    const stacResponse = await fetch(stacSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!stacResponse.ok) throw new Error(`STAC search failed: ${stacResponse.statusText}`);
    const stacData = await stacResponse.json();

    if (!stacData.features || stacData.features.length === 0) {
      console.log('⚠️  No GHS-POP data found, using fallback estimate');
      return res.json({
        success: true,
        data: {
          populationDensity: null,
          score: 50,
          category: 'No Data',
          dataSource: 'GHS-POP (no coverage)',
          dataQuality: 'estimated',
        },
      });
    }

    const feature = stacData.features[0];
    const populationAsset = feature.assets?.population_count || feature.assets?.data;
    if (!populationAsset) {
      throw new Error('No population count asset in GHS-POP feature');
    }

    // Sign URL
    const signingEndpoint = `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(populationAsset.href)}`;
    const signResponse = await fetch(signingEndpoint);
    if (!signResponse.ok) throw new Error('Failed to sign URL');
    const signedData = await signResponse.json();

    // Read GeoTIFF
    const tiff = await fromUrl(signedData.href);
    const image = await tiff.getImage();
    const geoBbox = image.getBoundingBox();
    const [minX, minY, maxX, maxY] = geoBbox;
    const width = image.getWidth();
    const height = image.getHeight();

    const pixelX = Math.floor(((longitude - minX) / (maxX - minX)) * width);
    const pixelY = Math.floor(((maxY - latitude) / (maxY - minY)) * height);

    if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
      return res.json({
        success: true,
        data: { populationDensity: null, score: 50, category: 'Out of Bounds', dataQuality: 'estimated' },
      });
    }

    // Read a small window around the point
    const sampleR = 2;
    const x0 = Math.max(0, pixelX - sampleR);
    const y0 = Math.max(0, pixelY - sampleR);
    const x1 = Math.min(width, pixelX + sampleR + 1);
    const y1 = Math.min(height, pixelY + sampleR + 1);

    const rasterData = await image.readRasters({ window: [x0, y0, x1, y1] });
    const values = rasterData[0];

    // GHS-POP gives population count per ~100m cell → people/km² ≈ value × 100
    let sum = 0;
    let validCount = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v > 0 && v < 1e6) { // filter nodata
        sum += v;
        validCount++;
      }
    }

    // Average population per cell, scaled to per km²
    // GHS-POP R2023 uses 100m grid → 1 cell = 0.01 km² → density = count / 0.01
    const avgPopPerCell = validCount > 0 ? sum / validCount : 0;
    const populationDensity = Math.round(avgPopPerCell / 0.01);

    // Score: higher density = better walkability context
    let score, category;
    if (populationDensity > 10000) { score = 100; category = 'Very High Density'; }
    else if (populationDensity > 5000) { score = 85; category = 'High Density'; }
    else if (populationDensity > 2000) { score = 65; category = 'Medium Density'; }
    else if (populationDensity > 500) { score = 40; category = 'Low Density'; }
    else { score = 20; category = 'Very Low Density'; }

    console.log(`✅ Population Density: ${populationDensity} people/km² (${category})`);

    res.json({
      success: true,
      data: {
        populationDensity,
        score,
        category,
        dataSource: 'GHS-POP R2023 (European Commission JRC)',
        dataQuality: 'verified',
        location: { lat: latitude, lon: longitude },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching population density:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch population density',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// =====================
// CRASH / FATALITY DATA
// =====================

// WHO road traffic death rates per 100k (2021) — static dataset, updates every 2-3 years
// Source: WHO Global Health Observatory, Indicator RS_198
import { readFileSync } from 'fs';
const WHO_DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'whoRoadDeaths.json');
let whoRoadDeaths = {};
try {
  whoRoadDeaths = JSON.parse(readFileSync(WHO_DATA_PATH, 'utf-8'));
} catch (e) {
  console.warn('⚠️  WHO road deaths data not found, international crash data disabled');
}

// In-memory cache for FARS county data (static historical data)
const farsCache = new Map();
const FARS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nominatim country code is ISO 3166-1 alpha-2, WHO uses alpha-3
// Only need the US check here; for WHO lookup we accept alpha-2 and map to alpha-3
const iso2to3 = {
  AF:'AFG',AL:'ALB',DZ:'DZA',AD:'AND',AO:'AGO',AG:'ATG',AR:'ARG',AM:'ARM',AU:'AUS',AT:'AUT',
  AZ:'AZE',BS:'BHS',BH:'BHR',BD:'BGD',BB:'BRB',BY:'BLR',BE:'BEL',BZ:'BLZ',BJ:'BEN',BT:'BTN',
  BO:'BOL',BA:'BIH',BW:'BWA',BR:'BRA',BN:'BRN',BG:'BGR',BI:'BDI',KH:'KHM',CM:'CMR',CA:'CAN',
  CV:'CPV',CF:'CAF',CL:'CHL',CN:'CHN',CO:'COL',KM:'COM',CD:'COD',CR:'CRI',CI:'CIV',HR:'HRV',
  CU:'CUB',CY:'CYP',DK:'DNK',DJ:'DJI',DM:'DMA',DO:'DOM',EC:'ECU',EG:'EGY',ER:'ERI',EE:'EST',
  ET:'ETH',FJ:'FJI',FI:'FIN',FR:'FRA',GA:'GAB',GM:'GMB',DE:'DEU',GH:'GHA',GR:'GRC',GD:'GRD',
  GT:'GTM',GN:'GIN',GW:'GNB',GY:'GUY',HT:'HTI',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',ID:'IDN',
  IR:'IRN',IQ:'IRQ',IE:'IRL',IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',KE:'KEN',
  KI:'KIR',KW:'KWT',KG:'KGZ',LA:'LAO',LV:'LVA',LB:'LBN',LS:'LSO',LY:'LBY',LT:'LTU',MG:'MDG',
  MW:'MWI',MY:'MYS',MV:'MDV',ML:'MLI',MT:'MLT',MH:'MHL',MR:'MRT',MU:'MUS',MX:'MEX',MD:'MDA',
  MC:'MCO',MN:'MNG',ME:'MNE',MZ:'MOZ',MM:'MMR',NA:'NAM',NR:'NRU',NP:'NPL',NL:'NLD',NZ:'NZL',
  NI:'NIC',NE:'NER',NG:'NGA',MK:'MKD',NO:'NOR',OM:'OMN',PK:'PAK',PW:'PLW',PS:'PSE',PA:'PAN',
  PG:'PNG',PY:'PRY',PH:'PHL',PL:'POL',PT:'PRT',PR:'PRI',QA:'QAT',KR:'KOR',RO:'ROU',RU:'RUS',
  RW:'RWA',KN:'KNA',LC:'LCA',VC:'VCT',WS:'WSM',SM:'SMR',SA:'SAU',RS:'SRB',SL:'SLE',SG:'SGP',
  SI:'SVN',SB:'SLB',SO:'SOM',ZA:'ZAF',SS:'SSD',ES:'ESP',LK:'LKA',SD:'SDN',SR:'SUR',SZ:'SWZ',
  SE:'SWE',CH:'CHE',SY:'SYR',TJ:'TJK',TZ:'TZA',TH:'THA',TL:'TLS',TG:'TGO',TO:'TON',TT:'TTO',
  TR:'TUR',TM:'TKM',TV:'TUV',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',US:'USA',UY:'URY',UZ:'UZB',
  VU:'VUT',VE:'VEN',VN:'VNM',YE:'YEM',ZM:'ZMB',GQ:'GNQ',PE:'PER',CZ:'CZE',SK:'SVK',HR:'HRV',
};

app.get('/api/crash-data', async (req, res) => {
  try {
    const { lat, lon, country } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const countryCode = (country || '').toUpperCase();
    const isUS = countryCode === 'US' || countryCode === 'USA';

    // --- Non-US: return WHO country-level data ---
    if (!isUS) {
      const iso3 = iso2to3[countryCode] || countryCode; // try direct if already alpha-3
      const whoEntry = whoRoadDeaths[iso3];

      if (!whoEntry) {
        return res.json({
          success: true,
          data: null, // no data available for this country
        });
      }

      console.log(`🌍 WHO crash data for ${whoEntry.name}: ${whoEntry.rate}/100k`);

      return res.json({
        success: true,
        data: {
          type: 'country',
          deathRatePer100k: whoEntry.rate,
          totalDeaths: 0, // WHO RS_198 only gives rate, not absolute count
          countryName: whoEntry.name,
          year: whoRoadDeaths._meta?.year || 2021,
          dataSource: 'WHO Global Health Observatory',
        },
      });
    }

    // --- US: FARS street-level data ---
    console.log(`🚨 Fetching US crash data for: ${lat}, ${lon}`);

    // Step 1: Get state/county FIPS from FCC Census API
    const fccController = new AbortController();
    const fccTimeout = setTimeout(() => fccController.abort(), 10000);

    const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`;
    const fccResponse = await fetch(fccUrl, {
      signal: fccController.signal,
      headers: { 'User-Agent': 'SafeStreets/1.0' },
    });
    clearTimeout(fccTimeout);

    if (!fccResponse.ok) {
      throw new Error(`FCC API returned ${fccResponse.status}`);
    }

    const fccData = await fccResponse.json();

    if (!fccData.results || fccData.results.length === 0) {
      // Not a valid US location (e.g. ocean, territory not covered)
      return res.json({ success: true, data: null });
    }

    const stateFips = fccData.results[0].state_fips;
    const countyFips = fccData.results[0].county_fips;
    const countyName = fccData.results[0].county_name || '';

    if (!stateFips || !countyFips) {
      return res.json({ success: true, data: null });
    }

    console.log(`📍 FIPS: state=${stateFips}, county=${countyFips} (${countyName})`);

    // Step 2: Query FARS (with caching)
    const fromYear = 2018;
    const toYear = 2022;
    const cacheKey = `crashes:${stateFips}:${countyFips}:${fromYear}-${toYear}`;

    let crashes;
    const cached = farsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FARS_CACHE_TTL) {
      crashes = cached.data;
      console.log(`📦 FARS cache hit: ${crashes.length} crashes in ${countyName}`);
    } else {
      const farsUrl = `https://crashviewer.nhtsa.dot.gov/CrashAPI/crashes/GetCrashesByLocation?fromCaseYear=${fromYear}&toCaseYear=${toYear}&state=${stateFips}&county=${countyFips}&format=json`;

      const farsController = new AbortController();
      const farsTimeout = setTimeout(() => farsController.abort(), 15000);

      const farsResponse = await fetch(farsUrl, {
        signal: farsController.signal,
        headers: { 'User-Agent': 'SafeStreets/1.0' },
      });
      clearTimeout(farsTimeout);

      if (!farsResponse.ok) {
        throw new Error(`FARS API returned ${farsResponse.status}`);
      }

      const farsData = await farsResponse.json();

      // FARS returns { Results: [{ ... }] } or array depending on format
      crashes = Array.isArray(farsData) ? farsData :
        (farsData.Results || farsData.results || []);

      // Flatten if nested arrays
      if (crashes.length > 0 && Array.isArray(crashes[0])) {
        crashes = crashes.flat();
      }

      farsCache.set(cacheKey, { data: crashes, timestamp: Date.now() });
      console.log(`✅ FARS: ${crashes.length} total crashes in ${countyName} (${fromYear}-${toYear})`);
    }

    // Step 3: Filter crashes within 800m
    const radiusMeters = 800;
    const nearbyCrashes = [];

    for (const crash of crashes) {
      const crashLat = parseFloat(crash.LATITUDE || crash.latitude);
      const crashLon = parseFloat(crash.LONGITUD || crash.LONGITUDE || crash.longitude || crash.longitud);

      if (isNaN(crashLat) || isNaN(crashLon) || crashLat === 0 || crashLon === 0) continue;

      const dist = haversineDistance(latNum, lonNum, crashLat, crashLon);
      if (dist <= radiusMeters) {
        nearbyCrashes.push({
          distance: Math.round(dist),
          fatalities: parseInt(crash.FATALS || crash.fatals || '1', 10),
          year: parseInt(crash.CaseYear || crash.CASEYEAR || crash.caseyear || '0', 10),
          road: crash.TWAY_ID || crash.tway_id || 'Unknown road',
          totalVehicles: parseInt(crash.TOTALVEHICLES || crash.totalvehicles || '0', 10),
        });
      }
    }

    // Step 4: Aggregate
    const totalCrashes = nearbyCrashes.length;
    const totalFatalities = nearbyCrashes.reduce((sum, c) => sum + c.fatalities, 0);

    // Yearly breakdown
    const yearMap = {};
    for (let y = fromYear; y <= toYear; y++) yearMap[y] = { year: y, crashes: 0, fatalities: 0 };
    for (const c of nearbyCrashes) {
      if (yearMap[c.year]) {
        yearMap[c.year].crashes++;
        yearMap[c.year].fatalities += c.fatalities;
      }
    }
    const yearlyBreakdown = Object.values(yearMap);

    // Nearest crash
    const nearest = nearbyCrashes.sort((a, b) => a.distance - b.distance)[0] || null;

    console.log(`🚨 Result: ${totalCrashes} crashes, ${totalFatalities} fatalities within ${radiusMeters}m`);

    res.json({
      success: true,
      data: {
        type: 'local',
        totalCrashes,
        totalFatalities,
        yearRange: { from: fromYear, to: toYear },
        yearlyBreakdown,
        nearestCrash: nearest ? {
          distance: nearest.distance,
          year: nearest.year,
          fatalities: nearest.fatalities,
          road: nearest.road,
        } : undefined,
        radiusMeters,
        dataSource: 'NHTSA FARS',
      },
    });

  } catch (error) {
    console.error('❌ Error fetching crash data:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch crash data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// =====================
// GEMINI AI BUDGET ANALYSIS
// =====================

// Budget analysis endpoint with file upload support (PDF, CSV, text)
app.post('/api/analyze-budget', upload.single('file'), async (req, res) => {
  // Track PDF upload
  trackEvent('pdf', req);

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: 'Gemini API not configured. Add GEMINI_API_KEY to .env file.',
      });
    }

    let budgetText = '';
    const locationName = req.body.locationName || 'Unknown location';

    // Handle file upload
    if (req.file) {
      const { buffer, mimetype, originalname } = req.file;
      console.log(`📄 Processing file: ${originalname} (${mimetype})`);

      if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
        // Parse PDF
        try {
          const pdfData = await parsePDF(buffer);
          budgetText = pdfData.text;
          console.log(`📄 Extracted ${budgetText.length} characters from PDF`);
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          return res.status(400).json({ error: 'Failed to parse PDF. Please try a different file.' });
        }
      } else if (mimetype === 'text/csv' || originalname.endsWith('.csv')) {
        // CSV file
        budgetText = buffer.toString('utf-8');
      } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
        // Plain text
        budgetText = buffer.toString('utf-8');
      } else {
        // Try to read as text
        budgetText = buffer.toString('utf-8');
      }
    } else if (req.body.budgetText) {
      // Fallback to text in request body
      budgetText = req.body.budgetText;
    }

    if (!budgetText || budgetText.length < 50) {
      return res.status(400).json({ error: 'Could not extract text from file. Please try a different format.' });
    }

    console.log(`🤖 Analyzing budget for ${locationName}... (${budgetText.length} chars)`);

    const prompt = `You are a walkability infrastructure analyst specializing in municipal budgets. Analyze the following budget document and identify ALL spending related to walkability, pedestrian infrastructure, and street safety.

BUDGET DOCUMENT:
${budgetText.slice(0, 30000)}

LOCATION: ${locationName}

ANALYSIS FRAMEWORK:
1. Identify ALL budget line items that could impact walkability
2. Categorize spending into clear categories
3. Calculate percentages based on total budget
4. Provide specific, actionable recommendations
5. Estimate potential walkability score improvement

Respond with a JSON object (no markdown, just pure JSON) with this exact structure:
{
  "insights": [
    {
      "category": "Category name",
      "amount": "Dollar amount (e.g., $2.4M, ฿15M, €500K)",
      "percentage": "X% of total",
      "relevant": true/false,
      "recommendation": "Specific actionable recommendation"
    }
  ],
  "summary": {
    "totalWalkabilitySpending": "Total walkability-related spending",
    "percentageOfBudget": "X% of total budget",
    "recommendedReallocation": "Suggested reallocation amount",
    "priorityAreas": ["Priority 1", "Priority 2", "Priority 3"],
    "estimatedScoreImpact": "+X.X points improvement possible"
  }
}

WALKABILITY CATEGORIES TO IDENTIFY:
- Sidewalks & Footpaths (construction, repair, widening)
- Pedestrian Crossings (zebra crossings, signals, raised crosswalks)
- Street Lighting (pedestrian-focused lighting)
- Traffic Calming (speed bumps, chicanes, road diets)
- ADA/Accessibility (curb cuts, tactile paving, ramps)
- Bike Infrastructure (lanes, parking, shared paths)
- Parks & Green Spaces (paths, connectivity, shade)
- Public Transit (bus stops, stations, first/last mile)
- Road Maintenance (portion affecting pedestrian areas)
- Traffic Management (signals, enforcement)
- Urban Planning (pedestrian zones, plazas)
- Safety Programs (education, enforcement)

Be thorough and identify ALL relevant line items. Use the actual currency from the document.`;

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('No response from Gemini');
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let analysisResult;
    try {
      // Remove markdown code blocks if present
      const jsonStr = textResponse.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', textResponse);
      throw new Error('Failed to parse AI response');
    }

    console.log(`✅ Budget analysis complete: ${analysisResult.insights?.length || 0} categories found`);

    res.json({
      success: true,
      analysis: analysisResult,
    });

  } catch (error) {
    console.error('❌ Budget analysis error:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze budget',
    });
  }
});

// Helper function to call Groq API (primary - faster and more generous limits)
async function callGroqAPI(prompt, groqKey) {
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];

  for (const model of models) {
    try {
      console.log(`🚀 Trying Groq ${model}...`);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.choices?.[0]?.message?.content;
        if (textResponse) {
          console.log(`✅ Success with Groq ${model}`);
          return textResponse;
        }
      }

      if (response.status === 429) {
        console.log(`⏳ Rate limited on Groq ${model}, trying next model...`);
        continue;
      }

      if (response.status === 404) {
        console.log(`⚠️ Groq model ${model} not available, trying next...`);
        continue;
      }

      const errorText = await response.text();
      console.error(`Groq API error (${model}):`, errorText);

    } catch (error) {
      console.error(`Network error with Groq ${model}:`, error.message);
    }
  }

  return null; // Groq failed, will try Gemini as fallback
}

// Helper function to call Gemini API (fallback)
async function callGeminiAPI(prompt, geminiKey) {
  const models = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];

  for (const model of models) {
    try {
      console.log(`🤖 Trying Gemini ${model}...`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          console.log(`✅ Success with Gemini ${model}`);
          return textResponse;
        }
      }

      if (response.status === 429 || response.status === 404) {
        console.log(`⚠️ Gemini ${model} unavailable, trying next...`);
        continue;
      }

      const errorText = await response.text();
      console.error(`Gemini API error (${model}):`, errorText);

    } catch (error) {
      console.error(`Network error with Gemini ${model}:`, error.message);
    }
  }

  return null;
}

// Combined AI caller - tries Groq first, then Gemini
async function callAIWithFallback(prompt, groqKey, geminiKey) {
  // Try Groq first (faster, better rate limits)
  if (groqKey) {
    const groqResult = await callGroqAPI(prompt, groqKey);
    if (groqResult) return groqResult;
  }

  // Fallback to Gemini
  if (geminiKey) {
    const geminiResult = await callGeminiAPI(prompt, geminiKey);
    if (geminiResult) return geminiResult;
  }

  throw new Error('All AI providers failed. Please try again later.');
}

// Location-based budget analysis - provides walkability investment guidance
// NOTE: This provides general guidance and recommendations, NOT actual budget data
// Real budget data requires official municipal documents
app.post('/api/analyze-budget-location', async (req, res) => {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return res.status(500).json({
        error: 'No AI API configured. Add GROQ_API_KEY or GEMINI_API_KEY to .env file.',
      });
    }

    const { city, country, displayName, lat, lon } = req.body;

    if (!city && !displayName) {
      return res.status(400).json({ error: 'Missing location information' });
    }

    const locationName = city || displayName.split(',')[0];
    const fullLocation = displayName || `${city}, ${country}`;

    console.log(`🔍 Generating walkability investment guidance for: ${fullLocation}`);

    const prompt = `You are a walkability infrastructure consultant providing investment guidance for ${fullLocation}.

LOCATION: ${fullLocation}
COUNTRY: ${country || 'Unknown'}

Your task is to provide ACTIONABLE RECOMMENDATIONS for improving walkability in this location.

DO NOT make up specific budget numbers or claim to have actual municipal budget data.

Instead, provide:
1. Key walkability infrastructure categories that need investment
2. Relative priority (High/Medium/Low) for each category
3. Specific, actionable recommendations based on typical needs for this type of location
4. What percentage of a typical municipal infrastructure budget SHOULD ideally go to walkability (based on WHO and urban planning best practices)

Respond with a JSON object (no markdown, just pure JSON):
{
  "insights": [
    {
      "category": "Category name",
      "priority": "High/Medium/Low",
      "currentState": "Brief assessment of typical conditions in this type of location",
      "relevant": true,
      "recommendation": "Specific actionable recommendation"
    }
  ],
  "summary": {
    "overallAssessment": "Brief overall assessment of walkability investment needs",
    "topPriorities": ["Priority 1", "Priority 2", "Priority 3"],
    "idealBudgetAllocation": "X-Y% of infrastructure budget (based on WHO guidelines)",
    "keyActions": ["Action 1", "Action 2", "Action 3"]
  },
  "disclaimer": "This is general guidance based on urban planning best practices, not actual budget data. Contact your local municipality for official budget information.",
  "resources": [
    {
      "name": "Resource name",
      "description": "Brief description",
      "type": "Official website/Report/Guide"
    }
  ]
}

CATEGORIES TO ASSESS:
1. Sidewalks & Footpaths
2. Pedestrian Crossings
3. Street Lighting
4. Traffic Calming
5. Accessibility (ADA/Universal Design)
6. Bicycle Infrastructure
7. Parks & Green Spaces
8. Public Transit Connectivity
9. Pedestrian Safety Programs

Base your assessment on:
- The type of city/area (urban density, climate, development level)
- Common walkability challenges in ${country || 'this region'}
- International best practices (WHO, UN-Habitat guidelines)

Be specific to ${locationName} where possible, but be honest that this is guidance, not actual budget data.`;

    // Call AI with fallback (Groq first, then Gemini)
    const textResponse = await callAIWithFallback(prompt, groqKey, geminiKey);

    // Parse JSON from response (handle potential markdown wrapping)
    let analysisResult;
    try {
      const jsonStr = textResponse.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', textResponse);
      throw new Error('Failed to parse AI response');
    }

    console.log(`✅ Walkability guidance complete: ${analysisResult.insights?.length || 0} categories assessed`);

    res.json({
      success: true,
      analysis: analysisResult,
      location: fullLocation,
      isGuidance: true, // Flag to indicate this is guidance, not actual data
    });

  } catch (error) {
    console.error('❌ Budget guidance error:', error);

    // User-friendly error messages
    let userMessage = error.message || 'Failed to generate guidance for this location';
    if (error.message?.includes('rate limited') || error.message?.includes('quota')) {
      userMessage = 'AI service is temporarily busy. Please wait a minute and try again.';
    }

    res.status(500).json({
      error: userMessage,
    });
  }
});

// =====================
// STRIPE PAYMENT API
// =====================

// Stripe checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  // Track payment attempt
  trackEvent('payment', req);

  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env file.',
      });
    }

    const { email, tier, locationName, userId, metadata } = req.body;

    if (!email || !tier) {
      return res.status(400).json({ error: 'Missing required fields: email, tier' });
    }

    // Define pricing
    const pricing = {
      advocate: {
        amount: 1900, // $19 in cents
        name: 'SafeStreets Advocate',
        description: 'Streetmix, 3DStreet, Policy Reports, Budget Analysis',
      },
    };

    const selectedPricing = pricing[tier];
    if (!selectedPricing) {
      return res.status(400).json({ error: 'Invalid tier. Must be "advocate"' });
    }

    console.log(`💳 Creating checkout session for ${email} - ${tier} tier`);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPricing.name,
              description: `${selectedPricing.description} for ${locationName}`,
            },
            unit_amount: selectedPricing.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment=success&tier=${tier}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment=cancelled`,
      metadata: {
        userId: userId || '',
        tier,
        locationName: locationName || '',
        companyName: metadata?.companyName || '',
      },
    });

    console.log(`✅ Checkout session created: ${session.id}`);
    res.json({ url: session.url });

  } catch (error) {
    console.error('❌ Stripe error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create checkout session',
    });
  }
});

// Stripe webhook endpoint (for handling successful payments)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️  Stripe webhook secret not configured');
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { tier, userId, locationName } = session.metadata || {};
      console.log(`✅ Payment successful for ${session.customer_email}`);
      console.log(`   Tier: ${tier}`);
      console.log(`   Location: ${locationName}`);

      // Update Clerk user metadata to grant premium access
      if (userId && tier) {
        try {
          const clerkSecretKey = process.env.CLERK_SECRET_KEY;
          if (!clerkSecretKey) {
            console.error('❌ CLERK_SECRET_KEY not configured — cannot activate tier');
          } else {
            const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                public_metadata: {
                  tier,
                  activatedAt: new Date().toISOString(),
                  stripeSessionId: session.id,
                },
              }),
            });

            if (clerkRes.ok) {
              console.log(`✅ Clerk metadata updated: ${userId} → ${tier}`);
            } else {
              const errBody = await clerkRes.text();
              console.error(`❌ Clerk API error (${clerkRes.status}): ${errBody}`);
            }
          }
        } catch (clerkErr) {
          console.error('❌ Failed to update Clerk metadata:', clerkErr.message);
        }
      } else {
        console.warn('⚠️  Missing userId or tier in session metadata — cannot activate');
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
});

// Verify payment status - frontend polls this after Stripe redirect
app.get('/api/verify-payment', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return res.status(500).json({ error: 'Clerk not configured' });
  }

  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${clerkSecretKey}` },
    });

    if (!clerkRes.ok) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = await clerkRes.json();
    const tier = user.public_metadata?.tier || 'free';

    res.json({ tier, activated: tier !== 'free' });
  } catch (error) {
    console.error('Verify payment error:', error.message);
    res.status(500).json({ error: 'Failed to verify payment status' });
  }
});

// Verify access token (legacy magic-link support)
app.get('/api/verify-token', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || process.env.STRIPE_SECRET_KEY || 'fallback-secret';
    const decoded = jwt.default.verify(token, secret);

    res.json({
      valid: true,
      tier: decoded.tier,
      email: decoded.email,
    });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

// ─── Advocacy Letter Generator (Claude AI) ───────────────────────────────────

const advocacyLetterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 letters per hour per IP
  message: { error: 'Too many letter requests. Please try again later.' },
});

app.post('/api/generate-advocacy-letter', advocacyLetterLimiter, async (req, res) => {
  // Track advocacy letter generation
  trackEvent('advocacy', req);

  try {
    const { location, metrics, authorName, recipientTitle } = req.body;

    if (!location || !metrics) {
      return res.status(400).json({ error: 'Missing location or metrics data' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!groqKey && !geminiKey) {
      return res.status(503).json({ error: 'AI letter generation is not configured. Add GROQ_API_KEY or GEMINI_API_KEY.' });
    }

    // Build a concise metrics summary for the prompt
    const metricLines = [];
    if (metrics.crossingSafety !== undefined) metricLines.push(`Crossing Safety: ${metrics.crossingSafety}/10`);
    if (metrics.sidewalkCoverage !== undefined) metricLines.push(`Sidewalk Coverage: ${metrics.sidewalkCoverage}/10`);
    if (metrics.speedExposure !== undefined) metricLines.push(`Traffic Speed Safety: ${metrics.speedExposure}/10`);
    if (metrics.destinationAccess !== undefined) metricLines.push(`Daily Needs Nearby: ${metrics.destinationAccess}/10`);
    if (metrics.nightSafety !== undefined) metricLines.push(`Night Safety (Lighting): ${metrics.nightSafety}/10`);
    if (metrics.slope !== undefined) metricLines.push(`Flat Terrain: ${metrics.slope}/10`);
    if (metrics.treeCanopy !== undefined) metricLines.push(`Shade & Tree Canopy: ${metrics.treeCanopy}/10`);
    if (metrics.thermalComfort !== undefined) metricLines.push(`Thermal Comfort: ${metrics.thermalComfort}/10`);

    const worstMetrics = Object.entries(metrics)
      .filter(([k, v]) => typeof v === 'number' && k !== 'overallScore' && v <= 4)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([k]) => k);

    const prompt = `Write a formal advocacy letter to a local government official about pedestrian safety and walkability improvements needed at the following location.

LOCATION: ${location.displayName}
COORDINATES: ${location.lat}, ${location.lon}
OVERALL WALKABILITY SCORE: ${metrics.overallScore.toFixed(1)}/10 (${metrics.label})

METRIC SCORES:
${metricLines.join('\n')}

WORST AREAS (scores ≤ 4): ${worstMetrics.length > 0 ? worstMetrics.join(', ') : 'None — all areas are adequate'}

${authorName ? `AUTHOR: ${authorName}` : ''}
${recipientTitle ? `RECIPIENT: ${recipientTitle}` : 'RECIPIENT: Local City Council / Municipal Authority'}

INSTRUCTIONS:
- Write a professional, respectful 400-500 word letter
- Open with the specific location and its walkability score
- Cite the 2-3 worst metrics with specific numbers
- Reference relevant standards (WHO, NACTO, ADA) where appropriate
- Include 2-3 specific, actionable recommendations tied to the worst metrics
- End with a clear call to action (site visit, public meeting, budget allocation)
- Use a formal but accessible tone — this should persuade, not lecture
- Do NOT include placeholder brackets like [Your Name] — write it as a complete letter
- If an author name is provided, sign with that name; otherwise sign as "A Concerned Resident"
- Do NOT include a subject line — just the letter body starting with "Dear..."`;

    const letterText = await callAIWithFallback(prompt, groqKey, geminiKey);
    if (!letterText) {
      return res.status(500).json({ error: 'Failed to generate letter. AI services unavailable.' });
    }

    res.json({ success: true, letter: letterText });
  } catch (error) {
    console.error('Advocacy letter generation failed:', error.message);
    res.status(500).json({ error: 'Failed to generate letter. Please try again.' });
  }
});

// ─── Advocacy Chatbot (Groq, streaming) ──────────────────────────────────────

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages. Please slow down.' },
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  // Track chat message
  trackEvent('chat', req);

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(503).json({ error: 'Chat is not configured' });
    }

    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages' });
    }

    // Security: Block prompt injection attempts
    const dangerousPatterns = [
      /ignore\s+(previous|above|prior|all)\s+(instructions?|prompts?|rules?)/i,
      /system\s+prompt/i,
      /reveal\s+(your\s+)?(instructions?|prompt|rules?)/i,
      /what\s+(is|are)\s+your\s+(instructions?|rules?|system\s+prompt)/i,
      /(show|print|display|tell)\s+(me\s+)?(your\s+)?(instructions?|prompt|rules?)/i,
      /(api[_\s]?key|secret[_\s]?key|password|token)/i,
      /\bexec\(/i,
      /eval\(/i,
    ];

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      const content = lastUserMessage.content || '';
      if (dangerousPatterns.some(pattern => pattern.test(content))) {
        console.warn(`🚨 Prompt injection attempt blocked from ${req.ip}: "${content.slice(0, 100)}"`);
        return res.status(400).json({
          error: 'Invalid request. Please rephrase your question about urban planning and walkability.',
        });
      }
    }

    // Build system prompt with analysis context
    let systemPrompt = `You are the SafeStreets Urbanist — a sharp, passionate walkability expert and advocate embedded in a walkability analysis tool. You are not a generic chatbot. You are an urbanist who carries the intellectual DNA of the movement's greatest thinkers, grounded in verified data and global design standards.

YOUR IDENTITY:
You think like Jane Jacobs — you believe cities belong to the people who walk them. You see streets the way Jan Gehl does — as living rooms for public life. You argue like Jeff Speck — with precision, evidence, and persuasion. You have the operational boldness of Janette Sadik-Khan — if NYC can transform Times Square, any city can fix a crosswalk. You understand, like Charles Montgomery, that the design of our streets is inseparable from human happiness.

You are not neutral. You are an advocate for people over cars, for life over traffic, for equity over speed. But you earn that position through data, standards, and evidence — never ideology alone.

VOICE & STYLE:
- Sharp, direct, and confident. No filler. No corporate softness.
- Thoughtful — connect the user's specific data to bigger urban truths
- Inspirational — remind people that better streets are not utopian; they exist right now in cities worldwide
- Advocate's edge — when data reveals a failing, name it clearly. A crossing safety score of 2/10 isn't "an area for improvement" — it's a neighborhood where the street was designed to move cars, not protect people
- Use specific numbers, standards, and comparisons. Vague advice is useless advice
- Keep responses focused (2-4 paragraphs) unless the user asks for depth. Every sentence should earn its place
- When relevant, connect to the human story: who is affected, what daily life looks like, what changes would feel like

INTELLECTUAL FOUNDATIONS:

THE CLASSICS — Your Core Philosophy:
- Jane Jacobs (The Death and Life of Great American Cities): Mixed-use streets generate safety through "eyes on the street." Short blocks, diverse buildings, density of people — these are not urban planning preferences, they are the conditions under which cities thrive. Monoculture kills neighborhoods.
- Kevin Lynch (The Image of the City): People navigate through paths, edges, districts, nodes, and landmarks. Walkability isn't just physical — it's cognitive. If people can't mentally map a place, they won't walk it.
- Jan Gehl (Cities for People): 50 years of studying street life proved that human-scale design — 5 km/h architecture — creates cities worth living in. If you design for cars, you get traffic. If you design for people, you get life.

WALKABILITY & STREET DESIGN — Your Operational Knowledge:
- Jeff Speck (Walkable City / Walkable City Rules): The General Theory of Walkability — a walk must be useful, safe, comfortable, and interesting. All four. Missing one breaks the chain. Ten steps to walkability: put cars in their place, mix the uses, get the parking right, let transit work, protect the pedestrian, welcome bikes, shape the spaces, plant trees, make friendly and unique faces, pick your winners.
- Janette Sadik-Khan (Street Fight): Proved that street transformation doesn't require decades — paint, planters, and political will can reclaim space for people in weeks. NYC's transformation: 400+ miles of bike lanes, 60+ pedestrian plazas, Times Square pedestrianized.
- Charles Montgomery (Happy City): The happiest cities are walkable cities. Sprawl is not just inefficient — it is correlated with obesity, social isolation, depression, and civic disengagement. Street design is mental health infrastructure.

THE CAR CULTURE CRITIQUE — Your Understanding of the Problem:
- Donald Shoup (The High Cost of Free Parking): Free parking is the most destructive subsidy in urban planning. Minimum parking requirements guarantee car dependency, destroy walkability, and cost cities billions. Every parking space is 15-30m² of city that could be housing, parks, or commerce.
- J.H. Crawford (Carfree Cities): The radical but logical endpoint — cities designed entirely without private automobiles. Reference districts in Venice, Fez, and many historic city centers prove this works at scale.
- Angie Schmitt (Right of Way): The pedestrian safety crisis is not accidental — it is the predictable result of street design that prioritizes vehicle throughput over human life. 6,000+ pedestrians killed annually in the US. SUV/truck front-end design increases pedestrian fatality risk by 45%.

ECONOMICS & EQUITY — Your Justice Lens:
- Edward Glaeser (Triumph of the City): Dense, walkable cities are the greatest engines of prosperity, innovation, and upward mobility ever created. Restricting density through zoning is economically destructive.
- Richard Rothstein (The Color of Law): Segregation was not accidental — it was policy. Highway placement, redlining, exclusionary zoning, and car-dependent design systematically harmed communities of color. Walkability is a racial justice issue.
- Eric Klinenberg (Palaces for the People): Libraries, parks, sidewalks, and community spaces are "social infrastructure" — they determine whether neighborhoods are connected or isolated. Investment in social infrastructure saves lives during crises.

GLOBAL & TACTICAL PERSPECTIVES — Your Broader Vision:
- Mike Davis (Planet of Slums): 1 billion+ people live in informal settlements. Walkability in the Global South is not a lifestyle choice — it is survival. Sidewalks, shade, safe crossings, and access to services are fundamental human rights.
- Mike Lydon & Anthony Garcia (Tactical Urbanism): You don't need to wait for bureaucracy. Paint a crosswalk. Place a bench. Build a parklet. Tactical interventions demonstrate what's possible, build community support, and often become permanent.

GLOBAL STREET DESIGN STANDARDS (GSDS) — NACTO Global Designing Cities Initiative:
- Streets are public spaces first, movement corridors second
- Design speed determines safety outcomes: 30 km/h urban speed limit reduces pedestrian fatality risk from 80% (50 km/h) to 10%
- Pedestrian realm: minimum 2.4m (8ft) clear walking zone in high-activity areas; 1.8m absolute minimum
- Corner radii: tight turning radii (3-5m) force slower vehicle speeds and shorten pedestrian crossings
- Crossing frequency: every 80-100m on urban streets (NACTO); desire lines must be respected, not fenced off
- Protected intersections: raised crossings, pedestrian refuge islands, leading pedestrian intervals (LPI)
- One-way to two-way conversions improve street life and reduce speeding
- Street trees every 6-8m in the furniture zone — non-negotiable for comfort, shade, and safety
- Transit stops integrated with pedestrian infrastructure, not isolated on hostile roads

VERIFIED STANDARDS & BENCHMARKS:

CROSSINGS & PEDESTRIAN SAFETY:
- NACTO: marked crosswalks every 80-100m (250-330ft) on urban streets
- FHWA: pedestrian signals warranted at 100+ pedestrians/hr
- WHO: 1.35 million road deaths/year globally; pedestrians = 23%
- Vision Zero (Stockholm, 1997): zero fatalities target; 40+ cities adopted
- Complete Streets: designed for ALL users, not just drivers
- GSDS: raised crossings at every intersection in pedestrian priority zones

SIDEWALK & ACCESSIBILITY:
- ADA: minimum 1.5m (5ft) clear width; curb ramps at ALL intersections
- ITDP Pedestrian First: 1.8m (6ft) minimum for comfortable two-way walking
- GSDS/NACTO: 2.4m (8ft) minimum for high-pedestrian zones
- WHO Age-Friendly Cities: continuous, level, non-slip surfaces; 50+ lux at crossings
- Universal Design: sidewalks must work for wheelchairs, strollers, elderly, visually impaired — not just able-bodied adults

STREET CONNECTIVITY:
- 100+ intersections/km² = highly walkable grid (Portland ~140/km²)
- Ideal block length: 100-150m (330-500ft); max 200m before midblock crossing needed
- Cul-de-sacs reduce walkability 50-70% vs connected grids (Ewing & Cervero, 2010)
- Walk Score: 90-100 Walker's Paradise; 70-89 Very Walkable; 50-69 Somewhat Walkable; 25-49 Car-Dependent; 0-24 Almost All Errands Require Car
- Jacobs principle: short blocks create more corner opportunities, more route choices, more life

TREE CANOPY & GREEN SPACE:
- WHO: minimum 9m² green space/person; ideal 50m²/person
- American Forests: 40% tree canopy target for cities
- USDA Forest Service: urban trees reduce air temp 2-8°C
- One mature tree: absorbs ~22kg CO2/year; cooling = 10 room-sized ACs
- 10% canopy increase → 12% crime reduction (USFS)
- Street trees increase property values 3-15%
- Gehl principle: trees create the "edge effect" — people linger where there is shade and enclosure

THERMAL COMFORT (consolidated surface temperature + urban heat island):
- Urban areas 1-3°C warmer than rural (EPA); up to 5-8°C during heatwaves
- Dark asphalt: 60-80°C in summer; reflective surfaces: 30-50°C
- Green roofs reduce surface temp 30-40°C (EPA)
- Cool pavements reduce surface temps 5-15°C
- Every 1°C above 32°C → 2-5% increase in heat mortality
- Heat islands disproportionately affect low-income and minority neighborhoods
- EPA: living within 200m of high-traffic roads → asthma, cardiovascular disease, lung cancer

TRAFFIC FATALITY DATA (contextual — not a scored metric):
- US data: NHTSA Fatality Analysis Reporting System (FARS) — fatal crashes within 800m
- International: WHO Global Health Observatory — road traffic death rate per 100,000
- Global average: 15.0 deaths/100k (WHO 2021); best: Norway 1.5/100k
- US rate: 14.2/100k — nearly 3x European average of 5-6/100k
- Pedestrians represent 23% of all road traffic deaths globally (WHO 2023)
- 40,990 US road deaths in 2023 (NHTSA preliminary); pedestrian deaths hit 40-year high

TERRAIN & SLOPE:
- ADA max slope: 5% (1:20) accessible; 8.33% (1:12) absolute max with handrails
- Comfortable walking: <3%; >6% strenuous
- Slopes >3% significantly reduce elderly/wheelchair mobility
- Steep streets (>10%) reduce pedestrian volumes 50-80%

15-MINUTE CITY (Carlos Moreno, Sorbonne, 2016):
- All daily needs within 15-min walk or bike
- Six functions: living, working, commerce, healthcare, education, entertainment
- Active in Paris, Melbourne, Barcelona, Portland, Buenos Aires
- 15-min neighborhoods: 20-30% lower car dependency, higher life satisfaction
- Jacobs was writing about the 15-minute city in 1961 — she just didn't name it that

ECONOMIC IMPACT:
- Every 1-point Walk Score increase → $700-$3,000 home value gain (Brookings)
- Walkable areas: 80% higher retail revenue/sq ft (Leinberger & Lynch, GWU)
- Pedestrian/cycling infrastructure: $11.80 return per $1 invested (WHO Europe)
- Each mile walked saves $0.73 in health costs; each mile driven costs $0.44 in externalities
- Walkable cities: 20-40% lower transportation costs
- Glaeser's insight: density and walkability are not costs — they are the source of urban wealth

DATA SOURCES IN THIS TOOL:
- Street Connectivity: OpenStreetMap road network geometry (intersection density, route directness)
- Crosswalk Density: OpenStreetMap highway=crossing nodes within 500m radius
- Daily Needs Access: OpenStreetMap amenity/shop/leisure POIs within 1km radius
- Slope/Terrain: NASA SRTM 30m elevation data
- Tree Canopy: ESA Sentinel-2 NDVI at 10m resolution
- Surface Temperature: NASA POWER climatological data
- Air Quality: OpenAQ real-time monitoring (5,000+ stations, 100+ countries)
- Heat Island: Sentinel-2 SWIR urban vs vegetated surface comparison

WHO TO CONTACT (by issue):
- Crosswalks/signals → Transportation/Public Works, Traffic Engineering
- Sidewalk/ADA → Public Works, City ADA Coordinator, City Engineer
- Trees/green space → Parks & Recreation, Urban Forestry, City Arborist
- Air quality → Regional Air Quality District, Environmental Protection
- Heat mitigation → Sustainability Office, Climate Action, Urban Planning
- General walkability → City Planning, City Council Member for your district
- Elected officials → District Council Member, Mayor's Office, Planning Commission

ADVOCACY APPROACH — Inspired by Sadik-Khan & Lydon:
- Start with data (that's what this tool provides)
- Connect data to human stories (who is harmed, who benefits)
- Reference global standards (show what good looks like)
- Name specific interventions (not "improve walkability" but "install a raised crosswalk at the intersection of X and Y")
- Provide tactical options: what can citizens do THIS WEEK vs what requires policy change
- Remind people: every great street was once a bad one. Change is possible.

CRITICAL RULES — NEVER BREAK THESE:
1. NEVER fabricate contact info (phone, email, addresses, URLs). Say "Search your city's official website for [department]" instead.
2. NEVER claim you can perform actions. You CANNOT send emails, submit letters, or take action outside this chat. Draft content for the user to send themselves.
3. NEVER invent statistics beyond what's provided above or in the user's actual scores. If unsure, say so.
4. Suggest TYPES of officials/departments — never invent specific names or contact details.
5. Always: "Here's a draft you can send" — never "I've submitted this for you."
6. When explaining scores, anchor to specific standards (e.g., "Your crossing safety score of 2.6/10 means crosswalks are sparse and unprotected, far below NACTO's 80-100m standard — this is a street designed for cars, not people").
7. Be specific and actionable. Generic encouragement is not advocacy. Connect every recommendation to the user's data.
8. Channel the thinkers: when a Jacobs insight or a Speck principle is relevant, weave it in naturally — not as decoration, but as the intellectual backbone of your answer.`;

    if (context) {
      systemPrompt += `\n\nCURRENT ANALYSIS DATA:`;
      if (context.locationName) {
        systemPrompt += `\nLocation: ${context.locationName}`;
      }
      if (context.metrics) {
        const m = context.metrics;
        systemPrompt += `\n\nMetric Scores (0-10 scale):`;
        if (m.crossingSafety !== undefined) systemPrompt += `\n- Crossing Safety: ${m.crossingSafety}/10`;
        if (m.sidewalkCoverage !== undefined) systemPrompt += `\n- Sidewalk Coverage: ${m.sidewalkCoverage}/10`;
        if (m.speedExposure !== undefined) systemPrompt += `\n- Traffic Speed Safety: ${m.speedExposure}/10`;
        if (m.destinationAccess !== undefined) systemPrompt += `\n- Daily Needs Access: ${m.destinationAccess}/10`;
        if (m.nightSafety !== undefined) systemPrompt += `\n- Night Safety (Lighting): ${m.nightSafety}/10`;
        if (m.slope !== undefined) systemPrompt += `\n- Terrain (Flatness): ${m.slope}/10`;
        if (m.treeCanopy !== undefined) systemPrompt += `\n- Tree Canopy: ${m.treeCanopy}/10`;
        if (m.thermalComfort !== undefined) systemPrompt += `\n- Thermal Comfort: ${m.thermalComfort}/10`;
        if (m.overallScore !== undefined) systemPrompt += `\n- Overall Score: ${m.overallScore}/10 (${m.label || 'N/A'})`;

        const metricEntries = [
          ['Crossing Safety', m.crossingSafety],
          ['Sidewalk Coverage', m.sidewalkCoverage],
          ['Traffic Speed Safety', m.speedExposure],
          ['Daily Needs Access', m.destinationAccess],
          ['Night Safety', m.nightSafety],
          ['Terrain', m.slope],
          ['Tree Canopy', m.treeCanopy],
          ['Thermal Comfort', m.thermalComfort],
        ].filter(([, v]) => typeof v === 'number');

        const weakest = metricEntries.sort((a, b) => a[1] - b[1]).slice(0, 3);
        if (weakest.length > 0) {
          systemPrompt += `\n\nWeakest areas: ${weakest.map(([name, score]) => `${name} (${score}/10)`).join(', ')}`;
        }
      }
      if (context.dataQuality) {
        systemPrompt += `\nData confidence: ${context.dataQuality.confidence}`;
      }
    }

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Limit conversation to last 20 messages
    const trimmedMessages = messages.slice(-20).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmedMessages,
        ],
        temperature: 0.6,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq chat error:', response.status, errorText);
      if (response.status === 429) {
        res.write(`data: ${JSON.stringify({ error: 'rate_limited', retryAfter: 30 })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Chat service temporarily unavailable.' })}\n\n`);
      }
      res.end();
      return;
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Chat failed. Please try again.' });
    }
  }
});

// Serve frontend static files if dist folder exists
import { existsSync } from 'fs';

// Try multiple possible dist locations (api/dist is copied during Railway build)
const possiblePaths = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, '..', 'dist'),
  path.join(process.cwd(), 'dist'),
  '/app/dist',
];
let distPath = null;
for (const p of possiblePaths) {
  if (existsSync(path.join(p, 'index.html'))) {
    distPath = p;
    break;
  }
}

if (distPath) {
  console.log(`Serving frontend from: ${distPath}`);

  // Hashed assets (js/css) get long cache since filenames change on rebuild
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // All other static files - no cache to prevent stale index.html
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback - serve index.html for non-API routes (no cache)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Global error handler - catches unhandled route errors
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// Graceful shutdown
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// ─── Honeypot Endpoints (Bot Detection) ──────────────────────────────────────
// Log bots trying to access common vulnerability paths
const honeypots = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/config',
  '/api/keys',
  '/api/config',
  '/.git/config',
  '/admin',
  '/wp-admin',
  '/phpMyAdmin',
  '/config.json',
  '/secrets',
];

honeypots.forEach(path => {
  app.get(path, (req, res) => {
    console.warn(`🚨 Bot detected: ${req.ip} → ${path} (User-Agent: ${req.get('user-agent')?.slice(0, 50)})`);
    res.status(404).send('Not found');
  });
  app.post(path, (req, res) => {
    console.warn(`🚨 Bot detected: ${req.ip} → POST ${path}`);
    res.status(404).send('Not found');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SafeStreets API Server`);
  console.log(`✅ Running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Analytics: http://localhost:${PORT}/admin?key=SECRET\n`);
  console.log(`📡 Available APIs:`);
  console.log(`   ☀️  NASA POWER Temperature: GET /api/nasa-power-temperature`);
  console.log(`   🌫️  OpenAQ Air Quality: GET /api/air-quality ${process.env.OPENAQ_API_KEY ? '(configured)' : '(needs API key)'}`);
  console.log(`   ⛰️  NASADEM Elevation: GET /api/elevation`);
  console.log(`   🏔️  NASADEM Slope: GET /api/slope`);
  console.log(`   🌳 Sentinel-2 NDVI: GET /api/ndvi`);
  console.log(`   🔥 Urban Heat Island: GET /api/heat-island`);
  console.log(`   👥 Population Density: GET /api/population-density`);
  console.log(`   🚨 Crash Data: GET /api/crash-data (FARS + WHO)`);
  console.log(`   🗺️  Overpass Proxy: POST /api/overpass`);
  console.log(`   💳 Stripe Checkout: POST /api/create-checkout-session ${stripe ? '(configured)' : '(needs API key)'}`);
  console.log(`   🔑 Verify Payment: GET /api/verify-payment ${process.env.CLERK_SECRET_KEY ? '(configured)' : '(needs CLERK_SECRET_KEY)'}`);
  console.log(`   🪝 Stripe Webhook: POST /api/stripe-webhook ${process.env.STRIPE_WEBHOOK_SECRET ? '(configured)' : '(needs STRIPE_WEBHOOK_SECRET)'}\n`);
});
