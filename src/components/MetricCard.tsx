/**
 * User-Friendly Metric Card Component
 * Shows walkability metrics in plain language with progressive disclosure
 */

import { useState } from 'react';

interface MetricCardProps {
  // Display
  icon: string;
  headline: string;
  score: number; // 1-10 scale
  badge: 'excellent' | 'good' | 'moderate' | 'needs-improvement' | 'safety-concern';

  // User-facing content
  description: string;
  whyItMatters: string;
  example?: string;

  // Progressive disclosure (technical details)
  technicalMeasurement?: string;
  recommendedStandard?: string;
  dataSource?: string;
  additionalContext?: string;

  // Data quality
  dataQuality?: {
    level: 'high' | 'medium' | 'low';
    explanation: string;
  };

  // Visual
  status?: 'pass' | 'fail';
}

export default function MetricCard({
  icon,
  headline,
  score,
  badge,
  description,
  whyItMatters,
  example,
  technicalMeasurement,
  recommendedStandard,
  dataSource,
  additionalContext,
  dataQuality,
  status
}: MetricCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Badge styling
  const badgeConfig = {
    'excellent': { color: 'bg-green-100 text-green-800 border-green-200', label: 'EXCELLENT' },
    'good': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'GOOD' },
    'moderate': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'MODERATE' },
    'needs-improvement': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'NEEDS IMPROVEMENT' },
    'safety-concern': { color: 'bg-red-100 text-red-800 border-red-200', label: 'SAFETY CONCERN' }
  };

  // Score bar color
  const getScoreColor = () => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 5) return 'bg-yellow-500';
    if (score >= 3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Data quality badge styling
  const dataQualityConfig = {
    'high': { icon: '🟢', color: 'bg-green-50 text-green-700 border-green-200', label: 'High Confidence' },
    'medium': { icon: '🟡', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium Confidence' },
    'low': { icon: '🔴', color: 'bg-red-50 text-red-700 border-red-200', label: 'Low Confidence' }
  };

  // Legacy status badge (for backwards compatibility)
  const statusBadge = status === 'pass'
    ? { color: 'bg-green-50 text-green-700 border-green-200', label: 'PASS' }
    : status === 'fail'
    ? { color: 'bg-red-50 text-red-700 border-red-200', label: 'FAIL' }
    : null;

  return (
    <div className="rounded-lg border hover:shadow-lg transition-all p-4 sm:p-5 md:p-6 flex flex-col h-full" style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderColor: '#e0dbd0' }}>
      {/* Header with Icon and Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-base font-bold leading-snug" style={{ color: '#2a3a2a' }}>
            {headline}
          </h3>
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${badgeConfig[badge].color}`}>
            {badgeConfig[badge].label}
          </span>
          {dataQuality && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wide border ${dataQualityConfig[dataQuality.level].color} flex items-center gap-1`}
              title={dataQuality.explanation}
            >
              <span className="text-[10px]">{dataQualityConfig[dataQuality.level].icon}</span>
              {dataQualityConfig[dataQuality.level].label}
            </span>
          )}
        </div>
      </div>

      {/* Score - Big and Bold */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-3xl font-bold" style={{ color: '#2a3a2a' }}>
            {score}
          </span>
          <span className="text-base font-medium" style={{ color: '#8a9a8a' }}>/10</span>
        </div>
        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: '#e0dbd0' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${getScoreColor()}`}
            style={{ width: `${(score / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Plain Language Description */}
      <p className="text-sm leading-relaxed mb-4 flex-grow" style={{ color: '#5a6a5a' }}>
        {description}
      </p>

      {/* Progressive Disclosure Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 text-sm font-medium transition-colors mt-auto"
        style={{ color: '#6a7a6a' }}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {showDetails ? 'Less details' : 'More details'}
      </button>

      {/* Details (Progressive Disclosure) */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: '#e0dbd0' }}>
          {/* Why It Matters */}
          <div>
            <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-1.5" style={{ color: '#2a3a2a' }}>
              <span>💡</span>
              Why this matters
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: '#5a6a5a' }}>
              {whyItMatters}
            </p>
          </div>

          {/* Example */}
          {example && (
            <div>
              <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-1.5" style={{ color: '#2a3a2a' }}>
                <span>📍</span>
                Example
              </h4>
              <p className="text-sm leading-relaxed italic" style={{ color: '#5a6a5a' }}>
                {example}
              </p>
            </div>
          )}

          {dataQuality && (
            <div>
              <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-1.5" style={{ color: '#2a3a2a' }}>
                {dataQualityConfig[dataQuality.level].icon}
                Data quality: {dataQualityConfig[dataQuality.level].label}
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: '#5a6a5a' }}>{dataQuality.explanation}</p>
            </div>
          )}

          {technicalMeasurement && (
            <div>
              <h4 className="font-semibold text-sm mb-1.5" style={{ color: '#2a3a2a' }}>Technical measurement</h4>
              <p className="text-sm leading-relaxed" style={{ color: '#5a6a5a' }}>{technicalMeasurement}</p>
            </div>
          )}

          {recommendedStandard && (
            <div>
              <h4 className="font-semibold text-sm mb-1.5" style={{ color: '#2a3a2a' }}>Recommended standard</h4>
              <p className="text-sm leading-relaxed" style={{ color: '#5a6a5a' }}>{recommendedStandard}</p>
            </div>
          )}

          {additionalContext && (
            <div>
              <h4 className="font-semibold text-sm mb-1.5" style={{ color: '#2a3a2a' }}>Additional context</h4>
              <p className="text-sm leading-relaxed" style={{ color: '#5a6a5a' }}>{additionalContext}</p>
            </div>
          )}

          {dataSource && (
            <div>
              <h4 className="font-semibold text-sm mb-1.5" style={{ color: '#2a3a2a' }}>Data sources</h4>
              <p className="text-xs leading-relaxed" style={{ color: '#8a9a8a' }}>{dataSource}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
