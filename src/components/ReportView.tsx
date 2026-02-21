import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';
import { recalculateScore, createEmptyFieldData, METRIC_KEYS } from '../utils/fieldVerificationScore';
import type { MetricKey, FieldData } from '../utils/fieldVerificationScore';

export default function ReportView() {
  const [searchParams] = useSearchParams();
  const [reportData, setReportData] = useState<{
    location: Location;
    metrics: WalkabilityMetrics;
    dataQuality: DataQuality;
  } | null>(null);

  // Field Verification state
  const [fieldMode, setFieldMode] = useState(false);
  const [fieldData, setFieldData] = useState<FieldData>(createEmptyFieldData);
  const [verifierName, setVerifierName] = useState('');
  const [verificationDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const dataStr = searchParams.get('data') || sessionStorage.getItem('reportData');
    if (dataStr) {
      try {
        setReportData(JSON.parse(dataStr));
      } catch (e) {
        console.error('Failed to parse report data:', e);
      }
    }
  }, [searchParams]);

  // Field verification computed values (must be before early return — hooks can't be conditional)
  const fieldOverall = useMemo(() => {
    if (!reportData || !fieldMode) return null;
    return recalculateScore(reportData.metrics, fieldData);
  }, [fieldMode, reportData, fieldData]);

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#2a3a2a' }}>No Report Data</h1>
          <p className="mb-6" style={{ color: '#5a6a5a' }}>Please generate a report from the main analysis page.</p>
          <a href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg" style={{ backgroundColor: '#e07850' }}>
            Go to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  const { location, metrics } = reportData;
  const score = metrics.overallScore;
  const totalPages = 3;

  const hasAnyAdjustment = METRIC_KEYS.some(k => fieldData[k].adjustedScore !== null);
  const displayScore = fieldMode && fieldOverall ? fieldOverall.overallScore : score;
  const displayLabel = fieldMode && fieldOverall ? fieldOverall.label : metrics.label;
  const filledWalkers = Math.round(displayScore);
  const emptyWalkers = 10 - filledWalkers;

  const resolveMetric = (key: MetricKey): number =>
    fieldMode && fieldData[key].adjustedScore !== null
      ? fieldData[key].adjustedScore!
      : metrics[key];

  const getScoreColor = (s: number) => {
    if (s >= 8) return 'text-green-600';
    if (s >= 6) return 'text-amber-500';
    if (s >= 4) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBarColor = (s: number) => {
    if (s >= 8) return 'bg-green-600';
    if (s >= 6) return 'bg-amber-500';
    if (s >= 4) return 'bg-orange-500';
    return 'bg-red-600';
  };

  const getHexColor = (s: number) => {
    if (s >= 8) return '#22c55e';
    if (s >= 6) return '#eab308';
    if (s >= 4) return '#f97316';
    return '#ef4444';
  };

  const metricsArray: { name: string; score: number; icon: string; description: string; key: MetricKey }[] = [
    { name: 'Crossing Safety', score: metrics.crossingSafety, icon: '🚦', description: 'Protected pedestrian crossings (OpenStreetMap)', key: 'crossingSafety' },
    { name: 'Sidewalks', score: metrics.sidewalkCoverage, icon: '🚶\u200D♀️', description: 'Streets with sidewalk coverage (OpenStreetMap)', key: 'sidewalkCoverage' },
    { name: 'Traffic Speed', score: metrics.speedExposure, icon: '🚗', description: 'Traffic speed and lane safety (OpenStreetMap)', key: 'speedExposure' },
    { name: 'Daily Needs', score: metrics.destinationAccess, icon: '🏪', description: 'Essential services within walking distance (OpenStreetMap)', key: 'destinationAccess' },
    { name: 'Night Safety', score: metrics.nightSafety, icon: '💡', description: 'Street lighting coverage (OpenStreetMap)', key: 'nightSafety' },
    { name: 'Flat Routes', score: metrics.slope, icon: '⛰️', description: 'Terrain difficulty (NASA SRTM)', key: 'slope' },
    { name: 'Tree Canopy', score: metrics.treeCanopy, icon: '🌳', description: 'Shade from trees (Sentinel-2 NDVI)', key: 'treeCanopy' },
    { name: 'Thermal Comfort', score: metrics.thermalComfort, icon: '🌡️', description: 'Walking temperature comfort (NASA POWER + Sentinel-2)', key: 'thermalComfort' },
  ];

  // Resolved metrics (using field-adjusted scores when active)
  const resolvedMetrics = metricsArray.map(m => ({
    ...m,
    displayScore: resolveMetric(m.key),
    originalScore: m.score,
  }));

  const topMetrics = [...resolvedMetrics].sort((a, b) => b.displayScore - a.displayScore).slice(0, 2);
  const bottomMetrics = [...resolvedMetrics].sort((a, b) => a.displayScore - b.displayScore).slice(0, 2);

  const handleAdjust = (key: MetricKey, delta: number) => {
    const current = fieldData[key].adjustedScore ?? metrics[key];
    const next = Math.min(10, Math.max(0, Math.round((current + delta) * 2) / 2));
    setFieldData(prev => ({ ...prev, [key]: { ...prev[key], adjustedScore: next } }));
  };

  const handleResetMetric = (key: MetricKey) => {
    setFieldData(prev => ({ ...prev, [key]: { ...prev[key], adjustedScore: null } }));
  };

  const handleResetAll = () => {
    setFieldData(createEmptyFieldData());
    setVerifierName('');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar — Hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFieldMode(!fieldMode)}
              className={`px-4 py-2 font-semibold rounded-lg transition-all text-sm ${
                fieldMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {fieldMode ? '✓ Field Verification ON' : 'Field Verify'}
            </button>
            {fieldMode && (
              <>
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-44"
                />
                <span className="text-xs text-gray-400 hidden sm:inline">{verificationDate}</span>
                {hasAnyAdjustment && (
                  <button onClick={handleResetAll} className="text-xs text-red-500 hover:text-red-700 underline">
                    Reset All
                  </button>
                )}
              </>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-all text-sm"
          >
            Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-12">

        {/* Verifier info — print version */}
        {fieldMode && hasAnyAdjustment && (
          <div className="hidden print:block mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
            <strong>Field-Verified Report</strong>
            {verifierName && <span> by {verifierName}</span>}
            <span> on {verificationDate}</span>
            <span className="text-blue-600 ml-2">| Scores adjusted based on ground observation</span>
          </div>
        )}

        {/* PAGE 1: Executive Summary */}
        <div className="page-break-after">
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 uppercase tracking-widest">SafeStreets</p>
          </div>

          <h1 className="text-5xl font-bold text-gray-900 text-center mb-4">
            Walkability Assessment
          </h1>

          <h2 className="text-3xl text-gray-600 text-center mb-12">
            {location.displayName}
          </h2>

          {/* Score Hero */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 mb-12 text-center">
            {/* Show dual score when field-verified overall differs */}
            {fieldMode && hasAnyAdjustment && Math.abs(displayScore - score) > 0.05 && (
              <div className="mb-4 text-sm text-gray-500">
                <span>Tool Estimate: </span>
                <span className={`font-semibold ${getScoreColor(score)}`}>{score.toFixed(1)}</span>
                <span className="mx-2 text-gray-300">→</span>
                <span className="font-semibold text-blue-600">Field-Verified:</span>
              </div>
            )}

            <div className="flex items-baseline justify-center gap-4 mb-4">
              <div className={`text-8xl font-bold ${getScoreColor(displayScore)}`}>
                {displayScore.toFixed(1)}
              </div>
              <div className="text-5xl text-gray-400 font-light">/10</div>
            </div>

            <div className={`text-3xl font-bold mb-6 ${getScoreColor(displayScore)}`}>
              {displayLabel}
            </div>

            {/* Walker Icons */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: filledWalkers }).map((_, i) => (
                <span key={`filled-${i}`} className={`text-5xl ${getScoreColor(displayScore)}`}>🚶</span>
              ))}
              {Array.from({ length: emptyWalkers }).map((_, i) => (
                <span key={`empty-${i}`} className="text-5xl opacity-20 grayscale">🚶</span>
              ))}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">
              Executive Summary
            </h3>

            <p className="text-base text-gray-700 mb-4 leading-relaxed">
              This walkability assessment analyzes eight critical factors that determine pedestrian experience and safety in {location.city || location.displayName}. The overall score of {displayScore.toFixed(1)}/10 indicates {displayLabel.toLowerCase()} with notable strengths and areas for improvement.
            </p>

            <p className="text-base text-gray-700 mb-6 leading-relaxed">
              The analysis is based on OpenStreetMap data, satellite imagery, and global walkability standards from NACTO (National Association of City Transportation Officials), GSDG (Global Street Design Guide), and ITDP (Institute for Transportation & Development Policy).
              {fieldMode && hasAnyAdjustment && ' Some scores have been adjusted based on field observation.'}
            </p>

            <h4 className="text-xl font-bold text-gray-900 mb-4">Key Findings:</h4>

            <div className="space-y-3">
              {topMetrics.map(m => (
                <div key={m.name} className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
                  <p className="text-gray-800">
                    <span className="text-lg mr-2">✅</span>
                    <strong>{m.name} ({m.displayScore.toFixed(1)}/10):</strong> Excellent infrastructure supporting walkability.
                  </p>
                </div>
              ))}

              {bottomMetrics.map(m => (
                <div key={m.name} className="bg-gray-50 p-4 rounded-lg border-l-4 border-orange-500">
                  <p className="text-gray-800">
                    <span className="text-lg mr-2">⚠️</span>
                    <strong>{m.name} ({m.displayScore.toFixed(1)}/10):</strong> Significant opportunity for improvement.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, NASA POWER, NHTSA FARS, WHO | Page 1 of {totalPages}
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
            {resolvedMetrics.map(m => {
              const activeScore = m.displayScore;
              const filledDots = Math.round(activeScore);
              const metricColor = getBarColor(activeScore);
              const textColor = getScoreColor(activeScore);
              const isAdjusted = fieldData[m.key].adjustedScore !== null;

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
                      {activeScore.toFixed(1)}
                    </div>
                  </div>

                  {/* Field Verification Controls */}
                  {fieldMode && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {/* Score adjuster — hidden in print */}
                      <div className="print:hidden flex items-center gap-4 mb-3 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 w-20">Field Score:</span>
                        <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: '#d0cbc0' }}>
                          <button
                            onClick={() => handleAdjust(m.key, -0.5)}
                            className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 transition"
                            aria-label={`Decrease ${m.name} score`}
                          >-</button>
                          <span
                            className="px-3 py-1.5 text-sm font-semibold tabular-nums min-w-[3.5rem] text-center border-x"
                            style={{ borderColor: '#d0cbc0', backgroundColor: '#faf8f5', color: getHexColor(fieldData[m.key].adjustedScore ?? m.originalScore) }}
                          >
                            {(fieldData[m.key].adjustedScore ?? m.originalScore).toFixed(1)}
                          </span>
                          <button
                            onClick={() => handleAdjust(m.key, 0.5)}
                            className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 transition"
                            aria-label={`Increase ${m.name} score`}
                          >+</button>
                        </div>
                        {isAdjusted && (
                          <button
                            onClick={() => handleResetMetric(m.key)}
                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                          >Reset</button>
                        )}
                      </div>

                      {/* Dual score — visible in print when adjusted */}
                      {isAdjusted && (
                        <div className="flex items-center gap-4 mb-3 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Tool Estimate</span>
                            <span className={`ml-1.5 font-semibold ${getScoreColor(m.originalScore)}`}>{m.originalScore.toFixed(1)}</span>
                          </div>
                          <span className="text-gray-300">→</span>
                          <div>
                            <span className="text-blue-500 text-xs font-semibold">Field-Verified</span>
                            <span className="ml-1.5 font-bold" style={{ color: getHexColor(fieldData[m.key].adjustedScore!) }}>
                              {fieldData[m.key].adjustedScore!.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Observation — edit hidden in print, text visible */}
                      <textarea
                        className="print:hidden w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        rows={2}
                        placeholder="What did you observe? (e.g., 'Sidewalks present but narrow, ~1m, broken in places')"
                        value={fieldData[m.key].observation}
                        onChange={(e) => setFieldData(prev => ({
                          ...prev,
                          [m.key]: { ...prev[m.key], observation: e.target.value }
                        }))}
                        aria-label={`Field observation for ${m.name}`}
                      />
                      {fieldData[m.key].observation && (
                        <p className="hidden print:block text-sm text-gray-600 italic mt-1 pl-3 border-l-2 border-blue-300">
                          Field note: {fieldData[m.key].observation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
            <h4 className="font-bold text-yellow-900 mb-2">📊 Data Quality</h4>
            <p className="text-sm text-yellow-800">
              This analysis is based on OpenStreetMap data contributed by local mappers. Some infrastructure may not yet be mapped. Satellite data is from Sentinel-2 (tree canopy), NASA POWER (temperature), and NASADEM (elevation). Traffic fatality data is from NHTSA FARS (US) and WHO Global Health Observatory (international).
            </p>
          </div>

          {/* Field verification explanation */}
          {fieldMode && hasAnyAdjustment && (
            <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
              <h4 className="font-bold text-blue-900 mb-2">📋 About Field Verification</h4>
              <p className="text-sm text-blue-800">
                This report includes field-verified scores adjusted through direct observation. Where a score was adjusted, both the original tool estimate and the field-verified value are shown. Field verification improves accuracy by capturing conditions that remote data cannot — such as sidewalk quality, signal timing, or temporary obstructions.
              </p>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, NASA POWER, NHTSA FARS, WHO | Page 2 of {totalPages}
          </div>
        </div>

        {/* Standards Analysis — uses resolved (field-verified) scores */}
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
                {[
                  { label: 'Safe Crossing Density (≤200m spacing)', key: 'crossingSafety' as MetricKey, threshold: 7 },
                  { label: 'Sidewalk Coverage', key: 'sidewalkCoverage' as MetricKey, threshold: 7 },
                  { label: 'Street Shading & Microclimate', key: 'treeCanopy' as MetricKey, threshold: 7 },
                  { label: 'Accessible Terrain (≤5% grade)', key: 'slope' as MetricKey, threshold: 7 },
                ].map(item => {
                  const val = resolveMetric(item.key);
                  return (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-gray-800">{item.label}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {val >= item.threshold ? 'Meets' : 'Partial'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GSDG */}
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Global Street Design Guide (GSDG)</h3>
              <p className="text-sm text-gray-600 mb-4">NACTO in collaboration with Global Designing Cities Initiative</p>
              <div className="space-y-3">
                {[
                  { label: 'Traffic Speed Safety (≤25mph urban)', key: 'speedExposure' as MetricKey, threshold: 7 },
                  { label: 'Urban Heat Management', key: 'thermalComfort' as MetricKey, threshold: 7 },
                  { label: 'Night Safety (Street Lighting)', key: 'nightSafety' as MetricKey, threshold: 7 },
                ].map(item => {
                  const val = resolveMetric(item.key);
                  return (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-gray-800">{item.label}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {val >= item.threshold ? 'Meets' : 'Partial'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ITDP */}
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Pedestrians First</h3>
              <p className="text-sm text-gray-600 mb-4">Institute for Transportation & Development Policy (ITDP)</p>
              <div className="space-y-3">
                {[
                  { label: 'Protected Pedestrian Crossings', key: 'crossingSafety' as MetricKey, threshold: 6 },
                  { label: '15-Minute City (Services Access)', key: 'destinationAccess' as MetricKey, threshold: 7 },
                  { label: 'Walking Comfort (Thermal)', key: 'thermalComfort' as MetricKey, threshold: 6 },
                  { label: 'Terrain Accessibility (≤5% grade)', key: 'slope' as MetricKey, threshold: 7 },
                ].map(item => {
                  const val = resolveMetric(item.key);
                  return (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-gray-800">{item.label}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {val >= item.threshold ? 'Meets' : 'Partial'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
            <h4 className="font-bold text-blue-900 mb-2">Overall Assessment:</h4>
            <p className="text-sm text-blue-800">
              This area demonstrates {displayScore >= 6 ? 'solid' : 'mixed'} fundamentals in environmental walkability, assessed against NACTO and ITDP principles. {displayScore < 6 ? 'Key areas for improvement include urban heat management and environmental comfort for pedestrians.' : 'The area meets most international standards for pedestrian environmental comfort.'}
            </p>
          </div>

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, NASA POWER, NHTSA FARS, WHO | Page {totalPages} of {totalPages}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .page-break-after {
            page-break-after: always;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
