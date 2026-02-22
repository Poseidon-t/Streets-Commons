# Is Your Street Safe to Walk?

**Free, open-source walkability safety analysis for any street on Earth** — powered by NASA satellite data, Sentinel-2 imagery, and OpenStreetMap.

> Enter any address. Get an instant safety score backed by 8 verifiable metrics. No estimates, no proxies — only real data.

**[Try it live](https://safestreets.streetsandcommons.com)** | **[Report an Issue](https://github.com/Poseidon-t/Streets-Commons/issues)**

<!-- Add a GIF/screenshot here showing: address input > score output > map overlay -->
<!-- ![SafeStreets Demo](docs/demo.gif) -->

---

![NASA Data](https://img.shields.io/badge/NASA-POWER%20%2B%20NASADEM-blue)
![Sentinel-2](https://img.shields.io/badge/ESA-Sentinel--2-green)
![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-Powered-brightgreen)
![190+ Countries](https://img.shields.io/badge/Coverage-190%2B%20Countries-orange)
![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-purple)
![GitHub Stars](https://img.shields.io/github/stars/Poseidon-t/Streets-Commons?style=social)

---

## Quick Start

```bash
git clone https://github.com/Poseidon-t/Streets-Commons.git
cd Streets-Commons
npm install
npm run dev
```

Open `http://localhost:5174` — 5 core metrics work instantly with **zero API keys**.

For all 8 metrics + satellite data, see [Full Setup](#full-setup).

---

## What It Does

SafeStreets analyzes any street address and produces a **walkability safety score (0-10)** based on 8 real, verifiable metrics:

| Metric | Source | What It Measures |
|--------|--------|-----------------|
| Crossing Safety | OpenStreetMap | Crossings weighted by protection level (signalized > unmarked) |
| Sidewalk Coverage | OpenStreetMap | % of streets with documented sidewalks |
| Traffic Speed | OpenStreetMap | Speed limits + lane count danger exposure |
| Destination Access | OpenStreetMap | Variety of walkable destinations within 800m |
| Night Safety | OpenStreetMap | Street lighting coverage |
| Slope | NASADEM | Terrain gradient affecting wheelchair accessibility |
| Tree Canopy | Sentinel-2 NDVI | Vegetation coverage for shade and cooling |
| Thermal Comfort | NASA POWER + Sentinel-2 | Surface temperature + urban heat island effect |

**Scoring weights:** Safety 55% | Comfort 35% | Access 10%

Each metric card shows exactly what it measures, how it's calculated, and where the data comes from.

### Additional Features

- **Compare two locations** side-by-side with metric-by-metric breakdown
- **Traffic fatality data** — US: street-level fatal crashes (NHTSA FARS 2018-2022); International: WHO country death rates
- **AI sidewalk validation** — computer vision detects sidewalk condition from street photos
- **Shareable URLs** — every analysis is linkable
- **Export** — share to social media or download data as JSON
- **Advocacy Toolkit** ($49) — AI-generated letters to city officials with data-backed arguments, policy proposals, and budget analysis

---

## Architecture

```
Browser (React 19 + Vite 7)
  |
  |--- Nominatim (geocoding)
  |--- Overpass API (OSM pedestrian data)
  |--- Open-Elevation API (SRTM 30m elevation)
  |--- OpenWeather Agro API (Sentinel-2/Landsat NDVI)
  |--- Mapillary (street-level photos)
  |
Express.js API Server
  |--- Google Earth Engine (Landsat 8/9 thermal bands)
  |--- NASA POWER (climate normals)
  |--- NHTSA FARS (US crash data)
  |--- Stripe + Clerk (payments + auth)
  |--- Anthropic/Groq/Gemini (advocacy letter AI)
  |
FastAPI CV Backend
  |--- Hugging Face SegFormer (sidewalk segmentation)
```

---

## Data Sources

| Source | Provider | Data | Auth Required |
|--------|----------|------|---------------|
| [OpenStreetMap](https://www.openstreetmap.org) | OSM Community | Crossings, sidewalks, speeds, POIs, lighting | No |
| [Nominatim](https://nominatim.org) | OSM | Geocoding (address to coordinates) | No |
| [Open-Elevation](https://open-elevation.com) | Open Source | SRTM 30m elevation data | No |
| [NASADEM](https://www.earthdata.nasa.gov) | NASA | Digital elevation model | No |
| [NASA POWER](https://power.larc.nasa.gov) | NASA | Climate normals, solar radiation | No |
| [Sentinel-2](https://sentinels.copernicus.eu) | ESA/Copernicus | NDVI vegetation index, NDBI urban index | Via OpenWeather (free key) |
| [Landsat 8/9](https://landsat.gsfc.nasa.gov) | NASA/USGS | Thermal infrared surface temperature | Via Google Earth Engine |
| [NHTSA FARS](https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars) | US DOT | Fatal crash records 2018-2022 | No |
| [WHO GHO](https://www.who.int/data/gho) | World Health Organization | Country-level road traffic deaths | No |
| [Mapillary](https://www.mapillary.com) | Meta | Street-level imagery | Free token |
| [SegFormer](https://huggingface.co/nvidia/segformer-b0-finetuned-cityscapes-1024-1024) | NVIDIA/HuggingFace | Semantic segmentation for sidewalk detection | Self-hosted |

---

## Full Setup

### 5 OSM Metrics (No API Keys)

```bash
npm install && npm run dev
```

Works instantly: Crossing Safety, Sidewalk Coverage, Traffic Speed, Destination Access, Night Safety.

### All 8 Metrics (Satellite Data)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Add free API keys (see .env.example for links):
#    - VITE_OPENWEATHER_API_KEY (tree canopy)
#    - VITE_MAPILLARY_ACCESS_TOKEN (street photos)

# 3. Start backend for thermal data
cd api && npm install && cp .env.example .env
# Configure Google Earth Engine (see SETUP.md)
npm run dev

# 4. Start frontend
cd .. && npm run dev
```

### AI Sidewalk Validation (Optional)

```bash
cd cv-backend
pip install -r requirements.txt
python main.py
# Add VITE_CV_API_URL=http://localhost:8000 to .env
```

See [SETUP.md](SETUP.md) for detailed instructions and troubleshooting.

---

## Self-Hosting

SafeStreets is designed to be self-hosted. You can deploy your own instance:

### Frontend (Vercel / Netlify)

```bash
npm run build
# Deploy the dist/ folder
```

### Backend API (Railway / Render / Fly.io)

```bash
cd api
# Deploy with your platform of choice
# Set environment variables for GEE, Stripe, Clerk
```

### CV Backend (Railway / Fly.io / Docker)

```bash
cd cv-backend
docker build -t safestreets-cv .
docker run -p 8000:8000 safestreets-cv
```

See deployment guides: [API](api/README.md) | [CV Backend](cv-backend/DEPLOYMENT.md)

---

## Tech Stack

**Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS, Leaflet, React Router 7

**Backend:** Express.js 5, Google Earth Engine, Stripe, Clerk

**CV Backend:** Python, FastAPI, Hugging Face Transformers (SegFormer)

**Testing:** Vitest, Playwright

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

Key guidelines:
- Never add fake metrics — every data point must be verifiable
- Open an issue before large changes
- All PRs must pass tests (`npm test`)

See [open issues](https://github.com/Poseidon-t/Streets-Commons/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) tagged `good first issue` to get started.

---

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

You are free to use, modify, and distribute this software. If you deploy a modified version as a network service, you must make your source code available under the same license.

---

## Support the Project

If SafeStreets is useful to you:

- Star this repo to help others discover it
- [Sponsor on GitHub](https://github.com/sponsors/Poseidon-t)
- [Support on Open Collective](https://opencollective.com/safestreets)
- Report bugs or suggest features via [Issues](https://github.com/Poseidon-t/Streets-Commons/issues)
- Contribute code, translations, or documentation

---

## Credits

- [OpenStreetMap](https://www.openstreetmap.org) contributors worldwide
- [NASA](https://www.nasa.gov) for POWER, NASADEM, and Landsat data
- [ESA/Copernicus](https://www.copernicus.eu) for Sentinel-2 imagery
- [NHTSA](https://www.nhtsa.gov) for FARS crash data
- [WHO](https://www.who.int) for global road safety data
- [Leaflet](https://leafletjs.com) for map rendering
- [Mapillary](https://www.mapillary.com) for street-level imagery

---

**SafeStreets** — Honest walkability analysis. No fake metrics. *Data is leverage.*
