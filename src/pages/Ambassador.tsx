import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  Users,
  TrendingUp,
  Copy,
  Check,
  Send,
  Loader2,
  Clock,
  AlertCircle,
  Gift,
  ArrowRight,
  Share2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  ambassadorService,
  type TAmbassador,
  type TReferral,
  type TAmbassadorApplication
} from '../services/ambassadorService';
import './Ambassador.css';

const Ambassador: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [ambassador, setAmbassador] = useState<TAmbassador | null>(null);
  const [referrals, setReferrals] = useState<TReferral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Application form state
  const [appName, setAppName] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appReason, setAppReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (authLoading) return;
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await ambassadorService.getMyAmbassadorProfile();
        setAmbassador(profile);

        if (profile?.status === 'approved') {
          const refs = await ambassadorService.getMyReferrals();
          setReferrals(refs);
        }

        // Pre-fill form with user data
        setAppEmail(user.email || '');
        setAppName(user.user_metadata?.full_name || '');
      } catch (err) {
        console.error('Error loading ambassador data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, authLoading]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const application: TAmbassadorApplication = {
      name: appName,
      email: appEmail,
      phone: appPhone,
      reason: appReason
    };

    const response = await ambassadorService.applyToProgram(application);

    if (response.success) {
      setSubmitSuccess(true);
      setAmbassador(response.data!);
    } else {
      setSubmitError(response.error?.message || 'Something went wrong. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleCopyCode = () => {
    if (!ambassador) return;
    navigator.clipboard.writeText(ambassador.referral_code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!ambassador) return;
    const link = `${window.location.origin}/?ref=${ambassador.referral_code}`;
    navigator.clipboard.writeText(link);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!ambassador) return;
    const link = `${window.location.origin}/?ref=${ambassador.referral_code}`;
    const text = `Hey! Use my referral link to book home services on Lezerv and get a discount on your first booking: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTwitter = () => {
    if (!ambassador) return;
    const link = `${window.location.origin}/?ref=${ambassador.referral_code}`;
    const text = `I'm a Lezerv Ambassador! Book verified home services in Nigeria through my link and get a discount on your first booking 🏠✨`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`, '_blank');
  };

  const getReferralShareableLink = () => {
    if (!ambassador) return '';
    return `${window.location.origin}/?ref=${ambassador.referral_code}`;
  };

  const pendingCount = referrals.filter(r => ['clicked', 'signed_up', 'booked'].includes(r.status)).length;

  if (isLoading || authLoading) {
    return (
      <div className="ambassador-page">
        <div className="container" style={{ textAlign: 'center', padding: 'var(--spacing-2xl) 0' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-on-surface-variant)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ambassador-page">
      {/* ── Hero Section ── */}
      <section className="ambassador-hero">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="ambassador-hero-badge">
              <Award size={16} /> Ambassador Program
            </span>
            <h1>Earn Rewards by Sharing Lezerv</h1>
            <p>
              Refer friends, family, and neighbours to use Lezerv home services.
              When they book — <strong>you earn points</strong> and <strong>they get a discount</strong> on their first service.
            </p>
            <div className="ambassador-hero-stats">
              <div className="ambassador-hero-stat">
                <span className="stat-number">100</span>
                <span className="stat-text">Points per referral</span>
              </div>
              <div className="ambassador-hero-stat">
                <span className="stat-number">10%</span>
                <span className="stat-text">Discount for friends</span>
              </div>
              <div className="ambassador-hero-stat">
                <span className="stat-number">∞</span>
                <span className="stat-text">No limit on referrals</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container">
        {/* ── Not Logged In ── */}
        {!user && (
          <motion.div
            className="ambassador-login-prompt"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Gift size={48} strokeWidth={1.5} />
            <h2>Join the Ambassador Program</h2>
            <p>You need a Lezerv account to apply. Sign up or log in to get started.</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup">
                <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
                  Create Account
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg">Log In</Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── Pending Application ── */}
        {user && ambassador?.status === 'pending' && (
          <motion.div
            className="ambassador-pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="pending-icon">
              <Clock size={48} />
            </div>
            <h2>Application Under Review</h2>
            <p>
              Thank you for applying to the Lezerv Ambassador Program!
              Our team is reviewing your application. You will be notified once it's approved.
            </p>
            <div style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--font-size-body-sm)' }}>
              Applied: {new Date(ambassador.created_at).toLocaleDateString()}
            </div>
          </motion.div>
        )}

        {/* ── Rejected ── */}
        {user && ambassador?.status === 'rejected' && (
          <motion.div
            className="ambassador-pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="pending-icon" style={{ background: 'var(--color-error-container)' }}>
              <AlertCircle size={48} color="var(--color-error)" />
            </div>
            <h2>Application Not Approved</h2>
            <p>
              Unfortunately, your application was not approved at this time.
              Please contact support at <a href="mailto:Lezervlimited@gmail.com">Lezervlimited@gmail.com</a> for more information.
            </p>
          </motion.div>
        )}

        {/* ── Application Form (no ambassador record yet) ── */}
        {user && !ambassador && !submitSuccess && (
          <motion.section
            className="ambassador-apply-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="apply-card">
              <h2>Apply to Become an Ambassador</h2>
              <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: 'var(--spacing-xl)' }}>
                Tell us a bit about yourself. Once approved, you'll receive your unique referral code.
              </p>

              <form onSubmit={handleApply}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={appName}
                    onChange={e => setAppName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={appEmail}
                    onChange={e => setAppEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp / Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={appPhone}
                    onChange={e => setAppPhone(e.target.value)}
                    placeholder="080 1234 5678"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Why do you want to be a Lezerv Ambassador?</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={appReason}
                    onChange={e => setAppReason(e.target.value)}
                    placeholder="Tell us about your network, how you plan to share Lezerv, and why you'd be a great ambassador..."
                    required
                  />
                </div>

                {submitError && (
                  <div className="apply-error">
                    <AlertCircle size={16} />
                    <span>{submitError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={isSubmitting}
                  rightIcon={isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </form>
            </div>
          </motion.section>
        )}

        {/* ── Application Success (just submitted) ── */}
        {user && submitSuccess && ambassador?.status === 'pending' && (
          <motion.div
            className="apply-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Check size={64} color="var(--color-secondary)" style={{ margin: '0 auto' }} />
            <h2>Application Submitted!</h2>
            <p>
              Your application to the Lezerv Ambassador Program has been received.
              Our team will review it and get back to you soon.
            </p>
          </motion.div>
        )}

        {/* ── Approved Ambassador Dashboard ── */}
        {user && ambassador?.status === 'approved' && (
          <motion.div
            className="ambassador-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Greeting */}
            <div className="dashboard-header">
              <h2>Welcome back, {ambassador.name.split(' ')[0]}! 🎉</h2>
              <p>Share your referral code and start earning rewards.</p>
            </div>

            {/* Referral Code Card */}
            <motion.div
              className="referral-code-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="referral-code-section">
                <span className="referral-label">Your Referral Code</span>
                <div className="referral-code-display" onClick={handleCopyCode}>
                  <span>{ambassador.referral_code}</span>
                  {isCopied ? <Check size={20} color="var(--color-secondary)" /> : <Copy size={20} />}
                </div>
                <div className="referral-link-display">
                  <span>{getReferralShareableLink()}</span>
                  <button onClick={handleCopyLink} className="copy-link-btn">
                    {isLinkCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isLinkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="share-actions">
                <button className="share-btn whatsapp" onClick={handleShareWhatsApp}>
                  <Share2 size={18} />
                  Share on WhatsApp
                </button>
                <button className="share-btn twitter" onClick={handleShareTwitter}>
                  <Share2 size={18} />
                  Share on X
                </button>
                <button className="share-btn copy" onClick={handleCopyLink}>
                  <Copy size={18} />
                  {isLinkCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </motion.div>

            {/* Discount Info Banner */}
            <div className="discount-info-banner">
              <Gift size={20} />
              <span>
                Everyone who books through your link gets a <strong>10% discount</strong> on their first service!
              </span>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="stat-icon" style={{ background: 'var(--color-primary-fixed)' }}>
                  <Users size={22} color="var(--color-primary)" />
                </div>
                <div className="stat-value">{referrals.length}</div>
                <div className="stat-label">Total Clicks</div>
              </motion.div>

              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="stat-icon" style={{ background: 'var(--color-tertiary-fixed)' }}>
                  <Clock size={22} color="var(--color-tertiary)" />
                </div>
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Pending Conversions</div>
              </motion.div>

              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="stat-icon" style={{ background: 'var(--color-secondary-container)' }}>
                  <TrendingUp size={22} color="var(--color-secondary)" />
                </div>
                <div className="stat-value">{ambassador.total_points}</div>
                <div className="stat-label">Points Earned</div>
              </motion.div>
            </div>

            {/* Referral History Table */}
            <div className="referral-history">
              <h3>Referral Activity</h3>
              {referrals.length === 0 ? (
                <div className="empty-referrals">
                  <Share2 size={40} strokeWidth={1.5} />
                  <p>No referrals yet. Share your link to get started!</p>
                </div>
              ) : (
                <div className="referral-table-container">
                  <table className="referral-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Referred Person</th>
                        <th>Status</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map(ref => (
                        <tr key={ref.id}>
                          <td>{new Date(ref.created_at).toLocaleDateString()}</td>
                          <td>{ref.referred_email || 'Anonymous visitor'}</td>
                          <td>
                            <span className={`referral-status ${ref.status}`}>
                              {ref.status === 'signed_up' ? 'Signed Up' : ref.status.charAt(0).toUpperCase() + ref.status.slice(1)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: ref.points_awarded > 0 ? 'var(--font-weight-bold)' : 'normal', color: ref.points_awarded > 0 ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)' }}>
                              {ref.points_awarded > 0 ? `+${ref.points_awarded}` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Ambassador;
