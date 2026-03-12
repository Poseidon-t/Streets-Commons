import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Location, WalkabilityMetrics, DataQuality, WalkabilityScoreV2 } from '../types';
import WalkerInfographic from './WalkerInfographic';
import StreetPortrait from './StreetPortrait';

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
type Tab = 'overview' | 'metrics' | 'standards';

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

// ---- sub-components ---------------------------------------------------------

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'standards', label: 'Standards' },
  ];
  return (
    <div className="print:hidden flex gap-1 bg-gray-100 rounded-lg p-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            active === t.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
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

  const [activeTab, setActiveTab] = useState<Tab>('overview');
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
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#1a2a1a' }}>No Report Data</h1>
          <p className="mb-6" style={{ color: '#5a6a5a' }}>Please generate a report from the main analysis page.</p>
          <a href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg" style={{ backgroundColor: '#e07850' }}>
            Go to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  const { location, compositeScore } = reportData;

  const topMetrics = [...resolvedMetrics].sort((a, b) => b.adjusted - a.adjusted).slice(0, 2);
  const bottomMetrics = [...resolvedMetrics].sort((a, b) => a.adjusted - b.adjusted).slice(0, 2);

  const components = compositeScore ? [
    { label: 'Network Design', score: compositeScore.components.networkDesign.score, weight: compositeScore.components.networkDesign.weight },
    { label: 'Environment', score: compositeScore.components.environmentalComfort.score, weight: compositeScore.components.environmentalComfort.weight },
    { label: 'Street Design', score: compositeScore.components.safety.score, weight: compositeScore.components.safety.weight },
    { label: 'Accessibility', score: compositeScore.components.densityContext.score, weight: compositeScore.components.densityContext.weight },
  ].filter(c => c.score > 0) : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <TabBar active={activeTab} onChange={setActiveTab} />
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-all text-sm flex-shrink-0"
          >
            Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Field-verified header (print only) */}
        {fieldMode && hasAnyAdjustment && (
          <div className="hidden print:block mb-6 p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
            <strong>Field-Verified Report</strong>
            {verifierName && <span> by {verifierName}</span>}
            <span> on {verificationDate}</span>
          </div>
        )}

        {/* Location header — always visible */}
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">SafeStreets · Walkability Assessment</p>
          <h1 className="text-2xl font-bold text-gray-900">{location.displayName}</h1>
        </div>

        {/* ── TAB: OVERVIEW ─────────────────────────────────────────────────── */}
        <div className={activeTab === 'overview' ? 'block' : 'hidden print:block'}>

          {/* Score hero — compact */}
          <div className="flex items-center gap-6 mb-8 p-6 bg-gray-50 rounded-2xl">
            <div className="text-center">
              <div className={`text-6xl font-bold leading-none ${getScoreColor(displayScore)}`}>
                {displayScore.toFixed(1)}
              </div>
              <div className="text-sm text-gray-400 mt-1">/10</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(displayScore)}`}>{displayLabel}</div>
              {grade && <div className="text-sm text-gray-500 mt-0.5">Grade {grade}</div>}
              {compositeScore && (
                <div className="text-xs text-gray-400 mt-1">Data confidence {compositeScore.confidence}%</div>
              )}
              {fieldMode && hasAnyAdjustment && Math.abs(displayScore - baseScore10) > 0.05 && (
                <div className="text-xs text-blue-500 mt-1">
                  Field-verified (was {baseScore10.toFixed(1)})
                </div>
              )}
            </div>
          </div>

          {/* Walker infographic */}
          <div className="mb-8">
            <WalkerInfographic score={displayScore} />
          </div>

          {/* Street Portrait */}
          <div className="mb-8">
            <StreetPortrait score={displayScore} locationName={location?.name} />
          </div>

          {/* Key findings — 2 col grid */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-3">Key Findings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topMetrics.map(m => (
                <div key={m.key} className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                  <span className="text-green-500 text-lg mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{m.name}</div>
                    <div className={`text-lg font-bold ${getScoreColor(m.adjusted)}`}>{m.adjusted.toFixed(1)}/10</div>
                  </div>
                </div>
              ))}
              {bottomMetrics.map(m => (
                <div key={m.key} className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <span className="text-orange-400 text-lg mt-0.5">↑</span>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{m.name}</div>
                    <div className={`text-lg font-bold ${getScoreColor(m.adjusted)}`}>{m.adjusted.toFixed(1)}/10</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score components — 2x2 grid */}
          {components.length > 0 && (
            <div className="mb-8">
              <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-3">Score Components</h2>
              <div className="grid grid-cols-2 gap-3">
                {components.map(c => (
                  <div key={c.label} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-sm font-medium text-gray-700">{c.label}</span>
                      <span className={`text-base font-bold ${getScoreColor(c.score / 10)}`}>
                        {(c.score / 10).toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(c.score / 10)}`}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{Math.round(c.weight * 100)}% weight</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary prose — collapsed to essentials */}
          <div className="text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-6">
            Analysis based on OpenStreetMap, Sentinel-2 satellite imagery, EPA, and US Census ACS.
            {fieldMode && hasAnyAdjustment && ' Some scores adjusted from field observation.'}
          </div>
        </div>

        {/* ── TAB: METRICS ──────────────────────────────────────────────────── */}
        <div className={activeTab === 'metrics' ? 'block' : 'hidden print:block'}>
          <div className="print:hidden flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">What we measured</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFieldMode(!fieldMode)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition-all text-sm ${
                  fieldMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {fieldMode ? '✓ Field Verify ON' : 'Field Verify'}
              </button>
              {fieldMode && (
                <>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={verifierName}
                    onChange={(e) => setVerifierName(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-36"
                  />
                  {hasAnyAdjustment && (
                    <button onClick={handleResetAll} className="text-xs text-red-500 hover:text-red-700 underline">
                      Reset All
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="print:block hidden mb-4">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-gray-200 pb-2">What we measured</h2>
          </div>

          <div className="space-y-4">
            {resolvedMetrics.map(m => {
              const filledDots = Math.round(m.adjusted);
              const metricColor = getBarColor(m.adjusted);
              const textColor = getScoreColor(m.adjusted);

              return (
                <div key={m.key} className="bg-gray-50 p-5 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{m.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <h3 className="text-base font-bold text-gray-900">{m.name}</h3>
                        <div className={`text-xl font-bold flex-shrink-0 ${textColor}`}>
                          {m.adjusted.toFixed(1)}
                        </div>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className={`w-3.5 h-3.5 rounded-full ${i < filledDots ? metricColor : 'bg-gray-300'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{m.description}</p>
                    </div>
                  </div>

                  {/* Field Verification Controls */}
                  {fieldMode && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="print:hidden flex items-center gap-4 mb-3 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">Field Score:</span>
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
                        <div className="flex items-center gap-3 mb-3 text-sm">
                          <span className="text-gray-400 text-xs">Tool: <span className={`font-semibold ${getScoreColor(m.score)}`}>{m.score.toFixed(1)}</span></span>
                          <span className="text-gray-300">→</span>
                          <span className="text-blue-500 text-xs font-semibold">Field: <span className="font-bold" style={{ color: getHexColor(m.adjusted) }}>{m.adjusted.toFixed(1)}</span></span>
                        </div>
                      )}

                      <textarea
                        className="print:hidden w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        rows={2}
                        placeholder={`Observations (e.g., 'Sidewalks present but narrow')`}
                        aria-label={`Field observation for ${m.name}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Data quality:</strong> Street Grid and Destinations use OpenStreetMap (coverage varies). Tree Canopy uses Sentinel-2 satellite imagery (global). Street Design and Commute Mode use EPA + US Census ACS (US only).
              {compositeScore && ` Confidence: ${compositeScore.confidence}%.`}
            </p>
          </div>
        </div>

        {/* ── TAB: STANDARDS ────────────────────────────────────────────────── */}
        <div className={activeTab === 'standards' ? 'block' : 'hidden print:block'}>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Global Standards Comparison</h2>
            <p className="text-sm text-gray-500">How this neighborhood measures up against leading urban design frameworks.</p>
          </div>

          <div className="space-y-5">
            {/* NACTO */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="font-semibold text-gray-900 text-sm">NACTO Urban Street Design Guide</div>
                <div className="text-xs text-gray-500">National Association of City Transportation Officials</div>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Street Network Connectivity', key: 'streetGrid', threshold: 7 },
                  { label: 'Street Shading & Microclimate', key: 'treeCanopy', threshold: 7 },
                  { label: 'Daily Needs Access', key: 'destinationAccess', threshold: 7 },
                ].map(item => {
                  const m = resolvedMetrics.find(r => r.key === item.key);
                  const val = m?.adjusted ?? 0;
                  if (!m) return null;
                  return (
                    <div key={item.label} className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {val >= item.threshold ? `Meets · ${val.toFixed(1)}` : `Partial · ${val.toFixed(1)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GSDG */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="font-semibold text-gray-900 text-sm">Global Street Design Guide (GSDG)</div>
                <div className="text-xs text-gray-500">NACTO & Global Designing Cities Initiative</div>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Pedestrian Network Density', key: 'streetGrid', threshold: 6 },
                  { label: 'Street Shading & Tree Coverage', key: 'treeCanopy', threshold: 7 },
                ].map(item => {
                  const m = resolvedMetrics.find(r => r.key === item.key);
                  const val = m?.adjusted ?? 0;
                  if (!m) return null;
                  return (
                    <div key={item.label} className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {val >= item.threshold ? `Meets · ${val.toFixed(1)}` : `Partial · ${val.toFixed(1)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ITDP */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="font-semibold text-gray-900 text-sm">Pedestrians First</div>
                <div className="text-xs text-gray-500">Institute for Transportation & Development Policy (ITDP)</div>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Block Size & Intersection Density', key: 'streetGrid', threshold: 6 },
                  { label: '15-Minute City (Services Access)', key: 'destinationAccess', threshold: 7 },
                  { label: 'Tree Canopy & Shade', key: 'treeCanopy', threshold: 6 },
                ].map(item => {
                  const m = resolvedMetrics.find(r => r.key === item.key);
                  const val = m?.adjusted ?? 0;
                  if (!m) return null;
                  return (
                    <div key={item.label} className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${val >= item.threshold ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {val >= item.threshold ? `Meets · ${val.toFixed(1)}` : `Partial · ${val.toFixed(1)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-600 leading-relaxed">
            {displayScore >= 6
              ? `This area meets most international standards for pedestrian infrastructure.`
              : `Key areas for improvement include street network design and environmental comfort.`}
            {resolvedMetrics.find(m => m.key === 'streetGrid') && ` Street network scores ${resolvedMetrics.find(m => m.key === 'streetGrid')!.adjusted.toFixed(1)}/10 — ${resolvedMetrics.find(m => m.key === 'streetGrid')!.adjusted >= 6 ? 'meeting' : 'below'} the ITDP block-size benchmark.`}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          SafeStreets · OpenStreetMap, Sentinel-2, EPA, US Census ACS
        </div>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
