import type { DemographicData, WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';
import type { LocalEconomicProfile } from '../../utils/localEconomicAnalysis';

interface EquityContextProps {
  demographicData: DemographicData | null;
  metrics: WalkabilityMetrics;
  compositeScore: WalkabilityScoreV2 | null;
  localEconomy: LocalEconomicProfile | null;
}

type ConcernLevel = 'high' | 'moderate' | 'low';

interface EquityInsight {
  icon: string;
  label: string;
  detail: string;
}

interface DemographicStat {
  label: string;
  value: string;
  context?: string; // e.g. "below national average"
  contextColor?: string;
}

function buildDemographicStats(demographics: DemographicData): DemographicStat[] {
  const stats: DemographicStat[] = [];

  if (demographics.type === 'us') {
    if (demographics.medianHouseholdIncome !== null) {
      const income = demographics.medianHouseholdIncome;
      stats.push({
        label: 'Median Income',
        value: `$${income.toLocaleString()}`,
        context: income < 40000 ? 'Below national median ($75k)' : income < 75000 ? 'Below national median ($75k)' : undefined,
        contextColor: income < 40000 ? '#dc2626' : income < 75000 ? '#ca8a04' : undefined,
      });
    }
    if (demographics.povertyRate !== null) {
      const rate = demographics.povertyRate;
      stats.push({
        label: 'Poverty Rate',
        value: `${rate.toFixed(1)}%`,
        context: rate > 20 ? 'High — national avg is 12.4%' : rate > 15 ? 'Above national avg (12.4%)' : undefined,
        contextColor: rate > 20 ? '#dc2626' : rate > 15 ? '#ca8a04' : undefined,
      });
    }
    if (demographics.unemploymentRate !== null) {
      const rate = demographics.unemploymentRate;
      stats.push({
        label: 'Unemployment',
        value: `${rate.toFixed(1)}%`,
        context: rate > 8 ? 'Above national avg' : undefined,
        contextColor: rate > 8 ? '#ca8a04' : undefined,
      });
    }
    if (demographics.medianHomeValue !== null) {
      stats.push({
        label: 'Median Home Value',
        value: `$${demographics.medianHomeValue.toLocaleString()}`,
      });
    }
    if (demographics.medianAge !== null) {
      stats.push({
        label: 'Median Age',
        value: `${demographics.medianAge.toFixed(0)}`,
      });
    }
    if (demographics.bachelorOrHigherPct !== null) {
      stats.push({
        label: 'College Educated',
        value: `${demographics.bachelorOrHigherPct.toFixed(0)}%`,
      });
    }
  } else if (demographics.type === 'international') {
    if (demographics.gdpPerCapita !== null) {
      const gdp = demographics.gdpPerCapita;
      stats.push({
        label: 'GDP per Capita',
        value: `$${gdp.toLocaleString()}`,
        context: gdp < 5000 ? 'Low-income country' : gdp < 15000 ? 'Middle-income country' : 'Upper-income country',
        contextColor: gdp < 5000 ? '#dc2626' : gdp < 15000 ? '#ca8a04' : '#65a30d',
      });
    }
    if (demographics.unemploymentRate !== null) {
      const rate = demographics.unemploymentRate;
      stats.push({
        label: 'Unemployment',
        value: `${rate.toFixed(1)}%`,
        context: rate > 10 ? 'Above global avg' : undefined,
        contextColor: rate > 10 ? '#ca8a04' : undefined,
      });
    }
    if (demographics.urbanPopulationPct !== null) {
      stats.push({
        label: 'Urban Population',
        value: `${demographics.urbanPopulationPct.toFixed(0)}%`,
      });
    }
  }

  return stats;
}

function computeEquityAnalysis(
  demographics: DemographicData | null,
  metrics: WalkabilityMetrics,
  compositeScore: WalkabilityScoreV2 | null,
  localEconomy: LocalEconomicProfile | null,
): { level: ConcernLevel; insights: EquityInsight[]; context: string } | null {
  if (!demographics) return null;

  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);
  const insights: EquityInsight[] = [];
  let concernPoints = 0;

  // --- Investment Gap ---
  if (demographics.type === 'us') {
    const { povertyRate, medianHouseholdIncome } = demographics;
    const isHighPoverty = povertyRate !== null && povertyRate > 15;
    const isLowIncome = medianHouseholdIncome !== null && medianHouseholdIncome < 40000;

    if (score < 50 && (isHighPoverty || isLowIncome)) {
      concernPoints += 2;
      insights.push({
        icon: '🏚️',
        label: 'Underinvested neighborhood',
        detail: `Walkability score of ${(score / 10).toFixed(1)}/10 in a tract with ${isHighPoverty ? `${povertyRate!.toFixed(1)}% poverty rate` : `$${medianHouseholdIncome!.toLocaleString()} median income`}. Low-income communities disproportionately bear the cost of car-dependent infrastructure.`,
      });
    } else if (score < 50 && isHighPoverty) {
      concernPoints += 1;
    }

    // Transportation cost burden
    if (isLowIncome && metrics.destinationAccess < 5) {
      concernPoints += 1;
      insights.push({
        icon: '💸',
        label: 'Transportation cost burden',
        detail: `Low access to daily needs (${metrics.destinationAccess.toFixed(1)}/10) in a low-income area. Residents likely spend 25-30% of income on transportation vs. the 15% national average.`,
      });
    }

    // High unemployment compounds walkability gap
    if (demographics.unemploymentRate !== null && demographics.unemploymentRate > 10 && score < 60) {
      concernPoints += 1;
      insights.push({
        icon: '📉',
        label: 'Economic vulnerability',
        detail: `${demographics.unemploymentRate.toFixed(1)}% unemployment paired with limited walkability. Job access depends heavily on transportation — poor pedestrian infrastructure limits economic opportunity.`,
      });
    }
  } else if (demographics.type === 'international') {
    const { gdpPerCapita } = demographics;
    if (score < 50 && gdpPerCapita !== null && gdpPerCapita < 5000) {
      concernPoints += 2;
      insights.push({
        icon: '🏚️',
        label: 'Infrastructure gap',
        detail: `Walkability score of ${(score / 10).toFixed(1)}/10 in a country with $${gdpPerCapita.toLocaleString()} GDP per capita. Walking is not a lifestyle choice here — it is a necessity, and the infrastructure doesn't support it.`,
      });
    }

    // Urbanization pressure
    if (demographics.urbanPopulationPct !== null && demographics.urbanPopulationPct > 70 && score < 50) {
      concernPoints += 1;
      insights.push({
        icon: '🏙️',
        label: 'Urbanization pressure',
        detail: `${demographics.urbanPopulationPct.toFixed(0)}% urban population means high pedestrian demand, but infrastructure scores suggest streets aren't keeping pace with urbanization.`,
      });
    }
  }

  // --- Service Desert ---
  if (localEconomy && localEconomy.gaps.length > 0) {
    const isDisadvantaged = demographics.type === 'us'
      ? (demographics.povertyRate !== null && demographics.povertyRate > 15)
      : (demographics.type === 'international' && demographics.gdpPerCapita !== null && demographics.gdpPerCapita < 5000);

    if (isDisadvantaged) {
      const criticalGaps = localEconomy.gaps.filter(g =>
        g.toLowerCase().includes('healthcare') || g.toLowerCase().includes('grocery') || g.toLowerCase().includes('transit')
      );
      if (criticalGaps.length > 0) {
        concernPoints += 1;
        insights.push({
          icon: '🏜️',
          label: 'Service desert',
          detail: criticalGaps[0] + ' — in a community that depends on walking for daily access.',
        });
      }
    }
  }

  const level: ConcernLevel = concernPoints >= 4 ? 'high' : concernPoints >= 2 ? 'moderate' : 'low';

  const context = level === 'high'
    ? 'This area shows multiple markers of transportation inequity. Walkability investment here would disproportionately benefit vulnerable residents.'
    : level === 'moderate'
    ? 'Some equity concerns are present. Improving walkability here would benefit residents who depend most on pedestrian infrastructure.'
    : 'Walkability improvements in this area would benefit the broader community. The data below provides context for local conditions.';

  return { level, insights, context };
}

const LEVEL_CONFIG = {
  high: { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', label: 'High Concern', border: 'rgba(220,38,38,0.15)' },
  moderate: { color: '#ca8a04', bg: 'rgba(202,138,4,0.06)', label: 'Moderate Concern', border: 'rgba(202,138,4,0.15)' },
  low: { color: '#65a30d', bg: 'rgba(101,163,13,0.06)', label: 'Low Concern', border: 'rgba(101,163,13,0.15)' },
} as const;

export default function EquityContextSection({
  demographicData,
  metrics,
  compositeScore,
  localEconomy,
}: EquityContextProps) {
  if (!demographicData) return null;

  const analysis = computeEquityAnalysis(demographicData, metrics, compositeScore, localEconomy);
  const stats = buildDemographicStats(demographicData);
  const config = analysis ? LEVEL_CONFIG[analysis.level] : LEVEL_CONFIG.low;

  const sourceLabel = demographicData.type === 'us'
    ? `US Census ACS ${demographicData.year}, Tract ${demographicData.tractFips}`
    : `World Bank ${demographicData.year}, ${demographicData.countryName}`;

  return (
    <div className="retro-card" style={{ overflow: 'hidden' }}>
      <div className="retro-card-header">
        <span className="retro-card-header-title">Equity & Access</span>
        {analysis && (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ color: config.color, backgroundColor: config.bg }}
          >
            {config.label}
          </span>
        )}
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Demographic Data Snapshot */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} style={{ padding: 10, background: '#f8f6f1', border: '1px solid #c4b59a' }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#2a2010', marginBottom: 2 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a3a1a' }}>
                  {stat.value}
                </div>
                {stat.context && (
                  <div style={{ fontSize: 12, marginTop: 2, color: stat.contextColor || '#3d3020' }}>
                    {stat.context}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Equity Insights */}
        {analysis && analysis.insights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysis.insights.map((insight, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: config.bg, border: `1px solid ${config.border}` }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{insight.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a3a1a' }}>{insight.label}</div>
                  <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5, color: '#1a3a1a' }}>{insight.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Context + Sources */}
        <div style={{ paddingTop: 10, borderTop: '1px solid #c4b59a' }}>
          {analysis && (
            <p style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 6, color: '#2a2010' }}>
              <span style={{ fontWeight: 700, color: '#1a3a1a' }}>Why this matters:</span>{' '}
              {analysis.context}
            </p>
          )}
          <p style={{ fontSize: 12, fontWeight: 600, color: '#3d3020' }}>
            {sourceLabel} · Smart Growth America
          </p>
        </div>
      </div>
    </div>
  );
}

export { computeEquityAnalysis, type EquityInsight, type ConcernLevel };
