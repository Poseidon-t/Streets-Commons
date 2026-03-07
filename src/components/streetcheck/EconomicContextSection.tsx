import type { DemographicData, OSMData } from '../../types';
import { analyzeLocalEconomy, type LocalEconomicProfile } from '../../utils/localEconomicAnalysis';
import { ANALYSIS_RADIUS } from '../../constants';

interface EconomicContextProps {
  osmData: OSMData | null;
  demographicData: DemographicData | null;
  demographicLoading: boolean;
}

const VITALITY_CONFIG = {
  thriving: { color: '#16a34a', label: 'Thriving', bg: 'rgba(34,197,94,0.08)' },
  active: { color: '#65a30d', label: 'Active', bg: 'rgba(101,163,13,0.08)' },
  moderate: { color: '#ca8a04', label: 'Moderate', bg: 'rgba(202,138,4,0.08)' },
  developing: { color: '#ea580c', label: 'Developing', bg: 'rgba(234,88,12,0.08)' },
  limited: { color: '#dc2626', label: 'Limited', bg: 'rgba(220,38,38,0.08)' },
} as const;

const CATEGORY_COLORS: Record<keyof LocalEconomicProfile['categories'], string> = {
  retail:     '#3b82f6',
  dining:     '#f97316',
  healthcare: '#ef4444',
  education:  '#8b5cf6',
  financial:  '#10b981',
  transit:    '#06b6d4',
  recreation: '#22c55e',
  services:   '#64748b',
};

const CATEGORY_LABELS: Record<keyof LocalEconomicProfile['categories'], { icon: string; label: string }> = {
  retail: { icon: '🛒', label: 'Retail & Shops' },
  dining: { icon: '🍽️', label: 'Dining & Cafes' },
  healthcare: { icon: '🏥', label: 'Healthcare' },
  education: { icon: '🎓', label: 'Education' },
  financial: { icon: '🏦', label: 'Financial' },
  transit: { icon: '🚉', label: 'Transit' },
  recreation: { icon: '🌳', label: 'Recreation' },
  services: { icon: '🏛️', label: 'Services' },
};

function CategoryBar({ category, count, maxCount }: { category: keyof LocalEconomicProfile['categories']; count: number; maxCount: number }) {
  const { icon, label } = CATEGORY_LABELS[category];
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 8 : 0) : 0;

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm w-5 text-center flex-shrink-0">{icon}</span>
      <span className="text-xs w-20 flex-shrink-0" style={{ color: count > 0 ? '#1a1208' : '#b0a8a0' }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${width}%`,
            backgroundColor: count > 0 ? CATEGORY_COLORS[category] : 'transparent',
          }}
        />
      </div>
      <span className="text-xs font-semibold w-6 text-right" style={{ color: count > 0 ? '#1a1208' : '#c5c0b5' }}>
        {count}
      </span>
    </div>
  );
}

function LocalEconomyView({ profile }: { profile: LocalEconomicProfile }) {
  const v = VITALITY_CONFIG[profile.vitality];
  const maxCount = Math.max(...Object.values(profile.categories));
  const radiusM = ANALYSIS_RADIUS;

  return (
    <div className="space-y-4">
      {/* Vitality badge + summary */}
      <div className="flex items-center gap-3">
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ color: v.color, backgroundColor: v.bg }}
        >
          {v.label}
        </span>
        <span className="text-xs" style={{ color: '#2a2010' }}>
          {profile.totalBusinesses} businesses within {radiusM}m
        </span>
      </div>

      {/* Category breakdown */}
      <div>
        {(Object.keys(profile.categories) as Array<keyof typeof profile.categories>).map(cat => (
          <CategoryBar
            key={cat}
            category={cat}
            count={profile.categories[cat]}
            maxCount={maxCount}
          />
        ))}
      </div>

      {/* Highlights & Gaps */}
      {(profile.highlights.length > 0 || profile.gaps.length > 0) && (
        <div className="pt-3 border-t space-y-2" style={{ borderColor: '#f0ebe0' }}>
          {profile.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs mt-0.5" style={{ color: '#16a34a' }}>+</span>
              <span className="text-xs" style={{ color: '#1a1208' }}>{h}</span>
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
    </div>
  );
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

function CensusContext({ data }: { data: DemographicData }) {
  if (data.type !== 'us') return null;

  return (
    <div className="pt-4 border-t" style={{ borderColor: '#f0ebe0' }}>
      <p className="text-xs font-medium mb-2" style={{ color: '#2a2010' }}>
        Census Tract Data
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: '#1a1208' }}>{formatCurrency(data.medianHouseholdIncome)}</div>
          <div className="text-xs" style={{ color: '#2a2010' }}>Median Income</div>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: '#1a1208' }}>{formatCurrency(data.medianHomeValue)}</div>
          <div className="text-xs" style={{ color: '#2a2010' }}>Home Value</div>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: '#1a1208' }}>{formatPercent(data.unemploymentRate)}</div>
          <div className="text-xs" style={{ color: '#2a2010' }}>Unemployment</div>
        </div>
      </div>
      <div className="text-xs font-semibold mt-2" style={{ color: '#3d3020' }}>
        {data.dataSource} ({data.year})
      </div>
    </div>
  );
}

export default function EconomicContextSection({ osmData, demographicData, demographicLoading }: EconomicContextProps) {
  if (!osmData) return null;

  const profile = analyzeLocalEconomy(osmData);

  // Don't show if there's basically nothing (very rural/undeveloped area)
  if (profile.totalBusinesses === 0 && profile.categories.recreation === 0 && profile.categories.transit === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      <h3 className="text-base font-bold" style={{ color: '#1a1208' }}>Local businesses</h3>

      <LocalEconomyView profile={profile} />

    </div>
  );
}
