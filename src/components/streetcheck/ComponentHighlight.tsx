import type { WalkabilityScoreV2 } from '../../types';
import { scoreColor } from '../../utils/personas';

interface ComponentHighlightProps {
  compositeScore: WalkabilityScoreV2 | null;
}

function ComponentHighlightSkeleton() {
  return (
    <div
      className="rounded-2xl border"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: '#f0ebe0' }}>
        <div className="h-4 w-28 rounded animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
      </div>
      <div className="px-5 py-4 space-y-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="h-3 rounded animate-pulse" style={{ width: [120, 96, 56, 140][i], backgroundColor: '#e8e3d8' }} />
              <div className="h-3 w-8 rounded animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
            </div>
            <div className="h-2 rounded-full animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComponentHighlight({ compositeScore }: ComponentHighlightProps) {
  if (!compositeScore) return <ComponentHighlightSkeleton />;

  const { networkDesign, environmentalComfort, safety, densityContext } = compositeScore.components;
  const components = [
    networkDesign,
    environmentalComfort,
    safety,
    densityContext,
  ].filter(c => c.score > 0);

  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => b.score - a.score);
  const topScore = sorted[0].score;
  const bottomScore = sorted[sorted.length - 1].score;

  return (
    <div
      className="rounded-2xl border"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: '#f0ebe0' }}>
        <h3 className="text-sm font-bold" style={{ color: '#2a3a2a' }}>Why this score</h3>
      </div>
      <div className="px-5 py-4 space-y-4">
        {sorted.map(c => {
          const pct = Math.round(c.score);
          const color = scoreColor(pct);
          const isTop = c.score === topScore;
          const isBottom = c.score === bottomScore && c.score < 50 && sorted.length > 1;

          return (
            <div key={c.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: '#4a5a4a' }}>{c.label}</span>
                  {isTop && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.10)', color: '#15803d' }}>
                      Strength
                    </span>
                  )}
                  {isBottom && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#991b1b' }}>
                      Challenge
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color }}>{(c.score / 10).toFixed(1)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e3d8' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
