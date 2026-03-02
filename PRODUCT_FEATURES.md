# SafeStreets -- Product Features

**URL**: safestreets.streetsandcommons.com

---

## Core Analysis (Free, Unlimited)

Search any address worldwide. Get a **0-10 walkability score** with letter grade (A-F) in under 30 seconds.

**US -- 4 Scored Metrics:**

| Metric | Source | What It Measures |
|--------|--------|-----------------|
| Tree Canopy | Sentinel-2 satellite + AI web research | Vegetation, shade, greenery from satellite NDVI calibrated with real-world data |
| Street Design | EPA National Walkability Index | Intersection density, transit proximity, land use mix |
| Destinations | OpenStreetMap | Grocery, schools, healthcare, restaurants, parks, transit within walking distance |
| Commute Mode | US Census ACS | % walking, biking, transit vs driving |

**International -- 3 Scored Metrics:**

| Metric | Source | What It Measures |
|--------|--------|-----------------|
| Tree Canopy | Sentinel-2 satellite + AI web research | Vegetation, shade, greenery from satellite NDVI calibrated with real-world data |
| Street Grid | OpenStreetMap | Block lengths, dead-end ratio, intersection density |
| Destinations | OpenStreetMap | Grocery, schools, healthcare, restaurants, parks, transit within walking distance |

---

## Neighborhood Intelligence

Loaded automatically below the score. Visual sections with charts and badges:

- **How People Get Around** -- commute mode stacked bar (walk/bike/transit/WFH/carpool/drive), zero-car households, rail + bus stop badges (Census ACS + OSM)
- **What's Nearby** -- parks, playgrounds, gardens, supermarkets, grocery stores with counts and proximity. Food desert flag if no supermarket within 800m (OSM)
- **Health & Environment** -- obesity, diabetes, physical inactivity, asthma rates compared to US average with color-coded bars (CDC PLACES). Flood risk badge with FEMA zone classification (FEMA NFHL)
- **Business Ecosystem** -- 8 categories (retail, dining, healthcare, education, financial, transit, recreation, services) with counts within 1.2km
- **Demographics** -- median income, poverty rate, unemployment, home values, median age, education level, economic vitality score (Census ACS)

---

## 15-Minute City Analysis

Scores how many essential services are within a 15-minute walk (1.2km): grocery, healthcare, education, recreation, transit, dining. Shows count, distance to nearest, and gap analysis for missing services.

---

## Comparison Mode

Analyze 2 locations side-by-side. Head-to-head metric comparison, winner per metric, difference scores, data quality indicators.

---

## Sharing

- **Report Card Image** -- download PNG or copy to clipboard via html2canvas. Shows score circle, walker infographic, metric bars, field verification badge
- **Social Templates** -- pre-written share text for Twitter/X, LinkedIn, Facebook, score-aware (different messaging for good vs poor scores)
- **Direct URL** -- shareable link with coordinates, opens directly to results

---

## Field Audit Tool

Walk the street and rate 28 checklist items across 8 categories: sidewalks, crossings, traffic, shade, lighting, accessibility, safety, amenities. Rate each Good/Needs Work/Missing. Attach photos (compressed). Auto-saves to browser. Export as PDF proposal.

---

## Agent Reports (Real Estate Pro)

Branded 3-page printable report with agent name, company, logo, contact info, custom brand color on every page.

**Page 1**: Score hero, walker infographic, percentile ranking, strengths/concerns
**Page 2**: Detailed metric cards with scores and source attribution, field verification controls, data quality
**Page 3**: Tree canopy & greenery assessment (AI research description + known features), neighborhood intelligence (commute bars, transit badges, amenity cards, health bars, flood badge), about section, agent footer

Agents can field-verify by adjusting any metric +/- 0.5, adding observation notes, and stamping with verifier name + date.

---

## Comparison Reports

2-4 neighborhoods side-by-side with agent branding. Winner highlighted. Property value premium estimate ($2,000 per Walk Score point). Printable, shareable via link.

---

## Email Image Card (Admin)

Mobile-sized (375px) branded card generated from the sales pipeline. Shows score circle, all metrics, greenery assessment, commute bar, transit/park/food badges, health snapshot, flood risk, agent contact. Download as PNG or copy to clipboard for email attachment.

---

## Admin Dashboard

- **Analytics** -- real-time: visitors, page views, analyses, chat messages. 7-day trend. Top referrers, countries, UTM sources/campaigns. Auto-refreshes every 30s
- **Sales Pipeline** -- 200+ real estate agent leads with outreach status tracking (not started / email sent / followed up / responded / converted / lost). Email validation, auto-generated outreach templates, one-click report + image generation per lead. Multi-lead comparison reports. CSV export
- **Content Queue** -- AI-powered blog topic suggestions by region and post type. Editorial calendar
- **Blog Manager** -- AI blog generation with tone/region/keyword targeting. Create, edit, publish posts
- **Email Captures** -- collected signups with export

---

## Enterprise Verticals

4 dedicated pages: Governments (ADA audits, Vision Zero), Real Estate (site selection, risk), Mobility (transit, micromobility), Research (academic methodology). Each with challenges, solutions, use cases, and CTAs.

---

## Data Sources

| Source | Data |
|--------|------|
| Sentinel-2 (ESA) | Tree canopy NDVI at 10m resolution |
| Anthropic Claude + Web Search | Ground-truth greenery calibration |
| EPA National Walkability Index | Street design at census block level |
| US Census ACS 5-year | Demographics, commute mode, income |
| CDC PLACES | Health indicators by census tract |
| FEMA NFHL | Flood zone classification |
| OpenStreetMap | Streets, POIs, transit, parks, food |
| NASA POWER | Surface temperature |

---

## Technical

- React + TypeScript + Vite frontend
- Node.js Express API
- Deployed on Railway (auto-deploy from GitHub)
- Clerk authentication
- html2canvas for image generation
- No external walkability API dependency -- all computed from raw data
