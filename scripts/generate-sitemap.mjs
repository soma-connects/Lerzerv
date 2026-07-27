// Generates dist/sitemap.xml at build time: static routes + every published
// blog post (fetched from Supabase). Never fails the build — if the DB isn't
// reachable it just writes the static routes.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = 'https://lezerv.com';
const OUT = resolve('dist', 'sitemap.xml');

const staticRoutes = [
  ['', '1.0', 'daily'],
  ['services', '0.9', 'weekly'],
  ['find-artisans', '0.9', 'daily'],
  ['post-job', '0.8', 'weekly'],
  ['become-artisan', '0.8', 'monthly'],
  ['blog', '0.8', 'daily'],
  ['about', '0.6', 'monthly'],
  ['ambassador', '0.5', 'monthly'],
  ['careers', '0.5', 'monthly'],
  ['contact', '0.6', 'monthly'],
  ['track', '0.4', 'monthly'],
  ['terms', '0.3', 'yearly'],
  ['privacy', '0.3', 'yearly'],
];

// Read Supabase creds from the build env, falling back to a local .env file.
function getEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    if (existsSync('.env')) {
      const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='));
      if (line) return line.slice(name.length + 1).trim();
    }
  } catch { /* ignore */ }
  return undefined;
}

const today = new Date().toISOString().slice(0, 10);

async function fetchPosts() {
  const url = getEnv('VITE_SUPABASE_URL');
  const key = getEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !key) { console.warn('[sitemap] no Supabase env — static routes only'); return []; }
  try {
    const res = await fetch(`${url}/rest/v1/blog_posts?select=slug,updated_at&published=eq.true`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[sitemap] blog fetch failed — static routes only:', err.message);
    return [];
  }
}

function urlEntry(loc, lastmod, priority, changefreq) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const posts = await fetchPosts();

const entries = [
  ...staticRoutes.map(([path, prio, freq]) => urlEntry(`${SITE}/${path}`, today, prio, freq)),
  ...posts.map((p) => urlEntry(`${SITE}/blog/${p.slug}`, (p.updated_at || today).slice(0, 10), '0.7', 'weekly')),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

try {
  writeFileSync(OUT, xml);
  console.log(`[sitemap] wrote ${OUT} — ${staticRoutes.length} pages + ${posts.length} blog posts`);
} catch (err) {
  console.warn('[sitemap] could not write dist/sitemap.xml:', err.message);
}
