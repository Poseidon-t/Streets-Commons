/**
 * SafeStreets API - Free Data Sources
 *
 * This backend provides access to:
 * - NASA POWER meteorological data (temperature)
 * - OpenAQ air quality data (PM2.5, PM10, etc.)
 * - NASADEM elevation data via Microsoft Planetary Computer
 * - OpenStreetMap infrastructure via Overpass API
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fromUrl } from 'geotiff';
import Stripe from 'stripe';
import Anthropic from '@anthropic-ai/sdk';
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

// Middleware
app.use(cors());

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
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe-webhook') {
    return next();
  }
  express.json()(req, res, next);
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

// Overpass API proxy with caching
app.post('/api/overpass', async (req, res) => {
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
    let urbanTempSum = 0;
    let urbanPixels = 0;
    let vegetationTempSum = 0;
    let vegetationPixels = 0;

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

// =====================
// GEMINI AI BUDGET ANALYSIS
// =====================

// Budget analysis endpoint with file upload support (PDF, CSV, text)
app.post('/api/analyze-budget', upload.single('file'), async (req, res) => {
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
      professional: {
        amount: 7900, // $79 in cents
        name: 'SafeStreets Professional',
        description: 'Everything in Advocate + 15-Min City, Transit Analysis, ADA Reports, Custom Branding',
      },
    };

    const selectedPricing = pricing[tier];
    if (!selectedPricing) {
      return res.status(400).json({ error: 'Invalid tier. Must be "advocate" or "professional"' });
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
  try {
    const { location, metrics, authorName, recipientTitle } = req.body;

    if (!location || !metrics) {
      return res.status(400).json({ error: 'Missing location or metrics data' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI letter generation is not configured' });
    }

    const anthropic = new Anthropic({ apiKey });

    // Build a concise metrics summary for the prompt
    const metricLines = [];
    if (metrics.crossingDensity !== undefined) metricLines.push(`Crosswalk Density: ${metrics.crossingDensity}/10`);
    if (metrics.sidewalkCoverage !== undefined) metricLines.push(`Sidewalk Coverage: ${metrics.sidewalkCoverage}/10`);
    if (metrics.networkEfficiency !== undefined) metricLines.push(`Street Connectivity: ${metrics.networkEfficiency}/10`);
    if (metrics.destinationAccess !== undefined) metricLines.push(`Daily Needs Nearby: ${metrics.destinationAccess}/10`);
    if (metrics.greenSpaceAccess !== undefined) metricLines.push(`Parks & Green Space: ${metrics.greenSpaceAccess}/10`);
    if (metrics.slope !== undefined) metricLines.push(`Flat Terrain: ${metrics.slope}/10`);
    if (metrics.treeCanopy !== undefined) metricLines.push(`Shade & Tree Canopy: ${metrics.treeCanopy}/10`);
    if (metrics.surfaceTemp !== undefined) metricLines.push(`Cool Walking Conditions: ${metrics.surfaceTemp}/10`);
    if (metrics.airQuality !== undefined) metricLines.push(`Air Quality: ${metrics.airQuality}/10`);
    if (metrics.heatIsland !== undefined) metricLines.push(`Heat Island Effect: ${metrics.heatIsland}/10`);

    const worstMetrics = Object.entries(metrics)
      .filter(([k, v]) => typeof v === 'number' && k !== 'overallScore' && v <= 4)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([k]) => k);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Write a formal advocacy letter to a local government official about pedestrian safety and walkability improvements needed at the following location.

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
- Do NOT include a subject line — just the letter body starting with "Dear..."`,
      }],
    });

    const letterText = message.content[0]?.text;
    if (!letterText) {
      return res.status(500).json({ error: 'Failed to generate letter' });
    }

    res.json({ success: true, letter: letterText });
  } catch (error) {
    console.error('Advocacy letter generation failed:', error.message);
    res.status(500).json({ error: 'Failed to generate letter. Please try again.' });
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SafeStreets API Server`);
  console.log(`✅ Running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
  console.log(`📡 Available APIs:`);
  console.log(`   ☀️  NASA POWER Temperature: GET /api/nasa-power-temperature`);
  console.log(`   🌫️  OpenAQ Air Quality: GET /api/air-quality ${process.env.OPENAQ_API_KEY ? '(configured)' : '(needs API key)'}`);
  console.log(`   ⛰️  NASADEM Elevation: GET /api/elevation`);
  console.log(`   🏔️  NASADEM Slope: GET /api/slope`);
  console.log(`   🌳 Sentinel-2 NDVI: GET /api/ndvi`);
  console.log(`   🔥 Urban Heat Island: GET /api/heat-island`);
  console.log(`   🗺️  Overpass Proxy: POST /api/overpass`);
  console.log(`   💳 Stripe Checkout: POST /api/create-checkout-session ${stripe ? '(configured)' : '(needs API key)'}`);
  console.log(`   🔑 Verify Payment: GET /api/verify-payment ${process.env.CLERK_SECRET_KEY ? '(configured)' : '(needs CLERK_SECRET_KEY)'}`);
  console.log(`   🪝 Stripe Webhook: POST /api/stripe-webhook ${process.env.STRIPE_WEBHOOK_SECRET ? '(configured)' : '(needs STRIPE_WEBHOOK_SECRET)'}\n`);
});
