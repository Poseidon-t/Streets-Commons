/**
 * Street Design Standards Reference
 * Shows relevant design standards from NACTO, ADA, GSDG, and WHO
 * with compliance comparison against the current cross-section.
 */

import { useState } from 'react';
import type { CrossSectionConfig } from '../types';

// ---------------------------------------------------------------------------
// Standards data
// ---------------------------------------------------------------------------

interface DesignStandard {
  element: string;
  icon: string;
  sources: {
    org: string;
    label: string;
    min: number;
    recommended: number;
    ideal?: number;
    unit: string;
    note?: string;
  }[];
}

const ELEMENT_STANDARDS: DesignStandard[] = [
  {
    element: 'Sidewalk Width',
    icon: '🚶',
    sources: [
      { org: 'ADA', label: 'Americans with Disabilities Act', min: 1.5, recommended: 1.8, unit: 'm', note: 'Minimum clear width for wheelchair passage' },
      { org: 'NACTO', label: 'Urban Street Design Guide', min: 1.8, recommended: 2.4, ideal: 3.6, unit: 'm', note: 'Wider for high pedestrian volume areas' },
      { org: 'GSDG', label: 'Global Street Design Guide', min: 1.8, recommended: 3.0, ideal: 4.5, unit: 'm', note: 'Includes furnishing zone for trees & utilities' },
    ],
  },
  {
    element: 'Bike Lane Width',
    icon: '🚲',
    sources: [
      { org: 'NACTO', label: 'Urban Bikeway Design Guide', min: 1.5, recommended: 1.8, ideal: 2.1, unit: 'm', note: 'One-way protected bike lane' },
      { org: 'CROW', label: 'Dutch Design Manual', min: 1.7, recommended: 2.0, ideal: 2.5, unit: 'm', note: 'Standard for separated cycle paths' },
      { org: 'GSDG', label: 'Global Street Design Guide', min: 1.5, recommended: 2.0, ideal: 2.4, unit: 'm', note: 'Protected with physical barrier' },
    ],
  },
  {
    element: 'Travel Lane Width',
    icon: '🚗',
    sources: [
      { org: 'NACTO', label: 'Urban Street Design Guide', min: 2.7, recommended: 3.0, ideal: 3.3, unit: 'm', note: 'Narrower lanes reduce speeds and improve safety' },
      { org: 'GSDG', label: 'Global Street Design Guide', min: 2.7, recommended: 3.0, ideal: 3.3, unit: 'm', note: '3.3m max for urban streets; wider encourages speeding' },
      { org: 'AASHTO', label: 'Geometric Design of Highways', min: 3.0, recommended: 3.3, ideal: 3.6, unit: 'm', note: 'Higher-speed contexts only' },
    ],
  },
  {
    element: 'Parking Lane Width',
    icon: '🅿️',
    sources: [
      { org: 'NACTO', label: 'Urban Street Design Guide', min: 2.1, recommended: 2.4, ideal: 2.7, unit: 'm', note: 'Parallel parking; wider for turnover areas' },
      { org: 'GSDG', label: 'Global Street Design Guide', min: 2.0, recommended: 2.4, unit: 'm', note: 'Can serve as flex zone for transit stops or loading' },
    ],
  },
];

interface GeneralStandard {
  topic: string;
  icon: string;
  standards: { org: string; value: string; detail: string }[];
}

const GENERAL_STANDARDS: GeneralStandard[] = [
  {
    topic: 'Speed Limits',
    icon: '🚦',
    standards: [
      { org: 'Vision Zero', value: '30 km/h (20 mph)', detail: 'Residential streets — dramatically reduces pedestrian fatality risk' },
      { org: 'NACTO', value: '40 km/h (25 mph)', detail: 'Urban arterials — maximum for streets with pedestrian activity' },
      { org: 'WHO', value: '30 km/h (20 mph)', detail: 'Default urban speed limit recommendation for all member states' },
    ],
  },
  {
    topic: 'Crossing Frequency',
    icon: '🚸',
    standards: [
      { org: 'WHO', value: 'Every 200m max', detail: 'Maximum distance between safe crossing opportunities' },
      { org: 'NACTO', value: 'Every 80-100m', detail: 'Recommended spacing for signalized or marked crossings in urban areas' },
      { org: 'GSDG', value: 'Every intersection', detail: 'All intersections should have marked pedestrian crossings' },
    ],
  },
  {
    topic: 'Street Trees',
    icon: '🌳',
    standards: [
      { org: 'NACTO', value: '7.5-9m spacing', detail: 'Trees planted 25-30ft apart for continuous canopy cover' },
      { org: 'GSDG', value: '40% canopy target', detail: 'Urban streets should aim for 40% tree canopy coverage' },
      { org: 'ITDP', value: 'Both sides', detail: 'Shade trees should line both sides of all pedestrian routes' },
    ],
  },
  {
    topic: 'Street Lighting',
    icon: '💡',
    standards: [
      { org: 'IES', value: '5-10 lux', detail: 'Minimum sidewalk illumination for pedestrian safety' },
      { org: 'NACTO', value: 'Continuous coverage', detail: 'No dark gaps between light pools on pedestrian routes' },
      { org: 'GSDG', value: 'Pedestrian-scale', detail: '3-4m pole height preferred over tall highway-style fixtures' },
    ],
  },
  {
    topic: 'Accessibility',
    icon: '♿',
    standards: [
      { org: 'ADA', value: '5% max grade', detail: 'Maximum running slope for accessible pedestrian routes' },
      { org: 'ADA', value: '2% max cross slope', detail: 'Maximum cross slope on sidewalks and ramps' },
      { org: 'ADA', value: 'Curb ramps at all crossings', detail: 'Detectable warning surfaces required at every pedestrian crossing' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Compliance helpers
// ---------------------------------------------------------------------------

type Compliance = 'exceeds' | 'meets' | 'below' | 'critical';

function getCompliance(actual: number, min: number, recommended: number): Compliance {
  if (actual >= recommended) return 'exceeds';
  if (actual >= min) return 'meets';
  if (actual >= min * 0.8) return 'below';
  return 'critical';
}

const COMPLIANCE_STYLES: Record<Compliance, { color: string; bg: string; label: string }> = {
  exceeds: { color: '#16a34a', bg: 'rgba(34,197,94,0.08)', label: 'Exceeds' },
  meets: { color: '#65a30d', bg: 'rgba(101,163,13,0.08)', label: 'Meets minimum' },
  below: { color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', label: 'Below standard' },
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', label: 'Well below' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ComplianceBar({ actual, min, recommended, ideal, unit }: {
  actual: number;
  min: number;
  recommended: number;
  ideal?: number;
  unit: string;
}) {
  const maxVal = (ideal ?? recommended) * 1.3;
  const pctActual = Math.min((actual / maxVal) * 100, 100);
  const pctMin = (min / maxVal) * 100;
  const pctRec = (recommended / maxVal) * 100;
  const compliance = getCompliance(actual, min, recommended);
  const style = COMPLIANCE_STYLES[compliance];

  return (
    <div className="mt-1.5">
      <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
        {/* Recommended zone */}
        <div
          className="absolute top-0 h-full opacity-20 rounded-full"
          style={{ left: `${pctMin}%`, width: `${pctRec - pctMin}%`, backgroundColor: '#22c55e' }}
        />
        {/* Minimum marker */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${pctMin}%`, backgroundColor: '#ca8a04' }}
        />
        {/* Recommended marker */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${pctRec}%`, backgroundColor: '#16a34a' }}
        />
        {/* Actual value bar */}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pctActual}%`, backgroundColor: style.color }}
        />
      </div>
      <div className="flex justify-between mt-0.5 text-xs" style={{ color: '#b0a8a0' }}>
        <span>0{unit}</span>
        <span>{min}{unit} min</span>
        <span>{recommended}{unit} rec.</span>
      </div>
    </div>
  );
}

function ElementStandardCard({ standard, actualWidth }: { standard: DesignStandard; actualWidth: number | null }) {
  const [expanded, setExpanded] = useState(false);

  // Use the first source (most relevant) for headline compliance
  const primary = standard.sources[0];
  const compliance = actualWidth !== null ? getCompliance(actualWidth, primary.min, primary.recommended) : null;
  const compStyle = compliance ? COMPLIANCE_STYLES[compliance] : null;

  return (
    <div
      className="rounded-lg border p-3 transition-all"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.5)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-base flex-shrink-0">{standard.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>
            {standard.element}
          </span>
          {actualWidth !== null && (
            <span className="text-xs ml-2 tabular-nums" style={{ color: '#8a9a8a' }}>
              Current: {actualWidth.toFixed(1)}m
            </span>
          )}
        </div>
        {compStyle && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ color: compStyle.color, backgroundColor: compStyle.bg }}
          >
            {compStyle.label}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          style={{ color: '#8a9a8a' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {standard.sources.map(src => (
            <div key={src.org} className="pl-7">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold" style={{ color: '#2a3a2a' }}>{src.org}</span>
                <span className="text-xs" style={{ color: '#8a9a8a' }}>{src.label}</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs tabular-nums" style={{ color: '#5a6a5a' }}>
                  {src.min}{src.unit} min
                  <span className="mx-1" style={{ color: '#c5c0b5' }}>/</span>
                  {src.recommended}{src.unit} rec.
                  {src.ideal && (
                    <>
                      <span className="mx-1" style={{ color: '#c5c0b5' }}>/</span>
                      {src.ideal}{src.unit} ideal
                    </>
                  )}
                </span>
              </div>
              {actualWidth !== null && (
                <ComplianceBar
                  actual={actualWidth}
                  min={src.min}
                  recommended={src.recommended}
                  ideal={src.ideal}
                  unit={src.unit}
                />
              )}
              {src.note && (
                <p className="text-xs mt-1" style={{ color: '#b0a8a0' }}>{src.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneralStandardCard({ standard }: { standard: GeneralStandard }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border p-3 transition-all"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.5)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-base flex-shrink-0">{standard.icon}</span>
        <span className="text-xs font-semibold flex-1" style={{ color: '#2a3a2a' }}>
          {standard.topic}
        </span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          style={{ color: '#8a9a8a' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5 pl-7">
          {standard.standards.map((s, i) => (
            <div key={i}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold" style={{ color: '#2a3a2a' }}>{s.org}</span>
                <span className="text-xs font-semibold" style={{ color: '#5a6a5a' }}>{s.value}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#b0a8a0' }}>{s.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface StreetDesignStandardsProps {
  config: CrossSectionConfig;
}

export default function StreetDesignStandards({ config }: StreetDesignStandardsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract actual widths from cross-section
  const sidewalks = config.elements.filter(el => el.type === 'sidewalk');
  const bikeLanes = config.elements.filter(el => el.type === 'bikelane');
  const travelLanes = config.elements.filter(el => el.type === 'travel_lane');
  const parkingLanes = config.elements.filter(el => el.type === 'parking');

  const avgSidewalk = sidewalks.length > 0 ? sidewalks.reduce((s, el) => s + el.width, 0) / sidewalks.length : null;
  const avgBikeLane = bikeLanes.length > 0 ? bikeLanes.reduce((s, el) => s + el.width, 0) / bikeLanes.length : null;
  const avgTravelLane = travelLanes.length > 0 ? travelLanes.reduce((s, el) => s + el.width, 0) / travelLanes.length : null;
  const avgParking = parkingLanes.length > 0 ? parkingLanes.reduce((s, el) => s + el.width, 0) / parkingLanes.length : null;

  // Only show standards relevant to elements present
  const relevantElementStandards = ELEMENT_STANDARDS.filter(std => {
    if (std.element === 'Sidewalk Width') return sidewalks.length > 0;
    if (std.element === 'Bike Lane Width') return bikeLanes.length > 0;
    if (std.element === 'Travel Lane Width') return travelLanes.length > 0;
    if (std.element === 'Parking Lane Width') return parkingLanes.length > 0;
    return true;
  });

  const getActualWidth = (element: string): number | null => {
    if (element === 'Sidewalk Width') return avgSidewalk;
    if (element === 'Bike Lane Width') return avgBikeLane;
    if (element === 'Travel Lane Width') return avgTravelLane;
    if (element === 'Parking Lane Width') return avgParking;
    return null;
  };

  // Count how many elements meet their primary standard
  const complianceCount = relevantElementStandards.reduce((count, std) => {
    const actual = getActualWidth(std.element);
    if (actual === null) return count;
    const primary = std.sources[0];
    const c = getCompliance(actual, primary.min, primary.recommended);
    return c === 'exceeds' || c === 'meets' ? count + 1 : count;
  }, 0);

  return (
    <div className="border-t pt-5" style={{ borderColor: '#e0dbd0' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-left group"
      >
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          style={{ color: '#8a9a8a' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>
          Design Standards Reference
        </span>
        <span className="text-xs" style={{ color: '#8a9a8a' }}>
          {complianceCount}/{relevantElementStandards.length} elements meet standards
        </span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-5">
          {/* Element-specific standards with compliance bars */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: '#8a9a8a' }}>
              Dimensions vs. Standards
            </h4>
            <div className="space-y-2">
              {relevantElementStandards.map(std => (
                <ElementStandardCard
                  key={std.element}
                  standard={std}
                  actualWidth={getActualWidth(std.element)}
                />
              ))}
            </div>
          </div>

          {/* General standards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: '#8a9a8a' }}>
              General Design Guidelines
            </h4>
            <div className="space-y-2">
              {GENERAL_STANDARDS.map(std => (
                <GeneralStandardCard key={std.topic} standard={std} />
              ))}
            </div>
          </div>

          {/* Sources footer */}
          <div className="rounded-lg p-3" style={{ backgroundColor: '#faf8f5' }}>
            <p className="text-xs leading-relaxed" style={{ color: '#b0a8a0' }}>
              <span className="font-semibold" style={{ color: '#8a9a8a' }}>Sources: </span>
              NACTO Urban Street Design Guide (2013) | Global Street Design Guide (GSDG, 2016) |
              AASHTO A Policy on Geometric Design (2018) | ADA Standards for Accessible Design |
              CROW Design Manual for Bicycle Traffic (2016) | WHO Global Status Report on Road Safety |
              IES Recommended Practice for Roadway Lighting | ITDP Pedestrians First
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
