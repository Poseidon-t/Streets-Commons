import type { DemographicData, EconomicImpact } from '../../types';
import { calculateEconomicImpact } from '../../utils/economicImpact';

interface EconomicContextProps {
  demographicData: DemographicData | null;
  demographicLoading: boolean;
  walkabilityScore: number;
}

function formatCurrency(value: number | null, compact?: boolean): string {
  if (value === null) return '—';
  if (compact && value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{label}</span>
      </div>
      <div className="text-lg font-bold" style={{ color: '#2a3a2a' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}

function ImpactCard({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: '#d4edda', backgroundColor: 'rgba(34,197,94,0.05)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{label}</span>
      </div>
      <div className="text-lg font-bold" style={{ color: '#16a34a' }}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>{note}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg p-3 border" style={{ borderColor: '#e0dbd0' }}>
            <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
            <div className="h-5 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DemographicCards({ data }: { data: DemographicData }) {
  if (data.type === 'us') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon="💰" label="Median Income" value={formatCurrency(data.medianHouseholdIncome)} sub={`Census Tract ${data.tractFips}`} />
        <StatCard icon="🏠" label="Median Home Value" value={formatCurrency(data.medianHomeValue)} />
        <StatCard icon="📊" label="Unemployment" value={formatPercent(data.unemploymentRate)} sub={data.povertyRate !== null ? `${data.povertyRate}% poverty rate` : undefined} />
        <StatCard icon="👤" label="Median Age" value={data.medianAge !== null ? `${data.medianAge}` : '—'} />
        <StatCard icon="🎓" label="Bachelor's+" value={formatPercent(data.bachelorOrHigherPct)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard icon="💰" label="GDP per Capita" value={formatCurrency(data.gdpPerCapita)} sub={data.countryName} />
      <StatCard icon="📊" label="Unemployment" value={formatPercent(data.unemploymentRate)} />
      <StatCard icon="🏙️" label="Urban Population" value={formatPercent(data.urbanPopulationPct)} />
    </div>
  );
}

function EconomicImpactCards({ impact }: { impact: EconomicImpact }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {impact.propertyValuePremium !== null && (
        <ImpactCard
          icon="🏠"
          label="Property Value Premium"
          value={`+${formatCurrency(impact.propertyValuePremium, true)}`}
          note="Walkability premium estimate"
        />
      )}
      <ImpactCard
        icon="🛍️"
        label="Retail Uplift"
        value={`+${impact.retailUpliftPercent}%`}
        note="Potential foot traffic boost"
      />
      <ImpactCard
        icon="❤️"
        label="Healthcare Savings"
        value={`$${impact.healthcareSavingsPerPerson}/yr`}
        note="Per person, from active transport"
      />
      {impact.estimatedJobsPotential !== null && (
        <ImpactCard
          icon="👷"
          label="Jobs Potential"
          value={`${impact.estimatedJobsPotential}`}
          note="Jobs per $10M infrastructure"
        />
      )}
    </div>
  );
}

export default function EconomicContextSection({ demographicData, demographicLoading, walkabilityScore }: EconomicContextProps) {
  if (demographicLoading) {
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.5)' }}>
        <h3 className="text-base font-bold mb-3" style={{ color: '#2a3a2a' }}>Economic Context</h3>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!demographicData) return null;

  const impact = calculateEconomicImpact(demographicData, walkabilityScore);

  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.5)' }}>
      <h3 className="text-base font-bold" style={{ color: '#2a3a2a' }}>Economic Context</h3>

      <DemographicCards data={demographicData} />

      <div className="pt-3 border-t" style={{ borderColor: '#e0dbd0' }}>
        <p className="text-xs font-medium mb-3" style={{ color: '#6b7280' }}>
          Walkability Economic Impact
        </p>
        <EconomicImpactCards impact={impact} />
      </div>

      <div className="text-[10px] text-right" style={{ color: '#9ca3af' }}>
        {demographicData.dataSource} ({demographicData.year})
      </div>
    </div>
  );
}
