export default function AdminDashboard() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>Dashboard</h1>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm text-center max-w-md mx-auto mt-12">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-bold mb-2 text-gray-800">Analytics via PostHog</h2>
        <p className="text-sm text-gray-500 mb-6">
          Page views, user sessions, funnels, and all custom events are tracked in PostHog.
        </p>
        <a
          href="https://us.posthog.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#e07850' }}
        >
          Open PostHog ↗
        </a>
        <div className="mt-6 text-xs text-gray-400 space-y-1">
          <div>Events tracked: <span className="font-mono">analysis_complete</span>, <span className="font-mono">share_click</span>, <span className="font-mono">payment_success</span></div>
          <div>Session recordings and funnels available in PostHog</div>
        </div>
      </div>
    </div>
  );
}
