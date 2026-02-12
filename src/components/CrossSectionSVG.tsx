/**
 * Static SVG renderer for street cross-sections.
 * Shared between the interactive StreetCrossSection and the print report.
 */

import type { CrossSectionConfig } from '../types';

const SVG_SCALE = 10;
const ROAD_Y = 80;
const ROAD_HEIGHT = 8;
const BUILDING_HEIGHT = 65;
const TREE_CANOPY_Y = 25;
const TREE_CANOPY_R = 13;
const TREE_TRUNK_WIDTH = 2;
const LABEL_Y = ROAD_Y + ROAD_HEIGHT + 18;
const SVG_HEIGHT = LABEL_Y + 22;

function Building({ x, width }: { x: number; width: number }) {
  const windowRows = 4;
  const windowCols = Math.max(1, Math.floor(width / 8));
  const windowW = 4;
  const windowH = 6;
  const gapX = (width - windowCols * windowW) / (windowCols + 1);
  const gapY = BUILDING_HEIGHT / (windowRows + 1);

  return (
    <g>
      <rect x={x} y={ROAD_Y - BUILDING_HEIGHT} width={width} height={BUILDING_HEIGHT} fill="#8a9a8a" />
      {Array.from({ length: windowRows }, (_, row) =>
        Array.from({ length: windowCols }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={x + gapX + col * (windowW + gapX)}
            y={ROAD_Y - BUILDING_HEIGHT + gapY + row * (windowH + gapY)}
            width={windowW}
            height={windowH}
            fill="#e0dbd0"
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
      <rect x={x} y={ROAD_Y - 2} width={width} height={ROAD_HEIGHT + 2} fill="#c5c0b5" />
      {Array.from({ length: Math.floor(width / 4) }, (_, i) => (
        <line
          key={i}
          x1={x + (i + 1) * 4}
          y1={ROAD_Y - 2}
          x2={x + (i + 1) * 4}
          y2={ROAD_Y + ROAD_HEIGHT}
          stroke="#b0a8a0"
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
  return <rect x={x} y={ROAD_Y - 3} width={1.5} height={ROAD_HEIGHT + 3} fill="#2a3a2a" />;
}

function ParkingLane({ x, width }: { x: number; width: number }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="#6B7280" />
      {Array.from({ length: Math.ceil(width / 5) }, (_, i) => (
        <line
          key={i}
          x1={x + i * 5}
          y1={ROAD_Y}
          x2={x + i * 5 + 4}
          y2={ROAD_Y + ROAD_HEIGHT}
          stroke="#8a9a8a"
          strokeWidth={0.5}
        />
      ))}
      {width >= 15 && (
        <rect x={x + width * 0.15} y={ROAD_Y + 1.5} width={width * 0.7} height={5} rx={1.5} fill="#4B5563" opacity={0.5} />
      )}
    </g>
  );
}

function BikeLane({ x, width }: { x: number; width: number }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="#22C55E" opacity={0.25} />
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="none" stroke="#16A34A" strokeWidth={0.5} />
      <g transform={`translate(${x + width / 2}, ${ROAD_Y + ROAD_HEIGHT / 2})`}>
        <circle r={2} fill="none" stroke="#16A34A" strokeWidth={0.6} cx={-2} cy={0} />
        <circle r={2} fill="none" stroke="#16A34A" strokeWidth={0.6} cx={2} cy={0} />
        <line x1={-2} y1={0} x2={0} y2={-2} stroke="#16A34A" strokeWidth={0.5} />
        <line x1={0} y1={-2} x2={2} y2={0} stroke="#16A34A" strokeWidth={0.5} />
      </g>
    </g>
  );
}

function TravelLane({ x, width, isLast }: { x: number; width: number; isLast: boolean }) {
  return (
    <g>
      <rect x={x} y={ROAD_Y} width={width} height={ROAD_HEIGHT} fill="#4B5563" />
      {!isLast && (
        <line
          x1={x + width} y1={ROAD_Y + 1}
          x2={x + width} y2={ROAD_Y + ROAD_HEIGHT - 1}
          stroke="#FFFFFF" strokeWidth={0.5} strokeDasharray="2 2"
        />
      )}
      <polygon
        points={`${x + width / 2},${ROAD_Y + 2} ${x + width / 2 - 1.5},${ROAD_Y + 5} ${x + width / 2 + 1.5},${ROAD_Y + 5}`}
        fill="#8a9a8a" opacity={0.6}
      />
    </g>
  );
}

function DimensionLabel({ x, width, text, isEstimated }: { x: number; width: number; text: string; isEstimated: boolean }) {
  if (width < 5) return null;
  const displayText = isEstimated ? `~${text}` : text;
  return (
    <g>
      <line x1={x + 1} y1={LABEL_Y - 4} x2={x + 1} y2={LABEL_Y} stroke="#8a9a8a" strokeWidth={0.3} />
      <line x1={x + width - 1} y1={LABEL_Y - 4} x2={x + width - 1} y2={LABEL_Y} stroke="#8a9a8a" strokeWidth={0.3} />
      <line x1={x + 1} y1={LABEL_Y - 1} x2={x + width - 1} y2={LABEL_Y - 1} stroke="#8a9a8a" strokeWidth={0.3} />
      <text
        x={x + width / 2} y={LABEL_Y + 6}
        textAnchor="middle" fontSize={4} fill="#6b7280"
        fontStyle={isEstimated ? 'italic' : 'normal'}
      >
        {displayText}
      </text>
    </g>
  );
}

export default function CrossSectionSVG({ config, className }: { config: CrossSectionConfig; className?: string }) {
  const totalSVGWidth = config.totalWidth * SVG_SCALE;

  let cursorX = 0;
  let travelLaneIdx = 0;
  const travelLaneCount = config.elements.filter(el => el.type === 'travel_lane').length;

  return (
    <svg
      viewBox={`0 0 ${totalSVGWidth} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? 'w-full h-auto transition-all duration-500'}
      role="img"
      aria-label={`Cross-section of ${config.streetName}`}
    >
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8d4e3" />
          <stop offset="100%" stopColor="#e8f0f5" />
        </linearGradient>
      </defs>
      <rect width={totalSVGWidth} height={ROAD_Y - 2} fill="url(#sky-grad)" />
      <rect x={0} y={ROAD_Y + ROAD_HEIGHT} width={totalSVGWidth} height={2} fill="#92400E" opacity={0.3} />

      {config.elements.map((el, i) => {
        const x = cursorX;
        const w = el.width * SVG_SCALE;
        cursorX += w;

        if (el.type === 'tree') {
          const prevEl = config.elements[i - 1];
          const sidewalkCenter = x - (prevEl ? prevEl.width * SVG_SCALE / 2 : 5);
          return <TreeElement key={`tree-${i}`} x={sidewalkCenter} />;
        }

        const rendered = (() => {
          switch (el.type) {
            case 'building': return <Building x={x} width={w} />;
            case 'sidewalk': return <Sidewalk x={x} width={w} />;
            case 'curb': return <Curb x={x} />;
            case 'parking': return <ParkingLane x={x} width={w} />;
            case 'bikelane': return <BikeLane x={x} width={w} />;
            case 'travel_lane': {
              const isLast = travelLaneIdx === travelLaneCount - 1;
              travelLaneIdx++;
              return <TravelLane x={x} width={w} isLast={isLast} />;
            }
            default: return null;
          }
        })();

        return (
          <g key={`${el.type}-${i}`}>
            {rendered}
            {el.label && <DimensionLabel x={x} width={w} text={el.label} isEstimated={el.isEstimated} />}
          </g>
        );
      })}
    </svg>
  );
}
