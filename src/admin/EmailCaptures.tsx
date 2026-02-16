import { useState, useEffect } from 'react';
import { fetchEmails } from './adminApi';

interface EmailEntry {
  email: string;
  source: string;
  locationAnalyzed: string | null;
  utm: { utm_source?: string } | null;
  capturedAt: string;
  analysisCount?: number;
}

export default function EmailCaptures() {
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEmails();
        setEmails(data.emails || []);
        setTotal(data.count || 0);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    return local.slice(0, 2) + '***@' + domain;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
          Email Captures
        </h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {loading && <div className="text-gray-500">Loading emails...</div>}
      {error && <div className="text-red-500 mb-4">Error: {error}</div>}

      {!loading && emails.length === 0 && (
        <div className="text-center py-12 text-gray-400">No emails captured yet.</div>
      )}

      {emails.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">UTM Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {[...emails].reverse().map((entry, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">
                    {maskEmail(entry.email)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.source || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">
                    {entry.locationAnalyzed ? entry.locationAnalyzed.split(',')[0] : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.utm?.utm_source || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {entry.capturedAt
                      ? new Date(entry.capturedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
