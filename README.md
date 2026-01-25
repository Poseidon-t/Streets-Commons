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

### 📊 6 Verifiable Metrics

| Metric | Data Source | What It Measures |
|--------|-------------|------------------|
| **Crossing Density** | OSM `highway=crossing` | Marked pedestrian crossings per km + distribution |
| **Sidewalk Coverage** | OSM `sidewalk=*` tags | % of streets with sidewalk documentation |
| **Network Efficiency** | Calculated from OSM | Street grid connectivity ratio |
| **Destination Access** | OSM amenity/shop/leisure | Variety of destination types within 800m |
| **Slope** | SRTM elevation data | Terrain gradient (wheelchair accessibility) |
| **Tree Canopy** | Sentinel-2/Landsat NDVI | Vegetation coverage (shade, cooling, air quality) |

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
- Clear limitations section

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment (optional - for tree canopy metric)
cp .env.example .env
# Edit .env and add your OpenWeather API key

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

Visit [http://localhost:5174](http://localhost:5174)

### API Keys (Optional)

- **Tree Canopy Metric**: Requires free OpenWeather API key
  - Get it at: [openweathermap.org/api](https://openweathermap.org/api)
  - Free tier: 1,000 calls/day
  - Add to `.env` as `VITE_OPENWEATHER_API_KEY`
  - If not provided, tree canopy score defaults to 0

## 📊 Scoring System

**0-10 scale** with weighted average (dynamic based on available data):

**All 6 metrics available:**
- Crossing Density: 20%
- Sidewalk Coverage: 20%
- Network Efficiency: 15%
- Destination Access: 15%
- Slope: 15%
- Tree Canopy: 15%

**5 metrics (no API key):**
- Crossing Density: 25%
- Sidewalk Coverage: 25%
- Network Efficiency: 15%
- Destination Access: 15%
- Slope: 20%

**4 metrics (OSM only):**
- Crossing Density: 30%
- Sidewalk Coverage: 30%
- Network Efficiency: 20%
- Destination Access: 20%

| Score | Label |
|-------|-------|
| 8-10 | Excellent |
| 6-7.9 | Good |
| 4-5.9 | Fair |
| 2-3.9 | Poor |
| 0-1.9 | Critical |

## 🛠️ Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 3.4
- Leaflet + React Leaflet
- Vitest

**Data Sources:**
- Nominatim (geocoding)
- Overpass API (OSM data)
- Open-Elevation API (SRTM elevation)
- OpenWeather Agro API (Sentinel-2/Landsat NDVI)

## 📁 Structure

```
src/
├── components/
│   ├── Map.tsx              # Interactive map
│   ├── CompareView.tsx      # Comparison UI
│   ├── ShareButtons.tsx     # Share/export
│   └── streetcheck/
│       ├── AddressInput.tsx # Search
│       ├── ScoreCard.tsx    # Score display
│       └── MetricGrid.tsx   # Metrics
├── services/
│   ├── nominatim.ts         # Geocoding
│   └── overpass.ts          # OSM data
├── utils/
│   └── metrics.ts           # Calculations
└── types/
    └── index.ts             # TypeScript types
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

## ❌ What We CANNOT Measure

- ❌ Actual sidewalk width
- ❌ Pavement condition
- ❌ Obstacles (bikes, vendors)
- ❌ Lighting at night
- ❌ Surface temperature (requires paid Landsat thermal API or on-site measurement)

**We're honest about limitations.**

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
- ✅ **Slope**: Now using real SRTM elevation data (30m resolution)
- ✅ **Tree Canopy**: Now using real Sentinel-2/Landsat NDVI satellite imagery
- ⏳ **Surface Temperature**: Planned (Landsat thermal data - requires research)

**Result**: Honest, verifiable metrics from actual data sources ✅

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
- [ ] PDF policy reports
- [ ] Streetmix integration
- [ ] 3DStreet integration
- [ ] Paid tier ($29)

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
