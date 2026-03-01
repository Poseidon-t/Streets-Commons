import { useState } from 'react';
import { getUTMParams } from '../utils/utm';

interface EmailCaptureBannerProps {
  userEmail?: string | null;
}

const DISMISSED_KEY = 'safestreets_newsletter_dismissed';
const SUBSCRIBED_KEY = 'safestreets_newsletter_subscribed';

export default function EmailCaptureBanner({ userEmail }: EmailCaptureBannerProps) {
  const [email, setEmail] = useState(userEmail || '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(DISMISSED_KEY) || !!localStorage.getItem(SUBSCRIBED_KEY); } catch { return false; }
  });
  const [error, setError] = useState<string | null>(null);

  if (dismissed && !submitted) return null;

  if (submitted) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl"
        style={{ backgroundColor: '#f0faf0', border: '1px solid #c8e0c8' }}
      >
        <span style={{ color: '#4a8a4a' }} className="text-sm font-medium">
          &#x2714; You're in! We'll share new data layers and city insights.
        </span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const utm = getUTMParams();
      const res = await fetch(`${apiUrl}/api/capture-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'newsletter',
          utm: Object.keys(utm).length > 0 ? utm : undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        try { localStorage.setItem(SUBSCRIBED_KEY, email); } catch {}
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="rounded-2xl px-6 py-5 relative overflow-hidden"
      style={{ backgroundColor: '#f8f6f1', border: '1px solid #e0dbd0' }}
    >
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="text-sm font-bold mb-1" style={{ color: '#2a3a2a' }}>
            Stay in the loop
          </p>
          <p className="text-xs" style={{ color: '#8a9a8a' }}>
            New data layers, city insights, and walkability research. No spam.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-shrink-0">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="you@example.com"
            className="px-3 py-2.5 rounded-xl text-sm w-48"
            style={{ border: '1px solid #e0dbd0', backgroundColor: 'white' }}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:shadow-md whitespace-nowrap disabled:opacity-60"
            style={{ backgroundColor: '#e07850' }}
          >
            {loading ? '...' : 'Subscribe'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm ml-1 transition-colors"
            style={{ color: '#c0b8a8' }}
            aria-label="Dismiss"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#8a9a8a')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#c0b8a8')}
          >&times;</button>
        </form>
      </div>

      {error && (
        <div className="text-xs mt-2 text-center sm:text-left" style={{ color: '#c03030' }}>{error}</div>
      )}
    </div>
  );
}
