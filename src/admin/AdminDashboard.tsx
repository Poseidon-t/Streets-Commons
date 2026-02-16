import { useState, useEffect } from 'react';
import { fetchStats } from './adminApi';

interface DayStats {
  pageViews?: number;
  uniqueVisitors?: number;
  analyses?: number;
  chatMessages?: number;
  pdfUploads?: number;
  advocacyLetters?: number;
  payments?: number;
  shareClicks?: number;
  emailsCaptured?: number;
  topCountries?: Record<string, number>;
  topReferrers?: Record<string, number>;
  utmSources?: Record<string, number>;
  utmMediums?: Record<string, number>;
  utmCampaigns?: Record<string, number>;
  sharePlatforms?: Record<string, number>;
}

interface AnalyticsData {
  daily: Record<string, DayStats>;
  allTime: { pageViews: number; analyses: number; firstSeen: string | null };
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  );
}

function StatNumber({ value, label, size = 'lg' }: { value: number | string; label: string; size?: 'lg' | 'sm' }) {
  return (
    <div>
      <div className={`font-bold ${size === 'lg' ? 'text-3xl' : 'text-xl'}`} style={{ color: '#1e3a5f' }}>
        {value}
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ListTable({ data, emptyText = 'No data yet' }: { data: [string, number][]; emptyText?: string }) {
  if (!data.length) return <div className="text-sm text-gray-400">{emptyText}</div>;
  return (
    <div className="space-y-0">
      {data.map(([key, val]) => (
        <div key={key} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
          <span className="text-gray-700 truncate mr-2">{key}</span>
          <span className="font-medium text-gray-900 flex-shrink-0">{val}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const stats = await fetchStats();
        setData(stats);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading analytics...</div>;
  }
  if (error || !data) {
    return <div className="text-red-500">Failed to load analytics: {error}</div>;
  }

  const today = data.daily[getToday()] || {};
  const allTime = data.allTime;

  // Last 7 days chart data
  const last7Days: { date: string; views: number; analyses: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const day = data.daily[key] || {};
    last7Days.push({ date: key.slice(5), views: day.pageViews || 0, analyses: day.analyses || 0 });
  }
  const maxViews = Math.max(...last7Days.map((d) => d.views), 1);

  // Sort helper
  const sortedEntries = (obj: Record<string, number> | undefined, limit = 8): [string, number][] =>
    Object.entries(obj || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>Dashboard</h1>
        <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
      </div>

      {/* Top row — key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Today">
          <StatNumber value={today.uniqueVisitors || 0} label="unique visitors" />
          <div className="mt-3">
            <StatNumber value={today.pageViews || 0} label="page views" size="sm" />
          </div>
        </StatCard>
        <StatCard title="Analyses Today">
          <StatNumber value={today.analyses || 0} label="walkability analyses" />
          <div className="mt-3">
            <StatNumber value={today.chatMessages || 0} label="AI chat messages" size="sm" />
          </div>
        </StatCard>
        <StatCard title="All Time">
          <StatNumber value={allTime.pageViews || 0} label="total page views" />
          <div className="mt-3">
            <StatNumber value={allTime.analyses || 0} label="total analyses" size="sm" />
          </div>
        </StatCard>
        <StatCard title="Engagement Today">
          <div className="space-y-0">
            {[
              ['Share clicks', today.shareClicks || 0],
              ['Emails captured', today.emailsCaptured || 0],
              ['PDF uploads', today.pdfUploads || 0],
              ['Advocacy letters', today.advocacyLetters || 0],
              ['Payments', today.payments || 0],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium">{val}</span>
              </div>
            ))}
          </div>
        </StatCard>
      </div>

      {/* 7-day chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Last 7 Days (Page Views)</h2>
        <div className="flex items-end gap-2" style={{ height: 100 }}>
          {last7Days.map((d) => (
            <div key={d.date} className="flex-1 text-center">
              <div className="relative rounded-t" style={{ height: 100, backgroundColor: '#e8f4f8' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t"
                  style={{ height: `${(d.views / maxViews) * 100}%`, backgroundColor: '#1e3a5f' }}
                />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Traffic breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Top Referrers (Today)">
          <ListTable data={sortedEntries(today.topReferrers, 5)} />
        </StatCard>
        <StatCard title="Top Countries (Today)">
          <ListTable data={sortedEntries(today.topCountries, 5)} />
        </StatCard>
        <StatCard title="Share Platforms">
          <ListTable data={sortedEntries(today.sharePlatforms)} />
        </StatCard>
      </div>

      {/* UTM data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="UTM Sources (Today)">
          <ListTable data={sortedEntries(today.utmSources)} emptyText="No UTM data yet" />
        </StatCard>
        <StatCard title="Campaigns (Today)">
          <ListTable data={sortedEntries(today.utmCampaigns)} emptyText="No campaign data yet" />
        </StatCard>
      </div>

      <div className="mt-6 text-center text-xs text-gray-400">
        Since {allTime.firstSeen || 'today'}
      </div>
    </div>
  );
}
