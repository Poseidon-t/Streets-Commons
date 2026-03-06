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

function TagChip({ label, onRemove, color = 'gray', badge }: {
  label: string; onRemove: () => void; color?: 'gray'|'orange'|'amber'|'green'|'blue'; badge?: string;
}) {
  const cls = {
    gray:   'bg-gray-100 text-gray-700 border-gray-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono ${cls}`}>
      {badge && <span className="text-[10px]">{badge}</span>}
      {label}
      <button onClick={onRemove} className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity leading-none">✕</button>
    </span>
  );
}

function TagInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const commit = () => { const t = val.trim().toLowerCase(); if (t) { onAdd(t); setVal(''); } };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } };
  return (
    <div className="flex gap-1.5 mt-2">
      <input
        type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={onKey}
        placeholder={placeholder}
        className="flex-1 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-gray-400 placeholder-gray-300"
      />
      <button onClick={commit} className="text-xs px-2.5 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors font-medium">Add</button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</p>;
}

export default function RedditMonitor() {
  const { fetchRedditFeed, updateRedditPostStatus, fetchRedditConfig, saveRedditConfig } = useAdminApi();

  // Feed state
  const [feed, setFeed] = useState<RedditFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search params (control what backend returns)
  const [searchParams, setSearchParams] = useState<SearchParams>({
    maxAgeHours: 24,
    minRelevance: 1,
    postType: 'all',
    sortBy: 'relevance',
  });

  // View filters (client-side refinement of returned posts)
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'engaged' | 'dismissed'>('all');
  const [subFilter, setSubFilter] = useState('all');

  // Config state
  const [config, setConfig] = useState<RedditConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);

  const fetchRef = useRef(fetchRedditFeed);
  fetchRef.current = fetchRedditFeed;

  const load = useCallback(async (opts: Parameters<typeof fetchRedditFeed>[0] = {}) => {
    try {
      const isSearch = opts.refresh === true;
      const isReset = opts.reset === true;
      if (isReset) setResetting(true);
      else if (isSearch) setSearching(true);
      else setLoading(true);
      const data = await fetchRef.current({ ...searchParams, ...opts });
      setFeed(data.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setSearching(false);
      setResetting(false);
    }
  }, [searchParams]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent auto-refresh every 5 min (re-reads cache with current filters, no Reddit poll)
  useEffect(() => {
    const t = setInterval(() => load(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // Load config on mount
  const fetchConfigRef = useRef(fetchRedditConfig);
  fetchConfigRef.current = fetchRedditConfig;
  useEffect(() => {
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
  }, []);

  const updateStatus = async (id: string, status: RedditPost['status']) => {
    await updateRedditPostStatus(id, status);
    setFeed(prev => prev ? { ...prev, posts: prev.posts.map(p => p.id === id ? { ...p, status } : p) } : prev);
  };

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
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2500);
    } catch (e) {
      setConfigError((e as Error).message);
    } finally {
      setConfigSaving(false);
    }
  }

  // Stats
  const stats = useMemo(() => {
    const posts = feed?.posts ?? [];
    return {
      total: posts.length,
      t1: posts.filter(p => p.tier === 1).length,
      t2: posts.filter(p => p.tier === 2).length,
      newCount: posts.filter(p => p.status === 'new').length,
      engaged: posts.filter(p => p.status === 'engaged').length,
      dismissed: posts.filter(p => p.status === 'dismissed').length,
    };
  }, [feed]);

  // Client-side filtered view
  const filtered = useMemo(() => (feed?.posts ?? []).filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (subFilter !== 'all' && p.subreddit !== subFilter) return false;
    return true;
  }), [feed, statusFilter, subFilter]);

  const subreddits = useMemo(() =>
    [...new Set((feed?.posts ?? []).map(p => p.subreddit))].sort(),
  [feed]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2"><Spinner /> Loading Reddit feed...</div>;
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
    <div className="flex gap-5 min-h-0">

      {/* ── LEFT: Configure & Search panel ──────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 flex flex-col gap-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-gray-100" style={{ background: '#f7f5f0' }}>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Configure & Search</p>
          </div>

          <div className="p-4 space-y-5">
            {/* Subreddits */}
            <div>
              <SectionLabel>Subreddits ({config?.subreddits.length ?? 0})</SectionLabel>
              <p className="text-[10px] text-gray-400 mb-2">Hover a chip to toggle behaviour</p>
              {configLoading ? <p className="text-xs text-gray-400">Loading...</p> : config && (
                <>
                  <div className="flex flex-wrap gap-1">
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
                          <div className="absolute bottom-full mb-1 left-0 hidden group-hover:flex bg-white border border-gray-200 rounded-md shadow-md text-[10px] whitespace-nowrap z-20 overflow-hidden">
                            <button onClick={() => toggleWalkabilitySub(sub)} className={`px-2 py-1.5 border-r border-gray-100 transition-colors ${isWalk ? 'bg-green-50 text-green-700 font-semibold' : 'hover:bg-gray-50 text-gray-500'}`}>
                              🏙 Auto-match
                            </button>
                            <button onClick={() => toggleHighValueSub(sub)} className={`px-2 py-1.5 transition-colors ${isHigh ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-500'}`}>
                              ⭐ High value
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <TagInput placeholder="Add subreddit" onAdd={v => addToList('subreddits', v)} />
                </>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Tier 1 keywords */}
            <div>
              <SectionLabel>Direct hit keywords ({config?.keywordsTier1.length ?? 0}) · +3pts</SectionLabel>
              {config && (
                <>
                  <div className="flex flex-wrap gap-1">
                    {config.keywordsTier1.map(kw => (
                      <TagChip key={kw} label={kw} color="orange" onRemove={() => removeFromList('keywordsTier1', kw)} />
                    ))}
                  </div>
                  <TagInput placeholder="Add keyword" onAdd={v => addToList('keywordsTier1', v)} />
                </>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Tier 2 keywords */}
            <div>
              <SectionLabel>Topical keywords ({config?.keywordsTier2.length ?? 0}) · +1pt</SectionLabel>
              {config && (
                <>
                  <div className="flex flex-wrap gap-1">
                    {config.keywordsTier2.map(kw => (
                      <TagChip key={kw} label={kw} color="amber" onRemove={() => removeFromList('keywordsTier2', kw)} />
                    ))}
                  </div>
                  <TagInput placeholder="Add keyword" onAdd={v => addToList('keywordsTier2', v)} />
                </>
              )}
            </div>

            {/* Config save buttons */}
            {configError && <p className="text-xs text-red-500">{configError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveConfig(false)}
                disabled={configSaving || !configDirty}
                className="flex-1 text-xs py-1.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {configSaved ? '✓ Saved' : configSaving ? 'Saving...' : 'Save config'}
              </button>
              <button
                onClick={() => handleSaveConfig(true)}
                disabled={configSaving || !configDirty}
                className="flex-1 text-xs py-1.5 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Save & Re-poll
              </button>
            </div>

            {/* ── Divider: Search Filters ── */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Search filters</span>
              </div>
            </div>

            {/* Max age */}
            <div>
              <SectionLabel>Post age</SectionLabel>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
                {AGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSearchParams(p => ({ ...p, maxAgeHours: opt.value }))}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      searchParams.maxAgeHours === opt.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min relevance */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <SectionLabel>Min relevance</SectionLabel>
                <span className="text-xs font-mono font-bold text-gray-700 mb-2">{searchParams.minRelevance}/10</span>
              </div>
              <input
                type="range" min={1} max={10} step={1}
                value={searchParams.minRelevance}
                onChange={e => setSearchParams(p => ({ ...p, minRelevance: Number(e.target.value) }))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-[9px] text-gray-400 font-mono mt-0.5">
                <span>1 all</span>
                <span>4 engaged</span>
                <span>7 direct hit</span>
                <span>10 max</span>
              </div>
            </div>

            {/* Post type */}
            <div>
              <SectionLabel>Post type</SectionLabel>
              <div className="space-y-1.5">
                {([['all', 'All posts'], ['questions', 'Questions only ❓'], ['non-questions', 'Non-questions']] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name="postType" value={val}
                      checked={searchParams.postType === val}
                      onChange={() => setSearchParams(p => ({ ...p, postType: val }))}
                      className="accent-orange-500"
                    />
                    <span className="text-xs text-gray-600">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sort by */}
            <div>
              <SectionLabel>Sort results by</SectionLabel>
              <select
                value={searchParams.sortBy}
                onChange={e => setSearchParams(p => ({ ...p, sortBy: e.target.value as SearchParams['sortBy'] }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-gray-400"
              >
                <option value="relevance">Relevance (highest first)</option>
                <option value="newest">Newest first</option>
                <option value="subreddit">By subreddit</option>
              </select>
            </div>

            {/* Search button */}
            <button
              onClick={() => load({ refresh: true })}
              disabled={searching || resetting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#e07850' }}
            >
              {searching ? <><Spinner /> Searching Reddit...</> : <>Search Reddit</>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── RIGHT: Stats + Feed ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1a2e1a' }}>Reddit Monitor</h1>
            <p className="text-xs mt-0.5" style={{ color: '#8a9a8a' }}>
              Walkability mentions
              {feed?.lastUpdated && (
                <span className="ml-2 font-mono">
                  · Last poll: {new Date(feed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => load({ reset: true })}
            disabled={resetting || searching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {resetting ? <Spinner /> : <span>↺</span>}
            {resetting ? 'Clearing...' : 'Reset Feed'}
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Total',     value: stats.total,     color: 'text-gray-800' },
            { label: 'New',       value: stats.newCount,  color: 'text-orange-600' },
            { label: 'T1 Direct', value: stats.t1,        color: 'text-orange-500' },
            { label: 'T2 Topical',value: stats.t2,        color: 'text-amber-600' },
            { label: 'Engaged',   value: stats.engaged,   color: 'text-green-600' },
            { label: 'Dismissed', value: stats.dismissed, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* View filters */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Status tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'new', 'engaged', 'dismissed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  statusFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'new' && stats.newCount > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{stats.newCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Subreddit filter */}
          <select
            value={subFilter}
            onChange={e => setSubFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:border-gray-400"
          >
            <option value="all">All subreddits</option>
            {subreddits.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} post{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Feed */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-500 text-sm font-medium mb-1">
              {feed?.posts.length === 0
                ? 'No posts yet'
                : 'No posts match these filters'}
            </p>
            <p className="text-gray-400 text-xs">
              {feed?.posts.length === 0
                ? 'Click "Search Reddit" to poll for walkability mentions'
                : 'Try adjusting the status filter or subreddit selector'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(post => (
              <RedditPostCard key={post.id} post={post} onUpdateStatus={updateStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
