/**
 * Pro Upgrade Modal — handles sign-in + pro subscription flow for agent reports.
 * State 1: Not signed in → Clerk SignIn
 * State 2: Signed in, trial available (< 3 reports) → "Generate Free Report" + subscribe link
 * State 3: Signed in, trial expired, not pro → Feature list + "$49 one-time" purchase button
 * State 4: Signed in, pro → auto-close (handled via onReady callback)
 */

import { useState, useEffect } from 'react';
import { useUser, SignIn } from '@clerk/clerk-react';
import { getAccessInfoFromUser, getProTrialReportsUsed, canGenerateAgentReport } from '../utils/clerkAccess';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReady: () => void; // Called when user can generate a report (pro or trial available)
  context?: 'agent' | 'feature'; // 'agent' = report generation flow, 'feature' = general pro unlock
}

const PRO_FEATURES = [
  { icon: '📋', name: 'Street Audit Tool', desc: 'Generate structured audit reports to share with landlords, property managers, or local authorities' },
  { icon: '📄', name: 'Shareable walkability report', desc: 'Export as PDF or link — send to a partner, landlord, council, or attach to a listing' },
  { icon: '🏷️', name: 'Your branding on reports', desc: 'Add your logo and contact details for professional use' },
];

export default function ProUpgradeModal({ isOpen, onClose, onReady, context = 'agent' }: ProUpgradeModalProps) {
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessInfo = getAccessInfoFromUser(user);
  const isPro = accessInfo.tier === 'pro';
  const trialUsed = getProTrialReportsUsed(user);
  const canGenerate = canGenerateAgentReport(user);
  const trialsRemaining = Math.max(0, 3 - trialUsed);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Auto-close if user is already pro
  useEffect(() => {
    if (isOpen && isSignedIn && isPro) {
      onReady();
    }
  }, [isOpen, isSignedIn, isPro, onReady]);

  if (!isOpen) return null;
  if (isSignedIn && isPro) return null;

  const handleSubscribe = async () => {
    if (!user) return;
    if (!user.primaryEmailAddress?.emailAddress) {
      setError('Please verify your email address before subscribing.');
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
          email: user.primaryEmailAddress.emailAddress,
          tier: 'pro',
          userId: user.id,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to start checkout. Please try again.');
        return;
      }
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to start checkout. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 relative my-8 border border-[#e0dbd0]">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8a9a8a] hover:text-[#2a3a2a] transition"
        >
          &times;
        </button>

        {/* State 1: Not signed in */}
        {!isSignedIn && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{context === 'feature' ? '🔓' : '📊'}</div>
              <h2 className="text-xl font-bold mb-1 text-[#2a3a2a]">
                {context === 'feature' ? 'Unlock Pro Features' : 'Agent Reports'}
              </h2>
              <p className="text-sm text-[#8a9a8a]">
                {context === 'feature'
                  ? 'Sign in to access detailed walkability analysis and persona verdicts.'
                  : 'Sign in to generate branded walkability reports for your listings.'}
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

        {/* State 2: Signed in, trial available — agent flow only */}
        {isSignedIn && canGenerate && !isPro && context !== 'feature' && (
          <>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">📊</div>
              <h2 className="text-xl font-bold mb-1 text-[#2a3a2a]">Generate Agent Report</h2>
              <p className="text-sm text-[#8a9a8a]">
                You have <strong className="text-[#e07850]">{trialsRemaining} free report{trialsRemaining !== 1 ? 's' : ''}</strong> remaining.
              </p>
            </div>

            <button
              onClick={onReady}
              className="w-full py-3 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 mb-3"
              style={{ backgroundColor: '#e07850' }}
            >
              Generate Free Report
            </button>

            <div className="text-center">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="text-sm font-medium text-[#e07850] hover:underline disabled:opacity-50"
              >
                {loading ? 'Redirecting...' : 'Or get unlimited — $49 one-time'}
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm text-center">{error}</div>
            )}

            <p className="text-center text-xs mt-4 text-[#b0a8a0]">
              Signed in as {user?.primaryEmailAddress?.emailAddress}
            </p>
          </>
        )}

        {/* State 3: Signed in, trial expired (or feature context), not pro */}
        {isSignedIn && (!canGenerate || context === 'feature') && !isPro && (
          <>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">📊</div>
              <h2 className="text-xl font-bold mb-1 text-[#2a3a2a]">Audit streets. Share your findings.</h2>
              <p className="text-sm text-[#8a9a8a]">
                One payment, lifetime access. Generate audit reports and export shareable walkability analysis.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-3 mb-5">
              {PRO_FEATURES.map(f => (
                <div key={f.name} className="flex items-start gap-3 p-3 rounded-lg bg-[#faf8f4] border border-[#f0ebe0]">
                  <span className="text-lg flex-shrink-0">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-[#2a3a2a]">{f.name}</div>
                    <div className="text-xs text-[#8a9a8a]">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm text-center">{error}</div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#e07850' }}
            >
              {loading ? 'Redirecting to checkout...' : 'Get Pro — $49 One-Time'}
            </button>

            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-[#8a9a8a]">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure payment via Stripe
              </span>
              <span>One-time payment</span>
            </div>

            <p className="text-center text-xs mt-3 text-[#b0a8a0]">
              Signed in as {user?.primaryEmailAddress?.emailAddress}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
