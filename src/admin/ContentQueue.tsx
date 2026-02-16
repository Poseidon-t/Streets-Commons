import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchContentQueue, updateContentQueuePost, generateBlogPost, createPost } from './adminApi';

interface CalendarPost {
  id: number;
  title: string;
  region: 'global' | 'india' | 'us';
  targetDate: string;
  keywords: string[];
  dataSources: string[];
  primaryMessage: string;
  tone: 'informed_advocate' | 'urgent' | 'hopeful' | 'analytical';
  postType: 'standard' | 'data_report' | 'case_study' | 'explainer';
  status: string;
  generatedSlug?: string;
  updatedAt?: string;
}

interface Calendar {
  posts: CalendarPost[];
  metadata: { totalPosts: number; targetDistribution: Record<string, string> };
  tracking: { totalGenerated: number; totalPublished: number };
}

const REGION_LABELS: Record<string, string> = { global: 'Global', india: 'India', us: 'US' };
const REGION_COLORS: Record<string, string> = {
  global: 'bg-blue-100 text-blue-800',
  india: 'bg-orange-100 text-orange-800',
  us: 'bg-purple-100 text-purple-800',
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
};
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  generating: 'bg-yellow-100 text-yellow-800',
  generated: 'bg-green-100 text-green-800',
  published: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default function ContentQueue() {
  const navigate = useNavigate();
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Timer for generation progress
  useEffect(() => {
    if (!generatingId) { setElapsedSeconds(0); return; }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generatingId]);

  useEffect(() => {
    fetchContentQueue()
      .then((data) => setCalendar(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async (post: CalendarPost) => {
    if (generatingId) return;
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

      // Generate with AI — topic is the title + primary message for context
      const result = await generateBlogPost({
        topic: `${post.title}. Key message: ${post.primaryMessage}`,
        keywords: post.keywords,
        postType: post.postType,
        tone: post.tone,
        region: post.region,
      });

      // Save as draft blog post
      const slug = generateSlug(result.title || post.title);
      await createPost({
        title: result.title || post.title,
        slug,
        category: result.category || 'Safety',
        tags: result.tags || post.keywords,
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

      // Navigate to editor to review
      navigate(`/admin/blog/edit/${slug}`);
    } catch (err) {
      // Mark as failed
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
    failed: calendar.posts.filter((p) => p.status === 'failed').length,
    global: calendar.posts.filter((p) => p.region === 'global').length,
    india: calendar.posts.filter((p) => p.region === 'india').length,
    us: calendar.posts.filter((p) => p.region === 'us').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
            Content Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            120-post editorial calendar. One click to generate any post.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>{stats.total}</div>
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
          <div className="text-lg font-bold text-blue-800">{stats.global}</div>
          <div className="text-xs text-blue-600">Global</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 text-center">
          <div className="text-lg font-bold text-orange-800">{stats.india}</div>
          <div className="text-xs text-orange-600">India</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
          <div className="text-lg font-bold text-purple-800">{stats.us}</div>
          <div className="text-xs text-purple-600">United States</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Regions</option>
          <option value="global">Global</option>
          <option value="india">India</option>
          <option value="us">US</option>
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-20">Region</th>
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
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {post.keywords.join(', ')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${REGION_COLORS[post.region]}`}>
                    {REGION_LABELS[post.region]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {TYPE_LABELS[post.postType] || post.postType}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {TONE_LABELS[post.tone] || post.tone}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {post.targetDate}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[post.status] || STATUS_STYLES.pending}`}>
                    {post.status === 'generating' ? 'Generating...' : post.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {post.status === 'pending' || post.status === 'failed' ? (
                    <button
                      onClick={() => handleGenerate(post)}
                      disabled={generatingId !== null}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 transition-all hover:shadow-md"
                      style={{ backgroundColor: generatingId !== null ? '#9ca3af' : '#e07850' }}
                    >
                      {generatingId === post.id ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
          <div className="text-center py-12 text-gray-400">
            No posts match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
