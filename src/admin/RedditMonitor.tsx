import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { useAdminApi } from './adminApi';
import RedditPostCard from './RedditPostCard';
import type { RedditPost } from './RedditPostCard';

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

interface SearchParams {
  maxAgeHours: 1 | 6 | 12 | 24 | 72 | 168;
  minRelevance: number;
  postType: 'all' | 'questions' | 'non-questions';
  sortBy: 'relevance' | 'newest' | 'subreddit';
}

const AGE_OPTIONS = [
  { value: 1,   label: '1h' },
  { value: 6,   label: '6h' },
  { value: 12,  label: '12h' },
  { value: 24,  label: '24h' },
  { value: 72,  label: '3d' },
  { value: 168, label: '7d' },
] as const;

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm animate-pulse"
      style={{ borderLeft: '4px solid #e5e7eb' }}>
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2 items-center">
          <div className="h-5 w-24 bg-gray-200 rounded-full" />
          <div className="h-5 w-10 bg-gray-200 rounded-full" />
          <div className="h-5 w-10 bg-gray-200 rounded-md" />
          <div className="h-4 w-16 bg-gray-200 rounded ml-auto" />
        </div>
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-2/3 bg-gray-100 rounded" />
        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-1">
            <div className="h-4 w-12 bg-amber-100 rounded" />
            <div className="h-4 w-16 bg-amber-100 rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-7 w-16 bg-gray-200 rounded-lg" />
            <div className="h-7 w-16 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TopLoadingBar({ active }: { active: boolean }) {
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 h-0.5 transition-opacity duration-500 pointer-events-none
      ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className="h-full w-full animate-pulse" style={{ backgroundColor: '#e07850' }} />
    </div>
  );
}

function EmptyState({ hasPosts, onRefresh }: { hasPosts: boolean; onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-sm font-medium text-gray-500 mb-1">
        {hasPosts ? 'No posts match these filters' : 'No posts found'}
      </p>
      <p className="text-xs text-gray-400 mb-4">
        {hasPosts ? 'Try adjusting the filters above' : 'Refresh to pull the latest posts from Reddit'}
      </p>
      {!hasPosts && (
        <button
          onClick={onRefresh}
          className="text-xs px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 transition"
          style={{ backgroundColor: '#e07850' }}
        >
          Refresh Now
        </button>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</p>;
}

function TagChip({ label, onRemove, color = 'gray' }: {
  label: string; onRemove: () => void; color?: 'gray' | 'orange' | 'amber';
}) {
  const cls = {
    gray:   'bg-gray-100 text-gray-700 border-gray-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono ${cls}`}>
      {label}
      <button onClick={onRemove} className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity leading-none">✕</button>
    </span>
  );
}

function TagInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const commit = () => { const t = val.trim().toLowerCase(); if (t) { onAdd(t); setVal(''); } };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
  };
  return (
    <div className="flex gap-1.5 mt-2">
      <input
        type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={onKey}
        placeholder={placeholder}
        className="flex-1 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-gray-400 placeholder-gray-300"
      />
      <button onClick={commit} className="text-xs px-2.5 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors font-medium">
        Add
      </button>
    </div>
  );
}

// ── Settings Drawer ────────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  config: RedditConfig | null;
  configLoading: boolean;
  configSaving: boolean;
  configSaved: boolean;
  configError: string | null;
  configDirty: boolean;
  onAdd: (field: keyof RedditConfig, value: string) => void;
  onRemove: (field: keyof RedditConfig, value: string) => void;
  onSave: (repoll: boolean) => void;
}

function SettingsDrawer({
  open, onClose, config, configLoading, configSaving, configSaved, configError, configDirty,
  onAdd, onRemove, onSave,
}: DrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 bg-white shadow-2xl
          flex flex-col overflow-hidden
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0"
          style={{ backgroundColor: '#f7f5f0' }}>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Monitor Settings</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {configLoading && (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-xs">
              <Spinner /> Loading config...
            </div>
          )}

          {config && (
            <>
              {/* Subreddits */}
              <div>
                <SectionLabel>Subreddits ({config.subreddits.length})</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {config.subreddits.map(s => (
                    <TagChip key={s} label={`r/${s}`} color="gray"
                      onRemove={() => onRemove('subreddits', s)} />
                  ))}
                </div>
                <TagInput placeholder="Add subreddit (no r/)" onAdd={v => onAdd('subreddits', v.replace(/^r\//, ''))} />
              </div>

              <div className="border-t border-gray-100" />

              {/* Tier 1 keywords */}
              <div>
                <SectionLabel>Direct hit keywords · +3pts ({config.keywordsTier1.length})</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {config.keywordsTier1.map(kw => (
                    <TagChip key={kw} label={kw} color="orange"
                      onRemove={() => onRemove('keywordsTier1', kw)} />
                  ))}
                </div>
                <TagInput placeholder="Add keyword" onAdd={v => onAdd('keywordsTier1', v)} />
              </div>

              <div className="border-t border-gray-100" />

              {/* Tier 2 keywords */}
              <div>
                <SectionLabel>Topical keywords · +1pt ({config.keywordsTier2.length})</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {config.keywordsTier2.map(kw => (
                    <TagChip key={kw} label={kw} color="amber"
                      onRemove={() => onRemove('keywordsTier2', kw)} />
                  ))}
                </div>
                <TagInput placeholder="Add keyword" onAdd={v => onAdd('keywordsTier2', v)} />
              </div>
            </>
          )}

          {configError && <p className="text-xs text-red-500 mt-2">{configError}</p>}
        </div>

        {/* Footer actions */}
        {config && (
          <div className="p-4 border-t border-gray-100 flex-shrink-0 space-y-2">
            <button
              onClick={() => onSave(false)}
              disabled={configSaving || !configDirty}
              className="w-full text-xs py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {configSaved ? '✓ Saved' : configSaving ? 'Saving...' : 'Save config'}
            </button>
            <button
              onClick={() => onSave(true)}
              disabled={configSaving}
              className="w-full text-xs py-2 font-semibold text-white rounded-lg disabled:opacity-40 transition-colors hover:opacity-90"
              style={{ backgroundColor: '#e07850' }}
            >
              {configSaving ? 'Saving & Polling...' : 'Save & Re-poll Reddit'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RedditMonitor() {
  const { fetchRedditFeed, updateRedditPostStatus, fetchRedditConfig, saveRedditConfig } = useAdminApi();

  // Feed state
  const [feed, setFeed] = useState<RedditFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View filter state — all applied client-side, instant
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'engaged' | 'dismissed'>('all');
  const [subFilter, setSubFilter] = useState('all');
  const [searchParams, setSearchParams] = useState<SearchParams>({
    maxAgeHours: 24,
    minRelevance: 1,
    postType: 'all',
    sortBy: 'relevance',
  });

  // Settings drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [config, setConfig] = useState<RedditConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const configLoadedRef = useRef(false);

  const fetchRef = useRef(fetchRedditFeed);
  fetchRef.current = fetchRedditFeed;
  const fetchConfigRef = useRef(fetchRedditConfig);
  fetchConfigRef.current = fetchRedditConfig;

  // Always fetch full 7-day dataset; all filtering is client-side
  const load = useCallback(async (opts: { refresh?: boolean; reset?: boolean } = {}) => {
    try {
      if (opts.refresh || opts.reset) setRefreshing(true);
      else setFeedLoading(true);

      const data = await fetchRef.current({
        ...opts,
        maxAgeHours: 168,
        minRelevance: 1,
        postType: 'all',
        sortBy: 'relevance',
      });
      setFeed(data.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFeedLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent auto-refresh every 5 min (re-reads cache, no Reddit poll)
  useEffect(() => {
    const t = setInterval(() => load(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // Lazy-load config only when drawer first opens
  useEffect(() => {
    if (!drawerOpen || configLoadedRef.current) return;
    configLoadedRef.current = true;
    setConfigLoading(true);
    fetchConfigRef.current()
      .then((res: { data: RedditConfig }) => {
        setConfig({
          subreddits: res.data.subreddits ?? [],
          keywordsTier1: res.data.keywordsTier1 ?? [],
          keywordsTier2: res.data.keywordsTier2 ?? [],
          walkabilitySubreddits: res.data.walkabilitySubreddits ?? [],
          highValueSubreddits: res.data.highValueSubreddits ?? [],
        });
      })
      .catch((e: Error) => setConfigError(e.message))
      .finally(() => setConfigLoading(false));
  }, [drawerOpen]);

  const addToList = (field: keyof RedditConfig, value: string) => {
    setConfig(c => {
      if (!c) return c;
      const list = c[field] as string[];
      if (list.includes(value)) return c;
      return { ...c, [field]: [...list, value] };
    });
    setConfigDirty(true);
    setConfigSaved(false);
  };

  const removeFromList = (field: keyof RedditConfig, value: string) => {
    setConfig(c => {
      if (!c) return c;
      return { ...c, [field]: (c[field] as string[]).filter(v => v !== value) };
    });
    setConfigDirty(true);
    setConfigSaved(false);
  };

  const handleSaveConfig = async (repoll: boolean) => {
    if (!config) return;
    setConfigSaving(true);
    setConfigError(null);
    try {
      await saveRedditConfig(config, repoll);
      setConfigSaved(true);
      setConfigDirty(false);
      if (repoll) await load({ refresh: true });
    } catch (e) {
      setConfigError((e as Error).message);
    } finally {
      setConfigSaving(false);
    }
  };

  const updateStatus = async (id: string, status: RedditPost['status']) => {
    // Optimistic update
    setFeed(f => f ? { ...f, posts: f.posts.map(p => p.id === id ? { ...p, status } : p) } : f);
    try {
      await updateRedditPostStatus(id, status);
    } catch {
      // no-op — optimistic state is fine
    }
  };

  // Client-side filtering — instant, no network call
  const filtered = useMemo(() => {
    const cutoff = Date.now() / 1000 - searchParams.maxAgeHours * 3600;
    let posts = (feed?.posts ?? []).filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (subFilter !== 'all' && p.subreddit !== subFilter) return false;
      if (p.status === 'new' && p.created < cutoff) return false;
      if (p.relevance < searchParams.minRelevance) return false;
      if (searchParams.postType === 'questions' && !p.isQuestion) return false;
      if (searchParams.postType === 'non-questions' && p.isQuestion) return false;
      return true;
    });
    if (searchParams.sortBy === 'newest') {
      posts = posts.slice().sort((a, b) => b.created - a.created);
    } else if (searchParams.sortBy === 'subreddit') {
      posts = posts.slice().sort((a, b) => a.subreddit.localeCompare(b.subreddit));
    } else {
      posts = posts.slice().sort((a, b) => b.relevance - a.relevance);
    }
    return posts;
  }, [feed, statusFilter, subFilter, searchParams]);

  const stats = useMemo(() => {
    const posts = feed?.posts ?? [];
    return {
      total: posts.length,
      newCount: posts.filter(p => p.status === 'new').length,
      engaged: posts.filter(p => p.status === 'engaged').length,
      dismissed: posts.filter(p => p.status === 'dismissed').length,
    };
  }, [feed]);

  const subreddits = useMemo(() => {
    const s = new Set((feed?.posts ?? []).map(p => p.subreddit));
    return Array.from(s).sort();
  }, [feed]);

  const lastPolled = feed?.lastUpdated
    ? new Date(feed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="relative">
      <TopLoadingBar active={refreshing} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>Reddit Monitor</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8a9a8a' }}>
            {feedLoading
              ? 'Loading posts...'
              : `${stats.total} posts · ${stats.newCount} new${lastPolled ? ` · Polled ${lastPolled}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load({ refresh: true })}
            disabled={refreshing || feedLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-all hover:opacity-90"
            style={{ backgroundColor: '#e07850' }}
          >
            {refreshing ? <Spinner /> : <span>↺</span>}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center mb-4 pb-3 border-b border-gray-200">
        {/* Status tabs */}
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1">
          {(['all', 'new', 'engaged', 'dismissed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
                ${statusFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'new' && stats.newCount > 0 && (
                <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold text-white"
                  style={{ backgroundColor: '#e07850' }}>
                  {stats.newCount}
                </span>
              )}
              {f === 'engaged' && stats.engaged > 0 && (
                <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold text-white bg-green-500">
                  {stats.engaged}
                </span>
              )}
              {f === 'dismissed' && stats.dismissed > 0 && (
                <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold text-white bg-gray-400">
                  {stats.dismissed}
                </span>
              )}
            </button>
          ))}
        </div>

        <select
          value={searchParams.sortBy}
          onChange={e => setSearchParams(p => ({ ...p, sortBy: e.target.value as SearchParams['sortBy'] }))}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none cursor-pointer"
        >
          <option value="relevance">By Relevance</option>
          <option value="newest">Newest First</option>
          <option value="subreddit">By Subreddit</option>
        </select>

        <select
          value={searchParams.maxAgeHours}
          onChange={e => setSearchParams(p => ({ ...p, maxAgeHours: Number(e.target.value) as SearchParams['maxAgeHours'] }))}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none cursor-pointer"
        >
          {AGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={searchParams.postType}
          onChange={e => setSearchParams(p => ({ ...p, postType: e.target.value as SearchParams['postType'] }))}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none cursor-pointer"
        >
          <option value="all">All types</option>
          <option value="questions">Questions only</option>
          <option value="non-questions">Non-questions</option>
        </select>

        {subreddits.length > 0 && (
          <select
            value={subFilter}
            onChange={e => setSubFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All subreddits</option>
            {subreddits.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Min score:</span>
          <input
            type="range" min={1} max={10} step={1}
            value={searchParams.minRelevance}
            onChange={e => setSearchParams(p => ({ ...p, minRelevance: Number(e.target.value) }))}
            className="w-20 accent-orange-500"
          />
          <span className="text-xs font-mono font-bold text-gray-700 w-5 text-center">{searchParams.minRelevance}</span>
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {!feedLoading && `${filtered.length} post${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => load()} className="text-xs underline ml-3">Retry</button>
        </div>
      )}

      {/* Feed */}
      {feedLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasPosts={(feed?.posts.length ?? 0) > 0} onRefresh={() => load({ refresh: true })} />
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <RedditPostCard key={post.id} post={post} onUpdateStatus={updateStatus} />
          ))}
        </div>
      )}

      {/* Settings drawer */}
      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        config={config}
        configLoading={configLoading}
        configSaving={configSaving}
        configSaved={configSaved}
        configError={configError}
        configDirty={configDirty}
        onAdd={addToList}
        onRemove={removeFromList}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
