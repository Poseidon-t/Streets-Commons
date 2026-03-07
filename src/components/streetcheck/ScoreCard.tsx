import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';
import PlainLanguageSummary from './PlainLanguageSummary';
import WalkerInfographic from '../WalkerInfographic';
import { scoreColor100 as getScoreColor } from '../../utils/colors';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
  /** When true: no card border/bg/shadow — renders as embedded content on a parent background */
  embedded?: boolean;
  /** When true: hides ComponentBreakdown bars (they appear separately in Act 2) */
  compact?: boolean;
}

function getScoreTier(score: number): string {
  if (score >= 80) return 'Walkable';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Car-dependent';
  if (score >= 20) return 'Difficult';
  return 'Hostile';
}

function CircularScore({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  const displayScore = (score / 10).toFixed(1);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[140px] h-[140px] sm:w-[160px] sm:h-[160px]">
        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
          <circle cx="80" cy="80" r={radius} stroke="#e0dbd0" strokeWidth="12" fill="none" />
          <circle
            cx="80" cy="80" r={radius}
            stroke={color} strokeWidth="12" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold" style={{ color }}>{displayScore}</div>
          <div className="text-xs mt-[-2px]" style={{ color: '#8a9a8a' }}>out of 10</div>
          <div className="text-xs font-semibold mt-1" style={{ color }}>{getScoreTier(score)}</div>
        </div>
      </div>
    </div>
  );
}

function ComponentBreakdown({ compositeScore }: { compositeScore: WalkabilityScoreV2 }) {
  const components = [
    compositeScore.components.networkDesign,
    compositeScore.components.environmentalComfort,
    compositeScore.components.safety,
    compositeScore.components.densityContext,
  ].filter(c => c.score > 0);

  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a9a8a', letterSpacing: '0.08em' }}>
        Component Scores
      </div>
      {sorted.map(c => {
        const pct = Math.round(c.score);
        const color = getScoreColor(pct);
        return (
          <div key={c.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: '#4a5a4a' }}>{c.label}</span>
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
  );
}

export default function ScoreCard({ metrics, compositeScore, embedded, compact }: ScoreCardProps) {
  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);

  const content = (
    <>
      {/* Desktop: ring left, breakdown right. Mobile: stacked */}
      <div className="flex flex-col lg:flex-row lg:gap-8 lg:items-start">

        {/* Left — circular score */}
        <div className="flex flex-col items-center lg:w-[180px] flex-shrink-0">
          <CircularScore score={score} />
          {compositeScore && compositeScore.confidence < 55 && (
            <div className="mt-2 text-xs text-center" style={{ color: '#8a9a8a' }}>
              Building a complete picture...
            </div>
          )}
        </div>

        {/* Right — breakdown + verdict */}
        <div className="flex-1 mt-5 lg:mt-0 space-y-4">
          {!compact && compositeScore && <ComponentBreakdown compositeScore={compositeScore} />}
          <PlainLanguageSummary metrics={metrics} compositeScore={compositeScore} />
        </div>
      </div>

      {/* Walker infographic — full width, below both columns */}
      <WalkerInfographic score={score / 10} compact />

    </>
  );

  if (embedded) {
    return <div className="h-full flex flex-col justify-center">{content}</div>;
  }

  return (
    <div className="rounded-2xl shadow-sm p-5 sm:p-6 border flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}>
      <h2 className="text-lg font-bold mb-4 text-center" style={{ color: '#2a3a2a' }}>Walkability Score</h2>
      {content}
    </div>
  );
}
