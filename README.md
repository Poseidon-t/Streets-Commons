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

### 📊 4 Verifiable Metrics

| Metric | Data Source | What It Measures |
|--------|-------------|------------------|
| **Crossing Density** | OSM `highway=crossing` | Marked pedestrian crossings per km + distribution |
| **Sidewalk Coverage** | OSM `sidewalk=*` tags | % of streets with sidewalk documentation |
| **Network Efficiency** | Calculated from OSM | Street grid connectivity ratio |
| **Destination Access** | OSM amenity/shop/leisure | Variety of destination types within 800m |

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

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

Visit [http://localhost:5174](http://localhost:5174)

## 📊 Scoring System

**0-10 scale** with weighted average:
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

**Coverage**: 5 test files, all passing ✅

## ✅ What We CAN Measure

- ✅ Crossing locations + density
- ✅ Sidewalk coverage (via OSM tags)
- ✅ Street network connectivity
- ✅ POI access + variety

## ❌ What We CANNOT Measure

- ❌ Actual sidewalk width
- ❌ Pavement condition
- ❌ Obstacles (bikes, vendors)
- ❌ Lighting at night
- ❌ Tree canopy (no reliable remote source)
- ❌ Surface temperature (no reliable remote source)
- ❌ Slope (no reliable remote source)

**We're honest about limitations.**

## 📝 What We Removed

Following user principle: *"only if it is 100%, we dont need to show some random walkable score"*

### Removed Fake Metrics:
- ❌ Tree Canopy (was estimated from sidewalks - fake)
- ❌ Surface Temperature (was proxy from tree canopy - fake)
- ❌ Slope (was random 6-9 number - fake)

### Removed Fake Demographics:
- ❌ "Who's Affected" section (fixed 7,000 people/km² for ALL locations - fake)
- ❌ Hardcoded 18% children, 12% elderly (not location-specific - fake)

### Removed Fake Economics:
- ❌ "Economic Projections" (3352× ROI, $77M retail uplift - absurd fake numbers)

**Result**: Now showing ONLY verifiable OSM data ✅

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
