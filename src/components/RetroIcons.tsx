/**
 * Retro Urbanism Pictograms
 *
 * Inspired by the 1974 AIGA/DOT transportation symbol system and
 * Otl Aicher's 1972 Munich Olympics pictogram language.
 *
 * Design rules:
 * - Circle head (proportionally large, as in AIGA style)
 * - Geometric filled body, no strokes
 * - Dynamic stride: arms and legs counterbalance
 * - No ornamentation  -  pure gesture
 */

interface FigureProps {
  color?: string;
  opacity?: number;
  width?: number;
  height?: number;
}

/**
 * Single pedestrian in walking stride.
 * Used in WalkerInfographic (10× row) and Car-Free Living chip.
 */
export function PedestrianFigure({ color = '#1e1608', opacity = 1, width = 13, height = 22 }: FigureProps) {
  return (
    <svg
      viewBox="0 0 13 22"
      width={width}
      height={height}
      fill={color}
      style={{ opacity, flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    >
      {/* Head  -  large circle, AIGA proportion */}
      <circle cx="6.5" cy="2.2" r="2.1" />
      {/* Torso  -  slight trapezoid, wider at shoulder */}
      <path d="M 4.5 4.8 L 8.5 4.8 L 8 11 L 5 11 Z" />
      {/* Left arm  -  forward, angled down-left */}
      <path d="M 4.5 6.2 L 0.8 9.8 L 1.9 10.8 L 5.5 7.3 Z" />
      {/* Right arm  -  back, angled up-right */}
      <path d="M 8.5 6.2 L 12.2 8.2 L 11.7 9.4 L 8.1 7.5 Z" />
      {/* Left leg  -  forward stride */}
      <path d="M 5 11 L 7.2 11 L 6.2 21 L 4 21 Z" />
      {/* Right leg  -  back stride, wider spread */}
      <path d="M 6 11 L 8.5 11 L 10.2 21 L 8.2 21 Z" />
    </svg>
  );
}

/**
 * Family group  -  adult and child side by side.
 * Used for Families persona chip.
 */
export function FamilyFigure({ color = '#1e1608', opacity = 1, width = 24, height = 22 }: FigureProps) {
  return (
    <svg
      viewBox="0 0 24 22"
      width={width}
      height={height}
      fill={color}
      style={{ opacity, flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    >
      {/* ── Adult (left) ── */}
      <circle cx="6" cy="2.2" r="2.1" />
      <path d="M 4 4.8 L 8 4.8 L 7.5 11 L 4.5 11 Z" />
      {/* adult left arm */}
      <path d="M 4 6.2 L 0.5 9.5 L 1.5 10.5 L 4.8 7.3 Z" />
      {/* adult right arm  -  reaching toward child */}
      <path d="M 8 6.2 L 11.5 7.5 L 11 8.6 L 7.7 7.4 Z" />
      {/* adult left leg */}
      <path d="M 4.5 11 L 6.5 11 L 5.5 21 L 3.5 21 Z" />
      {/* adult right leg */}
      <path d="M 5.5 11 L 7.5 11 L 9 21 L 7.2 21 Z" />

      {/* ── Child (right, 72% scale, shifted right by 13) ── */}
      <circle cx="19" cy="4" r="1.6" />
      <path d="M 17.5 6 L 20.5 6 L 20 11 L 18 11 Z" />
      {/* child arm toward adult */}
      <path d="M 17.5 7.2 L 14.5 9.5 L 15.3 10.2 L 18.2 8 Z" />
      {/* child other arm */}
      <path d="M 20.5 7.2 L 23 8.5 L 22.5 9.5 L 20.2 8.3 Z" />
      {/* child left leg */}
      <path d="M 18 11 L 19.5 11 L 18.8 19.5 L 17.4 19.5 Z" />
      {/* child right leg */}
      <path d="M 18.8 11 L 20.5 11 L 21.8 19.5 L 20.4 19.5 Z" />
    </svg>
  );
}

/**
 * Elder pedestrian with walking cane.
 * More upright posture, cane extending from right hand.
 * Used for Older Adults persona chip.
 */
export function ElderFigure({ color = '#1e1608', opacity = 1, width = 15, height = 22 }: FigureProps) {
  return (
    <svg
      viewBox="0 0 15 22"
      width={width}
      height={height}
      fill={color}
      style={{ opacity, flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    >
      {/* Head */}
      <circle cx="6.5" cy="2.2" r="2.1" />
      {/* Torso  -  more upright than walking figure */}
      <path d="M 4.8 4.8 L 8.2 4.8 L 8 11 L 5 11 Z" />
      {/* Left arm  -  slight forward, not as extended */}
      <path d="M 4.8 6.5 L 2.5 9 L 3.4 10 L 5.6 7.5 Z" />
      {/* Right arm  -  holding cane, angled down-right */}
      <path d="M 8.2 6.5 L 10.5 8.5 L 9.8 9.5 L 7.8 7.5 Z" />
      {/* Cane  -  thin diagonal from right hand to ground */}
      <path d="M 10.2 8.8 L 14 21 L 13 21 Z" />
      {/* Left leg  -  moderate stride */}
      <path d="M 5 11 L 7 11 L 6.2 21 L 4.2 21 Z" />
      {/* Right leg  -  slight forward */}
      <path d="M 6 11 L 8 11 L 9 21 L 7.2 21 Z" />
    </svg>
  );
}

/**
 * Map pin / location marker  -  used in document header area.
 * Classic survey-style crosshair pin.
 */
export function SurveyPin({ color = '#b8401a', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 16 22" width={size * 0.73} height={size} fill="none" aria-hidden="true">
      <circle cx="8" cy="7" r="5.5" stroke={color} strokeWidth="2" />
      <circle cx="8" cy="7" r="2" fill={color} />
      {/* stem */}
      <path d="M 8 12.5 L 8 21" stroke={color} strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}
