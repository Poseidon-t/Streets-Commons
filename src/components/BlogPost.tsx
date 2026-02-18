/**
 * Individual blog post page (fetched from API)
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { getBlogPostBySlug, BLOG_POSTS, type BlogPost as BlogPostType } from '../data/blogPosts';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PostMeta {
  slug: string;
  title: string;
  category: string;
  readTime: string;
}

export default function BlogPost() {
  const { postSlug } = useParams<{ postSlug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postSlug) { setNotFound(true); setLoading(false); return; }

    // Fetch post from API, fall back to static data
    fetch(`${API_URL}/api/blog/posts/${postSlug}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => setPost(data))
      .catch(() => {
        const staticPost = getBlogPostBySlug(postSlug);
        if (staticPost) setPost(staticPost);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));

    // Fetch related posts list
    fetch(`${API_URL}/api/blog/posts`)
      .then(res => res.ok ? res.json() : [])
      .then(posts => setRelatedPosts(posts.filter((p: PostMeta) => p.slug !== postSlug).slice(0, 3)))
      .catch(() => {
        setRelatedPosts(
          BLOG_POSTS.filter(p => p.slug !== postSlug)
            .slice(0, 3)
            .map(({ slug, title, category, readTime }) => ({ slug, title, category, readTime }))
        );
      });
  }, [postSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
        <div className="text-gray-400">Loading post...</div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
        <div className="text-center px-6">
          <h1 className="text-6xl font-bold mb-4" style={{ color: '#2a3a2a' }}>404</h1>
          <p className="text-xl mb-6" style={{ color: '#5a6a5a' }}>Post not found</p>
          <Link to="/blog" className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg" style={{ backgroundColor: '#e07850' }}>
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  // Sort related posts — prefer same category
  const sortedRelated = [...relatedPosts].sort((a, b) => {
    const aMatch = a.category === post.category ? 1 : 0;
    const bMatch = b.category === post.category ? 1 : 0;
    return bMatch - aMatch;
  }).slice(0, 3);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
      {/* SEO Meta */}
      <title>{post.metaTitle}</title>
      <meta name="description" content={post.metaDescription} />
      <link rel="canonical" href={`https://safestreets.streetsandcommons.com/blog/${post.slug}`} />

      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:url" content={`https://safestreets.streetsandcommons.com/blog/${post.slug}`} />
      <meta property="og:site_name" content="SafeStreets by Streets & Commons" />
      <meta property="og:title" content={post.metaTitle} />
      <meta property="og:description" content={post.metaDescription} />
      <meta property="og:image" content="https://safestreets.streetsandcommons.com/og-image.png" />
      <meta property="article:published_time" content={post.date} />
      <meta property="article:author" content={post.author} />
      <meta property="article:section" content={post.category} />
      <meta property="article:tag" content={post.tags[0]} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={post.metaTitle} />
      <meta name="twitter:description" content={post.metaDescription} />
      <meta name="twitter:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* JSON-LD Article */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.metaDescription,
        "datePublished": post.date,
        "author": { "@type": "Organization", "name": "Streets & Commons" },
        "publisher": {
          "@type": "Organization",
          "name": "SafeStreets",
          "url": "https://safestreets.streetsandcommons.com"
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": `https://safestreets.streetsandcommons.com/blog/${post.slug}`
        },
        "articleSection": post.category,
        "keywords": post.tags.join(', ')
      }) }} />

      {/* JSON-LD BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://safestreets.streetsandcommons.com" },
          { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://safestreets.streetsandcommons.com/blog" },
          { "@type": "ListItem", "position": 3, "name": post.title }
        ]
      }) }} />

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
            <Link to="/blog" className="text-sm font-medium" style={{ color: '#5a6a5a' }}>Blog</Link>
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

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 pt-12 pb-16">
        {/* Breadcrumb */}
        <nav className="text-sm mb-6" style={{ color: '#8a9a8a' }}>
          <Link to="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          {document.referrer.includes('/learn') ? (
            <Link to="/learn" className="hover:underline">Learn</Link>
          ) : (
            <Link to="/blog" className="hover:underline">Blog</Link>
          )}
          <span className="mx-2">/</span>
          <span style={{ color: '#5a6a5a' }}>{post.title}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#e07850', color: 'white' }}
            >
              {post.category}
            </span>
            <span className="text-xs" style={{ color: '#8a9a8a' }}>{post.readTime}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight" style={{ color: '#2a3a2a' }}>
            {post.title}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: '#8a9a8a' }}>
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          </div>
        </div>

        {/* Content */}
        <div
          className="prose prose-lg max-w-none"
          style={{
            color: '#3a4a3a',
            lineHeight: 1.8,
          }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
        />

        {/* Tags */}
        <div className="mt-10 pt-6 border-t" style={{ borderColor: '#e0dbd0' }}>
          <div className="flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: '#f0ebe0', color: '#5a6a5a' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className="mt-10 rounded-2xl p-8 text-center border-2"
          style={{ borderColor: '#e07850', backgroundColor: 'rgba(224, 120, 80, 0.05)' }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
            Check Your Street's Walkability Score
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Free analysis using real satellite data. No sign-up required.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#e07850' }}
          >
            Get Your Free Score
          </Link>
        </div>

        {/* Related Posts */}
        {sortedRelated.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#2a3a2a' }}>More from the Blog</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedRelated.map(related => (
                <Link
                  key={related.slug}
                  to={`/blog/${related.slug}`}
                  className="rounded-xl p-4 border transition-all hover:shadow-md"
                  style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
                >
                  <span className="text-xs font-semibold" style={{ color: '#e07850' }}>{related.category}</span>
                  <h3 className="font-bold text-sm mt-1 mb-2" style={{ color: '#2a3a2a' }}>{related.title}</h3>
                  <p className="text-xs" style={{ color: '#8a9a8a' }}>{related.readTime}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ backgroundColor: '#2a3a2a' }}>
        <Link to="/" className="text-sm font-semibold" style={{ color: '#e07850' }}>SafeStreets</Link>
        <span className="text-xs mx-2" style={{ color: '#5a6a5a' }}>by</span>
        <span className="text-xs" style={{ color: '#8a9a8a' }}>Streets & Commons</span>
      </footer>
    </div>
  );
}
