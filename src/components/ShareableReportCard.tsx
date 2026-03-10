/**
 * Shareable Walkability Report Card
 * Generates a visually appealing card that users can download/share.
 * Uses html2canvas to convert a styled div into a PNG image.
 * Includes field verification: users can adjust scores based on ground observation.
 */

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../types';

interface ShareableReportCardProps {
  location: { displayName: string; lat: number; lon: number };
  metrics: WalkabilityMetrics;
  compositeScore: WalkabilityScoreV2 | null;
  isOpen: boolean;
  onClose: () => void;
}

// ---- helpers ----------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function getBarColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

// ---- display metric definitions ---------------------------------------------

interface DisplayMetric {
  key: string;
  label: string;
  icon: string;
  baseScore: number; // 0-10 scale
}

function buildDisplayMetrics(
  metrics: WalkabilityMetrics,
  compositeScore: WalkabilityScoreV2 | null,
): DisplayMetric[] {
  const result: DisplayMetric[] = [];

  // Street Grid — from OSM network topology (largest component: 35%)
  const networkScore = compositeScore
    ? compositeScore.components.networkDesign.score / 10
    : 0;
  if (networkScore > 0) {
    result.push({ key: 'streetGrid', label: 'Street Grid', icon: '🔀', baseScore: networkScore });
  }

  // Destinations — from OSM POIs
  if (metrics.destinationAccess > 0) {
    result.push({ key: 'destinationAccess', label: 'Destinations', icon: '🏪', baseScore: metrics.destinationAccess });
  }

  // Tree Cover — from Sentinel-2 NDVI
  if (metrics.treeCanopy > 0) {
    result.push({ key: 'treeCanopy', label: 'Tree Cover', icon: '🌳', baseScore: metrics.treeCanopy });
  }

  // Street Design — EPA (US only, shown when available)
  const sdScore = compositeScore
    ? compositeScore.components.safety.score / 10
    : 0;
  if (sdScore > 0) {
    result.push({ key: 'streetDesign', label: 'Street Design', icon: '🛣️', baseScore: sdScore });
  }

  // Commute Mode — Census ACS (US only, shown when available)
  const popMetric = compositeScore?.components.densityContext.metrics.find(
    m => m.name === 'Commute Mode' || m.name === 'Population Density',
  );
  const commuteScore = popMetric ? popMetric.score / 10 : 0;
  if (commuteScore > 0) {
    result.push({ key: 'commuteMode', label: 'Commute Mode', icon: '🚶', baseScore: commuteScore });
  }

  return result;
}

// ---- field verify state -----------------------------------------------------

type FieldAdjustments = Record<string, number | null>;

function createEmptyAdjustments(metrics: DisplayMetric[]): FieldAdjustments {
  const result: FieldAdjustments = {};
  for (const m of metrics) result[m.key] = null;
  return result;
}

/** Recalculate overall score (0–100) from adjusted metric scores. */
function recalcOverall(
  displayMetrics: DisplayMetric[],
  adjustments: FieldAdjustments,
  compositeScore: WalkabilityScoreV2 | null,
): number {
  if (displayMetrics.length === 0) return compositeScore?.overallScore ?? 0;

  // Use weights that mirror compositeScore.ts where possible
  const WEIGHTS: Record<string, number> = {
    streetGrid: 0.35,
    treeCanopy: 0.25,
    streetDesign: 0.15,
    destinationAccess: 0.25,
    commuteMode: 0.25,
  };

  let totalWeight = 0;
  let weightedSum = 0;
  for (const m of displayMetrics) {
    const score = (adjustments[m.key] ?? m.baseScore) * 10; // 0-100
    const w = WEIGHTS[m.key] ?? 1 / displayMetrics.length;
    totalWeight += w;
    weightedSum += score * w;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ---- component --------------------------------------------------------------

export default function ShareableReportCard({
  location,
  metrics,
  compositeScore,
  isOpen,
  onClose,
}: ShareableReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fieldMode, setFieldMode] = useState(false);

  const displayMetrics = buildDisplayMetrics(metrics, compositeScore);
  const [adjustments, setAdjustments] = useState<FieldAdjustments>(() =>
    createEmptyAdjustments(displayMetrics),
  );

  if (!isOpen) return null;

  const hasAnyAdjustment = Object.values(adjustments).some(v => v !== null);

  // Resolve display score
  const baseOverall = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);
  const overallScore = fieldMode && hasAnyAdjustment
    ? recalcOverall(displayMetrics, adjustments, compositeScore)
    : baseOverall;

  const displayScore = (overallScore / 10).toFixed(1);
  const scoreColor = getScoreColor(overallScore);
  const shortName = location.displayName.split(',').slice(0, 2).join(',').trim();

  const resolveScore = (key: string, base: number): number =>
    fieldMode && adjustments[key] !== null ? adjustments[key]! : base;

  const handleAdjust = (key: string, delta: number) => {
    const base = displayMetrics.find(m => m.key === key)?.baseScore ?? 5;
    const current = adjustments[key] ?? base;
    const next = Math.min(10, Math.max(0, Math.round((current + delta) * 2) / 2));
    setAdjustments(prev => ({ ...prev, [key]: next }));
  };

  const handleResetMetric = (key: string) => {
    setAdjustments(prev => ({ ...prev, [key]: null }));
  };

  const handleResetAll = () => {
    setAdjustments(createEmptyAdjustments(displayMetrics));
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `safestreets-${location.displayName.split(',')[0].toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Silently fail — user can screenshot instead
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `https://safestreets.streetsandcommons.com/?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.displayName)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShareTwitter = () => {
    const url = `https://safestreets.streetsandcommons.com/?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.displayName)}`;
    const text = `My street in ${shortName} scored ${displayScore}/10 for walkability. Check yours for free:`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
    );
  };

  const scoreLabel =
    overallScore >= 80 ? 'Highly Walkable' :
    overallScore >= 60 ? 'Moderately Walkable' :
    overallScore >= 40 ? 'Car-Dependent' :
    overallScore >= 20 ? 'Difficult to Walk' : 'Hostile to Pedestrians';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative my-8">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-lg font-bold mb-4" style={{ color: '#1a2a1a' }}>Share Your Walkability Score</h2>

        {/* The Card — captured as image */}
        <div
          ref={cardRef}
          style={{
            background: 'linear-gradient(135deg, #f8f6f1 0%, #eef5f0 50%, #f5f0e8 100%)',
            borderRadius: '16px',
            padding: '28px 24px 20px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: hasAnyAdjustment && fieldMode ? '8px' : '16px' }}>
            <img src="/logo.svg" alt="SafeStreets logo" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e07850' }}>SafeStreets</span>
          </div>

          {/* Field-Verified badge */}
          {fieldMode && hasAnyAdjustment && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '6px',
              backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
              marginBottom: '8px', fontSize: '10px', fontWeight: 600, color: '#2563eb',
            }}>
              &#x2713; Field-Verified
            </div>
          )}

          {/* Location */}
          <div style={{ fontSize: '14px', color: '#5a6a5a', marginBottom: '4px' }}>Walkability Score for</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a2a1a', marginBottom: '20px', lineHeight: 1.2 }}>
            {shortName}
          </div>

          {/* Score + Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" stroke="#e0dbd0" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="42"
                  stroke={scoreColor} strokeWidth="8" fill="none"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - overallScore / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{displayScore}</span>
                <span style={{ fontSize: '9px', color: '#8a9a8a' }}>out of 10</span>
              </div>
            </div>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: '8px',
              fontWeight: 700, fontSize: '16px', color: scoreColor,
              backgroundColor: `${scoreColor}15`,
            }}>
              {scoreLabel}
            </div>
          </div>

          {/* Walker Infographic */}
          <div style={{ padding: '8px 0', marginBottom: '6px', borderTop: '1px solid #e0dbd0', borderBottom: '1px solid #e0dbd0' }}>
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#8a9a8a', marginBottom: '6px' }}>
              Out of 10 walkers, how many feel safe?
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginBottom: '4px' }}>
              {Array.from({ length: Math.max(0, Math.min(10, Math.round(overallScore / 10))) }).map((_, i) => (
                <span key={`f-${i}`} style={{ fontSize: '16px' }}>🚶</span>
              ))}
              {Array.from({ length: 10 - Math.max(0, Math.min(10, Math.round(overallScore / 10))) }).map((_, i) => (
                <span key={`e-${i}`} style={{ fontSize: '16px', opacity: 0.2, filter: 'grayscale(1)' }}>🚶</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: scoreColor }}>
                {Math.max(0, Math.min(10, Math.round(overallScore / 10)))} feel comfortable
              </span>
              {10 - Math.max(0, Math.min(10, Math.round(overallScore / 10))) > 0 && (
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                  {10 - Math.max(0, Math.min(10, Math.round(overallScore / 10)))} don't feel safe
                </span>
              )}
            </div>
          </div>

          {/* All Metric Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {displayMetrics.map(({ key, label, icon, baseScore }) => {
              const score = resolveScore(key, baseScore);
              const isAdjusted = fieldMode && adjustments[key] !== null;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', width: '18px', textAlign: 'center' }}>{icon}</span>
                  <span style={{ fontSize: '11px', width: '82px', color: '#5a6a5a', fontWeight: 500, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '4px', backgroundColor: '#e0dbd0', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(score * 10, 100)}%`,
                      height: '100%', borderRadius: '4px',
                      backgroundColor: getBarColor(score),
                      transition: 'width 0.5s ease-out',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, width: '28px', textAlign: 'right',
                    color: isAdjusted ? '#2563eb' : '#1a2a1a',
                  }}>
                    {score.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer CTA */}
          <div style={{
            marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e0dbd0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '11px', color: '#8a9a8a' }}>safestreets.streetsandcommons.com</span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: '#e07850',
              padding: '3px 10px', borderRadius: '6px', border: '1px solid #e07850',
            }}>
              Check yours free
            </span>
          </div>
        </div>

        {/* Field Verification Controls — OUTSIDE cardRef, not captured in image */}
        <div className="mt-4 border rounded-xl p-4" style={{ borderColor: '#e0dbd0' }}>
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => setFieldMode(!fieldMode)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                fieldMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {fieldMode ? '✓ Field Verify ON' : '📋 Field Verify'}
            </button>
            {fieldMode && hasAnyAdjustment && (
              <button onClick={handleResetAll} className="text-xs text-red-500 hover:text-red-700 underline">
                Reset All
              </button>
            )}
          </div>

          {fieldMode && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500 mb-2">Adjust scores based on what you observed on the ground:</p>
              {displayMetrics.map(({ key, label, baseScore }) => {
                const current = adjustments[key] ?? baseScore;
                const isAdjusted = adjustments[key] !== null;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs w-24 text-gray-600 font-medium truncate">{label}</span>
                    <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: '#d0cbc0' }}>
                      <button
                        onClick={() => handleAdjust(key, -0.5)}
                        className="px-2 py-1 text-xs font-bold hover:bg-gray-100 transition"
                        aria-label={`Decrease ${label} score`}
                      >-</button>
                      <span
                        className="px-2 py-1 text-xs font-semibold tabular-nums min-w-[2.5rem] text-center border-x"
                        style={{ borderColor: '#d0cbc0', backgroundColor: '#faf8f5', color: isAdjusted ? '#2563eb' : '#1a2a1a' }}
                      >
                        {current.toFixed(1)}
                      </span>
                      <button
                        onClick={() => handleAdjust(key, 0.5)}
                        className="px-2 py-1 text-xs font-bold hover:bg-gray-100 transition"
                        aria-label={`Increase ${label} score`}
                      >+</button>
                    </div>
                    {isAdjusted && (
                      <button onClick={() => handleResetMetric(key)} className="text-[10px] text-gray-400 hover:text-gray-600 underline">
                        Reset
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all hover:shadow-md disabled:opacity-50"
            style={{ borderColor: '#e0dbd0' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#1a2a1a" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#1a2a1a' }}>
              {downloading ? 'Saving...' : 'Save Image'}
            </span>
          </button>

          <button
            onClick={handleShareTwitter}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all hover:shadow-md"
            style={{ borderColor: '#e0dbd0' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1a2a1a">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#1a2a1a' }}>Share on X</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all hover:shadow-md"
            style={{ borderColor: '#e0dbd0' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#1a2a1a" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#1a2a1a' }}>
              {copied ? 'Copied!' : 'Copy Link'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
