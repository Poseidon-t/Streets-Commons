# SafeStreets — Current Product Context

Last updated: 2026-03-04

---

## What It Is

Free neighborhood walkability tool for any address worldwide. No sign-up required. Built by Streets & Commons.

Live at: https://safestreets.streetsandcommons.com

---

## Pricing (authoritative — do not deviate)

| Tier | Price | What's included |
|------|-------|-----------------|
| Core tool | Free, no sign-up | Everything: score, PersonaCards, 12 metrics, 15-min city, neighborhood intel, compare mode |
| Agent Reports | $49 one-time (first 3 free) | Unlimited branded PDF walkability reports for real estate listings |
| Enterprise | Custom inquiry | Custom dashboards, decisioning engine, API, white-label |

No subscription. No $19 tier. No $99 tier. No advocacy toolkit. These are old and no longer exist.

---

## Score System

- **0–10** composite score
- Tier labels: **Walkable** (8.0–10.0) · **Moderate** (6.0–7.9) · **Car-dependent** (4.0–5.9) · **Difficult** (2.0–3.9) · **Hostile** (0–1.9)
- Score displayed as X.X out of 10, with color-coded tier label inside the circular chart

Score colors by tier: ≥80 = #22c55e · ≥60 = #84cc16 · ≥40 = #eab308 · ≥20 = #f97316 · <20 = #ef4444

Note: internally the score is 0–100 (API) and displayed as 0–10 in the UI (divide by 10).

---

## PersonaCards

Three verdict cards shown prominently in results, above the data quality badge:

| Card | Verdicts |
|------|----------|
| Can I go car-free here? | Yes / Borderline / Unlikely |
| Is it safe for kids to walk? | Yes / Borderline / Unlikely |
| Good for aging in place? | Yes / Borderline / Unlikely |

Each verdict has a plain-language explanation. Verdicts are computed from composite score components.

---

## Features

- **Walkability Score** — 0–10 composite, 4 components: Network Design, Environmental Comfort, Safety, Density Context
- **PersonaCards** — 3 lifestyle verdicts (see above)
- **12 Metric Grid** — expandable, includes tree canopy, sidewalk quality, crossing safety, transit access, destinations, lighting, etc.
- **15-Minute City Analysis** — scored access to: grocery, school, park, pharmacy, transit, restaurant
- **Neighborhood Intelligence** (US only) — commute patterns (Census ACS), CDC health outcomes, FEMA flood risk
- **Street Network Analysis** — connectivity, intersection density, pedestrian path coverage
- **Compare Mode** — up to 4 addresses side-by-side
- **Field Audit Tool** — 28-item walk checklist, export PDF
- **Agent Reports** — branded 3-page PDF (name/company/phone/email branding) — first 3 free, $49 unlimited
- **Share** — PNG report card, social templates, direct URL with coordinates
- **Email Capture** — newsletter signup, shown on landing and after results
- **"What's next?" block** — shown after results: Compare + Search Another buttons

**Works in 190+ countries.** US addresses get full data stack. International gets OSM + Sentinel-2.

---

## Data Sources

| Source | What |
|--------|------|
| Sentinel-2 (ESA, 10m) | Tree canopy, vegetation, land use |
| OpenStreetMap | Street network, sidewalks, transit, amenities |
| EPA National Walkability Index | Intersection density, land use mix (US only) |
| US Census ACS | Commute modes, demographics (US only) |
| CDC PLACES | Health outcomes by census tract (US only) |
| FEMA NFHL | Flood zone classification (US only) |
| NASADEM | Terrain slope, ADA accessibility |
| OpenAQ | Real-time air quality (PM2.5) |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Auth | Clerk |
| Deployment | Railway (backend + full app) |
| Image generation | html2canvas |
| Fonts | DM Sans (sans), Space Mono (mono) |

API base URL in frontend: `import.meta.env.VITE_API_URL || ''`

---

## Key File Map

| What | Where |
|------|-------|
| Main app + results + landing | `src/App.tsx` |
| Walkability score circle | `src/components/streetcheck/ScoreCard.tsx` |
| PersonaCards | `src/components/streetcheck/PersonaCards.tsx` |
| 12-metric grid | `src/components/streetcheck/MetricGrid.tsx` |
| Neighborhood intel | `src/components/streetcheck/NeighborhoodIntelligence.tsx` |
| 15-min city | `src/components/streetcheck/FifteenMinuteCity.tsx` |
| Walker infographic | `src/components/WalkerInfographic.tsx` |
| Email capture banner | `src/components/EmailCaptureBanner.tsx` |
| Agent report (PDF) | `src/components/AgentReport.tsx` |
| Field audit tool | `src/components/FieldAuditTool.tsx` |
| Compare mode | `src/components/CompareMode.tsx` |
| Enterprise home | `src/enterprise/EnterpriseHome.tsx` |
| Enterprise how-it-works | `src/enterprise/HowItWorks.tsx` |
| Enterprise pricing | `src/enterprise/Pricing.tsx` |
| Enterprise for real estate | `src/enterprise/ForRealEstate.tsx` |
| Admin layout + nav | `src/admin/AdminLayout.tsx` |
| Admin blog content queue | `src/admin/ContentQueue.tsx` |
| Admin infographic generator | `src/admin/InfographicGenerator.tsx` |
| Admin sales pipeline | `src/admin/SalesPipeline.tsx` |
| API server | `api/server.js` |
| Type definitions | `src/types/index.ts` |
| Routes | `src/main.tsx` |

---

## Admin

Admin dashboard at `/admin`. Gated by `ADMIN_USER_ID` env var (Clerk user ID).

Sections: Analytics · Sales Pipeline · Content Queue · Blog Manager · Email Captures · Infographics

Blog images: **UNSPLASH_ACCESS_KEY is not set in Railway** → uses static bank of ~66 images across 7 categories (pedestrian, cycling, walkable, transit, india, urban, traffic). City-specific images (Barcelona, Amsterdam, Tokyo, etc.) require UNSPLASH_ACCESS_KEY or the city image bank in `api/server.js`.

---

## Enterprise Positioning (critical)

Enterprise = **custom dashboards and decisioning workflows for neighborhood and street intelligence**.

NOT: field audits, boots-on-ground consultants, walking streets with clipboards.
YES: B2B platform, custom dashboards, decisioning engine, API access, white-label, workflow automation.

Verticals: Governments · Real Estate (developers/investors, not just agents) · Mobility Operators · Research Institutions.

---

## What No Longer Exists (removed/changed — don't re-introduce)

- ~~$19 Advocate Tier~~ — removed
- ~~AI Chatbot (6 free messages)~~ — removed
- ~~AI Advocacy Letter Generator~~ — removed
- ~~8-metric system~~ — now 12 metrics
- ~~"Run audit for local council"~~ CTA — reworded
- ~~$99 Pro (Agent Reports)~~ — changed to $49
- ~~"Agent Report" button in results~~ — removed from results page (only accessible via modal flow)
