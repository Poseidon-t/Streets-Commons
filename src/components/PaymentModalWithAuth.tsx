/**
 * Upgrade Modal — handles sign-in + payment flow
 * State 1: Not signed in → Clerk SignIn
 * State 2: Signed in, free tier → Tier comparison + Stripe checkout
 * State 3: Signed in, advocate tier → Auto-close
 */

import { useState, useEffect } from 'react';
import { useUser, SignIn } from '@clerk/clerk-react';
import { getAccessInfoFromUser } from '../utils/clerkAccess';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

const FEATURES = [
  { name: 'Walkability Analysis (8 metrics)', free: true, paid: true },
  { name: 'Equity Insights + Local Economy', free: true, paid: true },
  { name: '15-Minute City Analysis', free: true, paid: true },
  { name: 'Street Cross-Section (current)', free: true, paid: true },
  { name: 'Compare Mode', free: true, paid: true },
  { name: 'AI Chatbot', free: '6 msgs', paid: 'Unlimited' },
  { name: 'Street Audit Tool', free: false, paid: true },
  { name: 'AI Advocacy Documents', free: false, paid: true },
  { name: 'Street Redesign Mockup', free: false, paid: true },
  { name: 'PDF / JSON Export', free: false, paid: true },
  { name: 'Save Up To 10 Addresses', free: false, paid: true },
];

export default function PaymentModalWithAuth({ isOpen, onClose, locationName }: UpgradeModalProps) {
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessInfo = getAccessInfoFromUser(user);

  // State 3: Already paid — auto-close via effect (not during render)
  useEffect(() => {
    if (isOpen && isSignedIn && accessInfo.tier === 'advocate') {
      onClose();
    }
  }, [isOpen, isSignedIn, accessInfo.tier, onClose]);

  if (!isOpen) return null;
  if (isSignedIn && accessInfo.tier === 'advocate') return null;

  const handleCheckout = async () => {
    if (!user) return;
    if (!user.primaryEmailAddress?.emailAddress) {
      setError('Please verify your email address before upgrading.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          tier: 'advocate',
          locationName,
          userId: user.id,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start checkout.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* State 1: Not signed in — show Clerk SignIn */}
        {!isSignedIn && (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">&#x1F513;</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#2a3a2a' }}>
                Sign In to Continue
              </h2>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Sign in first, then unlock the Advocacy Toolkit for a one-time $19 payment.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <SignIn
                routing="virtual"
                forceRedirectUrl={window.location.href}
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none',
                  },
                }}
              />
            </div>
          </>
        )}

        {/* State 2: Signed in, free tier — show tier comparison + checkout */}
        {isSignedIn && accessInfo.tier === 'free' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#2a3a2a' }}>
                Unlock Advocacy Toolkit
              </h2>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                One-time payment. Permanent access. No subscription.
              </p>
            </div>

            {/* Tier Comparison */}
            <div className="border rounded-xl overflow-hidden mb-6" style={{ borderColor: '#e0dbd0' }}>
              {/* Header row */}
              <div className="grid grid-cols-3 text-center text-xs font-bold py-3 border-b" style={{ borderColor: '#e0dbd0', backgroundColor: '#f8f6f1' }}>
                <div style={{ color: '#8a9a8a' }}>Feature</div>
                <div style={{ color: '#8a9a8a' }}>Free</div>
                <div style={{ color: '#e07850' }}>Toolkit $19</div>
              </div>

              {/* Feature rows */}
              {FEATURES.map((f, i) => (
                <div
                  key={f.name}
                  className="grid grid-cols-3 text-center items-center py-2 px-2 text-xs border-b last:border-0"
                  style={{ borderColor: '#f0ebe0', backgroundColor: i % 2 === 0 ? 'white' : '#faf9f7' }}
                >
                  <div className="text-left font-medium" style={{ color: '#2a3a2a' }}>{f.name}</div>
                  <div>
                    {f.free === true ? (
                      <span style={{ color: '#22c55e' }}>&#x2713;</span>
                    ) : f.free === false ? (
                      <span style={{ color: '#d1d5db' }}>&mdash;</span>
                    ) : (
                      <span style={{ color: '#8a9a8a' }}>{f.free}</span>
                    )}
                  </div>
                  <div>
                    {f.paid === true ? (
                      <span className="font-bold" style={{ color: '#22c55e' }}>&#x2713;</span>
                    ) : (
                      <span className="font-semibold" style={{ color: '#e07850' }}>{f.paid}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm text-center">
                {error}
              </div>
            )}

            {/* Checkout CTA */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:shadow-lg disabled:opacity-60"
              style={{ backgroundColor: '#e07850' }}
            >
              {loading ? 'Redirecting to checkout...' : 'Unlock for $19'}
            </button>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs" style={{ color: '#8a9a8a' }}>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure payment via Stripe
              </span>
              <span>One-time, no subscription</span>
            </div>

            <p className="text-center text-xs mt-3" style={{ color: '#b0a8a0' }}>
              Signed in as {user?.primaryEmailAddress?.emailAddress}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
