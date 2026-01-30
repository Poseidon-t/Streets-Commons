/**
 * Street Lighting Safety Report
 * Crisp, single-page snapshot design
 * Visual-first with key insights
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StreetLightingAnalysis } from '../../services/streetLighting';
import { PrintStyles } from './shared';

interface ReportData {
  lighting: StreetLightingAnalysis;
  location: {
    displayName: string;
    lat: number;
    lon: number;
  };
}

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
  if (score >= 60) return { letter: 'B', label: 'Good', emoji: '💡' };
  if (score >= 40) return { letter: 'C', label: 'Fair', emoji: '⚠️' };
  if (score >= 20) return { letter: 'D', label: 'Poor', emoji: '🌙' };
  return { letter: 'F', label: 'Dark', emoji: '🚨' };
}

function getCoverageColor(coverage: number): string {
  if (coverage >= 70) return 'text-emerald-600';
  if (coverage >= 50) return 'text-blue-600';
  if (coverage >= 30) return 'text-amber-600';
  return 'text-red-600';
}

export default function StreetLightingReport() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('streetLightingReport');
    if (stored) setData(JSON.parse(stored));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">💡</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Report Data</h1>
          <p className="text-gray-600 mb-4">Generate a report from the analysis page first.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700">
            Go to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { lighting, location } = data;
  const grade = getGrade(lighting.overallScore);

  // Count dark spots by severity
  const highPriority = lighting.darkSpots.filter(d => d.severity === 'High').length;
  const mediumPriority = lighting.darkSpots.filter(d => d.severity === 'Medium').length;
  const lowPriority = lighting.darkSpots.filter(d => d.severity === 'Low').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <PrintStyles />

      {/* Action Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 no-print">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white shadow-sm">
          ← Back
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-lg">
          Save PDF
        </button>
      </div>

      {/* Single Page Report */}
      <div className="max-w-3xl mx-auto p-6 print:p-4">

        {/* Header - Compact */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-3">
            <span>💡</span> Street Lighting Analysis
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{location.displayName.split(',')[0]}</h1>
          <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Hero Score Card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${getScoreBg(lighting.overallScore)}`}>
          <div className="flex items-center justify-center gap-6">
            {/* Overall Score */}
            <div className="text-center">
              <div className={`text-6xl font-black ${getScoreColor(lighting.overallScore)}`}>
                {lighting.overallScore}
              </div>
              <div className="text-gray-500 text-sm">Overall</div>
            </div>

            {/* Divider */}
            <div className="w-px h-16 bg-gray-300"></div>

            {/* Safety Score */}
            <div className="text-center">
              <div className={`text-6xl font-black ${getScoreColor(lighting.nighttimeSafetyScore)}`}>
                {lighting.nighttimeSafetyScore}
              </div>
              <div className="text-gray-500 text-sm">Safety</div>
            </div>

            {/* Divider */}
            <div className="w-px h-16 bg-gray-300"></div>

            {/* Grade Badge */}
            <div className="text-center">
              <div className="text-4xl mb-1">{grade.emoji}</div>
              <div className={`text-2xl font-bold ${getScoreColor(lighting.overallScore)}`}>{grade.letter}</div>
              <div className="text-gray-600 text-sm font-medium">{grade.label}</div>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid - 4 Items */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">✓</div>
            <div className="text-2xl font-bold text-emerald-600">{lighting.litStreets}</div>
            <div className="text-xs text-gray-500">Lit Streets</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">✗</div>
            <div className={`text-2xl font-bold ${lighting.unlitStreets > lighting.litStreets ? 'text-red-600' : 'text-amber-600'}`}>
              {lighting.unlitStreets}
            </div>
            <div className="text-xs text-gray-500">Unlit Streets</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className={`text-2xl font-bold ${getCoverageColor(lighting.coveragePercent)}`}>
              {lighting.coveragePercent}%
            </div>
            <div className="text-xs text-gray-500">Coverage</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">💡</div>
            <div className={`text-2xl font-bold ${lighting.lightingDensity >= 8 ? 'text-emerald-600' : lighting.lightingDensity >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
              {lighting.lightingDensity}
            </div>
            <div className="text-xs text-gray-500">Lamps/km</div>
          </div>
        </div>

        {/* Coverage Visual - Night Scene */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 text-white">
          <h3 className="font-bold text-lg mb-4 text-center">🌙 Nighttime Coverage</h3>
          <div className="flex justify-center items-center gap-6">
            {/* Day Circle */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                <span className="text-3xl">☀️</span>
              </div>
              <div className="text-sm mt-2">Day</div>
              <div className="text-gray-400 text-xs">100%</div>
            </div>

            <div className="text-2xl text-gray-600">→</div>

            {/* Night Circle with Coverage */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center mx-auto relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500/60 to-transparent"
                  style={{ height: `${lighting.coveragePercent}%` }}
                />
                <span className="text-3xl relative z-10">🌙</span>
              </div>
              <div className="text-sm mt-2">Night</div>
              <div className={`text-xs ${getCoverageColor(lighting.coveragePercent)}`}>{lighting.coveragePercent}% lit</div>
            </div>
          </div>

          {/* Lamp icons */}
          <div className="mt-4 flex justify-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`text-lg ${i < Math.round(lighting.coveragePercent / 10) ? 'opacity-100' : 'opacity-20'}`}
              >
                💡
              </div>
            ))}
          </div>
        </div>

        {/* Dark Spots Summary */}
        {lighting.darkSpots.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-red-500 rounded-full"></span>
              Dark Spots ({lighting.darkSpots.length})
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className={`text-center p-3 rounded-xl ${highPriority > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className={`text-2xl font-bold ${highPriority > 0 ? 'text-red-600' : 'text-gray-400'}`}>{highPriority}</div>
                <div className="text-xs text-gray-600">High Priority</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${mediumPriority > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className={`text-2xl font-bold ${mediumPriority > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{mediumPriority}</div>
                <div className="text-xs text-gray-600">Medium</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${lowPriority > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className={`text-2xl font-bold ${lowPriority > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{lowPriority}</div>
                <div className="text-xs text-gray-600">Low</div>
              </div>
            </div>

            {/* Top dark spots list */}
            {lighting.darkSpots.slice(0, 3).map((spot, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    spot.severity === 'High' ? 'bg-red-500' :
                    spot.severity === 'Medium' ? 'bg-orange-500' : 'bg-amber-500'
                  }`}></span>
                  <span className="font-medium text-gray-700 truncate max-w-[180px]">{spot.streetName}</span>
                </div>
                <span className="text-gray-500">{spot.length}m</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 mb-6 text-center">
            <div className="text-3xl mb-2">✨</div>
            <div className="font-bold text-emerald-700">No Dark Spots!</div>
            <div className="text-sm text-emerald-600">All major streets have lighting</div>
          </div>
        )}

        {/* Safety Impact - Compact */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
          <h3 className="font-bold text-blue-800 mb-3">📊 Research-Backed Safety Impact</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">20-30%</div>
              <div className="text-xs text-gray-600">Crime Reduction</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">35%</div>
              <div className="text-xs text-gray-600">Fewer Crashes</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">50%</div>
              <div className="text-xs text-gray-600">Reduced Fear</div>
            </div>
          </div>
        </div>

        {/* What This Means */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
            What This Means
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {lighting.coveragePercent >= 70 && 'Good street lighting coverage. Most streets are well-lit, supporting safe nighttime walking. Consider maintaining existing infrastructure.'}
            {lighting.coveragePercent >= 50 && lighting.coveragePercent < 70 && 'Moderate lighting coverage. Some areas may feel unsafe at night. Focus on improving dark spots, especially high-traffic areas.'}
            {lighting.coveragePercent >= 30 && lighting.coveragePercent < 50 && 'Low lighting coverage. Many streets lack adequate lighting. Prioritize installation on main pedestrian routes and high-risk areas.'}
            {lighting.coveragePercent < 30 && 'Poor lighting coverage. Most streets are dark at night, creating significant safety concerns. Urgent improvements needed.'}
          </p>
        </div>

        {/* Quick Wins */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
            <div className="text-emerald-700 font-semibold text-sm mb-2">⚡ Quick Wins</div>
            <ul className="text-xs text-emerald-600 space-y-1">
              <li>• Install LEDs on priority dark spots</li>
              <li>• Trim vegetation blocking lights</li>
              <li>• Report broken fixtures</li>
            </ul>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
            <div className="text-amber-700 font-semibold text-sm mb-2">📋 Standards</div>
            <ul className="text-xs text-amber-600 space-y-1">
              <li>• Target: 8-12 lamps/km</li>
              <li>• Residential: 5 lux min</li>
              <li>• Pedestrian: 20 lux min</li>
            </ul>
          </div>
        </div>

        {/* Footer - Minimal */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Data: OpenStreetMap • Research: CPTED Studies • Generated by SafeStreets</p>
        </div>
      </div>
    </div>
  );
}
