# SafeStreets Setup Guide

Complete setup guide for the SafeStreets walkability analysis tool with all 7 metrics.

## Architecture Overview

```
Frontend (React/Vite) → Backend API (Node.js/Express) → Google Earth Engine
                     → OpenWeather Agro API
                     → Open-Elevation API
                     → Overpass API (OSM)
```

## Quick Start (Minimal Setup)

Get started with **4 OSM metrics** (no API keys required):

```bash
# Frontend only
cd /Users/sarath/Documents/Streets-Commons
npm install
npm run dev
```

Visit http://localhost:5174

**Metrics available:** Crossing Density, Sidewalk Coverage, Network Efficiency, Destination Access

---

## Full Setup (All 7 Metrics)

### 1. Slope Metric (Auto-enabled)

**No setup required** - Uses Open-Elevation API (no auth)

- ✅ Automatic
- ✅ No API key needed
- ✅ Progressive enhancement

### 2. Tree Canopy Metric

**Requires:** Free OpenWeather API key

```bash
# Get API key
# Visit: https://openweathermap.org/api
# Sign up → Account → API keys (free tier: 1,000 calls/day)

# Configure
cp .env.example .env
# Edit .env and add:
# VITE_OPENWEATHER_API_KEY=your_key_here
```

### 3. Street-Level Photos (Mapillary)

**Requires:** Free Mapillary API access token

```bash
# Get access token
# Visit: https://www.mapillary.com/dashboard/developers
# Create app → Copy Client Token

# Configure
cp .env.example .env
# Edit .env and add:
# VITE_MAPILLARY_ACCESS_TOKEN=your_token_here
```

**Features:**
- 📷 Interactive photo markers on map
- 🖼️ Photo gallery showing street conditions
- 📄 Photos included in PDF reports
- ✅ Honest disclosure when no photos available

### 4. Surface Temperature Metric

**Requires:** Backend API + Google Earth Engine

#### Step 1: Install Backend

```bash
cd api
npm install
```

#### Step 2: Authenticate with Google Earth Engine

**Option A: Development (OAuth)**

```bash
# Install Earth Engine CLI
npm install -g @google/earthengine

# Authenticate
earthengine authenticate

# Start backend
npm run dev
```

**Option B: Production (Service Account)**

```bash
# 1. Create GEE Service Account
# Visit: https://console.cloud.google.com
# Enable Earth Engine API
# Create Service Account
# Download JSON key

# 2. Configure backend
cd api
cp .env.example .env

# Edit .env and add:
# GEE_SERVICE_ACCOUNT_EMAIL=your-account@project.iam.gserviceaccount.com
# GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# 3. Start backend
npm start
```

#### Step 3: Connect Frontend to Backend

```bash
# In main .env file
VITE_API_URL=http://localhost:3001
```

---

## Deployment

### Frontend (Vercel/Netlify)

```bash
# Build
npm run build

# Deploy dist/ folder
```

**Environment Variables:**
- `VITE_OPENWEATHER_API_KEY` (optional - tree canopy)
- `VITE_MAPILLARY_ACCESS_TOKEN` (optional - street photos)
- `VITE_API_URL` (optional - surface temp backend)

### Backend (Railway/Render/Fly.io)

```bash
# Push api/ folder to repository
# Connect to platform
# Add environment variables:
# - GEE_SERVICE_ACCOUNT_EMAIL
# - GEE_PRIVATE_KEY
# - PORT (usually auto-set)
```

**CORS:** Update `api/server.js` for production:

```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com'
}));
```

---

## Feature Breakdown

### Core Metrics

| Metric | Data Source | Setup Required | Progressive |
|--------|-------------|----------------|-------------|
| Crossing Density | OSM Overpass API | None | No |
| Sidewalk Coverage | OSM Overpass API | None | No |
| Network Efficiency | OSM Overpass API | None | No |
| Destination Access | OSM Overpass API | None | No |
| Slope | Open-Elevation (SRTM) | None | Yes |
| Tree Canopy | OpenWeather Agro API | Free API key | Yes |
| Surface Temp | Google Earth Engine | Backend + GEE auth | Yes |

**Progressive = Loads after initial OSM analysis**

### Additional Features

| Feature | Data Source | Setup Required | Includes |
|---------|-------------|----------------|----------|
| Street Photos | Mapillary API | Free access token | Map markers, gallery, PDF photos |
| PDF Reports | jsPDF | None | All metrics, map, photos, recommendations |

---

## Development Workflow

### Frontend Development

```bash
npm run dev          # Start dev server
npm test             # Run tests
npm run build        # Build for production
```

### Backend Development

```bash
cd api
npm run dev          # Start with auto-reload
```

**Test Backend:**

```bash
# Health check
curl http://localhost:3001/health

# Get surface temperature
curl -X POST http://localhost:3001/api/surface-temperature \
  -H "Content-Type: application/json" \
  -d '{"lat": 18.7883, "lon": 98.9853}'
```

---

## Troubleshooting

### Frontend Issues

**"Tree canopy score is 0"**
- Check if `VITE_OPENWEATHER_API_KEY` is set in `.env`
- Restart dev server after adding `.env`
- Check browser console for warnings

**"Surface temp score is 0"**
- Check if backend is running (`http://localhost:3001/health`)
- Check `VITE_API_URL` in `.env`
- Check browser console for API errors

### Backend Issues

**"Earth Engine not initialized"**
- Run `earthengine authenticate` (OAuth method)
- Or check service account credentials in `.env`

**"No Landsat data available"**
- Last 90 days of cloud-free data (<20% cloud cover)
- Some locations may not have recent data
- This is expected behavior - surface temp will remain 0

**CORS errors**
- Check `cors()` configuration in `api/server.js`
- Make sure frontend origin is allowed

---

## Cost Analysis

| Service | Free Tier | Cost Beyond Free |
|---------|-----------|------------------|
| OSM Overpass API | Unlimited | Free forever |
| Open-Elevation API | Unlimited | Free forever |
| OpenWeather Agro API | 1,000 calls/day | $40/month for unlimited |
| Mapillary API | 50,000 tile requests/day | Free forever |
| Google Earth Engine | 250,000 requests/month | Free for non-commercial |

**Estimated costs for 10,000 analyses/month:** $0 (within free tiers)

---

## Google Earth Engine Setup (Detailed)

### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Earth Engine API
4. Go to **IAM & Admin** → **Service Accounts**
5. Click **Create Service Account**
6. Name it (e.g., "safestreets-ee")
7. Grant role: **Earth Engine Resource Admin**
8. Click **Create Key** → JSON
9. Download the JSON file

### Extract Credentials

Open the downloaded JSON file and extract:

```json
{
  "client_email": "safestreets-ee@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
}
```

Add to `api/.env`:

```bash
GEE_SERVICE_ACCOUNT_EMAIL=safestreets-ee@your-project.iam.gserviceaccount.com
GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**Important:** Keep `\n` characters in the private key string.

---

## Security Best Practices

1. **Never commit `.env` files** - Added to `.gitignore`
2. **Rotate API keys** regularly (OpenWeather)
3. **Use environment variables** for all secrets
4. **Limit CORS origins** in production
5. **Use HTTPS** for production deployments
6. **Rate limit** backend API (not implemented yet)

---

## Next Steps

1. ✅ Start with 4 OSM metrics (instant setup)
2. ✅ Add slope metric (auto-enabled, no setup)
3. ✅ Add tree canopy (5 min - OpenWeather API key)
4. ✅ Add street photos (5 min - Mapillary access token)
5. ✅ Add surface temp (30 min - backend + GEE)
6. 🚀 Deploy to production
7. 🚀 Add rate limiting + caching
8. 🚀 Monitor usage + costs

---

## Support

- **Issues:** https://github.com/anthropics/claude-code/issues
- **Earth Engine Docs:** https://developers.google.com/earth-engine
- **OpenWeather Docs:** https://openweathermap.org/api
