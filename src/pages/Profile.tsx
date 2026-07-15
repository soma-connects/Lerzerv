import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, LogOut, LayoutGrid, ClipboardList, Briefcase, Star, ShieldCheck,
  Clock, Loader2, Check, Download, Trash2, KeyRound, Bell, Award, MapPin, Search, Save, Camera,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { artisanService } from '../services/artisanService';
import { ambassadorService } from '../services/ambassadorService';
import { userService } from '../services/userService';
import { contactService } from '../services/contactService';
import './Profile.css';
import './ProfileHub.css';

type Tab = 'overview' | 'activity' | 'settings';

const Profile: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [artisan, setArtisan] = useState<any | null>(null);
  const [available, setAvailable] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [ambassador, setAmbassador] = useState<any | null>(null);

  // settings state
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (!loading && !user) navigate('/login'); }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setFullName(user.user_metadata?.full_name || '');
    setAvatarUrl(user.user_metadata?.avatar_url || null);
    try {
      try { await bookingService.syncGuestBookings(); } catch { /* non-blocking */ }
      const [art, dispatch, board, ledger, amb] = await Promise.all([
        artisanService.getMyProfile(),
        artisanService.getDispatchJobs(),
        Promise.resolve(null),
        bookingService.getMyBookings(),
        ambassadorService.getMyAmbassadorProfile(),
      ]);
      void board;
      setArtisan(art);
      if (art?.avatar_url) setAvatarUrl(art.avatar_url);
      setAvailable(!!art?.is_available);
      setJobs(dispatch.jobs);
      setBookings(ledger);
      setAmbassador(amb);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !user) return <div className="loading-container">Loading profile…</div>;

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const posted = jobs.filter((j) => j.iAmClient);
  const assigned = jobs.filter((j) => j.iAmAssigned);
  const activeCount = posted.filter((j) => ['open', 'assigned', 'in_progress'].includes(j.status)).length;
  const completedCount = posted.filter((j) => j.status === 'completed').length;

  const toggleAvailability = async () => {
    const next = !available; setAvailable(next);
    await artisanService.setAvailability(next);
  };

  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    const url = await userService.uploadAvatar(file);
    setAvatarBusy(false);
    if (url) setAvatarUrl(`${url}?t=${Date.now()}`);
  };

  const saveName = async () => {
    setSavingName(true); setNameMsg(null);
    const res = await userService.updateMyProfile(fullName.trim());
    setSavingName(false);
    setNameMsg(res.success ? 'Saved!' : (res.error?.message || 'Failed to save.'));
    setTimeout(() => setNameMsg(null), 3000);
  };

  const sendReset = async () => {
    const res = await userService.sendPasswordReset(user.email!);
    setResetMsg(res.success ? `Reset link sent to ${user.email}.` : (res.error?.message || 'Failed.'));
    setTimeout(() => setResetMsg(null), 5000);
  };

  const exportData = async () => {
    setExporting(true);
    const payload = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name },
      artisan_profile: artisan,
      dispatch_jobs: jobs,
      service_bookings: bookings,
      ambassador: ambassador,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lezerv-my-data-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const requestDeletion = async () => {
    if (!window.confirm('Request permanent deletion of your Lezerv account and data? Our team will process this within 30 days.')) return;
    const res = await contactService.submitInquiry({
      name: user.user_metadata?.full_name || 'User',
      email: user.email!,
      subject: 'Account Deletion Request (NDPA)',
      message: `User ${user.email} (id ${user.id}) has requested deletion of their account and personal data.`,
    });
    alert(res.success ? 'Your deletion request has been received. We will process it within 30 days.' : 'Could not submit request. Please contact support.');
  };

  const initial = (user.user_metadata?.full_name || user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-layout">
          {/* Sidebar */}
          <aside className="profile-sidebar">
            <div className="user-brief">
              <button type="button" className="user-avatar avatar-editable" onClick={() => avatarInput.current?.click()}
                title="Change profile photo" disabled={avatarBusy}>
                {avatarBusy ? <Loader2 className="animate-spin" size={22} /> : avatarUrl ? <img src={avatarUrl} alt="Profile" /> : initial}
                <span className="avatar-cam"><Camera size={13} /></span>
                <input ref={avatarInput} type="file" accept="image/*" hidden onChange={onAvatarPick} />
              </button>
              <div className="user-meta">
                <h3>{user.user_metadata?.full_name || 'User'}</h3>
                <p>{user.email}</p>
              </div>
            </div>
            <div className="role-chips">
              <span className="role-chip client">Client</span>
              {artisan && <span className={`role-chip artisan ${artisan.status}`}>Artisan · {artisan.status}</span>}
              {ambassador?.status === 'approved' && <span className="role-chip amb">Ambassador</span>}
            </div>
            <nav className="profile-nav">
              <button className={`nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}><LayoutGrid size={18} /> Overview</button>
              <button className={`nav-item ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}><ClipboardList size={18} /> Activity</button>
              <button className={`nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><Settings size={18} /> Settings</button>
              <hr />
              <button className="nav-item logout" onClick={handleSignOut}><LogOut size={18} /> Sign Out</button>
            </nav>
          </aside>

          {/* Main */}
          <main className="profile-main">
            {isLoading ? (
              <div className="profile-loading"><Loader2 className="animate-spin" size={28} /></div>
            ) : tab === 'overview' ? (
              <>
                <header className="profile-header">
                  <h1>Welcome back{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}</h1>
                  <p>Your Lezerv account at a glance.</p>
                </header>

                {/* Artisan availability banner */}
                {artisan?.status === 'approved' && (
                  <div className="avail-banner">
                    <div>
                      <h3>Ready for work?</h3>
                      <p>{available ? "You're visible and receiving jobs in your areas." : "You're offline — turn on to receive jobs."}</p>
                    </div>
                    <button className={`toggle ${available ? 'on' : ''}`} onClick={toggleAvailability} aria-pressed={available}><span className="knob" /></button>
                  </div>
                )}
                {artisan?.status === 'pending' && (
                  <div className="pending-banner"><Clock size={18} /><span>Your artisan profile is under review. You'll be notified once approved.</span></div>
                )}

                {/* Stat cards */}
                <div className="stat-row">
                  <div className="pstat"><span className="pstat-num">{posted.length}</span><span className="pstat-label"><ClipboardList size={14} /> Jobs posted</span></div>
                  <div className="pstat"><span className="pstat-num">{activeCount}</span><span className="pstat-label"><Clock size={14} /> Active</span></div>
                  <div className="pstat"><span className="pstat-num">{completedCount}</span><span className="pstat-label"><Check size={14} /> Completed</span></div>
                  {artisan && (
                    <>
                      <div className="pstat"><span className="pstat-num">{Number(artisan.avg_rating || 0).toFixed(1)}<Star size={16} className="inline-star" /></span><span className="pstat-label">Rating ({artisan.total_reviews || 0})</span></div>
                      <div className="pstat"><span className="pstat-num">{artisan.completed_jobs || 0}</span><span className="pstat-label"><Briefcase size={14} /> Jobs done</span></div>
                    </>
                  )}
                </div>

                {/* Quick actions */}
                <section className="profile-section">
                  <div className="section-header"><h2>Quick actions</h2></div>
                  <div className="quick-grid">
                    <Link to="/post-job" className="quick-card"><ClipboardList size={22} /><span>Apply for Service</span></Link>
                    <Link to="/find-artisans" className="quick-card"><Search size={22} /><span>Find artisans</span></Link>
                    <Link to="/my-jobs" className="quick-card"><Briefcase size={22} /><span>My jobs{assigned.length > 0 ? ` (${assigned.length})` : ''}</span></Link>
                    <Link to="/become-artisan" className="quick-card"><ShieldCheck size={22} /><span>{artisan ? 'Manage artisan profile' : 'Become an artisan'}</span></Link>
                    <Link to="/ambassador" className="quick-card"><Award size={22} /><span>{ambassador ? 'Ambassador dashboard' : 'Refer & earn'}</span></Link>
                  </div>
                </section>

                {artisan && (artisan.areaSlugs?.length === 0) && (
                  <div className="tip-banner"><MapPin size={18} /><span>Add the Lagos areas you cover so clients and jobs can find you. <Link to="/become-artisan">Add areas →</Link></span></div>
                )}
              </>
            ) : tab === 'activity' ? (
              <>
                <header className="profile-header"><h1>Activity</h1><p>Your recent jobs and service history.</p></header>

                <section className="profile-section">
                  <div className="section-header"><h2>Recent jobs</h2><Link to="/my-jobs"><Button variant="text" size="sm">View all</Button></Link></div>
                  {jobs.length === 0 ? (
                    <div className="empty-bookings"><ClipboardList size={40} className="empty-icon" /><p>No jobs yet.</p><Link to="/post-job"><Button variant="outline" size="sm">Apply for Service</Button></Link></div>
                  ) : (
                    <div className="activity-list">
                      {jobs.slice(0, 8).map((j) => (
                        <Link to="/my-jobs" key={j.id} className="activity-row">
                          <div><strong>{j.title}</strong><span className="activity-sub">{j.iAmClient ? 'Posted' : 'Assigned to you'}{j.category_name ? ` · ${j.category_name}` : ''}{j.area_name ? ` · ${j.area_name}` : ''}</span></div>
                          <span className={`status-pill status-${j.status}`}>{j.status.replace('_', ' ')}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                {bookings.length > 0 && (
                  <section className="profile-section">
                    <div className="section-header"><h2>Service bookings</h2></div>
                    <div className="activity-list">
                      {bookings.map((b) => (
                        <div key={b.id} className="activity-row">
                          <div><strong>{b.service_name}</strong><span className="activity-sub">{b.order_number} · {b.date}</span></div>
                          <div className="activity-right">
                            <span className={`status-pill status-${(b.status || '').replace(/[ /]/g, '-')}`}>{b.status}</span>
                            {b.status === 'approved' && b.payment_status === 'unpaid' && <Link to={`/payment/${b.id}`}><Button variant="primary" size="sm">Pay</Button></Link>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
                <header className="profile-header"><h1>Settings</h1><p>Manage your account, security and data.</p></header>

                <section className="profile-section">
                  <div className="section-header"><h2>Profile</h2></div>
                  <div className="setting-field">
                    <label>Display name</label>
                    <div className="inline-edit">
                      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                      <Button variant="primary" size="sm" onClick={saveName} disabled={savingName} leftIcon={savingName ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}>Save</Button>
                    </div>
                    {nameMsg && <span className="setting-msg">{nameMsg}</span>}
                  </div>
                  <div className="setting-field">
                    <label>Email</label>
                    <div className="readonly-field">{user.email}</div>
                  </div>
                </section>

                <section className="profile-section">
                  <div className="section-header"><h2>Security</h2></div>
                  <div className="setting-row">
                    <div className="setting-icon"><KeyRound size={20} /></div>
                    <div className="setting-info"><h4>Password</h4><p>We'll email you a secure link to set a new password.</p></div>
                    <Button variant="outline" size="sm" onClick={sendReset}>Send reset link</Button>
                  </div>
                  {resetMsg && <div className="setting-msg block">{resetMsg}</div>}
                </section>

                <section className="profile-section">
                  <div className="section-header"><h2>Notifications</h2></div>
                  <div className="setting-row">
                    <div className="setting-icon"><Bell size={20} /></div>
                    <div className="setting-info"><h4>In-app alerts</h4><p>You'll get a bell notification for new jobs, assignments and messages. SMS & email alerts are coming soon.</p></div>
                    <span className="setting-tag on">On</span>
                  </div>
                </section>

                <section className="profile-section">
                  <div className="section-header"><h2>Your data &amp; privacy</h2></div>
                  <div className="setting-row">
                    <div className="setting-icon"><Download size={20} /></div>
                    <div className="setting-info"><h4>Export my data</h4><p>Download a copy of your account, jobs and reviews (JSON).</p></div>
                    <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>{exporting ? 'Preparing…' : 'Export'}</Button>
                  </div>
                  <div className="setting-row">
                    <div className="setting-icon danger"><Trash2 size={20} /></div>
                    <div className="setting-info"><h4>Delete my account</h4><p>Request permanent deletion of your account and personal data.</p></div>
                    <Button variant="text" size="sm" className="danger-text" onClick={requestDeletion}>Request deletion</Button>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Profile;
