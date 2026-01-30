/**
 * Activation Handler - Processes magic link tokens from URL
 * Automatically activates premium access when user clicks email link
 */

import { useEffect, useState } from 'react';
import { verifyTokenWithBackend, storeAccessToken } from '../utils/premiumAccess';

export default function ActivationHandler() {
  const [status, setStatus] = useState<'checking' | 'success' | 'error' | 'none'>('none');
  const [message, setMessage] = useState('');
  const [tier, setTier] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      // No token in URL, nothing to do
      setStatus('none');
      return;
    }

    // Token found in URL, verify it
    setStatus('checking');
    verifyAndActivate(token);
  }, []);

  const verifyAndActivate = async (token: string) => {
    try {
      console.log('Verifying access token...');
      const result = await verifyTokenWithBackend(token);

      if (result.valid && result.tier && result.email) {
        // Store access in localStorage
        storeAccessToken(token, result.tier, result.email);

        setStatus('success');
        setTier(result.tier);
        setMessage(`Premium access activated! You now have ${result.tier} tier features.`);

        // Remove token from URL (clean up)
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());

        // Reload page after 2 seconds to apply premium features
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Invalid or expired activation link');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to activate access');
    }
  };

  if (status === 'none') return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
        {status === 'checking' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Activating Your Access...
            </h3>
            <p className="text-gray-600">
              Please wait while we verify your purchase.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Access Activated!
            </h3>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-green-800 capitalize">
                {tier} Tier Features Unlocked
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Reloading page to apply premium features...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Activation Failed
            </h3>
            <p className="text-red-600 mb-4">{message}</p>
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                window.location.href = url.toString();
              }}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
