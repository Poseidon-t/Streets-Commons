# SafeStreets API - Surface Temperature Service

Backend API for retrieving Landsat surface temperature data via Google Earth Engine.

## Features

- 🌡️ Real Landsat 8/9 thermal data (30m resolution)
- ☁️ Cloud-based processing via Google Earth Engine
- 🔄 90-day rolling window for recent data
- 🎯 Point-based temperature extraction
- 📊 Automatic walkability scoring

## Quick Start

### Development (OAuth)

```bash
# Install dependencies
npm install

# Authenticate with Google Earth Engine
npm install -g @google/earthengine
earthengine authenticate

# Start server
npm run dev
```

Visit: http://localhost:3001/health

### Production (Service Account)

```bash
# 1. Create GEE Service Account
# Visit: https://developers.google.com/earth-engine/guides/service_account
# - Go to Google Cloud Console
# - Enable Earth Engine API
# - Create service account
# - Download JSON key

# 2. Configure environment
cp .env.example .env
# Edit .env and add:
# - GEE_SERVICE_ACCOUNT_EMAIL
# - GEE_PRIVATE_KEY

# 3. Install and start
npm install
npm start
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "earthEngineInitialized": true,
  "timestamp": "2026-01-25T19:00:00.000Z"
}
```

### Get Surface Temperature

```bash
POST /api/surface-temperature
Content-Type: application/json

{
  "lat": 18.7883,
  "lon": 98.9853
}
```

Response:
```json
{
  "success": true,
  "data": {
    "temperatureCelsius": 32.4,
    "temperatureFahrenheit": 90.3,
    "score": 7.6,
    "location": { "lat": 18.7883, "lon": 98.9853 },
    "dataSource": "Landsat 8/9 Collection 2 Surface Temperature (90-day window)",
    "timestamp": "2026-01-25T19:00:00.000Z"
  }
}
```

## Scoring System

Surface temperature is scored 0-10 based on pedestrian comfort:

| Temperature | Score | Category |
|------------|-------|----------|
| ≤25°C | 10 | Comfortable |
| 25-35°C | 5-10 | Warm |
| 35-45°C | 0-5 | Hot |
| >45°C | 0 | Extreme Heat |

## Data Source

- **Satellite**: Landsat 8/9
- **Product**: Collection 2 Level-2 Surface Temperature
- **Band**: ST_B10 (thermal infrared)
- **Resolution**: 30 meters
- **Update frequency**: 16 days (per satellite)
- **Cloud filtering**: <20% cloud cover
- **Time window**: Last 90 days

## Deployment

### Deploy to Railway / Render / Fly.io

1. Push code to GitHub
2. Connect repository to platform
3. Add environment variables:
   - `GEE_SERVICE_ACCOUNT_EMAIL`
   - `GEE_PRIVATE_KEY`
4. Deploy

### CORS Configuration

By default, CORS allows all origins. For production, update `server.js`:

```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com'
}));
```

## Limitations

- Requires Google Earth Engine account (free for non-commercial use)
- 90-day data window (may not have data for all locations)
- Cloud cover can affect data availability
- Processing time: ~2-5 seconds per request

## License

MIT
