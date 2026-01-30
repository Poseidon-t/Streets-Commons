/**
 * Score Hero Component
 * Large, joyful score display with animated circular progress
 * Inspired by joyful infographics - vibrant, expressive, engaging
 */

interface ScoreHeroProps {
  score: number;
  maxScore?: number;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  showEmoji?: boolean;
}

function getScoreColor(score: number): { bg: string; text: string; ring: string; gradient: string } {
  if (score >= 80) return {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    ring: 'stroke-emerald-500',
    gradient: 'from-emerald-400 to-emerald-600'
  };
  if (score >= 60) return {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'stroke-blue-500',
    gradient: 'from-blue-400 to-blue-600'
  };
  if (score >= 40) return {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    ring: 'stroke-amber-500',
    gradient: 'from-amber-400 to-amber-600'
  };
  if (score >= 20) return {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    ring: 'stroke-orange-500',
    gradient: 'from-orange-400 to-orange-600'
  };
  return {
    bg: 'bg-red-50',
    text: 'text-red-600',
    ring: 'stroke-red-500',
    gradient: 'from-red-400 to-red-600'
  };
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return '🌟';
  if (score >= 80) return '✨';
  if (score >= 70) return '👍';
  if (score >= 60) return '😊';
  if (score >= 50) return '🤔';
  if (score >= 40) return '😐';
  if (score >= 30) return '😕';
  if (score >= 20) return '⚠️';
  return '🚨';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 40) return 'Needs Work';
  if (score >= 30) return 'Poor';
  if (score >= 20) return 'Very Poor';
  return 'Critical';
}

export default function ScoreHero({
  score,
  maxScore = 100,
  label,
  sublabel,
  size = 'lg',
  showEmoji = true
}: ScoreHeroProps) {
  const colors = getScoreColor(score);
  const percentage = (score / maxScore) * 100;

  const sizes = {
    sm: { container: 'w-24 h-24', text: 'text-2xl', label: 'text-xs', radius: 40, stroke: 6 },
    md: { container: 'w-36 h-36', text: 'text-4xl', label: 'text-sm', radius: 60, stroke: 8 },
    lg: { container: 'w-48 h-48', text: 'text-6xl', label: 'text-base', radius: 80, stroke: 10 }
  };

  const s = sizes[size];
  const circumference = 2 * Math.PI * s.radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`${s.container} relative`}>
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${(s.radius + s.stroke) * 2} ${(s.radius + s.stroke) * 2}`}>
          <circle
            cx={s.radius + s.stroke}
            cy={s.radius + s.stroke}
            r={s.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.stroke}
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx={s.radius + s.stroke}
            cy={s.radius + s.stroke}
            r={s.radius}
            fill="none"
            strokeWidth={s.stroke}
            strokeLinecap="round"
            className={colors.ring}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: 'stroke-dashoffset 1s ease-out'
            }}
          />
        </svg>

        {/* Score display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${s.text} font-bold ${colors.text}`}>
            {Math.round(score)}
          </span>
          {showEmoji && (
            <span className="text-2xl mt-1">{getScoreEmoji(score)}</span>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="mt-4 text-center">
        <div className={`font-bold ${colors.text} ${s.label} uppercase tracking-wider`}>
          {getScoreLabel(score)}
        </div>
        <div className="text-gray-800 font-semibold mt-1">{label}</div>
        {sublabel && (
          <div className="text-gray-500 text-sm mt-1">{sublabel}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Mini score badge for inline use
 */
export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const colors = getScoreColor(score);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg}`}>
      <span className={`font-bold ${colors.text}`}>{Math.round(score)}</span>
      <span className="text-lg">{getScoreEmoji(score)}</span>
      {label && <span className="text-gray-600 text-sm">{label}</span>}
    </div>
  );
}

/**
 * Score comparison for before/after or location comparison
 */
export function ScoreComparison({
  current,
  potential,
  currentLabel = 'Current',
  potentialLabel = 'Potential'
}: {
  current: number;
  potential: number;
  currentLabel?: string;
  potentialLabel?: string;
}) {
  const improvement = potential - current;

  return (
    <div className="flex items-center justify-center gap-8">
      <div className="text-center">
        <ScoreHero score={current} label={currentLabel} size="md" />
      </div>

      <div className="flex flex-col items-center">
        <div className="text-4xl">→</div>
        <div className={`font-bold ${improvement > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
          {improvement > 0 ? '+' : ''}{improvement} pts
        </div>
      </div>

      <div className="text-center">
        <ScoreHero score={potential} label={potentialLabel} size="md" />
      </div>
    </div>
  );
}
