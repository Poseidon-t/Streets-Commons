import type { DemographicData, WalkabilityMetrics, CrashData, WalkabilityScoreV2 } from '../../types';
import type { LocalEconomicProfile } from '../../utils/localEconomicAnalysis';

interface EquityContextProps {
  demographicData: DemographicData | null;
  metrics: WalkabilityMetrics;
  crashData: CrashData | null;
  compositeScore: WalkabilityScoreV2 | null;
  localEconomy: LocalEconomicProfile | null;
}

type ConcernLevel = 'high' | 'moderate' | 'low';

interface EquityInsight {
  icon: string;
  label: string;
  detail: string;
}

function computeEquityAnalysis(
  demographics: DemographicData | null,
  metrics: WalkabilityMetrics,
  crashData: CrashData | null,
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
  }

  // --- Safety Burden ---
  if (crashData) {
    const isLowIncome = demographics.type === 'us'
      ? (demographics.povertyRate !== null && demographics.povertyRate > 15)
      : (demographics.type === 'international' && demographics.gdpPerCapita !== null && demographics.gdpPerCapita < 10000);

    if (crashData.type === 'local' && crashData.totalFatalities > 0 && isLowIncome) {
      concernPoints += 2;
      insights.push({
        icon: '⚠️',
        label: 'Disproportionate safety burden',
        detail: `${crashData.totalFatalities} fatal crash${crashData.totalFatalities > 1 ? 'es' : ''} near a low-income area. Research shows pedestrian fatality rates are 2x higher in underinvested neighborhoods (Smart Growth America).`,
      });
    } else if (crashData.type === 'country' && crashData.deathRatePer100k > 15 && isLowIncome) {
      concernPoints += 1;
      insights.push({
        icon: '⚠️',
        label: 'Elevated road safety risk',
        detail: `${crashData.countryName}'s road death rate of ${crashData.deathRatePer100k.toFixed(1)}/100k is above the global average. Lower-income countries bear 90% of the world's road traffic deaths (WHO).`,
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

  if (insights.length === 0) return null;

  const level: ConcernLevel = concernPoints >= 4 ? 'high' : concernPoints >= 2 ? 'moderate' : 'low';

  const context = level === 'high'
    ? 'This area shows multiple markers of transportation inequity. Walkability investment here would disproportionately benefit vulnerable residents.'
    : level === 'moderate'
    ? 'Some equity concerns are present. Improving walkability here would benefit residents who depend most on pedestrian infrastructure.'
    : 'Mild equity indicators detected. Even modest improvements would benefit underserved community members.';

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
  crashData,
  compositeScore,
  localEconomy,
}: EquityContextProps) {
  const analysis = computeEquityAnalysis(demographicData, metrics, crashData, compositeScore, localEconomy);
  if (!analysis) return null;

  const config = LEVEL_CONFIG[analysis.level];

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold" style={{ color: '#2a3a2a' }}>Equity Context</h3>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ color: config.color, backgroundColor: config.bg }}
        >
          {config.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
        This analysis connects your walkability score with local demographic data to identify potential equity concerns. Low walkability in economically disadvantaged areas compounds transportation burdens on residents who can least afford alternatives.
      </p>

      <div className="space-y-3">
        {analysis.insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: config.bg }}>
            <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{insight.label}</div>
              <div className="text-xs mt-0.5 leading-relaxed" style={{ color: '#4a5a4a' }}>{insight.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Why this matters */}
      <div className="pt-3 border-t" style={{ borderColor: '#f0ebe0' }}>
        <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
          <span className="font-semibold" style={{ color: '#4a5a4a' }}>Why this matters:</span>{' '}
          {analysis.context}
        </p>
        <p className="text-xs mt-2" style={{ color: '#b0a8a0' }}>
          Sources: US Census ACS, World Bank, Smart Growth America, WHO Global Status Report on Road Safety
        </p>
      </div>
    </div>
  );
}

export { computeEquityAnalysis, type EquityInsight, type ConcernLevel };
