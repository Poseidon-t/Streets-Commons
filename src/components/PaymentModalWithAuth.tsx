/**
 * Sign-In Modal — wraps Clerk SignIn in a modal dialog.
 * Used by the "Sign In" button in the header.
 */

import { useEffect } from 'react';
import { useUser, SignIn } from '@clerk/clerk-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

export default function PaymentModalWithAuth({ isOpen, onClose }: UpgradeModalProps) {
  const { isSignedIn } = useUser();

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Already signed in — auto-close
  useEffect(() => {
    if (isOpen && isSignedIn) {
      onClose();
    }
  }, [isOpen, isSignedIn, onClose]);

  if (!isOpen) return null;
  if (isSignedIn) return null;

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

        <div className="text-center mb-6">
          <div className="text-5xl mb-4">&#x1F513;</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#2a3a2a' }}>
            Sign In to SafeStreets
          </h2>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Sign in to save addresses, access your Pro account, and more.
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
      </div>
    </div>
  );
}
