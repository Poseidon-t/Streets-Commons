/**
 * Sign-In Modal
 * All features are free — users just need to sign in to unlock premium tools.
 */

import { useUser, SignIn } from '@clerk/clerk-react';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

export default function PaymentModalWithAuth({ isOpen, onClose, locationName }: SignInModalProps) {
  const { isSignedIn } = useUser();

  if (!isOpen) return null;

  // If already signed in, close modal — they already have access
  if (isSignedIn) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">&#x1F513;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Sign In to Unlock All Features
          </h2>
          <p className="text-gray-600 text-sm">
            All SafeStreets features are <strong>100% free</strong>. Just sign in to access premium advocacy tools.
          </p>
        </div>

        {/* Feature list */}
        <div className="border border-gray-200 rounded-xl p-4 mb-6">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">&#x2713;</span>
              <span><strong>Street Redesign</strong> - Data-driven cross-section recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">&#x2713;</span>
              <span><strong>3DStreet Visualization</strong> - 3D street redesigns</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">&#x2713;</span>
              <span><strong>Policy Report PDF</strong> - All metrics & compliance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">&#x2713;</span>
              <span><strong>Budget Analysis</strong> - AI-powered insights</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">&#x2713;</span>
              <span><strong>Unlimited Chat</strong> - No message limits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">&#x2713;</span>
              <span><strong>Advocacy Proposal</strong> - One-page PDF for officials</span>
            </li>
          </ul>
        </div>

        {/* Clerk Sign-In */}
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

        <p className="text-center text-xs text-gray-400 mt-4">
          No payment required. Sign in with Google to get started.
        </p>
      </div>
    </div>
  );
}
