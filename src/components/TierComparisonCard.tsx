interface TierComparisonCardProps {
  onUpgrade: () => void;
  onContact: () => void;
}

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    subtitle: 'No sign-up needed',
    color: '#5a8a5a',
    features: [
      { name: 'Walkability Analysis (8 metrics)', included: true },
      { name: 'Composite Score + Grade', included: true },
      { name: 'Equity Insights + Local Economy', included: true },
      { name: '15-Minute City Analysis', included: true },
      { name: 'Street Cross-Section (current)', included: true },
      { name: 'Compare Mode', included: true },
      { name: 'Field Verification & PDF Reports', included: true },
      { name: 'Meridian Chatbot (12 messages)', included: true },
      { name: 'Street Audit Tool', included: false },
      { name: 'Advocacy Letters & Proposals', included: false },
      { name: 'Street Redesign Mockup', included: false },
      { name: 'Unlimited Meridian Chatbot', included: false },
    ],
  },
  {
    name: 'Advocacy Toolkit',
    price: '$49',
    subtitle: 'One-time payment',
    color: '#e07850',
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Street Audit Tool', included: true },
      { name: 'Advocacy Letters & Proposals', included: true },
      { name: 'Street Redesign Mockup', included: true },
      { name: 'Unlimited Meridian Chatbot', included: true },
      { name: 'PDF / JSON Export', included: true },
      { name: 'Save Up To 10 Addresses', included: true },
    ],
  },
  {
    name: 'Custom Analysis',
    price: 'Contact Us',
    subtitle: 'For organizations',
    color: '#5090b0',
    features: [
      { name: 'Everything in Advocacy Toolkit', included: true },
      { name: 'Multi-location analysis', included: true },
      { name: 'Custom reporting', included: true },
      { name: 'Priority support', included: true },
      { name: 'Bulk data export', included: true },
    ],
  },
];

export default function TierComparisonCard({ onUpgrade, onContact }: TierComparisonCardProps) {
  return (
    <div className="rounded-2xl border-2 p-6 sm:p-8" style={{ borderColor: '#e0dbd0', backgroundColor: '#faf8f5' }}>
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold" style={{ color: '#2a3a2a' }}>
          Unlock More with SafeStreets
        </h3>
        <p className="text-sm mt-1" style={{ color: '#8a9a8a' }}>
          Choose the plan that fits your advocacy needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className="rounded-xl p-5 flex flex-col"
            style={{
              backgroundColor: 'white',
              border: tier.name === 'Advocacy Toolkit' ? `2px solid ${tier.color}` : '1px solid #e0dbd0',
            }}
          >
            {/* Header */}
            <div className="text-center mb-4">
              {tier.name === 'Advocacy Toolkit' && (
                <span
                  className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-2 text-white"
                  style={{ backgroundColor: tier.color }}
                >
                  Most Popular
                </span>
              )}
              <h4 className="text-lg font-bold" style={{ color: '#2a3a2a' }}>{tier.name}</h4>
              <div className="text-2xl font-bold mt-1" style={{ color: tier.color }}>{tier.price}</div>
              <p className="text-xs mt-0.5" style={{ color: '#8a9a8a' }}>{tier.subtitle}</p>
            </div>

            {/* Features */}
            <ul className="space-y-2 flex-1 mb-4">
              {tier.features.map((f) => (
                <li key={f.name} className="flex items-start gap-2 text-xs">
                  {f.included ? (
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }}>&#x2713;</span>
                  ) : (
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#d1d5db' }}>&mdash;</span>
                  )}
                  <span style={{ color: f.included ? '#2a3a2a' : '#b0a8a0' }}>{f.name}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            {tier.name === 'Free' && (
              <div className="text-center text-xs font-semibold py-2" style={{ color: '#8a9a8a' }}>
                Current plan
              </div>
            )}
            {tier.name === 'Advocacy Toolkit' && (
              <button
                onClick={onUpgrade}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:shadow-lg"
                style={{ backgroundColor: '#e07850' }}
              >
                Unlock for $49
              </button>
            )}
            {tier.name === 'Custom Analysis' && (
              <a
                href="/enterprise"
                className="block w-full py-3 rounded-xl font-bold text-sm text-center transition-all hover:shadow-md border-2"
                style={{ borderColor: '#1E40AF', color: '#1E40AF', backgroundColor: 'white' }}
              >
                Learn More &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
