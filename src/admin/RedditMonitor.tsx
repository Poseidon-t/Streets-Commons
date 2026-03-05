import { useState, useEffect, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
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
  tier: 1 | 2;
  relevance: number;
  isQuestion: boolean;
  status: 'new' | 'dismissed' | 'engaged';
}

interface RedditFeed {
  lastUpdated: string | null;
  posts: RedditPost[];
}

interface RedditConfig {
  subreddits: string[];
  keywordsTier1: string[];
  keywordsTier2: string[];
  walkabilitySubreddits: string[];
  highValueSubreddits: string[];
}

const SUBREDDIT_COLORS: Record<string, string> = {
  'r/FirstTimeHomeBuyer': '#b35a14',
  'r/realestate': '#1a52a8',
  'r/homebuying': '#2d5e53',
  'r/moving': '#6b2da8',
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

// ── Tag chip ───────────────────────────────────────────────────────────────────
function TagChip({
  label, onRemove, color = 'gray', badge,
}: {
  label: string; onRemove: () => void; color?: 'gray' | 'orange' | 'amber' | 'green' | 'blue'; badge?: string;
}) {
  const colorMap = {
    gray:   'bg-gray-100 text-gray-700 border-gray-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono ${colorMap[color]}`}>
      {badge && <span className="text-[10px]">{badge}</span>}
      {label}
      <button onClick={onRemove} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none" title={`Remove ${label}`}>✕</button>
    </span>
  );
}

// ── Tag input ──────────────────────────────────────────────────────────────────
function TagInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const commit = () => { const t = val.trim().toLowerCase(); if (t) { onAdd(t); setVal(''); } };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } };
  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={onKey}
        placeholder={placeholder}
        className="flex-1 text-xs border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:border-gray-400 placeholder-gray-400"
      />
      <button onClick={commit} className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors">Add</button>
    </div>
  );
}

export default function RedditMonitor() {
  const { fetchRedditFeed, updateRedditPostStatus, fetchRedditConfig, saveRedditConfig } = useAdminApi();

  // Feed state
  const [feed, setFeed] = useState<RedditFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filter, setFilter] = useState<'all' | 'new' | 'engaged' | 'dismissed'>('all');
  const [subFilter, setSubFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<'all' | '1' | 'questions'>('all');

  // Config panel state
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<RedditConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);

  const fetchRef = useRef(fetchRedditFeed);
  fetchRef.current = fetchRedditFeed;

  const load = useCallback(async (refresh = false, reset = false) => {
    try {
      if (reset) setResetting(true);
      else if (refresh) setRefreshing(true);
      else setLoading(true);
      const data = await fetchRef.current(refresh, reset);
      setFeed(data.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setResetting(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(() => load(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // Load config when panel opens (once)
  const fetchConfigRef = useRef(fetchRedditConfig);
  fetchConfigRef.current = fetchRedditConfig;
  useEffect(() => {
    if (!showConfig || config) return;
    setConfigLoading(true);
    fetchConfigRef.current()
      .then((res: { data: RedditConfig }) => { setConfig(res.data); setConfigDirty(false); })
      .catch((e: Error) => setConfigError(e.message))
      .finally(() => setConfigLoading(false));
  }, [showConfig, config]);

  const updateStatus = async (id: string, status: 'new' | 'dismissed' | 'engaged') => {
    await updateRedditPostStatus(id, status);
    setFeed(prev => prev ? { ...prev, posts: prev.posts.map(p => p.id === id ? { ...p, status } : p) } : prev);
  };

  // ── Config helpers ──────────────────────────────────────────────────────────
  function updateConfig(patch: Partial<RedditConfig>) {
    setConfig(prev => prev ? { ...prev, ...patch } : prev);
    setConfigDirty(true);
  }

  function addToList(field: keyof RedditConfig, value: string) {
    if (!config) return;
    const cleaned = value.trim().replace(/^r\//, '');
    if (!cleaned || config[field].includes(cleaned)) return;
    updateConfig({ [field]: [...config[field], cleaned] });
  }

  function removeFromList(field: keyof RedditConfig, value: string) {
    if (!config) return;
    updateConfig({ [field]: config[field].filter((v: string) => v !== value) });
  }

  function toggleWalkabilitySub(sub: string) {
    if (!config) return;
    const isWalk = config.walkabilitySubreddits.includes(sub);
    updateConfig({ walkabilitySubreddits: isWalk ? config.walkabilitySubreddits.filter(s => s !== sub) : [...config.walkabilitySubreddits, sub] });
  }

  function toggleHighValueSub(sub: string) {
    if (!config) return;
    const isHigh = config.highValueSubreddits.includes(sub);
    updateConfig({ highValueSubreddits: isHigh ? config.highValueSubreddits.filter(s => s !== sub) : [...config.highValueSubreddits, sub] });
  }

  async function handleSaveConfig(repoll = false) {
    if (!config) return;
    setConfigSaving(true);
    setConfigError(null);
    try {
      const result = await saveRedditConfig(config, repoll);
      setFeed(result.data);
      setConfigDirty(false);
    } catch (e) {
      setConfigError((e as Error).message);
    } finally {
      setConfigSaving(false);
    }
  }

  // ── Feed filter ─────────────────────────────────────────────────────────────
  const filtered = (feed?.posts ?? []).filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (subFilter !== 'all' && p.subreddit !== subFilter) return false;
    if (tierFilter === '1' && p.tier !== 1) return false;
    if (tierFilter === 'questions' && !p.isQuestion) return false;
    return true;
  });

  const newCount = feed?.posts.filter(p => p.status === 'new').length ?? 0;
  const subreddits = [...new Set((feed?.posts ?? []).map(p => p.subreddit))].sort();

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading Reddit feed...</div>;
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
            Walkability mentions · auto-refreshes every 5 min
            {feed?.lastUpdated && (
              <span className="ml-2 font-mono text-xs text-gray-400">
                Last poll: {new Date(feed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showConfig ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Configure
            {configDirty && <span className="w-2 h-2 rounded-full bg-orange-400" />}
          </button>
          <button
            onClick={() => load(false, true)}
            disabled={resetting || refreshing}
            title="Clear all cached posts and re-poll from scratch"
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {resetting ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            {resetting ? 'Clearing...' : 'Reset Feed'}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing || resetting}
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
      </div>

      {/* ── Config Panel ────────────────────────────────────────────────────── */}
      {showConfig && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Monitor Configuration</h2>
            {configError && <p className="text-xs text-red-500">{configError}</p>}
          </div>

          {configLoading ? (
            <p className="text-sm text-gray-400">Loading config...</p>
          ) : config ? (
            <>
              {/* Subreddits */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Subreddits ({config.subreddits.length})
                  </p>
                  <p className="text-xs text-gray-400">hover a chip to toggle · 🏙 = no keyword filter · ⭐ = +2 relevance</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {config.subreddits.map(sub => {
                    const isWalk = config.walkabilitySubreddits.includes(sub);
                    const isHigh = config.highValueSubreddits.includes(sub);
                    return (
                      <div key={sub} className="group relative">
                        <TagChip
                          label={`r/${sub}`}
                          color={isWalk ? 'green' : isHigh ? 'blue' : 'gray'}
                          badge={isWalk ? '🏙' : isHigh ? '⭐' : undefined}
                          onRemove={() => removeFromList('subreddits', sub)}
                        />
                        <div className="absolute bottom-full mb-1 left-0 hidden group-hover:flex bg-white border border-gray-200 rounded-md shadow-sm text-[10px] whitespace-nowrap z-10 overflow-hidden">
                          <button
                            onClick={() => toggleWalkabilitySub(sub)}
                            className={`px-2 py-1 border-r border-gray-200 transition-colors ${isWalk ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50 text-gray-500'}`}
                          >
                            🏙 Auto-match
                          </button>
                          <button
                            onClick={() => toggleHighValueSub(sub)}
                            className={`px-2 py-1 transition-colors ${isHigh ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-500'}`}
                          >
                            ⭐ High value
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <TagInput placeholder="Add subreddit (e.g. urbandesign)" onAdd={v => addToList('subreddits', v)} />
              </div>

              <div className="border-t border-gray-100" />

              {/* Tier 1 Keywords */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Tier 1 — Direct Questions ({config.keywordsTier1.length})
                  <span className="ml-2 font-normal text-gray-400 normal-case">+3 pts each · shown as "Direct hit"</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {config.keywordsTier1.map(kw => (
                    <TagChip key={kw} label={kw} color="orange" onRemove={() => removeFromList('keywordsTier1', kw)} />
                  ))}
                </div>
                <TagInput placeholder="Add keyword (e.g. is it walkable)" onAdd={v => addToList('keywordsTier1', v)} />
              </div>

              <div className="border-t border-gray-100" />

              {/* Tier 2 Keywords */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Tier 2 — Topical ({config.keywordsTier2.length})
                  <span className="ml-2 font-normal text-gray-400 normal-case">+1 pt each · general walkability context</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {config.keywordsTier2.map(kw => (
                    <TagChip key={kw} label={kw} color="amber" onRemove={() => removeFromList('keywordsTier2', kw)} />
                  ))}
                </div>
                <TagInput placeholder="Add keyword (e.g. sidewalk)" onAdd={v => addToList('keywordsTier2', v)} />
              </div>

              {/* Save buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  "Save" re-scores cached posts instantly.
                  "Save &amp; Re-poll" also fetches fresh posts from all subreddits.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveConfig(false)}
                    disabled={configSaving || !configDirty}
                    className="text-xs px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {configSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleSaveConfig(true)}
                    disabled={configSaving}
                    className="text-xs px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {configSaving ? 'Saving...' : 'Save & Re-poll'}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

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
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([['all', 'All relevance'], ['1', '🎯 Direct hits'], ['questions', '❓ Questions only']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTierFilter(val as 'all' | '1' | 'questions')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tierFilter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
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
                      {post.tier === 1 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🎯 Direct hit</span>
                      )}
                      {post.isQuestion && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">❓ Question</span>
                      )}
                      {post.relevance >= 5 && (
                        <span className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">rel:{post.relevance}</span>
                      )}
                      <span className="text-xs text-gray-400 font-mono">u/{post.author}</span>
                      <span className="text-xs text-gray-400">{timeAgo(post.created)}</span>
                      {post.status === 'engaged' && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Engaged</span>
                      )}
                    </div>

                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors line-clamp-2 block mb-1.5"
                    >
                      {post.title}
                    </a>

                    {post.snippet && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{post.snippet}</p>
                    )}

                    {post.matchedKeywords.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {post.matchedKeywords.map(kw => (
                          <span key={kw} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-mono">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

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
