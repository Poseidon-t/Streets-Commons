import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

// ─── Types ────────────────────────────────────────────────────────────────────

type CardType = 'score_card' | 'data_story' | 'before_after' | 'city_comparison';

interface ScoreCardData {
  city: string;
  country: string;
  score: number;
  safetyScore: number;
  transitScore: number;
  comfortScore: number;
  interestScore: number;
  topStrength: string;
  topConcern: string;
}

interface DataStoryData {
  headline: string;
  stat: string;
  unit: string;
  context: string;
  fact1: string;
  fact2: string;
  fact3: string;
  source: string;
  cta: string;
}

interface BeforeAfterData {
  city: string;
  intervention: string;
  period: string;
  beforeStat1Label: string;
  beforeStat1: string;
  beforeStat2Label: string;
  beforeStat2: string;
  afterStat1Label: string;
  afterStat1: string;
  afterStat2Label: string;
  afterStat2: string;
  lessonLearned: string;
}

interface ComparisonCity {
  name: string;
  score: number;
  fatalities: string;
  transitMode: string;
}

interface CityComparisonData {
  title: string;
  metric: string;
  cities: ComparisonCity[];
  insight: string;
}

// ─── Score circle colour ──────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 7.5) return '#22c55e';
  if (score >= 5.5) return '#f59e0b';
  if (score >= 3.5) return '#f97316';
  return '#ef4444';
}

function scoreLabel(score: number) {
  if (score >= 7.5) return 'Excellent';
  if (score >= 5.5) return 'Moderate';
  if (score >= 3.5) return 'Difficult';
  return 'Dangerous';
}

// ─── Card renders ─────────────────────────────────────────────────────────────

function ScoreCard({ d }: { d: ScoreCardData }) {
  const col = scoreColor(d.score);
  const metrics = [
    { label: 'Safety', value: d.safetyScore },
    { label: 'Transit', value: d.transitScore },
    { label: 'Comfort', value: d.comfortScore },
    { label: 'Interest', value: d.interestScore },
  ];
  return (
    <div style={{ width: 560, background: '#fff', borderRadius: 20, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
      {/* Header */}
      <div style={{ background: '#2a3a2a', padding: '24px 28px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#e07850', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>SafeStreets Analysis</div>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{d.city || 'City Name'}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>{d.country || 'Country'}</div>
        </div>
        {/* Score Circle */}
        <div style={{ width: 80, height: 80, borderRadius: '50%', border: `4px solid ${col}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ color: col, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{d.score.toFixed(1)}</div>
          <div style={{ color: col, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{scoreLabel(d.score)}</div>
        </div>
      </div>

      {/* Metric bars */}
      <div style={{ padding: '20px 28px', background: '#f9f9f7' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: 0.5, textTransform: 'uppercase' }}>{m.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(m.value) }}>{m.value.toFixed(1)}</span>
            </div>
            <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${m.value * 10}%`, height: '100%', background: scoreColor(m.value), borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Strength / Concern */}
      <div style={{ padding: '16px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', borderLeft: '3px solid #22c55e' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Top Strength</div>
          <div style={{ fontSize: 12, color: '#1a2e1a', fontWeight: 600 }}>{d.topStrength || 'Good pedestrian infrastructure'}</div>
        </div>
        <div style={{ background: '#fff7ed', borderRadius: 10, padding: '10px 14px', borderLeft: '3px solid #f97316' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#c2410c', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Key Concern</div>
          <div style={{ fontSize: 12, color: '#1a2e1a', fontWeight: 600 }}>{d.topConcern || 'High-speed arterials'}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#2a3a2a', padding: '10px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>STREETSANDCOMMONS.COM</div>
        <div style={{ color: '#e07850', fontSize: 10, fontWeight: 700 }}>Try SafeStreets Free ↗</div>
      </div>
    </div>
  );
}

function DataStoryCard({ d }: { d: DataStoryData }) {
  return (
    <div style={{ width: 560, background: '#2a3a2a', borderRadius: 20, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
      {/* Logo strip */}
      <div style={{ background: '#e07850', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>SafeStreets · Data Report</span>
      </div>

      {/* Headline */}
      <div style={{ padding: '28px 28px 16px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{d.headline || 'The Numbers Don\'t Lie'}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ color: '#e07850', fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{d.stat || '43K'}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: 700 }}>{d.unit || 'deaths/yr'}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5, borderLeft: '3px solid #e07850', paddingLeft: 12 }}>{d.context || 'Americans killed in traffic crashes — more than gun homicides.'}</div>
      </div>

      {/* Facts */}
      <div style={{ padding: '0 28px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[d.fact1, d.fact2, d.fact3].filter(Boolean).map((fact, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#e07850', fontSize: 16, fontWeight: 900, lineHeight: 1.4, flexShrink: 0 }}>→</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5 }}>{fact}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>Source: {d.source || 'NHTSA FARS, WHO 2024'}</span>
        <span style={{ color: '#e07850', fontSize: 11, fontWeight: 700 }}>{d.cta || 'streetsandcommons.com'}</span>
      </div>
    </div>
  );
}

function BeforeAfterCard({ d }: { d: BeforeAfterData }) {
  return (
    <div style={{ width: 560, background: '#fff', borderRadius: 20, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
      {/* Header */}
      <div style={{ background: '#2a3a2a', padding: '20px 28px' }}>
        <div style={{ color: '#e07850', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Transformation Case Study</div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{d.city || 'City'}: {d.intervention || 'Intervention'}</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>{d.period || '2018 → 2024'}</div>
      </div>

      {/* Before / After columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ background: '#fff5f5', padding: '20px 24px', borderRight: '1px solid #fecaca' }}>
          <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✕</span> Before
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#ef4444', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{d.beforeStat1 || '—'}</div>
            <div style={{ color: '#991b1b', fontSize: 11, fontWeight: 600, marginTop: 3 }}>{d.beforeStat1Label || 'Annual pedestrian deaths'}</div>
          </div>
          <div>
            <div style={{ color: '#ef4444', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{d.beforeStat2 || '—'}</div>
            <div style={{ color: '#991b1b', fontSize: 11, fontWeight: 600, marginTop: 3 }}>{d.beforeStat2Label || 'Average vehicle speed'}</div>
          </div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '20px 24px' }}>
          <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✓</span> After
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#16a34a', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{d.afterStat1 || '—'}</div>
            <div style={{ color: '#14532d', fontSize: 11, fontWeight: 600, marginTop: 3 }}>{d.afterStat1Label || 'Annual pedestrian deaths'}</div>
          </div>
          <div>
            <div style={{ color: '#16a34a', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{d.afterStat2 || '—'}</div>
            <div style={{ color: '#14532d', fontSize: 11, fontWeight: 600, marginTop: 3 }}>{d.afterStat2Label || 'Average vehicle speed'}</div>
          </div>
        </div>
      </div>

      {/* Lesson */}
      {d.lessonLearned && (
        <div style={{ padding: '14px 28px', background: '#f9f9f7', borderTop: '1px solid #e5e7eb' }}>
          <span style={{ color: '#555', fontSize: 12, fontStyle: 'italic' }}>"{d.lessonLearned}"</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ background: '#2a3a2a', padding: '10px 28px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>STREETSANDCOMMONS.COM</span>
        <span style={{ color: '#e07850', fontSize: 10, fontWeight: 700 }}>SafeStreets Analysis</span>
      </div>
    </div>
  );
}

function CityComparisonCard({ d }: { d: CityComparisonData }) {
  const sorted = [...d.cities].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 10;
  return (
    <div style={{ width: 560, background: '#fff', borderRadius: 20, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
      {/* Header */}
      <div style={{ background: '#2a3a2a', padding: '20px 28px' }}>
        <div style={{ color: '#e07850', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>City Comparison</div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{d.title || 'Walkability: City vs. City'}</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>{d.metric || 'Overall Walkability Score'}</div>
      </div>

      {/* Cities */}
      <div style={{ padding: '16px 28px' }}>
        {sorted.map((city, i) => (
          <div key={i} style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 12, background: i === 0 ? '#f0fdf4' : '#f9f9f7', border: i === 0 ? '1.5px solid #86efac' : '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? '#2a3a2a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: i === 0 ? '#e07850' : '#888', fontSize: 13, fontWeight: 800 }}>#{i + 1}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#2a3a2a' }}>{city.name}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: scoreColor(city.score) }}>{city.score.toFixed(1)}</span>
              </div>
              <div style={{ height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: `${(city.score / topScore) * 100}%`, height: '100%', background: scoreColor(city.score), borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {city.fatalities && <span style={{ fontSize: 10, color: '#888' }}>Fatalities: <strong style={{ color: '#444' }}>{city.fatalities}</strong></span>}
                {city.transitMode && <span style={{ fontSize: 10, color: '#888' }}>Transit: <strong style={{ color: '#444' }}>{city.transitMode}</strong></span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insight */}
      {d.insight && (
        <div style={{ padding: '0 28px 16px' }}>
          <div style={{ background: '#fff7ed', borderLeft: '3px solid #e07850', borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
            <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>{d.insight}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ background: '#2a3a2a', padding: '10px 28px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>STREETSANDCOMMONS.COM</span>
        <span style={{ color: '#e07850', fontSize: 10, fontWeight: 700 }}>SafeStreets · Walkability Intelligence</span>
      </div>
    </div>
  );
}

// ─── Default data ─────────────────────────────────────────────────────────────

const defaultScoreCard: ScoreCardData = {
  city: 'Oslo', country: 'Norway', score: 7.8,
  safetyScore: 8.2, transitScore: 8.5, comfortScore: 7.1, interestScore: 7.3,
  topStrength: 'Car-free city center since 2019',
  topConcern: 'Outer ring arterials lack protected crossings',
};

const defaultDataStory: DataStoryData = {
  headline: 'The U.S. Pedestrian Safety Crisis',
  stat: '7,522', unit: 'pedestrians killed',
  context: 'In 2022 — the highest in 40 years. That\'s one person killed every 70 minutes.',
  fact1: 'SUVs and pickup trucks are 2× more likely to kill a pedestrian in a crash than sedans',
  fact2: 'Black Americans are 82% more likely to be killed as pedestrians than white Americans',
  fact3: 'States with the weakest pedestrian laws have 3× higher fatality rates',
  source: 'NHTSA FARS 2022, Smart Growth America', cta: 'streetsandcommons.com',
};

const defaultBeforeAfter: BeforeAfterData = {
  city: 'Oslo', intervention: 'City Center Car Ban',
  period: '2016 → 2019',
  beforeStat1: '3', beforeStat1Label: 'Pedestrian deaths/year (city center)',
  beforeStat2: '18,000', beforeStat2Label: 'Cars/day through center',
  afterStat1: '0', afterStat1Label: 'Pedestrian deaths (2019–2023)',
  afterStat2: '350', afterStat2Label: 'Cars/day (residents/deliveries only)',
  lessonLearned: 'Removing cars didn\'t kill business — retail revenue rose 10% in the first year.',
};

const defaultComparison: CityComparisonData = {
  title: 'Walking Safety: World Cities Ranked',
  metric: 'SafeStreets Walkability Score (0–10)',
  cities: [
    { name: 'Amsterdam', score: 8.9, fatalities: '1.1/100k', transitMode: '63% cycling' },
    { name: 'Tokyo', score: 8.4, fatalities: '0.9/100k', transitMode: '72% transit' },
    { name: 'New York', score: 5.3, fatalities: '3.2/100k', transitMode: '55% transit' },
    { name: 'Houston', score: 2.8, fatalities: '6.1/100k', transitMode: '84% car' },
  ],
  insight: 'Amsterdam\'s cycling infrastructure doesn\'t just serve cyclists — it protects pedestrians by reducing vehicle speeds city-wide.',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function InfographicGenerator() {
  const [cardType, setCardType] = useState<CardType>('score_card');
  const [scoreCard, setScoreCard] = useState<ScoreCardData>(defaultScoreCard);
  const [dataStory, setDataStory] = useState<DataStoryData>(defaultDataStory);
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfterData>(defaultBeforeAfter);
  const [comparison, setComparison] = useState<CityComparisonData>(defaultComparison);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, backgroundColor: null, useCORS: true, logging: false,
      });
      const link = document.createElement('a');
      link.download = `safestreets-infographic-${cardType}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, backgroundColor: null, useCORS: true, logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      });
    } catch { /* ignore */ }
  };

  const tabs: { id: CardType; label: string }[] = [
    { id: 'score_card', label: 'Score Card' },
    { id: 'data_story', label: 'Data Story' },
    { id: 'before_after', label: 'Before / After' },
    { id: 'city_comparison', label: 'City Comparison' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Infographic Generator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create shareable cards for Reddit, Twitter/X, Instagram — export as PNG</p>
      </div>

      {/* Card type tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setCardType(t.id)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              cardType === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Two-column layout: form + preview */}
      <div className="grid grid-cols-2 gap-8">

        {/* ── Form panel ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Edit Fields</h2>

          {cardType === 'score_card' && (
            <ScoreCardForm data={scoreCard} onChange={setScoreCard} />
          )}
          {cardType === 'data_story' && (
            <DataStoryForm data={dataStory} onChange={setDataStory} />
          )}
          {cardType === 'before_after' && (
            <BeforeAfterForm data={beforeAfter} onChange={setBeforeAfter} />
          )}
          {cardType === 'city_comparison' && (
            <ComparisonForm data={comparison} onChange={setComparison} />
          )}
        </div>

        {/* ── Preview panel ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Preview</h2>
          <div
            ref={cardRef}
            className="inline-block"
            style={{ transform: 'scale(0.85)', transformOrigin: 'top left', marginBottom: '-15%' }}
          >
            {cardType === 'score_card' && <ScoreCard d={scoreCard} />}
            {cardType === 'data_story' && <DataStoryCard d={dataStory} />}
            {cardType === 'before_after' && <BeforeAfterCard d={beforeAfter} />}
            {cardType === 'city_comparison' && <CityComparisonCard d={comparison} />}
          </div>

          {/* Export buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {exporting ? 'Exporting...' : 'Download PNG'}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <p className="text-xs text-gray-400">PNG exports at 3× resolution (1680px wide) — ideal for social sharing</p>
        </div>
      </div>
    </div>
  );
}

// ─── Form sub-components ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300';

function ScoreCardForm({ data, onChange }: { data: ScoreCardData; onChange: (d: ScoreCardData) => void }) {
  const f = (k: keyof ScoreCardData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = typeof data[k] === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    onChange({ ...data, [k]: v });
  };
  return (
    <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input className={inputCls} value={data.city} onChange={f('city')} placeholder="Oslo" /></Field>
        <Field label="Country"><input className={inputCls} value={data.country} onChange={f('country')} placeholder="Norway" /></Field>
      </div>
      <Field label="Overall Score (0–10)">
        <input type="number" min={0} max={10} step={0.1} className={inputCls} value={data.score} onChange={f('score')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Safety Score"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={data.safetyScore} onChange={f('safetyScore')} /></Field>
        <Field label="Transit Score"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={data.transitScore} onChange={f('transitScore')} /></Field>
        <Field label="Comfort Score"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={data.comfortScore} onChange={f('comfortScore')} /></Field>
        <Field label="Interest Score"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={data.interestScore} onChange={f('interestScore')} /></Field>
      </div>
      <Field label="Top Strength"><input className={inputCls} value={data.topStrength} onChange={f('topStrength')} /></Field>
      <Field label="Key Concern"><input className={inputCls} value={data.topConcern} onChange={f('topConcern')} /></Field>
    </div>
  );
}

function DataStoryForm({ data, onChange }: { data: DataStoryData; onChange: (d: DataStoryData) => void }) {
  const f = (k: keyof DataStoryData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value });
  return (
    <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
      <Field label="Headline (top label)"><input className={inputCls} value={data.headline} onChange={f('headline')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Big Stat"><input className={inputCls} value={data.stat} onChange={f('stat')} placeholder="43K" /></Field>
        <Field label="Unit"><input className={inputCls} value={data.unit} onChange={f('unit')} placeholder="deaths/yr" /></Field>
      </div>
      <Field label="Context sentence">
        <textarea className={inputCls} rows={2} value={data.context} onChange={f('context')} style={{ resize: 'none' }} />
      </Field>
      <Field label="Fact 1"><input className={inputCls} value={data.fact1} onChange={f('fact1')} /></Field>
      <Field label="Fact 2"><input className={inputCls} value={data.fact2} onChange={f('fact2')} /></Field>
      <Field label="Fact 3"><input className={inputCls} value={data.fact3} onChange={f('fact3')} /></Field>
      <Field label="Source"><input className={inputCls} value={data.source} onChange={f('source')} /></Field>
    </div>
  );
}

function BeforeAfterForm({ data, onChange }: { data: BeforeAfterData; onChange: (d: BeforeAfterData) => void }) {
  const f = (k: keyof BeforeAfterData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value });
  return (
    <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input className={inputCls} value={data.city} onChange={f('city')} /></Field>
        <Field label="Period"><input className={inputCls} value={data.period} onChange={f('period')} placeholder="2018 → 2023" /></Field>
      </div>
      <Field label="Intervention"><input className={inputCls} value={data.intervention} onChange={f('intervention')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs font-bold text-red-500 uppercase tracking-wide">Before</div>
          <Field label="Stat 1"><input className={inputCls} value={data.beforeStat1} onChange={f('beforeStat1')} /></Field>
          <Field label="Label 1"><input className={inputCls} value={data.beforeStat1Label} onChange={f('beforeStat1Label')} /></Field>
          <Field label="Stat 2"><input className={inputCls} value={data.beforeStat2} onChange={f('beforeStat2')} /></Field>
          <Field label="Label 2"><input className={inputCls} value={data.beforeStat2Label} onChange={f('beforeStat2Label')} /></Field>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-green-600 uppercase tracking-wide">After</div>
          <Field label="Stat 1"><input className={inputCls} value={data.afterStat1} onChange={f('afterStat1')} /></Field>
          <Field label="Label 1"><input className={inputCls} value={data.afterStat1Label} onChange={f('afterStat1Label')} /></Field>
          <Field label="Stat 2"><input className={inputCls} value={data.afterStat2} onChange={f('afterStat2')} /></Field>
          <Field label="Label 2"><input className={inputCls} value={data.afterStat2Label} onChange={f('afterStat2Label')} /></Field>
        </div>
      </div>
      <Field label="Key lesson (quote)">
        <textarea className={inputCls} rows={2} value={data.lessonLearned} onChange={f('lessonLearned')} style={{ resize: 'none' }} />
      </Field>
    </div>
  );
}

function ComparisonForm({ data, onChange }: { data: CityComparisonData; onChange: (d: CityComparisonData) => void }) {
  const updateCity = (i: number, k: keyof ComparisonCity, v: string | number) => {
    const cities = [...data.cities];
    cities[i] = { ...cities[i], [k]: v };
    onChange({ ...data, cities });
  };
  return (
    <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
      <Field label="Title"><input className={inputCls} value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} /></Field>
      <Field label="Metric label"><input className={inputCls} value={data.metric} onChange={e => onChange({ ...data, metric: e.target.value })} /></Field>

      {data.cities.map((city, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-gray-500 uppercase">City {i + 1}</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name"><input className={inputCls} value={city.name} onChange={e => updateCity(i, 'name', e.target.value)} /></Field>
            <Field label="Score"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={city.score} onChange={e => updateCity(i, 'score', parseFloat(e.target.value) || 0)} /></Field>
            <Field label="Fatalities"><input className={inputCls} value={city.fatalities} onChange={e => updateCity(i, 'fatalities', e.target.value)} placeholder="3.2/100k" /></Field>
            <Field label="Transit mode"><input className={inputCls} value={city.transitMode} onChange={e => updateCity(i, 'transitMode', e.target.value)} placeholder="63% cycling" /></Field>
          </div>
        </div>
      ))}

      <Field label="Key insight">
        <textarea className={inputCls} rows={2} value={data.insight} onChange={e => onChange({ ...data, insight: e.target.value })} style={{ resize: 'none' }} />
      </Field>
    </div>
  );
}
