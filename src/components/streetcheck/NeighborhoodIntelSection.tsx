import type { NeighborhoodIntelligence, CommuteData, TransitAccessData, ParkAccessData, FoodAccessData, CDCHealthData, FloodRiskData } from '../../types';

interface NeighborhoodIntelSectionProps {
  neighborhoodIntel: NeighborhoodIntelligence | null;
}

// --- Insight generators ---

function getCommuteInsight(c: CommuteData): { text: string; tone: Tone } {
  const altPct = c.walkPct + c.bikePct + c.transitPct;
  if (altPct >= 30) return { text: `${Math.round(altPct)}% walk, bike, or take transit — car-optional`, tone: 'positive' };
  if (altPct >= 15) return { text: `${Math.round(altPct)}% use alternatives to driving`, tone: 'neutral' };
  return { text: `Most residents drive — ${Math.round(100 - c.wfhPct - altPct)}% commute by car`, tone: 'warning' };
}

function getTransitInsight(t: TransitAccessData): { text: string; tone: Tone } {
  if (t.railStations > 0) return { text: `Rail access plus ${t.busStops} bus stop${t.busStops !== 1 ? 's' : ''}`, tone: 'positive' };
  if (t.busStops >= 5) return { text: `${t.busStops} bus stops within walking distance`, tone: 'positive' };
  if (t.busStops >= 2) return { text: `Limited transit — ${t.busStops} bus stops nearby`, tone: 'neutral' };
  if (t.totalStops > 0) return { text: `Only ${t.totalStops} transit stop nearby`, tone: 'warning' };
  return { text: 'No transit stops within walking distance', tone: 'warning' };
}

function getParkInsight(p: ParkAccessData): { text: string; tone: Tone } {
  if (p.nearestParkMeters !== null && p.nearestParkMeters <= 300 && p.totalGreenSpaces >= 3)
    return { text: `${p.totalGreenSpaces} green spaces, nearest ${p.nearestParkMeters}m`, tone: 'positive' };
  if (p.totalGreenSpaces >= 2)
    return { text: `${p.totalGreenSpaces} green spaces nearby`, tone: 'neutral' };
  if (p.totalGreenSpaces === 1)
    return { text: `One green space found${p.nearestParkMeters ? ` (${p.nearestParkMeters}m)` : ''}`, tone: 'neutral' };
  return { text: 'No parks found within walking distance', tone: 'warning' };
}

function getFoodInsight(f: FoodAccessData): { text: string; tone: Tone } {
  if (f.isFoodDesert) return { text: 'Food desert — no supermarket within 800m', tone: 'warning' };
  if (f.supermarkets >= 2) return { text: `${f.supermarkets} supermarkets nearby`, tone: 'positive' };
  if (f.supermarkets === 1) return { text: '1 supermarket nearby', tone: 'neutral' };
  if (f.groceryStores > 0) return { text: `${f.groceryStores} grocery stores, no supermarket`, tone: 'neutral' };
  return { text: 'Limited food stores in area', tone: 'warning' };
}

function getHealthInsight(h: CDCHealthData): { text: string; tone: Tone } {
  let better = 0; let worse = 0;
  if (h.obesity !== null) { if (h.obesity < 32) better++; else worse++; }
  if (h.diabetes !== null) { if (h.diabetes < 11) better++; else worse++; }
  if (h.physicalInactivity !== null) { if (h.physicalInactivity < 26) better++; else worse++; }
  if (better > worse) return { text: `Healthier than average — ${better} of ${better + worse} beat US norms`, tone: 'positive' };
  if (better === worse) return { text: 'Community health near national average', tone: 'neutral' };
  return { text: `${worse} health indicators above US average`, tone: 'warning' };
}

function getFloodInsight(f: FloodRiskData): { text: string; tone: Tone } {
  if (f.isHighRisk) return { text: `High flood risk — Zone ${f.floodZone}`, tone: 'warning' };
  if (f.floodZone === 'X') return { text: 'Minimal flood risk', tone: 'positive' };
  return { text: `Moderate flood risk — Zone ${f.floodZone}`, tone: 'neutral' };
}

type Tone = 'positive' | 'neutral' | 'warning';

const TONE = {
  positive: { dot: '#22c55e', bg: 'rgba(34,197,94,0.08)', text: '#15803d' },
  neutral: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#92400e' },
  warning: { dot: '#ef4444', bg: 'rgba(239,68,68,0.08)', text: '#b91c1c' },
};

// ==========================================
// VISUAL INFOGRAPHIC COMPONENTS
// ==========================================

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
      {/* The stacked bar */}
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
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.filter(s => s.pct >= 1).map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs" style={{ color: '#4a5a4a' }}>
              <strong style={{ color: '#2a3a2a' }}>{Math.round(seg.pct)}%</strong> {seg.label}
            </span>
          </div>
        ))}
      </div>
      {commute.zeroCar > 0 && (
        <div className="text-xs mt-2" style={{ color: '#6a7a6a' }}>
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
      {transit.railStations > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
          <span className="text-base">🚇</span>
          <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>{transit.railStations}</span>
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

/** Amenity icon cards — visual count with emoji */
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
      <span className="text-lg font-bold" style={{ color: hasItems ? '#2a3a2a' : '#c0b0a0' }}>{count}</span>
      <span className="text-[0.65rem] leading-tight" style={{ color: '#8a9a8a' }}>{label}</span>
      {distance && <span className="text-[0.6rem] mt-0.5" style={{ color: '#a0b0a0' }}>{distance}</span>}
    </div>
  );
}

/** Health comparison bar — horizontal bar with marker for "this area" vs US avg */
function HealthBar({ label, value, usAvg, maxVal }: { label: string; value: number; usAvg: number; maxVal: number }) {
  const isBetter = value < usAvg;
  const barColor = isBetter ? '#22c55e' : '#ef4444';
  const barWidth = Math.min((value / maxVal) * 100, 100);
  const avgPosition = Math.min((usAvg / maxVal) * 100, 100);

  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: '#4a5a4a' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: barColor }}>{value}%</span>
      </div>
      <div className="relative h-3 rounded-full overflow-visible" style={{ backgroundColor: '#f0ebe0' }}>
        {/* Value bar */}
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: barColor }}
        />
        {/* US Average marker */}
        <div
          className="absolute top-0 h-full flex items-center"
          style={{ left: `${avgPosition}%` }}
        >
          <div className="h-5 w-0.5 -mt-1 rounded-full" style={{ backgroundColor: '#8a9a8a' }} />
        </div>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[0.6rem]" style={{ color: isBetter ? '#22c55e' : '#ef4444' }}>
          {isBetter ? 'Better than' : 'Above'} US avg ({usAvg}%)
        </span>
      </div>
    </div>
  );
}

/** Flood risk visual badge — large, color-coded, unmissable */
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
        <div className="text-xs" style={{ color: '#6a7a6a' }}>
          FEMA Zone {flood.floodZone} · {flood.description}
        </div>
      </div>
    </div>
  );
}

/** Insight pill — compact colored pill for quick-scan strip */
function InsightPill({ text, tone }: { text: string; tone: Tone }) {
  const c = TONE[tone];
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: c.dot }} />
      <span className="text-sm leading-relaxed" style={{ color: '#3a4a3a' }}>{text}</span>
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

  // Collect insights for the quick-scan strip
  const insights: { text: string; tone: Tone }[] = [];
  if (commute) insights.push(getCommuteInsight(commute));
  if (transit) insights.push(getTransitInsight(transit));
  if (parks) insights.push(getParkInsight(parks));
  if (food) insights.push(getFoodInsight(food));
  if (health) insights.push(getHealthInsight(health));
  if (flood) insights.push(getFloodInsight(flood));

  const positiveCount = insights.filter(i => i.tone === 'positive').length;
  const warningCount = insights.filter(i => i.tone === 'warning').length;

  return (
    <div className="w-full mt-8">
      <h2 className="text-2xl font-bold mb-1" style={{ color: '#2a3a2a' }}>
        Neighborhood Intelligence
      </h2>
      <p className="text-sm mb-5" style={{ color: '#8a9a8a' }}>
        {positiveCount > warningCount
          ? `${positiveCount} strengths identified — a well-served neighborhood`
          : positiveCount === warningCount
          ? 'A mixed picture — some strengths, some gaps'
          : `${warningCount} area${warningCount !== 1 ? 's' : ''} to be aware of`}
      </p>

      {/* Quick-scan insight strip */}
      <div className="rounded-xl border p-4 mb-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
        {insights.map((insight, i) => (
          <InsightPill key={i} text={insight.text} tone={insight.tone} />
        ))}
      </div>

      {/* Visual infographic cards */}
      <div className="space-y-4">

        {/* ── Getting Around ── */}
        {(commute || transit) && (
          <div className="rounded-xl border p-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🚶</span>
              <span className="text-base font-semibold" style={{ color: '#2a3a2a' }}>How People Get Around</span>
            </div>
            {commute && <CommuteBar commute={commute} />}
            {transit && <TransitBadges transit={transit} />}
            <div className="text-[0.65rem] mt-3 pt-2 border-t" style={{ color: '#b0bab0', borderColor: '#f0ebe0' }}>
              Census ACS · OpenStreetMap
            </div>
          </div>
        )}

        {/* ── What's Nearby ── */}
        {(parks || food) && (
          <div className="rounded-xl border p-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📍</span>
              <span className="text-base font-semibold" style={{ color: '#2a3a2a' }}>What's Nearby</span>
            </div>
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
                  Food desert — no supermarket within 800m walking distance
                </span>
              </div>
            )}
            <div className="text-[0.65rem] mt-3 pt-2 border-t" style={{ color: '#b0bab0', borderColor: '#f0ebe0' }}>
              OpenStreetMap · 1.2 km radius
            </div>
          </div>
        )}

        {/* ── Health & Environment ── */}
        {(health || flood) && (
          <div className="rounded-xl border p-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">❤️</span>
              <span className="text-base font-semibold" style={{ color: '#2a3a2a' }}>Health & Environment</span>
            </div>

            {health && (
              <div className="mb-4">
                <div className="text-xs font-medium mb-3" style={{ color: '#6a7a6a' }}>
                  Community health vs US average
                  <span className="inline-block ml-2 h-3 w-0.5 rounded-full align-middle" style={{ backgroundColor: '#8a9a8a' }} />
                  <span className="text-[0.6rem] ml-1" style={{ color: '#a0b0a0' }}>gray line = US avg</span>
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

            <div className="text-[0.65rem] mt-3 pt-2 border-t" style={{ color: '#b0bab0', borderColor: '#f0ebe0' }}>
              {health ? 'CDC PLACES' : ''}{health && flood ? ' · ' : ''}{flood ? 'FEMA NFHL' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
