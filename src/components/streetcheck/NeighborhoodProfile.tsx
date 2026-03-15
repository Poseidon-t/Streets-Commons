import { useState } from 'react';
import type { DemographicData, WalkabilityMetrics, WalkabilityScoreV2, OSMData, NeighborhoodIntelligence } from '../../types';
import { analyzeLocalEconomy, type LocalEconomicProfile } from '../../utils/localEconomicAnalysis';
import { scoreColor10 as getScoreColor } from '../../utils/colors';
import { ANALYSIS_RADIUS } from '../../constants';

// ── re-used from equity / economic / intel ─────────────────────────────────

type ProfileTab = 'daily' | 'economy' | 'community';

// Commute bar ----------------------------------------------------------------

function CommuteBar({ commute }: { commute: NonNullable<NeighborhoodIntelligence['commute']> }) {
  const drivePct = Math.max(0, 100 - commute.walkPct - commute.bikePct - commute.transitPct - commute.wfhPct - commute.carpoolPct);
  const segments = [
    { pct: commute.walkPct, color: '#22c55e', label: 'Walk' },
    { pct: commute.bikePct, color: '#3b82f6', label: 'Bike' },
    { pct: commute.transitPct, color: '#8b5cf6', label: 'Transit' },
    { pct: commute.wfhPct, color: '#06b6d4', label: 'WFH' },
    { pct: commute.carpoolPct, color: '#f59e0b', label: 'Carpool' },
    { pct: drivePct, color: '#d1d5db', label: 'Drive' },
  ].filter(s => s.pct > 0);

  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-4 mb-2" style={{ backgroundColor: '#f0ebe0' }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full"
            style={{ width: `${Math.max(seg.pct, 1.5)}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.filter(s => s.pct >= 1).map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs" style={{ color: '#1a3a1a' }}>
              <strong>{Math.round(seg.pct)}%</strong> {seg.label}
            </span>
          </div>
        ))}
      </div>
      {commute.zeroCar > 0 && (
        <p className="text-xs mt-2" style={{ color: '#2a2010' }}>
          {commute.zeroCar}% of households have zero cars
        </p>
      )}
    </div>
  );
}

// Amenity card ----------------------------------------------------------------

function AmenityCard({ icon, count, label, distance }: { icon: string; count: number; label: string; distance?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center p-3 rounded-xl text-center"
      style={{
        backgroundColor: count > 0 ? '#f8f6f1' : 'rgba(239,68,68,0.04)',
        border: count > 0 ? 'none' : '1px dashed #e5ddd0',
        minHeight: '72px',
      }}
    >
      <span className="text-2xl mb-0.5">{icon}</span>
      <span className="text-base font-bold" style={{ color: count > 0 ? '#1a3a1a' : '#c0b0a0' }}>{count}</span>
      <span className="text-xs leading-tight" style={{ color: '#2a2010' }}>{label}</span>
      {distance && <span className="text-xs" style={{ color: '#a0b0a0' }}>{distance}</span>}
    </div>
  );
}

// Business category bar -------------------------------------------------------

const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  retail:     { icon: '🛒', label: 'Retail & Shops',  color: '#3b82f6' },
  dining:     { icon: '🍽️', label: 'Dining & Cafes',  color: '#f97316' },
  healthcare: { icon: '🏥', label: 'Healthcare',       color: '#ef4444' },
  education:  { icon: '🎓', label: 'Education',        color: '#8b5cf6' },
  financial:  { icon: '🏦', label: 'Financial',        color: '#10b981' },
  transit:    { icon: '🚉', label: 'Transit',          color: '#06b6d4' },
  recreation: { icon: '🌳', label: 'Recreation',       color: '#22c55e' },
  services:   { icon: '🏛️', label: 'Services',         color: '#64748b' },
};

function CategoryBar({ category, count, maxCount }: { category: string; count: number; maxCount: number }) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 8 : 0) : 0;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm w-5 text-center flex-shrink-0">{meta.icon}</span>
      <span className="text-xs w-24 flex-shrink-0" style={{ color: count > 0 ? '#1a3a1a' : '#b0a8a0' }}>{meta.label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: count > 0 ? meta.color : 'transparent' }} />
      </div>
      <span className="text-xs font-semibold w-5 text-right" style={{ color: count > 0 ? '#1a3a1a' : '#c5c0b5' }}>{count}</span>
    </div>
  );
}

// Health bar ------------------------------------------------------------------

function HealthBar({ label, value, usAvg, maxVal }: { label: string; value: number; usAvg: number; maxVal: number }) {
  const isBetter = value < usAvg;
  const barColor = isBetter ? '#22c55e' : '#ef4444';
  const barWidth = Math.min((value / maxVal) * 100, 100);
  const avgPos = Math.min((usAvg / maxVal) * 100, 100);
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: '#1a3a1a' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: barColor }}>{value}%</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-visible" style={{ backgroundColor: '#f0ebe0' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: barColor }} />
        <div className="absolute top-0 h-full flex items-center" style={{ left: `${avgPos}%` }}>
          <div className="h-4 w-0.5 -mt-0.5 rounded-full" style={{ backgroundColor: '#8a9a8a' }} />
        </div>
      </div>
      <span className="text-xs" style={{ color: isBetter ? '#22c55e' : '#dc2626' }}>
        {isBetter ? 'Better than' : 'Above'} US avg ({usAvg}%)
      </span>
    </div>
  );
}

// Flood badge ----------------------------------------------------------------

function FloodBadge({ flood }: { flood: NonNullable<NeighborhoodIntelligence['flood']> }) {
  const isHigh = flood.isHighRisk;
  const isMin = flood.floodZone === 'X';
  const color = isHigh ? '#ef4444' : isMin ? '#22c55e' : '#f59e0b';
  const bg = isHigh ? 'rgba(239,68,68,0.08)' : isMin ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.07)';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: bg }}>
      <span className="text-xl">{isHigh ? '🌊' : isMin ? '✓' : '⚠'}</span>
      <div>
        <div className="text-sm font-semibold" style={{ color }}>
          Flood Risk: {isHigh ? 'High' : isMin ? 'Minimal' : 'Moderate'}
        </div>
        <div className="text-xs" style={{ color: '#2a2010' }}>
          FEMA Zone {flood.floodZone} · {flood.description}
        </div>
      </div>
    </div>
  );
}

// ── Daily Life tab ────────────────────────────────────────────────────────────

function DailyLifeTab({ intel }: { intel: NeighborhoodIntelligence }) {
  const { commute, transit, parks, food } = intel;
  const altPct = commute ? Math.round(commute.walkPct + commute.bikePct + commute.transitPct) : 0;

  return (
    <div className="space-y-6">
      {/* Getting around */}
      {(commute || transit) && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🚶</span>
            <span className="text-sm font-semibold" style={{ color: '#1a3a1a' }}>How people get around</span>
          </div>
          {commute && (
            <p className="text-xs mb-3" style={{ color: '#2a2010' }}>
              {altPct >= 30
                ? `${altPct}% walk, bike, or take transit  -  a car-optional neighbourhood.`
                : altPct >= 15
                ? `${altPct}% use alternatives to driving.`
                : `${altPct}% avoid driving  -  most residents depend on a car.`}
            </p>
          )}
          {commute && <CommuteBar commute={commute} />}
          {transit && (
            <div className="flex items-center gap-3 mt-3">
              {transit.railStops > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
                  <span>🚇</span>
                  <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>{transit.railStops}</span>
                  <span className="text-xs" style={{ color: '#6d28d9' }}>rail</span>
                </div>
              )}
              {transit.busStops > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                  <span>🚌</span>
                  <span className="text-sm font-semibold" style={{ color: '#2563eb' }}>{transit.busStops}</span>
                  <span className="text-xs" style={{ color: '#1d4ed8' }}>bus stops</span>
                </div>
              )}
              {transit.totalStops === 0 && (
                <div className="px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}>
                  <span className="text-xs" style={{ color: '#dc2626' }}>No transit stops nearby</span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: '#3d3020' }}>
            {commute ? 'Census ACS' : ''}{commute && transit ? ' · ' : ''}{transit ? 'OpenStreetMap' : ''}
          </p>
        </div>
      )}

      {/* What's nearby */}
      {(parks || food) && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">📍</span>
            <span className="text-sm font-semibold" style={{ color: '#1a3a1a' }}>What's nearby</span>
          </div>
          {food?.isFoodDesert && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}>
              <span className="text-sm">⚠️</span>
              <span className="text-xs font-medium" style={{ color: '#dc2626' }}>
                Food desert  -  no supermarket within 800m
              </span>
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {parks && (
              <>
                <AmenityCard
                  icon="🌳" count={parks.parks} label="Parks"
                  distance={parks.nearestParkMeters !== null ? (parks.nearestParkMeters < 1000 ? `${parks.nearestParkMeters}m` : `${(parks.nearestParkMeters / 1000).toFixed(1)}km`) : undefined}
                />
                <AmenityCard icon="🛝" count={parks.playgrounds} label="Playgrounds" />
                <AmenityCard icon="🌿" count={parks.gardens} label="Gardens" />
              </>
            )}
            {food && (
              <>
                <AmenityCard
                  icon="🛒" count={food.supermarkets} label="Supermarkets"
                  distance={food.nearestSupermarketMeters !== null ? (food.nearestSupermarketMeters < 1000 ? `${food.nearestSupermarketMeters}m` : `${(food.nearestSupermarketMeters / 1000).toFixed(1)}km`) : undefined}
                />
                <AmenityCard icon="🥬" count={food.groceryStores} label="Grocery" />
              </>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: '#3d3020' }}>OpenStreetMap · 1.2km radius</p>
        </div>
      )}
    </div>
  );
}

// ── Economy tab ───────────────────────────────────────────────────────────────

const VITALITY_CONFIG = {
  thriving:   { color: '#16a34a', label: 'Thriving',   bg: 'rgba(34,197,94,0.08)' },
  active:     { color: '#65a30d', label: 'Active',     bg: 'rgba(101,163,13,0.08)' },
  moderate:   { color: '#ca8a04', label: 'Moderate',   bg: 'rgba(202,138,4,0.08)' },
  developing: { color: '#ea580c', label: 'Developing', bg: 'rgba(234,88,12,0.08)' },
  limited:    { color: '#dc2626', label: 'Limited',    bg: 'rgba(220,38,38,0.08)' },
} as const;

function EconomyTab({ profile }: { profile: LocalEconomicProfile }) {
  const v = VITALITY_CONFIG[profile.vitality];
  const maxCount = Math.max(...Object.values(profile.categories));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ color: v.color, backgroundColor: v.bg }}>
          {v.label}
        </span>
        <span className="text-xs" style={{ color: '#2a2010' }}>
          {profile.totalBusinesses} businesses within {ANALYSIS_RADIUS}m
        </span>
      </div>

      <div>
        {(Object.keys(profile.categories) as Array<keyof typeof profile.categories>).map(cat => (
          <CategoryBar key={cat} category={cat} count={profile.categories[cat]} maxCount={maxCount} />
        ))}
      </div>

      {(profile.highlights.length > 0 || profile.gaps.length > 0) && (
        <div className="pt-3 border-t space-y-1.5" style={{ borderColor: '#f0ebe0' }}>
          {profile.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs mt-0.5" style={{ color: '#16a34a' }}>+</span>
              <span className="text-xs" style={{ color: '#1a3a1a' }}>{h}</span>
            </div>
          ))}
          {profile.gaps.map((g, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs mt-0.5" style={{ color: '#dc2626' }}>-</span>
              <span className="text-xs" style={{ color: '#2a2010' }}>{g}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: '#3d3020' }}>OpenStreetMap amenities</p>
    </div>
  );
}

// ── Community tab ─────────────────────────────────────────────────────────────

function CommunityTab({
  demographicData,
  intel,
}: {
  demographicData: DemographicData | null;
  intel: NeighborhoodIntelligence | null;
}) {
  const { health, flood } = intel ?? {};

  const stats: { label: string; value: string; note?: string; noteColor?: string }[] = [];
  if (demographicData?.type === 'us') {
    const d = demographicData;
    if (d.medianHouseholdIncome !== null)
      stats.push({ label: 'Median Income', value: `$${d.medianHouseholdIncome.toLocaleString()}`,
        note: d.medianHouseholdIncome < 40000 ? 'Below US median ($75k)' : d.medianHouseholdIncome < 75000 ? 'Below US median ($75k)' : undefined,
        noteColor: d.medianHouseholdIncome < 40000 ? '#dc2626' : '#ca8a04' });
    if (d.povertyRate !== null)
      stats.push({ label: 'Poverty Rate', value: `${d.povertyRate.toFixed(1)}%`,
        note: d.povertyRate > 20 ? 'High (US avg 12.4%)' : d.povertyRate > 15 ? 'Above US avg (12.4%)' : undefined,
        noteColor: d.povertyRate > 20 ? '#dc2626' : '#ca8a04' });
    if (d.unemploymentRate !== null)
      stats.push({ label: 'Unemployment', value: `${d.unemploymentRate.toFixed(1)}%`,
        note: d.unemploymentRate > 8 ? 'Above national avg' : undefined, noteColor: '#ca8a04' });
    if (d.medianHomeValue !== null)
      stats.push({ label: 'Home Value', value: `$${d.medianHomeValue.toLocaleString()}` });
    if (d.medianAge !== null)
      stats.push({ label: 'Median Age', value: `${d.medianAge.toFixed(0)}` });
    if (d.bachelorOrHigherPct !== null)
      stats.push({ label: 'College Educated', value: `${d.bachelorOrHigherPct.toFixed(0)}%` });
  } else if (demographicData?.type === 'international') {
    const d = demographicData;
    if (d.gdpPerCapita !== null)
      stats.push({ label: 'GDP per Capita', value: `$${d.gdpPerCapita.toLocaleString()}`,
        note: d.gdpPerCapita < 5000 ? 'Low-income country' : d.gdpPerCapita < 15000 ? 'Middle-income' : 'Upper-income',
        noteColor: d.gdpPerCapita < 5000 ? '#dc2626' : d.gdpPerCapita < 15000 ? '#ca8a04' : '#65a30d' });
    if (d.unemploymentRate !== null)
      stats.push({ label: 'Unemployment', value: `${d.unemploymentRate.toFixed(1)}%` });
    if (d.urbanPopulationPct !== null)
      stats.push({ label: 'Urban Population', value: `${d.urbanPopulationPct.toFixed(0)}%` });
  }

  const hasHealth = health && (health.obesity !== null || health.diabetes !== null || health.physicalInactivity !== null || health.asthma !== null);

  return (
    <div className="space-y-5">
      {/* Demographic snapshot */}
      {stats.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#2a2010' }}>
            {demographicData?.type === 'us' ? `Census tract · ${demographicData.tractFips}` : 'Country data'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.map(stat => (
              <div key={stat.label} className="p-2.5 rounded-lg" style={{ background: '#f8f6f1', border: '1px solid #c4b59a' }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#2a2010', fontSize: '11px' }}>{stat.label}</div>
                <div className="text-sm font-bold" style={{ color: '#1a3a1a' }}>{stat.value}</div>
                {stat.note && <div className="text-xs mt-0.5" style={{ color: stat.noteColor || '#3d3020' }}>{stat.note}</div>}
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: '#3d3020' }}>
            {demographicData?.type === 'us' ? `Census ACS ${demographicData.year} · Smart Growth America` : `World Bank ${demographicData?.year}`}
          </p>
        </div>
      )}

      {/* Community health */}
      {hasHealth && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">❤️</span>
            <span className="text-sm font-semibold" style={{ color: '#1a3a1a' }}>Community health vs US average</span>
            <span className="text-xs ml-1" style={{ color: '#a0b0a0' }}>gray line = US avg</span>
          </div>
          {health!.obesity !== null && <HealthBar label="Obesity" value={health!.obesity} usAvg={32} maxVal={50} />}
          {health!.diabetes !== null && <HealthBar label="Diabetes" value={health!.diabetes} usAvg={11} maxVal={25} />}
          {health!.physicalInactivity !== null && <HealthBar label="Physical inactivity" value={health!.physicalInactivity} usAvg={26} maxVal={45} />}
          {health!.asthma !== null && <HealthBar label="Asthma" value={health!.asthma} usAvg={10} maxVal={20} />}
          <p className="text-xs mt-1" style={{ color: '#3d3020' }}>CDC PLACES</p>
        </div>
      )}

      {/* Flood risk */}
      {flood && <FloodBadge flood={flood} />}

      {!stats.length && !hasHealth && !flood && (
        <p className="text-sm" style={{ color: '#a0b0a0' }}>No community data available for this location.</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface NeighborhoodProfileProps {
  neighborhoodIntel: NeighborhoodIntelligence | null;
  demographicData: DemographicData | null;
  metrics: WalkabilityMetrics;
  compositeScore: WalkabilityScoreV2 | null;
  osmData: OSMData | null;
}

export default function NeighborhoodProfile({
  neighborhoodIntel,
  demographicData,
  osmData,
}: NeighborhoodProfileProps) {
  const [tab, setTab] = useState<ProfileTab>('daily');

  const economyProfile = osmData ? analyzeLocalEconomy(osmData) : null;
  const hasEconomy = economyProfile !== null &&
    (economyProfile.totalBusinesses > 0 || economyProfile.categories.recreation > 0 || economyProfile.categories.transit > 0);
  const hasCommunity = !!(demographicData || neighborhoodIntel?.health || neighborhoodIntel?.flood);
  const hasDaily = !!(neighborhoodIntel && (neighborhoodIntel.commute || neighborhoodIntel.transit || neighborhoodIntel.parks || neighborhoodIntel.food));

  if (!hasDaily && !hasEconomy && !hasCommunity) return null;

  const tabs: { id: ProfileTab; label: string }[] = [
    ...(hasDaily   ? [{ id: 'daily'     as ProfileTab, label: 'Daily Life' }] : []),
    ...(hasEconomy ? [{ id: 'economy'   as ProfileTab, label: 'Local Economy' }] : []),
    ...(hasCommunity ? [{ id: 'community' as ProfileTab, label: 'Community' }] : []),
  ];

  // Default to first available tab
  const activeTab = tabs.some(t => t.id === tab) ? tab : tabs[0]?.id ?? 'daily';

  return (
    <div className="retro-card mt-8" style={{ overflow: 'hidden' }}>
      <div className="retro-card-header" style={{ paddingBottom: 0 }}>
        <span className="retro-card-header-title">Neighbourhood profile</span>
      </div>

      {/* Tab pills */}
      {tabs.length > 1 && (
        <div className="flex gap-1 px-4 pt-3 pb-2 border-b" style={{ borderColor: '#c4b59a' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
              style={activeTab === t.id
                ? { backgroundColor: '#1a3a1a', color: '#fff' }
                : { backgroundColor: 'transparent', color: '#2a2010' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '16px 18px' }}>
        {activeTab === 'daily' && neighborhoodIntel && <DailyLifeTab intel={neighborhoodIntel} />}
        {activeTab === 'economy' && economyProfile && <EconomyTab profile={economyProfile} />}
        {activeTab === 'community' && <CommunityTab demographicData={demographicData} intel={neighborhoodIntel} />}
      </div>
    </div>
  );
}
