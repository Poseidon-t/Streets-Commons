import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Location, WalkabilityMetrics, DataQuality, WalkabilityScoreV2 } from '../types';
import WalkerInfographic from './WalkerInfographic';

// ---- types ------------------------------------------------------------------

interface ResolvedMetric {
  key: string;
  name: string;
  icon: string;
  description: string;
  score: number;        // 0-10 base score
  adjusted: number;    // 0-10 field-verified or base
  isAdjusted: boolean;
}

type FieldAdjustments = Record<string, number | null>;

// ---- helpers ----------------------------------------------------------------

function getScoreColor(s: number) {
  if (s >= 8) return 'text-green-600';
  if (s >= 6) return 'text-amber-500';
  if (s >= 4) return 'text-orange-500';
  return 'text-red-500';
}

function getBarColor(s: number) {
  if (s >= 8) return 'bg-green-600';
  if (s >= 6) return 'bg-amber-500';
  if (s >= 4) return 'bg-orange-500';
  return 'bg-red-600';
}

function getHexColor(s: number) {
  if (s >= 8) return '#22c55e';
  if (s >= 6) return '#eab308';
  if (s >= 4) return '#f97316';
  return '#ef4444';
}

function letterLabel(s: number) {
  if (s >= 8) return 'Excellent';
  if (s >= 6) return 'Good';
  if (s >= 4) return 'Fair';
  if (s >= 2) return 'Poor';
  return 'Critical';
}

/** Build the list of metrics to show, pulling from compositeScore when available. */
function buildMetrics(
  metrics: WalkabilityMetrics,
  compositeScore: WalkabilityScoreV2 | null,
): { key: string; name: string; icon: string; description: string; score: number }[] {
  const list: { key: string; name: string; icon: string; description: string; score: number }[] = [];

  // 1. Street Grid — OSM network topology (35% of composite score)
  const networkScore = compositeScore
    ? compositeScore.components.networkDesign.score / 10
    : 0;
  if (networkScore > 0) {
    const nd = compositeScore!.components.networkDesign;
    const subDetails = nd.metrics
      .map(m => `${m.name}: ${(m.score / 10).toFixed(1)}${m.rawValue ? ` (${m.rawValue})` : ''}`)
      .join(' · ');
    list.push({
      key: 'streetGrid',
      name: 'Street Grid',
      icon: '🔀',
      description: `OpenStreetMap street topology — intersection density, block length, network density, dead-end ratio. ${subDetails}`,
      score: networkScore,
    });
  }

  // 2. Tree Canopy — Sentinel-2 NDVI
  if (metrics.treeCanopy > 0) {
    list.push({
      key: 'treeCanopy',
      name: 'Tree Canopy',
      icon: '🌳',
      description: 'Vegetation and shade measured from Sentinel-2 satellite NDVI at 10m resolution.',
      score: metrics.treeCanopy,
    });
  }

  // 3. Street Design — EPA (US only)
  const sdScore = compositeScore
    ? compositeScore.components.safety.score / 10
    : 0;
  if (sdScore > 0) {
    list.push({
      key: 'streetDesign',
      name: 'Street Design',
      icon: '🛣️',
      description: 'EPA National Walkability Index — intersection density, transit proximity, land use mix.',
      score: sdScore,
    });
  }

  // 4. Destinations — OSM POIs
  if (metrics.destinationAccess > 0) {
    list.push({
      key: 'destinationAccess',
      name: 'Destinations',
      icon: '🏪',
      description: 'Essential services within walking distance (OpenStreetMap amenities, 1.2 km radius).',
      score: metrics.destinationAccess,
    });
  }

  // 5. Commute Mode — Census ACS (US only)
  const commuteMetric = compositeScore?.components.densityContext.metrics.find(
    m => m.name === 'Commute Mode' || m.name === 'Population Density',
  );
  const commuteScore = commuteMetric ? commuteMetric.score / 10 : 0;
  if (commuteScore > 0) {
    list.push({
      key: 'commuteMode',
      name: 'Commute Mode',
      icon: '🚶',
      description: 'Share of residents who walk, bike, or take transit to work (US Census ACS).',
      score: commuteScore,
    });
  }

  return list;
}

/** Weighted recalculation of overall score (0-10) from field-adjusted metrics. */
function recalcOverall(
  metricList: { key: string; score: number }[],
  adjustments: FieldAdjustments,
): number {
  const WEIGHTS: Record<string, number> = {
    streetGrid: 0.35,
    treeCanopy: 0.25,
    streetDesign: 0.15,
    destinationAccess: 0.25,
    commuteMode: 0.25,
  };
  let totalWeight = 0;
  let weightedSum = 0;
  for (const m of metricList) {
    const val = adjustments[m.key] ?? m.score;
    const w = WEIGHTS[m.key] ?? 1 / metricList.length;
    totalWeight += w;
    weightedSum += val * w;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}

// ---- component --------------------------------------------------------------

export default function ReportView() {
  const [searchParams] = useSearchParams();
  const [reportData, setReportData] = useState<{
    location: Location;
    metrics: WalkabilityMetrics;
    dataQuality: DataQuality;
    compositeScore?: WalkabilityScoreV2 | null;
  } | null>(null);

  const [fieldMode, setFieldMode] = useState(false);
  const [adjustments, setAdjustments] = useState<FieldAdjustments>({});
  const [verifierName, setVerifierName] = useState('');
  const [verificationDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const dataStr = searchParams.get('data') || sessionStorage.getItem('reportData');
    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        setReportData(parsed);
        // Initialise adjustments with null for each metric (no overrides yet)
        const baseMetrics = buildMetrics(parsed.metrics, parsed.compositeScore ?? null);
        const init: FieldAdjustments = {};
        for (const m of baseMetrics) init[m.key] = null;
        setAdjustments(init);
      } catch (e) {
        console.error('Failed to parse report data:', e);
      }
    }
  }, [searchParams]);

  const metricList = useMemo(
    () => (reportData ? buildMetrics(reportData.metrics, reportData.compositeScore ?? null) : []),
    [reportData],
  );

  const hasAnyAdjustment = Object.values(adjustments).some(v => v !== null);

  const resolvedMetrics: ResolvedMetric[] = useMemo(
    () =>
      metricList.map(m => {
        const adj = adjustments[m.key] ?? null;
        return {
          ...m,
          adjusted: adj !== null ? adj : m.score,
          isAdjusted: adj !== null,
        };
      }),
    [metricList, adjustments],
  );

  // Overall display score
  const baseScore10 = reportData
    ? (reportData.compositeScore?.overallScore ?? reportData.metrics.overallScore * 10) / 10
    : 0;
  const displayScore = fieldMode && hasAnyAdjustment
    ? recalcOverall(metricList, adjustments)
    : baseScore10;
  const displayLabel = letterLabel(displayScore);
  const grade = reportData?.compositeScore?.grade ?? null;

  const handleAdjust = (key: string, delta: number, base: number) => {
    const current = adjustments[key] ?? base;
    const next = Math.min(10, Math.max(0, Math.round((current + delta) * 2) / 2));
    setAdjustments(prev => ({ ...prev, [key]: next }));
  };

  const handleResetMetric = (key: string) =>
    setAdjustments(prev => ({ ...prev, [key]: null }));

  const handleResetAll = () => {
    const reset: FieldAdjustments = {};
    for (const m of metricList) reset[m.key] = null;
    setAdjustments(reset);
    setVerifierName('');
  };

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

  const { location, compositeScore } = reportData;
  const totalPages = 3;

  const topMetrics = [...resolvedMetrics].sort((a, b) => b.adjusted - a.adjusted).slice(0, 2);
  const bottomMetrics = [...resolvedMetrics].sort((a, b) => a.adjusted - b.adjusted).slice(0, 2);

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFieldMode(!fieldMode)}
              className={`px-4 py-2 font-semibold rounded-lg transition-all text-sm ${
                fieldMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

        {/* Field-verified header (print) */}
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

          <h1 className="text-5xl font-bold text-gray-900 text-center mb-4">Walkability Assessment</h1>
          <h2 className="text-3xl text-gray-600 text-center mb-12">{location.displayName}</h2>

          {/* Score Hero */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 mb-12 text-center">
            {fieldMode && hasAnyAdjustment && Math.abs(displayScore - baseScore10) > 0.05 && (
              <div className="mb-4 text-sm text-gray-500">
                <span>Tool Estimate: </span>
                <span className={`font-semibold ${getScoreColor(baseScore10)}`}>{baseScore10.toFixed(1)}</span>
                <span className="mx-2 text-gray-300">→</span>
                <span className="font-semibold text-blue-600">Field-Verified:</span>
              </div>
            )}
            <div className="flex items-baseline justify-center gap-4 mb-4">
              <div className={`text-8xl font-bold ${getScoreColor(displayScore)}`}>{displayScore.toFixed(1)}</div>
              <div className="text-5xl text-gray-400 font-light">/10</div>
            </div>
            <div className={`text-3xl font-bold mb-2 ${getScoreColor(displayScore)}`}>{displayLabel}</div>
            {grade && <div className="text-xl text-gray-500">Grade: {grade}</div>}
          </div>

          {/* Walker Infographic */}
          <WalkerInfographic score={displayScore} />

          {/* Executive Summary */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">Executive Summary</h3>
            <p className="text-base text-gray-700 mb-4 leading-relaxed">
              This walkability assessment analyzes key factors that determine pedestrian experience and safety in {location.city || location.displayName}. The overall score of {displayScore.toFixed(1)}/10 indicates {displayLabel.toLowerCase()} conditions for pedestrians.
            </p>
            <p className="text-base text-gray-700 mb-6 leading-relaxed">
              Analysis is based on OpenStreetMap data, Sentinel-2 satellite imagery, and global walkability standards from NACTO, GSDG, and ITDP.
              {compositeScore && ` Data confidence: ${compositeScore.confidence}%.`}
              {fieldMode && hasAnyAdjustment && ' Some scores have been adjusted based on field observation.'}
            </p>

            <h4 className="text-xl font-bold text-gray-900 mb-4">Key Findings:</h4>
            <div className="space-y-3">
              {topMetrics.map(m => (
                <div key={m.key} className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
                  <p className="text-gray-800">
                    <span className="text-lg mr-2">✅</span>
                    <strong>{m.name} ({m.adjusted.toFixed(1)}/10):</strong> Strong performance supporting walkability.
                  </p>
                </div>
              ))}
              {bottomMetrics.map(m => (
                <div key={m.key} className="bg-gray-50 p-4 rounded-lg border-l-4 border-orange-500">
                  <p className="text-gray-800">
                    <span className="text-lg mr-2">⚠️</span>
                    <strong>{m.name} ({m.adjusted.toFixed(1)}/10):</strong> Significant opportunity for improvement.
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Score breakdown by component (V2) */}
          {compositeScore && (
            <div className="mb-12">
              <h4 className="text-xl font-bold text-gray-900 mb-4">Score Components</h4>
              <div className="space-y-3">
                {[
                  { label: 'Network Design', score: compositeScore.components.networkDesign.score, weight: compositeScore.components.networkDesign.weight },
                  { label: 'Environment', score: compositeScore.components.environmentalComfort.score, weight: compositeScore.components.environmentalComfort.weight },
                  { label: 'Street Design', score: compositeScore.components.safety.score, weight: compositeScore.components.safety.weight },
                  { label: 'Accessibility', score: compositeScore.components.densityContext.score, weight: compositeScore.components.densityContext.weight },
                ].filter(c => c.score > 0).map(c => (
                  <div key={c.label} className="flex items-center gap-4">
                    <span className="text-sm text-gray-700 w-36">{c.label}</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(c.score / 10)}`}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${getScoreColor(c.score / 10)}`}>
                      {(c.score / 10).toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400 w-12">{Math.round(c.weight * 100)}% wt.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, EPA, US Census ACS | Page 1 of {totalPages}
          </div>
        </div>

        {/* PAGE 2: Detailed Metrics */}
        <div className="page-break-after mt-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">What we measured</h2>
          <p className="text-base text-gray-700 mb-8">Key factors that determine how pleasant and safe it is to walk here:</p>

          <div className="space-y-6">
            {resolvedMetrics.map(m => {
              const filledDots = Math.round(m.adjusted);
              const metricColor = getBarColor(m.adjusted);
              const textColor = getScoreColor(m.adjusted);

              return (
                <div key={m.key} className="bg-gray-50 p-6 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="text-5xl">{m.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{m.name}</h3>
                      <div className="flex gap-1.5 mb-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className={`w-4 h-4 rounded-full ${i < filledDots ? metricColor : 'bg-gray-300'}`} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-600">{m.description}</p>
                    </div>
                    <div className={`text-3xl font-bold ${textColor}`}>
                      {m.adjusted.toFixed(1)}
                    </div>
                  </div>

                  {/* Field Verification Controls */}
                  {fieldMode && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="print:hidden flex items-center gap-4 mb-3 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 w-20">Field Score:</span>
                        <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: '#d0cbc0' }}>
                          <button
                            onClick={() => handleAdjust(m.key, -0.5, m.score)}
                            className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 transition"
                            aria-label={`Decrease ${m.name} score`}
                          >-</button>
                          <span
                            className="px-3 py-1.5 text-sm font-semibold tabular-nums min-w-[3.5rem] text-center border-x"
                            style={{ borderColor: '#d0cbc0', backgroundColor: '#faf8f5', color: getHexColor(adjustments[m.key] ?? m.score) }}
                          >
                            {(adjustments[m.key] ?? m.score).toFixed(1)}
                          </span>
                          <button
                            onClick={() => handleAdjust(m.key, 0.5, m.score)}
                            className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 transition"
                            aria-label={`Increase ${m.name} score`}
                          >+</button>
                        </div>
                        {m.isAdjusted && (
                          <button onClick={() => handleResetMetric(m.key)} className="text-xs text-gray-400 hover:text-gray-600 underline">Reset</button>
                        )}
                      </div>

                      {m.isAdjusted && (
                        <div className="flex items-center gap-4 mb-3 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Tool Estimate</span>
                            <span className={`ml-1.5 font-semibold ${getScoreColor(m.score)}`}>{m.score.toFixed(1)}</span>
                          </div>
                          <span className="text-gray-300">→</span>
                          <div>
                            <span className="text-blue-500 text-xs font-semibold">Field-Verified</span>
                            <span className="ml-1.5 font-bold" style={{ color: getHexColor(m.adjusted) }}>{m.adjusted.toFixed(1)}</span>
                          </div>
                        </div>
                      )}

                      <textarea
                        className="print:hidden w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        rows={2}
                        placeholder={`What did you observe? (e.g., 'Sidewalks present but narrow')`}
                        aria-label={`Field observation for ${m.name}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
            <h4 className="font-bold text-yellow-900 mb-2">📊 Data Quality</h4>
            <p className="text-sm text-yellow-800">
              Street Grid and Destinations use OpenStreetMap data contributed by local mappers — coverage varies by region. Tree Canopy uses Sentinel-2 satellite imagery (global). Street Design and Commute Mode use EPA National Walkability Index and US Census ACS (US addresses only).
              {compositeScore && ` Overall data confidence: ${compositeScore.confidence}%.`}
            </p>
          </div>

          {fieldMode && hasAnyAdjustment && (
            <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
              <h4 className="font-bold text-blue-900 mb-2">📋 About Field Verification</h4>
              <p className="text-sm text-blue-800">
                This report includes field-verified scores adjusted through direct observation. Where a score was adjusted, both the original tool estimate and the field-verified value are shown. Field verification improves accuracy by capturing conditions remote data cannot — sidewalk quality, signal timing, or temporary obstructions.
              </p>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, EPA, US Census ACS | Page 2 of {totalPages}
          </div>
        </div>

        {/* PAGE 3: Standards Comparison */}
        <div className="mt-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 pb-2 border-b-4 border-gray-200">How it measures up to global standards</h2>
          <p className="text-base text-gray-700 mb-8">Comparison against leading urban design frameworks for walkable cities:</p>

          <div className="space-y-6">
            {/* NACTO */}
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-1">NACTO Urban Street Design Guide</h3>
              <p className="text-sm text-gray-600 mb-4">National Association of City Transportation Officials</p>
              <div className="space-y-3">
                {[
                  { label: 'Street Network Connectivity', key: 'streetGrid', threshold: 7 },
                  { label: 'Street Shading & Microclimate', key: 'treeCanopy', threshold: 7 },
                  { label: 'Daily Needs Access', key: 'destinationAccess', threshold: 7 },
                ].map(item => {
                  const m = resolvedMetrics.find(r => r.key === item.key);
                  const val = m?.adjusted ?? 0;
                  if (!m) return null;
                  return (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-gray-800">{item.label}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {val >= item.threshold ? `Meets (${val.toFixed(1)})` : `Partial (${val.toFixed(1)})`}
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
                  { label: 'Pedestrian Network Density', key: 'streetGrid', threshold: 6 },
                  { label: 'Street Shading & Tree Coverage', key: 'treeCanopy', threshold: 7 },
                ].map(item => {
                  const m = resolvedMetrics.find(r => r.key === item.key);
                  const val = m?.adjusted ?? 0;
                  if (!m) return null;
                  return (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-gray-800">{item.label}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {val >= item.threshold ? `Meets (${val.toFixed(1)})` : `Partial (${val.toFixed(1)})`}
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
                  { label: 'Block Size & Intersection Density', key: 'streetGrid', threshold: 6 },
                  { label: '15-Minute City (Services Access)', key: 'destinationAccess', threshold: 7 },
                  { label: 'Tree Canopy & Shade', key: 'treeCanopy', threshold: 6 },
                ].map(item => {
                  const m = resolvedMetrics.find(r => r.key === item.key);
                  const val = m?.adjusted ?? 0;
                  if (!m) return null;
                  return (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-gray-800">{item.label}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {val >= item.threshold ? `Meets (${val.toFixed(1)})` : `Partial (${val.toFixed(1)})`}
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
              This area demonstrates {displayScore >= 6 ? 'solid' : 'mixed'} fundamentals across NACTO and ITDP walkability principles.
              {resolvedMetrics.find(m => m.key === 'streetGrid') && ` Street network connectivity scores ${resolvedMetrics.find(m => m.key === 'streetGrid')!.adjusted.toFixed(1)}/10 — ${resolvedMetrics.find(m => m.key === 'streetGrid')!.adjusted >= 6 ? 'meeting' : 'below'} the ITDP benchmark for block size and intersection density.`}
              {displayScore < 6 ? ' Key areas for improvement include street network design and environmental comfort for pedestrians.' : ' The area meets most international standards for pedestrian infrastructure.'}
            </p>
          </div>

          <div className="text-center text-sm text-gray-500 mt-12">
            Generated by SafeStreets | Data sources: OpenStreetMap, Sentinel-2, EPA, US Census ACS | Page {totalPages} of {totalPages}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .page-break-after { page-break-after: always; }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
