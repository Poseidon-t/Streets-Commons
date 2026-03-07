/**
 * Walker Infographic — retro urbanism pictographic visualization.
 *
 * Shows 10 DOT/Aicher-style pedestrian figures:
 * colored = walk here comfortably, ghost = would find it difficult.
 *
 * Inspired by the 1974 AIGA transportation symbol system.
 */
import { PedestrianFigure } from './RetroIcons';

interface WalkerInfographicProps {
  /** Walkability score on 0-10 scale */
  score: number;
  /** Use inline styles instead of Tailwind (for print/PDF contexts) */
  inline?: boolean;
  /** When true: no top/bottom border or vertical margin — for use inside a card */
  compact?: boolean;
}

function retroColor(score: number): string {
  if (score >= 8) return '#1a7a28';
  if (score >= 6) return '#b87a00';
  return '#b8401a';
}

export default function WalkerInfographic({ score, inline, compact }: WalkerInfographicProps) {
  const filled = Math.max(0, Math.min(10, Math.round(score)));
  const empty = 10 - filled;
  const color = retroColor(score);

  const borderStyle = inline
    ? { borderTop: '1px solid #c4b59a', borderBottom: '1px solid #c4b59a', padding: '1.25rem 0', margin: '1.25rem 0' }
    : compact
    ? { borderTop: '1px solid #c4b59a', paddingTop: '1rem', marginTop: '1rem' }
    : { borderTop: '1px solid #c4b59a', borderBottom: '1px solid #c4b59a', padding: '1.25rem 0', margin: '1.25rem 0' };

  return (
    <div style={borderStyle}>
      {/* Label */}
      <p style={{
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#3d3020',
        marginBottom: 10,
      }}>
        Out of 10 people, how many walk here comfortably?
      </p>

      {/* Figures row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginBottom: 10 }}>
        {Array.from({ length: filled }).map((_, i) => (
          <PedestrianFigure key={`f-${i}`} color={color} width={13} height={22} />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <PedestrianFigure key={`e-${i}`} color="#c4b59a" opacity={0.7} width={13} height={22} />
        ))}
      </div>

      {/* Verdict line */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color }}>
          {filled} feel comfortable
        </span>
        {empty > 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: '#5a4a30' }}>
            {empty} find it difficult
          </span>
        )}
      </div>
    </div>
  );
}
