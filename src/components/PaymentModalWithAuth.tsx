/**
 * Payment Modal with Clerk Authentication
 * Industry-standard flow: Sign in → Pay → Premium unlocked
 */

import { useState } from 'react';
import { useUser, SignIn } from '@clerk/clerk-react';
import { COLORS } from '../constants';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

export default function PaymentModalWithAuth({ isOpen, onClose, locationName }: PaymentModalProps) {
  const { isSignedIn, user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  if (!isOpen) return null;

  const handlePayment = async () => {
    // Check if user is signed in
    if (!isSignedIn || !user) {
      setShowSignIn(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';

      // Create Stripe checkout session via backend
      const response = await fetch(`${apiUrl}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          tier: 'advocate',
          locationName,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { url } = await response.json();

      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Unable to create checkout session. Please try again.');
      setIsLoading(false);
    }
  };

  // Show sign-in modal if user needs to authenticate
  if (showSignIn && !isSignedIn) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
          {/* Close Button */}
          <button
            onClick={() => {
              setShowSignIn(false);
              onClose();
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Clerk Sign-In Component */}
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Sign In to Continue</h2>
            <p className="text-gray-600 text-center mb-6">
              Sign in to purchase Advocate tier for {locationName}
            </p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-8 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔓</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Unlock Advocate Tools
          </h2>
          <p className="text-gray-600">
            Premium features for {locationName}
          </p>
          {isSignedIn && user && (
            <p className="text-sm text-gray-500 mt-2">
              Signed in as {user.primaryEmailAddress?.emailAddress}
            </p>
          )}
        </div>

        {/* Advocate Tier */}
        <div className="border-2 border-blue-500 rounded-2xl p-6 mb-8 shadow-lg">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 mb-2">🏘️ Advocate</h3>
            <div className="text-4xl font-bold text-gray-800 mb-1">$19</div>
            <div className="text-sm text-gray-500">One-time · No subscription</div>
          </div>

          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Street Redesign</strong> - Data-driven cross-section recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>3DStreet Visualization</strong> - 3D street redesigns</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Policy Report PDF</strong> - All metrics & compliance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Budget Analysis</strong> - AI-powered insights</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>International Standards</strong> - WHO, ADA</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Advocacy Proposal</strong> - One-page PDF for officials</span>
            </li>
          </ul>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Payment Button */}
        <button
          onClick={handlePayment}
          disabled={isLoading}
          className="w-full px-6 py-4 rounded-xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: COLORS.accent }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : !isSignedIn ? (
            'Sign In & Pay - $19'
          ) : (
            'Complete Purchase - $19'
          )}
        </button>

        {/* Security Notice */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>🔒 Secure payment powered by Stripe</p>
          <p className="mt-1">Your payment information is encrypted and secure</p>
        </div>
      </div>
    </div>
  );
}
