import type { WalkabilityScoreV2 } from '../../types';

interface PersonaCardsProps {
  compositeScore: WalkabilityScoreV2;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

interface PersonaResult {
  icon: string;
  question: string;
  verdict: 'yes' | 'borderline' | 'unlikely';
  reason: string;
}

function computePersonas(cs: WalkabilityScoreV2): PersonaResult[] {
  const { networkDesign, environmentalComfort, safety, densityContext } = cs.components;

  // Car-free viability: network connectivity + access to daily needs
  const carFreeScore = networkDesign.score * 0.5 + densityContext.score * 0.5;
  const carFree: PersonaResult = {
    icon: '🚗',
    question: 'Can I go car-free here?',
    verdict: carFreeScore >= 65 ? 'yes' : carFreeScore >= 42 ? 'borderline' : 'unlikely',
    reason:
      carFreeScore >= 65
        ? 'Strong street network and good access to daily needs.'
        : carFreeScore >= 42
        ? 'Possible for some trips — a car still helps for others.'
        : 'Limited destinations and connectivity make a car hard to avoid.',
  };

  // Kid-friendly walking: safety + network + green environment
  const kidScore = safety.score * 0.4 + networkDesign.score * 0.35 + environmentalComfort.score * 0.25;
  const kids: PersonaResult = {
    icon: '🧒',
    question: 'Safe for kids to walk?',
    verdict: kidScore >= 65 ? 'yes' : kidScore >= 42 ? 'borderline' : 'unlikely',
    reason:
      kidScore >= 65
        ? 'Good crossings, connected streets, and a comfortable environment.'
        : kidScore >= 42
        ? 'Some streets are fine — others need adult supervision.'
        : 'Infrastructure gaps make independent walking challenging for children.',
  };

  // Aging in place: accessible destinations + safe streets + comfort
  const agingScore = densityContext.score * 0.4 + safety.score * 0.35 + environmentalComfort.score * 0.25;
  const aging: PersonaResult = {
    icon: '🧓',
    question: 'Good for aging in place?',
    verdict: agingScore >= 65 ? 'yes' : agingScore >= 42 ? 'borderline' : 'unlikely',
    reason:
      agingScore >= 65
        ? 'Services reachable on foot, safe streets, comfortable environment.'
        : agingScore >= 42
        ? 'Works for some needs — a car or transit helps for others.'
        : 'A car is likely essential for most daily needs here.',
  };

  return [carFree, kids, aging];
}

const VERDICT_STYLE: Record<'yes' | 'borderline' | 'unlikely', { label: string; bg: string; text: string; dot: string }> = {
  yes:       { label: 'Yes',       bg: 'rgba(34,197,94,0.08)',  text: '#16a34a', dot: '#22c55e' },
  borderline:{ label: 'Borderline',bg: 'rgba(234,179,8,0.08)',  text: '#a16207', dot: '#eab308' },
  unlikely:  { label: 'Unlikely',  bg: 'rgba(239,68,68,0.08)',  text: '#b91c1c', dot: '#ef4444' },
};

export default function PersonaCards({ compositeScore, isPremium, onUpgradeClick }: PersonaCardsProps) {
  const personas = computePersonas(compositeScore);

  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#8a9a8a' }}>
        QUICK ANSWERS FOR YOUR SITUATION
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {personas.map((p) => {
          const style = VERDICT_STYLE[p.verdict];
          return (
            <div
              key={p.question}
              className="rounded-xl p-3"
              style={{ backgroundColor: isPremium ? style.bg : 'rgba(240,235,224,0.4)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{p.icon}</span>
                <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>{p.question}</span>
              </div>
              <div
                className="flex items-center gap-1.5 mb-1.5"
                style={{ filter: isPremium ? 'none' : 'blur(3px)', userSelect: isPremium ? 'auto' : 'none' }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: style.dot }}
                />
                <span className="text-sm font-bold" style={{ color: style.text }}>{style.label}</span>
              </div>
              <p
                className="text-xs leading-relaxed"
                style={{ color: '#4a5a4a', filter: isPremium ? 'none' : 'blur(3px)', userSelect: isPremium ? 'auto' : 'none' }}
              >
                {p.reason}
              </p>
            </div>
          );
        })}
      </div>

      {!isPremium && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: '#f0ebe0' }}>
          <span className="text-xs" style={{ color: '#8a9a8a' }}>Unlock verdicts for this address</span>
          <button
            onClick={onUpgradeClick}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: '#2a3a2a', color: 'white' }}
          >
            Unlock Pro →
          </button>
        </div>
      )}
    </div>
  );
}
