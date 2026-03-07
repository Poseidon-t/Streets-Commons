import type { WalkabilityScoreV2 } from '../../types';
import { computePersonas } from '../../utils/personas';
import { PedestrianFigure, FamilyFigure, ElderFigure } from '../RetroIcons';

interface PersonaChipsProps {
  compositeScore: WalkabilityScoreV2 | null;
}

const CHIP_PERSONAS = [
  { key: 'Car-Free Living', label: 'Car-Free Living' },
  { key: 'Families',        label: 'Families'        },
  { key: 'Older Adults',    label: 'Older Adults'    },
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

const CAPTIONS: Record<string, (n: number) => string> = {
  'Car-Free Living': (n) => `${n} of 10 car-free residents thrive here`,
  'Families':        (n) => `${n} of 10 families find this workable`,
  'Older Adults':    (n) => `${n} of 10 older adults navigate comfortably`,
};

function FigureRow({ personaKey, score, color }: { personaKey: string; score: number; color: string }) {
  const filled = Math.min(10, Math.max(0, Math.round(score / 10)));
  const empty = 10 - filled;

  // Per-persona figure type and size
  const isFamilies = personaKey === 'Families';
  const isElders = personaKey === 'Older Adults';
  const FigureComponent = isFamilies ? FamilyFigure : isElders ? ElderFigure : PedestrianFigure;
  const [fw, fh] = isFamilies ? [13, 11] : [9, 14];

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {Array.from({ length: filled }).map((_, i) => (
          <FigureComponent key={`f-${i}`} color={color} width={fw} height={fh} />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <FigureComponent key={`e-${i}`} color="#c4b59a" opacity={0.4} width={fw} height={fh} />
        ))}
      </div>
      <div style={{ fontSize: 8, color: '#8a7a60', marginTop: 3, letterSpacing: '0.06em' }}>
        {CAPTIONS[personaKey]?.(filled)}
      </div>
    </div>
  );
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
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: i < 2 ? '1px solid #c4b59a' : 'none' }}>
            <div className="animate-pulse" style={{ width: 20, height: 20, background: '#c4b59a', marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div className="animate-pulse" style={{ height: 11, width: [80, 56, 76][i], background: '#d8d0c4', marginBottom: 6 }} />
              <div className="animate-pulse" style={{ height: 14, width: 120, background: '#e0d8cc' }} />
            </div>
            <div className="animate-pulse" style={{ height: 20, width: 60, background: '#c4b59a', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    );
  }

  const all = computePersonas(compositeScore);
  const chips = CHIP_PERSONAS.map(({ key, label }) => {
    const p = all.find(x => x.name === key)!;
    return { key, label, score: p.score, verdict: p.verdictLabel };
  });

  return (
    <div className="retro-card">
      <div className="retro-card-header">
        <span className="retro-card-header-title">Who this works for</span>
        <span className="retro-card-header-meta">Score /100</span>
      </div>
      {chips.map(({ key, label, score, verdict }, i) => {
        const color = retroColor(score);
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 16px',
              borderBottom: i < chips.length - 1 ? '1px solid #c4b59a' : 'none',
            }}
          >
            {/* Persona icon (SVG pictogram) */}
            <div style={{ flexShrink: 0, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
              {key === 'Families'
                ? <FamilyFigure color={color} width={20} height={18} />
                : key === 'Older Adults'
                ? <ElderFigure color={color} width={13} height={18} />
                : <PedestrianFigure color={color} width={11} height={18} />
              }
            </div>

            {/* Name + figure row */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#1e1608', lineHeight: 1.2 }}>
                {label}
              </div>
              <FigureRow personaKey={key} score={score} color={color} />
            </div>

            {/* Score + verdict */}
            <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {score}
                </span>
                <span style={{ fontSize: 9, color: '#8a7a60', marginLeft: 2 }}>/100</span>
              </div>
              <span className={stampClass(score)}>{verdict}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
