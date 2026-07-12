import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, ShieldCheck, MapPin, Briefcase, Loader2, ArrowLeft, Send, X, Check, MessageSquare,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { artisanService } from '../services/artisanService';
import type { IArtisanProfile } from '../types/marketplace';
import './ArtisanProfile.css';

const Stars: React.FC<{ rating: number; size?: number }> = ({ rating, size = 16 }) => (
  <span className="stars">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} className={n <= Math.round(rating) ? 'star filled' : 'star'} />
    ))}
  </span>
);

const ArtisanProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<IArtisanProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // request modal
  const [modalOpen, setModalOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqCategory, setReqCategory] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqAddress, setReqAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!id) return;
    artisanService.getPublicProfile(id).then((p) => {
      setProfile(p);
      if (p?.categories?.[0]) setReqCategory(p.categories[0].slug);
      setLoading(false);
    });
  }, [id]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!reqTitle.trim()) { setError('Please describe what you need.'); return; }
    setSubmitting(true);
    setError(null);
    const res = await artisanService.createRequest({
      artisanId: id!,
      title: reqTitle.trim(),
      categorySlug: reqCategory || undefined,
      description: reqDesc.trim() || undefined,
      addressText: reqAddress.trim() || undefined,
      clientContact: { name: user.user_metadata?.full_name || '', phone: '' },
    });
    setSubmitting(false);
    if (res.success) {
      setSent(true);
    } else {
      setError(res.error?.message || 'Could not send your request. Please try again.');
    }
  };

  if (loading) {
    return <div className="artisan-profile loading"><Loader2 className="animate-spin" size={30} /></div>;
  }

  if (!profile) {
    return (
      <div className="artisan-profile not-found">
        <h2>Artisan not found</h2>
        <p>This profile may be unavailable or awaiting approval.</p>
        <Link to="/find-artisans"><Button variant="primary">Browse artisans</Button></Link>
      </div>
    );
  }

  return (
    <div className="artisan-profile">
      <div className="ap-container">
        <button className="ap-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /> Back</button>

        <motion.div className="ap-header" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="ap-avatar">
            {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} /> : <span>{profile.display_name.charAt(0)}</span>}
          </div>
          <div className="ap-head-info">
            <h1>
              {profile.display_name}
              {profile.is_verified && <span className="ap-verified"><ShieldCheck size={18} /> Verified</span>}
            </h1>
            <div className="ap-stat-row">
              <span className="ap-rating"><Stars rating={profile.avg_rating} />
                {profile.total_reviews > 0 ? <strong>{profile.avg_rating.toFixed(1)}</strong> : <em>New</em>}
                <span className="ap-muted">({profile.total_reviews} review{profile.total_reviews === 1 ? '' : 's'})</span>
              </span>
              <span className="ap-muted"><MapPin size={14} /> {profile.city}</span>
              <span className="ap-muted"><Briefcase size={14} /> {profile.years_experience}y experience</span>
              <span className="ap-muted"><Check size={14} /> {profile.completed_jobs} jobs done</span>
            </div>
          </div>
          <div className="ap-cta">
            <Button variant="primary" size="lg" leftIcon={<Send size={18} />} onClick={() => setModalOpen(true)}>
              Request this artisan
            </Button>
          </div>
        </motion.div>

        {profile.categories.length > 0 && (
          <div className="ap-section">
            <h2>Services offered</h2>
            <div className="ap-chips">
              {profile.categories.map((c) => <span key={c.slug} className="ap-chip">{c.name}</span>)}
            </div>
          </div>
        )}

        {profile.bio && (
          <div className="ap-section">
            <h2>About</h2>
            <p className="ap-bio">{profile.bio}</p>
          </div>
        )}

        <div className="ap-section">
          <h2>Reviews ({profile.total_reviews})</h2>
          {profile.reviews.length === 0 ? (
            <p className="ap-muted">No reviews yet — be the first to hire and review this artisan.</p>
          ) : (
            <div className="ap-reviews">
              {profile.reviews.map((r, i) => (
                <div key={i} className="ap-review">
                  <div className="ap-review-head">
                    <span className="ap-reviewer">{r.reviewer}</span>
                    <Stars rating={r.rating} size={13} />
                  </div>
                  {r.comment && <p>{r.comment}</p>}
                  <span className="ap-review-date">{new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ap-safety">
          <MessageSquare size={16} />
          <span>For your safety, all chat and payment happen inside Lezerv. Never share personal contact or pay outside the platform.</span>
        </div>
      </div>

      {/* Request modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="ap-modal-overlay" onClick={() => !submitting && setModalOpen(false)}>
            <motion.div className="ap-modal" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              <button className="ap-modal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
              {sent ? (
                <div className="ap-sent">
                  <div className="ap-sent-icon"><Check size={30} /></div>
                  <h3>Request sent!</h3>
                  <p>{profile.display_name} has been notified. You'll be able to chat and agree a price once they accept.</p>
                  <Button variant="primary" onClick={() => navigate('/profile')}>Go to my requests</Button>
                </div>
              ) : (
                <>
                  <h3>Request {profile.display_name}</h3>
                  <p className="ap-modal-sub">Tell them what you need. They'll review and respond with a quote.</p>
                  <form onSubmit={handleRequest} className="ap-form">
                    <div className="form-group">
                      <label>What do you need?</label>
                      <input value={reqTitle} onChange={(e) => setReqTitle(e.target.value)}
                        placeholder="e.g. Fix a leaking kitchen sink" required />
                    </div>
                    {profile.categories.length > 0 && (
                      <div className="form-group">
                        <label>Service</label>
                        <select value={reqCategory} onChange={(e) => setReqCategory(e.target.value)} className="select-input">
                          {profile.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label>Details <span className="optional">(optional)</span></label>
                      <textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={3}
                        placeholder="Describe the job, timing, anything useful." />
                    </div>
                    <div className="form-group">
                      <label>Address / area <span className="optional">(optional)</span></label>
                      <input value={reqAddress} onChange={(e) => setReqAddress(e.target.value)} placeholder="Where is the job?" />
                    </div>
                    {error && <div className="ap-error">{error}</div>}
                    {!user && <div className="ap-note">You'll be asked to log in to send this request.</div>}
                    <Button type="submit" variant="primary" size="lg" fullWidth disabled={submitting}
                      rightIcon={submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}>
                      {submitting ? 'Sending…' : 'Send request'}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ArtisanProfile;
