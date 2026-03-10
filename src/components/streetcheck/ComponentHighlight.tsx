import type { WalkabilityScoreV2 } from '../../types';

interface ComponentHighlightProps {
  compositeScore: WalkabilityScoreV2 | null;
}

function retroColor(score: number): string {
  if (score >= 65) return '#1a7a28';
  if (score >= 42) return '#b87a00';
  return '#b8401a';
}

const LABELS: Record<string, string> = {
  'Network Design': 'Network Design',
  'Environmental Comfort': 'Env. Comfort',
  'Safety': 'Safety',
  'Density & Destinations': 'Density & Dest.',
};

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

export default function ComponentHighlight({ compositeScore }: ComponentHighlightProps) {
  if (!compositeScore) {
    return (
      <div className="retro-card">
        <div className="retro-card-header">
          <span className="retro-card-header-title">What drives this score</span>
        </div>
        <div style={{ padding: '16px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ marginBottom: i < 3 ? 16 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div className="animate-pulse" style={{ height: 12, width: [80, 72, 48, 88][i], background: '#d8d0c4' }} />
                <div className="animate-pulse" style={{ height: 12, width: 32, background: '#d8d0c4' }} />
              </div>
              <div className="animate-pulse" style={{ height: 16, background: '#e0d8cc' }} />
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
        <span className="retro-card-header-title">What drives this score</span>
      </div>

      <div style={{ padding: '16px' }}>
        {sorted.map((c, i) => {
          const color = retroColor(c.score);
          const displayScore = (c.score / 10).toFixed(1);
          const shortLabel = LABELS[c.label] ?? c.label;
          const isTop = c.score === topScore;
          const isBottom = c.score === bottomScore && c.score < 50 && sorted.length > 1;

          return (
            <div key={c.label} style={{ marginBottom: i < sorted.length - 1 ? 16 : 0 }}>
              {/* Label row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#1a3a1a' }}>
                    {shortLabel}
                  </span>
                  {isTop && <span className="retro-tag retro-tag-strength">Strength</span>}
                  {isBottom && <span className="retro-tag retro-tag-challenge">Challenge</span>}
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                  {displayScore}
                </span>
              </div>

              {/* Bar */}
              <div className="retro-comp-bar" style={{ height: 16 }}>
                <div className="retro-comp-fill" style={{ width: `${Math.max(c.score, 2)}%`, background: color }} />
              </div>

              {/* Explanation */}
              <div style={{ fontSize: 13, color: '#2a2010', lineHeight: 1.55, marginTop: 5 }}>
                {EXPLANATIONS[c.label]?.(c.score) ?? ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
