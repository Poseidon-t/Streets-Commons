/**
 * Learn index page — educational content organized by topic
 * Fetches blog posts with education categories and groups them by topic
 */

import { useState, useEffect } from 'react';
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

const EDUCATION_CATEGORIES = [
  'Street Design',
  'Walkability',
  'Global Standards',
  'Infrastructure Impact',
  'Urban Case Studies',
];

const LEARN_TOPICS = [
  {
    id: 'street-design',
    title: 'Street Design Fundamentals',
    description: 'How to analyze a street — lane width, sidewalk presence, crossing safety, speed design. Learn why certain designs feel safe or dangerous, and what human-scale infrastructure looks like.',
    category: 'Street Design',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
        <path d="M10 9h4" />
        <path d="M10 13h4" />
      </svg>
    ),
    color: '#e07850',
  },
  {
    id: 'walkability',
    title: 'Walkability Principles',
    description: 'Jan Gehl\'s criteria of Protection, Comfort, and Enjoyment. The 15-minute city concept, active frontages, "eyes on the street," and why pedestrian desire lines matter more than engineered paths.',
    category: 'Walkability',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2" />
        <path d="M10 22l1-7" />
        <path d="M14 22l-1-7" />
        <path d="M8 12l4-2 4 2" />
        <path d="M12 10v5" />
      </svg>
    ),
    color: '#2d8a5e',
  },
  {
    id: 'global-standards',
    title: 'Global Standards & Frameworks',
    description: 'NACTO guidelines for crosswalk design and sidewalk widths. Vision Zero principles. WHO safe streets guidance. ADA accessibility standards. The frameworks that define safe, equitable streets.',
    category: 'Global Standards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a15 15 0 0 1 0 18" />
        <path d="M12 3a15 15 0 0 0 0 18" />
        <path d="M3 12h18" />
      </svg>
    ),
    color: '#3b72c4',
  },
  {
    id: 'infrastructure-impact',
    title: 'Understanding Infrastructure Impact',
    description: 'How street design affects property values and local economies. Safety data and crash patterns. The equity question: who benefits and who is harmed by infrastructure choices.',
    category: 'Infrastructure Impact',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 17l4-8 4 4 5-9" />
      </svg>
    ),
    color: '#8b5cf6',
  },
  {
    id: 'case-studies',
    title: 'Case Studies',
    description: 'Before-and-after transformations: Barcelona\'s superblocks, Seoul\'s Cheonggyecheon highway removal. What works in pedestrian infrastructure globally — and what fails in car-dependent suburban design.',
    category: 'Urban Case Studies',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    color: '#d97706',
  },
];

export default function LearnIndex() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/blog/posts`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setPosts(data.filter((p: PostMeta) => EDUCATION_CATEGORIES.includes(p.category))))
      .catch(() => {
        setPosts(
          BLOG_POSTS
            .filter(p => EDUCATION_CATEGORIES.includes(p.category))
            .map(({ content, ...meta }) => meta)
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const getPostsForTopic = (category: string) =>
    posts
      .filter(p => p.category === category)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
      <title>Learn to Read Streets — SafeStreets Educational Resources</title>
      <meta name="description" content="Free educational resources on walkability, street design, and urban planning. Learn to recognize safe infrastructure and understand how streets affect communities." />
      <link rel="canonical" href="https://safestreets.streetsandcommons.com/learn" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://safestreets.streetsandcommons.com/learn" />
      <meta property="og:site_name" content="SafeStreets by Streets & Commons" />
      <meta property="og:title" content="Learn to Read Streets — SafeStreets Educational Resources" />
      <meta property="og:description" content="Free educational resources on walkability, street design, and urban planning. Learn to recognize safe infrastructure." />
      <meta property="og:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Learn to Read Streets — SafeStreets Education" />
      <meta name="twitter:description" content="Educational resources on walkability, street design, and urban planning." />
      <meta name="twitter:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Learn to Read Streets",
        "description": "Educational resources on walkability, street design, and urban planning.",
        "url": "https://safestreets.streetsandcommons.com/learn",
        "publisher": {
          "@type": "Organization",
          "name": "SafeStreets",
          "url": "https://safestreets.streetsandcommons.com"
        },
        "about": [
          { "@type": "Thing", "name": "Street Design" },
          { "@type": "Thing", "name": "Walkability" },
          { "@type": "Thing", "name": "Pedestrian Safety" },
          { "@type": "Thing", "name": "Urban Planning" }
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
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#2a3a2a' }}>
          Learn to Read Streets
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: '#5a6a5a' }}>
          Understand what makes streets safe or dangerous. Learn to see the design choices that shape walkability,
          recognize good infrastructure, and know what to advocate for in your neighborhood.
        </p>
      </section>

      {/* Topic Sections */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading resources...</div>
        ) : (
          <div className="space-y-14">
            {LEARN_TOPICS.filter(topic => getPostsForTopic(topic.category).length > 0).map(topic => {
              const topicPosts = getPostsForTopic(topic.category);
              return (
                <div key={topic.id}>
                  {/* Topic Header */}
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className="learn-topic-icon"
                      style={{ backgroundColor: topic.color }}
                    >
                      {topic.icon}
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
                      {topic.title}
                    </h2>
                  </div>
                  <p className="text-sm mb-6 ml-16" style={{ color: '#5a6a5a' }}>
                    {topic.description}
                  </p>

                  <div className="flex flex-col gap-3 ml-0 sm:ml-16">
                    {topicPosts.map(post => (
                      <Link
                        key={post.slug}
                        to={`/blog/${post.slug}`}
                        className="flex items-center gap-4 rounded-xl px-5 py-4 border transition-all hover:shadow-md group"
                        style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
                      >
                        <div
                          className="hidden sm:block w-1 self-stretch rounded-full flex-shrink-0"
                          style={{ backgroundColor: topic.color, opacity: 0.5 }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-bold leading-snug group-hover:underline" style={{ color: '#2a3a2a' }}>
                              {post.title}
                            </h3>
                            <span
                              className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: topic.color, color: 'white' }}
                            >
                              {post.category}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-1" style={{ color: '#6b7a6b' }}>
                            {post.excerpt}
                          </p>
                        </div>
                        <span className="text-xs flex-shrink-0 whitespace-nowrap" style={{ color: '#8a9a8a' }}>
                          {post.readTime}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cross-link to Blog */}
      <section className="max-w-3xl mx-auto px-6 pb-8">
        <div className="text-center">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:underline"
            style={{ color: '#e07850' }}
          >
            Browse all blog posts
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
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
