import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export type Region = 'global' | 'europe' | 'north_america' | 'india' | 'asia' | 'south_america' | 'africa' | 'oceania';
export type PostType = 'standard' | 'data_report' | 'case_study' | 'explainer' | 'education';
export type Tone = 'informed_advocate' | 'urgent' | 'hopeful' | 'analytical';

export function useAdminApi() {
  const { getToken } = useAuth();

  async function adminFetch(path: string, options: RequestInit = {}) {
    const token = await getToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  return {
    // Blog
    fetchAdminPosts: () => adminFetch('/api/admin/blog/posts'),
    fetchAdminPost: (slug: string) => adminFetch(`/api/admin/blog/posts/${slug}`),
    createPost: (data: Record<string, unknown>) =>
      adminFetch('/api/admin/blog/posts', { method: 'POST', body: JSON.stringify(data) }),
    updatePost: (slug: string, data: Record<string, unknown>) =>
      adminFetch(`/api/admin/blog/posts/${slug}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePost: (slug: string) =>
      adminFetch(`/api/admin/blog/posts/${slug}`, { method: 'DELETE' }),

    // AI Blog Generation
    generateBlogPost: (params: {
      topic: string;
      keywords?: string[];
      postType?: PostType;
      tone?: Tone;
      region?: Region;
      wordCount?: number;
    }) => adminFetch('/api/admin/blog/generate', { method: 'POST', body: JSON.stringify(params) }),

    // Content Queue
    fetchContentQueue: () => adminFetch('/api/admin/content-queue'),
    updateContentQueuePost: (id: number, data: { status?: string; generatedSlug?: string }) =>
      adminFetch(`/api/admin/content-queue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    suggestTopics: (params: { region?: Region; postType?: string; count?: number }) =>
      adminFetch('/api/admin/content-queue/suggest', { method: 'POST', body: JSON.stringify(params) }),
    addCalendarPost: (data: {
      title: string;
      region?: Region;
      keywords?: string[];
      dataSources?: string[];
      primaryMessage?: string;
      tone?: Tone;
      postType?: PostType;
    }) => adminFetch('/api/admin/content-queue/add', { method: 'POST', body: JSON.stringify(data) }),

    // Sales Pipeline
    fetchLeads: () => adminFetch('/api/admin/sales/leads'),
    updateLead: (rank: number, data: Record<string, unknown>) =>
      adminFetch(`/api/admin/sales/leads/${rank}`, { method: 'PUT', body: JSON.stringify(data) }),
    addLead: (data: Record<string, unknown>) =>
      adminFetch('/api/admin/sales/leads', { method: 'POST', body: JSON.stringify(data) }),
    searchAgents: (params: { city: string; state?: string; country?: string; neighborhoods?: string; count?: number }) =>
      adminFetch('/api/admin/sales/search', { method: 'POST', body: JSON.stringify(params) }),
    validateEmail: (email: string) =>
      adminFetch('/api/admin/sales/validate-email', { method: 'POST', body: JSON.stringify({ email }) }),
    generateReport: (params: { neighborhood: string; city: string; state: string; agentProfile: { name: string; company?: string; email?: string; phone?: string; title?: string } }) =>
      adminFetch('/api/admin/sales/generate-report', { method: 'POST', body: JSON.stringify(params) }),
    generateComparison: (params: { neighborhoods: Array<{ neighborhood: string; city: string; state: string }>; agentProfile: { name: string; company?: string; email?: string; phone?: string; title?: string } }) =>
      adminFetch('/api/admin/sales/generate-comparison', { method: 'POST', body: JSON.stringify(params) }),

    // Reddit Monitor
    fetchRedditPosts: () => adminFetch('/api/admin/reddit/posts'),
    refreshRedditPosts: () => adminFetch('/api/admin/reddit/refresh', { method: 'POST' }),
    dismissRedditPost: (id: string) =>
      adminFetch(`/api/admin/reddit/posts/${id}`, { method: 'DELETE' }),
    fetchRedditConfig: () => adminFetch('/api/admin/reddit/config'),
    updateRedditConfig: (config: { subreddits?: string[]; keywordsHigh?: string[]; keywordsMedium?: string[] }) =>
      adminFetch('/api/admin/reddit/config', { method: 'PUT', body: JSON.stringify(config) }),
    clearRedditPosts: () => adminFetch('/api/admin/reddit/clear', { method: 'POST' }),

  };
}
