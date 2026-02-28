/**
 * Sales Qualification Agent — scores cities and manages lead pipeline
 *
 * Usage:
 *   npx tsx scripts/sales-agent.ts                    # Show qualified cities ranking
 *   npx tsx scripts/sales-agent.ts --leads            # Show all leads
 *   npx tsx scripts/sales-agent.ts --csv              # Export leads as CSV
 *   npx tsx scripts/sales-agent.ts --emails           # Generate outreach emails
 *   npx tsx scripts/sales-agent.ts --add              # Interactive: add a new lead
 */

import { CITIES, type CityData } from '../src/data/cities';

// ── Qualification Criteria ──────────────────────────────────────────────────

interface CityScore {
  city: CityData;
  walkabilityDemand: number;    // 1-10: How much agents care about walkability here
  marketSize: number;           // 1-10: Number of active listings in walkable neighborhoods
  pricePoint: number;           // 1-10: Median price in walkable areas (sweet spot: $400K-$900K)
  agentTechSavvy: number;       // 1-10: How tech-forward local agents are
  competitionGap: number;       // 1-10: How underserved by existing walkability tools
  totalScore: number;
  tier: 'A' | 'B' | 'C';
  bestNeighborhoods: string[];  // Walkable neighborhoods to target
  priceRange: string;           // Typical price range in walkable areas
}

// Scoring data for each city
const CITY_SCORES: Record<string, Omit<CityScore, 'city' | 'totalScore' | 'tier'>> = {
  'new-york': {
    walkabilityDemand: 10, marketSize: 10, pricePoint: 6, agentTechSavvy: 9, competitionGap: 5,
    bestNeighborhoods: ['Brooklyn Heights', 'West Village', 'Upper West Side', 'Park Slope', 'Williamsburg'],
    priceRange: '$600K-$2M',
  },
  'san-francisco': {
    walkabilityDemand: 9, marketSize: 7, pricePoint: 5, agentTechSavvy: 10, competitionGap: 6,
    bestNeighborhoods: ['Mission', 'North Beach', 'Hayes Valley', 'Noe Valley', 'Cole Valley'],
    priceRange: '$800K-$1.8M',
  },
  'chicago': {
    walkabilityDemand: 8, marketSize: 9, pricePoint: 8, agentTechSavvy: 7, competitionGap: 7,
    bestNeighborhoods: ['Lincoln Park', 'Wicker Park', 'Logan Square', 'Lakeview', 'Hyde Park'],
    priceRange: '$350K-$800K',
  },
  'boston': {
    walkabilityDemand: 9, marketSize: 7, pricePoint: 7, agentTechSavvy: 8, competitionGap: 7,
    bestNeighborhoods: ['Back Bay', 'South End', 'Beacon Hill', 'Cambridge', 'Somerville'],
    priceRange: '$500K-$1.2M',
  },
  'philadelphia': {
    walkabilityDemand: 8, marketSize: 8, pricePoint: 9, agentTechSavvy: 6, competitionGap: 8,
    bestNeighborhoods: ['Center City', 'Old City', 'Rittenhouse', 'Fishtown', 'Fairmount'],
    priceRange: '$300K-$650K',
  },
  'washington-dc': {
    walkabilityDemand: 9, marketSize: 8, pricePoint: 7, agentTechSavvy: 8, competitionGap: 6,
    bestNeighborhoods: ['Georgetown', 'Dupont Circle', 'Capitol Hill', 'Adams Morgan', 'U Street'],
    priceRange: '$500K-$1.1M',
  },
  'seattle': {
    walkabilityDemand: 8, marketSize: 7, pricePoint: 7, agentTechSavvy: 9, competitionGap: 7,
    bestNeighborhoods: ['Capitol Hill', 'Ballard', 'Fremont', 'Queen Anne', 'Columbia City'],
    priceRange: '$500K-$1M',
  },
  'portland': {
    walkabilityDemand: 9, marketSize: 7, pricePoint: 9, agentTechSavvy: 8, competitionGap: 8,
    bestNeighborhoods: ['Pearl District', 'Hawthorne', 'Alberta', 'Division', 'Sellwood'],
    priceRange: '$400K-$800K',
  },
  'los-angeles': {
    walkabilityDemand: 6, marketSize: 10, pricePoint: 5, agentTechSavvy: 8, competitionGap: 7,
    bestNeighborhoods: ['Silver Lake', 'Los Feliz', 'Santa Monica', 'Pasadena', 'Highland Park'],
    priceRange: '$700K-$1.5M',
  },
  'denver': {
    walkabilityDemand: 7, marketSize: 7, pricePoint: 8, agentTechSavvy: 7, competitionGap: 8,
    bestNeighborhoods: ['RiNo', 'Highland', 'Capitol Hill', 'Wash Park', 'Baker'],
    priceRange: '$400K-$800K',
  },
  'minneapolis': {
    walkabilityDemand: 7, marketSize: 5, pricePoint: 9, agentTechSavvy: 7, competitionGap: 9,
    bestNeighborhoods: ['Uptown', 'North Loop', 'Northeast', 'Linden Hills', 'St. Paul Cathedral Hill'],
    priceRange: '$300K-$600K',
  },
  'miami': {
    walkabilityDemand: 7, marketSize: 8, pricePoint: 6, agentTechSavvy: 8, competitionGap: 7,
    bestNeighborhoods: ['Brickell', 'Wynwood', 'Coconut Grove', 'Coral Gables', 'South Beach'],
    priceRange: '$400K-$1M',
  },
  'austin': {
    walkabilityDemand: 6, marketSize: 7, pricePoint: 7, agentTechSavvy: 9, competitionGap: 8,
    bestNeighborhoods: ['East Austin', 'Travis Heights', 'Zilker', 'Mueller', 'Downtown'],
    priceRange: '$400K-$800K',
  },
  'atlanta': {
    walkabilityDemand: 6, marketSize: 7, pricePoint: 8, agentTechSavvy: 7, competitionGap: 8,
    bestNeighborhoods: ['Midtown', 'Virginia-Highland', 'Inman Park', 'Old Fourth Ward', 'Decatur'],
    priceRange: '$350K-$700K',
  },
  'nashville': {
    walkabilityDemand: 5, marketSize: 7, pricePoint: 7, agentTechSavvy: 6, competitionGap: 9,
    bestNeighborhoods: ['East Nashville', 'Germantown', '12 South', 'The Gulch', 'Hillsboro Village'],
    priceRange: '$400K-$750K',
  },
  'dallas': {
    walkabilityDemand: 4, marketSize: 8, pricePoint: 7, agentTechSavvy: 7, competitionGap: 8,
    bestNeighborhoods: ['Uptown', 'Bishop Arts', 'Deep Ellum', 'Knox-Henderson', 'Lakewood'],
    priceRange: '$350K-$700K',
  },
  'houston': {
    walkabilityDemand: 3, marketSize: 9, pricePoint: 8, agentTechSavvy: 6, competitionGap: 8,
    bestNeighborhoods: ['Montrose', 'Heights', 'Midtown', 'Rice Village', 'EaDo'],
    priceRange: '$350K-$650K',
  },
  'phoenix': {
    walkabilityDemand: 3, marketSize: 8, pricePoint: 8, agentTechSavvy: 6, competitionGap: 9,
    bestNeighborhoods: ['Downtown', 'Roosevelt Row', 'Arcadia', 'Old Town Scottsdale', 'Tempe'],
    priceRange: '$350K-$650K',
  },
  'detroit': {
    walkabilityDemand: 5, marketSize: 5, pricePoint: 10, agentTechSavvy: 5, competitionGap: 10,
    bestNeighborhoods: ['Midtown', 'Corktown', 'Downtown', 'Brush Park', 'West Village'],
    priceRange: '$200K-$500K',
  },
  'pittsburgh': {
    walkabilityDemand: 6, marketSize: 5, pricePoint: 10, agentTechSavvy: 6, competitionGap: 9,
    bestNeighborhoods: ['Squirrel Hill', 'Lawrenceville', 'Shadyside', 'East Liberty', 'Strip District'],
    priceRange: '$250K-$550K',
  },
};

// ── Lead Management ─────────────────────────────────────────────────────────

export interface QualifiedLead {
  rank: number;
  agentName: string;
  brokerage: string;
  city: string;
  state: string;
  neighborhood: string;
  email: string;
  phone: string;
  website: string;
  sampleListing: string;          // Address to generate report for
  listingPrice: string;
  qualificationNotes: string;     // Why this agent is qualified
  outreachStatus: 'not_started' | 'email_sent' | 'followed_up' | 'responded' | 'converted' | 'lost';
  outreachDate?: string;
  responseDate?: string;
  notes?: string;
}

// ── Scoring Engine ──────────────────────────────────────────────────────────

function scoreCities(): CityScore[] {
  return CITIES.map(city => {
    const scores = CITY_SCORES[city.slug];
    if (!scores) return null;
    const total = scores.walkabilityDemand + scores.marketSize + scores.pricePoint + scores.agentTechSavvy + scores.competitionGap;
    const tier: 'A' | 'B' | 'C' = total >= 38 ? 'A' : total >= 32 ? 'B' : 'C';
    return { city, ...scores, totalScore: total, tier };
  }).filter(Boolean) as CityScore[];
}

function printCityRanking() {
  const scored = scoreCities().sort((a, b) => b.totalScore - a.totalScore);

  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║              SAFESTREETS — SALES QUALIFICATION AGENT                    ║');
  console.log('║              City Ranking for Agent Report Outreach                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  console.log('Tier │ City             │ Score │ Walk │ Mkt  │ Price│ Tech │ Gap  │ Best Neighborhoods');
  console.log('─────┼──────────────────┼───────┼──────┼──────┼──────┼──────┼──────┼──────────────────────────────');

  for (const s of scored) {
    const tier = s.tier === 'A' ? '  A ' : s.tier === 'B' ? '  B ' : '  C ';
    const name = s.city.name.padEnd(16);
    const total = String(s.totalScore).padStart(3);
    const walk = String(s.walkabilityDemand).padStart(4);
    const mkt = String(s.marketSize).padStart(4);
    const price = String(s.pricePoint).padStart(4);
    const tech = String(s.agentTechSavvy).padStart(4);
    const gap = String(s.competitionGap).padStart(4);
    const hoods = s.bestNeighborhoods.slice(0, 3).join(', ');
    console.log(`${tier} │ ${name} │  ${total}  │ ${walk} │ ${mkt} │ ${price} │ ${tech} │ ${gap} │ ${hoods}`);
  }

  console.log('\nScoring: Walk = walkability demand, Mkt = market size, Price = sweet spot ($400K-$900K),');
  console.log('         Tech = agent tech-savviness, Gap = underserved by existing tools');
  console.log(`\nTier A (38+): Priority outreach — agents here actively care about walkability`);
  console.log(`Tier B (32-37): Good targets — walkability is a differentiator`);
  console.log(`Tier C (<32): Lower priority — car-centric, harder sell\n`);

  const tierA = scored.filter(s => s.tier === 'A');
  const tierB = scored.filter(s => s.tier === 'B');
  console.log(`Strategy: Target ${tierA.length} Tier A cities first (${tierA.map(s => s.city.name).join(', ')})`);
  console.log(`Then expand to ${tierB.length} Tier B cities (${tierB.map(s => s.city.name).join(', ')})\n`);
}

// ── Lead Storage ────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const LEADS_FILE = join(import.meta.dirname || __dirname, '..', 'data', 'qualified-leads.json');

function loadLeads(): QualifiedLead[] {
  if (!existsSync(LEADS_FILE)) return [];
  return JSON.parse(readFileSync(LEADS_FILE, 'utf-8'));
}

function saveLeads(leads: QualifiedLead[]) {
  const dir = join(import.meta.dirname || __dirname, '..', 'data');
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs');
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  console.log(`\n✓ Saved ${leads.length} leads to ${LEADS_FILE}`);
}

function printLeads(leads: QualifiedLead[]) {
  if (leads.length === 0) {
    console.log('\nNo leads yet. Add leads with --add or populate data/qualified-leads.json\n');
    return;
  }
  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    QUALIFIED LEADS PIPELINE                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  for (const lead of leads) {
    const status = {
      not_started: '⬜',
      email_sent: '📧',
      followed_up: '🔄',
      responded: '💬',
      converted: '✅',
      lost: '❌',
    }[lead.outreachStatus];

    console.log(`${status} #${lead.rank} ${lead.agentName} — ${lead.brokerage}`);
    console.log(`   ${lead.city}, ${lead.state} (${lead.neighborhood})`);
    console.log(`   📧 ${lead.email} | 📞 ${lead.phone}`);
    console.log(`   🏠 ${lead.sampleListing} (${lead.listingPrice})`);
    console.log(`   💡 ${lead.qualificationNotes}`);
    if (lead.notes) console.log(`   📝 ${lead.notes}`);
    console.log('');
  }
}

function exportCSV(leads: QualifiedLead[]) {
  const header = 'Rank,Agent,Brokerage,City,State,Neighborhood,Email,Phone,Website,Listing,Price,Status,Notes';
  const rows = leads.map(l =>
    `${l.rank},"${l.agentName}","${l.brokerage}","${l.city}","${l.state}","${l.neighborhood}","${l.email}","${l.phone}","${l.website}","${l.sampleListing}","${l.listingPrice}","${l.outreachStatus}","${l.qualificationNotes}"`
  );
  const csv = [header, ...rows].join('\n');
  const csvPath = LEADS_FILE.replace('.json', '.csv');
  writeFileSync(csvPath, csv);
  console.log(`\n✓ Exported ${leads.length} leads to ${csvPath}\n`);
}

function generateEmails(leads: QualifiedLead[]) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    OUTREACH EMAILS                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  for (const lead of leads) {
    console.log(`━━━ To: ${lead.agentName} <${lead.email}> ━━━`);
    console.log(`Subject: Walkability data for ${lead.sampleListing}\n`);
    console.log(`Hi ${lead.agentName.split(' ')[0]},\n`);
    console.log(`I noticed your listing at ${lead.sampleListing} in ${lead.neighborhood} — great location.`);
    console.log(`\nI built SafeStreets, a tool that generates branded walkability reports from satellite + infrastructure data. 8 real metrics (sidewalks, tree cover, crossings, lighting, terrain, etc.) formatted as a 3-page PDF with your name and contact info on every page.`);
    console.log(`\nAgents in walkable areas like ${lead.neighborhood} are using these to:`);
    console.log(`  • Differentiate listings beyond generic Walk Score numbers`);
    console.log(`  • Give buyers data that justifies premium pricing`);
    console.log(`  • Build their personal brand as the "walkability expert" in the area`);
    console.log(`\nI'd love to generate a free report for your ${lead.sampleListing} listing so you can see it.`);
    console.log(`\nIf it's useful, Pro is a one-time $99 purchase — unlimited branded reports for every listing, no subscription. We also build custom dashboards for teams if that's more relevant.`);
    console.log(`\nGet Pro: https://buy.stripe.com/7sY5kD8XD7VL3FAgYo2Fa08`);
    console.log(`More info: https://safestreets.streetsandcommons.com/enterprise/real-estate`);
    console.log(`\nBest,`);
    console.log(`Sarath`);
    console.log(`SafeStreets — safestreets.streetsandcommons.com\n`);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--leads')) {
  printLeads(loadLeads());
} else if (args.includes('--csv')) {
  exportCSV(loadLeads());
} else if (args.includes('--emails')) {
  generateEmails(loadLeads());
} else {
  printCityRanking();
  const leads = loadLeads();
  if (leads.length > 0) {
    console.log(`Pipeline: ${leads.length} leads | ${leads.filter(l => l.outreachStatus === 'not_started').length} pending | ${leads.filter(l => l.outreachStatus === 'email_sent').length} sent | ${leads.filter(l => l.outreachStatus === 'responded').length} responded | ${leads.filter(l => l.outreachStatus === 'converted').length} converted\n`);
  }
}
