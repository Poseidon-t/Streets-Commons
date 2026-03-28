/**
 * SchoolRouteSafety — Premium feature component.
 * Shows step-by-step walking route analysis from home to school.
 * Retro urbanism design theme.
 */

import { useState } from 'react';
import type { SchoolRouteSafetyResult, RouteSegmentSafety } from '../../types';

interface SchoolRouteSafetyProps {
  data: SchoolRouteSafetyResult;
}

function safetyColor(s: RouteSegmentSafety): string {
  if (s === 'safe') return '#1a7a28';
  if (s === 'caution') return '#b87a00';
  return '#b8401a';
}

function stampClass(s: RouteSegmentSafety): { color: string; borderColor: string } {
  if (s === 'safe') return { color: '#1a7a28', borderColor: '#1a7a28' };
  if (s === 'caution') return { color: '#b87a00', borderColor: '#b87a00' };
  return { color: '#b8401a', borderColor: '#b8401a' };
}

function verdictStamp(verdict: string): { color: string; borderColor: string; label: string } {
  if (verdict === 'Safe') return { color: '#1a7a28', borderColor: '#1a7a28', label: 'SAFE' };
  if (verdict === 'Walk with Caution') return { color: '#b87a00', borderColor: '#b87a00', label: 'CAUTION' };
  return { color: '#b8401a', borderColor: '#b8401a', label: 'NOT RECOMMENDED' };
}

export default function SchoolRouteSafety({ data }: SchoolRouteSafetyProps) {
  const [expanded, setExpanded] = useState(true);
  const stamp = verdictStamp(data.verdict);

  return (
    <div style={{
      border: '2px solid #1a1208',
      background: '#fff',
      overflow: 'hidden',
      boxShadow: '3px 3px 0 rgba(26,18,8,0.10)',
      marginBottom: 4,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          background: '#1a3a1a',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#f0e8d8',
          fontWeight: 700,
        }}>
          🎓 School Route Safety
        </span>
        <span style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          color: '#e0d8c8',
          fontWeight: 600,
        }}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <>
          {/* School name */}
          <div style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid #c4b59a',
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#7a6e5a',
              flexShrink: 0,
            }}>
              School:
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1a3a1a',
            }}>
              {data.schoolName}
            </span>
          </div>

          {/* Route overview stats */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #c4b59a' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
              <StatRow label="Distance" value={`${data.totalDistanceMi.toFixed(1)} mi`} color={data.totalDistanceMi <= 1 ? '#1a7a28' : '#b87a00'} />
              <StatRow label="Walking Time" value={`${data.totalWalkMinutes} min`} color={data.totalWalkMinutes <= 15 ? '#1a7a28' : '#b87a00'} />
              <StatRow label="Road Crossings" value={String(data.totalCrossings)} color="#1a3a1a" />
              <StatRow label="High-Speed Crossings" value={String(data.highSpeedCrossings)} color={data.highSpeedCrossings === 0 ? '#1a7a28' : '#b8401a'} />
              <StatRow label="Sidewalk Coverage" value={`${data.sidewalkCoverage}%`} color={data.sidewalkCoverage >= 80 ? '#1a7a28' : data.sidewalkCoverage >= 50 ? '#b87a00' : '#b8401a'} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2a2010' }}>Overall Verdict</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  border: `2px solid ${stamp.borderColor}`,
                  color: stamp.color,
                }}>
                  {stamp.label}
                </span>
              </div>
            </div>
          </div>

          {/* Step-by-step segments */}
          <div style={{ padding: '0 18px 14px' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#7a6e5a',
              padding: '14px 0 10px',
            }}>
              Step-by-step route breakdown
            </div>

            {data.segments.map((seg, i) => {
              const dotColor = safetyColor(seg.safety);
              const nextSeg = data.segments[i + 1];
              const lineColor = nextSeg ? safetyColor(nextSeg.safety) : 'transparent';

              return (
                <div key={i} style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: i < data.segments.length - 1 ? '1px solid #e8e4d8' : 'none',
                }}>
                  {/* Step indicator */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: 24,
                    flexShrink: 0,
                    paddingTop: 2,
                  }}>
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      border: `2px solid ${dotColor}`,
                      background: seg.isCrossing ? '#fff' : dotColor,
                      flexShrink: 0,
                    }} />
                    <div style={{
                      width: 2,
                      flex: 1,
                      marginTop: 4,
                      minHeight: 20,
                      background: lineColor,
                    }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: seg.safety === 'danger' ? '#b8401a' : '#1a3a1a',
                    }}>
                      {seg.safety === 'danger' && '⚠ '}{seg.streetName}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#2a2010',
                      marginTop: 2,
                      lineHeight: 1.4,
                      fontWeight: 500,
                    }}>
                      {seg.description}
                    </div>
                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {seg.badges.map((badge, bi) => {
                        const bc = badge.type === 'info'
                          ? { color: '#7a6e5a', borderColor: '#c4b59a' }
                          : stampClass(badge.type);
                        return (
                          <span key={bi} style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: '2px 7px',
                            border: `1px solid ${bc.borderColor}`,
                            color: bc.color,
                          }}>
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 16,
                      fontWeight: 800,
                      lineHeight: 1,
                      color: safetyColor(seg.safety),
                    }}>
                      {seg.walkMinutes < 1 ? '<1' : seg.walkMinutes}
                    </div>
                    <div style={{ fontSize: 10, color: '#7a6e5a', fontWeight: 600 }}>
                      {seg.isCrossing ? 'min wait' : 'min'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Crossing alerts */}
          {data.crossingAlerts.map((alert, i) => (
            <div key={i} style={{
              margin: '0 18px 14px',
              border: '2px solid #b87a00',
              background: 'rgba(184,122,0,0.04)',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#b87a00',
                }}>
                  Critical Crossing: {alert.intersection}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#2a2010', lineHeight: 1.5, marginBottom: 12 }}>
                {alert.description}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a6e5a', marginBottom: 3 }}>
                    Speed Limit
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 800, color: '#b8401a' }}>
                    {alert.speedLimit} mph
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a6e5a', marginBottom: 3 }}>
                    Lanes
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 800, color: '#b8401a' }}>
                    {alert.lanes}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a6e5a', marginBottom: 3 }}>
                    Signal
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 800, color: '#b87a00' }}>
                    {alert.signal}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#7a6e5a' }}>
                Research: pedestrian fatality risk increases 4× between 30 mph and 40 mph impacts (AAA Foundation 2018)
              </div>
            </div>
          ))}

          {/* Overall verdict */}
          <div style={{
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderTop: '2px solid #1a1208',
          }}>
            <div style={{
              width: 4,
              alignSelf: 'stretch',
              minHeight: 48,
              flexShrink: 0,
              background: stamp.color,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
                color: stamp.color,
              }}>
                Verdict: {data.verdict}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2010', lineHeight: 1.5 }}>
                {data.verdictReason}
              </div>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              border: `2px solid ${stamp.borderColor}`,
              color: stamp.color,
              flexShrink: 0,
            }}>
              {stamp.label}
            </span>
          </div>

          {/* Source */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #c4b59a' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#7a6e5a' }}>
              Source: OpenStreetMap road data · Speed limits · Crossing infrastructure · Road classification
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#2a2010' }}>{label}</span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 14,
        fontWeight: 700,
        color,
      }}>
        {value}
      </span>
    </div>
  );
}
