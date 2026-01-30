/**
 * Transit Access Report
 * Crisp, single-page snapshot design
 * Visual-first with key insights
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TransitAccessAnalysis } from '../../services/transitAccess';
import { PrintStyles } from './shared';

interface ReportData {
  transit: TransitAccessAnalysis;
  location: {
    displayName: string;
    lat: number;
    lon: number;
  };
}

const transitIcons: Record<string, { icon: string; name: string }> = {
  Bus: { icon: '🚌', name: 'Bus' },
  Rail: { icon: '🚆', name: 'Rail' },
  Tram: { icon: '🚊', name: 'Tram' },
  Subway: { icon: '🚇', name: 'Metro' },
  Ferry: { icon: '⛴️', name: 'Ferry' }
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

function getGrade(score: number): { letter: string; label: string; emoji: string } {
  if (score >= 80) return { letter: 'A', label: 'Excellent', emoji: '🌟' };
  if (score >= 60) return { letter: 'B', label: 'Good', emoji: '👍' };
  if (score >= 40) return { letter: 'C', label: 'Fair', emoji: '🤔' };
  if (score >= 20) return { letter: 'D', label: 'Limited', emoji: '⚠️' };
  return { letter: 'F', label: 'Poor', emoji: '🚗' };
}

function getWalkTime(meters: number): string {
  if (meters < 0) return '—';
  const minutes = Math.round(meters / 80);
  return minutes < 1 ? '<1m' : `${minutes}m`;
}

export default function TransitAccessReport() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('transitAccessReport');
    if (stored) setData(JSON.parse(stored));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🚇</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Report Data</h1>
          <p className="text-gray-600 mb-4">Generate a report from the analysis page first.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700">
            Go to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { transit, location } = data;
  const grade = getGrade(transit.overallScore);

  // Coverage summary
  const availableTypes = Object.entries(transit.coverage).filter(([, v]) => v).length;
  const totalTypes = Object.keys(transit.coverage).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <PrintStyles />

      {/* Action Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 no-print">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white shadow-sm">
          ← Back
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg">
          Save PDF
        </button>
      </div>

      {/* Single Page Report */}
      <div className="max-w-3xl mx-auto p-6 print:p-4">

        {/* Header - Compact */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-3">
            <span>🚇</span> Transit Access Analysis
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{location.displayName.split(',')[0]}</h1>
          <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Hero Score Card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${getScoreBg(transit.overallScore)}`}>
          <div className="flex items-center justify-center gap-8">
            {/* Big Score */}
            <div className="text-center">
              <div className={`text-7xl font-black ${getScoreColor(transit.overallScore)}`}>
                {transit.overallScore}
              </div>
              <div className="text-gray-500 text-sm">Transit Score</div>
            </div>

            {/* Grade Badge */}
            <div className="text-center">
              <div className="text-4xl mb-1">{grade.emoji}</div>
              <div className={`text-2xl font-bold ${getScoreColor(transit.overallScore)}`}>{grade.letter}</div>
              <div className="text-gray-600 font-medium">{grade.label}</div>
            </div>
          </div>

          {/* Car-Free Feasibility */}
          <div className="mt-4 text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getScoreBg(transit.overallScore)}`}>
              {transit.carFreeFeasibility}
            </span>
          </div>
        </div>

        {/* Key Metrics Grid - 4 Items */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">📍</div>
            <div className="text-2xl font-bold text-purple-600">
              {transit.nearestStopDistance >= 0 ? `${transit.nearestStopDistance}m` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Nearest Stop</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">🚶</div>
            <div className="text-2xl font-bold text-blue-600">
              {transit.nearestStopDistance >= 0 ? getWalkTime(transit.nearestStopDistance) : '—'}
            </div>
            <div className="text-xs text-gray-500">Walk Time</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">🚏</div>
            <div className="text-2xl font-bold text-indigo-600">{transit.stopsWithin500m}</div>
            <div className="text-xs text-gray-500">Stops (500m)</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">🔄</div>
            <div className="text-2xl font-bold text-emerald-600">{transit.transitTypes.length}</div>
            <div className="text-xs text-gray-500">Transit Types</div>
          </div>
        </div>

        {/* Transit Coverage Grid */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
            Transit Coverage ({availableTypes}/{totalTypes})
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(transit.coverage).map(([type, available]) => {
              const typeKey = type.charAt(0).toUpperCase() + type.slice(1);
              const info = transitIcons[typeKey] || { icon: '🚏', name: type };
              return (
                <div
                  key={type}
                  className={`text-center p-3 rounded-xl border-2 ${
                    available
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-gray-50 border-gray-200 opacity-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{info.icon}</div>
                  <div className="text-xs font-semibold text-gray-700">{info.name}</div>
                  <div className={`text-xs font-bold ${available ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {available ? '✓' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transit Types Detail (if available) */}
        {transit.transitTypes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
              Available Services
            </h3>
            <div className="space-y-2">
              {transit.transitTypes.map((type, i) => {
                const info = transitIcons[type.type] || { icon: '🚏', name: type.type };
                return (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{info.icon}</span>
                      <span className="font-medium text-gray-800">{info.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{type.count} stops</span>
                      <span className="font-bold text-purple-600">{type.nearestDistance}m</span>
                      <span className="text-gray-400">{getWalkTime(type.nearestDistance)} walk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Score Breakdown - Visual */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
            Score Breakdown
          </h3>
          <div className="space-y-3">
            {/* Distance Score */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Distance</span>
                <span className="font-bold text-purple-600">
                  {transit.nearestStopDistance <= 250 ? 50 :
                    transit.nearestStopDistance <= 500 ? 40 :
                    transit.nearestStopDistance <= 800 ? 25 : 0}/50
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(transit.nearestStopDistance <= 250 ? 50 :
                    transit.nearestStopDistance <= 500 ? 40 :
                    transit.nearestStopDistance <= 800 ? 25 : 0) * 2}%` }}
                />
              </div>
            </div>

            {/* Coverage Score */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Coverage</span>
                <span className="font-bold text-indigo-600">{Math.min(transit.transitTypes.length * 10, 30)}/30</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(Math.min(transit.transitTypes.length * 10, 30) / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Frequency Score */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Density</span>
                <span className="font-bold text-blue-600">{Math.min(transit.stopsWithin500m * 4, 20)}/20</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(Math.min(transit.stopsWithin500m * 4, 20) / 20) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* What This Means */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
            What This Means
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {transit.overallScore >= 80 && 'Excellent transit access! Car-free living is easily achievable. Multiple transit options within walking distance.'}
            {transit.overallScore >= 60 && transit.overallScore < 80 && 'Good transit coverage. Most daily trips can be made without a car. Consider biking for added flexibility.'}
            {transit.overallScore >= 40 && transit.overallScore < 60 && 'Moderate transit access. Some car dependency likely for certain trips. Advocate for service improvements.'}
            {transit.overallScore >= 20 && transit.overallScore < 40 && 'Limited transit options. Car likely needed for many daily activities. Consider proximity to stops when planning trips.'}
            {transit.overallScore < 20 && 'Poor transit access. This area is car-dependent. Consider advocating for basic transit service expansion.'}
          </p>
        </div>

        {/* Recommendations */}
        {transit.recommendations.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {transit.recommendations.slice(0, 2).map((rec, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 text-sm ${
                  rec.includes('Excellent') || rec.includes('✓')
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                {rec}
              </div>
            ))}
          </div>
        )}

        {/* Footer - Minimal */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Data: OpenStreetMap • Analysis: 800m radius • Generated by SafeStreets</p>
        </div>
      </div>
    </div>
  );
}
