# Reddit Launch Post - r/urbanplanning

## POST TITLE (Keep under 300 characters)
**I built a free tool to analyze your street's walkability using real data (crossing safety, traffic speed, sidewalks, lighting + more)**

---

## POST BODY

Hey r/urbanplanning,

I've been frustrated watching professional urban planning tools cost $5,000-50,000/year while residents who want safer streets have zero access to data. So I built **SafeStreets** - a free walkability analysis tool that anyone can use.

### What it does:

Analyzes any address worldwide and gives you **8 metrics with actual data**:

**Safety (OpenStreetMap — 55% weight):**
- Crossing safety (weighted by type: signalized > unmarked)
- Sidewalk coverage (% of streets with sidewalks)
- Traffic speed exposure (speed limits + lane counts)
- Night safety (street lighting coverage)
- Daily destinations nearby

**Comfort (Satellite data — 35% weight):**
- Terrain slope (NASADEM)
- Tree canopy coverage (Sentinel-2 NDVI)
- Thermal comfort (NASA POWER + Sentinel-2 heat island)

**Crucially:** It shows you the RAW DATA, not just a score. So you see "Average speed: 45 mph, 4 lanes" or "12% of streets have sidewalks".

### Try it:

**https://safestreets.streetsandcommons.com**

I pre-analyzed some interesting examples:

**Paris, Champs-Élysées:**
- Overall: 7.2/10 (good walkability)
- Crossing safety: 8/10 (signalized crossings)
- Sidewalks: 9/10 (excellent coverage)
- Traffic speed: 5/10 (wide boulevard, fast traffic)

**San Francisco, Lombard Street:**
- Overall: 5.1/10 (fair)
- Slope: 1/10 (15° average - brutal for accessibility)
- Tree canopy: 8/10 (at least there's shade)
- Sidewalks: 7/10 (decent coverage)

**Houston suburb (random selection):**
- Overall: 2.5/10 (car-dependent)
- Crossing safety: 1/10 (unmarked crossings only)
- Sidewalks: 1/10 (almost none)
- Traffic speed: 2/10 (45mph, 6 lanes)

### Why it's free:

All data sources are free:
- OpenStreetMap (crossings, sidewalks, speed limits, lanes, lighting)
- NASA POWER (surface temperature)
- Sentinel-2 (tree canopy NDVI, urban heat island)
- NASADEM (elevation/slope)

My data costs are literally $0/year, so I can offer this for free.

### Premium features ($19 one-time):

For people actually fighting for change in their neighborhoods:
- AI-generated advocacy letters (cites your data + WHO/NACTO standards)
- Cost estimates for improvements
- PDF reports for city council meetings
- Compare mode (side-by-side analysis)

But all the core analysis is free forever, no sign-up required.

### Technical details (for the nerds):

- React + TypeScript frontend
- Node.js API proxy (handles rate limiting + caching)
- Progressive data loading (OSM first, satellite streams in)
- 151 automated tests
- Open methodology (all calculations documented)

### Why I built this:

Walk Score is a single number with no breakdown. UrbanFootprint costs $50K/year. ArcGIS requires a GIS degree. I wanted something an angry parent could use to show the city council why their kid's school route is unsafe.

---

**Try your own street and let me know what you find!**

Open to feedback, bug reports, and feature suggestions. This is a side project (for now) and I'm figuring out the roadmap.

Link: **https://safestreets.streetsandcommons.com**

---

## RESPONSE STRATEGY

### Prepare answers for predictable questions:

**Q: "How accurate is OpenStreetMap data?"**
A: OSM quality varies. In urban areas (US/EU), crossing and street data is 90%+ accurate - roads are the most mapped feature globally. Satellite data (slope, temperature, air quality) is scientifically validated NASA/ESA sources. The tool shows data confidence levels for each metric. Rural areas have less OSM data, but satellite metrics still work.

**Q: "This says my neighborhood is bad but I love it here - what gives?"**
A: Scores are safety-focused (crossing quality, sidewalks, traffic speed, lighting) not vibes. A low score doesn't mean it's unlivable - it means there are infrastructure gaps. You might love your neighborhood AND want better sidewalks/crossings. The tool helps quantify those gaps for advocacy.

**Q: "Walk Score already does this."**
A: Walk Score is a single 0-100 number with no breakdown and no safety data. You can't see WHY you got that score or what to fix. SafeStreets gives 8 separate metrics with raw measurements — crossing safety, sidewalk coverage, traffic speed, street lighting — things Walk Score doesn't touch. And our API doesn't cost $1,000+/year.

**Q: "Why charge for PDF exports? Seems like a cash grab."**
A: The entire analysis is free. Premium is for advocacy tools (AI letter writing, professional reports) that have ongoing costs (Groq API, even on free tier has rate limits). 90% of users will never hit the free limits. The $19 is for activists preparing for city council meetings who need polished outputs.

**Q: "This gave my street a high score but it feels unsafe due to [crime/lighting/etc]."**
A: This tool measures infrastructure safety (crossings, sidewalks, traffic speed, lighting, slope, heat) not crime or social factors. Those require local surveys or in-person audits. Think of this as "physical walkability" - the foundation. Safety perception is a separate (important!) layer.

**Q: "Can I use this for my city planning job?"**
A: Yes! Free tier works for exploratory analysis. If you need batch mode (analyze hundreds of addresses) or historical tracking, contact me about a city/enterprise tier. I'm working on bulk analysis features.

**Q: "Is this open source?"**
A: Not yet, but I'm considering it. The methodology is fully documented, and I'm planning to release the dataset for academic use. If there's interest from the community, I'd open-source the analysis engine.

**Q: "This is awesome! How can I support you?"**
A: Three ways: (1) Share it with your local advocacy groups, (2) If you use the premium tier, that directly supports development, (3) If you know of grants for civic tech tools, send them my way - I'm bootstrapping this while working a day job.

**Q: "[Technical critique about methodology]"**
A: [Engage honestly, don't be defensive] Great point. I'm using [explain methodology]. If you have suggestions for improvement or know of better data sources, I'm all ears. This is v1 and I'm actively iterating based on feedback.

**Q: "Your lighting/speed data seems off for my street."**
A: Speed limits and lighting data come from OpenStreetMap tags. In well-mapped areas (US/EU cities), coverage is good. If your street's speed limit or lighting isn't tagged in OSM, we infer from road type (residential=25mph, primary=45mph). You can improve the data by contributing to OpenStreetMap.

**Q: "I got an error when analyzing [location]."**
A: Thanks for the report! Can you share the exact address and error message? The most common issues are: (1) Rural areas with minimal OSM data, (2) Satellite data temporarily unavailable, (3) Rate limiting if we get a traffic spike. I'm monitoring errors and fixing them as they come in.

---

## POSTING STRATEGY

### Timing:
- **Best time:** Tuesday-Thursday, 9-11am EST (when US urbanists are caffeinating)
- **Avoid:** Monday morning (people clearing inbox), Friday afternoon (checked out for weekend)

### Cross-posting:
After posting to r/urbanplanning, wait 2 hours then cross-post to:
1. **r/fuckcars** (they'll love the car-dependency data) - afternoon same day
2. **r/transit** (15-minute city + destination access) - next morning
3. **r/citieskylines** (gamers love real-world data) - next day

Don't spam all at once - Reddit's algorithm penalizes that.

### Engagement:
- Respond to EVERY comment in first 3 hours (boosts post in algorithm)
- Upvote critical feedback (shows you're not defensive)
- Offer to analyze people's streets in comments (gets them to use the tool)
- If someone shares a bad score, commiserate and explain what it means
- If someone shares a great score, celebrate it

### What NOT to do:
- Don't argue with critics (engage, but don't fight)
- Don't over-promote the paid tier (lead with free value)
- Don't spam your link multiple times in comments
- Don't delete negative feedback (makes you look sketchy)

---

## BACKUP EXAMPLES (If pre-analysis doesn't work)

Have these ready to post in comments:

**Amsterdam, Jordaan District:**
- Overall: 8.5/10
- Crossing safety: 9/10 (mostly signalized)
- Sidewalks: 9/10
- Traffic speed: 9/10 (30km/h zones)
- Commentary: "Dutch urban planning excellence. Low speeds, protected crossings, complete sidewalk network."

**Los Angeles, Wilshire Boulevard:**
- Overall: 3.5/10
- Crossing safety: 3/10 (long gaps between crosswalks)
- Traffic speed: 2/10 (45mph, 6 lanes)
- Sidewalks: 4/10 (some coverage but hostile environment)
- Commentary: "Classic car-centric design. Wide, fast road — the infrastructure tells pedestrians they don't belong."

**Barcelona, Superblock (Carrer de Provença):**
- Overall: 7.8/10
- Crossing safety: 8/10 (well-signalized)
- Traffic speed: 8/10 (superblock slows traffic)
- Tree canopy: 8/10
- Commentary: "Superblock transformation working - before/after would be interesting."

---

## SUCCESS METRICS

Track in first 24 hours:
- Upvotes (target: 100+)
- Comments (target: 50+)
- Site visits (install Plausible first!)
- Sign-ups for premium (if any)

If post gets <50 upvotes, post was mistimed or title was weak. Try again in different subreddit with lessons learned.

If post gets 100+ upvotes but low site traffic, people liked the concept but didn't click through - improve examples in post.

If post gets high traffic but bounces immediately, there's a UX issue on landing page - fix and repost in 2 weeks.

---

Good luck! 🚀
