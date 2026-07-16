import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Star, ShieldCheck, Loader2, Hammer, ClipboardList } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { artisanService } from '../services/artisanService';
import { useSEO } from '../hooks/useSEO';
import type { IServiceCategory, IServiceArea } from '../types/marketplace';
import './FindArtisans.css';

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="stars" title={`${rating.toFixed(1)} / 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={14} className={n <= Math.round(rating) ? 'star filled' : 'star'} />
    ))}
  </span>
);

const FindArtisans: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialCat = params.get('category') || '';
  const [categories, setCategories] = useState<IServiceCategory[]>([]);
  const [areas, setAreas] = useState<IServiceArea[]>([]);
  const [activeCat, setActiveCat] = useState<string>(initialCat);
  const [activeArea, setActiveArea] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const areaName = (slug: string) => areas.find((a) => a.slug === slug)?.name || '';
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name || '';

  const displayCat = catName(activeCat) || 'Artisans, Cleaners & Plumbers';
  const displayArea = areaName(activeArea) || 'Nigeria';

  useSEO({
    title: `Find Verified ${displayCat} in ${displayArea} | Lezerv`,
    description: `Hire verified and background-checked ${displayCat.toLowerCase()} in ${displayArea}. Get transparent pricing, customer reviews, and trusted home service professionals on Lezerv.`,
    keywords: `hire ${displayCat.toLowerCase()} ${displayArea}, verified ${displayCat.toLowerCase()} near me, home services ${displayArea}, lezerv ${displayCat.toLowerCase()}`
  });

  const run = useCallback(async (area: string, cat: string) => {
    setLoading(true);
    setResults(await artisanService.browse(area, cat));
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([artisanService.fetchCategories(), artisanService.fetchAreas()]).then(([c, a]) => {
      setCategories(c); setAreas(a);
    });
  }, []);

  // React to category changes coming from the URL (nav dropdown links)
  useEffect(() => {
    const cat = params.get('category') || '';
    setActiveCat(cat);
    run(activeArea, cat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, run]);

  const onArea = (slug: string) => { setActiveArea(slug); run(slug, activeCat); };
  const onCat = (slug: string) => { setActiveCat(slug); run(activeArea, slug); };

  return (
    <div className="find-artisans">
      <div className="fa-hero">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="fa-hero-inner">
          <h1>Browse verified artisans</h1>
          <p>See trusted professionals across Lagos. Ready to hire? Request for a service and we'll match you with the right one.</p>
          <div className="fa-bar">
            <div className="fa-select-wrap">
              <MapPin size={16} />
              <select value={activeArea} onChange={(e) => onArea(e.target.value)} className="fa-select" aria-label="Area">
                <option value="">All areas</option>
                {areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
            </div>
            <Link to="/post-job" className="fa-post-cta">
              <Button variant="primary" leftIcon={<ClipboardList size={18} />}>Request for Service</Button>
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="fa-cats-wrap">
        <div className="fa-cats">
          <button className={`fa-cat ${activeCat === '' ? 'active' : ''}`} onClick={() => onCat('')}>All services</button>
          {categories.map((c) => (
            <button key={c.slug} className={`fa-cat ${activeCat === c.slug ? 'active' : ''}`} onClick={() => onCat(c.slug)}>{c.name}</button>
          ))}
        </div>
      </div>

      <div className="fa-results">
        {loading ? (
          <div className="fa-empty"><Loader2 className="animate-spin" size={28} /><p>Loading…</p></div>
        ) : results.length === 0 ? (
          <div className="fa-empty">
            <Hammer size={36} style={{ opacity: 0.3 }} />
            <h3>No artisans here yet</h3>
            <p>Try another area or service. You can still request for a service — we'll match you as artisans come on board.</p>
            <Link to="/post-job"><Button variant="primary" leftIcon={<ClipboardList size={16} />}>Request for Service</Button></Link>
          </div>
        ) : (
          <>
            <p className="fa-count">{results.length} artisan{results.length > 1 ? 's' : ''}{activeArea ? ` in ${areaName(activeArea)}` : ''}{activeCat ? ` · ${catName(activeCat)}` : ''}</p>
            <div className="fa-grid">
              {results.map((a) => (
                <motion.div key={a.id} className="artisan-card" whileHover={{ y: -4 }} onClick={() => navigate(`/artisan/${a.id}`)}>
                  <div className="ac-top">
                    <div className="ac-avatar">
                      {a.avatar_url ? <img src={a.avatar_url} alt={a.display_name} /> : <span>{a.display_name.charAt(0)}</span>}
                      {a.is_verified && <span className="ac-avatar-badge"><ShieldCheck size={12} /></span>}
                    </div>
                    <div className="ac-headline">
                      <div className="ac-name">{a.display_name}</div>
                      <div className="ac-meta">
                        <Stars rating={a.avg_rating} />
                        <span className="ac-reviews">{a.total_reviews > 0 ? `${a.avg_rating.toFixed(1)} (${a.total_reviews})` : 'New on Lezerv'}</span>
                      </div>
                      <span className="ac-jobs">{a.completed_jobs} job{a.completed_jobs === 1 ? '' : 's'} completed{a.years_experience ? ` · ${a.years_experience}y exp` : ''}</span>
                    </div>
                  </div>
                  {a.bio && <p className="ac-bio">{a.bio}</p>}
                  <div className="ac-cats">
                    {(a.categories || []).slice(0, 3).map((slug: string) => <span key={slug} className="ac-chip">{catName(slug)}</span>)}
                    {(a.categories || []).length > 3 && <span className="ac-chip more">+{a.categories.length - 3}</span>}
                  </div>
                  <div className="ac-foot">
                    <span className="ac-areas"><MapPin size={13} /> {(a.areas || []).slice(0, 2).map(areaName).join(', ') || 'Lagos'}{(a.areas || []).length > 2 ? ` +${a.areas.length - 2}` : ''}</span>
                    <span className="ac-cta">View profile →</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FindArtisans;
