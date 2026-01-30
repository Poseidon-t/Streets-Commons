/**
 * ADA Accessibility Report
 * Crisp, single-page snapshot design
 * Visual-first with key insights
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ADAAccessibilityReport as ADAReport } from '../../services/adaAccessibility';
import { PrintStyles } from './shared';

interface ReportData {
  ada: ADAReport;
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

function getGrade(score: number): { letter: string; label: string } {
  if (score >= 90) return { letter: 'A+', label: 'Excellent' };
  if (score >= 80) return { letter: 'A', label: 'Very Good' };
  if (score >= 70) return { letter: 'B', label: 'Good' };
  if (score >= 60) return { letter: 'C', label: 'Fair' };
  if (score >= 50) return { letter: 'D', label: 'Needs Work' };
  return { letter: 'F', label: 'Poor' };
}

function getSlopeColor(slope: number): string {
  if (slope <= 2) return 'text-emerald-600';
  if (slope <= 5) return 'text-blue-600';
  if (slope <= 6.5) return 'text-amber-600';
  if (slope <= 8) return 'text-orange-600';
  return 'text-red-600';
}

export default function ADAAccessibilityReport() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('adaAccessibilityReport');
    if (stored) setData(JSON.parse(stored));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">♿</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Report Data</h1>
          <p className="text-gray-600 mb-4">Generate a report from the analysis page first.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700">
            Go to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { ada, location } = data;
  const grade = getGrade(ada.overallScore);

  // Count violations by severity
  const severeCount = ada.violations.filter(v => v.severity === 'Severe').length;
  const moderateCount = ada.violations.filter(v => v.severity === 'Moderate').length;
  const minorCount = ada.violations.filter(v => v.severity === 'Minor').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      <PrintStyles />

      {/* Action Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 no-print">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white shadow-sm">
          ← Back
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-lg">
          Save PDF
        </button>
      </div>

      {/* Single Page Report */}
      <div className="max-w-3xl mx-auto p-6 print:p-4">

        {/* Header - Compact */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-3">
            <span>♿</span> ADA Accessibility Analysis
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{location.displayName.split(',')[0]}</h1>
          <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Hero Score Card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${getScoreBg(ada.overallScore)}`}>
          <div className="flex items-center justify-center gap-8">
            {/* Big Score */}
            <div className="text-center">
              <div className={`text-7xl font-black ${getScoreColor(ada.overallScore)}`}>
                {ada.overallScore}
              </div>
              <div className="text-gray-500 text-sm">ADA Score</div>
            </div>

            {/* Grade + Status */}
            <div className="text-center">
              <div className={`text-5xl font-black ${getScoreColor(ada.overallScore)}`}>
                {grade.letter}
              </div>
              <div className={`font-semibold ${getScoreColor(ada.overallScore)}`}>{grade.label}</div>
            </div>
          </div>

          {/* Wheelchair Status Badge */}
          <div className="mt-4 text-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-medium ${
              ada.wheelchairFriendly
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {ada.wheelchairFriendly ? '♿ ✓ Wheelchair Friendly' : '♿ ⚠ Accessibility Concerns'}
            </span>
          </div>
        </div>

        {/* Key Metrics Grid - 4 Items */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">✓</div>
            <div className={`text-2xl font-bold ${ada.compliantRoutes >= 80 ? 'text-emerald-600' : ada.compliantRoutes >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
              {ada.compliantRoutes}%
            </div>
            <div className="text-xs text-gray-500">Compliant</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">📐</div>
            <div className={`text-2xl font-bold ${getSlopeColor(ada.averageSlope)}`}>
              {ada.averageSlope}%
            </div>
            <div className="text-xs text-gray-500">Avg Slope</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">⚠️</div>
            <div className={`text-2xl font-bold ${getSlopeColor(ada.maxSlope)}`}>
              {ada.maxSlope}%
            </div>
            <div className="text-xs text-gray-500">Max Slope</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">🚨</div>
            <div className={`text-2xl font-bold ${ada.violations.length === 0 ? 'text-emerald-600' : ada.violations.length <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
              {ada.violations.length}
            </div>
            <div className="text-xs text-gray-500">Violations</div>
          </div>
        </div>

        {/* Compliance Meter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
            Compliance Level
          </h3>
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${
                ada.compliantRoutes >= 80 ? 'bg-emerald-500' :
                ada.compliantRoutes >= 60 ? 'bg-blue-500' :
                ada.compliantRoutes >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${ada.compliantRoutes}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-bold text-white drop-shadow-md">{ada.compliantRoutes}% Compliant</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Violation Summary - if any */}
        {ada.violations.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-red-500 rounded-full"></span>
              Slope Violations
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className={`text-center p-3 rounded-xl ${severeCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className={`text-2xl font-bold ${severeCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{severeCount}</div>
                <div className="text-xs text-gray-600">Severe (&gt;8%)</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${moderateCount > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className={`text-2xl font-bold ${moderateCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{moderateCount}</div>
                <div className="text-xs text-gray-600">Moderate (6.5-8%)</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${minorCount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className={`text-2xl font-bold ${minorCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{minorCount}</div>
                <div className="text-xs text-gray-600">Minor (5-6.5%)</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 mb-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="font-bold text-emerald-700">No Slope Violations!</div>
            <div className="text-sm text-emerald-600">All routes meet ADA standards</div>
          </div>
        )}

        {/* ADA Standards Reference - Compact */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
            ADA Standards
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-teal-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-teal-600">≤5%</div>
              <div className="text-xs text-gray-600">Max Running Slope</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">&lt;2%</div>
              <div className="text-xs text-gray-600">Preferred Slope</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">≤2%</div>
              <div className="text-xs text-gray-600">Max Cross Slope</div>
            </div>
          </div>
        </div>

        {/* Priority Ramp Locations - if any */}
        {ada.rampLocations.length > 0 && (
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 mb-6">
            <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
              <span>🏗️</span> Priority Ramp Locations ({ada.rampLocations.length})
            </h3>
            <div className="space-y-2">
              {ada.rampLocations.slice(0, 3).map((ramp, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg p-2 text-sm">
                  <span className="font-medium text-gray-700">#{i + 1}</span>
                  <span className="font-mono text-xs text-gray-500">{ramp.lat.toFixed(4)}, {ramp.lon.toFixed(4)}</span>
                  <span className="font-bold text-red-600">{ramp.currentSlope.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What This Means */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
            What This Means
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {ada.wheelchairFriendly
              ? 'This area meets ADA accessibility standards for wheelchair users. Routes have manageable slopes and good compliance overall. Suitable for people with mobility challenges.'
              : 'This area has accessibility concerns. Some slopes exceed ADA standards, which may create barriers for wheelchair users. Consider alternative routes or advocate for improvements.'}
          </p>
        </div>

        {/* Impact Note */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <span className="text-xl">👨‍🦽</span>
            <div className="text-xs text-gray-600">Wheelchair users</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <span className="text-xl">👶</span>
            <div className="text-xs text-gray-600">Parents w/ strollers</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <span className="text-xl">🧓</span>
            <div className="text-xs text-gray-600">Elderly individuals</div>
          </div>
        </div>

        {/* Footer - Minimal */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Data: Open-Elevation API (SRTM) • Standards: ADA Guidelines • Generated by SafeStreets</p>
        </div>
      </div>
    </div>
  );
}
