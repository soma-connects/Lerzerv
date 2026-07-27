-- ═══════════════════════════════════════════════════════════════════
-- 0015_blog.sql
-- Events / news blog. Admins create posts; the public reads published ones.
-- Content is admin-authored HTML.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content text,                 -- admin-authored HTML
  cover_image_url text,
  author text not null default 'Lezerv Team',
  category text default 'Event',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists idx_blog_published on public.blog_posts(published, published_at desc);

drop trigger if exists trg_blog_updated on public.blog_posts;
create trigger trg_blog_updated before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

-- Public can read published posts; admins see & manage everything.
drop policy if exists "blog_select" on public.blog_posts;
create policy "blog_select" on public.blog_posts
  for select using (published = true or public.is_admin());

drop policy if exists "blog_write" on public.blog_posts;
create policy "blog_write" on public.blog_posts
  for all using (public.is_admin()) with check (public.is_admin());
