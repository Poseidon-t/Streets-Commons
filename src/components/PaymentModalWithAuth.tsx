/**
 * Payment Modal with Clerk Authentication
 * Industry-standard flow: Sign in → Pay → Premium unlocked
 */

import { useState } from 'react';
import { useUser, useSignIn, SignIn } from '@clerk/clerk-react';
import { COLORS } from '../constants';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

type PricingTier = 'advocate' | 'professional';

export default function PaymentModalWithAuth({ isOpen, onClose, locationName }: PaymentModalProps) {
  const { isSignedIn, user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<PricingTier>('advocate');
  const [showSignIn, setShowSignIn] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setCompanyLogo(file);
    }
  };

  const handlePayment = async () => {
    // Check if user is signed in
    if (!isSignedIn || !user) {
      setShowSignIn(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';

      // Create Stripe checkout session via backend
      const response = await fetch(`${apiUrl}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          tier: selectedTier,
          locationName,
          userId: user.id, // Clerk user ID for webhook
          metadata: {
            companyName: selectedTier === 'professional' ? companyName : undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { url } = await response.json();

      // Store logo in localStorage for professional tier (will be used after activation)
      if (selectedTier === 'professional' && companyLogo) {
        const reader = new FileReader();
        reader.onload = () => {
          localStorage.setItem('pending_logo', reader.result as string);
          localStorage.setItem('pending_company_name', companyName);
          window.location.href = url;
        };
        reader.readAsDataURL(companyLogo);
        return;
      }

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
              Sign in to purchase {selectedTier === 'advocate' ? 'Advocate' : 'Professional'} tier for {locationName}
            </p>
            <SignIn
              routing="virtual"
              signUpUrl="/sign-up"
              afterSignInUrl={window.location.href}
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
      <div className="bg-white rounded-2xl max-w-5xl w-full p-8 relative my-8">
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
            Unlock Premium Tools
          </h2>
          <p className="text-gray-600">
            Professional features for {locationName}
          </p>
          {isSignedIn && user && (
            <p className="text-sm text-gray-500 mt-2">
              Signed in as {user.primaryEmailAddress?.emailAddress}
            </p>
          )}
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Advocate Tier */}
          <div
            onClick={() => setSelectedTier('advocate')}
            className={`relative border-2 rounded-2xl p-6 cursor-pointer transition-all ${
              selectedTier === 'advocate'
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {selectedTier === 'advocate' && (
              <div className="absolute top-4 right-4 text-blue-500">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">🏘️ Advocate</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">$19</div>
              <div className="text-sm text-gray-500">One-time • No subscription</div>
            </div>

            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Streetmix Integration</strong> - Design better streets</span>
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

          {/* Professional Tier */}
          <div
            onClick={() => setSelectedTier('professional')}
            className={`relative border-2 rounded-2xl p-6 cursor-pointer transition-all ${
              selectedTier === 'professional'
                ? 'border-purple-500 shadow-lg'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {selectedTier === 'professional' && (
              <div className="absolute top-4 right-4 text-purple-500">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <span className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE
              </span>
            </div>

            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">🏢 Professional</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">$79</div>
              <div className="text-sm text-gray-500">One-time • No subscription</div>
            </div>

            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>Everything in Advocate</strong> +</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>15-Minute City Score</strong> - Essential services analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>Building Density 3D</strong> - FAR calculation & visualization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>Transit Access Analysis</strong> - Car-free feasibility</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>ADA Accessibility Report</strong> - Wheelchair compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>Street Lighting Safety</strong> - Nighttime analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span><strong>Custom Branding</strong> - Add your logo & company name</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Custom Branding Section (Professional only) */}
        {selectedTier === 'professional' && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🎨</span>
              Custom Branding (Optional)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Organization Name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Will appear on PDF reports as "Prepared by: [Your Name]"
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                {companyLogo && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Logo uploaded: {companyLogo.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Will appear at the top of PDF reports
                </p>
              </div>
            </div>
          </div>
        )}

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
          style={{ backgroundColor: selectedTier === 'advocate' ? COLORS.accent : '#9333ea' }}
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
            `Sign In & Pay - ${selectedTier === 'advocate' ? '$19' : '$79'}`
          ) : (
            `Complete Purchase - ${selectedTier === 'advocate' ? '$19' : '$79'}`
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
