import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';

export default function ReportView() {
  const [searchParams] = useSearchParams();
  const [reportData, setReportData] = useState<{
    location: Location;
    metrics: WalkabilityMetrics;
    dataQuality: DataQuality;
  } | null>(null);

  useEffect(() => {
    // Get data from URL params or sessionStorage
    const dataStr = searchParams.get('data') || sessionStorage.getItem('reportData');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setReportData(data);
      } catch (e) {
        console.error('Failed to parse report data:', e);
      }
    }
  }, [searchParams]);

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#2a3a2a' }}>No Report Data</h1>
          <p className="mb-6" style={{ color: '#5a6a5a' }}>Please generate a report from the main analysis page.</p>
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg"
            style={{ backgroundColor: '#e07850' }}
          >
            Go to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  const { location, metrics } = reportData;
  const score = metrics.overallScore;
  const filledWalkers = Math.round(score);
  const emptyWalkers = 10 - filledWalkers;

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-amber-500';
    if (score >= 4) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-600';
    if (score >= 6) return 'bg-amber-500';
    if (score >= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const metricsArray = [
    { name: 'Street Crossings', score: metrics.crossingDensity, icon: '🚶', description: 'Marked pedestrian crossings (OpenStreetMap)' },
    { name: 'Street Grid', score: metrics.networkEfficiency, icon: '🏙️', description: 'Block size and street connectivity' },
    { name: 'Daily Needs', score: metrics.destinationAccess, icon: '🏪', description: 'Essential services within walking distance (OpenStreetMap)' },
    { name: 'Flat Routes', score: metrics.slope, icon: '🏃', description: 'Terrain difficulty' },
    { name: 'Tree Canopy', score: metrics.treeCanopy, icon: '🌲', description: 'Shade from trees (Sentinel-2 NDVI)' },
    { name: 'Surface Temp', score: metrics.surfaceTemp, icon: '🌡️', description: 'Surface temperature (NASA POWER)' },
    { name: 'Air Quality', score: metrics.airQuality, icon: '💨', description: 'Air quality index (OpenAQ)' },
    { name: 'Heat Island', score: metrics.heatIsland, icon: '🔥', description: 'Urban heat island effect (Sentinel-2 SWIR)' },
  ];

  const topMetrics = [...metricsArray].sort((a, b) => b.score - a.score).slice(0, 2);
  const bottomMetrics = [...metricsArray].sort((a, b) => a.score - b.score).slice(0, 2);

  return (
    <div className="min-h-screen bg-white">
      {/* Print Button - Hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-all shadow-lg"
        >
          📄 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-12">
        {/* PAGE 1: Executive Summary */}
        <div className="page-break-after">
          {/* Logo */}
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 uppercase tracking-widest">SafeStreets</p>
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold text-gray-900 text-center mb-4">
            Walkability Assessment
          </h1>

          <h2 className="text-3xl text-gray-600 text-center mb-12">
            {location.displayName}
          </h2>

          {/* Score Hero */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 mb-12 text-center">
            <div className="flex items-baseline justify-center gap-4 mb-4">
              <div className={`text-8xl font-bold ${getScoreColor(score)}`}>
                {score.toFixed(1)}
              </div>
              <div className="text-5xl text-gray-400 font-light">/10</div>
            </div>

            <div className={`text-3xl font-bold mb-6 ${getScoreColor(score)}`}>
              {metrics.label}
            </div>

            {/* Walker Icons */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: filledWalkers }).map((_, i) => (
                <span key={`filled-${i}`} className={`text-5xl ${getScoreColor(score)}`}>
                  🚶
                </span>
              ))}
              {Array.from({ length: emptyWalkers }).map((_, i) => (
                <span key={`empty-${i}`} className="text-5xl opacity-20 grayscale">
                  🚶
                </span>
              ))}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">
              Executive Summary
            </h3>

            <p className="text-base text-gray-700 mb-4 leading-relaxed">
              This walkability assessment analyzes eight critical factors that determine pedestrian experience and safety in {location.city || location.displayName}. The overall score of {score.toFixed(1)}/10 indicates {metrics.label.toLowerCase()} with notable strengths and areas for improvement.
            </p>

            <p className="text-base text-gray-700 mb-6 leading-relaxed">
              The analysis is based on OpenStreetMap data, satellite imagery, and global walkability standards from NACTO (National Association of City Transportation Officials), GSDG (Global Street Design Guide), and ITDP (Institute for Transportation & Development Policy).
            </p>

            <h4 className="text-xl font-bold text-gray-900 mb-4">Key Findings:</h4>

            <div className="space-y-3">
              {topMetrics.map(m => (
                <div key={m.name} className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
                  <p className="text-gray-800">
                    <span className="text-lg mr-2">✅</span>
                    <strong>{m.name} ({m.score.toFixed(1)}/10):</strong> Excellent infrastructure supporting walkability.
                  </p>
                </div>
              ))}

              {bottomMetrics.map(m => (
                <div key={m.name} className="bg-gray-50 p-4 rounded-lg border-l-4 border-orange-500">
                  <p className="text-gray-800">
                    <span className="text-lg mr-2">⚠️</span>
                    <strong>{m.name} ({m.score.toFixed(1)}/10):</strong> Significant opportunity for improvement.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, NASA POWER, OpenAQ | Page 1 of 3
          </div>
        </div>

        {/* PAGE 2: Detailed Metrics */}
        <div className="page-break-after mt-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">
            What we measured
          </h2>

          <p className="text-base text-gray-700 mb-8">
            Eight factors that determine how pleasant and safe it is to walk here:
          </p>

          <div className="space-y-6">
            {metricsArray.map(m => {
              const filledDots = Math.round(m.score);
              const metricColor = m.score >= 8 ? 'bg-green-600' : m.score >= 6 ? 'bg-amber-500' : m.score >= 4 ? 'bg-orange-500' : 'bg-red-600';
              const textColor = m.score >= 8 ? 'text-green-600' : m.score >= 6 ? 'text-amber-500' : m.score >= 4 ? 'text-orange-500' : 'text-red-600';

              return (
                <div key={m.name} className="bg-gray-50 p-6 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="text-5xl">{m.icon}</div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{m.name}</h3>

                      {/* Dots */}
                      <div className="flex gap-1.5 mb-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full ${i < filledDots ? metricColor : 'bg-gray-300'}`}
                          />
                        ))}
                      </div>

                      <p className="text-sm text-gray-600">{m.description}</p>
                    </div>

                    <div className={`text-3xl font-bold ${textColor}`}>
                      {m.score.toFixed(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
            <h4 className="font-bold text-yellow-900 mb-2">📊 Data Quality</h4>
            <p className="text-sm text-yellow-800">
              This analysis is based on OpenStreetMap data contributed by local mappers. Some infrastructure may not yet be mapped. Satellite data is from Sentinel-2 (tree cover), NASA POWER (temperature), and OpenAQ (air quality).
            </p>
          </div>

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, NASA POWER, OpenAQ | Page 2 of 3
          </div>
        </div>

        {/* PAGE 3: Standards Analysis */}
        <div className="mt-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">
            How it measures up to global standards
          </h2>

          <p className="text-base text-gray-700 mb-8">
            Comparison against leading urban design frameworks for walkable cities:
          </p>

          <div className="space-y-6">
            {/* NACTO */}
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-1">NACTO Urban Street Design Guide</h3>
              <p className="text-sm text-gray-600 mb-4">National Association of City Transportation Officials</p>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Block Size (80-150m recommended)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.networkEfficiency >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.networkEfficiency >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Crossing Density (≤200m spacing)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.crossingDensity >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.crossingDensity >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Street Shading & Microclimate</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.treeCanopy >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.treeCanopy >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Accessible Terrain (≤5% grade)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.slope >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.slope >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
              </div>
            </div>

            {/* GSDG */}
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Global Street Design Guide (GSDG)</h3>
              <p className="text-sm text-gray-600 mb-4">NACTO in collaboration with Global Designing Cities Initiative</p>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Street Connectivity</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.networkEfficiency >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.networkEfficiency >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Urban Heat Management</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.heatIsland >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.heatIsland >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Air Quality (WHO Guidelines)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.airQuality >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.airQuality >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
              </div>
            </div>

            {/* ITDP */}
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Pedestrians First</h3>
              <p className="text-sm text-gray-600 mb-4">Institute for Transportation & Development Policy (ITDP)</p>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Pedestrian Crossings</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.crossingDensity >= 6 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.crossingDensity >= 6 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">15-Minute City (Services Access)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.destinationAccess >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.destinationAccess >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Walking Comfort (Surface Temp)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.surfaceTemp >= 6 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.surfaceTemp >= 6 ? 'Meets' : 'Partial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">Terrain Accessibility (≤5% grade)</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${metrics.slope >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {metrics.slope >= 7 ? 'Meets' : 'Partial'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
            <h4 className="font-bold text-blue-900 mb-2">Overall Assessment:</h4>
            <p className="text-sm text-blue-800">
              This area demonstrates {score >= 6 ? 'solid' : 'mixed'} fundamentals in environmental walkability, assessed against NACTO and ITDP principles. {score < 6 ? 'Key areas for improvement include urban heat management and environmental comfort for pedestrians.' : 'The area meets most international standards for pedestrian environmental comfort.'}
            </p>
          </div>

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, NASA POWER, OpenAQ | Page 3 of 3
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .page-break-after {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
