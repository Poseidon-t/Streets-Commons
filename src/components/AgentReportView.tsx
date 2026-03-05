/**
 * Agent Report View — Branded walkability report for real estate agents.
 * Opened via /report/agent. Reads from sessionStorage.
 */

import { useEffect, useState, useMemo } from 'react';
import type { Location, WalkabilityMetrics, WalkabilityScoreV2, DataQuality, NeighborhoodIntelligence } from '../types';
import type { AgentProfile } from '../utils/clerkAccess';
import { recalculateScore, createEmptyFieldData, METRIC_KEYS } from '../utils/fieldVerificationScore';
import type { MetricKey, FieldData } from '../utils/fieldVerificationScore';
import WalkerInfographic from './WalkerInfographic';

interface PercentileData {
  overall: number;
  context: 'urban' | 'suburban' | 'rural';
  label: string;
}

interface MetricHealth {
  status: 'ok' | 'warning' | 'failed' | 'timeout' | 'unavailable' | 'pending';
  imageDate?: string | null;
  cloudCover?: number | null;
  peakRank?: number | null;
  ndvi?: number | null;
  epaScore?: number | null;
  altPct?: number | null;
  streetCount?: number;
  poiCount?: number;
}

interface ReportHealth {
  generatedAt: string;
  metricsAvailable: number;
  metricsTotal: number;
  metrics: Record<string, MetricHealth>;
  issues: string[];
  overallHealth: 'good' | 'fair' | 'poor';
}

interface GroundTruthGreenery {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  greenCharacter?: string | null;
  knownFeatures?: string[];
}

interface AgentReportData {
  location: Location;
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2;
  dataQuality?: DataQuality;
  neighborhoodIntel?: NeighborhoodIntelligence;
  agentProfile: AgentProfile;
  percentile?: PercentileData | null;
  reportHealth?: ReportHealth;
  groundTruthGreenery?: GroundTruthGreenery | null;
  treeCanopySource?: 'satellite' | 'satellite+knowledge';
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

const getMetricsConfig = (treeCanopySource?: string) => [
  { key: 'streetGrid', name: 'Street Grid', icon: '🔀', source: 'OpenStreetMap' },
  { key: 'treeCanopy', name: 'Tree Canopy', icon: '🌳', source: treeCanopySource === 'satellite+knowledge' ? 'Satellite + Web Research' : 'Sentinel-2' },
  { key: 'streetDesign', name: 'Street Design', icon: '🛣️', source: 'EPA Walkability Index' },
  { key: 'destinationAccess', name: 'Destinations', icon: '🏪', source: 'OpenStreetMap' },
  { key: 'commuteMode', name: 'Commute Mode', icon: '🚶', source: 'Census ACS' },
] as const;

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AgentReportView() {
  const [data, setData] = useState<AgentReportData | null>(null);
  const [fieldMode, setFieldMode] = useState(false);
  const [fieldData, setFieldData] = useState<FieldData>(createEmptyFieldData);
  const [verifierName, setVerifierName] = useState('');
  const [verificationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    // Try localStorage first (cross-tab from SalesPipeline), fall back to sessionStorage
    const stored = localStorage.getItem('agentReportData') || sessionStorage.getItem('agentReportData');
    if (stored) {
      try {
        setData(JSON.parse(stored));
        // Move to sessionStorage and clean up localStorage
        sessionStorage.setItem('agentReportData', stored);
        localStorage.removeItem('agentReportData');
      } catch {
        console.error('Failed to parse agent report data');
      }
    }
    // Check if we already have a share URL
    const storedShareUrl = localStorage.getItem('agentReportShareUrl') || sessionStorage.getItem('agentReportShareUrl');
    if (storedShareUrl) {
      setShareUrl(storedShareUrl);
      sessionStorage.setItem('agentReportShareUrl', storedShareUrl);
      localStorage.removeItem('agentReportShareUrl');
    }
  }, []);

  const handleRegenerate = async () => {
    if (!data || regenerating) return;
    setRegenerating(true);
    try {
      const resp = await fetch(`${API_URL}/api/regenerate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: data.location.lat,
          lon: data.location.lon,
          displayName: (data.location as { displayName?: string }).displayName || data.location.city || '',
          agentProfile: data.agentProfile,
        }),
      });
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const newData = await resp.json();
      setData(newData);
      sessionStorage.setItem('agentReportData', JSON.stringify(newData));
      // Clear stale share URL since data changed
      setShareUrl(null);
      sessionStorage.removeItem('agentReportShareUrl');
    } catch (err) {
      console.error('Regeneration failed:', err);
      alert('Report regeneration failed. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleShare = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(window.location.origin + shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      return;
    }
    if (!data) return;
    setShareLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: data }),
      });
      if (res.ok) {
        const { shareUrl: url } = await res.json();
        setShareUrl(url);
        sessionStorage.setItem('agentReportShareUrl', url);
        await navigator.clipboard.writeText(window.location.origin + url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      console.error('Failed to create share link');
    } finally {
      setShareLoading(false);
    }
  };

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

  const { location, metrics, compositeScore, dataQuality, agentProfile } = data;
  const brandAccent = agentProfile.brandColor || C.accent;
  const score = metrics.overallScore;
  const grade = compositeScore?.grade || (score >= 8 ? 'A' : score >= 6 ? 'B' : score >= 4 ? 'C' : score >= 2 ? 'D' : 'F');
  const gradeInfo = GRADE_CONFIG[grade] || GRADE_CONFIG.C;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Resolved scores (use field-verified values when available)
  const displayScore = fieldMode && fieldOverall ? fieldOverall.overallScore : score;
  const displayLabel = fieldMode && fieldOverall ? fieldOverall.label : gradeInfo.label;
  const displayGrade = displayScore >= 8 ? 'A' : displayScore >= 6 ? 'B' : displayScore >= 4 ? 'C' : displayScore >= 2 ? 'D' : 'F';
  const displayGradeInfo = GRADE_CONFIG[displayGrade] || GRADE_CONFIG.C;

  const metricsConfig = getMetricsConfig(data.treeCanopySource);

  const resolveMetric = (key: MetricKey): number =>
    fieldMode && fieldData[key].adjustedScore !== null
      ? fieldData[key].adjustedScore!
      : (metrics[key as keyof WalkabilityMetrics] as number ?? 0);

  const sortedMetrics = metricsConfig
    .map(m => ({ ...m, score: resolveMetric(m.key as MetricKey) }))
    .filter(m => m.score > 0) // Exclude metrics with no data
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
              onClick={handleShare}
              disabled={shareLoading}
              style={{
                padding: '0.5rem 1rem',
                background: shareCopied ? '#16a34a' : 'transparent',
                color: shareCopied ? 'white' : C.accent,
                fontWeight: 600,
                borderRadius: '0.5rem',
                border: shareCopied ? 'none' : `1.5px solid ${C.accent}`,
                cursor: shareLoading ? 'wait' : 'pointer',
                fontSize: '0.8125rem',
                transition: 'all 0.2s',
              }}
            >
              {shareCopied ? '✓ Link Copied!' : shareLoading ? 'Creating...' : shareUrl ? 'Copy Share Link' : 'Get Share Link'}
            </button>
            <button
              onClick={() => window.print()}
              style={{ padding: '0.5rem 1.25rem', background: C.accent, color: 'white', fontWeight: 600, borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Health Panel — admin-only, hidden in print */}
      {(data as AgentReportData & { reportHealth?: ReportHealth })?.reportHealth && (
        <div className="print:hidden" style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.75rem 3rem 0' }}>
          {(() => {
            const health = (data as AgentReportData & { reportHealth: ReportHealth }).reportHealth;
            const healthColor = health.overallHealth === 'good' ? '#16a34a' : health.overallHealth === 'fair' ? '#ca8a04' : '#dc2626';
            const healthBg = health.overallHealth === 'good' ? '#f0fdf4' : health.overallHealth === 'fair' ? '#fefce8' : '#fef2f2';
            const healthBorder = health.overallHealth === 'good' ? '#bbf7d0' : health.overallHealth === 'fair' ? '#fef08a' : '#fecaca';
            const statusIcon = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : s === 'timeout' || s === 'failed' ? '❌' : s === 'unavailable' ? '➖' : '⏳';
            return (
              <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', border: `1px solid ${healthBorder}`, background: healthBg, marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: health.issues.length > 0 ? '0.75rem' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: healthColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Report Health: {health.overallHealth}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: C.textLight }}>
                      {health.metricsAvailable}/{health.metricsTotal} metrics | Generated {new Date(health.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    style={{
                      padding: '0.375rem 0.875rem', background: regenerating ? '#e5e7eb' : C.accent, color: regenerating ? '#9ca3af' : 'white',
                      fontWeight: 600, borderRadius: '0.375rem', border: 'none', cursor: regenerating ? 'wait' : 'pointer', fontSize: '0.75rem',
                    }}
                  >
                    {regenerating ? 'Regenerating...' : 'Regenerate Report'}
                  </button>
                </div>
                {health.issues.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {health.issues.map((issue, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                        <span>⚠️</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
                {health.issues.length === 0 && (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {Object.entries(health.metrics).map(([key, m]) => (
                      <span key={key} style={{ fontSize: '0.6875rem', color: C.textMuted }}>
                        {statusIcon(m.status)} {key}
                        {m.imageDate ? ` (${m.imageDate})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Regenerate button for reports without health data (generated before this feature) */}
      {!(data as AgentReportData & { reportHealth?: ReportHealth })?.reportHealth && (
        <div className="print:hidden" style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.75rem 3rem 0' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: `1px solid #fef08a`, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
              ⚠️ This report was generated before health checks were added. Regenerate for validated data.
            </span>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                padding: '0.375rem 0.875rem', background: regenerating ? '#e5e7eb' : C.accent, color: regenerating ? '#9ca3af' : 'white',
                fontWeight: 600, borderRadius: '0.375rem', border: 'none', cursor: regenerating ? 'wait' : 'pointer', fontSize: '0.75rem',
              }}
            >
              {regenerating ? 'Regenerating...' : 'Regenerate Report'}
            </button>
          </div>
        </div>
      )}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: `2px solid ${brandAccent}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {agentProfile.logoBase64 && (
                <img src={agentProfile.logoBase64} alt={`${agentProfile.company || agentProfile.name} logo`} style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain' }} />
              )}
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: brandAccent }}>{agentProfile.name}</div>
                {agentProfile.title && <div style={{ fontSize: '0.875rem', color: C.textMuted, marginTop: '0.125rem' }}>{agentProfile.title}</div>}
                {agentProfile.company && <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginTop: '0.25rem' }}>{agentProfile.company}</div>}
              </div>
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
              {displayLabel}
            </div>
            {data.percentile && (
              <div style={{ marginTop: '1rem' }}>
                <span style={{ fontSize: '1rem', color: C.text, fontWeight: 500 }}>
                  Better than <strong style={{ fontSize: '1.25rem', color: brandAccent }}>{data.percentile.overall}%</strong> of {data.percentile.context === 'urban' ? 'urban' : data.percentile.context === 'suburban' ? 'suburban' : 'rural'} neighborhoods
                </span>
                <div style={{ fontSize: '0.6875rem', color: C.textLight, marginTop: '0.25rem' }}>
                  Based on urban walkability research benchmarks
                </div>
              </div>
            )}
          </div>

          {/* Walker Infographic */}
          <WalkerInfographic score={displayScore} inline />

          {/* Executive Summary */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Summary</h2>
            <p style={{ fontSize: '0.9375rem', color: C.textMuted, lineHeight: 1.7 }}>
              This property scores <strong style={{ color: C.text }}>{displayScore.toFixed(1)} out of 10</strong> for walkability, rated <strong style={{ color: displayGradeInfo.color }}>{displayLabel}</strong>. The analysis covers {sortedMetrics.length} walkability metrics plus neighborhood intelligence including transit, amenities, community health, and flood risk.{data.treeCanopySource === 'satellite+knowledge' ? ' Tree canopy is calibrated using satellite imagery and web research.' : ''}{fieldMode && hasAnyAdjustment && ' Scores have been adjusted based on ground observation.'}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {metricsConfig.filter(m => {
              const val = resolveMetric(m.key as MetricKey);
              return val > 0; // Hide metrics with no data (e.g. EPA timeout)
            }).map(m => {
              const key = m.key as MetricKey;
              const originalVal = (metrics[m.key as keyof WalkabilityMetrics] as number) ?? 0;
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

        {/* ═══════════ PAGE 3: NEIGHBORHOOD INTELLIGENCE ═══════════ */}
        <div className="page-break-after">
          {/* Ground Truth Greenery */}
          {data.groundTruthGreenery && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Tree Canopy & Greenery</h2>
              <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: C.bgWarm }}>
                {data.groundTruthGreenery.greenCharacter && (
                  <p style={{ fontSize: '0.875rem', color: C.textMuted, lineHeight: 1.7, marginBottom: '1rem' }}>{data.groundTruthGreenery.greenCharacter}</p>
                )}
                {data.groundTruthGreenery.knownFeatures && data.groundTruthGreenery.knownFeatures.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {data.groundTruthGreenery.knownFeatures.map((f, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', background: 'rgba(34,197,94,0.08)', color: '#16a34a', fontWeight: 500 }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '0.6875rem', color: C.textLight, marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.5rem' }}>
                  Satellite + Web Research ({data.groundTruthGreenery.confidence} confidence)
                </div>
              </div>
            </div>
          )}

          {/* Neighborhood Intelligence — Visual Sections */}
          {data.neighborhoodIntel && (() => {
            const ni = data.neighborhoodIntel!;
            const hasData = ni.commute || ni.transit || ni.parks || ni.food || ni.health || ni.flood;
            if (!hasData) return null;

            return (
              <div style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>Neighborhood Intelligence</h2>
                <p style={{ fontSize: '0.8125rem', color: C.textLight, marginBottom: '1rem' }}>Beyond the walkability score -- what daily life looks like here.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* How People Get Around */}
                  {(ni.commute || ni.transit) && (
                    <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '1.125rem' }}>🚶</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>How People Get Around</span>
                      </div>
                      {ni.commute && (() => {
                        const altPct = Math.round(ni.commute.walkPct + ni.commute.bikePct + ni.commute.transitPct);
                        const contextLine = altPct >= 30
                          ? `${altPct}% of residents walk, bike, or take transit -- car-optional.`
                          : altPct >= 15
                          ? `${altPct}% use alternatives to driving. Car ownership is still common.`
                          : `Most residents drive -- only ${altPct}% walk, bike, or take transit.`;
                        const drivePct = Math.max(0, 100 - ni.commute!.walkPct - ni.commute!.bikePct - ni.commute!.transitPct - ni.commute!.wfhPct - ni.commute!.carpoolPct);
                        const segments = [
                          { pct: ni.commute!.walkPct, color: '#22c55e', label: 'Walk' },
                          { pct: ni.commute!.bikePct, color: '#3b82f6', label: 'Bike' },
                          { pct: ni.commute!.transitPct, color: '#8b5cf6', label: 'Transit' },
                          { pct: ni.commute!.wfhPct, color: '#06b6d4', label: 'WFH' },
                          { pct: ni.commute!.carpoolPct, color: '#f59e0b', label: 'Carpool' },
                          { pct: drivePct, color: '#d1d5db', label: 'Drive' },
                        ].filter(s => s.pct > 0);
                        return (
                          <>
                            <p style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '0.75rem' }}>{contextLine}</p>
                            {/* Commute bar */}
                            <div style={{ display: 'flex', borderRadius: '9999px', overflow: 'hidden', height: '16px', background: '#f0ebe0', marginBottom: '0.5rem' }}>
                              {segments.map((seg, i) => (
                                <div key={i} style={{ width: `${Math.max(seg.pct, 1.5)}%`, height: '100%', background: seg.color }} title={`${seg.label}: ${seg.pct.toFixed(1)}%`} />
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                              {segments.filter(s => s.pct >= 1).map((seg, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                  <div style={{ height: '8px', width: '8px', borderRadius: '2px', background: seg.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.6875rem', color: C.textMuted }}>
                                    <strong style={{ color: C.text }}>{Math.round(seg.pct)}%</strong> {seg.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {ni.commute!.zeroCar > 0 && (
                              <div style={{ fontSize: '0.6875rem', color: C.textLight, marginTop: '0.5rem' }}>
                                {ni.commute!.zeroCar}% of households have zero cars
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {ni.transit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                          {ni.transit.railStops > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', background: 'rgba(139,92,246,0.1)', color: '#7c3aed', fontWeight: 600 }}>
                              🚇 {ni.transit.railStops} rail
                            </span>
                          )}
                          {ni.transit.busStops > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.1)', color: '#2563eb', fontWeight: 600 }}>
                              🚌 {ni.transit.busStops} bus stops
                            </span>
                          )}
                          {ni.transit.totalStops === 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>No transit nearby</span>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: '0.625rem', color: C.textLight, marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.375rem' }}>
                        {ni.commute ? 'Census ACS' : ''}{ni.commute && ni.transit ? ' · ' : ''}{ni.transit ? 'OpenStreetMap' : ''}
                      </div>
                    </div>
                  )}

                  {/* What's Nearby */}
                  {(ni.parks || ni.food) && (
                    <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.125rem' }}>📍</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>What's Nearby</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                        {ni.parks && (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', background: ni.parks.parks > 0 ? '#f8f6f1' : 'rgba(239,68,68,0.04)', border: ni.parks.parks > 0 ? 'none' : '1px dashed #e5ddd0', textAlign: 'center' }}>
                              <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🌳</span>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: ni.parks.parks > 0 ? C.text : '#c0b0a0' }}>{ni.parks.parks}</span>
                              <span style={{ fontSize: '0.5625rem', color: C.textLight }}>Parks</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', background: ni.parks.playgrounds > 0 ? '#f8f6f1' : 'rgba(239,68,68,0.04)', border: ni.parks.playgrounds > 0 ? 'none' : '1px dashed #e5ddd0', textAlign: 'center' }}>
                              <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🛝</span>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: ni.parks.playgrounds > 0 ? C.text : '#c0b0a0' }}>{ni.parks.playgrounds}</span>
                              <span style={{ fontSize: '0.5625rem', color: C.textLight }}>Playgrounds</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', background: ni.parks.gardens > 0 ? '#f8f6f1' : 'rgba(239,68,68,0.04)', border: ni.parks.gardens > 0 ? 'none' : '1px dashed #e5ddd0', textAlign: 'center' }}>
                              <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🌿</span>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: ni.parks.gardens > 0 ? C.text : '#c0b0a0' }}>{ni.parks.gardens}</span>
                              <span style={{ fontSize: '0.5625rem', color: C.textLight }}>Gardens</span>
                            </div>
                          </>
                        )}
                        {ni.food && (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', background: ni.food.supermarkets > 0 ? '#f8f6f1' : 'rgba(239,68,68,0.04)', border: ni.food.supermarkets > 0 ? 'none' : '1px dashed #e5ddd0', textAlign: 'center' }}>
                              <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🛒</span>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: ni.food.supermarkets > 0 ? C.text : '#c0b0a0' }}>{ni.food.supermarkets}</span>
                              <span style={{ fontSize: '0.5625rem', color: C.textLight }}>Supermarkets</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', background: ni.food.groceryStores > 0 ? '#f8f6f1' : 'rgba(239,68,68,0.04)', border: ni.food.groceryStores > 0 ? 'none' : '1px dashed #e5ddd0', textAlign: 'center' }}>
                              <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🥬</span>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: ni.food.groceryStores > 0 ? C.text : '#c0b0a0' }}>{ni.food.groceryStores}</span>
                              <span style={{ fontSize: '0.5625rem', color: C.textLight }}>Grocery</span>
                            </div>
                          </>
                        )}
                      </div>
                      {ni.food?.isFoodDesert && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.06)' }}>
                          <span style={{ fontSize: '0.8125rem' }}>⚠️</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#dc2626' }}>Food desert -- no supermarket within 800m</span>
                        </div>
                      )}
                      <div style={{ fontSize: '0.625rem', color: C.textLight, marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.375rem' }}>
                        OpenStreetMap · 1.2 km radius
                      </div>
                    </div>
                  )}

                  {/* Health & Environment */}
                  {(ni.health || ni.flood) && (
                    <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.125rem' }}>❤️</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>Health & Environment</span>
                      </div>
                      {ni.health && (
                        <div style={{ marginBottom: ni.flood ? '1rem' : 0 }}>
                          <div style={{ fontSize: '0.6875rem', color: C.textMuted, marginBottom: '0.75rem' }}>
                            Community health vs US average
                            <span style={{ display: 'inline-block', marginLeft: '0.5rem', height: '10px', width: '2px', borderRadius: '1px', background: C.textLight, verticalAlign: 'middle' }} />
                            <span style={{ fontSize: '0.625rem', marginLeft: '0.25rem', color: C.textLight }}>gray line = US avg</span>
                          </div>
                          {[
                            { label: 'Obesity', value: ni.health.obesity, usAvg: 32, max: 50 },
                            { label: 'Diabetes', value: ni.health.diabetes, usAvg: 11, max: 25 },
                            { label: 'Physical inactivity', value: ni.health.physicalInactivity, usAvg: 26, max: 45 },
                            { label: 'Asthma', value: ni.health.asthma, usAvg: 10, max: 20 },
                          ].filter(h => h.value !== null).map((h, i) => {
                            const isBetter = h.value! < h.usAvg;
                            const barColor = isBetter ? '#22c55e' : '#ef4444';
                            const barWidth = Math.min((h.value! / h.max) * 100, 100);
                            const avgPos = Math.min((h.usAvg / h.max) * 100, 100);
                            return (
                              <div key={i} style={{ marginBottom: '0.625rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: C.textMuted }}>{h.label}</span>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: barColor }}>{h.value}%</span>
                                </div>
                                <div style={{ position: 'relative', height: '10px', borderRadius: '5px', background: '#f0ebe0', overflow: 'visible' }}>
                                  <div style={{ height: '100%', borderRadius: '5px', width: `${Math.max(barWidth, 2)}%`, background: barColor }} />
                                  <div style={{ position: 'absolute', top: '-2px', left: `${avgPos}%`, height: '14px', width: '2px', borderRadius: '1px', background: C.textLight }} />
                                </div>
                                <div style={{ fontSize: '0.5625rem', color: isBetter ? '#22c55e' : '#ef4444', marginTop: '0.125rem' }}>
                                  {isBetter ? 'Better than' : 'Above'} US avg ({h.usAvg}%)
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {ni.flood && (() => {
                        const isHigh = ni.flood!.isHighRisk;
                        const isMinimal = ni.flood!.floodZone === 'X';
                        const fColor = isHigh ? '#ef4444' : isMinimal ? '#22c55e' : '#f59e0b';
                        const fBg = isHigh ? 'rgba(239,68,68,0.08)' : isMinimal ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.07)';
                        const fIcon = isHigh ? '🌊' : isMinimal ? '✓' : '⚠';
                        const fLabel = isHigh ? 'High Risk' : isMinimal ? 'Minimal Risk' : 'Moderate Risk';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: fBg }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '32px', borderRadius: '50%', background: `${fColor}20`, fontSize: '1rem', flexShrink: 0 }}>
                              {fIcon}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: fColor }}>{fLabel}</div>
                              <div style={{ fontSize: '0.6875rem', color: C.textMuted }}>FEMA Zone {ni.flood!.floodZone} · {ni.flood!.description}</div>
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{ fontSize: '0.625rem', color: C.textLight, marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.375rem' }}>
                        {ni.health ? 'CDC PLACES' : ''}{ni.health && ni.flood ? ' · ' : ''}{ni.flood ? 'FEMA NFHL' : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* About this report */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>About This Report</h2>
            <p style={{ fontSize: '0.8125rem', color: C.textMuted, lineHeight: 1.7 }}>
              This walkability assessment analyzes {sortedMetrics.length} walkability metrics and neighborhood intelligence using Sentinel-2 satellite imagery, OpenStreetMap, EPA National Walkability Index, US Census ACS, CDC PLACES, and FEMA flood data.{data.treeCanopySource === 'satellite+knowledge' ? ' Tree canopy is enhanced with web research for ground-truth calibration.' : ''} Metrics are scored 0-10 against international standards from NACTO, GSDG, and ITDP. View the interactive analysis at <strong>safestreets.streetsandcommons.com</strong>.
            </p>
          </div>

          {/* Agent Footer Card */}
          <div style={{ padding: '1.5rem', borderRadius: '1rem', border: `2px solid ${brandAccent}`, background: `${brandAccent}08` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {agentProfile.logoBase64 && (
                  <img src={agentProfile.logoBase64} alt="" style={{ maxHeight: '40px', maxWidth: '100px', objectFit: 'contain' }} />
                )}
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: brandAccent }}>{agentProfile.name}</div>
                  {agentProfile.title && <div style={{ fontSize: '0.8125rem', color: C.textMuted }}>{agentProfile.title}</div>}
                  {agentProfile.company && <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginTop: '0.125rem' }}>{agentProfile.company}</div>}
                </div>
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
