# SafeStreets — Honest Walkability Analysis

**Is your neighborhood walkable? Free tool to find out in seconds.**

SafeStreets provides transparent, verifiable walkability analysis using real OpenStreetMap data. No estimates, no proxies, no fake metrics — only measurements we can verify 100%.

🌐 **Live Demo**: [http://localhost:5174](http://localhost:5174)

## 🎯 Mission

Transform citizens from complainers into advocates with evidence. **Data is leverage.**

## ✅ Current Features

### 🗺️ Interactive Map Visualization
- Real OSM data overlays (crossings + POIs)
- Color-coded markers by category
- Interactive popups with details
- 800m analysis radius visualization
- Live legend with counts

### 📊 7 Verifiable Metrics

| Metric | Data Source | What It Measures |
|--------|-------------|------------------|
| **Crossing Density** | OSM `highway=crossing` | Marked pedestrian crossings per km + distribution |
| **Sidewalk Coverage** | OSM `sidewalk=*` tags | % of streets with sidewalk documentation |
| **Network Efficiency** | Calculated from OSM | Street grid connectivity ratio |
| **Destination Access** | OSM amenity/shop/leisure | Variety of destination types within 800m |
| **Slope** | SRTM elevation data | Terrain gradient (wheelchair accessibility) |
| **Tree Canopy** | Sentinel-2/Landsat NDVI | Vegetation coverage (shade, cooling, air quality) |
| **Surface Temperature** | Landsat thermal via GEE | Ground/pavement heat (urban heat island effect) |

Each metric card shows:
- What it measures
- How it's calculated (exact formula)
- Scoring standard (10-point scale)
- Data source (specific OSM tags)

### 🔄 Compare Two Locations
- Side-by-side analysis
- Metric-by-metric comparison
- Winner indicators
- Visual difference bars
- Perfect for advocacy

### 🔗 Share & Export
- Shareable URLs (auto-save location in URL)
- Share to Twitter/Facebook/LinkedIn
- Export data as JSON
- Copy link to clipboard

### 🎯 Data Quality Transparency
- Actual counts (crossings, streets, sidewalks, POIs)
- Confidence levels (high/medium/low)
- **AI-powered sidewalk validation** using street-level imagery
- Clear limitations section

## 🚀 Quick Start

### Minimal Setup (4 Metrics - No APIs Required)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit [http://localhost:5174](http://localhost:5174)

**Metrics:** Crossing Density, Sidewalk Coverage, Network Efficiency, Destination Access ✅

### Full Setup (All 7 Metrics + AI Validation)

See [SETUP.md](SETUP.md) for detailed instructions.

**Quick summary:**

```bash
# Frontend with tree canopy
cp .env.example .env
# Add VITE_OPENWEATHER_API_KEY

# Backend for surface temperature
cd api && npm install
earthengine authenticate  # or use service account
npm run dev

# Frontend connects to backend
# Add VITE_API_URL=http://localhost:3001 to .env

# CV Backend for AI sidewalk validation (optional)
cd cv-backend
pip install -r requirements.txt
python main.py
# Add VITE_CV_API_URL=http://localhost:8000 to .env
```

### API Keys & Backends (Optional)

- **Tree Canopy**: Free OpenWeather API key ([get it here](https://openweathermap.org/api))
- **Surface Temperature**: Requires backend + Google Earth Engine ([setup guide](api/README.md))
- **AI Sidewalk Validation**: Self-hosted CV backend ([deployment guide](cv-backend/DEPLOYMENT.md))

## 📊 Scoring System

**0-10 scale** with dynamic weighted average based on available data:

**All 7 metrics (full setup):**
- Crossing Density: 18%, Sidewalk Coverage: 18%
- Network Efficiency: 13%, Destination Access: 13%
- Slope: 13%, Tree Canopy: 13%, Surface Temp: 12%

**6 metrics (no backend):**
- Crossing Density: 20%, Sidewalk Coverage: 20%
- Network Efficiency: 15%, Destination Access: 15%
- Slope: 15%, Tree Canopy: 15%

**5 metrics (no API key):**
- Crossing Density: 25%, Sidewalk Coverage: 25%
- Network Efficiency: 15%, Destination Access: 15%, Slope: 20%

**4 metrics (minimal - OSM only):**
- Crossing Density: 30%, Sidewalk Coverage: 30%
- Network Efficiency: 20%, Destination Access: 20%

| Score | Label |
|-------|-------|
| 8-10 | Excellent |
| 6-7.9 | Good |
| 4-5.9 | Fair |
| 2-3.9 | Poor |
| 0-1.9 | Critical |

## 🛠️ Tech Stack

### Frontend
- React 19 + TypeScript
- Vite 7
- Tailwind CSS 3.4
- Leaflet + React Leaflet
- Vitest

### Backends
- **Surface Temp**: Node.js + Express + Google Earth Engine
- **AI Validation**: FastAPI + Hugging Face Transformers (SegFormer)

**Data Sources:**
- Nominatim (geocoding)
- Overpass API (OSM data)
- Open-Elevation API (SRTM elevation)
- OpenWeather Agro API (Sentinel-2/Landsat NDVI)
- Google Earth Engine (Landsat thermal)
- Mapillary (street-level imagery)
- Hugging Face SegFormer (sidewalk detection)

## 📁 Structure

```
src/
├── components/
│   ├── Map.tsx                      # Interactive map
│   ├── CompareView.tsx              # Comparison UI
│   ├── ShareButtons.tsx             # Share/export
│   └── streetcheck/
│       ├── AddressInput.tsx         # Search
│       ├── ScoreCard.tsx            # Score display
│       └── MetricGrid.tsx           # Metrics
├── services/
│   ├── nominatim.ts                 # Geocoding
│   ├── overpass.ts                  # OSM data
│   ├── mapillary.ts                 # Street imagery
│   └── sidewalkImageAnalysis.ts     # CV analysis
├── utils/
│   └── metrics.ts                   # Calculations
└── types/
    └── index.ts                     # TypeScript types

cv-backend/
├── main.py                          # FastAPI CV service
├── requirements.txt                 # Python dependencies
├── Dockerfile                       # Container config
├── railway.toml                     # Railway deployment
├── README.md                        # Full docs
├── DEPLOYMENT.md                    # Quick deploy guide
└── test_local.py                    # Local testing
```

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:ui       # Watch mode
```

**Coverage**: All tests passing ✅

## ✅ What We CAN Measure

- ✅ Crossing locations + density
- ✅ Sidewalk coverage (via OSM tags)
- ✅ Street network connectivity
- ✅ POI access + variety
- ✅ Slope (via SRTM elevation data)
- ✅ Tree canopy (via Sentinel-2/Landsat NDVI)
- ✅ Surface temperature (via Landsat thermal/Google Earth Engine)

## ⚠️ What Has Limitations

- ⚠️ **Sidewalk condition**: OSM shows if mapped, not current state
  - **Solution**: AI analyzes street photos to detect obstructions/issues
- ⚠️ **Actual width**: Not measured by standard tools
- ❌ **Lighting at night**: No satellite/street data available
- ❌ **Real-time traffic**: Would require sensors
- ❌ **Safety perception**: Subjective, no verifiable source

**We're honest about limitations and validate data with AI when possible.**

## 📝 Evolution: From Fake to Real

Following user principle: *"only if it is 100%, we dont need to show some random walkable score"*

### Phase 1: Removed Fake Metrics
- ❌ Tree Canopy (was estimated from sidewalks - fake)
- ❌ Surface Temperature (was proxy from tree canopy - fake)
- ❌ Slope (was random 6-9 number - fake)
- ❌ "Who's Affected" section (fixed 7,000 people/km² for ALL locations - fake)
- ❌ Hardcoded 18% children, 12% elderly (not location-specific - fake)
- ❌ "Economic Projections" (3352× ROI, $77M retail uplift - absurd fake numbers)

### Phase 2: Replaced with Real Satellite Data
- ✅ **Slope**: Real SRTM elevation data (30m) via Open-Elevation API (no auth)
- ✅ **Tree Canopy**: Real Sentinel-2/Landsat NDVI via OpenWeather Agro API (free API key)
- ✅ **Surface Temperature**: Real Landsat thermal data via Google Earth Engine (backend proxy)

**Result**: All 7 metrics now use 100% verifiable satellite/OSM data ✅

## 🎨 Design Principles

1. **Honesty First**: Only show verified data
2. **Transparency**: Clear data sources + methods
3. **User-Centric**: Fast, clean, mobile-friendly
4. **Advocacy-Ready**: Shareable, exportable, professional

## 🚧 Planned Features

### Phase 2
- [ ] Budget upload + AI extraction
- [ ] Country context (World Bank API)
- [ ] Real demographics (when sources found)

### Phase 3
- [x] PDF policy reports (includes metrics, map, street photos, methodology)
- [x] Mapillary street-level photos (integrated on map + gallery + PDF)
- [x] AI-powered sidewalk validation (self-hosted CV backend)
- [x] Data quality confidence indicators (high/medium/low badges)
- [ ] Streetmix integration (street design visualization)
- [ ] 3DStreet integration (3D street visualization)
- [ ] Stripe payment (paid tier $29)

## 🤝 Contributing

Contributions welcome! Guidelines:

1. **Never add fake metrics**
2. **Be transparent** about data sources
3. **Test thoroughly**
4. **Keep it simple**

## 📄 License

MIT License

## 🙏 Credits

- OpenStreetMap contributors
- Nominatim (geocoding)
- Leaflet (maps)

---

**SafeStreets** • Honest Analysis • No Fake Metrics

*Data is leverage.*
