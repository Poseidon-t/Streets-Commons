const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';
const API_URL = import.meta.env.VITE_API_URL || '';

async function adminFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Analytics
export const fetchStats = () => adminFetch('/api/admin/stats');

// Blog
export const fetchAdminPosts = () => adminFetch('/api/admin/blog/posts');
export const fetchAdminPost = (slug: string) => adminFetch(`/api/admin/blog/posts/${slug}`);
export const createPost = (data: Record<string, unknown>) =>
  adminFetch('/api/admin/blog/posts', { method: 'POST', body: JSON.stringify(data) });
export const updatePost = (slug: string, data: Record<string, unknown>) =>
  adminFetch(`/api/admin/blog/posts/${slug}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePost = (slug: string) =>
  adminFetch(`/api/admin/blog/posts/${slug}`, { method: 'DELETE' });

// AI Blog Generation
export const generateBlogPost = (params: {
  topic: string;
  keywords?: string[];
  postType?: 'standard' | 'data_report' | 'case_study' | 'explainer';
  tone?: 'informed_advocate' | 'urgent' | 'hopeful' | 'analytical';
  region?: 'global' | 'india' | 'us';
}) =>
  adminFetch('/api/admin/blog/generate', { method: 'POST', body: JSON.stringify(params) });

// Content Queue (Editorial Calendar)
export const fetchContentQueue = () => adminFetch('/api/admin/content-queue');
export const updateContentQueuePost = (id: number, data: { status?: string; generatedSlug?: string }) =>
  adminFetch(`/api/admin/content-queue/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Emails
export const fetchEmails = () => adminFetch('/api/admin/emails');
