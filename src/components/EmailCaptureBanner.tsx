import { useState } from 'react';
import { getUTMParams } from '../utils/utm';

interface EmailCaptureBannerProps {
  locationName: string;
  score: string;
  lat: number;
  lon: number;
  userEmail?: string | null;
}

const DISMISSED_KEY = 'safestreets_email_banner_dismissed';
const CAPTURED_KEY = 'safestreets_email_captured';

export default function EmailCaptureBanner({
  locationName, score, lat, lon, userEmail,
}: EmailCaptureBannerProps) {
  const [email, setEmail] = useState(userEmail || '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(DISMISSED_KEY) || !!localStorage.getItem(CAPTURED_KEY); } catch { return false; }
  });
  const [error, setError] = useState<string | null>(null);

  if (dismissed && !submitted) return null;

  if (submitted) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl border"
        style={{ borderColor: '#c6e7c0', backgroundColor: '#f0faf0' }}
      >
        <span style={{ color: '#2a6a2a' }} className="text-sm">
          &#x2714; Report link sent! Check your inbox.
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
          source: 'report_banner',
          locationAnalyzed: locationName,
          lat, lon, score,
          utm: Object.keys(utm).length > 0 ? utm : undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        try { localStorage.setItem(CAPTURED_KEY, email); } catch {}
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
      className="flex flex-col sm:flex-row items-center gap-3 px-5 py-4 rounded-xl border"
      style={{ borderColor: '#d0e0d8', backgroundColor: '#f5faf7' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-lg flex-shrink-0">&#x1F4E7;</span>
        <div className="text-sm" style={{ color: '#2a3a2a' }}>
          <strong>Email me this report</strong>
          <span style={{ color: '#5a6a5a' }}> — get a link to your {locationName.split(',')[0]} walkability results</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-shrink-0">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          placeholder="you@example.com"
          className="px-3 py-2 rounded-lg border text-sm w-48"
          style={{ borderColor: '#e0dbd0' }}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg font-semibold text-xs text-white transition-all hover:shadow-md whitespace-nowrap disabled:opacity-60"
          style={{ backgroundColor: '#5090b0' }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 text-sm ml-1"
          aria-label="Dismiss"
        >&times;</button>
      </form>

      {error && (
        <div className="w-full text-xs text-red-600 mt-1 text-center sm:text-left">{error}</div>
      )}
    </div>
  );
}
