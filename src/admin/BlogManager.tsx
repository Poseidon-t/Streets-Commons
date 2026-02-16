import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminPosts, deletePost } from './adminApi';

interface PostMeta {
  slug: string;
  title: string;
  status: string;
  category: string;
  date: string;
  updatedAt: string;
}

export default function BlogManager() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchAdminPosts();
      setPosts(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deletePost(slug);
      load();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>Blog Posts</h1>
        <Link
          to="/admin/blog/new"
          className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:shadow-md"
          style={{ backgroundColor: '#e07850' }}
        >
          New Post
        </Link>
      </div>

      {loading && <div className="text-gray-500">Loading posts...</div>}
      {error && <div className="text-red-500 mb-4">Error: {error}</div>}

      {!loading && posts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No blog posts yet. Create your first one!
        </div>
      )}

      {posts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.slug} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/blog/edit/${post.slug}`}
                      className="font-medium text-sm hover:underline"
                      style={{ color: '#2a3a2a' }}
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: post.status === 'published' ? '#e6f4ea' : '#fef3e2',
                        color: post.status === 'published' ? '#1e7e34' : '#b45309',
                      }}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{post.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/blog/edit/${post.slug}`}
                      className="text-sm font-medium mr-3 hover:underline"
                      style={{ color: '#5090b0' }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(post.slug, post.title)}
                      className="text-sm font-medium text-red-500 hover:text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
