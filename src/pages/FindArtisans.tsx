import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { BadgeCheck, ClipboardList, Loader2, MapPin, MessagesSquare, Search, Star, KeyRound, HandCoins } from 'lucide-react';
import { LinkButton } from '../components/ui/LinkButton';
import { artisanService } from '../services/artisanService';
import { useSEO } from '../hooks/useSEO';
import { useRegion } from '../contexts/LocationContext';
import type { IServiceCategory } from '../types/marketplace';
import './FindArtisans.css';

/** One row from browse_artisans (migration 0009). */
interface BrowseRow {
  id: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  years_experience: number | null;
  is_verified: boolean;
  avg_rating: number;
  total_reviews: number;
  completed_jobs: number;
  categories: string[];
  areas: string[];
}

type Sort = 'best' | 'jobs' | 'price';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;
const TITLES = new Set(['mr', 'mrs', 'miss', 'ms', 'dr', 'engr', 'eng', 'chief', 'alhaji', 'alhaja', 'pastor', 'prince', 'princess', 'sir', 'madam', 'mama', 'baba', 'hon', 'barr', 'prof', 'arc', 'oga', 'deaconess', 'deacon', 'evang', 'rev']);
/** "Mrs Taiwo Amu" -> "Taiwo", "OLADIMEJI ADE" -> "Oladimeji": titles skipped, shouting calmed. */
const firstName = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean);
  const w = words.find((x) => !TITLES.has(x.toLowerCase().replace(/\./g, ''))) ?? words[0] ?? '';
  return w === w.toUpperCase() && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w;
};
const initials = (name: string) => {
  const words = name.split(/\s+/).filter((x) => x && !TITLES.has(x.toLowerCase().replace(/\./g, '')));
  return (words.length ? words : name.split(/\s+/)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

const FindArtisans: React.FC = () => {
  const region = useRegion();
  const areas = region.areas;
  const [params, setParams] = useSearchParams();
  // The chosen service lives in the address (?category=plumbing), so links
  // from the menu, the home page and the back button all just work.
  const activeCat = params.get('category') || '';

  const [categories, setCategories] = useState<IServiceCategory[]>([]);
  const [activeArea, setActiveArea] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('best');
  // Results remember which search they answer, so "loading" is simply
  // "the results we have aren't for the current search yet".
  const [data, setData] = useState<{ key: string; rows: BrowseRow[]; prices: Record<string, { naira: number; suggested: boolean | null }> | null } | null>(null);
  const searchKey = `${activeArea}|${activeCat}`;
  const loading = data?.key !== searchKey;

  const areaName = (slug: string) => areas.find((a) => a.slug === slug)?.name || slug;
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name || '';
  const placeName = activeArea ? areaName(activeArea) : region.city;
  const catLabel = catName(activeCat);

  useSEO({
    title: `Find Verified ${catLabel || 'Artisans'} in ${placeName || 'Nigeria'} | Lezerv`,
    description: `Hire ID-verified ${(catLabel || 'artisans, cleaners and plumbers').toLowerCase()} in ${placeName || 'Lagos, Port Harcourt and Omoku'}. See each artisan's own prices and agree the price before work starts.`,
    keywords: `hire ${(catLabel || 'artisan').toLowerCase()} ${placeName || 'Nigeria'}, verified ${(catLabel || 'artisans').toLowerCase()} near me, home services ${placeName || 'Nigeria'}, lezerv`,
  });

  useEffect(() => {
    artisanService.fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = (await artisanService.browse(activeArea, activeCat)) as BrowseRow[];
      const prices = await artisanService.fromPrices(rows.map((r) => r.id), activeCat || undefined);
      if (alive) setData({ key: searchKey, rows, prices });
    })();
    return () => { alive = false; };
  }, [activeArea, activeCat, searchKey]);

  const pickCat = (slug: string) => {
    const next = new URLSearchParams(params);
    if (slug) next.set('category', slug); else next.delete('category');
    setParams(next, { replace: true });
  };

  // Artisans in the visitor's city (unless a particular area is picked),
  // matching the search box, in the chosen order.
  const shown = useMemo(() => {
    let rows = data?.rows ?? [];
    if (!activeArea && region.city) {
      const inCity = new Set(region.cityAreas.map((a) => a.slug));
      rows = rows.filter((a) => (a.areas || []).some((slug) => inCity.has(slug)));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((a) =>
        `${a.display_name} ${a.bio ?? ''} ${(a.categories || []).map(catName).join(' ')}`.toLowerCase().includes(q));
    }
    const price = (a: BrowseRow) => data?.prices?.[a.id]?.naira ?? Infinity;
    if (sort === 'jobs') rows = [...rows].sort((a, b) => b.completed_jobs - a.completed_jobs);
    if (sort === 'price') rows = [...rows].sort((a, b) => price(a) - price(b));
    return rows;
    // catName reads `categories`, listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeArea, region.city, region.cityAreas, query, sort, categories]);

  // Area dropdown: the visitor's city first, grouped by city.
  const areaGroups = useMemo(() => {
    const order = region.city ? [region.city, ...region.cities.filter((c) => c !== region.city)] : region.cities;
    return order
      .map((c) => ({ city: c, items: areas.filter((a) => (a.city || 'Lagos') === c) }))
      .filter((g) => g.items.length > 0);
  }, [areas, region.cities, region.city]);

  const cityAreaSlugs = new Set(region.cityAreas.map((a) => a.slug));
  const countLabel = `${shown.length} artisan${shown.length === 1 ? '' : 's'}${catLabel ? ` for ${catLabel.toLowerCase()}` : ''}${placeName ? ` in ${placeName}` : ''}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="fa">
        <div className="container fa-wrap">
          {/* ── City banner with search ── */}
          <motion.section className="fa-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="fa-hero-copy">
              <span className="fa-hero-pill"><BadgeCheck size={15} /> Every artisan ID-checked by our team</span>
              <h1>{region.city ? `Verified artisans in ${region.city}` : 'Find a verified artisan'}</h1>
              <p>
                {region.city ? `Trusted professionals who work in ${region.city}.` : 'Trusted professionals in Lagos, Port Harcourt and Omoku.'}
                {' '}Pick one yourself, or request a service and we'll match you.
              </p>
              <form className="fa-search" role="search" onSubmit={(e) => e.preventDefault()}>
                <label htmlFor="fa-area" className="sr-only">Area</label>
                <select id="fa-area" value={activeArea} onChange={(e) => setActiveArea(e.target.value)}>
                  <option value="">{region.city ? `All of ${region.city}` : 'All areas'}</option>
                  {areaGroups.length > 1
                    ? areaGroups.map((g) => (
                        <optgroup key={g.city} label={g.city}>
                          {g.items.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                        </optgroup>
                      ))
                    : areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                </select>
                <label htmlFor="fa-q" className="sr-only">What do you need?</label>
                <input id="fa-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you need? e.g. borehole pump" />
                <button type="submit" className="fa-search-btn"><Search size={17} /><span>Search</span></button>
              </form>
            </div>
            <div className="fa-hero-art" aria-hidden="true">
              <svg viewBox="0 0 260 200">
                <circle cx="130" cy="110" r="88" fill="rgba(255,255,255,0.07)" />
                <g className="fa-sun"><circle cx="212" cy="40" r="24" fill="none" stroke="#f5c779" strokeWidth="4" strokeDasharray="4 7" /></g>
                <circle cx="212" cy="40" r="15" fill="#f5c779" />
                <ellipse cx="130" cy="182" rx="104" ry="9" fill="rgba(255,255,255,0.10)" />
                <rect x="72" y="104" width="116" height="78" rx="6" fill="#fffaf0" />
                <polygon points="60,110 130,58 200,110" fill="#062b14" />
                <rect x="116" y="138" width="28" height="44" rx="4" fill="#c97b12" />
                <rect x="84" y="122" width="24" height="20" rx="3" fill="#cfe8f3" />
                <rect x="152" y="122" width="24" height="20" rx="3" fill="#cfe8f3" />
                <ellipse className="fa-ring" cx="130" cy="56" rx="12" ry="4" fill="none" stroke="#f5a623" strokeWidth="2.5" />
                <g className="fa-pin">
                  <path d="M130 8c-11 0-18 8-18 17 0 12 18 27 18 27s18-15 18-27c0-9-7-17-18-17z" fill="#f5a623" />
                  <circle cx="130" cy="25" r="7" fill="#fff" />
                </g>
              </svg>
            </div>
          </motion.section>

          {/* ── Service filter ── */}
          <nav className="fa-chips" aria-label="Services">
            <button type="button" className={`fa-chip ${activeCat === '' ? 'active' : ''}`} aria-pressed={activeCat === ''} onClick={() => pickCat('')}>All services</button>
            {categories.map((c) => (
              <button type="button" key={c.slug} className={`fa-chip ${activeCat === c.slug ? 'active' : ''}`} aria-pressed={activeCat === c.slug} onClick={() => pickCat(c.slug)}>{c.name}</button>
            ))}
          </nav>

          {/* ── Results ── */}
          <div className="fa-bar">
            <h2>{loading ? 'Finding artisans…' : countLabel}</h2>
            <label className="fa-sort">Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="best">Best match</option>
                <option value="jobs">Most jobs done</option>
                {data?.prices && <option value="price">Lowest price</option>}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="fa-loading"><Loader2 className="spin" size={28} /></div>
          ) : (
            <div className="fa-grid">
              {shown.map((a) => {
                const price = data?.prices?.[a.id];
                const first = firstName(a.display_name);
                // Honest labels: Lezerv's starter price vs a price the artisan set.
                const priceLabel = price?.suggested === false ? 'Their price' : 'Starting price';
                const priceNote = !price ? 'Inspects first, then gives a firm price'
                  : price.suggested === false ? `Set by ${first} · agreed before work`
                  : price.suggested === true ? 'Lezerv guide price · agreed before work'
                  : 'Agreed before any work starts';
                const myAreas = (a.areas || []).filter((s) => cityAreaSlugs.has(s));
                const areaText = (myAreas.length ? myAreas : a.areas || []).slice(0, 2).map(areaName).join(' · ');
                return (
                  <article key={a.id} className="fa-card">
                    <div className="fa-card-head">
                      <span className="fa-avatar">
                        {a.avatar_url ? <img src={a.avatar_url} alt="" /> : initials(a.display_name)}
                      </span>
                      <div className="fa-card-name">
                        <h3><Link to={`/artisan/${a.id}`} className="fa-card-link">{a.display_name}</Link></h3>
                        {a.is_verified
                          ? <span className="fa-verified"><BadgeCheck size={14} /> ID verified</span>
                          : <span className="fa-new">New on Lezerv</span>}
                      </div>
                    </div>

                    {a.bio && <p className="fa-bio">{a.bio}</p>}

                    <div className="fa-tags">
                      {areaText && <span className="fa-tag"><MapPin size={13} /> {areaText}</span>}
                      {!!a.years_experience && <span className="fa-tag amber">{a.years_experience} year{a.years_experience === 1 ? '' : 's'}</span>}
                      {a.total_reviews > 0 && <span className="fa-tag"><Star size={13} className="fa-star" /> {a.avg_rating.toFixed(1)} ({a.total_reviews})</span>}
                    </div>

                    {data?.prices && (
                      <div className="fa-price">
                        <span className="fa-price-label">
                          <strong>{price ? priceLabel : 'Price'}</strong>
                          <small>{priceNote}</small>
                        </span>
                        <span className="fa-price-value">{price ? <><small>from</small> {naira(price.naira)}</> : 'After a visit'}</span>
                      </div>
                    )}

                    <div className="fa-card-foot">
                      <span><strong>{a.completed_jobs}</strong> job{a.completed_jobs === 1 ? '' : 's'} on Lezerv</span>
                      <LinkButton to={`/artisan/${a.id}`} variant="secondary" size="sm" aria-label={`View ${a.display_name}'s profile`}>View profile</LinkButton>
                    </div>
                  </article>
                );
              })}

              <article className="fa-card fa-request">
                <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true">
                  <rect x="8" y="22" width="56" height="40" rx="8" fill="#fff" />
                  <rect x="16" y="32" width="30" height="5" rx="2.5" fill="#e3ddd2" />
                  <rect x="16" y="43" width="40" height="5" rx="2.5" fill="#e3ddd2" />
                  <g className="fa-plane"><path d="M70 40l40-18-14 30-8-10z" fill="#f5a623" /></g>
                  <path className="fa-trail" d="M66 46q16 2 30-8" stroke="#c97b12" strokeWidth="2" strokeDasharray="3 4" fill="none" />
                </svg>
                <div>
                  <h3>{shown.length === 0 ? `No ${catLabel ? catLabel.toLowerCase() : 'artisans'} listed${placeName ? ` in ${placeName}` : ''} yet` : 'Not sure who to pick?'}</h3>
                  <p>Tell us what you need. We'll send it to verified artisans near you and one will take it.</p>
                </div>
                <LinkButton to={activeCat ? `/post-job?category=${activeCat}` : '/post-job'} leftIcon={<ClipboardList size={17} />}>Request for Service</LinkButton>
              </article>
            </div>
          )}

          <ul className="fa-trust">
            <li><span><KeyRound size={20} /></span> Start code at your door</li>
            <li><span><HandCoins size={20} /></span> Price agreed before work</li>
            <li><span><MessagesSquare size={20} /></span> Chat in the app</li>
          </ul>
        </div>
      </div>
    </MotionConfig>
  );
};

export default FindArtisans;
