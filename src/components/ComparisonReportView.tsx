/**
 * Comparison Report View — Side-by-side branded neighborhood comparison.
 * Opened via /report/comparison. Reads from sessionStorage key 'agentComparisonData'.
 */

import { useEffect, useState } from 'react';
import type { Location, WalkabilityMetrics, NeighborhoodIntelligence } from '../types';
import type { AgentProfile } from '../utils/clerkAccess';

interface PercentileData {
  overall: number;
  context: 'urban' | 'suburban' | 'rural';
  label: string;
}

interface SingleReportData {
  location: Location;
  metrics: WalkabilityMetrics;
  neighborhoodIntel?: NeighborhoodIntelligence;
  agentProfile: AgentProfile;
  percentile?: PercentileData | null;
}

interface NeighborhoodEntry {
  reportData: SingleReportData | null;
  status: 'success' | 'failed';
  error?: string;
  input: { neighborhood: string; city: string; state: string };
}

interface ComparisonData {
  type: 'comparison';
  neighborhoods: NeighborhoodEntry[];
  agentProfile: AgentProfile;
  generatedAt: string;
}

const C = {
  text: '#1a2a1a',
  textMuted: '#4a5a4a',
  textLight: '#8a9a8a',
  border: '#e0dbd0',
  bgWarm: '#faf8f4',
  accent: '#1e3a5f',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#ca8a04',
};

const getScoreColor = (s: number) => {
  if (s >= 8) return C.green;
  if (s >= 6) return C.amber;
  if (s >= 4) return '#ea580c';
  return C.red;
};

const GRADE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  A: { color: '#16a34a', bg: 'rgba(34,197,94,0.1)', label: 'Excellent' },
  B: { color: '#65a30d', bg: 'rgba(101,163,13,0.1)', label: 'Good' },
  C: { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)', label: 'Fair' },
  D: { color: '#ea580c', bg: 'rgba(234,88,12,0.1)', label: 'Poor' },
  F: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'Critical' },
};

const metricsConfig = [
  { key: 'streetGrid', name: 'Street Grid', icon: '🔀', source: 'OpenStreetMap' },
  { key: 'treeCanopy', name: 'Tree Canopy', icon: '🌳', source: 'Sentinel-2' },
  { key: 'streetDesign', name: 'Street Design', icon: '🛣️', source: 'EPA Walkability Index' },
  { key: 'destinationAccess', name: 'Destinations', icon: '🏪', source: 'OpenStreetMap' },
  { key: 'commuteMode', name: 'Commute Mode', icon: '🚶', source: 'Census ACS' },
] as const;

const API_URL = import.meta.env.VITE_API_URL || '';

// Estimated value premium per walkability score point (urban economics research range: $700–$3,250)
const VALUE_PER_POINT = 2000;

export default function ComparisonReportView() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('agentComparisonData') || sessionStorage.getItem('agentComparisonData');
    if (stored) {
      try {
        setData(JSON.parse(stored));
        sessionStorage.setItem('agentComparisonData', stored);
        localStorage.removeItem('agentComparisonData');
      } catch { /* ignore */ }
    }
    const storedUrl = localStorage.getItem('agentComparisonShareUrl') || sessionStorage.getItem('agentComparisonShareUrl');
    if (storedUrl) {
      setShareUrl(storedUrl);
      sessionStorage.setItem('agentComparisonShareUrl', storedUrl);
      localStorage.removeItem('agentComparisonShareUrl');
    }
  }, []);

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
        sessionStorage.setItem('agentComparisonShareUrl', url);
        await navigator.clipboard.writeText(window.location.origin + url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch { /* ignore */ } finally {
      setShareLoading(false);
    }
  };

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${C.bgWarm} 0%, #eef5f0 100%)` }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: C.text }}>No Comparison Data</h1>
          <p style={{ marginBottom: '1.5rem', color: C.textMuted }}>Please generate a comparison from the sales pipeline.</p>
          <a href="/" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 600, color: 'white', backgroundColor: C.accent, textDecoration: 'none' }}>Go to SafeStreets</a>
        </div>
      </div>
    );
  }

  const { agentProfile } = data;
  const brandAccent = agentProfile.brandColor || C.accent;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const successful = data.neighborhoods.filter(n => n.status === 'success' && n.reportData);
  const reports = successful.map(n => n.reportData!);
  const colCount = reports.length;

  // Find the winner (highest overall score)
  const scores = reports.map(r => r.metrics.overallScore);
  const maxScore = Math.max(...scores);
  const winnerIdx = scores.indexOf(maxScore);

  // Short location name (first part of displayName)
  const shortName = (r: SingleReportData) => {
    const parts = r.location.displayName.split(',');
    return parts[0]?.trim() || r.location.displayName;
  };

  const getGrade = (s: number) => s >= 8 ? 'A' : s >= 6 ? 'B' : s >= 4 ? 'C' : s >= 2 ? 'D' : 'F';

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Toolbar — hidden on print */}
      <div className="print:hidden" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <a href="/" style={{ fontSize: '0.875rem', color: brandAccent, textDecoration: 'none' }}>&larr; Back</a>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleShare}
              disabled={shareLoading}
              style={{ padding: '0.5rem 1rem', background: shareCopied ? '#16a34a' : 'transparent', color: shareCopied ? 'white' : brandAccent, fontWeight: 600, borderRadius: '0.5rem', border: shareCopied ? 'none' : `1.5px solid ${brandAccent}`, cursor: shareLoading ? 'wait' : 'pointer', fontSize: '0.8125rem' }}
            >
              {shareCopied ? '✓ Link Copied!' : shareLoading ? 'Creating...' : shareUrl ? 'Copy Share Link' : 'Get Share Link'}
            </button>
            <button
              onClick={() => window.print()}
              style={{ padding: '0.5rem 1.25rem', background: brandAccent, color: 'white', fontWeight: 600, borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '3rem' }}>

        {/* ═══════════ PAGE 1: COVER + SCORES ═══════════ */}
        <div className="page-break-after">

          {/* Agent Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: `2px solid ${brandAccent}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {agentProfile.logoBase64 && (
                <img src={agentProfile.logoBase64} alt="" style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain' }} />
              )}
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: brandAccent }}>{agentProfile.name}</div>
                {agentProfile.title && <div style={{ fontSize: '0.875rem', color: C.textMuted }}>{agentProfile.title}</div>}
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
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: C.textLight, marginBottom: '0.5rem' }}>Neighborhood Comparison</p>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
              {reports.map((r, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: C.textLight, fontWeight: 300 }}> vs. </span>}
                  {shortName(r)}
                </span>
              ))}
            </h1>
          </div>

          {/* Score Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: '1rem', marginBottom: '2rem' }}>
            {reports.map((r, i) => {
              const s = r.metrics.overallScore;
              const grade = getGrade(s);
              const gradeInfo = GRADE_CONFIG[grade];
              const isWinner = i === winnerIdx;
              return (
                <div key={i} style={{
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  background: isWinner ? `linear-gradient(135deg, ${C.bgWarm}, #f0f4f0)` : 'white',
                  border: isWinner ? `2px solid ${brandAccent}` : `1px solid ${C.border}`,
                  textAlign: 'center',
                  position: 'relative',
                }}>
                  {isWinner && (
                    <div style={{ position: 'absolute', top: '-0.625rem', left: '50%', transform: 'translateX(-50%)', background: brandAccent, color: 'white', fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.625rem', borderRadius: '9999px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Best Score
                    </div>
                  )}
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text, marginBottom: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shortName(r)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 700, color: getScoreColor(s), lineHeight: 1 }}>{s.toFixed(1)}</span>
                    <span style={{ fontSize: '1.25rem', color: C.textLight }}>/10</span>
                  </div>
                  <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8125rem', fontWeight: 600, color: gradeInfo.color, background: gradeInfo.bg }}>
                    {gradeInfo.label}
                  </div>
                  {r.percentile && (
                    <div style={{ marginTop: '0.625rem', fontSize: '0.75rem', color: C.textMuted }}>
                      Better than <strong style={{ color: brandAccent }}>{r.percentile.overall}%</strong> of {r.percentile.context} neighborhoods
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Winner Summary */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1rem', background: C.bgWarm, borderRadius: '0.75rem' }}>
            <p style={{ fontSize: '0.9375rem', color: C.text }}>
              <strong style={{ color: brandAccent }}>{shortName(reports[winnerIdx])}</strong> scores highest overall at{' '}
              <strong>{maxScore.toFixed(1)}/10</strong>
              {reports.length > 1 && scores[winnerIdx] - Math.min(...scores) > 0 && (
                <span style={{ color: C.textMuted }}>
                  {' '}— {(scores[winnerIdx] - Math.min(...scores)).toFixed(1)} points ahead of {shortName(reports[scores.indexOf(Math.min(...scores))])}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ═══════════ PAGE 2: METRIC COMPARISON GRID ═══════════ */}
        <div className="page-break-after">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>
            Metric-by-Metric Comparison
          </h2>

          {/* Comparison Table */}
          <div style={{ borderRadius: '0.75rem', border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: '2rem' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)`, background: C.bgWarm, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</div>
              {reports.map((r, i) => (
                <div key={i} style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: C.text, textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                  {shortName(r)}
                </div>
              ))}
            </div>
            {/* Metric rows — hide metrics where all neighborhoods scored 0 */}
            {(() => {
              const visibleMetrics = metricsConfig.filter(m =>
                reports.some(r => ((r.metrics[m.key as keyof WalkabilityMetrics] as number) ?? 0) > 0)
              );
              return visibleMetrics.map((m, mIdx) => {
              const metricScores = reports.map(r => (r.metrics[m.key as keyof WalkabilityMetrics] as number) ?? 0);
              const maxMetric = Math.max(...metricScores);
              return (
                <div key={m.key} style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)`, borderBottom: mIdx < visibleMetrics.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>{m.name}</div>
                      <div style={{ fontSize: '0.625rem', color: C.textLight }}>{m.source}</div>
                    </div>
                  </div>
                  {metricScores.map((score, i) => {
                    const isMetricWinner = score === maxMetric && metricScores.filter(s => s === maxMetric).length === 1;
                    return (
                      <div key={i} style={{ padding: '0.875rem 1rem', textAlign: 'center', borderLeft: `1px solid ${C.border}`, background: isMetricWinner ? 'rgba(34,197,94,0.04)' : 'transparent' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(score), marginBottom: '0.375rem' }}>
                          {score.toFixed(1)}
                          {isMetricWinner && <span style={{ fontSize: '0.6875rem', color: C.green, marginLeft: '0.25rem' }}>★</span>}
                        </div>
                        <div style={{ height: '4px', borderRadius: '2px', background: '#f0ebe0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${score * 10}%`, borderRadius: '2px', background: getScoreColor(score) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
            })()}
          </div>

          {/* Walkability Value Premium */}
          <div style={{ padding: '1.5rem', borderRadius: '1rem', background: `linear-gradient(135deg, ${C.bgWarm}, #f5f0e8)`, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: brandAccent, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estimated Walkability Value Premium
            </h3>
            <p style={{ fontSize: '0.8125rem', color: C.textMuted, marginBottom: '1rem', lineHeight: 1.6 }}>
              Research shows each walkability score point adds $700–$3,250 to home value (Brookings Institution, CEOs for Cities). Estimates below use the $2,000 midpoint.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: '1rem' }}>
              {reports.map((r, i) => {
                const premium = Math.round(r.metrics.overallScore * 10 * VALUE_PER_POINT);
                const minPremium = Math.min(...reports.map(rr => rr.metrics.overallScore * 10 * VALUE_PER_POINT));
                const delta = premium - minPremium;
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '0.75rem', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text, marginBottom: '0.5rem' }}>{shortName(r)}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: brandAccent }}>
                      +${premium.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: C.textLight }}>estimated premium</div>
                    {delta > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: C.green, fontWeight: 600 }}>
                        +${Math.round(delta).toLocaleString()} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════ PAGE 3: NEIGHBORHOOD INTEL + FOOTER ═══════════ */}
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>
            Neighborhood Intelligence
          </h2>

          {/* Transit/Parks/Food Comparison */}
          <div style={{ borderRadius: '0.75rem', border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)`, background: C.bgWarm, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: C.textLight, textTransform: 'uppercase' }}>Category</div>
              {reports.map((r, i) => (
                <div key={i} style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: C.text, textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                  {shortName(r)}
                </div>
              ))}
            </div>
            {/* Transit */}
            <div style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>🚌 Transit</div>
              {reports.map((r, i) => {
                const t = r.neighborhoodIntel?.transit;
                return (
                  <div key={i} style={{ padding: '0.75rem 1rem', textAlign: 'center', borderLeft: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.textMuted }}>
                    {t ? `${t.busStops} bus, ${t.railStops} rail` : 'No data'}
                  </div>
                );
              })}
            </div>
            {/* Parks */}
            <div style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>🌳 Parks</div>
              {reports.map((r, i) => {
                const p = r.neighborhoodIntel?.parks;
                return (
                  <div key={i} style={{ padding: '0.75rem 1rem', textAlign: 'center', borderLeft: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.textMuted }}>
                    {p ? `${p.totalGreenSpaces} green spaces` : 'No data'}
                  </div>
                );
              })}
            </div>
            {/* Food */}
            <div style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>🛒 Food Access</div>
              {reports.map((r, i) => {
                const f = r.neighborhoodIntel?.food;
                return (
                  <div key={i} style={{ padding: '0.75rem 1rem', textAlign: 'center', borderLeft: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.textMuted }}>
                    {f ? `${f.supermarkets} supermarkets, ${f.totalFoodStores} total` : 'No data'}
                  </div>
                );
              })}
            </div>
            {/* Street Design */}
            <div style={{ display: 'grid', gridTemplateColumns: `10rem repeat(${colCount}, 1fr)` }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>🛣️ Street Design</div>
              {reports.map((_r, i) => {
                return (
                  <div key={i} style={{ padding: '0.75rem 1rem', textAlign: 'center', borderLeft: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.textMuted }}>
                    EPA Walkability Index
                  </div>
                );
              })}
            </div>
          </div>

          {/* About */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${C.border}` }}>About This Report</h2>
            <p style={{ fontSize: '0.8125rem', color: C.textMuted, lineHeight: 1.7 }}>
              This comparison analyzes {colCount} neighborhoods across multiple walkability metrics using satellite imagery (Sentinel-2), OpenStreetMap infrastructure data, EPA National Walkability Index, and US Census ACS. Metrics are scored 0 to 10 against international standards. Value premium estimates are based on published research from Brookings Institution and CEOs for Cities.
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
          .page-break-after { page-break-after: always; }
          @page { margin: 0.75in; }
        }
      `}</style>
    </div>
  );
}
