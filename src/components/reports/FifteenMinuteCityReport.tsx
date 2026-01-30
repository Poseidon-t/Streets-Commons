/**
 * 15-Minute City Score Report
 * Crisp, single-page snapshot design
 * Visual-first with key insights
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FifteenMinuteCityScore } from '../../services/fifteenMinuteCity';
import { PrintStyles } from './shared';

interface ReportData {
  score: FifteenMinuteCityScore;
  location: {
    displayName: string;
    lat: number;
    lon: number;
  };
}

const serviceInfo: Record<string, { icon: string; name: string }> = {
  grocery: { icon: '🛒', name: 'Grocery' },
  healthcare: { icon: '🏥', name: 'Healthcare' },
  education: { icon: '📚', name: 'Education' },
  recreation: { icon: '🌳', name: 'Parks' },
  transit: { icon: '🚌', name: 'Transit' },
  dining: { icon: '🍽️', name: 'Dining' }
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'bg-blue-50 border-blue-200';
  if (score >= 40) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getGrade(score: number): { letter: string; label: string } {
  if (score >= 90) return { letter: 'A+', label: 'Exceptional' };
  if (score >= 80) return { letter: 'A', label: 'Excellent' };
  if (score >= 70) return { letter: 'B', label: 'Good' };
  if (score >= 60) return { letter: 'C', label: 'Fair' };
  if (score >= 50) return { letter: 'D', label: 'Needs Work' };
  return { letter: 'F', label: 'Poor' };
}

function getWalkTime(meters: number): string {
  if (meters < 0) return '—';
  const minutes = Math.round(meters / 80);
  return minutes < 1 ? '<1m' : `${minutes}m`;
}

export default function FifteenMinuteCityReport() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('fifteenMinuteCityReport');
    if (stored) setData(JSON.parse(stored));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🏘️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Report Data</h1>
          <p className="text-gray-600 mb-4">Generate a report from the analysis page first.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
            Go to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { score, location } = data;
  const grade = getGrade(score.overallScore);
  const availableServices = Object.values(score.serviceScores).filter(s => s.available).length;
  const totalServices = Object.keys(score.serviceScores).length;

  // Find best and worst services
  const sortedServices = Object.entries(score.serviceScores)
    .map(([key, s]) => ({ key, ...s }))
    .sort((a, b) => b.score - a.score);

  const bestService = sortedServices[0];
  const worstService = sortedServices[sortedServices.length - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <PrintStyles />

      {/* Action Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 no-print">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white shadow-sm">
          ← Back
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg">
          Save PDF
        </button>
      </div>

      {/* Single Page Report */}
      <div className="max-w-3xl mx-auto p-6 print:p-4">

        {/* Header - Compact */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-3">
            <span>🏘️</span> 15-Minute City Analysis
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{location.displayName.split(',')[0]}</h1>
          <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Hero Score Card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 text-center ${getScoreBg(score.overallScore)}`}>
          <div className="flex items-center justify-center gap-8">
            {/* Big Score */}
            <div>
              <div className={`text-7xl font-black ${getScoreColor(score.overallScore)}`}>
                {score.overallScore}
              </div>
              <div className="text-gray-500 text-sm">out of 100</div>
            </div>

            {/* Grade Badge */}
            <div className="text-center">
              <div className={`text-5xl font-black ${getScoreColor(score.overallScore)}`}>
                {grade.letter}
              </div>
              <div className={`font-semibold ${getScoreColor(score.overallScore)}`}>{grade.label}</div>
            </div>
          </div>

          {/* One-liner summary */}
          <p className="mt-4 text-gray-700 font-medium">
            {availableServices}/{totalServices} essential services within 15-min walk
          </p>
        </div>

        {/* Services Grid - Compact */}
        <div className="grid grid-cols-6 gap-2 mb-6">
          {Object.entries(score.serviceScores).map(([key, service]) => {
            const info = serviceInfo[key];
            const isAvailable = service.available;
            return (
              <div
                key={key}
                className={`text-center p-3 rounded-xl border-2 transition-all ${
                  isAvailable
                    ? 'bg-white border-gray-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="text-2xl mb-1">{info.icon}</div>
                <div className="text-xs font-semibold text-gray-700 mb-1">{info.name}</div>
                {isAvailable ? (
                  <>
                    <div className={`text-lg font-bold ${getScoreColor(service.score)}`}>
                      {getWalkTime(service.nearestDistance)}
                    </div>
                    <div className="text-xs text-gray-400">{service.count} found</div>
                  </>
                ) : (
                  <div className="text-xs text-red-500 font-medium">Missing</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Key Insights - 3 Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Best Performing */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-emerald-600 text-xs font-semibold uppercase tracking-wide mb-1">Best</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{serviceInfo[bestService.key]?.icon}</span>
              <div>
                <div className="font-bold text-gray-800">{serviceInfo[bestService.key]?.name}</div>
                <div className="text-sm text-emerald-600">{bestService.count} locations nearby</div>
              </div>
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-amber-600 text-xs font-semibold uppercase tracking-wide mb-1">Improve</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{serviceInfo[worstService.key]?.icon}</span>
              <div>
                <div className="font-bold text-gray-800">{serviceInfo[worstService.key]?.name}</div>
                <div className="text-sm text-amber-600">
                  {worstService.available ? `${worstService.nearestDistance}m away` : 'Not found'}
                </div>
              </div>
            </div>
          </div>

          {/* Missing Count */}
          <div className={`rounded-xl p-4 ${
            score.missingServices.length > 0
              ? 'bg-red-50 border border-red-200'
              : 'bg-emerald-50 border border-emerald-200'
          }`}>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
              score.missingServices.length > 0 ? 'text-red-600' : 'text-emerald-600'
            }`}>
              {score.missingServices.length > 0 ? 'Gaps' : 'Complete'}
            </div>
            <div className={`text-3xl font-bold ${
              score.missingServices.length > 0 ? 'text-red-600' : 'text-emerald-600'
            }`}>
              {score.missingServices.length > 0 ? score.missingServices.length : '✓'}
            </div>
            <div className="text-sm text-gray-600">
              {score.missingServices.length > 0
                ? 'services missing'
                : 'All services found'}
            </div>
          </div>
        </div>

        {/* What This Means - Single Box */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
            What This Means
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {score.summary}
          </p>
        </div>

        {/* Footer - Minimal */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Data: OpenStreetMap • Analysis radius: 1.2km (15-min walk) • Generated by SafeStreets</p>
        </div>
      </div>
    </div>
  );
}
