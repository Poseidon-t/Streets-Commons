import type { WalkabilityScoreV2 } from '../../types';
import { computePersonas, scoreColor } from '../../utils/personas';

interface PersonaChipsProps {
  compositeScore: WalkabilityScoreV2 | null;
}

const CHIP_PERSONAS = [
  { key: 'Car-Free Living', icon: '🚗', label: 'Car-Free Living' },
  { key: 'Families',        icon: '👧', label: 'Families'        },
  { key: 'Older Adults',    icon: '🧓', label: 'Older Adults'    },
];

function VerdictBadge({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score);
  const bg =
    score >= 65 ? 'rgba(34,197,94,0.10)'  :
    score >= 42 ? 'rgba(234,179,8,0.10)'  :
                  'rgba(239,68,68,0.10)';
  const border =
    score >= 65 ? 'rgba(34,197,94,0.25)'  :
    score >= 42 ? 'rgba(234,179,8,0.25)'  :
                  'rgba(239,68,68,0.25)';
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
      style={{ backgroundColor: bg, borderColor: border, color }}
    >
      {label}
    </span>
  );
}

function PersonaChipsSkeleton() {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}
    >
      <div className="divide-y" style={{ borderColor: '#f0ebe2' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <div className="w-5 h-5 rounded-full animate-pulse" style={{ backgroundColor: '#e0dbd0' }} />
            <div className="h-3 rounded animate-pulse" style={{ width: [80, 56, 76][i], backgroundColor: '#e8e3d8' }} />
            <div className="ml-auto h-4 w-20 rounded-full animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PersonaChips({ compositeScore }: PersonaChipsProps) {
  if (!compositeScore) return <PersonaChipsSkeleton />;

  const all = computePersonas(compositeScore);
  const chips = CHIP_PERSONAS.map(({ key, icon, label }) => {
    const p = all.find(x => x.name === key)!;
    return { icon, label, score: p.score, verdict: p.verdictLabel };
  });

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}
    >
      <div className="divide-y" style={{ borderColor: '#f0ebe2' }}>
        {chips.map(({ icon, label, score, verdict }) => (
          <div key={label} className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <span className="text-base" aria-hidden="true">{icon}</span>
            <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{label}</span>
            <div className="ml-auto">
              <VerdictBadge label={verdict} score={score} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
