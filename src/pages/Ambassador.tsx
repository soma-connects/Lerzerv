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
import { emailService } from '../services/emailService';
import './Ambassador.css';
import { useSEO } from '../hooks/useSEO';

const Ambassador: React.FC = () => {
  useSEO({
    title: 'Refer & Earn | Lezerv Ambassador Program Nigeria',
    description: "Join the Lezerv Ambassador Program. Refer friends, family, and businesses to Nigeria's leading home services network and earn commissions on every successful service completed.",
    keywords: 'lezerv ambassador, refer and earn nigeria, make money online lagos, affiliate program nigeria, cleaning referrals'
  });

  const { user, loading: authLoading } = useAuth();
  const [ambassador, setAmbassador] = useState<TAmbassador | null>(null);
  const [referrals, setReferrals] = useState<TReferral[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Application form state
  const [appName, setAppName] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [agreedToEmails, setAgreedToEmails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (authLoading) return;
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const [profile, board] = await Promise.all([
          ambassadorService.getMyAmbassadorProfile(),
          ambassadorService.getLeaderboard()
        ]);
        setAmbassador(profile);
        setLeaderboard(board);

        if (profile) {
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
    if (!agreedToEmails) {
      setSubmitError('You must agree to receive your referral code via email.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    const application: TAmbassadorApplication = {
      name: appName,
      email: appEmail,
      phone: appPhone,
      reason: 'Instant Join Program' // filler for schema validation
    };

    const response = await ambassadorService.applyToProgram(application);

    if (response.success) {
      const activeAmbassador = response.data!;
      setAmbassador(activeAmbassador);

      // Trigger welcome email notification
      try {
        await emailService.sendAmbassadorWelcomeEmail(appName, appEmail, activeAmbassador.referral_code);
      } catch (emailErr) {
        console.warn('Welcome email failed to send:', emailErr);
      }
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

  const getAmbassadorTier = (points: number) => {
    if (points < 50) {
      return {
        current: 'Bronze',
        next: 'Silver',
        pointsNeeded: 50 - points,
        progress: (points / 50) * 100,
        desc: 'Accumulate 50 points to unlock Silver Grade and claim your first rewards!'
      };
    } else if (points < 100) {
      return {
        current: 'Silver',
        next: 'Gold',
        pointsNeeded: 100 - points,
        progress: ((points - 50) / 50) * 100,
        desc: 'Silver Grade active! Unlock Gold Grade at 100 points for even bigger rewards.'
      };
    } else if (points < 200) {
      return {
        current: 'Gold',
        next: 'Platinum',
        pointsNeeded: 200 - points,
        progress: ((points - 100) / 100) * 100,
        desc: 'Gold Grade active! Only a few more referrals to unlock the top Platinum status.'
      };
    } else {
      return {
        current: 'Platinum',
        next: null,
        pointsNeeded: 0,
        progress: 100,
        desc: 'Platinum Grade active! You have unlocked maximum rewards. Outstanding job! 👑'
      };
    }
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
                <span className="stat-number">5</span>
                <span className="stat-text">Points per referral</span>
              </div>
              <div className="ambassador-hero-stat">
                <span className="stat-number">50 pt</span>
                <span className="stat-text">For Reward Eligibility</span>
              </div>
              <div className="ambassador-hero-stat">
                <span className="stat-number">10%</span>
                <span className="stat-text">Discount for friends</span>
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

        {/* ── Suspended State ── */}
        {user && ambassador?.status === 'suspended' && (
          <motion.div
            className="ambassador-pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="pending-icon" style={{ background: 'var(--color-error-container)' }}>
              <AlertCircle size={48} color="var(--color-error)" />
            </div>
            <h2>Account Suspended</h2>
            <p>
              Your ambassador account has been suspended by an administrator.
              Please contact support at <a href="mailto:Lezervlimited@gmail.com">Lezervlimited@gmail.com</a>.
            </p>
          </motion.div>
        )}

        {/* ── Rejected State ── */}
        {user && ambassador?.status === 'rejected' && (
          <motion.div
            className="ambassador-pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="pending-icon" style={{ background: 'var(--color-error-container)' }}>
              <AlertCircle size={48} color="var(--color-error)" />
            </div>
            <h2>Registration Not Approved</h2>
            <p>
              Your ambassador profile is currently deactivated.
              Please contact support at <a href="mailto:Lezervlimited@gmail.com">Lezervlimited@gmail.com</a> for help.
            </p>
          </motion.div>
        )}

        {/* ── Join Form (no ambassador record yet) ── */}
        {user && !ambassador && (
          <motion.section
            className="ambassador-apply-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="apply-card">
              <h2>Join the Ambassador Program</h2>
              <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: 'var(--spacing-xl)' }}>
                Activate your account to receive your unique referral code instantly.
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

                <div className="form-group checkbox-group" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', margin: 'var(--spacing-md) 0' }}>
                  <input
                    type="checkbox"
                    id="agreedToEmails"
                    checked={agreedToEmails}
                    onChange={e => setAgreedToEmails(e.target.checked)}
                    required
                    style={{ marginTop: '0.25rem', cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <label htmlFor="agreedToEmails" style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--color-on-surface-variant)', cursor: 'pointer', lineHeight: '1.4' }}>
                    I agree to join the Lezerv Ambassador Program and receive my unique referral code at this email address.
                  </label>
                </div>

                {submitError && (
                  <div className="apply-error" style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-error)' }}>
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
                  {isSubmitting ? 'Activating...' : 'Join Now & Get Referral Code'}
                </Button>
              </form>
            </div>
          </motion.section>
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

            {/* Ambassador Grade Progress Card */}
            <motion.div
              className="tier-progress-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              style={{
                background: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--spacing-lg)',
                marginTop: 'var(--spacing-md)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="tier-header-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                <span className="tier-title" style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Ambassador Status</span>
                <span className={`tier-badge tier-${getAmbassadorTier(ambassador.total_points || 0).current.toLowerCase()}`} style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-size-label)',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%)',
                  color: 'white',
                  textTransform: 'uppercase'
                }}>
                  {getAmbassadorTier(ambassador.total_points || 0).current} Grade
                </span>
              </div>
              
              <div className="progress-bar-container" style={{
                background: 'var(--color-surface-variant)',
                borderRadius: 'var(--radius-full)',
                height: '12px',
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
                margin: '16px 0'
              }}>
                <div className="progress-bar-fill" style={{
                  background: 'linear-gradient(90deg, var(--color-secondary) 0%, var(--color-primary) 100%)',
                  height: '100%',
                  width: `${getAmbassadorTier(ambassador.total_points || 0).progress}%`,
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.4s ease'
                }} />
              </div>

              <div className="tier-footer-info" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-body-sm)', color: 'var(--color-on-surface-variant)', fontWeight: '500' }}>
                <span>{ambassador.total_points || 0} Points</span>
                {getAmbassadorTier(ambassador.total_points || 0).next ? (
                  <span>{getAmbassadorTier(ambassador.total_points || 0).pointsNeeded} points until {getAmbassadorTier(ambassador.total_points || 0).next} Grade</span>
                ) : (
                  <span>Max Grade Unlocked! 👑</span>
                )}
              </div>
              <p style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-body-sm)', color: 'var(--color-on-surface-variant)', lineHeight: '1.5' }}>
                {getAmbassadorTier(ambassador.total_points || 0).desc}
              </p>
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

            {/* Dashboard Sections Grid */}
            <div className="dashboard-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr',
              gap: 'var(--spacing-xl)',
              marginTop: 'var(--spacing-xl)'
            }}>
              {/* Left Column: Referral History */}
              <div className="referral-history" style={{ margin: 0 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)' }}>
                  <Share2 size={20} color="var(--color-primary)" />
                  Referral Activity
                </h3>
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

              {/* Right Column: Leaderboard */}
              <div className="leaderboard-section" style={{
                background: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--spacing-lg)'
              }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)' }}>
                  <Award size={20} color="var(--color-secondary)" />
                  Top Ambassadors
                </h3>
                {leaderboard.length === 0 ? (
                  <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--font-size-body-sm)' }}>No data available.</p>
                ) : (
                  <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {leaderboard.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'var(--color-surface-container-high)',
                        borderRadius: 'var(--radius-md)',
                        border: item.name === ambassador.name ? '1px solid var(--color-primary)' : 'none'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--color-surface-variant)',
                            color: idx < 3 ? '#1e293b' : 'var(--color-on-surface-variant)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--font-size-label)',
                            fontWeight: 'bold'
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{
                            fontWeight: item.name === ambassador.name ? 'bold' : 'normal',
                            fontSize: 'var(--font-size-body-md)'
                          }}>
                            {item.name} {item.name === ambassador.name && ' (You)'}
                          </span>
                        </div>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{item.total_points || 0} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Ambassador;
