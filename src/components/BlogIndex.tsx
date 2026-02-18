/**
 * Blog index page — lists all blog posts (fetched from API)
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BLOG_POSTS } from '../data/blogPosts';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PostMeta {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  date: string;
  author: string;
  category: string;
  readTime: string;
  excerpt: string;
  tags: string[];
}

export default function BlogIndex() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    fetch(`${API_URL}/api/blog/posts`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setPosts(data))
      .catch(() => {
        // Fallback to static data
        setPosts(BLOG_POSTS.map(({ content, ...meta }) => meta));
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(posts.map(p => p.category)));
    return ['All', ...cats];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const sorted = [...posts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (activeCategory === 'All') return sorted;
    return sorted.filter(p => p.category === activeCategory);
  }, [posts, activeCategory]);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
      <title>SafeStreets Blog — Walkability Analysis, Urban Planning & Advocacy</title>
      <meta name="description" content="Articles on walkability, urban planning, pedestrian safety, and street advocacy. Learn how satellite data is changing how we understand and improve our streets." />
      <link rel="canonical" href="https://safestreets.streetsandcommons.com/blog" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://safestreets.streetsandcommons.com/blog" />
      <meta property="og:site_name" content="SafeStreets by Streets & Commons" />
      <meta property="og:title" content="SafeStreets Blog — Walkability Analysis, Urban Planning & Advocacy" />
      <meta property="og:description" content="Articles on walkability, urban planning, pedestrian safety, and street advocacy. Learn how satellite data is changing how we understand and improve our streets." />
      <meta property="og:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="SafeStreets Blog — Walkability Analysis & Urban Planning" />
      <meta name="twitter:description" content="Articles on walkability, pedestrian safety, and street advocacy. Powered by satellite data." />
      <meta name="twitter:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* JSON-LD CollectionPage */}
      {posts.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "SafeStreets Blog",
          "description": "Articles on walkability, urban planning, pedestrian safety, and street advocacy.",
          "url": "https://safestreets.streetsandcommons.com/blog",
          "publisher": {
            "@type": "Organization",
            "name": "SafeStreets",
            "url": "https://safestreets.streetsandcommons.com"
          },
          "mainEntity": {
            "@type": "ItemList",
            "itemListElement": posts.map((post, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "url": `https://safestreets.streetsandcommons.com/blog/${post.slug}`,
              "name": post.title
            }))
          }
        }) }} />
      )}

      {/* Header */}
      <header className="border-b" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 44 44">
              <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850"/>
              <rect x="10" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="19" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="28" y="14" width="6" height="16" fill="white" rx="1"/>
            </svg>
            <span className="text-xl font-bold" style={{ color: '#e07850' }}>SafeStreets</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/learn" className="text-sm font-medium" style={{ color: '#5a6a5a' }}>Learn</Link>
            <Link
              to="/"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:shadow-md text-white"
              style={{ backgroundColor: '#e07850' }}
            >
              Analyze Any Address
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
          SafeStreets Blog
        </h1>
        <p className="text-lg" style={{ color: '#5a6a5a' }}>
          Walkability analysis, urban planning insights, and advocacy guides.
        </p>
      </section>

      {/* Category Filter */}
      {!loading && (
        <section className="max-w-3xl mx-auto px-6 pb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="text-sm px-4 py-2.5 rounded-full font-medium transition-all cursor-pointer border-none"
                style={{
                  backgroundColor: activeCategory === cat ? '#e07850' : '#f0ebe0',
                  color: activeCategory === cat ? 'white' : '#5a6a5a',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Post List */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading posts...</div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map(post => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="block rounded-xl p-6 border transition-all hover:shadow-md"
                style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: '#e07850', color: 'white' }}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs" style={{ color: '#8a9a8a' }}>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span className="text-xs" style={{ color: '#8a9a8a' }}>{post.readTime}</span>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: '#2a3a2a' }}>
                  {post.title}
                </h2>
                <p className="text-sm" style={{ color: '#5a6a5a' }}>
                  {post.excerpt}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f0ebe0', color: '#8a9a8a' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-12">
        <div
          className="rounded-2xl p-8 text-center border-2"
          style={{ borderColor: '#e07850', backgroundColor: 'rgba(224, 120, 80, 0.05)' }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
            Ready to Analyze Your Street?
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Free walkability score for any address. No sign-up required.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#e07850' }}
          >
            Get Your Free Walkability Score
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ backgroundColor: '#2a3a2a' }}>
        <Link to="/" className="text-sm font-semibold" style={{ color: '#e07850' }}>SafeStreets</Link>
        <span className="text-xs mx-2" style={{ color: '#5a6a5a' }}>by</span>
        <span className="text-xs" style={{ color: '#8a9a8a' }}>Streets & Commons</span>
      </footer>
    </div>
  );
}
