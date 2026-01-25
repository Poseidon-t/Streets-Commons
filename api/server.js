/**
 * SafeStreets API - Landsat Surface Temperature via Google Earth Engine
 *
 * This backend provides access to Landsat thermal data for surface temperature analysis.
 * Uses Google Earth Engine API for cloud-based satellite data processing.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ee from '@google/earthengine';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Google Earth Engine authentication
let eeInitialized = false;

async function initializeEarthEngine() {
  return new Promise((resolve, reject) => {
    // Method 1: Service Account (production)
    if (process.env.GEE_SERVICE_ACCOUNT_EMAIL && process.env.GEE_PRIVATE_KEY) {
      const privateKey = process.env.GEE_PRIVATE_KEY.replace(/\\n/g, '\n');

      ee.data.authenticateViaPrivateKey(
        {
          client_email: process.env.GEE_SERVICE_ACCOUNT_EMAIL,
          private_key: privateKey,
        },
        () => {
          ee.initialize(null, null, () => {
            console.log('✅ Google Earth Engine initialized (Service Account)');
            eeInitialized = true;
            resolve();
          }, reject);
        },
        reject
      );
    }
    // Method 2: OAuth (development)
    else {
      console.log('⚠️  No service account found. Using OAuth authentication.');
      console.log('Run: earthengine authenticate');

      ee.initialize(null, null, () => {
        console.log('✅ Google Earth Engine initialized (OAuth)');
        eeInitialized = true;
        resolve();
      }, reject);
    }
  });
}

/**
 * Calculate Land Surface Temperature from Landsat 8/9
 *
 * Algorithm:
 * 1. Get most recent Landsat Collection 2 Surface Temperature image
 * 2. Filter for low cloud cover (<20%)
 * 3. Extract surface temperature at point
 * 4. Convert from Kelvin to Celsius
 * 5. Score for walkability (lower is better)
 */
async function getLandsatSurfaceTemperature(lat, lon) {
  return new Promise((resolve, reject) => {
    try {
      const point = ee.Geometry.Point([lon, lat]);

      // Landsat 8/9 Collection 2 Surface Temperature
      // Band: ST_B10 (Surface Temperature, Kelvin * 100)
      const now = new Date();
      const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days

      const landsat = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
        .filterBounds(point)
        .filterDate(startDate.toISOString().split('T')[0], now.toISOString().split('T')[0])
        .filter(ee.Filter.lt('CLOUD_COVER', 20))
        .select('ST_B10')
        .sort('system:time_start', false); // Most recent first

      // Get the most recent image
      const image = ee.Image(landsat.first());

      // Sample the temperature at the point
      const sample = image.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: point,
        scale: 30, // 30m resolution
        bestEffort: true,
      });

      sample.evaluate((result, error) => {
        if (error) {
          // Try Landsat 8 if Landsat 9 fails
          const landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
            .filterBounds(point)
            .filterDate(startDate.toISOString().split('T')[0], now.toISOString().split('T')[0])
            .filter(ee.Filter.lt('CLOUD_COVER', 20))
            .select('ST_B10')
            .sort('system:time_start', false);

          const image8 = ee.Image(landsat8.first());
          const sample8 = image8.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: point,
            scale: 30,
            bestEffort: true,
          });

          sample8.evaluate((result8, error8) => {
            if (error8 || !result8 || !result8.ST_B10) {
              return reject(new Error('No Landsat data available for this location in the last 90 days'));
            }

            // Convert from Kelvin * 100 to Celsius
            const tempCelsius = (result8.ST_B10 * 0.00341802 + 149.0) - 273.15;
            resolve(tempCelsius);
          });
        } else if (!result || !result.ST_B10) {
          return reject(new Error('No surface temperature data at this location'));
        } else {
          // Convert from Kelvin * 100 to Celsius
          const tempCelsius = (result.ST_B10 * 0.00341802 + 149.0) - 273.15;
          resolve(tempCelsius);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Score surface temperature for walkability
 * Lower surface temp = better for pedestrians
 *
 * Scoring:
 * - ≤25°C (comfortable) = 10 points
 * - 25-35°C (warm) = 5-10 points
 * - 35-45°C (hot) = 0-5 points
 * - >45°C (extreme heat) = 0 points
 */
function scoreSurfaceTemperature(tempCelsius) {
  if (tempCelsius <= 25) {
    return 10;
  } else if (tempCelsius <= 35) {
    // Linear scale from 10 to 5
    return 10 - ((tempCelsius - 25) / 10) * 5;
  } else if (tempCelsius <= 45) {
    // Linear scale from 5 to 0
    return 5 - ((tempCelsius - 35) / 10) * 5;
  } else {
    return 0;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    earthEngineInitialized: eeInitialized,
    timestamp: new Date().toISOString(),
  });
});

// Surface temperature endpoint
app.post('/api/surface-temperature', async (req, res) => {
  try {
    const { lat, lon } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    if (!eeInitialized) {
      return res.status(503).json({
        error: 'Google Earth Engine not initialized. Please check server logs.',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates',
      });
    }

    console.log(`📡 Fetching surface temperature for: ${lat}, ${lon}`);

    const tempCelsius = await getLandsatSurfaceTemperature(lat, lon);
    const score = scoreSurfaceTemperature(tempCelsius);

    res.json({
      success: true,
      data: {
        temperatureCelsius: Math.round(tempCelsius * 10) / 10,
        temperatureFahrenheit: Math.round((tempCelsius * 9/5 + 32) * 10) / 10,
        score: Math.round(score * 10) / 10,
        location: { lat, lon },
        dataSource: 'Landsat 8/9 Collection 2 Surface Temperature (90-day window)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching surface temperature:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch surface temperature',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Initialize Earth Engine and start server
async function startServer() {
  try {
    console.log('🚀 Starting SafeStreets API...');
    await initializeEarthEngine();

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌡️  Surface temp API: POST http://localhost:${PORT}/api/surface-temperature`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    console.error('\n🔧 Setup instructions:');
    console.error('1. Create GEE service account: https://developers.google.com/earth-engine/guides/service_account');
    console.error('2. Add credentials to .env:');
    console.error('   GEE_SERVICE_ACCOUNT_EMAIL=your-email@project.iam.gserviceaccount.com');
    console.error('   GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.error('\nOr for development:');
    console.error('1. Install Earth Engine CLI: npm install -g @google/earthengine');
    console.error('2. Authenticate: earthengine authenticate');
    process.exit(1);
  }
}

startServer();
