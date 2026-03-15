/**
 * StreetPortrait  -  illustrated street-level scene based on walkability tier.
 * Five AI-generated NACTO-style illustrations, one per score tier.
 */

interface StreetPortraitProps {
  score: number; // 0-10
  locationName?: string;
}

type Tier = 'walkable' | 'moderate' | 'car-dependent' | 'difficult' | 'hostile';

function getTier(score: number): Tier {
  if (score >= 8) return 'walkable';
  if (score >= 6) return 'moderate';
  if (score >= 4) return 'car-dependent';
  if (score >= 2) return 'difficult';
  return 'hostile';
}

const TIER_META: Record<Tier, { label: string; caption: string; color: string }> = {
  'walkable':      { label: 'Highly Walkable',  caption: 'Wide shaded footpaths, protected cycling, active street life.', color: '#166534' },
  'moderate':      { label: 'Moderate',          caption: 'Functional streets with some trees and pedestrian space.', color: '#854d0e' },
  'car-dependent': { label: 'Car-Dependent',     caption: 'Designed around vehicles  -  walking is possible but uncomfortable.', color: '#9a3412' },
  'difficult':     { label: 'Difficult to Walk', caption: 'Poor infrastructure, narrow or crumbling footpaths, heavy traffic.', color: '#7f1d1d' },
  'hostile':       { label: 'Hostile',           caption: 'No pedestrian provision. Walking here is unsafe and exhausting.', color: '#450a0a' },
};

export default function StreetPortrait({ score, locationName }: StreetPortraitProps) {
  const tier = getTier(score);
  const meta = TIER_META[tier];
  const src = `/street-portraits/${tier}.png`;

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Image */}
      <div className="relative">
        <img
          src={src}
          alt={`Street scene illustration  -  ${meta.label}`}
          className="w-full object-cover"
          style={{ maxHeight: '320px' }}
        />
        {/* Tier badge overlay */}
        <div
          className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white"
          style={{ background: meta.color + 'ee' }}
        >
          {meta.label}
        </div>
      </div>

      {/* Caption */}
      <div className="px-4 py-3 bg-gray-50 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            Street Portrait {locationName ? ` -  ${locationName}` : ''}
          </div>
          <p className="text-sm text-gray-600">{meta.caption}</p>
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap pt-0.5">Illustrative · NACTO style</div>
      </div>
    </div>
  );
}
