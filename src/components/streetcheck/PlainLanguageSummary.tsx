import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';

// Prose labels for compositeScore component labels (keys match ComponentScore.label)
const COMPONENT_PROSE: Record<string, string> = {
  'Network Design':         'street connectivity',
  'Environmental Comfort':  'the walking environment',
  'Safety':                 'pedestrian safety',
  'Density & Destinations': 'access to destinations',
  // fallback aliases in case labels change
  'Environment':            'the walking environment',
  'Accessibility':          'access to destinations',
  'Street Design':          'street design quality',
};

// Fallback for when compositeScore is unavailable (legacy 0-10 metrics)
const LEGACY_LABELS: Record<string, string> = {
  destinationAccess: 'access to daily needs',
  treeCanopy:        'shade and tree canopy',
  streetGrid:        'street connectivity',
  streetDesign:      'street design quality',
  commuteMode:       'walking and transit culture',
  transitAccess:     'transit access',
  terrain:           'terrain difficulty',
  speedEnvironment:  'traffic speed environment',
};

function getWorstLabels(
  metrics: WalkabilityMetrics,
  compositeScore: WalkabilityScoreV2 | null | undefined,
  count: number,
): string[] {
  if (compositeScore) {
    return [
      compositeScore.components.networkDesign,
      compositeScore.components.environmentalComfort,
      compositeScore.components.safety,
      compositeScore.components.densityContext,
    ]
      .filter(c => c.score > 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, count)
      .map(c => COMPONENT_PROSE[c.label] ?? c.label.toLowerCase());
  }

  return Object.entries(metrics)
    .filter(([k, v]) => typeof v === 'number' && k !== 'overallScore' && k !== 'label'
      && LEGACY_LABELS[k] && (v as number) > 0)
    .sort((a, b) => (a[1] as number) - (b[1] as number))
    .slice(0, count)
    .map(([k]) => LEGACY_LABELS[k]);
}

interface PlainLanguageSummaryProps {
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
  inline?: boolean;
}

export default function PlainLanguageSummary({ metrics, compositeScore, inline }: PlainLanguageSummaryProps) {
  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);
  const worst = getWorstLabels(metrics, compositeScore, 3);

  let summary: string;
  let tone: 'positive' | 'neutral' | 'warning' | 'danger';

  if (score >= 80) {
    summary = `This is a walkable neighborhood. Most daily needs are accessible on foot with good pedestrian infrastructure.`;
    tone = 'positive';
  } else if (score >= 60) {
    summary = `Walking is viable here, but ${worst[0] ?? 'some areas'} could be better. Some trips may still require a car.`;
    tone = 'neutral';
  } else if (score >= 40) {
    summary = `This area is car-dependent. ${capitalize(worst[0] ?? 'Infrastructure')} and ${worst[1] ?? 'safety'} make walking inconvenient or uncomfortable.`;
    tone = 'warning';
  } else if (score >= 20) {
    summary = `Walking is difficult here. ${capitalize(worst[0] ?? 'Poor infrastructure')}, ${worst[1] ?? 'limited destinations'}, and ${worst[2] ?? 'weak street connectivity'} put pedestrians at a serious disadvantage.`;
    tone = 'danger';
  } else {
    summary = `This street is hostile to pedestrians. Basic safety infrastructure is missing  -  immediate intervention is needed.`;
    tone = 'danger';
  }

  // Vibrant palette  -  matches green/amber/brick system
  const toneColors = {
    positive: { text: '#1a7a28', bg: 'rgba(26,122,40,0.06)' },
    neutral:  { text: '#b87a00', bg: 'rgba(184,122,0,0.06)' },
    warning:  { text: '#b8401a', bg: 'rgba(184,64,26,0.06)' },
    danger:   { text: '#b8401a', bg: 'rgba(184,64,26,0.08)' },
  };

  const colors = toneColors[tone];
  const tierLabel = score >= 80 ? 'Walkable' : score >= 60 ? 'Moderate' : score >= 40 ? 'Car-dependent' : score >= 20 ? 'Difficult' : 'Hostile';

  return (
    <div style={inline ? undefined : { marginTop: 16, paddingTop: 12, borderTop: '1px solid #c4b59a' }}>
      <div style={{ padding: '12px 14px', background: colors.bg, border: `2px solid ${colors.text}`, fontSize: 14, lineHeight: 1.65, color: '#2a2010' }}>
        <span style={{ color: colors.text, fontWeight: 800, letterSpacing: '0.04em' }}>
          {tierLabel}
        </span>
        {'  -  '}
        {summary}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
