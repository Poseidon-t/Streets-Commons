/**
 * Shareable Walkability Report Card
 * Generates a visually appealing card that users can download/share.
 * Uses html2canvas to convert a styled div into a PNG image.
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

const METRIC_LABELS: { key: keyof WalkabilityMetrics; label: string; icon: string }[] = [
  { key: 'sidewalkCoverage', label: 'Sidewalks', icon: '🚶' },
  { key: 'crossingSafety', label: 'Crossings', icon: '🚦' },
  { key: 'speedExposure', label: 'Traffic Safety', icon: '🛡️' },
  { key: 'nightSafety', label: 'Lighting', icon: '💡' },
  { key: 'treeCanopy', label: 'Tree Cover', icon: '🌳' },
  { key: 'slope', label: 'Terrain', icon: '⛰️' },
  { key: 'thermalComfort', label: 'Temperature', icon: '🌡️' },
  { key: 'destinationAccess', label: 'Destinations', icon: '🏪' },
];

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

  if (!isOpen) return null;

  const overallScore = compositeScore?.overallScore ?? metrics.overallScore * 10;
  const displayScore = (overallScore / 10).toFixed(1);
  const grade = compositeScore?.grade || '';
  const scoreColor = getScoreColor(overallScore);
  const shortName = location.displayName.split(',').slice(0, 2).join(',').trim();

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
    const text = `My street in ${shortName} scored ${displayScore}/10 for walkability${grade ? ` (${grade})` : ''}. Check yours for free:`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

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

        <h2 className="text-lg font-bold mb-4" style={{ color: '#2a3a2a' }}>Share Your Walkability Score</h2>

        {/* The Card — this is what gets captured as an image */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg width="28" height="28" viewBox="0 0 44 44">
              <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850"/>
              <rect x="10" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="19" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="28" y="14" width="6" height="16" fill="white" rx="1"/>
            </svg>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e07850' }}>SafeStreets</span>
          </div>

          {/* Location */}
          <div style={{ fontSize: '14px', color: '#5a6a5a', marginBottom: '4px' }}>Walkability Score for</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2a3a2a', marginBottom: '20px', lineHeight: 1.2 }}>
            {shortName}
          </div>

          {/* Score Circle + Grade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            {/* Mini circular score */}
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
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{displayScore}</span>
                <span style={{ fontSize: '9px', color: '#8a9a8a' }}>out of 10</span>
              </div>
            </div>

            <div>
              {grade && (
                <div style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: 'white',
                  backgroundColor: scoreColor,
                  marginBottom: '4px',
                }}>
                  Grade: {grade}
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#5a6a5a', marginTop: '4px' }}>
                {overallScore >= 80 ? 'Highly Walkable' :
                 overallScore >= 60 ? 'Moderately Walkable' :
                 overallScore >= 40 ? 'Car-Dependent' :
                 overallScore >= 20 ? 'Difficult to Walk' : 'Hostile to Pedestrians'}
              </div>
            </div>
          </div>

          {/* Metric Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {METRIC_LABELS.map(({ key, label, icon }) => {
              const score = metrics[key] as number;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', width: '18px', textAlign: 'center' }}>{icon}</span>
                  <span style={{ fontSize: '11px', width: '80px', color: '#5a6a5a', fontWeight: 500 }}>{label}</span>
                  <div style={{
                    flex: 1, height: '8px', borderRadius: '4px',
                    backgroundColor: '#e0dbd0', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(score * 10, 100)}%`,
                      height: '100%', borderRadius: '4px',
                      backgroundColor: getBarColor(score),
                      transition: 'width 0.5s ease-out',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, width: '28px', textAlign: 'right', color: '#2a3a2a' }}>
                    {score.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer CTA */}
          <div style={{
            marginTop: '16px', paddingTop: '12px',
            borderTop: '1px solid #e0dbd0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '11px', color: '#8a9a8a' }}>safestreets.streetsandcommons.com</span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: '#e07850',
              padding: '3px 10px', borderRadius: '6px',
              border: '1px solid #e07850',
            }}>
              Check yours free
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all hover:shadow-md disabled:opacity-50"
            style={{ borderColor: '#e0dbd0' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#2a3a2a" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>
              {downloading ? 'Saving...' : 'Save Image'}
            </span>
          </button>

          <button
            onClick={handleShareTwitter}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all hover:shadow-md"
            style={{ borderColor: '#e0dbd0' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#2a3a2a">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>Share on X</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all hover:shadow-md"
            style={{ borderColor: '#e0dbd0' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#2a3a2a" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>
              {copied ? 'Copied!' : 'Copy Link'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
