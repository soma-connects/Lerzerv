import { supabase } from '../lib/supabase';

export interface IBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  author: string;
  category: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export const blogService = {
  /** Published posts, newest first (public). */
  listPublished: async (): Promise<IBlogPost[]> => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false });
    if (error) { console.warn('blog list failed:', error); return []; }
    return (data || []) as IBlogPost[];
  },

  /** A single post by slug (published, or any if admin). */
  getBySlug: async (slug: string): Promise<IBlogPost | null> => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as IBlogPost;
  },

  // ── Admin ──────────────────────────────────────────────
  adminList: async (): Promise<IBlogPost[]> => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('blog admin list failed:', error); return []; }
    return (data || []) as IBlogPost[];
  },

  /** Create or update a post (admin). Sets published_at when first published. */
  save: async (post: Partial<IBlogPost>): Promise<{ ok: boolean; error?: string }> => {
    const row: Record<string, any> = {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? null,
      content: post.content ?? null,
      cover_image_url: post.cover_image_url ?? null,
      author: post.author || 'Lezerv Team',
      category: post.category || 'Event',
      published: !!post.published,
    };
    if (post.published && !post.published_at) row.published_at = new Date().toISOString();
    if (post.id) row.id = post.id;

    const { error } = await supabase.from('blog_posts').upsert(row);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  remove: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    return !error;
  },
};
