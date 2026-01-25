import { COLORS } from '../../constants';
import type { WalkabilityMetrics } from '../../types';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
}

function CircularScore({ score, label }: { score: number; label: string }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getColor = () => {
    if (score >= 8) return COLORS.excellent;
    if (score >= 6) return COLORS.good;
    if (score >= 4) return COLORS.fair;
    if (score >= 2) return COLORS.poor;
    return COLORS.critical;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg width="160" height="160" className="transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={getColor()}
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold" style={{ color: getColor() }}>
            {score.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500">out of 10</div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold" style={{ color: getColor() }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function ScoreCard({ metrics }: ScoreCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Walkability Score
      </h2>
      <CircularScore score={metrics.overallScore} label={metrics.label} />
    </div>
  );
}
