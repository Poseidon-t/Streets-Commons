/**
 * Building Density (FAR) Report
 * Crisp, single-page snapshot design
 * Visual-first with key insights
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BuildingDensityAnalysis } from '../../services/buildingDensity';
import { PrintStyles } from './shared';

interface ReportData {
  density: BuildingDensityAnalysis;
  location: {
    displayName: string;
    lat: number;
    lon: number;
  };
}

function getDensityColor(far: number): string {
  if (far >= 3) return 'text-purple-600';
  if (far >= 1.5) return 'text-orange-600';
  if (far >= 0.5) return 'text-blue-600';
  return 'text-emerald-600';
}

function getDensityBg(far: number): string {
  if (far >= 3) return 'bg-purple-50 border-purple-200';
  if (far >= 1.5) return 'bg-orange-50 border-orange-200';
  if (far >= 0.5) return 'bg-blue-50 border-blue-200';
  return 'bg-emerald-50 border-emerald-200';
}

function getDensityGrade(far: number): { category: string; icon: string } {
  if (far >= 3) return { category: 'Downtown', icon: '🏙️' };
  if (far >= 1.5) return { category: 'Mixed-Use', icon: '🏬' };
  if (far >= 0.5) return { category: 'Urban', icon: '🏢' };
  return { category: 'Suburban', icon: '🏠' };
}

function getDensityInsight(far: number): string {
  if (far >= 3) return 'Very high-density downtown core. Excellent for transit, walkability, and urban amenities. Typical of CBDs.';
  if (far >= 1.5) return 'High-density mixed-use area. Supports good public transit and diverse retail. Vibrant street life potential.';
  if (far >= 0.5) return 'Medium-density urban residential. Mix of apartments and townhomes. Can support walkable neighborhoods.';
  return 'Low-density suburban area. Single-family homes with spacing. May require car dependency for most trips.';
}

export default function BuildingDensityReport() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('buildingDensityReport');
    if (stored) setData(JSON.parse(stored));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🏗️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Report Data</h1>
          <p className="text-gray-600 mb-4">Generate a report from the analysis page first.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700">
            Go to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { density, location } = data;
  const grade = getDensityGrade(density.far);
  const hectares = Math.round(density.landArea / 10000 * 10) / 10;
  const coveragePercent = Math.round((density.totalBuildingFootprint / density.landArea) * 100);

  // Height distribution for mini chart
  const lowRise = density.buildings.filter(b => (b.height || 10) <= 10).length;
  const midRise = density.buildings.filter(b => (b.height || 10) > 10 && (b.height || 10) <= 20).length;
  const highRise = density.buildings.filter(b => (b.height || 10) > 20).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <PrintStyles />

      {/* Action Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 no-print">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white shadow-sm">
          ← Back
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-lg">
          Save PDF
        </button>
      </div>

      {/* Single Page Report */}
      <div className="max-w-3xl mx-auto p-6 print:p-4">

        {/* Header - Compact */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-3">
            <span>🏗️</span> Building Density Analysis
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{location.displayName.split(',')[0]}</h1>
          <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Hero FAR Card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${getDensityBg(density.far)}`}>
          <div className="flex items-center justify-center gap-8">
            {/* Big FAR Number */}
            <div className="text-center">
              <div className={`text-7xl font-black ${getDensityColor(density.far)}`}>
                {density.far}
              </div>
              <div className="text-gray-500 text-sm">Floor Area Ratio</div>
            </div>

            {/* Category Badge */}
            <div className="text-center">
              <div className="text-5xl mb-1">{grade.icon}</div>
              <div className={`text-xl font-bold ${getDensityColor(density.far)}`}>{grade.category}</div>
              <div className="text-gray-500 text-sm">{density.densityCategory}</div>
            </div>
          </div>

          {/* One-liner summary */}
          <p className="mt-4 text-gray-700 font-medium text-center">
            {density.totalBuildings.toLocaleString()} buildings in {hectares} hectares
          </p>
        </div>

        {/* Key Metrics Grid - 4 Items */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">🏢</div>
            <div className="text-2xl font-bold text-gray-800">{density.totalBuildings}</div>
            <div className="text-xs text-gray-500">Buildings</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-2xl font-bold text-blue-600">{density.buildingsPerHectare}</div>
            <div className="text-xs text-gray-500">Per Hectare</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">📏</div>
            <div className="text-2xl font-bold text-amber-600">{density.averageHeight}m</div>
            <div className="text-xs text-gray-500">Avg Height</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">🗺️</div>
            <div className="text-2xl font-bold text-purple-600">{coveragePercent}%</div>
            <div className="text-xs text-gray-500">Coverage</div>
          </div>
        </div>

        {/* Height Distribution Mini Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
            Building Heights
          </h3>
          <div className="flex items-end gap-3 h-16">
            <div className="flex-1 text-center">
              <div
                className="bg-emerald-400 rounded-t mx-auto"
                style={{
                  width: '100%',
                  height: `${density.totalBuildings > 0 ? Math.max((lowRise / density.totalBuildings) * 64, 4) : 4}px`
                }}
              ></div>
              <div className="text-xs text-gray-600 mt-1">&lt;10m</div>
              <div className="text-sm font-bold">{lowRise}</div>
            </div>
            <div className="flex-1 text-center">
              <div
                className="bg-amber-400 rounded-t mx-auto"
                style={{
                  width: '100%',
                  height: `${density.totalBuildings > 0 ? Math.max((midRise / density.totalBuildings) * 64, 4) : 4}px`
                }}
              ></div>
              <div className="text-xs text-gray-600 mt-1">10-20m</div>
              <div className="text-sm font-bold">{midRise}</div>
            </div>
            <div className="flex-1 text-center">
              <div
                className="bg-orange-500 rounded-t mx-auto"
                style={{
                  width: '100%',
                  height: `${density.totalBuildings > 0 ? Math.max((highRise / density.totalBuildings) * 64, 4) : 4}px`
                }}
              ></div>
              <div className="text-xs text-gray-600 mt-1">&gt;20m</div>
              <div className="text-sm font-bold">{highRise}</div>
            </div>
          </div>
        </div>

        {/* FAR Scale Visual */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
            Density Scale
          </h3>
          <div className="relative h-8 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-emerald-400 flex items-center justify-center text-white text-xs font-medium">
              Suburban
            </div>
            <div className="flex-1 bg-blue-400 flex items-center justify-center text-white text-xs font-medium">
              Urban
            </div>
            <div className="flex-1 bg-orange-400 flex items-center justify-center text-white text-xs font-medium">
              Mixed-Use
            </div>
            <div className="flex-1 bg-purple-500 flex items-center justify-center text-white text-xs font-medium">
              Downtown
            </div>
          </div>
          {/* Marker */}
          <div className="relative h-6">
            <div
              className="absolute top-0 transform -translate-x-1/2"
              style={{ left: `${Math.min((density.far / 4) * 100, 95)}%` }}
            >
              <div className="w-0 h-0 border-l-6 border-r-6 border-b-6 border-l-transparent border-r-transparent border-b-gray-800"></div>
              <div className="bg-gray-800 text-white px-2 py-0.5 rounded text-xs font-bold">
                {density.far}
              </div>
            </div>
          </div>
        </div>

        {/* What This Means - Single Box */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
            What This Means
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {getDensityInsight(density.far)}
          </p>
        </div>

        {/* Implications - Two Column */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
            <div className="text-emerald-700 font-semibold text-sm mb-2">✓ Supports</div>
            <ul className="text-xs text-emerald-600 space-y-1">
              {density.far >= 0.5 && <li>• Walkable streets</li>}
              {density.far >= 1.0 && <li>• Public transit</li>}
              {density.far >= 1.5 && <li>• Diverse retail</li>}
              {density.far < 0.5 && <li>• Private yards</li>}
              {density.far < 1.0 && <li>• Low congestion</li>}
            </ul>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
            <div className="text-amber-700 font-semibold text-sm mb-2">⚠ Consider</div>
            <ul className="text-xs text-amber-600 space-y-1">
              {density.far < 0.5 && <li>• Car dependency</li>}
              {density.far < 1.0 && <li>• Limited transit</li>}
              {density.far >= 2.0 && <li>• Shadow impacts</li>}
              {density.far >= 3.0 && <li>• Wind effects</li>}
            </ul>
          </div>
        </div>

        {/* Footer - Minimal */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Data: OpenStreetMap • Analysis: {Math.round(Math.sqrt(density.landArea / Math.PI))}m radius • Generated by SafeStreets</p>
        </div>
      </div>
    </div>
  );
}
