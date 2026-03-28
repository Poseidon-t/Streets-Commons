/**
 * CommuteAnalysis — Premium feature component.
 * Shows door-to-door commute breakdown with walking leg quality analysis.
 * Retro urbanism design theme.
 */

import { useState } from 'react';
import type { CommuteAnalysisResult, RouteSegmentSafety } from '../../types';

interface CommuteAnalysisProps {
  data: CommuteAnalysisResult;
}

function safetyColor(s: RouteSegmentSafety): string {
  if (s === 'safe') return '#1a7a28';
  if (s === 'caution') return '#b87a00';
  return '#b8401a';
}

function safetyLabel(s: RouteSegmentSafety): string {
  if (s === 'safe') return 'SAFE';
  if (s === 'caution') return 'CAUTION';
  return 'UNSAFE';
}

function gaugeFillStyle(color: string): React.CSSProperties {
  return {
    height: '100%',
    background: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 3px, ${color}88 3px, ${color}88 4px)`,
  };
}

export default function CommuteAnalysis({ data }: CommuteAnalysisProps) {
  const [expanded, setExpanded] = useState(true);
  const maxCommuteTime = Math.max(...data.comparison.map(c => c.durationMinutes));

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
          fontSize: 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#f0e8d8',
          fontWeight: 700,
        }}>
          🚌 Commute Analysis
        </span>
        <span style={{
          fontSize: 13,
          letterSpacing: '0.06em',
          color: '#e0d8c8',
          fontWeight: 600,
        }}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <>
          {/* Address inputs (readonly display) */}
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #c4b59a' }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5040', flexShrink: 0 }}>Home:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a3a1a' }}>{data.homeName}</span>
          </div>
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #c4b59a' }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5040', flexShrink: 0 }}>Work:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a3a1a' }}>{data.workName}</span>
          </div>

          {/* Journey visualization */}
          <div style={{ padding: '20px 18px', borderBottom: '1px solid #c4b59a' }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#5a5040',
              marginBottom: 14,
            }}>
              Your door-to-door commute
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto' }}>
              {data.journeyLegs.map((leg, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  {/* Leg */}
                  <div style={{ flex: 1, textAlign: 'center', padding: '0 4px', minWidth: 60 }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{leg.icon}</div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#5a5040',
                      marginBottom: 4,
                    }}>
                      {leg.label}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 20,
                      fontWeight: 800,
                      lineHeight: 1,
                      color: leg.mode === 'walk' ? '#1a7a28' : leg.mode === 'transfer' ? '#b87a00' : '#1a3a1a',
                    }}>
                      {leg.durationMinutes}
                    </div>
                    <div style={{ fontSize: 12, color: '#2a2010', fontWeight: 500, marginTop: 3, lineHeight: 1.3 }}>
                      {leg.detail}
                    </div>
                  </div>

                  {/* Arrow (not after last) */}
                  {i < data.journeyLegs.length - 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      flexShrink: 0,
                      paddingTop: 8,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 3l5 5-5 5" stroke="#c4b59a" strokeWidth="2" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total time bar */}
          <div style={{
            background: '#1a3a1a',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#c4b59a',
            }}>
              Total door-to-door
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 32,
              fontWeight: 700,
              color: '#f0e8d8',
              lineHeight: 1,
            }}>
              {data.totalMinutes} <span style={{ fontSize: 14, fontWeight: 600, color: '#c4b59a' }}>min</span>
            </div>
          </div>

          {/* Walking legs quality */}
          {data.walkLegs.map((leg, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid #c4b59a' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#1a3a1a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  🚶 {leg.legLabel}
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  border: `2px solid ${safetyColor(leg.safety)}`,
                  color: safetyColor(leg.safety),
                }}>
                  {safetyLabel(leg.safety)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <QualityItem label="Sidewalks" value={`${leg.sidewalkCoverage}%`} color={leg.sidewalkCoverage >= 80 ? '#1a7a28' : leg.sidewalkCoverage >= 50 ? '#b87a00' : '#b8401a'} />
                <QualityItem label="Max Speed" value={`${leg.maxSpeedMph} mph`} color={leg.maxSpeedMph <= 25 ? '#1a7a28' : leg.maxSpeedMph <= 35 ? '#b87a00' : '#b8401a'} />
                <QualityItem label="Crossings" value={leg.crossings} color="#1a3a1a" />
                <QualityItem label="Lighting" value={leg.lighting} color={leg.lighting === 'Excellent' || leg.lighting === 'Good' ? '#1a7a28' : '#b87a00'} />
              </div>
            </div>
          ))}

          {/* Mode comparison */}
          <div style={{ borderTop: '2px solid #1a1208' }}>
            <div style={{
              background: '#1a3a1a',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f0e8d8', fontWeight: 700 }}>
                How does this compare?
              </span>
              <span style={{ fontSize: 13, letterSpacing: '0.06em', color: '#e0d8c8', fontWeight: 600 }}>
                Same Route
              </span>
            </div>

            <div style={{ padding: 18 }}>
              {data.comparison.map((mode, i) => {
                const barWidth = maxCommuteTime > 0 ? Math.round((mode.durationMinutes / maxCommuteTime) * 100) : 0;
                const barColor = mode.isThisRoute ? '#1a7a28' : '#7a6e5a';

                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: i < data.comparison.length - 1 ? '1px solid #e8e4d8' : 'none',
                  }}>
                    <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                      {mode.icon}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a3a1a', flex: 1 }}>
                      {mode.mode}
                    </span>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 16,
                      fontWeight: 800,
                      flexShrink: 0,
                      color: mode.isThisRoute ? '#1a7a28' : '#1a3a1a',
                    }}>
                      {mode.durationMinutes} min
                    </span>
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <div style={{
                        height: 6,
                        border: '1px solid #c4b59a',
                        background: 'rgba(255,255,255,0.4)',
                        overflow: 'hidden',
                      }}>
                        <div style={{ ...gaugeFillStyle(barColor), width: `${barWidth}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assessment */}
            <div style={{
              padding: '16px 18px',
              borderTop: '1px solid #c4b59a',
              background: '#f5f2eb',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a3a1a', marginBottom: 6 }}>
                💡 Commute Assessment
              </div>
              <div style={{ fontSize: 13, color: '#2a2010', lineHeight: 1.55 }}
                dangerouslySetInnerHTML={{ __html: data.assessment }}
              />
            </div>
          </div>

          {/* Source */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #c4b59a' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5a5040' }}>
              Source: GTFS transit schedules · OpenStreetMap road data · Walking time estimates at 3.1 mph avg
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function QualityItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#f5f2eb',
      padding: '8px 12px',
      border: '1px solid #c4b59a',
      flex: 1,
      minWidth: 100,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#5a5040',
        marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 14,
        fontWeight: 800,
        color,
      }}>
        {value}
      </div>
    </div>
  );
}
