/**
 * Metric Card Component
 * Clean, sharp walkability metric cards with progressive disclosure
 */

interface MetricCardProps {
  icon: string;
  headline: string;
  score: number;
  badge: 'excellent' | 'good' | 'moderate' | 'needs-improvement' | 'safety-concern';
  description: string;
  rawValue?: string;
  whyItMatters: string;
  example?: string;
  technicalMeasurement?: string;
  recommendedStandard?: string;
  dataSource?: string;
  additionalContext?: string;
  dataQuality?: {
    level: 'high' | 'medium' | 'low';
    explanation: string;
  };
  status?: 'pass' | 'fail';
  isLoading?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function MetricCard({
  icon,
  headline,
  score,
  badge,
  description,
  rawValue,
  whyItMatters,
  example,
  technicalMeasurement,
  recommendedStandard,
  dataSource,
  additionalContext,
  dataQuality,
  isLoading,
  isExpanded,
  onToggle,
}: MetricCardProps) {
  const badgeConfig = {
    'excellent': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Excellent' },
    'good': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Good' },
    'moderate': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Moderate' },
    'needs-improvement': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Needs Work' },
    'safety-concern': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Concern' },
  };

  const getScoreColor = () => {
    if (score >= 8) return 'bg-emerald-500';
    if (score >= 5) return 'bg-amber-500';
    if (score >= 3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreTrack = () => {
    if (score >= 8) return 'bg-emerald-100';
    if (score >= 5) return 'bg-amber-100';
    if (score >= 3) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const dataQualityConfig = {
    'high': { dot: 'bg-emerald-400', label: 'High confidence' },
    'medium': { dot: 'bg-amber-400', label: 'Medium confidence' },
    'low': { dot: 'bg-red-400', label: 'Low confidence' },
  };

  const b = badgeConfig[badge];

  if (isLoading) {
    return (
      <div className="rounded-xl border p-5 sm:p-6 flex flex-col" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <h3 className="text-sm font-semibold leading-tight" style={{ color: '#2a3a2a' }}>
            {dataSource?.split(' ')[0] || 'Satellite'} Data
          </h3>
        </div>

        {/* Loading shimmer */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c5c0b5' }} />
            <span className="text-sm font-medium" style={{ color: '#8a9a8a' }}>Loading satellite data...</span>
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
            <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'linear-gradient(90deg, #e0dbd0, #f0ebe0, #e0dbd0)' }} />
          </div>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: '#8a9a8a' }}>
          Fetching real-time data from {dataSource || 'satellite sources'}...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <h3 className="text-sm font-semibold leading-tight" style={{ color: '#2a3a2a' }}>
            {headline}
          </h3>
        </div>
        <span className={`${b.bg} ${b.text} ${b.border} border px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide flex-shrink-0`}>
          {b.label}
        </span>
      </div>

      {/* Score */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl font-bold tabular-nums" style={{ color: '#2a3a2a' }}>{score}</span>
          <span className="text-sm font-medium" style={{ color: '#8a9a8a' }}>/10</span>
        </div>
        <div className={`w-full rounded-full h-2 overflow-hidden ${getScoreTrack()}`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${getScoreColor()}`}
            style={{ width: `${(score / 10) * 100}%` }}
          />
        </div>
        {rawValue && (
          <p className="text-xs font-mono mt-1.5" style={{ color: '#8a9a8a' }}>
            {rawValue}
          </p>
        )}
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed mb-4" style={{ color: '#6b7280' }}>
        {description}
      </p>

      {/* Data quality indicator */}
      {dataQuality && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className={`w-2 h-2 rounded-full ${dataQualityConfig[dataQuality.level].dot}`} />
          <span className="text-xs font-medium" style={{ color: '#8a9a8a' }}>{dataQualityConfig[dataQuality.level].label}</span>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors mt-auto group"
        style={{ color: '#8a9a8a' }}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {isExpanded ? 'Show less' : 'Learn more'}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: '#f0ebe0' }}>
          {/* Why it matters - the only expanded detail most users need */}
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#faf8f5' }}>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#8a9a8a' }}>
              Why this matters
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: '#4a5a4a' }}>
              {whyItMatters}
            </p>
          </div>

          {example && (
            <div className="mt-3 pl-3.5 py-0.5" style={{ borderLeft: '2px solid #c5d5c5' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#8a9a8a' }}>Example</p>
              <p className="text-xs leading-relaxed italic" style={{ color: '#6b7280' }}>
                {example}
              </p>
            </div>
          )}

          {/* Technical details - collapsed behind simpler layout */}
          {(technicalMeasurement || recommendedStandard || dataSource) && (
            <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: '#f0ebe0' }}>
              {technicalMeasurement && (
                <p className="text-xs" style={{ color: '#8a9a8a' }}>
                  <span className="font-semibold">Measurement:</span> {technicalMeasurement}
                </p>
              )}
              {recommendedStandard && (
                <p className="text-xs" style={{ color: '#8a9a8a' }}>
                  <span className="font-semibold">Standard:</span> {recommendedStandard}
                </p>
              )}
              {dataSource && (
                <p className="text-xs" style={{ color: '#b0a8a0' }}>
                  Source: {dataSource}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
