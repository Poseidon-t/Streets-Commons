/**
 * Street Cross-Section Diagram
 * Auto-generates an SVG cross-section of the nearest street from OSM data.
 * Shows "Current State" (free) and "Recommended Redesign" (premium).
 */

import { useState, useEffect, useMemo } from 'react';
import { COLORS } from '../constants';
import { fetchNearestStreetDetails } from '../services/overpass';
import type {
  StreetAttributes,
  CrossSectionElement,
  CrossSectionConfig,
  WalkabilityMetrics,
  Location,
} from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SVG_SCALE = 10; // 1 meter = 10 SVG units
const ROAD_Y = 80;
const ROAD_HEIGHT = 8;
const BUILDING_HEIGHT = 65;
const TREE_CANOPY_Y = 25;
const TREE_CANOPY_R = 13;
const TREE_TRUNK_WIDTH = 2;
const LABEL_Y = ROAD_Y + ROAD_HEIGHT + 18;
const SVG_HEIGHT = LABEL_Y + 22;

interface StreetDefaults {
  lanes: number;
  width: number;
  sidewalkWidth: number;
  hasParking: boolean;
  hasBikeLane: boolean;
}

const STREET_DEFAULTS: Record<string, StreetDefaults> = {
  primary: { lanes: 4, width: 14, sidewalkWidth: 1.8, hasParking: true, hasBikeLane: false },
  secondary: { lanes: 2, width: 10, sidewalkWidth: 1.5, hasParking: true, hasBikeLane: false },
  tertiary: { lanes: 2, width: 8, sidewalkWidth: 1.2, hasParking: false, hasBikeLane: false },
  residential: { lanes: 2, width: 6, sidewalkWidth: 1.0, hasParking: true, hasBikeLane: false },
  living_street: { lanes: 1, width: 4, sidewalkWidth: 0.8, hasParking: false, hasBikeLane: false },
};

// ---------------------------------------------------------------------------
// Cross-section builders
// ---------------------------------------------------------------------------

function buildCurrentCrossSection(attrs: StreetAttributes | null): CrossSectionConfig | null {
  if (!attrs) return null;

  const defaults = STREET_DEFAULTS[attrs.highway] || STREET_DEFAULTS.residential;
  const lanes = Math.min(attrs.lanes ?? defaults.lanes, 6);
  const roadWidth = attrs.width ?? defaults.width;
  const laneWidth = roadWidth / lanes;

  const hasSidewalk = attrs.sidewalk !== 'no';
  const sidewalkWidth = hasSidewalk ? (defaults.sidewalkWidth) : 0;

  const hasParking = !!(attrs.parkingLeft || attrs.parkingRight) || defaults.hasParking;
  const parkingWidth = hasParking ? 2.0 : 0;

  const hasBikeLeft = !!(attrs.cycleway === 'lane' || attrs.cyclewayLeft);
  const hasBikeRight = !!(attrs.cycleway === 'lane' || attrs.cyclewayRight);
  const bikeWidth = 1.8;

  const isEstWidth = attrs.width == null;
  const isEstLanes = attrs.lanes == null;

  const elements: CrossSectionElement[] = [];

  // Left side: building → sidewalk → curb → parking → bike → lanes → bike → parking → curb → sidewalk → building
  elements.push({ type: 'building', width: 3, isEstimated: false });

  if (sidewalkWidth > 0) {
    elements.push({ type: 'sidewalk', width: sidewalkWidth, label: `${sidewalkWidth.toFixed(1)}m`, isEstimated: true });
  }

  elements.push({ type: 'curb', width: 0.15, isEstimated: false });

  if (hasParking) {
    elements.push({ type: 'parking', width: parkingWidth, label: `${parkingWidth.toFixed(1)}m`, isEstimated: isEstWidth });
  }

  if (hasBikeLeft) {
    elements.push({ type: 'bikelane', width: bikeWidth, label: `${bikeWidth.toFixed(1)}m`, isEstimated: false });
  }

  // Travel lanes
  const isOneway = attrs.oneway;
  for (let i = 0; i < lanes; i++) {
    elements.push({
      type: 'travel_lane',
      width: laneWidth,
      label: i === 0 ? `${laneWidth.toFixed(1)}m` : undefined,
      isEstimated: isEstLanes || isEstWidth,
    });
  }

  if (hasBikeRight) {
    elements.push({ type: 'bikelane', width: bikeWidth, label: `${bikeWidth.toFixed(1)}m`, isEstimated: false });
  }

  if (hasParking) {
    elements.push({ type: 'parking', width: parkingWidth, label: `${parkingWidth.toFixed(1)}m`, isEstimated: isEstWidth });
  }

  elements.push({ type: 'curb', width: 0.15, isEstimated: false });

  if (sidewalkWidth > 0) {
    elements.push({ type: 'sidewalk', width: sidewalkWidth, label: `${sidewalkWidth.toFixed(1)}m`, isEstimated: true });
  }

  elements.push({ type: 'building', width: 3, isEstimated: false });

  const totalWidth = elements.reduce((sum, el) => sum + el.width, 0);

  return {
    elements,
    totalWidth,
    streetName: attrs.name,
    highwayType: attrs.highway,
  };
}

function buildRecommendedCrossSection(
  current: CrossSectionConfig | null,
  metrics: WalkabilityMetrics,
): CrossSectionConfig | null {
  if (!current) return null;

  // Deep clone elements
  let elements: CrossSectionElement[] = current.elements.map(el => ({ ...el }));

  const hasBikeLane = elements.some(el => el.type === 'bikelane');
  const parkingElements = elements.filter(el => el.type === 'parking');
  const travelLanes = elements.filter(el => el.type === 'travel_lane');
  const sidewalkElements = elements.filter(el => el.type === 'sidewalk');

  // Track space budget changes
  let spaceToReallocate = 0;

  // Rule: Remove one side of parking if both sides exist and we need space
  if (parkingElements.length >= 2 && (!hasBikeLane || sidewalkElements.some(s => s.width < 1.5))) {
    // Remove the last parking element (right side)
    const idx = elements.lastIndexOf(parkingElements[parkingElements.length - 1]);
    if (idx !== -1) {
      spaceToReallocate += elements[idx].width;
      elements.splice(idx, 1);
    }
  }

  // Rule: Road diet — if > 2 travel lanes on secondary/tertiary
  if (travelLanes.length > 2 && ['secondary', 'tertiary'].includes(current.highwayType)) {
    // Remove the last travel lane
    const lastLaneIdx = elements.lastIndexOf(travelLanes[travelLanes.length - 1]);
    if (lastLaneIdx !== -1) {
      spaceToReallocate += elements[lastLaneIdx].width;
      elements.splice(lastLaneIdx, 1);
    }
  }

  // Rule: Add bike lanes if missing
  if (!hasBikeLane) {
    const bikeWidth = 1.8;
    // If we don't have enough reallocated space, take from remaining parking
    if (spaceToReallocate < bikeWidth * 2) {
      const remainingParking = elements.filter(el => el.type === 'parking');
      if (remainingParking.length > 0) {
        const pIdx = elements.indexOf(remainingParking[0]);
        if (pIdx !== -1) {
          spaceToReallocate += elements[pIdx].width;
          elements.splice(pIdx, 1);
        }
      }
    }

    // Insert bike lanes next to curbs (inside of curb, outside of travel lanes)
    const firstCurbIdx = elements.findIndex(el => el.type === 'curb');
    const lastCurbIdx = elements.length - 1 - [...elements].reverse().findIndex(el => el.type === 'curb');

    if (firstCurbIdx !== -1) {
      elements.splice(firstCurbIdx + 1, 0, {
        type: 'bikelane',
        width: bikeWidth,
        label: `${bikeWidth}m`,
        isEstimated: false,
      });
      spaceToReallocate -= bikeWidth;
    }
    if (lastCurbIdx !== -1 && lastCurbIdx !== firstCurbIdx) {
      const adjustedLastCurb = elements.length - 1 - [...elements].reverse().findIndex(el => el.type === 'curb');
      elements.splice(adjustedLastCurb, 0, {
        type: 'bikelane',
        width: bikeWidth,
        label: `${bikeWidth}m`,
        isEstimated: false,
      });
      spaceToReallocate -= bikeWidth;
    }
  }

  // Rule: Widen sidewalks if narrow, using remaining reallocated space
  if (spaceToReallocate > 0) {
    const sidewalks = elements.filter(el => el.type === 'sidewalk');
    const extraPerSide = Math.max(0, spaceToReallocate / Math.max(sidewalks.length, 1));
    sidewalks.forEach(sw => {
      sw.width = Math.max(sw.width, 2.4);
      sw.width += extraPerSide * 0.5; // Give half the extra to sidewalks
      sw.label = `${sw.width.toFixed(1)}m`;
      sw.isEstimated = false;
    });
  }

  // Rule: Add sidewalks if missing
  const updatedSidewalks = elements.filter(el => el.type === 'sidewalk');
  if (updatedSidewalks.length === 0) {
    const firstCurbIdx = elements.findIndex(el => el.type === 'curb');
    if (firstCurbIdx !== -1) {
      elements.splice(firstCurbIdx, 0, { type: 'sidewalk', width: 2.4, label: '2.4m', isEstimated: false });
    }
    const lastCurbIdx = elements.length - 1 - [...elements].reverse().findIndex(el => el.type === 'curb');
    if (lastCurbIdx !== -1) {
      elements.splice(lastCurbIdx + 1, 0, { type: 'sidewalk', width: 2.4, label: '2.4m', isEstimated: false });
    }
  }

  // Rule: Add trees if tree canopy score is low
  if (metrics.treeCanopy < 5) {
    const sidewalkIndices: number[] = [];
    elements.forEach((el, i) => { if (el.type === 'sidewalk') sidewalkIndices.push(i); });

    // Insert a tree element after each sidewalk (trees are decorative, width 0)
    let offset = 0;
    sidewalkIndices.forEach(idx => {
      elements.splice(idx + offset + 1, 0, { type: 'tree', width: 0, isEstimated: false });
      offset++;
    });
  }

  const totalWidth = elements.reduce((sum, el) => sum + el.width, 0);

  return {
    elements,
    totalWidth,
    streetName: current.streetName,
    highwayType: current.highwayType,
  };
}

// ---------------------------------------------------------------------------
// SVG Sub-renderers
// ---------------------------------------------------------------------------

function Building({ x, width }: { x: number; width: number }) {
  const windowRows = 4;
  const windowCols = Math.max(1, Math.floor(width / 8));
  const windowW = 4;
  const windowH = 6;
  const gapX = (width - windowCols * windowW) / (windowCols + 1);
  const gapY = BUILDING_HEIGHT / (windowRows + 1);

  return (
    <g>
      <rect x={x} y={ROAD_Y - BUILDING_HEIGHT} width={width} height={BUILDING_HEIGHT} fill="#9CA3AF" />
      {Array.from({ length: windowRows }, (_, row) =>
        Array.from({ length: windowCols }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={x + gapX + col * (windowW + gapX)}
            y={ROAD_Y - BUILDING_HEIGHT + gapY + row * (windowH + gapY)}
            width={windowW}
            height={windowH}
            fill="#E5E7EB"
            rx={0.5}
          />
        )),
      )}
    </g>
  );
}

function Sidewalk({ x, width }: { x: number; width: number }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y - 2} width={width} height={ROAD_HEIGHT + 2} fill="#D1D5DB" />
      {/* Paving lines */}
      {Array.from({ length: Math.floor(width / 4) }, (_, i) => (
        <line
          key={i}
          x1={x + (i + 1) * 4}
          y1={ROAD_Y - 2}
          x2={x + (i + 1) * 4}
          y2={ROAD_Y + ROAD_HEIGHT}
          stroke="#C4C8CC"
          strokeWidth={0.3}
        />
      ))}
    </g>
  );
}

function TreeElement({ x }: { x: number }) {
  return (
    <g>
      <rect
        x={x - TREE_TRUNK_WIDTH / 2}
        y={TREE_CANOPY_Y + TREE_CANOPY_R}
        width={TREE_TRUNK_WIDTH}
        height={ROAD_Y - TREE_CANOPY_Y - TREE_CANOPY_R - 2}
        fill="#92400E"
      />
      <circle cx={x} cy={TREE_CANOPY_Y} r={TREE_CANOPY_R} fill="#22C55E" opacity={0.85} />
      <circle cx={x - 5} cy={TREE_CANOPY_Y + 4} r={TREE_CANOPY_R * 0.7} fill="#16A34A" opacity={0.6} />
      <circle cx={x + 5} cy={TREE_CANOPY_Y + 3} r={TREE_CANOPY_R * 0.65} fill="#15803D" opacity={0.5} />
    </g>
  );
}

function Curb({ x }: { x: number }) {
  return <rect x={x} y={ROAD_Y - 3} width={1.5} height={ROAD_HEIGHT + 3} fill="#374151" />;
}

function ParkingLane({ x, width }: { x: number; width: number }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="#6B7280" />
      {/* Diagonal hatching */}
      {Array.from({ length: Math.ceil(width / 5) }, (_, i) => (
        <line
          key={i}
          x1={x + i * 5}
          y1={ROAD_Y}
          x2={x + i * 5 + 4}
          y2={ROAD_Y + ROAD_HEIGHT}
          stroke="#9CA3AF"
          strokeWidth={0.5}
        />
      ))}
      {/* Car silhouette */}
      {width >= 15 && (
        <g>
          <rect x={x + width * 0.15} y={ROAD_Y + 1.5} width={width * 0.7} height={5} rx={1.5} fill="#4B5563" opacity={0.5} />
        </g>
      )}
    </g>
  );
}

function BikeLane({ x, width }: { x: number; width: number }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="#22C55E" opacity={0.25} />
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="none" stroke="#16A34A" strokeWidth={0.5} />
      {/* Bike icon (simplified) */}
      <g transform={`translate(${x + width / 2}, ${ROAD_Y + ROAD_HEIGHT / 2})`}>
        <circle r={2} fill="none" stroke="#16A34A" strokeWidth={0.6} cx={-2} cy={0} />
        <circle r={2} fill="none" stroke="#16A34A" strokeWidth={0.6} cx={2} cy={0} />
        <line x1={-2} y1={0} x2={0} y2={-2} stroke="#16A34A" strokeWidth={0.5} />
        <line x1={0} y1={-2} x2={2} y2={0} stroke="#16A34A" strokeWidth={0.5} />
      </g>
    </g>
  );
}

function TravelLane({ x, width, isFirst, isLast }: { x: number; width: number; isFirst: boolean; isLast: boolean }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="#4B5563" />
      {/* Lane marking on right edge (dashed white) unless last lane */}
      {!isLast && (
        <line
          x1={x + width}
          y1={ROAD_Y + 1}
          x2={x + width}
          y2={ROAD_Y + ROAD_HEIGHT - 1}
          stroke="#FFFFFF"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      )}
      {/* Directional arrow */}
      <polygon
        points={`${x + width / 2},${ROAD_Y + 2} ${x + width / 2 - 1.5},${ROAD_Y + 5} ${x + width / 2 + 1.5},${ROAD_Y + 5}`}
        fill="#9CA3AF"
        opacity={0.6}
      />
    </g>
  );
}

function DimensionLabel({ x, width, text, isEstimated }: { x: number; width: number; text: string; isEstimated: boolean }) {
  if (width < 5) return null;
  const displayText = isEstimated ? `~${text}` : text;
  return (
    <g>
      {/* Dimension line */}
      <line x1={x + 1} y1={LABEL_Y - 4} x2={x + 1} y2={LABEL_Y} stroke="#9CA3AF" strokeWidth={0.3} />
      <line x1={x + width - 1} y1={LABEL_Y - 4} x2={x + width - 1} y2={LABEL_Y} stroke="#9CA3AF" strokeWidth={0.3} />
      <line x1={x + 1} y1={LABEL_Y - 1} x2={x + width - 1} y2={LABEL_Y - 1} stroke="#9CA3AF" strokeWidth={0.3} />
      {/* Label text */}
      <text
        x={x + width / 2}
        y={LABEL_Y + 6}
        textAnchor="middle"
        fontSize={4}
        fill="#6B7280"
        fontStyle={isEstimated ? 'italic' : 'normal'}
      >
        {displayText}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main SVG Renderer
// ---------------------------------------------------------------------------

function CrossSectionSVG({ config }: { config: CrossSectionConfig }) {
  const totalSVGWidth = config.totalWidth * SVG_SCALE;

  let cursorX = 0;
  let travelLaneIdx = 0;
  const travelLaneCount = config.elements.filter(el => el.type === 'travel_lane').length;

  return (
    <svg
      viewBox={`0 0 ${totalSVGWidth} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label={`Cross-section of ${config.streetName}`}
    >
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#E0F0FF" />
        </linearGradient>
      </defs>
      <rect width={totalSVGWidth} height={ROAD_Y - 2} fill="url(#sky-gradient)" />

      {/* Ground line */}
      <rect x={0} y={ROAD_Y + ROAD_HEIGHT} width={totalSVGWidth} height={2} fill="#92400E" opacity={0.3} />

      {/* Render elements */}
      {config.elements.map((el, i) => {
        const x = cursorX;
        const w = el.width * SVG_SCALE;
        cursorX += w;

        // Tree elements have 0 width — render centered on previous sidewalk
        if (el.type === 'tree') {
          const prevEl = config.elements[i - 1];
          const prevX = x; // x hasn't moved since width is 0
          const sidewalkCenter = prevX - (prevEl ? prevEl.width * SVG_SCALE / 2 : 5);
          return <TreeElement key={i} x={sidewalkCenter} />;
        }

        const rendered = (() => {
          switch (el.type) {
            case 'building':
              return <Building key={i} x={x} width={w} />;
            case 'sidewalk':
              return <Sidewalk key={i} x={x} width={w} />;
            case 'curb':
              return <Curb key={i} x={x} />;
            case 'parking':
              return <ParkingLane key={i} x={x} width={w} />;
            case 'bikelane':
              return <BikeLane key={i} x={x} width={w} />;
            case 'travel_lane': {
              const isFirst = travelLaneIdx === 0;
              const isLast = travelLaneIdx === travelLaneCount - 1;
              travelLaneIdx++;
              return <TravelLane key={i} x={x} width={w} isFirst={isFirst} isLast={isLast} />;
            }
            default:
              return null;
          }
        })();

        return (
          <g key={i}>
            {rendered}
            {el.label && <DimensionLabel x={x} width={w} text={el.label} isEstimated={el.isEstimated} />}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props & Component
// ---------------------------------------------------------------------------

interface StreetCrossSectionProps {
  location: Location;
  metrics: WalkabilityMetrics;
  isPremium?: boolean;
  onUnlock?: () => void;
}

export default function StreetCrossSection({
  location,
  metrics,
  isPremium = false,
  onUnlock,
}: StreetCrossSectionProps) {
  const [streetAttrs, setStreetAttrs] = useState<StreetAttributes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'current' | 'recommended'>('current');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchNearestStreetDetails(location.lat, location.lon)
      .then(attrs => {
        if (cancelled) return;
        if (!attrs) {
          // Fallback: create a generic residential street
          setStreetAttrs({
            name: location.displayName.split(',')[0],
            highway: 'residential',
          });
        } else {
          setStreetAttrs(attrs);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStreetAttrs({
          name: location.displayName.split(',')[0],
          highway: 'residential',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [location.lat, location.lon, location.displayName]);

  const currentConfig = useMemo(
    () => buildCurrentCrossSection(streetAttrs),
    [streetAttrs],
  );

  const recommendedConfig = useMemo(
    () => buildRecommendedCrossSection(currentConfig, metrics),
    [currentConfig, metrics],
  );

  const activeConfig = view === 'current' ? currentConfig : recommendedConfig;

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!activeConfig) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 text-center">
        <div className="text-4xl mb-3">&#x1f6a7;</div>
        <h3 className="font-bold text-gray-800 mb-1">No street data available</h3>
        <p className="text-sm text-gray-500">
          No classified street was found near this address. This may happen in rural areas or areas with limited OpenStreetMap coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border-2 border-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            Street Cross-Section
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {streetAttrs?.name || 'Nearest street'}
            <span className="text-gray-300 mx-1.5">|</span>
            <span className="capitalize">{currentConfig?.highwayType?.replace('_', ' ')}</span>
          </p>
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setView('current')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === 'current'
                ? 'text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            style={view === 'current' ? { backgroundColor: COLORS.primary } : undefined}
          >
            Current
          </button>
          {isPremium ? (
            <button
              onClick={() => setView('recommended')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'recommended'
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={view === 'recommended' ? { backgroundColor: '#22C55E' } : undefined}
            >
              Recommended
            </button>
          ) : (
            <button
              onClick={() => onUnlock?.()}
              className="px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-50 flex items-center gap-1.5"
            >
              <span>&#x1f512;</span> Recommended
            </button>
          )}
        </div>
      </div>

      {/* SVG Diagram */}
      <div className="rounded-xl overflow-hidden border border-gray-100">
        <CrossSectionSVG config={activeConfig} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#4B5563]" /> Travel lane
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#D1D5DB]" /> Sidewalk
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#6B7280]" /> Parking
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34,197,94,0.25)', border: '1px solid #16A34A' }} /> Bike lane
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#22C55E]" /> Tree
        </span>
      </div>

      {/* Data confidence note */}
      <p className="text-xs text-gray-400 mt-3">
        {streetAttrs?.lanes || streetAttrs?.width
          ? 'Dimensions from OpenStreetMap. '
          : 'Dimensions estimated from road type. '}
        Italic labels (~) indicate estimated values.
      </p>

      {/* Premium upsell for free users */}
      {!isPremium && (
        <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-bold text-gray-800 text-sm mb-1">See the Recommended Redesign</h4>
              <p className="text-xs text-gray-600">
                Unlock data-driven street redesign recommendations based on your walkability scores.
              </p>
            </div>
            {onUnlock && (
              <button
                onClick={onUnlock}
                className="px-4 py-2 rounded-xl font-semibold text-white text-sm transition-all hover:shadow-lg whitespace-nowrap"
                style={{ backgroundColor: COLORS.accent }}
              >
                Unlock &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
