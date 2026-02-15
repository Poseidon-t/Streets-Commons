/**
 * Street Audit Tool — walk your street with a structured checklist,
 * document conditions, and generate a proposal-ready report.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../types';

// ─── Types ───────────────────────────────────────────────

type Rating = 'good' | 'needs-work' | 'missing';

interface AuditEntry {
  rating: Rating | null;
  note: string;
  photo: string | null;
}

interface CheckItem {
  id: string;
  label: string;
  hint: string;
}

interface Category {
  id: string;
  name: string;
  metricKey: keyof WalkabilityMetrics;
  items: CheckItem[];
}

// ─── Checklist Data ──────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: 'sidewalks', name: 'Sidewalks & Paths', metricKey: 'sidewalkCoverage',
    items: [
      { id: 'sw-1', label: 'Sidewalk on both sides', hint: 'Is there a continuous paved path on both sides of the street?' },
      { id: 'sw-2', label: 'Width for two people', hint: 'Can two adults walk side by side without stepping off?' },
      { id: 'sw-3', label: 'Surface in good condition', hint: 'Any cracks, uneven slabs, potholes, or trip hazards?' },
      { id: 'sw-4', label: 'Clear of obstructions', hint: 'Poles, signs, parked cars, or vendors blocking the path?' },
    ],
  },
  {
    id: 'crossings', name: 'Crossings', metricKey: 'crossingSafety',
    items: [
      { id: 'cx-1', label: 'Marked crosswalks present', hint: 'Are crosswalks clearly painted where you need to cross?' },
      { id: 'cx-2', label: 'Pedestrian signals working', hint: 'Walk/don\'t-walk signals at intersections?' },
      { id: 'cx-3', label: 'Enough time to cross', hint: 'Can you cross comfortably before the light changes?' },
      { id: 'cx-4', label: 'Good visibility at crossings', hint: 'Can you see oncoming traffic from the crossing point?' },
    ],
  },
  {
    id: 'traffic', name: 'Traffic & Speed', metricKey: 'speedExposure',
    items: [
      { id: 'tr-1', label: 'Traffic speed feels safe', hint: 'Do vehicles pass at a comfortable speed for walking?' },
      { id: 'tr-2', label: 'Traffic calming features', hint: 'Speed bumps, narrow lanes, raised crossings, or bollards?' },
      { id: 'tr-3', label: 'Manageable number of lanes', hint: 'How many lanes must you cross? 4+ is challenging.' },
    ],
  },
  {
    id: 'shade', name: 'Shade & Comfort', metricKey: 'treeCanopy',
    items: [
      { id: 'sh-1', label: 'Tree canopy or shade cover', hint: 'Is there shade from trees, awnings, or building overhangs?' },
      { id: 'sh-2', label: 'Places to sit and rest', hint: 'Benches, ledges, or other seating along the route?' },
      { id: 'sh-3', label: 'Comfortable to walk', hint: 'Would you enjoy a 15-minute walk here on a typical day?' },
    ],
  },
  {
    id: 'lighting', name: 'Lighting', metricKey: 'nightSafety',
    items: [
      { id: 'lt-1', label: 'Street lighting adequate', hint: 'Enough lights for safe evening or night walking?' },
      { id: 'lt-2', label: 'No dark spots or blind corners', hint: 'Any unlit alleys, hidden turns, or shadowy areas?' },
      { id: 'lt-3', label: 'Active storefronts with light', hint: 'Do shops and buildings light up the sidewalk?' },
    ],
  },
  {
    id: 'accessibility', name: 'Accessibility', metricKey: 'slope',
    items: [
      { id: 'ac-1', label: 'Curb cuts at every crossing', hint: 'Ramps where the sidewalk meets the road at corners?' },
      { id: 'ac-2', label: 'Wheelchair / stroller passable', hint: 'Could someone in a wheelchair navigate the full route?' },
      { id: 'ac-3', label: 'Manageable slopes', hint: 'Are hills or grades easy for elderly or limited-mobility people?' },
    ],
  },
  {
    id: 'safety', name: 'Safety & Security', metricKey: 'overallScore',
    items: [
      { id: 'sf-1', label: 'Feels safe to walk', hint: 'Would you walk here alone? Let a child walk here?' },
      { id: 'sf-2', label: 'Clear sight lines', hint: 'Can you see ahead clearly? No blind spots or hidden areas?' },
      { id: 'sf-3', label: 'People and activity present', hint: 'Other pedestrians, open shops, or signs of community life?' },
    ],
  },
  {
    id: 'amenities', name: 'Amenities', metricKey: 'destinationAccess',
    items: [
      { id: 'am-1', label: 'Transit stops nearby', hint: 'Bus stops, train stations, or transit within walking distance?' },
      { id: 'am-2', label: 'Daily needs accessible on foot', hint: 'Grocery, pharmacy, or services you can walk to?' },
      { id: 'am-3', label: 'Bike infrastructure', hint: 'Bike lanes, racks, or bike-share stations present?' },
    ],
  },
];

const TOTAL_ITEMS = CATEGORIES.reduce((s, c) => s + c.items.length, 0);

// ─── Helpers ─────────────────────────────────────────────

const RATING_COLORS = {
  good:         { bg: '#4a8a3c', light: '#f0faf0', border: '#c8e0c8' },
  'needs-work': { bg: '#e07850', light: '#fef5f0', border: '#e0ccc0' },
  missing:      { bg: '#c03030', light: '#fef0f0', border: '#e0c0c0' },
} as const;

const RATING_LABELS: Record<Rating, string> = {
  good: '\u2713 Good',
  'needs-work': '\u26A0 Needs Work',
  missing: '\u2717 Missing',
};

function storageKey(addr: string) {
  return 'safestreets_audit_' + addr.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
}

function loadSaved(addr: string): { entries: Record<string, AuditEntry>; startedAt: string } | null {
  try { const d = localStorage.getItem(storageKey(addr)); return d ? JSON.parse(d) : null; }
  catch { return null; }
}

function persist(addr: string, entries: Record<string, AuditEntry>, startedAt: string) {
  try { localStorage.setItem(storageKey(addr), JSON.stringify({ entries, startedAt })); } catch {}
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > 800) { h = (h * 800) / w; w = 800; }
        c.width = w; c.height = h;
        c.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function getSmartHint(cat: Category, metrics: WalkabilityMetrics | null): string | null {
  if (!metrics) return null;
  const score = metrics[cat.metricKey];
  if (typeof score !== 'number' || score > 50) return null;
  const hints: Record<string, string> = {
    sidewalks: 'Satellite data shows limited sidewalk infrastructure. Pay attention to path availability.',
    crossings: 'Analysis found few protected crossings nearby. Note crossing conditions carefully.',
    traffic: 'Speed exposure score is elevated. Observe actual traffic speeds and calming measures.',
    shade: 'Satellite imagery shows limited tree canopy. Note shade and comfort conditions.',
    lighting: 'Street lighting coverage appears low. Check for adequate illumination.',
    accessibility: 'Terrain shows notable elevation changes. Check slope accessibility.',
    safety: 'Safety metrics indicate concerns. Pay attention to sight lines and activity.',
    amenities: 'Limited daily destinations detected nearby. Note what services are walkable.',
  };
  return hints[cat.id] || null;
}

// ─── Component ───────────────────────────────────────────

interface Props {
  address: string;
  metrics: WalkabilityMetrics | null;
  compositeScore: WalkabilityScoreV2 | null;
  isPremium: boolean;
  onClose: () => void;
}

export default function StreetAuditTool({ address, metrics, compositeScore, onClose }: Props) {
  const [stage, setStage] = useState<'intro' | 'audit' | 'review'>('intro');
  const [catIdx, setCatIdx] = useState(0);
  const [entries, setEntries] = useState<Record<string, AuditEntry>>({});
  const [startedAt, setStartedAt] = useState('');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const photoItemRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort categories by weakest metric first
  const cats = useMemo(() => {
    if (!metrics) return CATEGORIES;
    return [...CATEGORIES].sort((a, b) => {
      const sa = (metrics[a.metricKey] as number) ?? 50;
      const sb = (metrics[b.metricKey] as number) ?? 50;
      return sa - sb;
    });
  }, [metrics]);

  const saved = useMemo(() => loadSaved(address), [address]);

  // Auto-save
  useEffect(() => {
    if (startedAt && Object.keys(entries).length > 0) persist(address, entries, startedAt);
  }, [entries, address, startedAt]);

  // Scroll to top on category/stage change
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [catIdx, stage]);

  const rated = useMemo(() => Object.values(entries).filter(e => e.rating).length, [entries]);
  const pct = Math.round((rated / TOTAL_ITEMS) * 100);
  const cat = cats[catIdx];

  const catStats = useCallback((c: Category) => {
    const total = c.items.length;
    const done = c.items.filter(i => entries[i.id]?.rating).length;
    return { total, done, complete: done === total };
  }, [entries]);

  const setRating = (id: string, r: Rating) => {
    setEntries(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { note: '', photo: null }), rating: prev[id]?.rating === r ? null : r },
    }));
  };

  const setNote = (id: string, note: string) => {
    setEntries(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { rating: null, photo: null }), note },
    }));
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = photoItemRef.current;
    if (!file || !itemId) return;
    const data = await compressPhoto(file);
    setEntries(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { rating: null, note: '' }), photo: data },
    }));
    e.target.value = '';
  };

  const startAudit = (resume = false) => {
    if (resume && saved) {
      setEntries(saved.entries);
      setStartedAt(saved.startedAt);
    } else {
      setEntries({});
      setStartedAt(new Date().toISOString());
    }
    setCatIdx(0);
    setStage('audit');
  };

  const downloadReport = useCallback(() => {
    const good = Object.values(entries).filter(e => e.rating === 'good').length;
    const nw = Object.values(entries).filter(e => e.rating === 'needs-work').length;
    const miss = Object.values(entries).filter(e => e.rating === 'missing').length;

    const issues = cats.flatMap(c =>
      c.items
        .filter(i => entries[i.id]?.rating === 'needs-work' || entries[i.id]?.rating === 'missing')
        .map(i => ({ ...i, catName: c.name, entry: entries[i.id] }))
    );

    const issueHtml = issues.length > 0
      ? `<h2 style="margin:24px 0 12px;color:#2a3a2a">Key Issues Found (${issues.length})</h2>
         ${issues.map(i => {
           const c = RATING_COLORS[i.entry.rating!];
           const lbl = i.entry.rating === 'needs-work' ? 'Needs Work' : 'Missing';
           return `<div style="padding:10px 14px;margin-bottom:8px;border-left:4px solid ${c.bg};background:#fafafa;border-radius:0 8px 8px 0">
             <strong>${i.label}</strong>
             <span style="color:${c.bg};font-size:0.85em;margin-left:8px">${lbl}</span>
             <span style="color:#999;font-size:0.85em;margin-left:8px">— ${i.catName}</span>
             ${i.entry.note ? `<p style="margin:4px 0 0;color:#555;font-size:0.9em">${i.entry.note}</p>` : ''}
           </div>`;
         }).join('')}` : '';

    const catHtml = cats.map(c => {
      const rows = c.items.map(item => {
        const e = entries[item.id];
        const lbl = e?.rating ? RATING_LABELS[e.rating] : '—';
        const color = e?.rating ? RATING_COLORS[e.rating].bg : '#8a9a8a';
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${item.label}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${color};font-weight:600;white-space:nowrap">${lbl}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;font-size:0.85em">${e?.note || '—'}</td>
        </tr>`;
      }).join('');
      return `<h3 style="margin:20px 0 6px;color:#2a3a2a">${c.name}</h3>
        <table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Street Audit — ${address}</title>
      <style>body{font-family:-apple-system,system-ui,'Segoe UI',sans-serif;max-width:760px;margin:0 auto;padding:40px 20px;color:#2a3a2a;line-height:1.5}
      table{width:100%}@media print{body{padding:16px}}</style></head><body>
      <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e0dbd0">
        <div style="font-size:0.85em;color:#e07850;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">SAFESTREETS</div>
        <h1 style="font-size:1.4em;margin:0 0 4px">Street Walking Audit</h1>
        <p style="color:#5a6a5a;margin:2px 0">${address}</p>
        <p style="color:#8a9a8a;font-size:0.85em;margin:2px 0">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:24px">
        <div style="text-align:center;padding:12px 20px;background:${RATING_COLORS.good.light};border-radius:10px;min-width:70px">
          <div style="font-size:1.5em;font-weight:800;color:${RATING_COLORS.good.bg}">${good}</div><div style="font-size:0.75em;color:#5a6a5a">Good</div></div>
        <div style="text-align:center;padding:12px 20px;background:${RATING_COLORS['needs-work'].light};border-radius:10px;min-width:70px">
          <div style="font-size:1.5em;font-weight:800;color:${RATING_COLORS['needs-work'].bg}">${nw}</div><div style="font-size:0.75em;color:#5a6a5a">Needs Work</div></div>
        <div style="text-align:center;padding:12px 20px;background:${RATING_COLORS.missing.light};border-radius:10px;min-width:70px">
          <div style="font-size:1.5em;font-weight:800;color:${RATING_COLORS.missing.bg}">${miss}</div><div style="font-size:0.75em;color:#5a6a5a">Missing</div></div>
      </div>
      ${compositeScore ? `<div style="text-align:center;margin-bottom:24px;padding:10px;background:#f8f6f1;border-radius:10px">
        <span style="font-size:0.85em;color:#5a6a5a">Satellite Walkability Score: </span>
        <strong style="color:#e07850;font-size:1.1em">${compositeScore.overallScore}/100 (${compositeScore.grade})</strong></div>` : ''}
      ${issueHtml}
      <h2 style="margin:28px 0 12px;color:#2a3a2a">Full Audit Results</h2>
      ${catHtml}
      <div style="margin-top:36px;padding:14px;background:#f8f6f1;border-radius:8px;text-align:center;font-size:0.8em;color:#8a9a8a">
        Generated by SafeStreets &middot; safestreets.streetsandcommons.com</div></body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  }, [entries, cats, address, compositeScore]);

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />

      {/* ─── INTRO ─── */}
      {stage === 'intro' && (
        <>
          <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.8)' }}>
            <button onClick={onClose} className="text-sm font-medium cursor-pointer border-none bg-transparent" style={{ color: '#5a6a5a' }}>{'\u2190'} Back</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-8 max-w-lg mx-auto w-full">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#e07850' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: '#2a3a2a' }}>Walk & Audit Your Street</h1>
              <p className="text-sm" style={{ color: '#5a6a5a' }}>{address}</p>
              {compositeScore && (
                <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl" style={{ backgroundColor: 'rgba(224,120,80,0.08)', border: '1px solid rgba(224,120,80,0.2)' }}>
                  <span className="text-sm" style={{ color: '#5a6a5a' }}>Satellite Score</span>
                  <span className="text-lg font-bold" style={{ color: '#e07850' }}>{compositeScore.overallScore}</span>
                  <span className="text-sm font-semibold" style={{ color: '#5a6a5a' }}>/ 100</span>
                </div>
              )}
            </div>

            <p className="text-center text-sm mb-6" style={{ color: '#8a9a8a' }}>
              {TOTAL_ITEMS} checkpoints &middot; {CATEGORIES.length} categories &middot; ~15 min walk
            </p>

            <div className="space-y-2 mb-8">
              {cats.map((c, i) => {
                const score = metrics ? (metrics[c.metricKey] as number) : null;
                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderColor: '#e0dbd0' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#e07850' }}>{i + 1}</span>
                      <span className="text-sm font-medium" style={{ color: '#2a3a2a' }}>{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {score !== null && score !== undefined && score <= 40 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#fef0f0', color: '#c03030' }}>Low score</span>
                      )}
                      <span className="text-xs" style={{ color: '#8a9a8a' }}>{c.items.length} items</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => startAudit(false)}
              className="w-full py-4 rounded-xl text-white font-bold text-base transition-all hover:shadow-lg cursor-pointer border-none"
              style={{ backgroundColor: '#e07850' }}
            >
              Start Walking Audit
            </button>
            {saved && (
              <button
                onClick={() => startAudit(true)}
                className="w-full py-3 mt-3 rounded-xl font-semibold text-sm transition-all cursor-pointer border-2"
                style={{ borderColor: '#e07850', color: '#e07850', backgroundColor: 'transparent' }}
              >
                Continue Previous Audit
              </button>
            )}
          </div>
        </>
      )}

      {/* ─── AUDIT ─── */}
      {stage === 'audit' && cat && (
        <>
          <div className="border-b" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => catIdx > 0 ? setCatIdx(catIdx - 1) : setStage('intro')}
                className="text-sm font-medium cursor-pointer border-none bg-transparent"
                style={{ color: '#5a6a5a' }}
              >
                {'\u2190'} {catIdx > 0 ? 'Prev' : 'Back'}
              </button>
              <span className="text-sm font-bold" style={{ color: '#2a3a2a' }}>{cat.name}</span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#f0ebe0', color: '#5a6a5a' }}>
                {rated}/{TOTAL_ITEMS}
              </span>
            </div>
            <div className="h-1" style={{ backgroundColor: '#e0dbd0' }}>
              <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: '#e07850' }} />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto" style={{ backgroundColor: 'rgba(255,255,255,0.5)', WebkitOverflowScrolling: 'touch' }}>
            {cats.map((c, i) => {
              const s = catStats(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setCatIdx(i)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer border-none"
                  style={{
                    backgroundColor: i === catIdx ? '#e07850' : s.complete ? '#4a8a3c' : '#f0ebe0',
                    color: i === catIdx || s.complete ? 'white' : '#5a6a5a',
                  }}
                >
                  {c.name}{s.complete ? ' \u2713' : s.done > 0 ? ` ${s.done}/${s.total}` : ''}
                </button>
              );
            })}
          </div>

          {/* Items */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {/* Smart hint */}
            {(() => {
              const hint = getSmartHint(cat, metrics);
              if (!hint) return null;
              return (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: 'rgba(224,120,80,0.06)', border: '1px solid rgba(224,120,80,0.15)', color: '#b06040' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>&#x1F4E1;</span>
                  <span>{hint}</span>
                </div>
              );
            })()}

            {cat.items.map(item => {
              const e = entries[item.id];
              const hasRating = !!e?.rating;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{
                    backgroundColor: hasRating ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
                    borderColor: hasRating && e.rating ? RATING_COLORS[e.rating].border : '#e0dbd0',
                    borderWidth: hasRating ? '2px' : '1px',
                  }}
                >
                  <div className="px-4 pt-4 pb-3">
                    <p className="font-semibold text-sm mb-0.5" style={{ color: '#2a3a2a' }}>{item.label}</p>
                    <p className="text-xs mb-3" style={{ color: '#8a9a8a' }}>{item.hint}</p>

                    {/* Rating buttons */}
                    <div className="flex gap-2">
                      {(['good', 'needs-work', 'missing'] as Rating[]).map(r => {
                        const active = e?.rating === r;
                        const rc = RATING_COLORS[r];
                        return (
                          <button
                            key={r}
                            onClick={() => setRating(item.id, r)}
                            className="flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                            style={{
                              backgroundColor: active ? rc.bg : 'transparent',
                              color: active ? 'white' : rc.bg,
                              border: `2px solid ${active ? rc.bg : rc.border}`,
                            }}
                          >
                            {RATING_LABELS[r]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Note & Photo (only after rating) */}
                  {hasRating && (
                    <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: '#f0ebe0' }}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedNote(expandedNote === item.id ? null : item.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer border-none"
                          style={{ backgroundColor: e?.note ? '#e8f5e0' : '#f0ebe0', color: e?.note ? '#4a8a3c' : '#8a9a8a' }}
                        >
                          {e?.note ? '\u270F\uFE0F Edit note' : '\u270F\uFE0F Add note'}
                        </button>
                        <button
                          onClick={() => { photoItemRef.current = item.id; fileRef.current?.click(); }}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer border-none"
                          style={{ backgroundColor: e?.photo ? '#e8f5e0' : '#f0ebe0', color: e?.photo ? '#4a8a3c' : '#8a9a8a' }}
                        >
                          {e?.photo ? '\uD83D\uDCF7 Replace' : '\uD83D\uDCF7 Photo'}
                        </button>
                      </div>
                      {expandedNote === item.id && (
                        <textarea
                          value={e?.note || ''}
                          onChange={ev => setNote(item.id, ev.target.value)}
                          placeholder="What did you observe?"
                          rows={2}
                          className="w-full mt-2 px-3 py-2 rounded-lg text-sm resize-none"
                          style={{ backgroundColor: '#f8f6f1', color: '#2a3a2a', outline: 'none', border: '1px solid #e0dbd0' }}
                          autoFocus
                        />
                      )}
                      {e?.photo && (
                        <div className="mt-2 relative inline-block">
                          <img src={e.photo} alt="Audit photo" className="rounded-lg" style={{ maxHeight: '120px', maxWidth: '100%' }} />
                          <button
                            onClick={() => setEntries(prev => ({ ...prev, [item.id]: { ...prev[item.id], photo: null } }))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center cursor-pointer border-none"
                            style={{ backgroundColor: '#c03030', lineHeight: 1 }}
                          >{'\u00D7'}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom nav */}
          <div className="px-4 py-3 border-t" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <button
              onClick={() => catIdx < cats.length - 1 ? setCatIdx(catIdx + 1) : setStage('review')}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:shadow-lg cursor-pointer border-none"
              style={{ backgroundColor: '#e07850' }}
            >
              {catIdx < cats.length - 1 ? `Next: ${cats[catIdx + 1].name} \u2192` : 'Review Audit \u2192'}
            </button>
          </div>
        </>
      )}

      {/* ─── REVIEW ─── */}
      {stage === 'review' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <button onClick={() => setStage('audit')} className="text-sm font-medium cursor-pointer border-none bg-transparent" style={{ color: '#5a6a5a' }}>{'\u2190'} Edit</button>
            <span className="text-sm font-bold" style={{ color: '#2a3a2a' }}>Audit Summary</span>
            <button onClick={onClose} className="text-sm font-medium cursor-pointer border-none bg-transparent" style={{ color: '#5a6a5a' }}>Done</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 max-w-lg mx-auto w-full">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: '#2a3a2a' }}>Audit Complete</h2>
              <p className="text-sm" style={{ color: '#5a6a5a' }}>{address}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {(['good', 'needs-work', 'missing'] as Rating[]).map(r => {
                const count = Object.values(entries).filter(e => e.rating === r).length;
                const labels: Record<Rating, string> = { good: 'Good', 'needs-work': 'Needs Work', missing: 'Missing' };
                return (
                  <div key={r} className="text-center py-4 rounded-xl border" style={{ backgroundColor: RATING_COLORS[r].light, borderColor: RATING_COLORS[r].border }}>
                    <div className="text-2xl font-extrabold" style={{ color: RATING_COLORS[r].bg }}>{count}</div>
                    <div className="text-xs font-medium mt-0.5" style={{ color: '#5a6a5a' }}>{labels[r]}</div>
                  </div>
                );
              })}
            </div>

            {/* Key Issues */}
            {(() => {
              const issues = cats.flatMap(c =>
                c.items
                  .filter(i => entries[i.id]?.rating === 'needs-work' || entries[i.id]?.rating === 'missing')
                  .map(i => ({ ...i, catName: c.name, entry: entries[i.id] }))
              );
              if (issues.length === 0) return (
                <div className="text-center py-6 px-4 rounded-xl mb-6" style={{ backgroundColor: RATING_COLORS.good.light, border: `1px solid ${RATING_COLORS.good.border}` }}>
                  <p className="font-semibold mt-1" style={{ color: '#4a8a3c' }}>No issues found!</p>
                  <p className="text-xs mt-1" style={{ color: '#5a6a5a' }}>This street scored well across all categories.</p>
                </div>
              );
              return (
                <div className="mb-6">
                  <h3 className="text-sm font-bold mb-3" style={{ color: '#2a3a2a' }}>Issues Found ({issues.length})</h3>
                  <div className="space-y-2">
                    {issues.map(iss => (
                      <div
                        key={iss.id}
                        className="px-4 py-3 rounded-r-xl border-l-4"
                        style={{
                          borderLeftColor: RATING_COLORS[iss.entry.rating!].bg,
                          backgroundColor: 'rgba(255,255,255,0.8)',
                          borderTop: '1px solid #e0dbd0',
                          borderRight: '1px solid #e0dbd0',
                          borderBottom: '1px solid #e0dbd0',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm" style={{ color: '#2a3a2a' }}>{iss.label}</span>
                          <span className="text-xs font-semibold" style={{ color: RATING_COLORS[iss.entry.rating!].bg }}>
                            {iss.entry.rating === 'needs-work' ? '\u26A0 Needs Work' : '\u2717 Missing'}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: '#8a9a8a' }}>{iss.catName}</span>
                        {iss.entry.note && <p className="text-xs mt-1" style={{ color: '#5a6a5a' }}>"{iss.entry.note}"</p>}
                        {iss.entry.photo && <img src={iss.entry.photo} alt="" className="mt-2 rounded-lg" style={{ maxHeight: '80px' }} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Category breakdown */}
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-3" style={{ color: '#2a3a2a' }}>By Category</h3>
              <div className="space-y-2">
                {cats.map(c => {
                  const s = catStats(c);
                  const good = c.items.filter(i => entries[i.id]?.rating === 'good').length;
                  const pctGood = s.done > 0 ? Math.round((good / s.total) * 100) : 0;
                  return (
                    <div key={c.id} className="px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderColor: '#e0dbd0' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{c.name}</span>
                        <span className="text-xs font-semibold" style={{ color: pctGood >= 75 ? '#4a8a3c' : pctGood >= 50 ? '#e07850' : '#c03030' }}>
                          {pctGood}% good
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {c.items.map(i => {
                          const r = entries[i.id]?.rating;
                          return (
                            <div
                              key={i.id}
                              className="flex-1 h-2 rounded-full"
                              style={{ backgroundColor: r ? RATING_COLORS[r].bg : '#e0dbd0' }}
                              title={`${i.label}: ${r || 'not rated'}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={downloadReport}
              className="w-full py-4 rounded-xl text-white font-bold text-sm transition-all hover:shadow-lg cursor-pointer border-none mb-3"
              style={{ backgroundColor: '#e07850' }}
            >
              Download Audit Report
            </button>
            <button
              onClick={() => { setStage('audit'); setCatIdx(0); }}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer border-2 mb-6"
              style={{ borderColor: '#e0dbd0', color: '#5a6a5a', backgroundColor: 'transparent' }}
            >
              Edit Responses
            </button>
          </div>
        </>
      )}
    </div>
  );
}
