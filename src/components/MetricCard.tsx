/**
 * Metric Card Component
 * Clean, sharp walkability metric cards with progressive disclosure
 */

import { useState } from 'react';

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
}: MetricCardProps) {
  const [showDetails, setShowDetails] = useState(false);

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
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">
            {dataSource?.split(' ')[0] || 'Satellite'} Data
          </h3>
        </div>

        {/* Loading shimmer */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400 font-medium">Loading satellite data...</span>
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>

        <p className="text-[13.5px] leading-relaxed text-gray-400 flex-grow">
          Fetching real-time data from {dataSource || 'satellite sources'}...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">
            {headline}
          </h3>
        </div>
        <span className={`${b.bg} ${b.text} ${b.border} border px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide flex-shrink-0`}>
          {b.label}
        </span>
      </div>

      {/* Score */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">{score}</span>
          <span className="text-sm font-medium text-gray-400">/10</span>
        </div>
        <div className={`w-full rounded-full h-2 overflow-hidden ${getScoreTrack()}`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${getScoreColor()}`}
            style={{ width: `${(score / 10) * 100}%` }}
          />
        </div>
        {/* Raw value */}
        {rawValue && (
          <p className="text-xs text-gray-500 font-mono mt-1.5">
            {rawValue}
          </p>
        )}
      </div>

      {/* Description */}
      <p className="text-[13.5px] leading-relaxed text-gray-600 mb-4 flex-grow">
        {description}
      </p>

      {/* Data quality indicator (inline) */}
      {dataQuality && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className={`w-2 h-2 rounded-full ${dataQualityConfig[dataQuality.level].dot}`} />
          <span className="text-xs text-gray-400 font-medium">{dataQualityConfig[dataQuality.level].label}</span>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors mt-auto group"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''} group-hover:text-gray-700`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {showDetails ? 'Show less' : 'Learn more'}
      </button>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          {/* Why it matters - highlighted */}
          <div className="bg-gray-50 rounded-lg p-3.5">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Why this matters
            </h4>
            <p className="text-[13px] leading-relaxed text-gray-700">
              {whyItMatters}
            </p>
          </div>

          {/* Example - callout style */}
          {example && (
            <div className="border-l-2 border-blue-300 pl-3.5 py-0.5">
              <p className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-1">Example</p>
              <p className="text-[13px] leading-relaxed text-gray-600 italic">
                {example}
              </p>
            </div>
          )}

          {/* Data quality */}
          {dataQuality && (
            <div className="border-l-2 border-gray-200 pl-3.5 py-0.5">
              <p className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Data quality
              </p>
              <p className="text-[13px] leading-relaxed text-gray-600">
                {dataQuality.explanation}
              </p>
            </div>
          )}

          {/* Technical details - compact */}
          {(technicalMeasurement || recommendedStandard) && (
            <div className="bg-gray-50 rounded-lg p-3.5 space-y-3">
              {technicalMeasurement && (
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-1">How we measure</p>
                  <p className="text-[13px] leading-relaxed text-gray-600">{technicalMeasurement}</p>
                </div>
              )}
              {recommendedStandard && (
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-1">Standard</p>
                  <p className="text-[13px] leading-relaxed text-gray-600">{recommendedStandard}</p>
                </div>
              )}
            </div>
          )}

          {/* Additional context */}
          {additionalContext && (
            <p className="text-[13px] leading-relaxed text-gray-500 italic">
              {additionalContext}
            </p>
          )}

          {/* Data source - minimal */}
          {dataSource && (
            <p className="text-[11px] text-gray-400 pt-1">
              Source: {dataSource}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
