import type { WalkabilityScoreV2 } from '../../types';
import { computePersonas, scoreColor } from '../../utils/personas';
import type { PersonaResult } from '../../utils/personas';

interface PersonaCardsProps {
  compositeScore: WalkabilityScoreV2 | null;
  inline?: boolean;
}

const PERSONA_NAMES = ['Daily Commuter', 'Families', 'Older Adults', 'Car-Free Living', 'Remote Workers'];
const SKELETON_NAME_WIDTHS = [88, 56, 76, 84, 96];

function retroColor(score: number): string {
  if (score >= 65) return '#1a7a28';
  if (score >= 42) return '#b87a00';
  return '#b8401a';
}

function verdictStampClass(score: number): string {
  if (score >= 65) return 'retro-stamp retro-stamp-green';
  if (score >= 42) return 'retro-stamp retro-stamp-amber';
  return 'retro-stamp retro-stamp-red';
}

function PersonaCardsSkeleton() {
  return (
    <div className="retro-card" style={{ overflow: 'hidden' }}>
      <div className="retro-card-header">
        <span className="retro-card-header-title">Who is this area good for?</span>
        <span className="retro-card-header-meta">Score / 10</span>
      </div>
      {PERSONA_NAMES.map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < 4 ? '1px solid #c4b59a' : 'none' }}>
          <div style={{ width: 3, minHeight: 32, background: '#c4b59a', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="animate-pulse" style={{ height: 11, width: SKELETON_NAME_WIDTHS[i], background: '#d8d0c4', marginBottom: 4 }} />
            <div className="animate-pulse" style={{ height: 9, width: 130, background: '#e0d8cc' }} />
          </div>
          <div className="animate-pulse" style={{ width: 90, height: 8, background: '#d8d0c4' }} />
          <div className="animate-pulse" style={{ width: 28, height: 20, background: '#d8d0c4' }} />
        </div>
      ))}
    </div>
  );
}

function PersonaRow({ name, subtitle, score, verdictLabel: verdict }: PersonaResult) {
  const color = retroColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #c4b59a' }}>
      {/* Accent bar */}
      <div style={{ width: 3, alignSelf: 'stretch', minHeight: 36, background: color, flexShrink: 0, borderRadius: 1 }} />

      {/* Name + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: '#1a3a1a', lineHeight: 1.2 }}>
          {name}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2010', marginTop: 3, lineHeight: 1.4 }}>{subtitle}</div>
      </div>

      {/* Bar */}
      <div style={{ width: 80, flexShrink: 0, display: 'none' }} className="sm:block">
        <div style={{ height: 6, border: '1px solid #c4b59a', background: 'rgba(255,255,255,0.4)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(score, 2)}%`, background: color }} />
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{(score / 10).toFixed(1)}</div>
      </div>

      {/* Verdict stamp */}
      <span className={verdictStampClass(score)}>{verdict}</span>
    </div>
  );
}

export default function PersonaCards({ compositeScore, inline }: PersonaCardsProps) {
  if (!compositeScore) return <PersonaCardsSkeleton />;

  const personas = computePersonas(compositeScore);

  const content = (
    <>
      <div style={inline ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px 8px' } : undefined} className={inline ? undefined : 'retro-card-header'}>
        <span style={inline ? { fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#3d3020' } : undefined} className={inline ? undefined : 'retro-card-header-title'}>Who is this area good for?</span>
        <span style={inline ? { fontSize: 12, fontWeight: 600, color: '#5a5040' } : undefined} className={inline ? undefined : 'retro-card-header-meta'}>Score / 10</span>
      </div>
      <div style={inline ? { padding: '0 10px 10px' } : undefined}>
        {personas.map((p, i) => (
          <div key={p.name} style={{ borderBottom: i < personas.length - 1 ? '1px solid #c4b59a' : 'none' }}>
            <PersonaRow {...p} />
          </div>
        ))}
      </div>
    </>
  );

  if (inline) return <div>{content}</div>;

  return (
    <div className="retro-card" style={{ overflow: 'hidden' }}>
      {content}
    </div>
  );
}
