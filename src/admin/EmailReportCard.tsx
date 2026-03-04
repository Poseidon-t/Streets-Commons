/**
 * EmailReportCard -- Renders a mobile-sized branded report card image
 * for embedding in sales outreach emails. Uses html2canvas to capture
 * a styled div as a PNG. Triggered from the SalesPipeline.
 */

import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';

interface ReportData {
  location: { displayName: string; lat: number; lon: number };
  scores: {
    treeCanopy: number;
    streetDesign: number;
    destinationAccess: number;
    commuteMode: number;
    streetGrid: number;
    overallScore: number;
    label: string;
  };
  groundTruthGreenery?: {
    score: number;
    confidence: string;
    greenCharacter?: string | null;
    knownFeatures?: string[];
  } | null;
  treeCanopySource?: string;
  neighborhoodIntel?: {
    commute?: { walkPct: number; bikePct: number; transitPct: number; wfhPct: number; carpoolPct: number; zeroCar: number } | null;
    transit?: { railStations: number; busStops: number; totalStops: number } | null;
    parks?: { parks: number; playgrounds: number; gardens: number; totalGreenSpaces: number } | null;
    food?: { supermarkets: number; groceryStores: number; isFoodDesert: boolean } | null;
    health?: { obesity: number | null; diabetes: number | null; physicalInactivity: number | null; asthma: number | null } | null;
    flood?: { floodZone: string; isHighRisk: boolean; description: string } | null;
  } | null;
  agentProfile: { name: string; company?: string; email?: string; phone?: string; title?: string };
  percentile?: { overall: number; context: string } | null;
}

function getScoreColor(s: number): string {
  if (s >= 8) return '#22c55e';
  if (s >= 6) return '#84cc16';
  if (s >= 4) return '#eab308';
  if (s >= 2) return '#f97316';
  return '#ef4444';
}

function getGradeLabel(s: number): string {
  if (s >= 8) return 'Highly Walkable';
  if (s >= 6) return 'Moderately Walkable';
  if (s >= 4) return 'Car-Dependent';
  if (s >= 2) return 'Difficult to Walk';
  return 'Hostile to Pedestrians';
}

interface EmailReportCardProps {
  reportData: ReportData | null;
  isOpen: boolean;
  onClose: () => void;
  leadName: string;
}

export default function EmailReportCard({ reportData, isOpen, onClose, leadName }: EmailReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDownloading(false);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !reportData) return null;

  const { scores, location, agentProfile, neighborhoodIntel: ni, groundTruthGreenery: gt, percentile } = reportData;
  const overall = scores.overallScore;
  const scoreColor = getScoreColor(overall);
  const shortName = location.displayName.split(',').slice(0, 2).join(',').trim();

  const metrics = [
    { key: 'treeCanopy', label: 'Tree Canopy', icon: '🌳', score: scores.treeCanopy },
    { key: 'streetDesign', label: 'Street Design', icon: '🛣️', score: scores.streetDesign },
    { key: 'destinationAccess', label: 'Destinations', icon: '🏪', score: scores.destinationAccess },
    { key: 'commuteMode', label: 'Commute Mode', icon: '🚶', score: scores.commuteMode },
  ].filter(m => m.score > 0);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      const slug = location.displayName.split(',')[0].toLowerCase().replace(/\s+/g, '-');
      link.download = `walkability-${slug}-${leadName.split(' ')[0].toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // fallback
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }, 'image/png');
    } catch {
      // Clipboard API may not be available
    }
  };

  // Commute segments
  const commuteSegments = ni?.commute ? [
    { pct: ni.commute.walkPct, color: '#22c55e', label: 'Walk' },
    { pct: ni.commute.bikePct, color: '#3b82f6', label: 'Bike' },
    { pct: ni.commute.transitPct, color: '#8b5cf6', label: 'Transit' },
    { pct: ni.commute.wfhPct, color: '#06b6d4', label: 'WFH' },
    { pct: ni.commute.carpoolPct, color: '#f59e0b', label: 'Carpool' },
    { pct: Math.max(0, 100 - ni.commute.walkPct - ni.commute.bikePct - ni.commute.transitPct - ni.commute.wfhPct - ni.commute.carpoolPct), color: '#d1d5db', label: 'Drive' },
  ].filter(s => s.pct > 0) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 relative my-8">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >x</button>

        <h2 className="text-lg font-bold mb-1" style={{ color: '#2a3a2a' }}>
          Email Image for {leadName}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Download this card and attach to your outreach email.
        </p>

        {/* ===== THE CARD -- captured as image ===== */}
        <div
          ref={cardRef}
          style={{
            width: '375px',
            background: 'linear-gradient(135deg, #f8f6f1 0%, #eef5f0 50%, #f5f0e8 100%)',
            borderRadius: '20px',
            padding: '28px 24px 20px',
            fontFamily: "'DM Sans', -apple-system, sans-serif",
          }}
        >
          {/* Agent Branding */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f' }}>{agentProfile.name}</div>
              {agentProfile.company && (
                <div style={{ fontSize: '11px', color: '#5a6a5a', marginTop: '1px' }}>{agentProfile.company}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <img src="/logo.svg" alt="SafeStreets logo" style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#e07850' }}>SafeStreets</span>
            </div>
          </div>

          {/* Location + Score */}
          <div style={{ fontSize: '12px', color: '#8a9a8a', marginBottom: '4px' }}>Walkability Report</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2a3a2a', marginBottom: '16px', lineHeight: 1.2 }}>
            {shortName}
          </div>

          {/* Score Hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" stroke="#e0dbd0" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="42"
                  stroke={scoreColor} strokeWidth="8" fill="none"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - overall / 10)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{overall.toFixed(1)}</span>
                <span style={{ fontSize: '8px', color: '#8a9a8a' }}>out of 10</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', color: scoreColor, backgroundColor: `${scoreColor}15` }}>
                {getGradeLabel(overall)}
              </div>
              {percentile && (
                <div style={{ fontSize: '10px', color: '#5a6a5a', marginTop: '4px' }}>
                  Better than {percentile.overall}% of {percentile.context} neighborhoods
                </div>
              )}
            </div>
          </div>

          {/* Walker Infographic */}
          <div style={{ padding: '8px 0', marginBottom: '12px', borderTop: '1px solid #e0dbd0', borderBottom: '1px solid #e0dbd0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', marginBottom: '4px' }}>
              {Array.from({ length: Math.round(overall) }).map((_, i) => (
                <span key={`f-${i}`} style={{ fontSize: '14px' }}>🚶</span>
              ))}
              {Array.from({ length: 10 - Math.round(overall) }).map((_, i) => (
                <span key={`e-${i}`} style={{ fontSize: '14px', opacity: 0.2, filter: 'grayscale(1)' }}>🚶</span>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: '9px', color: '#8a9a8a' }}>
              <span style={{ fontWeight: 600, color: scoreColor }}>{Math.round(overall)} out of 10</span> walkers feel comfortable here
            </div>
          </div>

          {/* Metric Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            {metrics.map(m => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', width: '16px', textAlign: 'center' }}>{m.icon}</span>
                <span style={{ fontSize: '10px', width: '76px', color: '#5a6a5a', fontWeight: 500 }}>{m.label}</span>
                <div style={{ flex: 1, height: '7px', borderRadius: '4px', backgroundColor: '#e0dbd0', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(m.score * 10, 100)}%`, height: '100%', borderRadius: '4px', backgroundColor: getScoreColor(m.score) }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, width: '24px', textAlign: 'right', color: '#2a3a2a' }}>{m.score.toFixed(1)}</span>
              </div>
            ))}
          </div>

          {/* Ground Truth Greenery -- key feature description */}
          {gt?.greenCharacter && (
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px' }}>🌳</span>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Greenery Assessment</span>
              </div>
              <p style={{ fontSize: '10px', color: '#4a5a4a', lineHeight: 1.5, margin: 0 }}>
                {gt.greenCharacter.length > 180 ? gt.greenCharacter.substring(0, 180) + '...' : gt.greenCharacter}
              </p>
              {gt.knownFeatures && gt.knownFeatures.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '6px' }}>
                  {gt.knownFeatures.slice(0, 3).map((f, i) => (
                    <span key={i} style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontWeight: 500 }}>
                      {f.length > 30 ? f.substring(0, 30) + '...' : f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Commute Mode Bar */}
          {commuteSegments.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#5a6a5a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How People Get Around</div>
              <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '12px', marginBottom: '4px' }}>
                {commuteSegments.map((seg, i) => (
                  <div key={i} style={{ width: `${Math.max(seg.pct, 1.5)}%`, height: '100%', background: seg.color }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {commuteSegments.filter(s => s.pct >= 2).map((seg, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <div style={{ height: '6px', width: '6px', borderRadius: '1px', background: seg.color }} />
                    <span style={{ fontSize: '8px', color: '#5a6a5a' }}>
                      <strong style={{ color: '#2a3a2a' }}>{Math.round(seg.pct)}%</strong> {seg.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What's Nearby -- compact */}
          {(ni?.parks || ni?.food) && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {ni?.transit && ni.transit.railStations > 0 && (
                <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#7c3aed', fontWeight: 600 }}>
                  🚇 {ni.transit.railStations} rail
                </span>
              )}
              {ni?.transit && ni.transit.busStops > 0 && (
                <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', color: '#2563eb', fontWeight: 600 }}>
                  🚌 {ni.transit.busStops} bus
                </span>
              )}
              {ni?.parks && ni.parks.parks > 0 && (
                <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.08)', color: '#16a34a', fontWeight: 600 }}>
                  🌳 {ni.parks.parks} parks
                </span>
              )}
              {ni?.food && ni.food.supermarkets > 0 && (
                <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#b45309', fontWeight: 600 }}>
                  🛒 {ni.food.supermarkets} supermarkets
                </span>
              )}
              {ni?.food?.isFoodDesert && (
                <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 600 }}>
                  ⚠️ Food desert
                </span>
              )}
            </div>
          )}

          {/* Health snapshot */}
          {ni?.health && (() => {
            const indicators = [
              { label: 'Obesity', val: ni.health!.obesity, avg: 32 },
              { label: 'Diabetes', val: ni.health!.diabetes, avg: 11 },
              { label: 'Inactivity', val: ni.health!.physicalInactivity, avg: 26 },
            ].filter(h => h.val !== null);
            const better = indicators.filter(h => h.val! < h.avg).length;
            if (indicators.length === 0) return null;
            const color = better > indicators.length / 2 ? '#22c55e' : '#ef4444';
            return (
              <div style={{ fontSize: '9px', padding: '6px 10px', borderRadius: '8px', background: `${color}08`, marginBottom: '12px' }}>
                <span style={{ fontWeight: 600, color }}>❤️ {better}/{indicators.length} health indicators</span>
                <span style={{ color: '#5a6a5a' }}> better than US average</span>
              </div>
            );
          })()}

          {/* Flood */}
          {ni?.flood && (
            <div style={{ fontSize: '9px', padding: '6px 10px', borderRadius: '8px', background: ni.flood.isHighRisk ? 'rgba(239,68,68,0.06)' : ni.flood.floodZone === 'X' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', marginBottom: '14px' }}>
              <span style={{ fontWeight: 600, color: ni.flood.isHighRisk ? '#ef4444' : ni.flood.floodZone === 'X' ? '#22c55e' : '#f59e0b' }}>
                {ni.flood.isHighRisk ? '🌊 High Flood Risk' : ni.flood.floodZone === 'X' ? '✓ Minimal Flood Risk' : '⚠ Moderate Flood Risk'}
              </span>
              <span style={{ color: '#5a6a5a' }}> -- FEMA Zone {ni.flood.floodZone}</span>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e0dbd0' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#8a9a8a' }}>safestreets.streetsandcommons.com</div>
              <div style={{ fontSize: '8px', color: '#b0bab0', marginTop: '1px' }}>Satellite + EPA + Census + CDC + FEMA + OSM</div>
            </div>
            {agentProfile.phone && (
              <div style={{ fontSize: '9px', color: '#5a6a5a', textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{agentProfile.name}</div>
                <div>{agentProfile.phone}</div>
              </div>
            )}
          </div>
        </div>
        {/* ===== END CARD ===== */}

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#e07850' }}
          >
            {downloading ? 'Saving...' : 'Download Image'}
          </button>
          <button
            onClick={handleCopyImage}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition hover:bg-gray-50"
            style={{ color: '#2a3a2a', borderColor: '#d0cbc0' }}
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
