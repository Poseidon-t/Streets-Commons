import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdminApi } from './adminApi';

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  score: number;
  numComments: number;
  created: number;
  matchedKeywords: string[];
  relevanceTier: 'high' | 'medium';
  relevanceScore: number;
  fetchedAt: string;
}

interface RedditConfig {
  subreddits: string[];
  keywordsHigh: string[];
  keywordsMedium: string[];
}

interface RedditData {
  lastUpdated: string | null;
  posts: RedditPost[];
  config: RedditConfig;
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const URBANIST_PATTERNS = ['urbanplanning', 'fuckcars', 'notjustbikes', 'urbandesign', 'strongtowns', 'walkablestreets', 'transit'];

function subredditColor(sub: string): { bg: string; text: string } {
  const lower = sub.replace('r/', '').toLowerCase();
  if (URBANIST_PATTERNS.some(p => lower.includes(p))) return { bg: '#dcfce7', text: '#166534' };
  return { bg: '#dbeafe', text: '#1e40af' };
}

// ── Tag Input Component ──────────────────────────────────────────────────────

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  tagColor,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  tagColor: { bg: string; text: string; border: string };
}) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.trim().replace(/,$/,'');
      if (value && !tags.includes(value)) {
        onAdd(value);
      }
      setInput('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: tagColor.bg, color: tagColor.text, border: `1px solid ${tagColor.border}` }}
          >
            {tag}
            <button
              onClick={() => onRemove(tag)}
              className="hover:opacity-70 ml-0.5"
              style={{ color: tagColor.text }}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
      />
    </div>
  );
}

// ── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({
  config,
  onSave,
  onClearPosts,
}: {
  config: RedditConfig;
  onSave: (config: RedditConfig) => Promise<void>;
  onClearPosts: () => Promise<void>;
}) {
  const [subreddits, setSubreddits] = useState(config.subreddits);
  const [keywordsHigh, setKeywordsHigh] = useState(config.keywordsHigh);
  const [keywordsMedium, setKeywordsMedium] = useState(config.keywordsMedium);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave({ subreddits, keywordsHigh, keywordsMedium });
      setDirty(false);
      setMessage('Settings saved');
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear all fetched posts? This cannot be undone.')) return;
    try {
      await onClearPosts();
      setMessage('Posts cleared');
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage('Failed to clear');
    }
  };

  const markDirty = () => setDirty(true);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
      {/* Subreddits */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: '#2a3a2a' }}>
          Subreddits to Monitor
        </label>
        <p className="text-xs mb-2" style={{ color: '#8a9a8a' }}>
          Add subreddit names without r/ prefix. Press Enter or comma to add.
        </p>
        <TagInput
          tags={subreddits}
          onAdd={tag => { setSubreddits(prev => [...prev, tag.replace(/^r\//, '')]); markDirty(); }}
          onRemove={tag => { setSubreddits(prev => prev.filter(s => s !== tag)); markDirty(); }}
          placeholder="e.g. bikecommuting"
          tagColor={{ bg: '#dcfce7', text: '#166534', border: '#bbf7d0' }}
        />
      </div>

      {/* High-priority keywords */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: '#2a3a2a' }}>
          High-Priority Keywords
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a9a8a' }}>+3 relevance each</span>
        </label>
        <TagInput
          tags={keywordsHigh}
          onAdd={tag => { setKeywordsHigh(prev => [...prev, tag.toLowerCase()]); markDirty(); }}
          onRemove={tag => { setKeywordsHigh(prev => prev.filter(k => k !== tag)); markDirty(); }}
          placeholder="e.g. sidewalk safety"
          tagColor={{ bg: '#fef2f2', text: '#991b1b', border: '#fecaca' }}
        />
      </div>

      {/* Medium-priority keywords */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: '#2a3a2a' }}>
          Medium-Priority Keywords
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a9a8a' }}>+1 relevance each</span>
        </label>
        <TagInput
          tags={keywordsMedium}
          onAdd={tag => { setKeywordsMedium(prev => [...prev, tag.toLowerCase()]); markDirty(); }}
          onRemove={tag => { setKeywordsMedium(prev => prev.filter(k => k !== tag)); markDirty(); }}
          placeholder="e.g. bike lane"
          tagColor={{ bg: '#fefce8', text: '#854d0e', border: '#fef08a' }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: '#e07850' }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {message && (
            <span className="text-sm" style={{ color: message.includes('Failed') ? '#dc2626' : '#16a34a' }}>
              {message}
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-xs font-medium hover:underline"
          style={{ color: '#dc2626' }}
        >
          Clear all posts
        </button>
      </div>

      {/* Stats */}
      <div className="text-xs pt-2" style={{ color: '#8a9a8a' }}>
        {subreddits.length} subreddits · {keywordsHigh.length} high keywords · {keywordsMedium.length} medium keywords
        · Refresh takes ~{subreddits.length * 2}s
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function RedditMonitor() {
  const api = useAdminApi();
  const [data, setData] = useState<RedditData>({ lastUpdated: null, posts: [], config: { subreddits: [], keywordsHigh: [], keywordsMedium: [] } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [filterSubreddit, setFilterSubreddit] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await api.fetchRedditPosts();
      setData(d);
    } catch {
      setError('Failed to load posts');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    setError(null);
    try {
      const result = await api.refreshRedditPosts();
      setRefreshResult(`Found ${result.newPosts} new posts (${result.totalPosts} total)`);
      await reload();
    } catch {
      setError('Refresh failed — Reddit may be rate-limiting');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissRedditPost(id);
      setData(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== id) }));
    } catch {
      // silent fail
    }
  };

  const handleSaveConfig = async (config: RedditConfig) => {
    await api.updateRedditConfig(config);
    setData(prev => ({ ...prev, config }));
  };

  const handleClearPosts = async () => {
    await api.clearRedditPosts();
    setData(prev => ({ ...prev, posts: [], lastUpdated: null }));
  };

  const subreddits = useMemo(() => {
    const subs = new Set(data.posts.map(p => p.subreddit));
    return Array.from(subs).sort();
  }, [data.posts]);

  const filteredPosts = useMemo(() => {
    return data.posts.filter(p => {
      if (filterSubreddit !== 'all' && p.subreddit !== filterSubreddit) return false;
      if (filterTier !== 'all' && p.relevanceTier !== filterTier) return false;
      return true;
    });
  }, [data.posts, filterSubreddit, filterTier]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>Reddit Monitor</h1>
          {data.lastUpdated && (
            <p className="text-sm mt-1" style={{ color: '#8a9a8a' }}>
              Last refreshed: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            style={{ color: '#2a3a2a' }}
          >
            {showSettings ? 'Hide Settings' : 'Settings'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: '#e07850' }}
          >
            {refreshing ? `Refreshing (~${data.config.subreddits.length * 2}s)...` : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-6">
          <SettingsPanel
            config={data.config}
            onSave={handleSaveConfig}
            onClearPosts={handleClearPosts}
          />
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {refreshResult && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{refreshResult}</div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={filterSubreddit}
          onChange={e => setFilterSubreddit(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Subreddits</option>
          {subreddits.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterTier}
          onChange={e => setFilterTier(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Relevance</option>
          <option value="high">High Relevance</option>
          <option value="medium">Medium Relevance</option>
        </select>

        <span className="text-sm" style={{ color: '#8a9a8a' }}>
          {filteredPosts.length} of {data.posts.length} posts
        </span>
      </div>

      {/* Post list */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg font-medium" style={{ color: '#8a9a8a' }}>No matching posts</p>
          <p className="text-sm mt-1" style={{ color: '#b0b8b0' }}>Click Refresh to fetch new posts from Reddit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map(post => {
            const subColor = subredditColor(post.subreddit);
            return (
              <div
                key={post.id}
                className="p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: subColor.bg, color: subColor.text }}
                      >
                        {post.subreddit}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: post.relevanceTier === 'high' ? '#fef2f2' : '#fefce8',
                          color: post.relevanceTier === 'high' ? '#991b1b' : '#854d0e',
                        }}
                      >
                        {post.relevanceTier === 'high' ? 'High' : 'Medium'}
                      </span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>
                        {timeAgo(post.created)} · {post.score} pts · {post.numComments} comments
                      </span>
                    </div>

                    {/* Title */}
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:underline block mb-1"
                      style={{ color: '#2a3a2a' }}
                    >
                      {post.title}
                    </a>

                    {/* Selftext preview */}
                    {post.selftext && (
                      <p className="text-xs mb-2 line-clamp-2" style={{ color: '#6b7280' }}>
                        {post.selftext.substring(0, 200)}
                      </p>
                    )}

                    {/* Matched keywords */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(post.matchedKeywords || []).map(kw => (
                        <span
                          key={kw}
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => handleDismiss(post.id)}
                    className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="#9ca3af" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
