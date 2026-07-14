import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, MapPin, Loader2, ArrowRight, Check, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { artisanService } from '../services/artisanService';
import type { IServiceCategory, IServiceArea } from '../types/marketplace';
import './PostJob.css';

const PostJob: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [categories, setCategories] = useState<IServiceCategory[]>([]);
  const [areas, setAreas] = useState<IServiceArea[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [budget, setBudget] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([artisanService.fetchCategories(), artisanService.fetchAreas()]).then(([c, a]) => {
      setCategories(c);
      setAreas(a);
      if (!category && c[0]) setCategory(c[0].slug);
      if (a[0]) setArea(a[0].slug);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!title.trim()) { setError('Please describe what you need done.'); return; }
    setSubmitting(true);
    setError(null);
    const res = await artisanService.createJob({
      title: title.trim(),
      categorySlug: category,
      areaSlug: area,
      description: description.trim() || undefined,
      addressText: address.trim() || undefined,
      scheduledFor: scheduledFor || undefined,
      budgetNote: budget.trim() || undefined,
      clientContact: { name: user.user_metadata?.full_name || '', phone: phone.trim() },
    });
    setSubmitting(false);
    if (res.success) setDone(true);
    else setError(res.error?.message || 'Could not post your job. Please try again.');
  };

  if (loading || authLoading) {
    return <div className="post-job loading"><Loader2 className="animate-spin" size={30} /></div>;
  }

  if (!user) {
    return (
      <div className="post-job">
        <motion.div className="pj-gate" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="pj-gate-icon"><ClipboardList size={30} color="var(--color-primary)" /></div>
          <h1>Post a job</h1>
          <p>Tell us what you need and we'll match you with a verified artisan in your area. Please log in to continue.</p>
          <div className="pj-gate-actions">
            <Link to="/login"><Button variant="outline" size="lg">Login</Button></Link>
            <Link to="/signup"><Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>Create account</Button></Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="post-job">
        <motion.div className="pj-done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="pj-done-icon"><Check size={34} /></div>
          <h1>Job posted!</h1>
          <p>We're matching you with verified artisans in your area. Once one is assigned, you'll be able to chat with them here on Lezerv.</p>
          <div className="pj-done-actions">
            <Button variant="primary" size="lg" onClick={() => navigate('/my-jobs')}>Track my jobs</Button>
            <Button variant="text" onClick={() => { setDone(false); setTitle(''); setDescription(''); }}>Post another</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="post-job">
      <motion.div className="pj-container" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <header className="pj-head">
          <div className="pj-gate-icon sm"><ClipboardList size={22} color="var(--color-primary)" /></div>
          <div>
            <h1>Post a job</h1>
            <p>Describe what you need. We'll match you with a verified artisan nearby.</p>
          </div>
        </header>

        <form onSubmit={submit} className="pj-form">
          <div className="form-group">
            <label>What do you need done?</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fix a leaking kitchen sink" required />
          </div>

          <div className="pj-row">
            <div className="form-group">
              <label>Service</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="select-input">
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Area</label>
              <select value={area} onChange={(e) => setArea(e.target.value)} className="select-input">
                {areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Details <span className="optional">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Describe the job, timing, materials, anything useful." />
          </div>

          <div className="pj-row">
            <div className="form-group">
              <label><MapPin size={13} /> Address / landmark <span className="optional">(optional)</span></label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, estate, landmark" />
            </div>
            <div className="form-group">
              <label><Calendar size={13} /> Preferred date <span className="optional">(optional)</span></label>
              <input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
          </div>

          <div className="pj-row">
            <div className="form-group">
              <label>Budget <span className="optional">(optional)</span></label>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. ₦15,000 - ₦20,000" />
            </div>
            <div className="form-group">
              <label>Your phone <span className="optional">(for our team)</span></label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." />
            </div>
          </div>

          {error && <div className="pj-error"><AlertCircle size={18} /><span>{error}</span></div>}

          <Button type="submit" variant="primary" size="lg" fullWidth disabled={submitting}
            rightIcon={submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}>
            {submitting ? 'Posting…' : 'Post job'}
          </Button>
          <p className="pj-note">🔒 Our team reviews every job and assigns a verified artisan. You'll chat and pay safely on Lezerv.</p>
        </form>
      </motion.div>
    </div>
  );
};

export default PostJob;
