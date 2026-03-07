import type { WalkabilityScoreV2 } from '../../types';

interface ComponentHighlightProps {
  compositeScore: WalkabilityScoreV2 | null;
}

// One-line contextual explanations by label + score tier
const EXPLANATIONS: Record<string, (score: number) => string> = {
  'Network Design': (s) =>
    s >= 65 ? 'Well-connected grid with frequent crossings and good footpath coverage'
    : s >= 42 ? 'Reasonable connectivity but some gaps in the pedestrian network'
    : 'Fragmented street network makes walking routes indirect or difficult',
  'Environmental Comfort': (s) =>
    s >= 65 ? 'Pleasant walking environment with shade, low noise, and good air quality'
    : s >= 42 ? 'Moderate comfort — some noise or limited shade on key routes'
    : 'High noise, limited tree canopy, or poor air quality reduces walking comfort',
  'Safety': (s) =>
    s >= 65 ? 'Low traffic speeds and good pedestrian infrastructure make walking safe'
    : s >= 42 ? 'Moderate safety — main arterials are more exposed to traffic'
    : 'High traffic speeds or missing crossings create hazards for pedestrians',
  'Density & Destinations': (s) =>
    s >= 65 ? 'Excellent access to daily needs and services within walking distance'
    : s >= 42 ? 'Good access to some destinations; transit coverage is moderate'
    : 'Limited destinations within walking distance; car often needed for errands',
};

function getExplanation(label: string, score: number): string {
  return EXPLANATIONS[label]?.(score) ?? 'No additional detail available';
}

function retroColor(score: number): string {
  if (score >= 65) return '#2a5224';
  if (score >= 42) return '#d4920c';
  return '#b8401a';
}

function retroFillClass(score: number): string {
  if (score >= 65) return 'retro-comp-fill';
  if (score >= 42) return 'retro-comp-fill retro-gauge-fill-amber';
  return 'retro-comp-fill retro-gauge-fill-red';
}

export default function ComponentHighlight({ compositeScore }: ComponentHighlightProps) {
  if (!compositeScore) {
    return (
      <div className="retro-card">
        <div className="retro-card-header">
          <span className="retro-card-header-title">Score Breakdown · Component Analysis</span>
        </div>
        <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[120, 56, 96, 140].map((w, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="animate-pulse" style={{ height: 11, width: w, background: '#d8d0c4' }} />
                <div className="animate-pulse" style={{ height: 11, width: 28, background: '#d8d0c4' }} />
              </div>
              <div className="animate-pulse" style={{ height: 14, background: '#d8d0c4' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { networkDesign, environmentalComfort, safety, densityContext } = compositeScore.components;
  const components = [networkDesign, environmentalComfort, safety, densityContext].filter(c => c.score > 0);
  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => b.score - a.score);
  const topScore = sorted[0].score;
  const bottomScore = sorted[sorted.length - 1].score;

  return (
    <div className="retro-card">
      <div className="retro-card-header">
        <span className="retro-card-header-title">Score Breakdown · Component Analysis</span>
      </div>
      <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sorted.map(c => {
          const pct = Math.round(c.score);
          const color = retroColor(pct);
          const isTop = c.score === topScore;
          const isBottom = c.score === bottomScore && c.score < 50 && sorted.length > 1;

          return (
            <div key={c.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#3d2f18' }}>
                    {c.label}
                  </span>
                  {isTop && <span className="retro-tag retro-tag-strength">Strength</span>}
                  {isBottom && <span className="retro-tag retro-tag-challenge">Challenge</span>}
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                  {(c.score / 10).toFixed(1)}
                </span>
              </div>
              <div className="retro-comp-bar" style={{ marginBottom: 6 }}>
                <div className={retroFillClass(pct)} style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
              </div>
              <div style={{ fontSize: 10, color: '#8a7a60', fontStyle: 'italic', lineHeight: 1.4 }}>
                {getExplanation(c.label, pct)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
