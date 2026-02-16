import { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import type { Location } from '../types';

interface BudgetAnalysisProps {
  isPremium: boolean;
  location?: Location;
}

interface InvestmentInsight {
  category: string;
  priority: string;
  currentState?: string;
  relevant: boolean;
  recommendation?: string;
}

interface GuidanceSummary {
  overallAssessment: string;
  topPriorities: string[];
  idealBudgetAllocation: string;
  keyActions: string[];
}

interface Resource {
  name: string;
  description: string;
  type: string;
}

export default function BudgetAnalysis({ isPremium, location }: BudgetAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<InvestmentInsight[]>([]);
  const [summary, setSummary] = useState<GuidanceSummary | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const [isCached, setIsCached] = useState(false);

  // Try to load cached data when location changes
  useEffect(() => {
    setInsights([]);
    setSummary(null);
    setDisclaimer(null);
    setResources([]);
    setError(null);
    setHasAnalyzed(false);
    setIsCached(false);

    if (!location) return;

    try {
      const cacheKey = `safestreets_budget_${location.lat}_${location.lon}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { analysis, timestamp } = JSON.parse(cached);
        const ageMinutes = (Date.now() - timestamp) / 60000;
        if (ageMinutes < 30 && analysis) {
          setInsights(analysis.insights || []);
          setSummary(analysis.summary || null);
          setDisclaimer(analysis.disclaimer || null);
          setResources(analysis.resources || []);
          setHasAnalyzed(true);
          setIsCached(true);
        }
      }
    } catch { /* ignore cache errors */ }
  }, [location?.lat, location?.lon]);

  const analyzeBudget = async () => {
    if (!location) return;

    setIsAnalyzing(true);
    setError(null);
    setSummary(null);
    setInsights([]);
    setDisclaimer(null);
    setResources([]);
    setIsCached(false);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';

      const response = await fetch(`${apiUrl}/api/analyze-budget-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: location.city || location.displayName.split(',')[0],
          country: location.country || '',
          displayName: location.displayName,
          lat: location.lat,
          lon: location.lon,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.analysis) {
        setInsights(data.analysis.insights || []);
        setSummary(data.analysis.summary || null);
        setDisclaimer(data.analysis.disclaimer || null);
        setResources(data.analysis.resources || []);
        setHasAnalyzed(true);

        // Cache the result
        try {
          const cacheKey = `safestreets_budget_${location.lat}_${location.lon}`;
          sessionStorage.setItem(cacheKey, JSON.stringify({
            analysis: data.analysis,
            timestamp: Date.now(),
          }));
        } catch { /* quota exceeded */ }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Budget analysis error:', err);

      // Try to serve stale cache on failure
      try {
        const cacheKey = `safestreets_budget_${location.lat}_${location.lon}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { analysis } = JSON.parse(cached);
          if (analysis) {
            setInsights(analysis.insights || []);
            setSummary(analysis.summary || null);
            setDisclaimer(analysis.disclaimer || null);
            setResources(analysis.resources || []);
            setHasAnalyzed(true);
            setIsCached(true);
            setError('Could not refresh data. Showing previous results.');
            return;
          }
        }
      } catch { /* ignore */ }

      setError(err.message || 'Failed to generate guidance. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
        <div className="text-center">
          <div className="text-5xl mb-4">&#x1F513;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Walkability Investment Guide
          </h2>
          <p className="text-gray-600 mb-4">
            Get AI-powered recommendations for walkability infrastructure investments
          </p>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(224,120,80,0.06)', border: '2px solid rgba(224,120,80,0.2)' }}>
            <p className="text-sm font-semibold" style={{ color: '#e07850' }}>
              Advocacy Toolkit — $49 one-time payment
            </p>
            <p className="text-xs mt-1" style={{ color: '#8a9a8a' }}>
              Unlock budget analysis, AI letters, proposals, and more.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cityName = location?.city || location?.displayName?.split(',')[0] || 'this area';

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        📋 Walkability Investment Guide
      </h2>

      <p className="text-gray-600 mb-6">
        AI-powered recommendations for walkability infrastructure investments in <strong>{cityName}</strong>.
      </p>

      {/* Location Info */}
      {location && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600">📍</span>
            <span className="font-semibold text-gray-800">{location.displayName}</span>
          </div>
          <p className="text-sm text-gray-600">
            Get prioritized recommendations based on urban planning best practices and WHO walkability guidelines.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Analyze Button */}
      {!hasAnalyzed && (
        <button
          onClick={analyzeBudget}
          disabled={!location || isAnalyzing}
          className="w-full px-6 py-4 rounded-xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          style={{ backgroundColor: COLORS.primary }}
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating Investment Recommendations...
            </span>
          ) : (
            `Get Investment Guide for ${cityName}`
          )}
        </button>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xl font-bold text-gray-800">
              🎯 Priority Investment Areas
            </h3>
            {isCached && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Cached</span>
            )}
          </div>

          {insights.map((insight, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border-2 bg-white border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-800">{insight.category}</h4>
                    <span className={`text-xs font-semibold px-2 py-1 rounded border ${getPriorityColor(insight.priority)}`}>
                      {insight.priority?.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  {insight.currentState && (
                    <p className="text-sm text-gray-500 mb-2">
                      <span className="font-medium">Current state:</span> {insight.currentState}
                    </p>
                  )}
                </div>
              </div>
              {insight.recommendation && (
                <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                  <span className="font-semibold">💡 Recommendation:</span> {insight.recommendation}
                </p>
              )}
            </div>
          ))}

          {/* Summary */}
          {summary && (
            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl">
              <h4 className="font-bold text-gray-800 mb-3">📊 Summary & Key Actions</h4>

              {summary.overallAssessment && (
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Assessment:</strong> {summary.overallAssessment}
                </p>
              )}

              {summary.topPriorities && summary.topPriorities.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Top Priorities:</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.topPriorities.map((priority, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {idx + 1}. {priority}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.idealBudgetAllocation && (
                <p className="text-sm text-gray-700 mb-3">
                  <strong>WHO Recommended Allocation:</strong> {summary.idealBudgetAllocation} of infrastructure budget for walkability
                </p>
              )}

              {summary.keyActions && summary.keyActions.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Key Actions:</p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {summary.keyActions.map((action, idx) => (
                      <li key={idx}>✓ {action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Resources */}
          {resources && resources.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <h4 className="font-semibold text-gray-800 mb-2">📚 Helpful Resources</h4>
              <ul className="space-y-2">
                {resources.map((resource, idx) => (
                  <li key={idx} className="text-sm">
                    <span className="font-medium text-gray-700">{resource.name}</span>
                    <span className="text-gray-500"> - {resource.description}</span>
                    <span className="text-xs text-gray-400 ml-1">({resource.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-analyze Button */}
          <button
            onClick={analyzeBudget}
            disabled={isAnalyzing}
            className="w-full px-6 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
          >
            🔄 Regenerate Recommendations
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs text-amber-800">
          <strong>Note:</strong> {disclaimer || 'This is general guidance based on urban planning best practices, not actual budget data. Contact your local municipality for official budget information.'}
        </p>
      </div>
    </div>
  );
}
