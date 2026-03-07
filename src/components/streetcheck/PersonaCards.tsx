import type { WalkabilityScoreV2 } from '../../types';
import { computePersonas, scoreColor } from '../../utils/personas';

interface PersonaCardsProps {
  compositeScore: WalkabilityScoreV2 | null;
}

const PERSONA_NAMES = ['Daily Commuter', 'Families', 'Older Adults', 'Car-Free Living', 'Remote Workers'];
const SKELETON_NAME_WIDTHS = [88, 56, 76, 84, 96];
const SKELETON_SUB_WIDTHS  = [160, 128, 148, 136, 120];

function PersonaCardsSkeleton() {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}
    >
      <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#e0dbd0' }}>
        <div className="h-2.5 w-36 rounded" style={{ backgroundColor: '#e8e3d8' }} />
        <div className="h-2.5 w-14 rounded" style={{ backgroundColor: '#e8e3d8' }} />
      </div>
      <div className="divide-y" style={{ borderColor: '#f0ebe2' }}>
        {PERSONA_NAMES.map((_, i) => (
          <div key={i} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3">
            <div className="w-[3px] self-stretch rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: '#e8e3d8', minHeight: 36 }} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3 rounded animate-pulse" style={{ width: SKELETON_NAME_WIDTHS[i], backgroundColor: '#e8e3d8' }} />
              <div className="h-2.5 rounded animate-pulse" style={{ width: SKELETON_SUB_WIDTHS[i], backgroundColor: '#f0ede5' }} />
            </div>
            <div className="w-20 sm:w-28 flex-shrink-0">
              <div className="h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
            </div>
            <div className="text-right flex-shrink-0 w-[88px] space-y-1.5">
              <div className="h-3 w-8 rounded animate-pulse ml-auto" style={{ backgroundColor: '#e8e3d8' }} />
              <div className="h-2 w-16 rounded animate-pulse ml-auto" style={{ backgroundColor: '#f0ede5' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { PersonaResult } from '../../utils/personas';

function PersonaRow({ name, subtitle, score, verdictLabel: verdict }: PersonaResult) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3">
      {/* Vertical accent bar */}
      <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color, minHeight: 36 }} />

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight" style={{ color: '#2a3a2a' }}>{name}</div>
        <div className="text-xs mt-0.5 leading-snug" style={{ color: '#8a9a8a' }}>{subtitle}</div>
      </div>

      {/* Score bar */}
      <div className="w-20 sm:w-28 flex-shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e3d8' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.max(score, 2)}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* Score + verdict */}
      <div className="text-right flex-shrink-0 w-[88px]">
        <div className="text-sm font-bold tabular-nums leading-tight" style={{ color }}>{score}</div>
        <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8a9a8a' }}>{verdict}</div>
      </div>
    </div>
  );
}

export default function PersonaCards({ compositeScore }: PersonaCardsProps) {
  if (!compositeScore) return <PersonaCardsSkeleton />;

  const personas = computePersonas(compositeScore);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}
    >
      {/* Header */}
      <div
        className="px-4 sm:px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: '#e0dbd0' }}
      >
        <h3
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: '#8a9a8a', letterSpacing: '0.08em' }}
        >
          Who this street works for
        </h3>
        <span className="text-xs" style={{ color: '#b0bab0' }}>score / 100</span>
      </div>

      {/* Persona rows */}
      <div className="divide-y" style={{ borderColor: '#f0ebe2' }}>
        {personas.map(p => (
          <PersonaRow key={p.name} {...p} />
        ))}
      </div>
    </div>
  );
}
