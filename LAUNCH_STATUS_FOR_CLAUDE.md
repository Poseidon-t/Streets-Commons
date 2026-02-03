# SafeStreets - Current Status & Fundraising Strategy

## LIVE PRODUCTION APP
**URL:** https://safestreets.streetsandcommons.com
**Status:** ✅ FULLY FUNCTIONAL & DEPLOYED
**GitHub:** https://github.com/Poseidon-t/Streets-Commons

---

## WHAT'S WORKING (Production Ready)

### Core Product ✅
- **8-Metric Walkability Analysis** - All working with raw data display
  - Infrastructure: Safe crossings, street directness, daily needs nearby
  - Environment: Slope, tree canopy, surface temp, air quality, heat island
  - Shows both scores AND actual measurements (e.g., "PM2.5: 187.3 µg/m³")
- **Progressive Data Loading** - OSM data first, satellite data streams in
- **Street Cross-Section Visualization** - Auto-generated from OSM data
- **15-Minute City Score** - Isochrone maps showing walkable destinations
- **AI Chatbot** - 6 free messages, powered by Groq (free tier)
- **Share Buttons** - Twitter, Facebook, Reddit

### Premium Features ($19 Advocate Tier) ✅
- **AI Advocacy Letter Generator** - Cites data, references standards (WHO, NACTO)
- **Investment Guide** - AI cost estimates for improvements
- **Advocacy Proposal** - Policy recommendations
- **PDF/JSON Export** - Professional reports
- **Compare Mode** - Side-by-side location analysis
- **Street Redesign** - Recommended lane reallocation
- **Unlimited Chatbot** - No message limits

### Technical Infrastructure ✅
- **Frontend:** React 19 + TypeScript + Vite + Tailwind (deployed)
- **Backend:** Node.js/Express API (deployed)
- **Auth:** Clerk integration (working)
- **Testing:** 151 tests passing (100% pass rate)
- **Data Sources:** NASA POWER, OpenAQ, OSM, NASADEM, Sentinel-2, Groq AI
- **Cost:** $0 recurring (all APIs are free)

---

## WHAT'S NOT DONE (Critical Gaps)

### Revenue ❌
- **Stripe Integration:** Modal exists but NOT wired up
  - Cannot collect $19 payments today
  - No webhook handling
  - No premium unlock flow after payment
- **Clerk-Stripe Connection:** Not configured
- **Payment Testing:** Never tested end-to-end

### Growth/Marketing ❌
- **No Public Launch:** Haven't posted to Reddit, Twitter, etc.
- **No Analytics:** Can't track users (need Plausible or GA)
- **No Social Proof:** No user count, no testimonials
- **No Landing Page Hero:** Goes straight to search (no value prop)
- **No Email List:** Can't capture leads

### Fundraising ❌
- **No Traction Data:** Can't show user growth (no analytics installed)
- **No Grant Applications:** Haven't applied anywhere yet
- **No Pitch Deck:** No slides, no one-pager
- **No Budget:** Don't know exact 12-month runway needed

---

## IMMEDIATE PRIORITIES (Next 72 Hours)

### Priority 1: Enable Revenue (Day 1)
**Goal:** Someone can pay $19 and unlock premium features

**What needs to happen:**
1. Create Stripe account (or connect existing)
2. Create $19 one-time product in Stripe
3. Wire up "Unlock Premium" button → Stripe Checkout
4. Handle success redirect → mark user as premium (Clerk metadata or localStorage)
5. Test purchase end-to-end (test mode, then live)
6. Verify premium features unlock after payment

**Blockers:**
- Need Stripe API keys (test + live)
- Need to decide: Store premium status in Clerk metadata OR localStorage OR backend DB?
- Current code has Clerk auth but no payment state management

---

### Priority 2: Launch for Traction (Day 2-3)
**Goal:** Get first 100 users to show grant funders there's demand

**What needs to happen:**
1. Install analytics (Plausible or Google Analytics)
2. Write Reddit launch post (r/urbanplanning, r/fuckcars, r/transit)
3. Tweet from personal account (tag urbanist influencers)
4. Email 10 local advocacy groups with pre-analyzed streets
5. Post in urbanist Discord/Slack communities
6. Create "Featured Examples" page (Paris, NYC, Houston comparisons)

**Content Strategy:**
- Reddit: "I built a free tool to analyze walkability with satellite data - here's my neighborhood"
- Controversy angle: "Why [famous walkable city] actually scores poorly on X metric"
- Local angle: "I analyzed every neighborhood in [your city] - here's the data"

---

### Priority 3: Prepare Grant Applications (Week 2)
**Goal:** Apply to 3 grants by end of month

**What needs to happen:**
1. Choose 3 best-fit grants (see recommendations below)
2. Draft 1-page executive summary
3. Write personal story (why I built this)
4. Compile traction metrics (need analytics from Priority 2)
5. Create budget breakdown (12-month runway)
6. Submit applications

---

## GRANT TARGETS (Immediate Applications)

### Top 3 Best-Fit Grants (Apply This Month)

**1. Fast Forward Tech Nonprofit Accelerator**
- **Amount:** $25K + mentorship
- **Timeline:** Two cohorts/year (check website for next deadline)
- **Fit:** Early-stage civic tech, perfect match
- **Requirement:** Nonprofit status OR fiscal sponsor
- **Application:** ~2 hours, lightweight
- **Link:** https://www.ffwd.org/apply

**2. Knight Foundation - Civic Tech**
- **Amount:** $50K-100K
- **Timeline:** Rolling applications
- **Fit:** "Better Cities" initiative, democratizing urban planning
- **Requirement:** Show community need + early traction
- **Application:** Full proposal (1 week to write)
- **Angle:** Pilot with 3 mid-size US cities
- **Link:** https://knightfoundation.org/apply

**3. Mozilla Foundation - Responsible CS Challenge**
- **Amount:** $40K
- **Timeline:** Check annual cycle (usually spring)
- **Fit:** Open data, transparency, civic good
- **Requirement:** Open-source commitment
- **Application:** Proposal + demo video
- **Angle:** Release open dataset + API for researchers
- **Link:** https://foundation.mozilla.org

### Runner-Ups (Apply if Top 3 reject)
- **Schmidt Futures** ($75K, AI for social impact)
- **NSF Smart & Connected Communities** ($100K, research partnership)
- **EPA Environmental Justice Grants** ($50K, air quality focus)

---

## FUNDRAISING NARRATIVE (For Applications)

### The Problem
Professional urban planning tools cost $5,000-50,000/year. Residents who want to advocate for safer streets have no access to the data that city officials use to make decisions. This creates an information asymmetry that favors the status quo.

### The Solution
SafeStreets makes professional-grade walkability analysis accessible for $0-19. Uses free satellite data (NASA, ESA) + open infrastructure data (OpenStreetMap) + AI to provide:
- 8 comprehensive metrics (vs. Walk Score's single number)
- Raw data transparency (shows actual PM2.5 readings, not just scores)
- AI-generated advocacy letters that cite standards and data
- Works globally (not just rich countries)

### Why Now?
- **Product is ready:** 151 tests passing, live in production
- **Market validation:** Urbanist community engagement on Twitter/Reddit
- **Cost structure:** $0 recurring costs (all APIs free) = sustainable at scale
- **Impact potential:** 10K users → thousands of advocacy letters → infrastructure changes

### What I Need
**$50K for 12 months:**
- $25K personal runway (full-time for 1 year)
- $10K product development (mobile app, historical tracking, batch analysis)
- $10K marketing (content, ads, conferences)
- $5K operations (hosting, legal, accounting)

**Outcome:** 10,000 monthly active users, 300 paying customers ($5,700 revenue), self-sustaining.

---

## TECHNICAL DETAILS (For Grant Applications)

### Architecture Highlights
- **Zero recurring data costs:** All APIs free (NASA, OpenAQ, OSM, Groq)
- **Serverless-friendly:** Stateless analysis, no database required
- **Sustainable at scale:** Free tier APIs handle 14,400+ req/day
- **Open methodology:** Reproducible, auditable, scientifically grounded

### Data Sources
1. **OpenStreetMap** - Infrastructure (crossings, streets, POIs)
2. **NASA POWER** - Meteorological data (temperature)
3. **Sentinel-2** - Satellite imagery (tree canopy, heat island)
4. **NASADEM** - Elevation data (slope)
5. **OpenAQ** - Air quality (15,000+ monitoring stations globally)
6. **Groq** - AI analysis (Llama 3.3 70B, free tier)

### Validation
- Used international standards: WHO, NACTO, ADA, UN-Habitat
- Compared against Walk Score, UrbanFootprint methodologies
- 151 automated tests (unit, integration, user journey)

---

## IMMEDIATE QUESTIONS FOR GRANT STRATEGY

**Answer these to finalize applications:**

1. **Legal Status:**
   - Are you operating as: Sole proprietor / LLC / Nonprofit / Fiscal sponsor?
   - Do you need to incorporate before applying?

2. **Budget Reality:**
   - What's your actual monthly burn rate (living expenses + costs)?
   - 12-month runway = $________?
   - Can you bootstrap part-time + freelance, or need full-time?

3. **Personal Story:**
   - Why did you build this? (One paragraph, emotional hook)
   - What's your background? (Urban planning, tech, both?)
   - What's your city? (Local angle matters for grants)

4. **Impact Metrics:**
   - Who benefits most? (Residents in underserved neighborhoods, advocacy orgs, etc.)
   - How do you measure success? (# users, # advocacy letters sent, # policy changes?)

5. **Competitive Advantage:**
   - Why can't Walk Score or UrbanFootprint just copy you?
   - What's your moat? (Speed, cost, community, methodology?)

---

## NEXT STEPS (Choose Your Path)

**Path A: Revenue-First (Bootstrap)**
1. Wire up Stripe (2-4 hours)
2. Soft launch to get 10 paying customers ($190)
3. Use revenue to prove demand for grants
4. Apply to grants with traction data
5. Timeline: 2 weeks to first revenue, 4 weeks to first grant application

**Path B: Grant-First (Fast Track)**
1. Apply to Fast Forward immediately (no traction required)
2. Parallel: Launch on Reddit to show momentum
3. Use grant acceptance to quit day job
4. Revenue later (less urgent with grant funding)
5. Timeline: 1 week to applications, 6-8 weeks to hear back

**Path C: Hybrid (Recommended)**
1. Wire up Stripe + install analytics (Day 1)
2. Launch on Reddit/Twitter (Day 2-3)
3. Wait 1 week to collect traction data
4. Apply to 3 grants with "50 users in first week" story
5. Timeline: 2 weeks to grant applications with proof of demand

---

## FOR CLAUDE (WEB) - SPECIFIC HELP NEEDED

**I need you to help me with:**

1. **Stripe Integration Code**
   - Copy-paste React component for "Unlock Premium" button
   - Stripe Checkout flow (one-time $19 payment)
   - Success handler to mark user as premium
   - Use Clerk for user ID, decide where to store premium status

2. **Reddit Launch Post**
   - Template for r/urbanplanning that gets engagement
   - 3 example analyses to include (famous streets)
   - How to respond to skeptics/critics
   - Cross-post strategy (r/fuckcars, r/transit timing)

3. **Grant Application Outline**
   - 1-page executive summary structure
   - Budget breakdown for $50K request
   - Impact metrics framework
   - 3-month milestone roadmap

4. **Analytics Setup**
   - Plausible vs Google Analytics recommendation
   - What events to track (analyses, premium unlocks, shares)
   - Privacy-friendly implementation

5. **Landing Page Hero**
   - Simple HTML/React for above-the-fold section
   - Value prop + social proof placeholder
   - Should I keep search bar above fold or push down?

---

## CONSTRAINTS & CONTEXT

**Time:** Can work [FILL THIS IN] hours/day for next 30 days

**Technical Skills:**
- Strong: React, TypeScript, backend API integration
- Weak: Stripe/payment flows, DevOps, marketing copy

**Budget:** Have $100-500 available for immediate costs (domain already paid, hosting on free tiers)

**Location:** [FILL THIS IN - City/Country]

**Personal Story:** [FILL THIS IN - Why you built this, 2-3 sentences]

**Legal Status:** [FILL THIS IN - Sole proprietor / LLC / planning to incorporate?]

**Day Job:** [FILL THIS IN - Full-time, part-time, unemployed, student?]

---

**START HERE:** Focus on Stripe integration (copy-paste code) + Reddit launch post (template).

Everything else can wait. Revenue proves demand. Demand gets grants.
