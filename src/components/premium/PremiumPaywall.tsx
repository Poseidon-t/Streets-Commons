/**
 * PremiumPaywall — retro urbanism upsell card shown after free results.
 * Prompts users to unlock School Route Safety + Commute Analysis for $29.
 */

interface PremiumPaywallProps {
  onUnlock: () => void;
  loading?: boolean;
}

const FEATURES = [
  { icon: '🎓', label: 'School Route Safety — exact route, every crossing, speed limits' },
  { icon: '🚌', label: 'Commute Analysis — door-to-door walk + transit + walk' },
  { icon: '🛡️', label: 'Safety Routes to all 6 daily destinations' },
  { icon: '💰', label: 'Car-Free Savings calculator' },
  { icon: '🏘️', label: '3 similar walkable neighborhoods' },
  { icon: '📄', label: 'Downloadable PDF report' },
];

export default function PremiumPaywall({ onUnlock, loading }: PremiumPaywallProps) {
  return (
    <div style={{
      border: '2px solid #1a1208',
      background: '#f5f2eb',
      overflow: 'hidden',
      boxShadow: '3px 3px 0 rgba(26,18,8,0.10)',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{
        background: '#1a3a1a',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#f0e8d8',
          fontWeight: 700,
        }}>
          Unlock Premium Analysis
        </span>
        <span style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          color: '#e0d8c8',
          fontWeight: 600,
        }}>
          $29 One-Time
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '28px 24px', textAlign: 'center' }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#e07850',
          marginBottom: 8,
        }}>
          Go Deeper
        </div>

        {/* Headline */}
        <h2 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 22,
          fontWeight: 700,
          color: '#1a3a1a',
          lineHeight: 1.25,
          marginBottom: 12,
        }}>
          Is the walk to school safe?<br />What's your real commute?
        </h2>

        {/* Feature list */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          marginBottom: 20,
          border: '1px solid #c4b59a',
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderBottom: i < FEATURES.length - 1 ? '1px solid #c4b59a' : 'none',
                fontSize: 13,
                fontWeight: 600,
                color: '#1a3a1a',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 10, color: '#c4b59a', flexShrink: 0 }}>🔒</span>
            </div>
          ))}
        </div>

        {/* Price */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 16,
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 42,
            fontWeight: 700,
            color: '#1a3a1a',
            lineHeight: 1,
          }}>
            $29
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#7a6e5a' }}>
            one-time · instant
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={onUnlock}
          disabled={loading}
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: loading ? '#c4b59a' : '#e07850',
            color: '#fff',
            border: `2px solid ${loading ? '#a09880' : '#c06040'}`,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Processing...' : 'Unlock full report →'}
        </button>

        {/* Note */}
        <div style={{
          fontSize: 11,
          color: '#7a6e5a',
          fontWeight: 500,
          marginTop: 12,
        }}>
          No subscription · PDF included · Data from 8+ public sources
        </div>
      </div>
    </div>
  );
}
