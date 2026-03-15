import type { NeighborhoodIntelligence, CommuteData, TransitAccessData, ParkAccessData, FoodAccessData, CDCHealthData, FloodRiskData } from '../../types';
import { scoreColor10 as getScoreColor } from '../../utils/colors';

interface NeighborhoodIntelSectionProps {
  neighborhoodIntel: NeighborhoodIntelligence | null;
}

// --- Context generators (one-line summaries) ---

function getCommuteContext(c: CommuteData): string {
  const altPct = Math.round(c.walkPct + c.bikePct + c.transitPct);
  if (altPct >= 30) return `${altPct}% of residents walk, bike, or take transit  -  this is a car-optional neighborhood.`;
  if (altPct >= 15) return `${altPct}% use alternatives to driving. Car ownership is still common.`;
  return `Most residents drive  -  only ${altPct}% walk, bike, or take transit.`;
}

function getTransitContext(t: TransitAccessData): string {
  if (t.railStops > 0 && t.busStops >= 5) return `Strong transit access  -  rail plus ${t.busStops} bus stops within walking distance.`;
  if (t.railStops > 0) return `Rail access available, plus ${t.busStops} bus stop${t.busStops !== 1 ? 's' : ''}.`;
  if (t.busStops >= 5) return `${t.busStops} bus stops nearby  -  decent bus service.`;
  if (t.busStops >= 2) return `Limited transit  -  only ${t.busStops} bus stops nearby.`;
  return 'No transit stops within walking distance  -  car-dependent for commuting.';
}

function getNearbyContext(parks: ParkAccessData | null, food: FoodAccessData | null): string {
  const parts: string[] = [];
  if (parks && parks.totalGreenSpaces > 0) {
    parts.push(`${parks.totalGreenSpaces} green space${parks.totalGreenSpaces !== 1 ? 's' : ''}`);
  }
  if (food && food.supermarkets > 0) {
    parts.push(`${food.supermarkets} supermarket${food.supermarkets !== 1 ? 's' : ''}`);
  }
  if (food?.isFoodDesert) return 'Food desert  -  no supermarket within 800m walking distance.';
  if (parts.length > 0) return `${parts.join(' and ')} within walking distance.`;
  return 'Limited amenities nearby.';
}

function getHealthContext(h: CDCHealthData): string {
  let better = 0; let total = 0;
  if (h.obesity !== null) { total++; if (h.obesity < 32) better++; }
  if (h.diabetes !== null) { total++; if (h.diabetes < 11) better++; }
  if (h.physicalInactivity !== null) { total++; if (h.physicalInactivity < 26) better++; }
  if (h.asthma !== null) { total++; if (h.asthma < 10) better++; }
  if (better > total / 2) return `Healthier than average  -  ${better} of ${total} indicators beat US norms.`;
  if (better === Math.floor(total / 2)) return 'Community health near national average.';
  return `${total - better} health indicator${total - better !== 1 ? 's' : ''} above US average  -  a concern for active living.`;
}

// --- Section score calculators ---

function getTransitScore(commute: CommuteData | null, transit: TransitAccessData | null): number {
  if (transit) return transit.score;
  if (commute) {
    const altPct = commute.walkPct + commute.bikePct + commute.transitPct;
    return Math.min(10, altPct / 5);
  }
  return 0;
}

function getNearbyScore(parks: ParkAccessData | null, food: FoodAccessData | null): number {
  const scores: number[] = [];
  if (parks) scores.push(parks.score);
  if (food) scores.push(food.score);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function getHealthScore(health: CDCHealthData | null, flood: FloodRiskData | null): number {
  let total = 0; let count = 0;
  if (health) {
    let better = 0; let indicators = 0;
    if (health.obesity !== null) { indicators++; if (health.obesity < 32) better++; }
    if (health.diabetes !== null) { indicators++; if (health.diabetes < 11) better++; }
    if (health.physicalInactivity !== null) { indicators++; if (health.physicalInactivity < 26) better++; }
    if (health.asthma !== null) { indicators++; if (health.asthma < 10) better++; }
    if (indicators > 0) { total += (better / indicators) * 10; count++; }
  }
  if (flood) {
    total += flood.isHighRisk ? 2 : flood.floodZone === 'X' ? 9 : 5;
    count++;
  }
  return count > 0 ? total / count : 0;
}

// ==========================================
// VISUAL INFOGRAPHIC COMPONENTS
// ==========================================

function SectionScoreBadge({ score }: { score: number }) {
  const color = getScoreColor(score);
  return (
    <span className="text-sm font-bold ml-auto" style={{ color }}>
      {score.toFixed(1)}
    </span>
  );
}

/** Horizontal stacked bar showing commute mode split */
function CommuteBar({ commute }: { commute: CommuteData }) {
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
      <div className="flex rounded-full overflow-hidden h-5 mb-3" style={{ backgroundColor: '#f0ebe0' }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full transition-all duration-700 relative group"
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
              <strong style={{ color: '#1a3a1a' }}>{Math.round(seg.pct)}%</strong> {seg.label}
            </span>
          </div>
        ))}
      </div>
      {commute.zeroCar > 0 && (
        <div className="text-xs mt-2" style={{ color: '#2a2010' }}>
          {commute.zeroCar}% of households have zero cars
        </div>
      )}
    </div>
  );
}

/** Transit icon badges */
function TransitBadges({ transit }: { transit: TransitAccessData }) {
  return (
    <div className="flex items-center gap-3 mt-3">
      {transit.railStops > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
          <span className="text-base">🚇</span>
          <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>{transit.railStops}</span>
          <span className="text-xs" style={{ color: '#6d28d9' }}>rail</span>
        </div>
      )}
      {transit.busStops > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
          <span className="text-base">🚌</span>
          <span className="text-sm font-semibold" style={{ color: '#2563eb' }}>{transit.busStops}</span>
          <span className="text-xs" style={{ color: '#1d4ed8' }}>bus stops</span>
        </div>
      )}
      {transit.totalStops === 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}>
          <span className="text-xs" style={{ color: '#dc2626' }}>No transit nearby</span>
        </div>
      )}
    </div>
  );
}

/** Amenity icon cards */
function AmenityCard({ icon, count, label, distance }: { icon: string; count: number; label: string; distance?: string }) {
  const hasItems = count > 0;
  return (
    <div
      className="flex flex-col items-center justify-center p-3 rounded-xl text-center"
      style={{
        backgroundColor: hasItems ? '#f8f6f1' : 'rgba(239,68,68,0.04)',
        border: hasItems ? 'none' : '1px dashed #e5ddd0',
        minHeight: '80px',
      }}
    >
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-lg font-bold" style={{ color: hasItems ? '#1a3a1a' : '#c0b0a0' }}>{count}</span>
      <span className="text-xs leading-tight" style={{ color: '#2a2010' }}>{label}</span>
      {distance && <span className="text-xs mt-0.5" style={{ color: '#a0b0a0' }}>{distance}</span>}
    </div>
  );
}

/** Health comparison bar */
function HealthBar({ label, value, usAvg, maxVal }: { label: string; value: number; usAvg: number; maxVal: number }) {
  const isBetter = value < usAvg;
  const barColor = isBetter ? '#22c55e' : '#ef4444';
  const barWidth = Math.min((value / maxVal) * 100, 100);
  const avgPosition = Math.min((usAvg / maxVal) * 100, 100);

  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: '#1a3a1a' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: barColor }}>{value}%</span>
      </div>
      <div className="relative h-3 rounded-full overflow-visible" style={{ backgroundColor: '#f0ebe0' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: barColor }}
        />
        <div
          className="absolute top-0 h-full flex items-center"
          style={{ left: `${avgPosition}%` }}
        >
          <div className="h-5 w-0.5 -mt-1 rounded-full" style={{ backgroundColor: '#8a9a8a' }} />
        </div>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-xs" style={{ color: isBetter ? '#22c55e' : '#ef4444' }}>
          {isBetter ? 'Better than' : 'Above'} US avg ({usAvg}%)
        </span>
      </div>
    </div>
  );
}

/** Flood risk badge */
function FloodBadge({ flood }: { flood: FloodRiskData }) {
  const isHigh = flood.isHighRisk;
  const isMinimal = flood.floodZone === 'X';
  const color = isHigh ? '#ef4444' : isMinimal ? '#22c55e' : '#f59e0b';
  const bg = isHigh ? 'rgba(239,68,68,0.08)' : isMinimal ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.07)';
  const icon = isHigh ? '🌊' : isMinimal ? '✓' : '⚠';
  const label = isHigh ? 'High Risk' : isMinimal ? 'Minimal Risk' : 'Moderate Risk';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: bg }}>
      <div
        className="flex items-center justify-center h-10 w-10 rounded-full text-lg flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color }}>
          {label}
        </div>
        <div className="text-xs" style={{ color: '#2a2010' }}>
          FEMA Zone {flood.floodZone} · {flood.description}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function NeighborhoodIntelSection({ neighborhoodIntel }: NeighborhoodIntelSectionProps) {
  if (!neighborhoodIntel) return null;

  const { commute, transit, parks, food, health, flood } = neighborhoodIntel;
  const hasAnyData = commute || transit || parks || food || health || flood;
  if (!hasAnyData) return null;

  // Calculate section scores
  const transitSectionScore = getTransitScore(commute, transit);
  const nearbySectionScore = getNearbyScore(parks, food);
  const healthSectionScore = getHealthScore(health, flood);

  return (
    <div className="retro-card" style={{ overflow: 'hidden' }}>
      <div className="retro-card-header">
        <span className="retro-card-header-title">Daily life here</span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Getting Around */}
        {(commute || transit) && (
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #c4b59a' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🚶</span>
              <span className="text-base font-semibold" style={{ color: '#1a3a1a' }}>How People Get Around</span>
              <SectionScoreBadge score={transitSectionScore} />
            </div>
            {/* Context line */}
            <p className="text-xs mb-4" style={{ color: '#2a2010' }}>
              {commute ? getCommuteContext(commute) : transit ? getTransitContext(transit) : ''}
            </p>

            {commute && <CommuteBar commute={commute} />}
            {transit && <TransitBadges transit={transit} />}
            <div className="text-xs mt-3 pt-2 border-t" style={{ color: '#3d3020', borderColor: '#f0ebe0' }}>
              {commute ? 'Census ACS' : ''}{commute && transit ? ' · ' : ''}{transit ? 'OpenStreetMap' : ''}
            </div>
          </div>
        )}

        {/* What's Nearby */}
        {(parks || food) && (
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #c4b59a' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📍</span>
              <span className="text-base font-semibold" style={{ color: '#1a3a1a' }}>What's Nearby</span>
              <SectionScoreBadge score={nearbySectionScore} />
            </div>
            <p className="text-xs mb-4" style={{ color: '#2a2010' }}>
              {getNearbyContext(parks, food)}
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {parks && (
                <>
                  <AmenityCard
                    icon="🌳"
                    count={parks.parks}
                    label="Parks"
                    distance={parks.nearestParkMeters !== null ? `${parks.nearestParkMeters < 1000 ? `${parks.nearestParkMeters}m` : `${(parks.nearestParkMeters / 1000).toFixed(1)}km`}` : undefined}
                  />
                  <AmenityCard icon="🛝" count={parks.playgrounds} label="Playgrounds" />
                  <AmenityCard icon="🌿" count={parks.gardens} label="Gardens" />
                </>
              )}
              {food && (
                <>
                  <AmenityCard
                    icon="🛒"
                    count={food.supermarkets}
                    label="Supermarkets"
                    distance={food.nearestSupermarketMeters !== null ? `${food.nearestSupermarketMeters < 1000 ? `${food.nearestSupermarketMeters}m` : `${(food.nearestSupermarketMeters / 1000).toFixed(1)}km`}` : undefined}
                  />
                  <AmenityCard icon="🥬" count={food.groceryStores} label="Grocery" />
                </>
              )}
            </div>
            {food?.isFoodDesert && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}>
                <span className="text-sm">⚠️</span>
                <span className="text-xs font-medium" style={{ color: '#dc2626' }}>
                  Food desert  -  no supermarket within 800m walking distance
                </span>
              </div>
            )}
            <div className="text-xs mt-3 pt-2 border-t" style={{ color: '#3d3020', borderColor: '#f0ebe0' }}>
              OpenStreetMap · 1.2 km radius
            </div>
          </div>
        )}

        {/* Health & Environment */}
        {(health || flood) && (
          <div style={{ padding: '16px 18px' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">❤️</span>
              <span className="text-base font-semibold" style={{ color: '#1a3a1a' }}>Health & Environment</span>
              <SectionScoreBadge score={healthSectionScore} />
            </div>
            {health && (
              <p className="text-xs mb-4" style={{ color: '#2a2010' }}>
                {getHealthContext(health)}
              </p>
            )}

            {health && (
              <div className="mb-4">
                <div className="text-xs font-medium mb-3" style={{ color: '#2a2010' }}>
                  Community health vs US average
                  <span className="inline-block ml-2 h-3 w-0.5 rounded-full align-middle" style={{ backgroundColor: '#8a9a8a' }} />
                  <span className="text-xs ml-1" style={{ color: '#a0b0a0' }}>gray line = US avg</span>
                </div>
                {health.obesity !== null && (
                  <HealthBar label="Obesity" value={health.obesity} usAvg={32} maxVal={50} />
                )}
                {health.diabetes !== null && (
                  <HealthBar label="Diabetes" value={health.diabetes} usAvg={11} maxVal={25} />
                )}
                {health.physicalInactivity !== null && (
                  <HealthBar label="Physical inactivity" value={health.physicalInactivity} usAvg={26} maxVal={45} />
                )}
                {health.asthma !== null && (
                  <HealthBar label="Asthma" value={health.asthma} usAvg={10} maxVal={20} />
                )}
              </div>
            )}

            {flood && <FloodBadge flood={flood} />}

            <div className="text-xs mt-3 pt-2 border-t" style={{ color: '#3d3020', borderColor: '#f0ebe0' }}>
              {health ? 'CDC PLACES' : ''}{health && flood ? ' · ' : ''}{flood ? 'FEMA NFHL' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
