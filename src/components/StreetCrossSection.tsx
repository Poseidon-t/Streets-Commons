/**
 * Street Cross-Section Diagram
 * Auto-generates an SVG cross-section of the nearest street from OSM data.
 * Interactive improvement toggles let users explore redesign options.
 */

import { useState, useEffect, useMemo } from 'react';
import { COLORS } from '../constants';
import { fetchNearestStreetDetails } from '../services/overpass';
import CrossSectionSVG from './CrossSectionSVG';
import StreetDesignStandards from './StreetDesignStandards';
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
// Improvement types
// ---------------------------------------------------------------------------

type ImprovementKey = 'bikeLanes' | 'widenSidewalks' | 'roadDiet' | 'streetTrees' | 'removeParking';

interface MeasurementParam {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

interface ImprovementOption {
  key: ImprovementKey;
  label: string;
  icon: string;
  description: string;
  applicable: (config: CrossSectionConfig, metrics: WalkabilityMetrics) => boolean;
  measurements?: MeasurementParam[];
}

type MeasurementValues = Record<string, number>;

const IMPROVEMENTS: ImprovementOption[] = [
  {
    key: 'bikeLanes',
    label: 'Add Bike Lanes',
    icon: '🚲',
    description: 'Protected bike lanes on both sides',
    applicable: (c) => !c.elements.some(el => el.type === 'bikelane'),
    measurements: [
      { id: 'bikeLaneWidth', label: 'Lane width', unit: 'm', min: 1.2, max: 2.4, step: 0.3, default: 1.8 },
    ],
  },
  {
    key: 'widenSidewalks',
    label: 'Widen Sidewalks',
    icon: '🚶',
    description: 'Expand pedestrian space',
    applicable: (c) => c.elements.some(el => el.type === 'sidewalk' && el.width < 2.4),
    measurements: [
      { id: 'sidewalkTarget', label: 'Target width', unit: 'm', min: 1.8, max: 4.5, step: 0.3, default: 2.4 },
    ],
  },
  {
    key: 'roadDiet',
    label: 'Road Diet',
    icon: '🛣️',
    description: 'Remove travel lanes, reclaim space',
    applicable: (c) => c.elements.filter(el => el.type === 'travel_lane').length > 2,
    measurements: [
      { id: 'lanesToRemove', label: 'Lanes to remove', unit: '', min: 1, max: 2, step: 1, default: 1 },
    ],
  },
  {
    key: 'streetTrees',
    label: 'Add Street Trees',
    icon: '🌳',
    description: 'Tree canopy for shade and comfort',
    applicable: (_c, m) => m.treeCanopy < 6,
  },
  {
    key: 'removeParking',
    label: 'Remove Parking',
    icon: '🅿️',
    description: 'Reclaim curbside parking for people',
    applicable: (c) => c.elements.some(el => el.type === 'parking'),
  },
];

// ---------------------------------------------------------------------------
// Cross-section builder
// ---------------------------------------------------------------------------

function buildCurrentCrossSection(attrs: StreetAttributes | null): CrossSectionConfig | null {
  if (!attrs) return null;

  const defaults = STREET_DEFAULTS[attrs.highway] || STREET_DEFAULTS.residential;
  const lanes = Math.min(attrs.lanes ?? defaults.lanes, 6);
  const roadWidth = attrs.width ?? defaults.width;
  const laneWidth = roadWidth / lanes;

  const hasSidewalk = attrs.sidewalk !== 'no';
  const sidewalkWidth = hasSidewalk ? defaults.sidewalkWidth : 0;

  const hasParking = !!(attrs.parkingLeft || attrs.parkingRight) || defaults.hasParking;
  const parkingWidth = hasParking ? 2.0 : 0;

  const hasBikeLeft = !!(attrs.cycleway === 'lane' || attrs.cyclewayLeft);
  const hasBikeRight = !!(attrs.cycleway === 'lane' || attrs.cyclewayRight);
  const bikeWidth = 1.8;

  const isEstWidth = attrs.width == null;
  const isEstLanes = attrs.lanes == null;

  const elements: CrossSectionElement[] = [];

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

  return { elements, totalWidth, streetName: attrs.name, highwayType: attrs.highway };
}

// ---------------------------------------------------------------------------
// Individual improvement applicators (composable)
// ---------------------------------------------------------------------------

function applyRemoveParking(elements: CrossSectionElement[]): { elements: CrossSectionElement[]; spaceFreed: number } {
  let spaceFreed = 0;
  const result = elements.filter(el => {
    if (el.type === 'parking') {
      spaceFreed += el.width;
      return false;
    }
    return true;
  });
  return { elements: result, spaceFreed };
}

function applyRoadDiet(elements: CrossSectionElement[], highwayType: string, lanesToRemove: number = 1): { elements: CrossSectionElement[]; spaceFreed: number } {
  const travelLanes = elements.filter(el => el.type === 'travel_lane');
  if (travelLanes.length <= 2 || !['primary', 'secondary', 'tertiary'].includes(highwayType)) {
    return { elements: [...elements], spaceFreed: 0 };
  }
  let spaceFreed = 0;
  let result = [...elements];
  const toRemove = Math.min(lanesToRemove, travelLanes.length - 2);
  for (let i = 0; i < toRemove; i++) {
    const lanes = result.filter(el => el.type === 'travel_lane');
    const lastLane = lanes[lanes.length - 1];
    const idx = result.lastIndexOf(lastLane);
    spaceFreed += lastLane.width;
    result.splice(idx, 1);
  }
  return { elements: result, spaceFreed };
}

function applyBikeLanes(elements: CrossSectionElement[], bikeWidth: number = 1.8): CrossSectionElement[] {
  if (elements.some(el => el.type === 'bikelane')) return [...elements];

  const result = [...elements.map(el => ({ ...el }))];

  const firstCurbIdx = result.findIndex(el => el.type === 'curb');
  if (firstCurbIdx !== -1) {
    result.splice(firstCurbIdx + 1, 0, { type: 'bikelane', width: bikeWidth, label: `${bikeWidth.toFixed(1)}m`, isEstimated: false });
  }

  const lastCurbIdx = result.length - 1 - [...result].reverse().findIndex(el => el.type === 'curb');
  if (lastCurbIdx !== -1 && lastCurbIdx !== firstCurbIdx) {
    result.splice(lastCurbIdx, 0, { type: 'bikelane', width: bikeWidth, label: `${bikeWidth.toFixed(1)}m`, isEstimated: false });
  }

  return result;
}

function applyWidenSidewalks(elements: CrossSectionElement[], extraSpace: number, targetWidth: number = 2.4): CrossSectionElement[] {
  const result = elements.map(el => ({ ...el }));
  const sidewalks = result.filter(el => el.type === 'sidewalk');
  const extraPerSide = Math.max(0, extraSpace / Math.max(sidewalks.length, 1));

  sidewalks.forEach(sw => {
    sw.width = Math.max(sw.width, targetWidth) + extraPerSide * 0.5;
    sw.label = `${sw.width.toFixed(1)}m`;
    sw.isEstimated = false;
  });

  // Add sidewalks if missing
  if (sidewalks.length === 0) {
    const firstCurbIdx = result.findIndex(el => el.type === 'curb');
    if (firstCurbIdx !== -1) {
      result.splice(firstCurbIdx, 0, { type: 'sidewalk', width: targetWidth, label: `${targetWidth.toFixed(1)}m`, isEstimated: false });
    }
    const lastCurbIdx = result.length - 1 - [...result].reverse().findIndex(el => el.type === 'curb');
    if (lastCurbIdx !== -1) {
      result.splice(lastCurbIdx + 1, 0, { type: 'sidewalk', width: targetWidth, label: `${targetWidth.toFixed(1)}m`, isEstimated: false });
    }
  }

  return result;
}

function applyStreetTrees(elements: CrossSectionElement[]): CrossSectionElement[] {
  if (elements.some(el => el.type === 'tree')) return [...elements];

  const result = [...elements];
  const sidewalkIndices: number[] = [];
  result.forEach((el, i) => { if (el.type === 'sidewalk') sidewalkIndices.push(i); });

  let offset = 0;
  sidewalkIndices.forEach(idx => {
    result.splice(idx + offset + 1, 0, { type: 'tree', width: 0, isEstimated: false });
    offset++;
  });

  return result;
}

function buildImprovedConfig(
  current: CrossSectionConfig,
  active: Set<ImprovementKey>,
  measurements: MeasurementValues,
): CrossSectionConfig {
  let elements = current.elements.map(el => ({ ...el }));
  let spaceFreed = 0;

  // Order matters: remove first to free space, then add
  if (active.has('removeParking')) {
    const r = applyRemoveParking(elements);
    elements = r.elements;
    spaceFreed += r.spaceFreed;
  }
  if (active.has('roadDiet')) {
    const r = applyRoadDiet(elements, current.highwayType, measurements.lanesToRemove);
    elements = r.elements;
    spaceFreed += r.spaceFreed;
  }
  if (active.has('bikeLanes')) {
    elements = applyBikeLanes(elements, measurements.bikeLaneWidth);
  }
  if (active.has('widenSidewalks')) {
    elements = applyWidenSidewalks(elements, spaceFreed, measurements.sidewalkTarget);
  }
  if (active.has('streetTrees')) {
    elements = applyStreetTrees(elements);
  }

  const totalWidth = elements.reduce((sum, el) => sum + el.width, 0);
  return { elements, totalWidth, streetName: current.streetName, highwayType: current.highwayType };
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function MeasurementAdjuster({
  param,
  value,
  onChange,
}: {
  param: MeasurementParam;
  value: number;
  onChange: (v: number) => void;
}) {
  const canDecrease = value - param.step >= param.min - 0.001;
  const canIncrease = value + param.step <= param.max + 0.001;
  const displayValue = param.unit ? `${value.toFixed(param.step < 1 ? 1 : 0)}${param.unit}` : value.toFixed(0);

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-xs flex-shrink-0" style={{ color: '#8a9a8a' }}>{param.label}</span>
      <div className="flex items-center gap-0 ml-auto rounded-md border overflow-hidden" style={{ borderColor: '#d0cbc0' }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (canDecrease) onChange(Math.round((value - param.step) * 10) / 10); }}
          className="px-1.5 py-0.5 text-xs font-bold transition-colors"
          style={{ color: canDecrease ? '#2a3a2a' : '#d0cbc0', backgroundColor: 'rgba(255,255,255,0.8)' }}
          disabled={!canDecrease}
        >
          -
        </button>
        <span
          className="px-2 py-0.5 text-xs font-semibold tabular-nums min-w-[3rem] text-center"
          style={{ color: '#2a3a2a', backgroundColor: '#faf8f5' }}
        >
          {displayValue}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); if (canIncrease) onChange(Math.round((value + param.step) * 10) / 10); }}
          className="px-1.5 py-0.5 text-xs font-bold transition-colors"
          style={{ color: canIncrease ? '#2a3a2a' : '#d0cbc0', backgroundColor: 'rgba(255,255,255,0.8)' }}
          disabled={!canIncrease}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ImprovementToggle({
  option,
  active,
  onToggle,
  measurementValues,
  onMeasurementChange,
}: {
  option: ImprovementOption;
  active: boolean;
  onToggle: () => void;
  measurementValues: MeasurementValues;
  onMeasurementChange: (id: string, value: number) => void;
}) {
  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        active ? 'shadow-sm' : 'hover:shadow-sm'
      }`}
      style={{
        borderColor: active ? '#22c55e' : '#e0dbd0',
        backgroundColor: active ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.5)',
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className="text-base flex-shrink-0">{option.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold" style={{ color: active ? '#16a34a' : '#2a3a2a' }}>
            {option.label}
          </div>
          <div className="text-xs" style={{ color: '#8a9a8a' }}>{option.description}</div>
        </div>
        {/* Toggle dot */}
        <div
          className="w-8 h-4.5 rounded-full flex-shrink-0 relative transition-colors duration-200"
          style={{ backgroundColor: active ? '#22c55e' : '#e0dbd0', padding: '2px' }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: active ? 'translateX(14px)' : 'translateX(0)' }}
          />
        </div>
      </button>
      {/* Measurement adjusters — shown when toggle is active */}
      {active && option.measurements && option.measurements.length > 0 && (
        <div className="px-3 pb-2 pl-10">
          {option.measurements.map(param => (
            <MeasurementAdjuster
              key={param.id}
              param={param}
              value={measurementValues[param.id] ?? param.default}
              onChange={(v) => onMeasurementChange(param.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/** Data snapshot for export/report — includes current config, display config, and active improvements */
export interface CrossSectionSnapshot {
  currentConfig: CrossSectionConfig;
  displayConfig: CrossSectionConfig;
  activeImprovements: string[];
  streetName: string;
  highwayType: string;
}

interface StreetCrossSectionProps {
  location: Location;
  metrics: WalkabilityMetrics;
  isPremium?: boolean;
  onUnlock?: () => void;
  onConfigChange?: (snapshot: CrossSectionSnapshot | null) => void;
}

export default function StreetCrossSection({
  location,
  metrics,
  isPremium = false,
  onUnlock,
  onConfigChange,
}: StreetCrossSectionProps) {
  const [streetAttrs, setStreetAttrs] = useState<StreetAttributes | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImprovements, setActiveImprovements] = useState<Set<ImprovementKey>>(new Set());
  const [measurements, setMeasurements] = useState<MeasurementValues>(() => {
    const defaults: MeasurementValues = {};
    IMPROVEMENTS.forEach(imp => imp.measurements?.forEach(m => { defaults[m.id] = m.default; }));
    return defaults;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActiveImprovements(new Set());

    fetchNearestStreetDetails(location.lat, location.lon)
      .then(attrs => {
        if (cancelled) return;
        setStreetAttrs(attrs || { name: location.displayName.split(',')[0], highway: 'residential' });
      })
      .catch(() => {
        if (cancelled) return;
        setStreetAttrs({ name: location.displayName.split(',')[0], highway: 'residential' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [location.lat, location.lon, location.displayName]);

  const currentConfig = useMemo(() => buildCurrentCrossSection(streetAttrs), [streetAttrs]);

  const displayConfig = useMemo(() => {
    if (!currentConfig) return null;
    if (activeImprovements.size === 0) return currentConfig;
    return buildImprovedConfig(currentConfig, activeImprovements, measurements);
  }, [currentConfig, activeImprovements, measurements]);

  // Report config to parent for export/report
  useEffect(() => {
    if (!onConfigChange) return;
    if (!currentConfig || !displayConfig) {
      onConfigChange(null);
      return;
    }
    onConfigChange({
      currentConfig,
      displayConfig,
      activeImprovements: Array.from(activeImprovements),
      streetName: currentConfig.streetName,
      highwayType: currentConfig.highwayType,
    });
  }, [displayConfig, currentConfig, activeImprovements, onConfigChange]);

  const applicableImprovements = useMemo(() => {
    if (!currentConfig) return [];
    return IMPROVEMENTS.filter(imp => imp.applicable(currentConfig, metrics));
  }, [currentConfig, metrics]);

  const toggleImprovement = (key: ImprovementKey) => {
    setActiveImprovements(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateMeasurement = (id: string, value: number) => {
    setMeasurements(prev => ({ ...prev, [id]: value }));
  };

  const resetAll = () => {
    setActiveImprovements(new Set());
    const defaults: MeasurementValues = {};
    IMPROVEMENTS.forEach(imp => imp.measurements?.forEach(m => { defaults[m.id] = m.default; }));
    setMeasurements(defaults);
  };

  const hasChanges = activeImprovements.size > 0;

  if (loading) {
    return (
      <div className="rounded-2xl border p-8 animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}>
        <div className="h-6 w-1/3 rounded" style={{ backgroundColor: '#e0dbd0' }} />
        <div className="h-48 rounded-xl mt-4" style={{ backgroundColor: '#f0ebe0' }} />
      </div>
    );
  }

  if (!displayConfig) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}>
        <div className="text-4xl mb-3">🚧</div>
        <h3 className="font-bold mb-1" style={{ color: '#2a3a2a' }}>No street data available</h3>
        <p className="text-sm" style={{ color: '#8a9a8a' }}>
          No classified street found near this address.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 sm:p-8" style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold" style={{ color: '#2a3a2a' }}>
            Street Cross-Section
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#8a9a8a' }}>
            {streetAttrs?.name || 'Nearest street'}
            <span className="mx-1.5" style={{ color: '#c5c0b5' }}>|</span>
            <span className="capitalize">{currentConfig?.highwayType?.replace('_', ' ')}</span>
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={resetAll}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: '#e0dbd0', color: '#8a9a8a' }}
          >
            Reset to Current
          </button>
        )}
      </div>

      {/* SVG Diagram */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#e0dbd0' }}>
        <CrossSectionSVG config={displayConfig} />
      </div>

      {/* State label */}
      <div className="flex items-center justify-between mt-3 mb-1">
        <span className="text-xs font-semibold" style={{ color: hasChanges ? '#16a34a' : '#8a9a8a' }}>
          {hasChanges ? `${activeImprovements.size} improvement${activeImprovements.size > 1 ? 's' : ''} applied` : 'Current state'}
        </span>
        <span className="text-xs" style={{ color: '#b0a8a0' }}>
          {streetAttrs?.lanes || streetAttrs?.width ? 'Dimensions from OSM' : 'Estimated from road type'}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-5 text-xs" style={{ color: '#8a9a8a' }}>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#4B5563' }} /> Travel lane
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#c5c0b5' }} /> Sidewalk
        </span>
        {displayConfig.elements.some(el => el.type === 'parking') && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#6B7280' }} /> Parking
          </span>
        )}
        {displayConfig.elements.some(el => el.type === 'bikelane') && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34,197,94,0.25)', border: '1px solid #16A34A' }} /> Bike lane
          </span>
        )}
        {displayConfig.elements.some(el => el.type === 'tree') && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} /> Tree
          </span>
        )}
      </div>

      {/* Improvement toggles */}
      {isPremium ? (
        <>
          {applicableImprovements.length > 0 && (
            <div className="border-t pt-5" style={{ borderColor: '#e0dbd0' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: '#2a3a2a' }}>
                Toggle improvements to see how this street could change
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {applicableImprovements.map(imp => (
                  <ImprovementToggle
                    key={imp.key}
                    option={imp}
                    active={activeImprovements.has(imp.key)}
                    onToggle={() => toggleImprovement(imp.key)}
                    measurementValues={measurements}
                    onMeasurementChange={updateMeasurement}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="border-t pt-5" style={{ borderColor: '#e0dbd0' }}>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#faf8f5', border: '1px solid #e0dbd0' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm mb-1" style={{ color: '#2a3a2a' }}>Explore Street Redesign</h4>
                <p className="text-xs" style={{ color: '#8a9a8a' }}>
                  Sign in to toggle improvements like bike lanes, wider sidewalks, and street trees — free!
                </p>
              </div>
              {onUnlock && (
                <button
                  onClick={onUnlock}
                  className="px-4 py-2 rounded-xl font-semibold text-white text-sm whitespace-nowrap"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Design Standards Reference — always visible */}
      <StreetDesignStandards config={displayConfig} />
    </div>
  );
}
