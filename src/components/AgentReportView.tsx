/**
 * Agent Report View — Branded walkability report for real estate agents.
 * Opened via /report/agent. Reads from sessionStorage.
 */

import { useEffect, useState, useMemo } from 'react';
import type { Location, WalkabilityMetrics, WalkabilityScoreV2, CrashData, DataQuality } from '../types';
import type { AgentProfile } from '../utils/clerkAccess';
import { recalculateScore, createEmptyFieldData, METRIC_KEYS } from '../utils/fieldVerificationScore';
import type { MetricKey, FieldData } from '../utils/fieldVerificationScore';
import WalkerInfographic from './WalkerInfographic';

interface AgentReportData {
  location: Location;
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2;
  dataQuality?: DataQuality;
  crashData?: CrashData;
  agentProfile: AgentProfile;
}

// Color palette
const C = {
  text: '#2a3a2a',
  textMuted: '#4a5a4a',
  textLight: '#8a9a8a',
  border: '#e0dbd0',
  bgWarm: '#faf8f4',
  accent: '#1e3a5f',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#ca8a04',
};

const GRADE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  A: { color: '#16a34a', bg: 'rgba(34,197,94,0.1)', label: 'Excellent' },
  B: { color: '#65a30d', bg: 'rgba(101,163,13,0.1)', label: 'Good' },
  C: { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)', label: 'Fair' },
  D: { color: '#ea580c', bg: 'rgba(234,88,12,0.1)', label: 'Poor' },
  F: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'Critical' },
};

const getScoreColor = (s: number) => {
  if (s >= 8) return C.green;
  if (s >= 6) return C.amber;
  if (s >= 4) return '#ea580c';
  return C.red;
};

const metricsConfig = [
  { key: 'crossingSafety', name: 'Crossing Safety', icon: '🚦', source: 'OpenStreetMap' },
  { key: 'speedExposure', name: 'Traffic Speed', icon: '🚗', source: 'OpenStreetMap' },
  { key: 'destinationAccess', name: 'Daily Needs', icon: '🏪', source: 'OpenStreetMap' },
  { key: 'nightSafety', name: 'Night Safety', icon: '💡', source: 'OpenStreetMap' },
  { key: 'slope', name: 'Flat Routes', icon: '⛰️', source: 'NASA SRTM' },
  { key: 'treeCanopy', name: 'Tree Canopy', icon: '🌳', source: 'Sentinel-2' },
  { key: 'thermalComfort', name: 'Thermal Comfort', icon: '🌡️', source: 'NASA POWER' },
] as const;

export default function AgentReportView() {
  const [data, setData] = useState<AgentReportData | null>(null);
  const [fieldMode, setFieldMode] = useState(false);
  const [fieldData, setFieldData] = useState<FieldData>(createEmptyFieldData);
  const [verifierName, setVerifierName] = useState('');
  const [verificationDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const stored = sessionStorage.getItem('agentReportData');
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        console.error('Failed to parse agent report data');
      }
    }
  }, []);

  // Field verification computed values (must be before early return)
  const fieldOverall = useMemo(() => {
    if (!data || !fieldMode) return null;
    return recalculateScore(data.metrics, fieldData);
  }, [fieldMode, data, fieldData]);

  const hasAnyAdjustment = METRIC_KEYS.some(k => fieldData[k].adjustedScore !== null);

  const handleAdjust = (key: MetricKey, delta: number) => {
    const current = fieldData[key].adjustedScore ?? (data?.metrics[key] as number ?? 5);
    const next = Math.min(10, Math.max(0, Math.round((current + delta) * 2) / 2));
    setFieldData(prev => ({ ...prev, [key]: { ...prev[key], adjustedScore: next } }));
  };

  const handleResetMetric = (key: MetricKey) => {
    setFieldData(prev => ({ ...prev, [key]: { ...prev[key], adjustedScore: null, observation: '' } }));
  };

  const handleResetAll = () => {
    setFieldData(createEmptyFieldData());
    setVerifierName('');
  };

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${C.bgWarm} 0%, #eef5f0 100%)` }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: C.text }}>No Report Data</h1>
          <p style={{ marginBottom: '1.5rem', color: C.textMuted }}>Please generate a report from the main analysis page.</p>
          <a href="/" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 600, color: 'white', backgroundColor: C.accent, textDecoration: 'none' }}>
            Go to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  const { location, metrics, compositeScore, dataQuality, crashData, agentProfile } = data;
  const score = metrics.overallScore;
  const grade = compositeScore?.grade || (score >= 8 ? 'A' : score >= 6 ? 'B' : score >= 4 ? 'C' : score >= 2 ? 'D' : 'F');
  const gradeInfo = GRADE_CONFIG[grade] || GRADE_CONFIG.C;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Resolved scores (use field-verified values when available)
  const displayScore = fieldMode && fieldOverall ? fieldOverall.overallScore : score;
  const displayLabel = fieldMode && fieldOverall ? fieldOverall.label : gradeInfo.label;
  const displayGrade = displayScore >= 8 ? 'A' : displayScore >= 6 ? 'B' : displayScore >= 4 ? 'C' : displayScore >= 2 ? 'D' : 'F';
  const displayGradeInfo = GRADE_CONFIG[displayGrade] || GRADE_CONFIG.C;

  const resolveMetric = (key: MetricKey): number =>
    fieldMode && fieldData[key].adjustedScore !== null
      ? fieldData[key].adjustedScore!
      : metrics[key] as number;

  const sortedMetrics = metricsConfig
    .filter(m => (metrics[m.key as keyof WalkabilityMetrics] as number) > 0)
    .map(m => ({ ...m, score: resolveMetric(m.key as MetricKey) }))
    .sort((a, b) => b.score - a.score);

  const strengths = sortedMetrics.filter(m => m.score >= 7).slice(0, 3);
  const concerns = sortedMetrics.filter(m => m.score < 5).slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Toolbar — hidden on print */}
      <div className="print:hidden" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href="/" style={{ fontSize: '0.875rem', color: C.accent, textDecoration: 'none' }}>&larr; Back to Analysis</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFieldMode(!fieldMode)}
              style={{
                padding: '0.5rem 1rem',
                background: fieldMode ? '#2563eb' : 'transparent',
                color: fieldMode ? 'white' : C.accent,
                fontWeight: 600,
                borderRadius: '0.5rem',
                border: fieldMode ? 'none' : `1.5px solid ${C.accent}`,
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              {fieldMode ? '✓ Field Verified' : 'Field Verify'}
            </button>
            {fieldMode && (
              <>
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={verifierName}
                  onChange={e => setVerifierName(e.target.value)}
                  style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem', border: `1px solid ${C.border}`, borderRadius: '0.375rem', width: '10rem' }}
                />
                {hasAnyAdjustment && (
                  <button
                    onClick={handleResetAll}
                    style={{ fontSize: '0.75rem', color: C.red, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Reset All
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => window.print()}
              style={{ padding: '0.5rem 1.25rem', background: C.accent, color: 'white', fontWeight: 600, borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '3rem' }}>

        {/* Field-Verified banner — only visible in print */}
        {fieldMode && hasAnyAdjustment && (
          <div className="hidden print:block" style={{ marginBottom: '1rem', padding: '0.625rem 1rem', background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '0.25rem', fontSize: '0.8125rem', color: '#1e40af' }}>
            <strong>Field-Verified Report</strong>
            {verifierName && <span> by {verifierName}</span>}
            <span> on {verificationDate}</span>
            <span style={{ marginLeft: '0.5rem', color: '#3b82f6' }}>| Scores adjusted based on ground observation</span>
          </div>
        )}

        {/* ═══════════ PAGE 1: COVER ═══════════ */}
        <div className="page-break-after">

          {/* Agent Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: `2px solid ${C.accent}` }}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: C.accent }}>{agentProfile.name}</div>
              {agentProfile.title && <div style={{ fontSize: '0.875rem', color: C.textMuted, marginTop: '0.125rem' }}>{agentProfile.title}</div>}
              {agentProfile.company && <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginTop: '0.25rem' }}>{agentProfile.company}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: C.textMuted }}>
              {agentProfile.phone && <div>{agentProfile.phone}</div>}
              {agentProfile.email && <div>{agentProfile.email}</div>}
              <div style={{ marginTop: '0.25rem', color: C.textLight }}>{today}</div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: C.textLight, marginBottom: '0.5rem' }}>Walkability Report</p>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {location.displayName}
            </h1>
          </div>

          {/* Score Hero */}
          <div style={{ background: `linear-gradient(135deg, ${C.bgWarm}, #f0f4f0)`, borderRadius: '1.5rem', padding: '3rem', textAlign: 'center', marginBottom: '2.5rem', border: `1px solid ${C.border}` }}>
            {fieldMode && hasAnyAdjustment && Math.abs(displayScore - score) > 0.05 && (
              <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: C.textMuted }}>
                <span>Tool Estimate: </span>
                <span style={{ fontWeight: 600, color: getScoreColor(score) }}>{score.toFixed(1)}</span>
                <span style={{ margin: '0 0.5rem', color: C.border }}>&rarr;</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>Field-Verified:</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '5rem', fontWeight: 700, color: getScoreColor(displayScore), lineHeight: 1 }}>{displayScore.toFixed(1)}</span>
              <span style={{ fontSize: '2.5rem', color: C.textLight, fontWeight: 300 }}>/10</span>
            </div>
            <div style={{ display: 'inline-block', padding: '0.375rem 1rem', borderRadius: '9999px', fontSize: '1rem', fontWeight: 600, color: displayGradeInfo.color, background: displayGradeInfo.bg }}>
              Grade {displayGrade} — {displayLabel}
            </div>
          </div>

          {/* Walker Infographic */}
          <WalkerInfographic score={displayScore} inline />

          {/* Executive Summary */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Summary</h2>
            <p style={{ fontSize: '0.9375rem', color: C.textMuted, lineHeight: 1.7 }}>
              This property scores <strong style={{ color: C.text }}>{displayScore.toFixed(1)} out of 10</strong> for walkability, rated <strong style={{ color: displayGradeInfo.color }}>{displayLabel}</strong>. The analysis covers {sortedMetrics.length} infrastructure and environmental metrics using OpenStreetMap data and NASA satellite imagery.{fieldMode && hasAnyAdjustment && ' Scores have been adjusted based on ground observation.'}
            </p>
          </div>

          {/* Strengths & Concerns */}
          {strengths.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: C.green, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Strengths</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {strengths.map(m => (
                  <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8125rem', background: 'rgba(34,197,94,0.08)', color: C.green, fontWeight: 500 }}>
                    {m.icon} {m.name} ({m.score.toFixed(1)})
                  </span>
                ))}
              </div>
            </div>
          )}
          {concerns.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Areas to Note</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {concerns.map(m => (
                  <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8125rem', background: 'rgba(202,138,4,0.08)', color: C.amber, fontWeight: 500 }}>
                    {m.icon} {m.name} ({m.score.toFixed(1)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ PAGE 2: DETAILED METRICS ═══════════ */}
        <div className="page-break-after">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Detailed Metrics</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {metricsConfig.filter(m => {
              const v = metrics[m.key as keyof WalkabilityMetrics] as number;
              return v > 0 || (fieldMode && fieldData[m.key as MetricKey].adjustedScore !== null);
            }).map(m => {
              const key = m.key as MetricKey;
              const originalVal = metrics[m.key as keyof WalkabilityMetrics] as number;
              const val = resolveMetric(key);
              const color = getScoreColor(val);
              const isAdjusted = fieldData[key].adjustedScore !== null;
              return (
                <div key={m.key} style={{ padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${isAdjusted && fieldMode ? '#93c5fd' : C.border}`, background: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.125rem' }}>{m.icon}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color }}>{val.toFixed(1)}</span>
                  </div>
                  {/* Score bar */}
                  <div style={{ height: '6px', borderRadius: '3px', background: '#f0ebe0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${val * 10}%`, borderRadius: '3px', background: color, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: C.textLight, marginTop: '0.375rem' }}>Source: {m.source}</div>

                  {/* Field verification controls */}
                  {fieldMode && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${C.border}` }}>
                      {/* Adjuster — hidden in print */}
                      <div className="print:hidden" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: C.textLight, width: '4.5rem' }}>Field Score:</span>
                        <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: '0.375rem', overflow: 'hidden' }}>
                          <button
                            onClick={() => handleAdjust(key, -0.5)}
                            style={{ padding: '0.25rem 0.625rem', fontSize: '0.875rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: C.text }}
                            aria-label={`Decrease ${m.name} score`}
                          >&minus;</button>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: '3rem',
                            textAlign: 'center',
                            borderLeft: `1px solid ${C.border}`,
                            borderRight: `1px solid ${C.border}`,
                            background: C.bgWarm,
                            color: getScoreColor(fieldData[key].adjustedScore ?? originalVal),
                          }}>
                            {(fieldData[key].adjustedScore ?? originalVal).toFixed(1)}
                          </span>
                          <button
                            onClick={() => handleAdjust(key, 0.5)}
                            style={{ padding: '0.25rem 0.625rem', fontSize: '0.875rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: C.text }}
                            aria-label={`Increase ${m.name} score`}
                          >+</button>
                        </div>
                        {isAdjusted && (
                          <button
                            onClick={() => handleResetMetric(key)}
                            style={{ fontSize: '0.6875rem', color: C.textLight, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >Reset</button>
                        )}
                      </div>

                      {/* Dual score — visible in print when adjusted */}
                      {isAdjusted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                          <div>
                            <span style={{ color: C.textLight, fontSize: '0.6875rem' }}>Tool: </span>
                            <span style={{ fontWeight: 600, color: getScoreColor(originalVal) }}>{originalVal.toFixed(1)}</span>
                          </div>
                          <span style={{ color: C.border }}>&rarr;</span>
                          <div>
                            <span style={{ color: '#2563eb', fontSize: '0.6875rem', fontWeight: 600 }}>Field-Verified: </span>
                            <span style={{ fontWeight: 700, color: getScoreColor(fieldData[key].adjustedScore!) }}>{fieldData[key].adjustedScore!.toFixed(1)}</span>
                          </div>
                        </div>
                      )}

                      {/* Observation notes — hidden in print, shown as text in print when present */}
                      <textarea
                        className="print:hidden"
                        rows={2}
                        placeholder="What did you observe on the ground?"
                        value={fieldData[key].observation}
                        onChange={e => setFieldData(prev => ({
                          ...prev,
                          [key]: { ...prev[key], observation: e.target.value },
                        }))}
                        style={{
                          width: '100%',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.75rem',
                          border: `1px solid ${C.border}`,
                          borderRadius: '0.375rem',
                          resize: 'none',
                          fontFamily: 'inherit',
                          color: C.text,
                        }}
                        aria-label={`Field observation for ${m.name}`}
                      />
                      {fieldData[key].observation && (
                        <p className="hidden print:block" style={{ fontSize: '0.75rem', color: C.textMuted, fontStyle: 'italic', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid #93c5fd' }}>
                          Field note: {fieldData[key].observation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Data Quality */}
          {dataQuality && (
            <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: C.bgWarm, fontSize: '0.75rem', color: C.textMuted }}>
              Data confidence: <strong style={{ color: C.text }}>{dataQuality.confidence.toUpperCase()}</strong>
              {' '}&mdash; {dataQuality.streetCount} streets, {dataQuality.sidewalkCount} sidewalks, {dataQuality.crossingCount} crossings, {dataQuality.poiCount} POIs analyzed
            </div>
          )}
        </div>

        {/* ═══════════ PAGE 3: CONTEXT + FOOTER ═══════════ */}
        <div>
          {/* Crash Data (if US) */}
          {crashData && crashData.type === 'local' && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Traffic Safety Context</h2>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: C.bgWarm }}>
                <p style={{ fontSize: '0.875rem', color: C.textMuted, lineHeight: 1.6 }}>
                  Within 800m of this address, NHTSA FARS data ({crashData.yearRange.from}–{crashData.yearRange.to}) recorded <strong style={{ color: C.text }}>{crashData.totalCrashes} fatal crash{crashData.totalCrashes !== 1 ? 'es' : ''}</strong> resulting in <strong style={{ color: C.text }}>{crashData.totalFatalities} fatalit{crashData.totalFatalities !== 1 ? 'ies' : 'y'}</strong>.
                  {crashData.nearestCrash && (
                    <> The nearest fatal crash was {Math.round(crashData.nearestCrash.distance)}m away on {crashData.nearestCrash.road || 'a nearby road'} ({crashData.nearestCrash.year}).</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* International crash context */}
          {crashData && crashData.type === 'country' && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Traffic Safety Context</h2>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: C.bgWarm }}>
                <p style={{ fontSize: '0.875rem', color: C.textMuted, lineHeight: 1.6 }}>
                  {crashData.countryName} has a road traffic death rate of <strong style={{ color: C.text }}>{crashData.deathRatePer100k.toFixed(1)} per 100,000</strong> (WHO, {crashData.year}).
                </p>
              </div>
            </div>
          )}

          {/* About this report */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>About This Report</h2>
            <p style={{ fontSize: '0.8125rem', color: C.textMuted, lineHeight: 1.7 }}>
              This walkability assessment analyzes {sortedMetrics.length} metrics using satellite imagery (Sentinel-2, NASA), OpenStreetMap infrastructure data, and elevation models. Metrics are scored 0–10 against international standards from NACTO, GSDG, and ITDP. View the interactive analysis at <strong>safestreets.streetsandcommons.com</strong>.
            </p>
          </div>

          {/* Agent Footer Card */}
          <div style={{ padding: '1.5rem', borderRadius: '1rem', border: `2px solid ${C.accent}`, background: 'rgba(30,58,95,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: C.accent }}>{agentProfile.name}</div>
                {agentProfile.title && <div style={{ fontSize: '0.8125rem', color: C.textMuted }}>{agentProfile.title}</div>}
                {agentProfile.company && <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginTop: '0.125rem' }}>{agentProfile.company}</div>}
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: C.textMuted }}>
                {agentProfile.phone && <div>{agentProfile.phone}</div>}
                {agentProfile.email && <div>{agentProfile.email}</div>}
              </div>
            </div>
          </div>

          {/* Watermark */}
          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.6875rem', color: C.textLight }}>
            Powered by SafeStreets &middot; safestreets.streetsandcommons.com
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        .hidden { display: none; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .hidden.print\\:block { display: block !important; }
          .page-break-after { page-break-after: always; }
          @page { margin: 0.75in; }
        }
      `}</style>
    </div>
  );
}
