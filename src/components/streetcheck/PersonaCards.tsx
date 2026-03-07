import type { WalkabilityScoreV2 } from '../../types';
import { computePersonas, scoreColor } from '../../utils/personas';
import type { PersonaResult } from '../../utils/personas';

interface PersonaCardsProps {
  compositeScore: WalkabilityScoreV2 | null;
}

const PERSONA_NAMES = ['Daily Commuter', 'Families', 'Older Adults', 'Car-Free Living', 'Remote Workers'];
const SKELETON_NAME_WIDTHS = [88, 56, 76, 84, 96];

function retroColor(score: number): string {
  if (score >= 65) return '#2a5224';
  if (score >= 42) return '#d4920c';
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
        <span className="retro-card-header-title">Pedestrian Persona Assessment</span>
        <span className="retro-card-header-meta">Score / 100</span>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #c4b59a' }}>
      {/* Accent bar */}
      <div style={{ width: 3, alignSelf: 'stretch', minHeight: 32, background: color, flexShrink: 0, borderRadius: 1 }} />

      {/* Name + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#1e1608', lineHeight: 1.2 }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: '#5c4a2c', marginTop: 2, lineHeight: 1.3 }}>{subtitle}</div>
      </div>

      {/* Bar */}
      <div style={{ width: 80, flexShrink: 0, display: 'none' }} className="sm:block">
        <div style={{ height: 6, border: '1px solid #c4b59a', background: 'rgba(255,255,255,0.4)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(score, 2)}%`, background: color }} />
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{score}</div>
      </div>

      {/* Verdict stamp */}
      <span className={verdictStampClass(score)}>{verdict}</span>
    </div>
  );
}

export default function PersonaCards({ compositeScore }: PersonaCardsProps) {
  if (!compositeScore) return <PersonaCardsSkeleton />;

  const personas = computePersonas(compositeScore);

  return (
    <div className="retro-card" style={{ overflow: 'hidden' }}>
      <div className="retro-card-header">
        <span className="retro-card-header-title">Pedestrian Persona Assessment</span>
        <span className="retro-card-header-meta">Score / 100</span>
      </div>
      <div>
        {personas.map((p, i) => (
          <div key={p.name} style={{ borderBottom: i < personas.length - 1 ? '1px solid #c4b59a' : 'none' }}>
            <PersonaRow {...p} />
          </div>
        ))}
      </div>
    </div>
  );
}
