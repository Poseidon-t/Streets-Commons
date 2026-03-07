import type { WalkabilityScoreV2 } from '../../types';
import { computePersonas } from '../../utils/personas';

interface PersonaChipsProps {
  compositeScore: WalkabilityScoreV2 | null;
}

const CHIP_PERSONAS = [
  { key: 'Car-Free Living', icon: '🚶', label: 'Car-Free Living' },
  { key: 'Families',        icon: '👨‍👩‍👧', label: 'Families'        },
  { key: 'Older Adults',    icon: '🧓', label: 'Older Adults'    },
];

function retroColor(score: number): string {
  if (score >= 65) return '#2a5224';
  if (score >= 42) return '#d4920c';
  return '#b8401a';
}

function stampClass(score: number): string {
  if (score >= 65) return 'retro-stamp retro-stamp-green';
  if (score >= 42) return 'retro-stamp retro-stamp-amber';
  return 'retro-stamp retro-stamp-red';
}

export default function PersonaChips({ compositeScore }: PersonaChipsProps) {
  if (!compositeScore) {
    return (
      <div className="retro-card">
        <div className="retro-card-header">
          <span className="retro-card-header-title">Who this works for</span>
          <span className="retro-card-header-meta">Score /100</span>
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < 2 ? '1px solid #c4b59a' : 'none' }}>
            <div className="animate-pulse" style={{ width: 20, height: 20, background: '#c4b59a' }} />
            <div className="animate-pulse" style={{ height: 12, width: [80, 56, 76][i], background: '#d8d0c4' }} />
            <div className="animate-pulse" style={{ height: 20, width: 60, background: '#c4b59a', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    );
  }

  const all = computePersonas(compositeScore);
  const chips = CHIP_PERSONAS.map(({ key, icon, label }) => {
    const p = all.find(x => x.name === key)!;
    return { icon, label, score: p.score, verdict: p.verdictLabel };
  });

  return (
    <div className="retro-card">
      <div className="retro-card-header">
        <span className="retro-card-header-title">Who this works for</span>
        <span className="retro-card-header-meta">Score /100</span>
      </div>
      {chips.map(({ icon, label, score, verdict }, i) => {
        const color = retroColor(score);
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 16px',
              borderBottom: i < chips.length - 1 ? '1px solid #c4b59a' : 'none',
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#1e1608', lineHeight: 1.2 }}>
                {label}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {score}
              </span>
              <span style={{ fontSize: 9, color: '#bfb09a', marginLeft: 2 }}>/100</span>
            </div>
            <span className={stampClass(score)}>{verdict}</span>
          </div>
        );
      })}
    </div>
  );
}
