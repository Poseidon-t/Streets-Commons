export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  snippet: string;
  author: string;
  created: number;
  matchedKeywords: string[];
  tier: 1 | 2;
  relevance: number;
  isQuestion: boolean;
  status: 'new' | 'dismissed' | 'engaged';
}

const SUBREDDIT_COLORS: Record<string, string> = {
  'r/FirstTimeHomeBuyer': '#b35a14',
  'r/realestate':         '#1a52a8',
  'r/homebuying':         '#2d5e53',
  'r/moving':             '#6b2da8',
  'r/renting':            '#7c3d8a',
  'r/ApartmentHunting':   '#a0522d',
  'r/urbanplanning':      '#2d5e53',
  'r/walkable_cities':    '#1a7a4a',
  'r/walkablecities':     '#1a7a4a',
  'r/WalkableStreets':    '#1a7a4a',
  'r/carfree':            '#2a6496',
  'r/VisionZero':         '#c0392b',
  'r/streetdesign':       '#5d4e37',
  'r/urbandesign':        '#3d5a80',
  'r/Urbanism':           '#4a5568',
  'r/SuburbanHell':       '#744210',
  'r/UrbanHell':          '#742a2a',
  'r/strongtowns':        '#2c5282',
  'r/yimby':              '#276749',
  'r/transit':            '#1a365d',
  'r/SameGrassButGreener':'#2d6a4f',
  'r/CityComparisons':    '#553c9a',
  'r/digitalnomad':       '#2b6cb0',
};

export function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSec);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function RelevanceBadge({ score }: { score: number }) {
  const display = Math.min(10, score);
  const cls = display >= 7
    ? 'bg-green-50 text-green-700 border-green-200'
    : display >= 4
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <span className={`font-mono text-xs px-2 py-0.5 rounded-md border font-bold ${cls}`}>
      {display}/10
    </span>
  );
}

function TierBadge({ tier }: { tier: 1 | 2 }) {
  return tier === 1
    ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">T1 Direct</span>
    : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">T2</span>;
}

interface Props {
  post: RedditPost;
  onUpdateStatus: (id: string, status: RedditPost['status']) => void;
}

export default function RedditPostCard({ post, onUpdateStatus }: Props) {
  const color = SUBREDDIT_COLORS[post.subreddit] || '#555555';
  const cardBorder =
    post.status === 'engaged'   ? 'border-green-200 bg-green-50/20' :
    post.status === 'dismissed' ? 'border-gray-100 opacity-50' :
    'border-orange-100 shadow-sm';

  return (
    <div className={`bg-white rounded-xl border transition-all ${cardBorder}`}>
      <div className="p-4">
        {/* Top row: meta */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: color + '18', color }}
          >
            {post.subreddit}
          </span>
          <TierBadge tier={post.tier} />
          <RelevanceBadge score={post.relevance} />
          {post.isQuestion && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Question</span>
          )}
          {post.status === 'engaged' && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Engaged</span>
          )}
          <span className="text-xs text-gray-400 ml-auto font-mono">{timeAgo(post.created)}</span>
          <span className="text-xs text-gray-400 font-mono">u/{post.author}</span>
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
          <p className="text-xs text-gray-500 line-clamp-3 mb-2.5 leading-relaxed">{post.snippet}</p>
        )}

        {/* Matched keywords */}
        {post.matchedKeywords.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {post.matchedKeywords.map(kw => (
              <span key={kw} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-mono">
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => post.status === 'new' && onUpdateStatus(post.id, 'engaged')}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors"
            style={{ backgroundColor: '#e07850' }}
          >
            Reply on Reddit ↗
          </a>
          {post.status !== 'engaged' && (
            <button
              onClick={() => onUpdateStatus(post.id, 'engaged')}
              className="text-xs px-3 py-1.5 border border-green-300 text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors"
            >
              Mark Engaged
            </button>
          )}
          {post.status === 'dismissed' ? (
            <button
              onClick={() => onUpdateStatus(post.id, 'new')}
              className="text-xs px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={() => onUpdateStatus(post.id, 'dismissed')}
              className="text-xs px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 transition-colors ml-auto"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
