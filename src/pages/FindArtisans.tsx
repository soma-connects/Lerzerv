import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Star, ShieldCheck, Loader2, LocateFixed, SlidersHorizontal, Hammer,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { artisanService } from '../services/artisanService';
import type { IServiceCategory, IArtisanSearchResult } from '../types/marketplace';
import './FindArtisans.css';

// Default search centre: Lagos (Ikeja) — used until the user shares location.
const LAGOS = { lat: 6.6018, lng: 3.3515 };

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="stars" title={`${rating.toFixed(1)} / 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={14} className={n <= Math.round(rating) ? 'star filled' : 'star'} />
    ))}
  </span>
);

const FindArtisans: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<IServiceCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [radius, setRadius] = useState(15);
  const [coords, setCoords] = useState(LAGOS);
  const [usingPreciseLocation, setUsingPreciseLocation] = useState(false);
  const [results, setResults] = useState<IArtisanSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  const runSearch = useCallback(async (lat: number, lng: number, r: number, cat: string | null) => {
    setLoading(true);
    const data = await artisanService.search(lat, lng, r, cat ?? undefined);
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    artisanService.fetchCategories().then(setCategories);
    runSearch(LAGOS.lat, LAGOS.lng, 15, null);
  }, [runSearch]);

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setUsingPreciseLocation(true);
        setLocating(false);
        runSearch(c.lat, c.lng, radius, activeCat);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const selectCategory = (slug: string | null) => {
    setActiveCat(slug);
    runSearch(coords.lat, coords.lng, radius, slug);
  };

  const onRadiusCommit = () => runSearch(coords.lat, coords.lng, radius, activeCat);

  return (
    <div className="find-artisans">
      <div className="fa-hero">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="fa-hero-inner">
          <h1>Find a verified artisan near you</h1>
          <p>Browse trusted professionals in {usingPreciseLocation ? 'your area' : 'Lagos'} — request, chat, and pay safely through Lezerv.</p>
          <div className="fa-controls">
            <Button variant="outline" onClick={captureLocation} disabled={locating}
              leftIcon={locating ? <Loader2 className="animate-spin" size={18} /> : <LocateFixed size={18} />}>
              {locating ? 'Locating…' : usingPreciseLocation ? 'Using your location' : 'Use my location'}
            </Button>
            <div className="fa-radius">
              <SlidersHorizontal size={16} />
              <label htmlFor="fa-radius">Within <strong>{radius} km</strong></label>
              <input id="fa-radius" type="range" min={2} max={50} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))} onMouseUp={onRadiusCommit} onTouchEnd={onRadiusCommit} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fa-cats">
        <button className={`fa-cat ${activeCat === null ? 'active' : ''}`} onClick={() => selectCategory(null)}>All</button>
        {categories.map((c) => (
          <button key={c.slug} className={`fa-cat ${activeCat === c.slug ? 'active' : ''}`} onClick={() => selectCategory(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="fa-results">
        {loading ? (
          <div className="fa-empty"><Loader2 className="animate-spin" size={28} /><p>Searching…</p></div>
        ) : results.length === 0 ? (
          <div className="fa-empty">
            <Hammer size={36} style={{ opacity: 0.3 }} />
            <h3>No artisans found here yet</h3>
            <p>Try widening the distance or picking a different service. We're onboarding pros in your area.</p>
          </div>
        ) : (
          <>
            <p className="fa-count">{results.length} artisan{results.length > 1 ? 's' : ''} available</p>
            <div className="fa-grid">
              {results.map((a) => (
                <motion.div key={a.id} className="artisan-card" whileHover={{ y: -3 }}
                  onClick={() => navigate(`/artisan/${a.id}`)}>
                  <div className="ac-top">
                    <div className="ac-avatar">
                      {a.avatar_url ? <img src={a.avatar_url} alt={a.display_name} /> : <span>{a.display_name.charAt(0)}</span>}
                    </div>
                    <div className="ac-headline">
                      <div className="ac-name">
                        {a.display_name}
                        {a.is_verified && <ShieldCheck size={15} className="ac-verified" aria-label="Verified" />}
                      </div>
                      <div className="ac-meta">
                        <Stars rating={a.avg_rating} />
                        <span className="ac-reviews">{a.total_reviews > 0 ? `${a.avg_rating.toFixed(1)} (${a.total_reviews})` : 'New'}</span>
                      </div>
                    </div>
                  </div>
                  {a.bio && <p className="ac-bio">{a.bio}</p>}
                  <div className="ac-cats">
                    {a.categories.slice(0, 3).map((slug) => {
                      const name = categories.find((c) => c.slug === slug)?.name || slug;
                      return <span key={slug} className="ac-chip">{name}</span>;
                    })}
                    {a.categories.length > 3 && <span className="ac-chip more">+{a.categories.length - 3}</span>}
                  </div>
                  <div className="ac-foot">
                    <span className="ac-distance"><MapPin size={14} /> {a.distance_km} km away</span>
                    <span className="ac-jobs">{a.completed_jobs} jobs done</span>
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
