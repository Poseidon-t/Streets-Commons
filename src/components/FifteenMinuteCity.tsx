/**
 * 15-Minute Walk Times Component
 * Retro urbanism design — shows walking times to 6 essential services
 * Free for all users
 */

import { useState, useEffect } from 'react';
import type { Location } from '../types';
import { calculate15MinuteCityScore, type FifteenMinuteCityScore } from '../services/fifteenMinuteCity';

interface FifteenMinuteCityProps {
  location: Location;
  osmElements?: unknown[];
  inline?: boolean;
}

type ServiceKey = 'grocery' | 'healthcare' | 'education' | 'recreation' | 'transit' | 'dining';

interface ServiceMeta {
  key: ServiceKey;
  icon: string;
  label: string;
  nearestLabel: string;
}

const SERVICE_LIST: ServiceMeta[] = [
  { key: 'grocery', icon: '🛒', label: 'Grocery', nearestLabel: 'Supermarket / Convenience' },
  { key: 'healthcare', icon: '🏥', label: 'Healthcare', nearestLabel: 'Pharmacy / Clinic' },
  { key: 'education', icon: '🏫', label: 'Education', nearestLabel: 'School / Library' },
  { key: 'recreation', icon: '🌳', label: 'Parks', nearestLabel: 'Park / Playground' },
  { key: 'transit', icon: '🚌', label: 'Transit', nearestLabel: 'Bus Stop / Station' },
  { key: 'dining', icon: '🍽️', label: 'Dining', nearestLabel: 'Restaurant / Cafe' },
];

const WALKING_SPEED_MPM = 80; // meters per minute (~5 km/h)
const MAX_DISTANCE = 1200;

function getStampInfo(available: boolean, distance: number): {
  text: string;
  color: string;
  borderColor: string;
} {
  if (!available || distance < 0) {
    return { text: 'MISSING', color: '#b8401a', borderColor: '#b8401a' };
  }
  if (distance <= 800) {
    return { text: 'PASS', color: '#1a7a28', borderColor: '#1a7a28' };
  }
  return { text: 'FAR', color: '#b87a00', borderColor: '#b87a00' };
}

function getBarFill(available: boolean, distance: number): string {
  if (!available || distance < 0) {
    return 'repeating-linear-gradient(90deg, #b8401a 0px, #b8401a 3px, rgba(184,64,26,0.55) 3px, rgba(184,64,26,0.55) 4px)';
  }
  if (distance <= 800) {
    return 'repeating-linear-gradient(90deg, #1a7a28 0px, #1a7a28 3px, rgba(26,122,40,0.55) 3px, rgba(26,122,40,0.55) 4px)';
  }
  return 'repeating-linear-gradient(90deg, #b87a00 0px, #b87a00 3px, rgba(184,122,0,0.55) 3px, rgba(184,122,0,0.55) 4px)';
}

function formatWalkTime(distance: number): string {
  if (distance <= 0) return '—';
  const minutes = Math.round(distance / WALKING_SPEED_MPM);
  return minutes < 1 ? '<1 min' : `${minutes} min`;
}

export default function FifteenMinuteCity({ location, osmElements, inline }: FifteenMinuteCityProps) {
  const [score, setScore] = useState<FifteenMinuteCityScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Reset state when location changes (derived from props, not effect)
  const locationKey = `${location.lat},${location.lon}`;
  const [prevLocationKey, setPrevLocationKey] = useState(locationKey);
  if (locationKey !== prevLocationKey) {
    setPrevLocationKey(locationKey);
    setScore(null);
    setIsLoading(true);
    setError(false);
  }

  useEffect(() => {
    let cancelled = false;

    calculate15MinuteCityScore(location.lat, location.lon, 1200, osmElements)
      .then(result => {
        if (!cancelled) {
          setScore(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [location.lat, location.lon, osmElements]);

  if (isLoading) {
    return (
      <div
        style={{
          border: inline ? 'none' : '2px solid #1a1208',
          background: '#f5f2eb',
          borderRadius: 0,
        }}
        className="p-5"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 animate-spin"
            style={{
              border: '2px solid #c4b59a',
              borderTopColor: '#1a3a1a',
              borderRadius: '50%',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#7a6e5a',
            }}
          >
            Analyzing walk times...
          </span>
        </div>
      </div>
    );
  }

  if (error || !score) {
    return null;
  }

  const servicesWithin = Object.values(score.serviceScores).filter(
    s => s.available && s.nearestDistance <= MAX_DISTANCE
  ).length;

  const overallStamp = getStampInfo(
    servicesWithin >= 4,
    servicesWithin >= 5 ? 400 : servicesWithin >= 4 ? 800 : 1400
  );

  return (
    <div
      style={{
        border: inline ? 'none' : '2px solid #1a1208',
        background: '#f5f2eb',
        borderRadius: 0,
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: '#1a3a1a' }}
      >
        <span
          style={{
            color: '#f0e8d8',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          15-Minute Walk Times
        </span>
        <span
          style={{
            color: '#f0e8d8',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 500,
            opacity: 0.7,
          }}
        >
          6 Essential Services
        </span>
      </div>

      {/* Service rows */}
      <div className="px-4 py-3">
        {SERVICE_LIST.map((svc, idx) => {
          const data = score.serviceScores[svc.key];
          const stamp = getStampInfo(data.available, data.nearestDistance);
          const barWidth = data.available && data.nearestDistance > 0
            ? Math.min(100, (data.nearestDistance / MAX_DISTANCE) * 100)
            : data.available ? 5 : 100;
          const barFill = getBarFill(data.available, data.nearestDistance);

          return (
            <div key={svc.key}>
              {idx > 0 && (
                <div style={{ borderTop: '1px dashed #d8d0c4' }} className="my-3" />
              )}
              <div className="flex items-center gap-3">
                {/* Icon */}
                <span style={{ fontSize: 18, lineHeight: 1 }}>{svc.icon}</span>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Top row: name, walk time, nearest type, stamp */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      style={{
                        fontSize: 13,
                        color: '#2a2010',
                        fontWeight: 600,
                      }}
                    >
                      {svc.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 13,
                        color: '#2a2010',
                        fontWeight: 700,
                      }}
                    >
                      {data.available ? formatWalkTime(data.nearestDistance) : '—'}
                    </span>
                    <span
                      className="hidden sm:inline"
                      style={{
                        fontSize: 11,
                        color: '#7a6e5a',
                        fontWeight: 500,
                      }}
                    >
                      {data.available
                        ? `${svc.nearestLabel} · ${data.count} found`
                        : 'Not found within 1.2 km'}
                    </span>
                    <span
                      style={{
                        border: `2px solid ${stamp.borderColor}`,
                        color: stamp.color,
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        padding: '4px 10px',
                        fontWeight: 700,
                        lineHeight: 1,
                        marginLeft: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stamp.text}
                    </span>
                  </div>

                  {/* Bottom row: distance + hatched bar */}
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#7a6e5a',
                        minWidth: 48,
                      }}
                    >
                      {data.available && data.nearestDistance > 0
                        ? `${data.nearestDistance}m`
                        : data.available ? 'nearby' : '—'}
                    </span>
                    <div
                      className="flex-1"
                      style={{
                        height: 8,
                        border: '1px solid #c4b59a',
                        background: '#f5f2eb',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${barWidth}%`,
                          background: barFill,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid #c4b59a' }}
      >
        <span
          style={{
            fontSize: 13,
            color: '#2a2010',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
            }}
          >
            {servicesWithin}
          </span>
          {' '}of 6 services within a 15-minute walk
        </span>
        <span
          style={{
            border: `2px solid ${overallStamp.borderColor}`,
            color: overallStamp.color,
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {score.overallScore}%
        </span>
      </div>

      {/* Footnote */}
      <div
        className="px-4 pb-3"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#7a6e5a',
        }}
      >
        Data: OpenStreetMap · 1.2 km radius · Walk speed ~5 km/h
      </div>
    </div>
  );
}
