import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';

const METRIC_LABELS: Record<string, string> = {
  crossingSafety: 'crossing safety',
  sidewalkCoverage: 'sidewalk coverage',
  speedExposure: 'traffic speed protection',
  destinationAccess: 'access to daily needs',
  nightSafety: 'street lighting',
  slope: 'terrain accessibility',
  treeCanopy: 'shade and tree canopy',
  thermalComfort: 'thermal comfort',
};

function getWorstMetrics(metrics: WalkabilityMetrics, count: number): string[] {
  const entries = Object.entries(metrics)
    .filter(([k, v]) => typeof v === 'number' && k !== 'overallScore' && METRIC_LABELS[k])
    .sort((a, b) => (a[1] as number) - (b[1] as number))
    .slice(0, count);
  return entries.map(([k]) => METRIC_LABELS[k]);
}

interface PlainLanguageSummaryProps {
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
}

export default function PlainLanguageSummary({ metrics, compositeScore }: PlainLanguageSummaryProps) {
  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);
  const worst = getWorstMetrics(metrics, 3);

  let summary: string;
  let tone: 'positive' | 'neutral' | 'warning' | 'danger';

  if (score >= 80) {
    summary = `This is a walkable neighborhood. Most daily needs are accessible on foot with good pedestrian infrastructure.`;
    tone = 'positive';
  } else if (score >= 60) {
    summary = `Walking is viable here, but ${worst[0] || 'some areas'} could be better. Some trips may still require a car.`;
    tone = 'neutral';
  } else if (score >= 40) {
    summary = `This area is car-dependent. ${capitalize(worst[0] || 'Infrastructure')} and ${worst[1] || 'safety'} make walking inconvenient or uncomfortable.`;
    tone = 'warning';
  } else if (score >= 20) {
    summary = `Walking is difficult and risky here. ${capitalize(worst[0] || 'Safety')}, ${worst[1] || 'infrastructure'}, and ${worst[2] || 'comfort'} put pedestrians at serious disadvantage.`;
    tone = 'danger';
  } else {
    summary = `This street is hostile to pedestrians. Basic safety infrastructure is missing — immediate intervention is needed.`;
    tone = 'danger';
  }

  const toneColors = {
    positive: { text: '#16a34a', bg: 'rgba(34,197,94,0.06)' },
    neutral: { text: '#65a30d', bg: 'rgba(101,163,13,0.06)' },
    warning: { text: '#ca8a04', bg: 'rgba(202,138,4,0.06)' },
    danger: { text: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
  };

  const colors = toneColors[tone];

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: '#e0dbd0' }}>
      <div className="px-3 py-2.5 rounded-lg text-sm leading-relaxed" style={{ backgroundColor: colors.bg, color: '#4a5a4a' }}>
        <span style={{ color: colors.text, fontWeight: 600 }}>
          {score >= 80 ? 'Walkable' : score >= 60 ? 'Moderate' : score >= 40 ? 'Car-dependent' : score >= 20 ? 'Difficult' : 'Hostile'}
        </span>
        {' — '}
        {summary}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
