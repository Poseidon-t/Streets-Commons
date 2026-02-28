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
export type Region = 'global' | 'europe' | 'north_america' | 'india' | 'asia' | 'south_america' | 'africa' | 'oceania';
export type PostType = 'standard' | 'data_report' | 'case_study' | 'explainer' | 'education';
export type Tone = 'informed_advocate' | 'urgent' | 'hopeful' | 'analytical';

export const generateBlogPost = (params: {
  topic: string;
  keywords?: string[];
  postType?: PostType;
  tone?: Tone;
  region?: Region;
  wordCount?: number;
}) =>
  adminFetch('/api/admin/blog/generate', { method: 'POST', body: JSON.stringify(params) });

// Content Queue (Editorial Calendar)
export const fetchContentQueue = () => adminFetch('/api/admin/content-queue');
export const updateContentQueuePost = (id: number, data: { status?: string; generatedSlug?: string }) =>
  adminFetch(`/api/admin/content-queue/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// AI Topic Suggestion
export const suggestTopics = (params: { region?: Region; postType?: string; count?: number }) =>
  adminFetch('/api/admin/content-queue/suggest', { method: 'POST', body: JSON.stringify(params) });

// Add post to editorial calendar
export const addCalendarPost = (data: {
  title: string;
  region?: Region;
  keywords?: string[];
  dataSources?: string[];
  primaryMessage?: string;
  tone?: Tone;
  postType?: PostType;
}) =>
  adminFetch('/api/admin/content-queue/add', { method: 'POST', body: JSON.stringify(data) });

// Emails
export const fetchEmails = () => adminFetch('/api/admin/emails');

// Sales Pipeline
export const fetchLeads = () => adminFetch('/api/admin/sales/leads');
export const updateLead = (rank: number, data: Record<string, unknown>) =>
  adminFetch(`/api/admin/sales/leads/${rank}`, { method: 'PUT', body: JSON.stringify(data) });
export const addLead = (data: Record<string, unknown>) =>
  adminFetch('/api/admin/sales/leads', { method: 'POST', body: JSON.stringify(data) });
export const searchAgents = (params: { city: string; state?: string; country?: string; neighborhoods?: string; count?: number }) =>
  adminFetch('/api/admin/sales/search', { method: 'POST', body: JSON.stringify(params) });
export const validateEmail = (email: string) =>
  adminFetch('/api/admin/sales/validate-email', { method: 'POST', body: JSON.stringify({ email }) });
export const generateReport = (params: { neighborhood: string; city: string; state: string; agentProfile: { name: string; company?: string; email?: string; phone?: string; title?: string } }) =>
  adminFetch('/api/admin/sales/generate-report', { method: 'POST', body: JSON.stringify(params) });
