import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchContentQueue,
  updateContentQueuePost,
  generateBlogPost,
  createPost,
  suggestTopics,
  addCalendarPost,
  type Region,
  type PostType,
  type Tone,
} from './adminApi';

interface CalendarPost {
  id: number;
  title: string;
  region: Region;
  targetDate: string;
  keywords: string[];
  dataSources: string[];
  primaryMessage: string;
  tone: Tone;
  postType: PostType;
  status: string;
  generatedSlug?: string;
  updatedAt?: string;
}

interface Calendar {
  posts: CalendarPost[];
  metadata: { totalPosts: number; targetDistribution: Record<string, string> };
  tracking: { totalGenerated: number; totalPublished: number };
}

interface TopicSuggestion {
  title: string;
  keywords: string[];
  primaryMessage: string;
  tone: Tone;
  postType: PostType;
  dataSources: string[];
}

const ALL_REGIONS: { value: Region | 'all'; label: string }[] = [
  { value: 'all', label: 'All Regions' },
  { value: 'global', label: 'Global' },
  { value: 'europe', label: 'Europe' },
  { value: 'north_america', label: 'North America' },
  { value: 'india', label: 'India' },
  { value: 'asia', label: 'Asia' },
  { value: 'south_america', label: 'South America' },
  { value: 'africa', label: 'Africa' },
  { value: 'oceania', label: 'Oceania' },
];

const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  europe: 'Europe',
  north_america: 'N. America',
  india: 'India',
  asia: 'Asia',
  south_america: 'S. America',
  africa: 'Africa',
  oceania: 'Oceania',
};
const REGION_COLORS: Record<string, string> = {
  global: 'bg-blue-100 text-blue-800',
  europe: 'bg-indigo-100 text-indigo-800',
  north_america: 'bg-purple-100 text-purple-800',
  india: 'bg-orange-100 text-orange-800',
  asia: 'bg-teal-100 text-teal-800',
  south_america: 'bg-lime-100 text-lime-800',
  africa: 'bg-amber-100 text-amber-800',
  oceania: 'bg-cyan-100 text-cyan-800',
};
const REGION_CARD_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  global: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', label: 'text-blue-600' },
  europe: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-800', label: 'text-indigo-600' },
  north_america: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-800', label: 'text-purple-600' },
  india: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', label: 'text-orange-600' },
  asia: { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-800', label: 'text-teal-600' },
  south_america: { bg: 'bg-lime-50', border: 'border-lime-100', text: 'text-lime-800', label: 'text-lime-600' },
  africa: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', label: 'text-amber-600' },
  oceania: { bg: 'bg-cyan-50', border: 'border-cyan-100', text: 'text-cyan-800', label: 'text-cyan-600' },
};
const TONE_LABELS: Record<string, string> = {
  informed_advocate: 'Informed',
  urgent: 'Urgent',
  hopeful: 'Hopeful',
  analytical: 'Analytical',
};
const TYPE_LABELS: Record<string, string> = {
  standard: 'Blog Post',
  data_report: 'Data Report',
  case_study: 'Case Study',
  explainer: 'Explainer',
  education: 'Educational Guide',
};
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  generating: 'bg-yellow-100 text-yellow-800',
  generated: 'bg-green-100 text-green-800',
  published: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

const WORD_COUNT_OPTIONS = [1200, 1500, 1800, 2000, 2500, 3000];

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ─── Pre-Generation Modal ───────────────────────────────────────
function GenerateModal({
  post,
  onClose,
  onConfirm,
}: {
  post: CalendarPost;
  onClose: () => void;
  onConfirm: (params: {
    topic: string;
    keywords: string[];
    postType: PostType;
    tone: Tone;
    region: Region;
    wordCount: number;
    dataSources: string[];
  }) => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [topic, setTopic] = useState(post.primaryMessage);
  const [region, setRegion] = useState<Region>(post.region);
  const [postType, setPostType] = useState<PostType>(post.postType);
  const [tone, setTone] = useState<Tone>(post.tone);
  const [keywords, setKeywords] = useState(post.keywords.join(', '));
  const [wordCount, setWordCount] = useState(1500);
  const [dataSources, setDataSources] = useState(post.dataSources.join(', '));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: '#2a3a2a' }}>
            Generate Post
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {/* Topic / Primary Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Topic / Primary Message
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>

          {/* Grid: Region + Type + Tone + Word Count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as Region)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {ALL_REGIONS.filter((r) => r.value !== 'all').map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Post Type</label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value as PostType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="standard">Blog Post</option>
                <option value="data_report">Data Report</option>
                <option value="case_study">Case Study</option>
                <option value="explainer">Explainer</option>
                <option value="education">Educational Guide</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="informed_advocate">Informed Advocate</option>
                <option value="urgent">Urgent</option>
                <option value="hopeful">Hopeful</option>
                <option value="analytical">Analytical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Word Count</label>
              <select
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {WORD_COUNT_OPTIONS.map((wc) => (
                  <option key={wc} value={wc}>
                    ~{wc.toLocaleString()} words
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Keywords</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="comma-separated"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {/* Data Sources */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Data Sources</label>
            <input
              type="text"
              value={dataSources}
              onChange={(e) => setDataSources(e.target.value)}
              placeholder="comma-separated"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm({
                topic: `${title}. Key message: ${topic}`,
                keywords: keywords
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
                postType,
                tone,
                region,
                wordCount,
                dataSources: dataSources
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="px-5 py-2 text-sm font-bold text-white rounded-lg hover:shadow-lg transition-all"
            style={{ backgroundColor: '#e07850' }}
          >
            Generate with AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Topic Suggestion Modal ─────────────────────────────────────
function SuggestModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [region, setRegion] = useState<Region>('global');
  const [postType, setPostType] = useState('');
  const [count, setCount] = useState(5);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleSuggest = async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const result = await suggestTopics({ region, postType: postType || undefined, count });
      setSuggestions(result.suggestions || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (suggestion: TopicSuggestion, idx: number) => {
    try {
      await addCalendarPost({
        title: suggestion.title,
        region,
        keywords: suggestion.keywords,
        dataSources: suggestion.dataSources,
        primaryMessage: suggestion.primaryMessage,
        tone: suggestion.tone,
        postType: suggestion.postType,
      });
      setAddedIds((prev) => new Set(prev).add(idx));
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: '#2a3a2a' }}>
            AI Topic Ideas
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Controls */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as Region)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {ALL_REGIONS.filter((r) => r.value !== 'all').map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Any Type</option>
              <option value="standard">Blog Post</option>
              <option value="data_report">Data Report</option>
              <option value="case_study">Case Study</option>
              <option value="explainer">Explainer</option>
              <option value="education">Educational Guide</option>
            </select>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} ideas
                </option>
              ))}
            </select>
            <button
              onClick={handleSuggest}
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all hover:shadow-md"
              style={{ backgroundColor: '#2a3a2a' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Thinking...
                </span>
              ) : (
                'Suggest Topics'
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl p-4 transition-colors ${
                    addedIds.has(idx) ? 'bg-green-50 border-green-200' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: '#2a3a2a' }}>
                        {s.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{s.primaryMessage}</div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {TYPE_LABELS[s.postType] || s.postType}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {TONE_LABELS[s.tone] || s.tone}
                        </span>
                        {s.keywords.slice(0, 3).map((k) => (
                          <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(s, idx)}
                      disabled={addedIds.has(idx)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        addedIds.has(idx)
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-gray-900 text-white hover:bg-gray-700'
                      }`}
                    >
                      {addedIds.has(idx) ? 'Added' : 'Add to Calendar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && suggestions.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Select a region and click "Suggest Topics" to get AI-powered blog ideas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function ContentQueue() {
  const navigate = useNavigate();
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [generateModalPost, setGenerateModalPost] = useState<CalendarPost | null>(null);
  const [showSuggestModal, setShowSuggestModal] = useState(false);

  // Timer for generation progress
  useEffect(() => {
    if (!generatingId) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generatingId]);

  const loadCalendar = () => {
    fetchContentQueue()
      .then((data) => setCalendar(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalendar();
  }, []);

  const handleGenerate = async (
    post: CalendarPost,
    params: {
      topic: string;
      keywords: string[];
      postType: PostType;
      tone: Tone;
      region: Region;
      wordCount: number;
    }
  ) => {
    if (generatingId) return;
    setGenerateModalPost(null);
    setGeneratingId(post.id);
    setError(null);

    try {
      // Mark as generating
      await updateContentQueuePost(post.id, { status: 'generating' });
      setCalendar((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) => (p.id === post.id ? { ...p, status: 'generating' } : p)),
        };
      });

      // Generate with AI
      const result = await generateBlogPost(params);

      // Save as draft blog post
      const slug = generateSlug(result.title || post.title);
      await createPost({
        title: result.title || post.title,
        slug,
        category: result.category || 'Safety',
        tags: result.tags || params.keywords,
        metaTitle: result.metaTitle || result.title || post.title,
        metaDescription: result.metaDescription || post.primaryMessage,
        excerpt: result.excerpt || post.primaryMessage,
        date: post.targetDate,
        author: 'Streets & Commons',
        status: 'draft',
        content: result.content,
      });

      // Update calendar status
      await updateContentQueuePost(post.id, { status: 'generated', generatedSlug: slug });
      setCalendar((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === post.id ? { ...p, status: 'generated', generatedSlug: slug } : p
          ),
          tracking: {
            ...prev.tracking,
            totalGenerated: (prev.tracking.totalGenerated || 0) + 1,
          },
        };
      });

      navigate(`/admin/blog/edit/${slug}`);
    } catch (err) {
      await updateContentQueuePost(post.id, { status: 'failed' }).catch(() => {});
      setCalendar((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) => (p.id === post.id ? { ...p, status: 'failed' } : p)),
        };
      });
      setError(`Failed to generate "${post.title}": ${(err as Error).message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading content queue...</div>
      </div>
    );
  }

  if (!calendar || !calendar.posts.length) {
    return <div className="text-gray-500">No editorial calendar found.</div>;
  }

  const filteredPosts = calendar.posts.filter((p) => {
    if (filterRegion !== 'all' && p.region !== filterRegion) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: calendar.posts.length,
    pending: calendar.posts.filter((p) => p.status === 'pending').length,
    generated: calendar.posts.filter((p) => p.status === 'generated').length,
    published: calendar.posts.filter((p) => p.status === 'published').length,
  };

  // Region counts
  const regionCounts: Record<string, number> = {};
  for (const p of calendar.posts) {
    regionCounts[p.region] = (regionCounts[p.region] || 0) + 1;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
            Content Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {calendar.posts.length}-post editorial calendar. Generate with full control.
          </p>
        </div>
        <button
          onClick={() => setShowSuggestModal(true)}
          className="px-4 py-2 text-sm font-bold text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
          style={{ backgroundColor: '#2a3a2a' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Suggest Topics
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
            {stats.total}
          </div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Planned</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Ready to Generate</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.generated}</div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Generated (Drafts)</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-emerald-600">{stats.published}</div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Published</div>
        </div>
      </div>

      {/* Region distribution */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-6">
        {Object.entries(REGION_LABELS).map(([key, label]) => {
          const count = regionCounts[key] || 0;
          const styles = REGION_CARD_STYLES[key] || REGION_CARD_STYLES.global;
          return (
            <button
              key={key}
              onClick={() => setFilterRegion(filterRegion === key ? 'all' : key)}
              className={`rounded-xl p-2.5 border text-center transition-all cursor-pointer ${styles.bg} ${styles.border} ${
                filterRegion === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''
              }`}
            >
              <div className={`text-lg font-bold ${styles.text}`}>{count}</div>
              <div className={`text-xs ${styles.label} truncate`}>{label}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          {ALL_REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="generating">Generating</option>
          <option value="generated">Generated</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
        <div className="ml-auto text-sm text-gray-400 self-center">
          {filteredPosts.length} of {calendar.posts.length} posts
        </div>
      </div>

      {/* Generating banner */}
      {generatingId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800 flex items-center gap-3">
          <svg className="animate-spin h-4 w-4 text-amber-600 flex-shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>
            <strong>Generating post with Claude AI...</strong> This takes 60-90 seconds. Don't navigate away.
            <span className="ml-2 font-mono text-amber-600">{elapsedSeconds}s elapsed</span>
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Posts table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-6">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Region</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-20">Tone</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map((post) => (
              <tr
                key={post.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  generatingId === post.id ? 'bg-yellow-50' : ''
                }`}
              >
                <td className="px-4 py-3 text-gray-400">{post.id}</td>
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: '#2a3a2a' }}>
                    {post.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{post.keywords.join(', ')}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      REGION_COLORS[post.region] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {REGION_LABELS[post.region] || post.region}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{TYPE_LABELS[post.postType] || post.postType}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{TONE_LABELS[post.tone] || post.tone}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{post.targetDate || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[post.status] || STATUS_STYLES.pending
                    }`}
                  >
                    {post.status === 'generating' ? 'Generating...' : post.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {post.status === 'pending' || post.status === 'failed' ? (
                    <button
                      onClick={() => setGenerateModalPost(post)}
                      disabled={generatingId !== null}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 transition-all hover:shadow-md"
                      style={{ backgroundColor: generatingId !== null ? '#9ca3af' : '#e07850' }}
                    >
                      {generatingId === post.id ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {elapsedSeconds}s...
                        </span>
                      ) : (
                        'Generate'
                      )}
                    </button>
                  ) : post.status === 'generated' && post.generatedSlug ? (
                    <button
                      onClick={() => navigate(`/admin/blog/edit/${post.generatedSlug}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                    >
                      Edit Draft
                    </button>
                  ) : post.status === 'published' && post.generatedSlug ? (
                    <a
                      href={`/blog/${post.generatedSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-block"
                    >
                      View
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12 text-gray-400">No posts match the current filters.</div>
        )}
      </div>

      {/* Pre-generation modal */}
      {generateModalPost && (
        <GenerateModal
          post={generateModalPost}
          onClose={() => setGenerateModalPost(null)}
          onConfirm={(params) => handleGenerate(generateModalPost, params)}
        />
      )}

      {/* Topic suggestion modal */}
      {showSuggestModal && (
        <SuggestModal
          onClose={() => setShowSuggestModal(false)}
          onAdded={() => loadCalendar()}
        />
      )}
    </div>
  );
}
