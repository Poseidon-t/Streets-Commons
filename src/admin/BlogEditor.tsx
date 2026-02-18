import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { fetchAdminPost, createPost, updatePost, generateBlogPost, type Region } from './adminApi';

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const CATEGORIES = ['Safety', 'Real Estate', 'Guide', 'Advocacy', 'Technology', 'Urban Design', 'Street Design', 'Walkability', 'Global Standards', 'Infrastructure Impact', 'Urban Case Studies', 'General'];

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const addImage = useCallback(() => {
    const url = window.prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt('Link URL:', 'https://');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <div className="w-px bg-gray-300 mx-1" />
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>
      <div className="w-px bg-gray-300 mx-1" />
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        &bull; List
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        &ldquo;
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        {'</>'}
      </ToolbarButton>
      <div className="w-px bg-gray-300 mx-1" />
      <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Insert Link">
        Link
      </ToolbarButton>
      <ToolbarButton onClick={addImage} title="Insert Image">
        Image
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        &mdash;
      </ToolbarButton>
    </div>
  );
}

// ─── AI Generate Panel ─────────────────────────
function AIGeneratePanel({
  onGenerated,
  onClose,
}: {
  onGenerated: (data: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    excerpt: string;
    category: string;
    tags: string[];
    content: string;
  }) => void;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [postType, setPostType] = useState<'standard' | 'data_report' | 'case_study' | 'explainer'>('standard');
  const [tone, setTone] = useState<'informed_advocate' | 'urgent' | 'hopeful' | 'analytical'>('informed_advocate');
  const [region, setRegion] = useState<Region>('global');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateBlogPost({
        topic: topic.trim(),
        keywords: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        postType,
        tone,
        region,
      });
      onGenerated(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">&#9889;</span>
          <h2 className="text-lg font-bold" style={{ color: '#2a3a2a' }}>
            AI Content Generator
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Generate a full SEO-optimized blog post from a topic. Uses your content strategy templates, data sources, and editorial guidelines.
      </p>

      {/* Topic */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
          Topic / Title Idea *
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder='e.g. "Why Vision Zero Works: Lessons from Sweden" or "Pedestrian safety in Mumbai"'
        />
      </div>

      {/* Keywords */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
          Target SEO Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="Vision Zero, Sweden, pedestrian safety, road safety"
        />
      </div>

      {/* Options row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Post Type</label>
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value as typeof postType)}
            className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          >
            <option value="standard">Standard Blog Post</option>
            <option value="data_report">Data Report</option>
            <option value="case_study">Case Study</option>
            <option value="explainer">Explainer</option>
            <option value="education">Educational Guide</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as typeof tone)}
            className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          >
            <option value="informed_advocate">Informed Advocate</option>
            <option value="urgent">Urgent</option>
            <option value="hopeful">Hopeful</option>
            <option value="analytical">Analytical</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as typeof region)}
            className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          >
            <option value="global">Global</option>
            <option value="europe">Europe</option>
            <option value="north_america">North America</option>
            <option value="india">India</option>
            <option value="asia">Asia</option>
            <option value="south_america">South America</option>
            <option value="africa">Africa</option>
            <option value="oceania">Oceania</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating || !topic.trim()}
        className="w-full px-4 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-all hover:shadow-md"
        style={{ backgroundColor: generating ? '#9ca3af' : '#e07850' }}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating with Claude... (30-60 seconds)
          </span>
        ) : (
          'Generate Blog Post'
        )}
      </button>
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────
export default function BlogEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);

  const [meta, setMeta] = useState({
    title: '',
    slug: '',
    category: 'General',
    tags: '',
    metaTitle: '',
    metaDescription: '',
    excerpt: '',
    date: new Date().toISOString().split('T')[0],
    author: 'Streets & Commons',
    status: 'draft' as 'draft' | 'published',
  });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: 'Start writing your post...' }),
    ],
    content: '',
  });

  // Load existing post for edit mode
  useEffect(() => {
    if (slug && editor) {
      fetchAdminPost(slug)
        .then((post) => {
          setMeta({
            title: post.title,
            slug: post.slug,
            category: post.category,
            tags: (post.tags || []).join(', '),
            metaTitle: post.metaTitle || '',
            metaDescription: post.metaDescription || '',
            excerpt: post.excerpt || '',
            date: post.date,
            author: post.author || 'Streets & Commons',
            status: post.status || 'draft',
          });
          editor.commands.setContent(post.content || '');
        })
        .catch((err) => setLoadError(err.message));
    }
  }, [slug, editor]);

  const handleTitleChange = (title: string) => {
    setMeta((prev) => ({
      ...prev,
      title,
      slug: isEditing ? prev.slug : generateSlug(title),
    }));
  };

  const handleAIGenerated = (data: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    excerpt: string;
    category: string;
    tags: string[];
    content: string;
  }) => {
    if (!editor) return;

    setMeta((prev) => ({
      ...prev,
      title: data.title,
      slug: generateSlug(data.title),
      category: CATEGORIES.includes(data.category) ? data.category : prev.category,
      tags: (data.tags || []).join(', '),
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || '',
      excerpt: data.excerpt || '',
    }));

    editor.commands.setContent(data.content);
    setShowAIPanel(false);
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!editor) return;
    if (!meta.title.trim()) {
      alert('Title is required');
      return;
    }
    setSaving(true);
    const data = {
      ...meta,
      status,
      tags: meta.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      content: editor.getHTML(),
    };
    try {
      if (isEditing) {
        await updatePost(slug!, data);
      } else {
        await createPost(data);
      }
      navigate('/admin/blog');
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="text-red-500">
        Failed to load post: {loadError}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
          {isEditing ? 'Edit Post' : 'New Post'}
        </h1>
        <div className="flex gap-2">
          {!isEditing && (
            <button
              onClick={() => setShowAIPanel(!showAIPanel)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-md"
              style={{
                backgroundColor: showAIPanel ? '#f97316' : '#fff7ed',
                color: showAIPanel ? 'white' : '#ea580c',
                border: showAIPanel ? 'none' : '1px solid #fed7aa',
              }}
            >
              &#9889; AI Generate
            </button>
          )}
          <button
            onClick={() => navigate('/admin/blog')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#e07850' }}
          >
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* AI Generate Panel */}
      {showAIPanel && (
        <AIGeneratePanel
          onGenerated={handleAIGenerated}
          onClose={() => setShowAIPanel(false)}
        />
      )}

      {/* Metadata form */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
            <input
              type="text"
              value={meta.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Post title"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Slug</label>
            <input
              type="text"
              value={meta.slug}
              onChange={(e) => setMeta((p) => ({ ...p, slug: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="url-slug"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
            <select
              value={meta.category}
              onChange={(e) => setMeta((p) => ({ ...p, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={meta.tags}
              onChange={(e) => setMeta((p) => ({ ...p, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="walkability, urban planning, safety"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
            <input
              type="date"
              value={meta.date}
              onChange={(e) => setMeta((p) => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Excerpt</label>
            <textarea
              value={meta.excerpt}
              onChange={(e) => setMeta((p) => ({ ...p, excerpt: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Brief summary for the blog index..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Meta Title (SEO)</label>
            <input
              type="text"
              value={meta.metaTitle}
              onChange={(e) => setMeta((p) => ({ ...p, metaTitle: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="SEO title (defaults to title)"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Meta Description (SEO)</label>
            <input
              type="text"
              value={meta.metaDescription}
              onChange={(e) => setMeta((p) => ({ ...p, metaDescription: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="SEO description"
            />
          </div>
        </div>
      </div>

      {/* TipTap Editor */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <EditorToolbar editor={editor} />
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  );
}
