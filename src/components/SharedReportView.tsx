/**
 * Shared Report View — Loads a persisted report by ID from /r/:reportId.
 * Shows optional lead capture before revealing full report.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AgentReportView from './AgentReportView';
import ComparisonReportView from './ComparisonReportView';

const API_URL = import.meta.env.VITE_API_URL || '';

const C = {
  text: '#2a3a2a',
  textMuted: '#4a5a4a',
  textLight: '#8a9a8a',
  border: '#e0dbd0',
  bgWarm: '#faf8f4',
  accent: '#1e3a5f',
};

export default function SharedReportView() {
  const { reportId } = useParams<{ reportId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reportType, setReportType] = useState<'single' | 'comparison'>('single');
  const [showLeadCapture, setShowLeadCapture] = useState(true);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadName, setLeadName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reportId) return;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports/${reportId}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'This report link has expired or is invalid.' : 'Failed to load report.');
          return;
        }
        const data = await res.json();
        const rd = data.reportData;
        if (rd?.type === 'comparison') {
          sessionStorage.setItem('agentComparisonData', JSON.stringify(rd));
          setReportType('comparison');
        } else {
          sessionStorage.setItem('agentReportData', JSON.stringify(rd));
          setReportType('single');
        }
        setLoaded(true);
      } catch {
        setError('Unable to load report. Please check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, [reportId]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim()) return;

    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/reports/${reportId}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leadEmail.trim(), name: leadName.trim() || null }),
      });
    } catch {
      // Non-critical — don't block report access
    }
    setShowLeadCapture(false);
    setSubmitting(false);
  };

  const handleSkip = () => {
    setShowLeadCapture(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${C.bgWarm} 0%, #eef5f0 100%)` }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading report...</div>
          <div style={{ width: '48px', height: '48px', border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${C.bgWarm} 0%, #eef5f0 100%)` }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: C.text }}>Report Not Found</h1>
          <p style={{ marginBottom: '1.5rem', color: C.textMuted }}>{error}</p>
          <a href="/" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 600, color: 'white', backgroundColor: C.accent, textDecoration: 'none' }}>
            Go to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  if (loaded && showLeadCapture) {
    // Parse the report data to show a preview
    const isComparison = reportType === 'comparison';
    const comparisonData = isComparison ? JSON.parse(sessionStorage.getItem('agentComparisonData') || '{}') : null;
    const reportData = isComparison ? {} : JSON.parse(sessionStorage.getItem('agentReportData') || '{}');
    const agent = isComparison ? (comparisonData?.agentProfile || {}) : (reportData.agentProfile || {});
    const location = reportData.location || {};
    const score = reportData.metrics?.overallScore || 0;

    // For comparison: build title from neighborhood names
    const comparisonTitle = isComparison
      ? (comparisonData?.neighborhoods || [])
          .filter((n: { status: string }) => n.status === 'success')
          .map((n: { reportData: { location?: { neighborhood?: string } } }) => n.reportData?.location?.neighborhood || 'Unknown')
          .join(' vs. ')
      : '';
    const comparisonCount = isComparison ? (comparisonData?.neighborhoods?.length || 0) : 0;

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${C.bgWarm} 0%, #eef5f0 100%)`, padding: '1.5rem' }}>
        <div style={{ maxWidth: '28rem', width: '100%', background: 'white', borderRadius: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {/* Preview header */}
          <div style={{ background: `linear-gradient(135deg, ${C.accent}, #2a4a6f)`, padding: '2rem', color: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.8, marginBottom: '0.5rem' }}>
              {isComparison ? 'Neighborhood Comparison' : 'Walkability Report'}
            </p>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '1rem' }}>
              {isComparison ? comparisonTitle : (location.displayName || 'Neighborhood Report')}
            </h1>
            {isComparison ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', borderRadius: '1rem', padding: '0.5rem 1.25rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{comparisonCount} Neighborhoods</span>
                <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>compared</span>
              </div>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem', background: 'rgba(255,255,255,0.15)', borderRadius: '1rem', padding: '0.5rem 1.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700 }}>{score.toFixed(1)}</span>
                <span style={{ fontSize: '1rem', opacity: 0.7 }}>/10</span>
              </div>
            )}
            {agent.name && (
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.8 }}>
                Prepared by {agent.name}{agent.company ? ` at ${agent.company}` : ''}
              </p>
            )}
          </div>

          {/* Lead capture form */}
          <div style={{ padding: '2rem' }}>
            <p style={{ fontSize: '0.9375rem', color: C.text, fontWeight: 600, marginBottom: '0.5rem', textAlign: 'center' }}>
              Enter your email to view the full report
            </p>
            <p style={{ fontSize: '0.8125rem', color: C.textMuted, marginBottom: '1.5rem', textAlign: 'center' }}>
              {isComparison
                ? 'Includes side-by-side walkability metrics, safety data, and value premium estimates.'
                : 'Includes detailed walkability metrics, safety data, and neighborhood intelligence.'}
            </p>

            <form onSubmit={handleLeadSubmit}>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={leadName}
                onChange={e => setLeadName(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: `1px solid ${C.border}`, borderRadius: '0.5rem', fontSize: '0.9375rem', marginBottom: '0.75rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <input
                type="email"
                placeholder="Email address"
                value={leadEmail}
                onChange={e => setLeadEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', border: `1px solid ${C.border}`, borderRadius: '0.5rem', fontSize: '0.9375rem', marginBottom: '1rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <button
                type="submit"
                disabled={submitting || !leadEmail.trim()}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: C.accent,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting || !leadEmail.trim() ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? 'Loading...' : 'View Full Report'}
              </button>
            </form>

            <button
              onClick={handleSkip}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', background: 'none', border: 'none', color: C.textLight, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Skip for now
            </button>
          </div>

          {/* Powered by */}
          <div style={{ padding: '0 2rem 1.5rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.6875rem', color: C.textLight }}>
              Powered by SafeStreets
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (loaded && !showLeadCapture) {
    return reportType === 'comparison' ? <ComparisonReportView /> : <AgentReportView />;
  }

  return null;
}
