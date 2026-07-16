import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Hammer, User, Phone, IdCard, Briefcase, Loader2, ArrowRight,
  Check, Clock, ShieldCheck, AlertCircle, Plus, Upload, FileText, Camera,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { artisanService } from '../services/artisanService';
import type { IServiceCategory, IServiceArea } from '../types/marketplace';
import './ArtisanOnboard.css';
import { useSEO } from '../hooks/useSEO';

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt'];

const ArtisanOnboard: React.FC = () => {
  useSEO({
    title: 'Become an Artisan / Service Provider | Lezerv Nigeria',
    description: "Grow your home service business. Join Lezerv to get connected with customers needing professional cleaning, plumbing, electrical installations, AC servicing, and repairs in Lagos and Abuja.",
    keywords: 'register as artisan lagos, handyman jobs abuja, get cleaning jobs lagos, artisan recruitment nigeria, work as plumber nigeria'
  });

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<IServiceCategory[]>([]);
  const [areas, setAreas] = useState<IServiceArea[]>([]);
  const [existing, setExisting] = useState<Record<string, any> | null>(null);
  const [editing, setEditing] = useState(false);

  // form fields
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('Lagos');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  // KYC
  const [idType, setIdType] = useState<'nin' | 'voters_card' | 'intl_passport'>('nin');
  const [idNumber, setIdNumber] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [idDocPath, setIdDocPath] = useState<string | null>(null);
  const [billDocPath, setBillDocPath] = useState<string | null>(null);
  const [passportPath, setPassportPath] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      const [cats, ars] = await Promise.all([artisanService.fetchCategories(), artisanService.fetchAreas()]);
      setCategories(cats);
      setAreas(ars);

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
          setSelectedAreas(mine.areaSlugs || []);
          setPhone(mine.phone || '');
          setIdType(mine.id_type || 'nin');
          setIdNumber(mine.id_number || mine.nin || '');
          setIdDocPath(mine.id_doc_path || null);
          setBillDocPath(mine.bill_doc_path || null);
          setPassportPath(mine.passport_path || null);
        } else {
          setEditing(true);
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

  const toggleArea = (slug: string) => {
    setSelectedAreas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const nameFor = (list: { slug: string; name: string }[], slug: string) =>
    list.find((x) => x.slug === slug)?.name || slug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) return setError('Please enter your name.');
    if (selected.length === 0) return setError('Select at least one service you offer.');
    if (selectedAreas.length === 0) return setError('Select at least one area you work in.');
    if (!phone.trim()) return setError('A phone number is required.');
    if (!idNumber.trim()) return setError('Enter your ID number.');
    if (!idFile && !idDocPath) return setError('Upload a photo of your primary ID.');
    if (!billFile && !billDocPath) return setError('Upload a utility bill / receipt for proof of address.');
    if (!passportFile && !passportPath) return setError('Upload a passport photograph of yourself.');

    setSubmitting(true);
    // Upload any newly selected documents to the private KYC bucket
    let idP = idDocPath, billP = billDocPath, passP = passportPath;
    if (idFile) { idP = await artisanService.uploadKyc('id', idFile); if (!idP) { setSubmitting(false); return setError('ID upload failed. Please try again.'); } }
    if (billFile) { billP = await artisanService.uploadKyc('bill', billFile); if (!billP) { setSubmitting(false); return setError('Bill upload failed. Please try again.'); } }
    if (passportFile) { passP = await artisanService.uploadKyc('passport', passportFile); if (!passP) { setSubmitting(false); return setError('Passport photo upload failed. Please try again.'); } }

    const res = await artisanService.saveProfile({
      displayName: displayName.trim(),
      city,
      bio: bio.trim() || undefined,
      yearsExperience: years,
      phone: phone.trim(),
      nin: idType === 'nin' ? idNumber.trim() : undefined,
      categorySlugs: selected,
      areaSlugs: selectedAreas,
      idType,
      idNumber: idNumber.trim(),
      idDocPath: idP || undefined,
      billDocPath: billP || undefined,
      passportPath: passP || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      setIdDocPath(idP); setBillDocPath(billP); setPassportPath(passP);
      setIdFile(null); setBillFile(null); setPassportFile(null);
      setSavedStatus(res.data?.status || 'pending');
      setExisting({
        ...(existing || {}),
        status: res.data?.status || 'pending',
        display_name: displayName.trim(),
        categorySlugs: selected,
        areaSlugs: selectedAreas,
      });
      setEditing(false);
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

        {existing && !editing && (
          <div className="onboard-summary">
            <div className="summary-block">
              <span className="summary-label">You applied as</span>
              <div className="summary-chips">
                {selected.length ? selected.map((s) => (
                  <span key={s} className="summary-chip">{nameFor(categories, s)}</span>
                )) : <span className="summary-empty">No services selected</span>}
              </div>
            </div>
            <div className="summary-block">
              <span className="summary-label">Areas you cover</span>
              <div className="summary-chips">
                {selectedAreas.length ? selectedAreas.map((s) => (
                  <span key={s} className="summary-chip area">{nameFor(areas, s)}</span>
                )) : <span className="summary-empty">No areas selected</span>}
              </div>
            </div>
            <div className="summary-actions">
              <Button variant="outline" leftIcon={<Plus size={16} />} onClick={() => setEditing(true)}>
                Edit / add a service or area
              </Button>
            </div>
          </div>
        )}

        {(!existing || editing) && (
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
            <h2>Areas you work in</h2>
            <p className="section-hint">Pick every Lagos area you can take jobs in — we'll only show you jobs in these areas.</p>
            <div className="chip-grid">
              {areas.map((a) => (
                <button type="button" key={a.slug}
                  className={`chip ${selectedAreas.includes(a.slug) ? 'selected' : ''}`}
                  onClick={() => toggleArea(a.slug)}>
                  {selectedAreas.includes(a.slug) && <Check size={14} />}
                  {a.name}
                </button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <h2>Verification (KYC)</h2>
            <p className="section-hint">🔒 Private — used only to verify your identity. Never shown to clients. All three documents are required for approval.</p>

            <div className="form-group">
              <label htmlFor="phone">Phone number</label>
              <div className={`input-with-icon ${phone ? 'has-value' : ''}`}>
                <Phone size={18} className="input-icon" />
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="idtype">Primary ID type</label>
                <select id="idtype" className="select-input" value={idType} onChange={(e) => setIdType(e.target.value as any)}>
                  <option value="nin">NIN (National ID)</option>
                  <option value="voters_card">Voter's Card</option>
                  <option value="intl_passport">International Passport</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="idnum">ID number</label>
                <div className={`input-with-icon ${idNumber ? 'has-value' : ''}`}>
                  <IdCard size={18} className="input-icon" />
                  <input id="idnum" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Number on the ID" required />
                </div>
              </div>
            </div>

            <label className={`upload-row ${idFile || idDocPath ? 'done' : ''}`}>
              <div className="upload-icon"><IdCard size={20} /></div>
              <div className="upload-text">
                <strong>1. Photo of your ID</strong>
                <span>{idFile ? idFile.name : idDocPath ? 'Uploaded ✓ — tap to replace' : "NIN slip, voter's card or passport data page"}</span>
              </div>
              <span className="upload-btn"><Upload size={16} /> {idFile || idDocPath ? 'Change' : 'Upload'}</span>
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
            </label>

            <label className={`upload-row ${billFile || billDocPath ? 'done' : ''}`}>
              <div className="upload-icon"><FileText size={20} /></div>
              <div className="upload-text">
                <strong>2. Proof of address</strong>
                <span>{billFile ? billFile.name : billDocPath ? 'Uploaded ✓ — tap to replace' : 'Any recent utility bill or receipt'}</span>
              </div>
              <span className="upload-btn"><Upload size={16} /> {billFile || billDocPath ? 'Change' : 'Upload'}</span>
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
            </label>

            <label className={`upload-row ${passportFile || passportPath ? 'done' : ''}`}>
              <div className="upload-icon"><Camera size={20} /></div>
              <div className="upload-text">
                <strong>3. Passport photograph</strong>
                <span>{passportFile ? passportFile.name : passportPath ? 'Uploaded ✓ — tap to replace' : 'A clear photo of your face'}</span>
              </div>
              <span className="upload-btn"><Upload size={16} /> {passportFile || passportPath ? 'Change' : 'Upload'}</span>
              <input type="file" accept="image/*" hidden onChange={(e) => setPassportFile(e.target.files?.[0] || null)} />
            </label>
          </section>

          {error && <div className="onboard-note error"><AlertCircle size={18} /><span>{error}</span></div>}

          <div className="onboard-actions">
            <Button type="button" variant="text"
              onClick={() => (existing ? setEditing(false) : navigate('/profile'))}>Cancel</Button>
            <Button type="submit" variant="primary" size="lg" disabled={submitting}
              rightIcon={submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}>
              {submitting ? 'Saving…' : existing ? 'Save changes' : 'Submit for review'}
            </Button>
          </div>
        </form>
        )}
      </motion.div>
    </div>
  );
};

export default ArtisanOnboard;
