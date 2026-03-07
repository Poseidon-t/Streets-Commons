import type { ComponentScore, StreetCharacterAnalysis, StreetNetworkType } from '../../types';

interface StreetNetworkPanelProps {
  networkDesign: ComponentScore;
  streetCharacter: StreetCharacterAnalysis | null;
  streetCharacterLoading: boolean;
}

const TYPE_STYLE: Record<StreetNetworkType, { bg: string; text: string; border: string }> = {
  'Complete Streets':     { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  'Well-Connected Grid':  { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  'Organic Urban':        { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'Mixed Pattern':        { bg: '#fef9c3', text: '#a16207', border: '#fde047' },
  'Car-Centric Grid':     { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  'Suburban Sprawl':      { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  'Disconnected Network': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

// Friendly display names for the 4 sub-metrics
const METRIC_DISPLAY: Record<string, { label: string; icon: string; goodHigh: boolean }> = {
  'Intersection Density': { label: 'Grid Connectivity', icon: '⊕', goodHigh: true },
  'Block Length':         { label: 'Block Scale',       icon: '⟷', goodHigh: true },
  'Network Density':      { label: 'Network Density',   icon: '≡', goodHigh: true },
  'Dead-End Ratio':       { label: 'Route Directness',  icon: '↩', goodHigh: true },
};

function barColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 55) return '#84cc16';
  if (score >= 35) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function SubMetricBar({ name, score, rawValue }: { name: string; score: number; rawValue?: string }) {
  const display = METRIC_DISPLAY[name];
  const label = display?.label ?? name;

  if (score === 0) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-36 flex-shrink-0">
          <div className="text-xs font-medium" style={{ color: '#2a2010' }}>{label}</div>
          {rawValue && <div className="text-xs" style={{ color: '#8a9a8a' }}>{rawValue}</div>}
        </div>
        <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#f0ebe0' }} />
        <div className="w-10 text-right text-xs flex-shrink-0" style={{ color: '#b0a8a0' }}>—</div>
      </div>
    );
  }

  const color = barColor(score);
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 flex-shrink-0">
        <div className="text-xs font-medium" style={{ color: '#2a2010' }}>{label}</div>
        {rawValue && (
          <div className="text-xs" style={{ color: '#8a9a8a' }}>{rawValue}</div>
        )}
      </div>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(score, 2)}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-10 text-right text-xs font-semibold flex-shrink-0" style={{ color }}>
        {score}
      </div>
    </div>
  );
}

const SKELETON_WIDTHS: Record<string, string> = { 'full': '100%', '4/5': '80%', '3/5': '60%', '1/2': '50%', '2/5': '40%', '1/3': '33%' };

function SkeletonLine({ w = 'full' }: { w?: string }) {
  return (
    <div
      className="h-3 rounded animate-pulse"
      style={{ backgroundColor: '#e8e3d8', width: SKELETON_WIDTHS[w] ?? '100%' }}
    />
  );
}

export default function StreetNetworkPanel({
  networkDesign,
  streetCharacter,
  streetCharacterLoading,
}: StreetNetworkPanelProps) {
  const hasMetrics = networkDesign.metrics.length > 0 && networkDesign.score > 0;
  if (!hasMetrics) return null;

  const typeStyle = streetCharacter
    ? (TYPE_STYLE[streetCharacter.type] ?? TYPE_STYLE['Mixed Pattern'])
    : null;

  return (
    <div className="retro-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="retro-card-header">
        <span className="retro-card-header-title">Street Network Analysis</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: barColor(networkDesign.score), fontVariantNumeric: 'tabular-nums' }}>
            {(networkDesign.score / 10).toFixed(1)}/10
          </span>
          {streetCharacterLoading && !streetCharacter && (
            <div className="animate-pulse" style={{ height: 20, width: 80, background: '#d8d0c4' }} />
          )}
          {streetCharacter && typeStyle && (
            <span className="retro-stamp" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderColor: typeStyle.border }}>
              {streetCharacter.type}
            </span>
          )}
        </div>
      </div>

      {/* AI Assessment */}
      <div style={{ padding: '14px 18px 10px' }}>
        {streetCharacterLoading && !streetCharacter ? (
          <div className="space-y-2">
            <SkeletonLine w="full" />
            <SkeletonLine w="4/5" />
            <SkeletonLine w="3/5" />
          </div>
        ) : streetCharacter ? (
          <p className="text-sm leading-relaxed" style={{ color: '#2a2010' }}>
            {streetCharacter.assessment}
          </p>
        ) : null}
      </div>

      {/* Sub-metric bars */}
      <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {networkDesign.metrics.map((m) => (
          <SubMetricBar key={m.name} name={m.name} score={m.score} rawValue={m.rawValue} />
        ))}
      </div>

      {/* Strength / Concern callout */}
      {streetCharacter && (
        <div
          style={{ margin: '0 18px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 14, border: '1px solid #c4b59a', background: '#f8f6f1' }}
        >
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: '#16a34a' }}
            >
              Strength
            </div>
            <div className="text-sm" style={{ color: '#1a1208' }}>
              {streetCharacter.strength}
            </div>
          </div>
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: '#dc2626' }}
            >
              Challenge
            </div>
            <div className="text-sm" style={{ color: '#1a1208' }}>
              {streetCharacter.concern}
            </div>
          </div>
        </div>
      )}

      {/* Source note */}
      <div
        style={{ padding: '0 18px 14px', fontSize: 12, color: '#3d3020', fontWeight: 600 }}
      >
        Source: OpenStreetMap network topology · 800m radius · Street character analysis
      </div>
    </div>
  );
}
