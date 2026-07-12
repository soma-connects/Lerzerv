import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Hammer, User, MapPin, Phone, IdCard, Briefcase, Loader2, ArrowRight,
  Check, Clock, ShieldCheck, AlertCircle, LocateFixed,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { artisanService } from '../services/artisanService';
import type { IServiceCategory } from '../types/marketplace';
import './ArtisanOnboard.css';

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt'];

const ArtisanOnboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<IServiceCategory[]>([]);
  const [existing, setExisting] = useState<Record<string, any> | null>(null);

  // form fields
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('Lagos');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [radius, setRadius] = useState(15);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [nin, setNin] = useState('');
  const [address, setAddress] = useState('');

  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      const cats = await artisanService.fetchCategories();
      setCategories(cats);

      if (user) {
        const mine = await artisanService.getMyProfile();
        if (mine) {
          setExisting(mine);
          setSavedStatus(mine.status);
          setAvailable(!!mine.is_available);
          setDisplayName(mine.display_name || '');
          setCity(mine.city || 'Lagos');
          setBio(mine.bio || '');
          setYears(mine.years_experience || 0);
          setSelected(mine.categorySlugs || []);
          setRadius(mine.service_radius_km || 15);
          setLat(mine.lat ?? null);
          setLng(mine.lng ?? null);
          setPhone(mine.phone || '');
          setNin(mine.nin || '');
          setAddress(mine.address || '');
        } else {
          setDisplayName(user.user_metadata?.full_name || '');
        }
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading]);

  const toggleCategory = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Please allow location access.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) return setError('Please enter your name.');
    if (selected.length === 0) return setError('Select at least one service you offer.');
    if (lat === null || lng === null) return setError('Please set your work location.');
    if (!phone.trim()) return setError('A phone number is required for verification.');

    setSubmitting(true);
    const res = await artisanService.saveProfile({
      displayName: displayName.trim(),
      city,
      bio: bio.trim() || undefined,
      yearsExperience: years,
      lat,
      lng,
      serviceRadiusKm: radius,
      phone: phone.trim(),
      nin: nin.trim() || undefined,
      address: address.trim() || undefined,
      categorySlugs: selected,
    });
    setSubmitting(false);

    if (res.success) {
      setSavedStatus(res.data?.status || 'pending');
      setExisting({ ...(existing || {}), status: res.data?.status || 'pending' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setError(res.error?.message || 'Something went wrong. Please try again.');
    }
  };

  const handleAvailabilityToggle = async () => {
    const next = !available;
    setAvailable(next);
    await artisanService.setAvailability(next);
  };

  // ── Not logged in ─────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div className="artisan-onboard">
        <motion.div className="onboard-gate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="gate-icon"><Hammer size={32} color="var(--color-primary)" /></div>
          <h1>Become a Lezerv Artisan</h1>
          <p>Join our network of verified professionals and get paid for work near you. Please log in or create an account to continue.</p>
          <div className="gate-actions">
            <Link to="/login"><Button variant="outline" size="lg">Login</Button></Link>
            <Link to="/signup"><Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>Create Account</Button></Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading || authLoading) {
    return <div className="artisan-onboard loading-state"><Loader2 className="animate-spin" size={32} /></div>;
  }

  const statusBadge = () => {
    switch (savedStatus) {
      case 'approved':
        return <span className="status-pill approved"><ShieldCheck size={14} /> Approved</span>;
      case 'pending':
        return <span className="status-pill pending"><Clock size={14} /> Under Review</span>;
      case 'suspended':
        return <span className="status-pill suspended"><AlertCircle size={14} /> Suspended</span>;
      case 'rejected':
        return <span className="status-pill suspended"><AlertCircle size={14} /> Not Approved</span>;
      default:
        return null;
    }
  };

  return (
    <div className="artisan-onboard">
      <motion.div className="onboard-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <header className="onboard-head">
          <div className="head-left">
            <div className="gate-icon sm"><Hammer size={22} color="var(--color-primary)" /></div>
            <div>
              <h1>{existing ? 'Your Artisan Profile' : 'Become a Lezerv Artisan'}</h1>
              <p>{existing ? 'Keep your profile up to date to get more jobs.' : 'Set up your profile to start receiving job requests near you.'}</p>
            </div>
          </div>
          {savedStatus && statusBadge()}
        </header>

        {savedStatus === 'pending' && (
          <div className="onboard-note info">
            <Clock size={18} />
            <span>Your profile is under review. Our team verifies every artisan before they go live — you'll be notified once approved.</span>
          </div>
        )}

        {savedStatus === 'approved' && (
          <div className="availability-card">
            <div>
              <h3>Ready for work?</h3>
              <p>{available ? "You're visible to clients searching near you." : "You're hidden from search. Turn on to receive jobs."}</p>
            </div>
            <button
              type="button"
              className={`toggle ${available ? 'on' : ''}`}
              onClick={handleAvailabilityToggle}
              aria-pressed={available}
            >
              <span className="knob" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="onboard-form">
          <section className="form-section">
            <h2>About you</h2>
            <div className="form-group">
              <label htmlFor="name">Full / Business Name</label>
              <div className={`input-with-icon ${displayName ? 'has-value' : ''}`}>
                <User size={18} className="input-icon" />
                <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Emeka's Plumbing Services" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">City</label>
                <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className="select-input">
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="years">Years of experience</label>
                <div className={`input-with-icon ${years ? 'has-value' : ''}`}>
                  <Briefcase size={18} className="input-icon" />
                  <input id="years" type="number" min={0} max={60} value={years}
                    onChange={(e) => setYears(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bio">Short bio</label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                placeholder="Tell clients about your skills and what makes your work stand out." />
            </div>
          </section>

          <section className="form-section">
            <h2>Services you offer</h2>
            <p className="section-hint">Pick all that apply.</p>
            <div className="chip-grid">
              {categories.map((c) => (
                <button type="button" key={c.slug}
                  className={`chip ${selected.includes(c.slug) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(c.slug)}>
                  {selected.includes(c.slug) && <Check size={14} />}
                  {c.name}
                </button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <h2>Where you work</h2>
            <p className="section-hint">We use this to match you with nearby clients. Your exact location is never shown publicly.</p>
            <div className="location-row">
              <Button type="button" variant="outline" onClick={captureLocation} disabled={locating}
                leftIcon={locating ? <Loader2 className="animate-spin" size={18} /> : <LocateFixed size={18} />}>
                {locating ? 'Getting location…' : lat !== null ? 'Update my location' : 'Use my current location'}
              </Button>
              {lat !== null && lng !== null && (
                <span className="coords"><MapPin size={14} /> {lat.toFixed(4)}, {lng.toFixed(4)}</span>
              )}
            </div>
            <div className="form-group radius-group">
              <label htmlFor="radius">How far will you travel? <strong>{radius} km</strong></label>
              <input id="radius" type="range" min={2} max={50} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))} className="range-input" />
            </div>
          </section>

          <section className="form-section">
            <h2>Verification</h2>
            <p className="section-hint">🔒 Private — used only for identity checks and payouts. Never shown to clients.</p>
            <div className="form-group">
              <label htmlFor="phone">Phone number</label>
              <div className={`input-with-icon ${phone ? 'has-value' : ''}`}>
                <Phone size={18} className="input-icon" />
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="080..." required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="nin">NIN <span className="optional">(optional now, required to verify)</span></label>
              <div className={`input-with-icon ${nin ? 'has-value' : ''}`}>
                <IdCard size={18} className="input-icon" />
                <input id="nin" value={nin} onChange={(e) => setNin(e.target.value)}
                  placeholder="National Identification Number" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="address">Home / workshop address <span className="optional">(optional)</span></label>
              <div className={`input-with-icon ${address ? 'has-value' : ''}`}>
                <MapPin size={18} className="input-icon" />
                <input id="address" value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, area" />
              </div>
            </div>
          </section>

          {error && <div className="onboard-note error"><AlertCircle size={18} /><span>{error}</span></div>}

          <div className="onboard-actions">
            <Button type="button" variant="text" onClick={() => navigate('/profile')}>Cancel</Button>
            <Button type="submit" variant="primary" size="lg" disabled={submitting}
              rightIcon={submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}>
              {submitting ? 'Saving…' : existing ? 'Save changes' : 'Submit for review'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ArtisanOnboard;
