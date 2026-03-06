/**
 * Walker Infographic — playful visualization of walkability score.
 * Shows 10 walking figures: colored ones = feel safe, grey ones = don't.
 *
 * Accepts score on 0-10 scale (rounded to nearest integer for walker count).
 * Works in both Tailwind (className) and inline-style contexts.
 */

interface WalkerInfographicProps {
  /** Walkability score on 0-10 scale */
  score: number;
  /** Use inline styles instead of Tailwind (for print/PDF contexts) */
  inline?: boolean;
  /** When true: no top/bottom border or vertical margin — for use inside a card */
  compact?: boolean;
}

function getColor(score: number): string {
  if (score >= 8) return '#22c55e';   // green
  if (score >= 6) return '#e07850';   // warm orange
  if (score >= 4) return '#f59e0b';   // amber
  return '#ef4444';                   // red
}

export default function WalkerInfographic({ score, inline, compact }: WalkerInfographicProps) {
  const filled = Math.max(0, Math.min(10, Math.round(score)));
  const empty = 10 - filled;
  const color = getColor(score);

  if (inline) {
    return (
      <div style={{ padding: '1.5rem 0', margin: '1.5rem 0', borderTop: '1px solid #e0dbd0', borderBottom: '1px solid #e0dbd0' }}>
        <p style={{ textAlign: 'center', fontSize: '0.9375rem', color: '#6b7a6b', marginBottom: '1rem' }}>
          Out of 10 people, how many could walk here comfortably?
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {Array.from({ length: filled }).map((_, i) => (
            <span key={`f-${i}`} style={{ fontSize: '2rem' }}>🚶</span>
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <span key={`e-${i}`} style={{ fontSize: '2rem', opacity: 0.2, filter: 'grayscale(1)' }}>🚶</span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>
            {filled} feel comfortable
          </span>
          {empty > 0 && (
            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
              {empty} would find it difficult
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'pt-4 mt-4 border-t' : 'py-6 my-6 border-t border-b'} style={{ borderColor: '#e0dbd0' }}>
      <p className="text-center text-sm mb-4" style={{ color: '#6b7a6b' }}>
        Out of 10 people, how many could walk here comfortably?
      </p>
      <div className="flex items-center justify-center gap-2 mb-3">
        {Array.from({ length: filled }).map((_, i) => (
          <span key={`f-${i}`} className="text-3xl transition-transform hover:scale-110">🚶</span>
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <span key={`e-${i}`} className="text-3xl opacity-20 grayscale">🚶</span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6">
        <span className="text-sm font-semibold" style={{ color }}>
          {filled} feel comfortable
        </span>
        {empty > 0 && (
          <span className="text-sm" style={{ color: '#9ca3af' }}>
            {empty} would find it difficult
          </span>
        )}
      </div>
    </div>
  );
}
