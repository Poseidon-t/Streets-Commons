/**
 * PremiumPaywall — Moving Research upsell card.
 * $29 one-time unlock for families/individuals relocating.
 */

interface PremiumPaywallProps {
  onUnlock: () => void;
  loading?: boolean;
}

const FEATURES = [
  {
    icon: '🎓',
    label: 'School Route Safety',
    detail: 'Step-by-step walk to school with every crossing, speed limit, and sidewalk gap',
  },
  {
    icon: '🚌',
    label: 'Commute Analysis',
    detail: 'Door-to-door commute to your workplace with walking leg quality scores',
  },
  {
    icon: '💰',
    label: 'Car-Free Savings',
    detail: 'Monthly savings estimate if you ditch the car in this neighborhood',
  },
  {
    icon: '📌',
    label: 'Unlimited Saved Addresses',
    detail: 'Save and compare as many neighborhoods as you need',
  },
  {
    icon: '🏘️',
    label: 'Similar Neighborhoods',
    detail: '5 walkable neighborhoods with similar scores and price range',
  },
  {
    icon: '📄',
    label: 'PDF Reports',
    detail: 'Downloadable report for every address — share with your partner',
  },
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
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#f0e8d8',
          fontWeight: 700,
        }}>
          Moving Research
        </span>
        <span style={{
          fontSize: 13,
          letterSpacing: '0.06em',
          color: '#e0d8c8',
          fontWeight: 600,
        }}>
          For Families & Relocators
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '28px 24px', textAlign: 'center' }}>
        {/* Headline */}
        <h2 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 22,
          fontWeight: 700,
          color: '#1a3a1a',
          lineHeight: 1.25,
          marginBottom: 6,
        }}>
          Is the walk to school safe?<br />What's your real commute?
        </h2>

        {/* Subhead */}
        <p style={{
          fontSize: 13,
          color: '#5a5040',
          fontWeight: 500,
          lineHeight: 1.5,
          marginBottom: 20,
          maxWidth: 420,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          The free score tells you <em>if</em> a neighborhood is walkable. Moving Research tells you if it works <em>for your family</em>.
        </p>

        {/* Feature list */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          marginBottom: 24,
          border: '1px solid #c4b59a',
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderBottom: i < FEATURES.length - 1 ? '1px solid #c4b59a' : 'none',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a3a1a' }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#5a5040', lineHeight: 1.4, marginTop: 2 }}>
                  {f.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Price + anchor */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 8,
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
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5a5040' }}>
              one-time
            </span>
          </div>
          <div style={{
            fontSize: 12,
            color: '#5a5040',
            fontWeight: 500,
            marginTop: 6,
          }}>
            Other tools charge $50/month. SafeStreets: $29, once, forever.
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onUnlock}
          disabled={loading}
          style={{
            display: 'inline-block',
            padding: '14px 36px',
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
          {loading ? 'Processing...' : 'Unlock Moving Research'}
        </button>

        {/* Trust signals */}
        <div style={{
          fontSize: 13,
          color: '#5a5040',
          fontWeight: 500,
          marginTop: 14,
          lineHeight: 1.5,
        }}>
          No subscription · Works for every address · Data from 8+ public sources
        </div>
      </div>
    </div>
  );
}
