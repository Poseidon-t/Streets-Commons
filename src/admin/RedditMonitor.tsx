import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminApi } from './adminApi';

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  numComments: number;
  author: string;
  created: number;
  matchedKeywords: string[];
  status: 'new' | 'dismissed' | 'engaged';
}

interface RedditFeed {
  lastUpdated: string | null;
  posts: RedditPost[];
}

const SUBREDDIT_COLORS: Record<string, string> = {
  'r/FirstTimeHomeBuyer': '#b35a14',
  'r/realestate': '#1a52a8',
  'r/homebuying': '#2d5e53',
  'r/moving': '#6b2da8',
  'r/realestateinvesting': '#1a52a8',
  'r/Landlord': '#7a4010',
  'r/urbanplanning': '#2d5e53',
  'r/walkable_cities': '#1a7a4a',
  'r/fuckcars': '#c0392b',
};

function timeAgo(unixSec: number): string {
  const diff = Math.floor((Date.now() / 1000) - unixSec);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RedditMonitor() {
  const { fetchRedditFeed, updateRedditPostStatus } = useAdminApi();
  const [feed, setFeed] = useState<RedditFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'engaged' | 'dismissed'>('all');
  const [subFilter, setSubFilter] = useState<string>('all');

  // Use a ref so load() is stable and doesn't trigger re-render loops
  const fetchRef = useRef(fetchRedditFeed);
  fetchRef.current = fetchRedditFeed;

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const data = await fetchRef.current(refresh);
      setFeed(data.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // stable - no deps

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(() => load(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const updateStatus = async (id: string, status: 'new' | 'dismissed' | 'engaged') => {
    await updateRedditPostStatus(id, status);
    setFeed(prev => prev ? {
      ...prev,
      posts: prev.posts.map(p => p.id === id ? { ...p, status } : p),
    } : prev);
  };

  const filtered = (feed?.posts ?? []).filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (subFilter !== 'all' && p.subreddit !== subFilter) return false;
    return true;
  });

  const newCount = feed?.posts.filter(p => p.status === 'new').length ?? 0;
  const subreddits = [...new Set((feed?.posts ?? []).map(p => p.subreddit))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading Reddit feed...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={() => load()} className="text-xs px-4 py-2 bg-gray-800 text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reddit Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Walkability mentions across 9 subreddits · auto-refreshes every 5 min
            {feed?.lastUpdated && (
              <span className="ml-2 font-mono text-xs text-gray-400">
                Last poll: {new Date(feed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {refreshing ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {refreshing ? 'Polling Reddit...' : 'Refresh Now'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'New', value: feed?.posts.filter(p => p.status === 'new').length ?? 0, color: 'text-orange-600' },
          { label: 'Engaged', value: feed?.posts.filter(p => p.status === 'engaged').length ?? 0, color: 'text-green-600' },
          { label: 'Dismissed', value: feed?.posts.filter(p => p.status === 'dismissed').length ?? 0, color: 'text-gray-400' },
          { label: 'Total', value: feed?.posts.length ?? 0, color: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'new', 'engaged', 'dismissed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'new' && newCount > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{newCount}</span>
              )}
            </button>
          ))}
        </div>
        <select
          value={subFilter}
          onChange={e => setSubFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:border-gray-400"
        >
          <option value="all">All subreddits</option>
          {subreddits.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {feed?.posts.length === 0
              ? 'No posts found yet. Click Refresh Now to poll Reddit.'
              : 'No posts match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div
              key={post.id}
              className={`bg-white rounded-xl border transition-all ${
                post.status === 'new'
                  ? 'border-orange-200 shadow-sm'
                  : post.status === 'engaged'
                  ? 'border-green-200'
                  : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (SUBREDDIT_COLORS[post.subreddit] || '#555') + '18',
                          color: SUBREDDIT_COLORS[post.subreddit] || '#555',
                        }}
                      >
                        {post.subreddit}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">u/{post.author}</span>
                      <span className="text-xs text-gray-400">{timeAgo(post.created)}</span>
                      <span className="text-xs text-gray-400">↑ {post.score}</span>
                      <span className="text-xs text-gray-400">💬 {post.numComments}</span>
                      {post.status === 'engaged' && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Engaged</span>
                      )}
                    </div>

                    {/* Title */}
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors line-clamp-2 block mb-1.5"
                    >
                      {post.title}
                    </a>

                    {/* Snippet */}
                    {post.snippet && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{post.snippet}</p>
                    )}

                    {/* Keywords */}
                    <div className="flex gap-1 flex-wrap">
                      {post.matchedKeywords.map(kw => (
                        <span key={kw} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => post.status === 'new' && updateStatus(post.id, 'engaged')}
                      className="text-xs px-3 py-1.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-center whitespace-nowrap"
                    >
                      Reply on Reddit ↗
                    </a>
                    {post.status !== 'engaged' && (
                      <button
                        onClick={() => updateStatus(post.id, 'engaged')}
                        className="text-xs px-3 py-1.5 border border-green-300 text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors"
                      >
                        Mark Engaged
                      </button>
                    )}
                    {post.status !== 'dismissed' && (
                      <button
                        onClick={() => updateStatus(post.id, 'dismissed')}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                    {post.status === 'dismissed' && (
                      <button
                        onClick={() => updateStatus(post.id, 'new')}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
