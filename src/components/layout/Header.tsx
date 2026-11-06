import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, User, ChevronDown, LogOut, Briefcase, LayoutDashboard, Bell,
  Sparkles, Wrench, Zap, ShieldCheck, ClipboardList, Award, Search, ArrowRight,
} from 'lucide-react';
import { LinkButton } from '../ui/LinkButton';
import { BrandLogo } from '../ui/BrandLogo';
import { LocationPicker } from '../location/LocationPicker';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type INotification } from '../../services/notificationService';
import './Header.css';

// Artisan categories grouped for the Services mega-menu
const serviceGroups: { label: string; icon: React.ReactNode; items: [string, string][] }[] = [
  { label: 'Home Care', icon: <Sparkles size={16} />, items: [
    ['cleaning', 'Cleaning'], ['laundry', 'Laundry'], ['cooking', 'Cooking'], ['painting', 'Painting'], ['pest-control', 'Pest Control'], ['landscaping', 'Gardening & Landscaping'],
  ] },
  { label: 'Repairs & Fittings', icon: <Wrench size={16} />, items: [
    ['plumbing', 'Plumbing'], ['carpentry', 'Carpentry'], ['masonry-tiling', 'Masonry & Tiling'], ['appliance-repair', 'Appliance Repair'],
  ] },
  { label: 'Power & Water', icon: <Zap size={16} />, items: [
    ['electrical', 'Electrical'], ['generator-power', 'Generator & Power'], ['solar-inverter', 'Solar & Inverter'], ['ac-refrigeration', 'AC & Refrigeration'], ['borehole-water', 'Borehole & Water'],
  ] },
  { label: 'Security', icon: <ShieldCheck size={16} />, items: [
    ['home-security', 'Home Security'],
  ] },
];

const companyLinks = [
  { name: 'About', path: '/about' },
  { name: 'Blog & Events', path: '/blog' },
  { name: 'How it works', path: '/services' },
  { name: 'Careers', path: '/careers' },
  { name: 'Track Order', path: '/track' },
  { name: 'Contact', path: '/contact' },
];

export const Header: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Notifications are stored with the id of the user they belong to, so a
  // different (or signed-out) user never sees someone else's list.
  const [notifState, setNotifState] = useState<{ uid: string | null; items: INotification[] }>({ uid: null, items: [] });
  const location = useLocation();
  const navigate = useNavigate();
  const barRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifications = user && notifState.uid === user.id ? notifState.items : [];
  const setNotifications = (fn: (prev: INotification[]) => INotification[]) =>
    setNotifState((st) => ({ ...st, items: fn(st.items) }));
  const unread = notifications.filter((n) => !n.read).length;
  const toggle = (name: string) => setOpenMenu((cur) => (cur === name ? null : name));
  const closeMobile = () => setIsMenuOpen(false);
  // Links inside the closed phone menu shouldn't be reachable with Tab.
  const sheetTab = isMenuOpen ? 0 : -1;

  // Hover-open for the desktop nav menus (with a small close delay so the
  // gap between trigger and panel doesn't make it flicker shut).
  const hoverOpen = (name: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpenMenu(name);
  };
  const hoverClose = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenMenu(null), 160);
  };

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Click outside the bar closes any open dropdown; Escape closes everything.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenMenu(null); setIsMenuOpen(false); }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // When the page changes, close any open menu. (Done while rendering rather
  // than in an effect: React's recommended way to reset state on a change.)
  const routeKey = location.pathname + location.search;
  const [lastRoute, setLastRoute] = useState(routeKey);
  if (routeKey !== lastRoute) {
    setLastRoute(routeKey);
    setOpenMenu(null);
    setIsMenuOpen(false);
  }

  // While the phone menu is open, stop the page behind it from scrolling.
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    notificationService.list().then((items) => setNotifState({ uid, items }));
    const channel = notificationService.subscribe(uid, (n) =>
      setNotifState((st) => (st.uid !== uid || st.items.some((p) => p.id === n.id) ? st : { uid, items: [n, ...st.items] }))
    );
    return () => { if (channel) notificationService.unsubscribe(channel); };
  }, [user]);

  const openNotification = async (n: INotification) => {
    setOpenMenu(null);
    if (!n.read) {
      await notificationService.markRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) navigate(n.link);
  };
  const markAll = async () => {
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;

  return (
    <header className={['hdr', isScrolled || isMenuOpen ? 'hdr-scrolled' : '', isMenuOpen ? 'hdr-sheet-open' : ''].filter(Boolean).join(' ')}>
      <div className="container hdr-bar" ref={barRef}>
        <Link to="/" className="hdr-logo" aria-label="Lezerv home"><BrandLogo /></Link>
        <LocationPicker />

        <nav className="hdr-nav" aria-label="Main">
          <ul className="hdr-nav-list">
            {/* Services mega-menu */}
            <li className="hdr-dropdown" onMouseEnter={() => hoverOpen('services')} onMouseLeave={hoverClose}>
              <button className={`hdr-link ${openMenu === 'services' ? 'is-open' : ''}`} onClick={() => toggle('services')} aria-expanded={openMenu === 'services'}>
                Services <ChevronDown size={15} className="hdr-chev" />
              </button>
              {openMenu === 'services' && (
                <div className="hdr-mega">
                  <div className="hdr-mega-groups">
                    {serviceGroups.map((g) => (
                      <div className="hdr-mega-col" key={g.label}>
                        <span className="hdr-mega-title"><span className="hdr-mega-icon">{g.icon}</span>{g.label}</span>
                        {g.items.map(([slug, name]) => (
                          <Link key={slug} to={`/find-artisans?category=${slug}`} className="hdr-mega-item">{name}</Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="hdr-mega-foot">
                    <Link to="/find-artisans" className="hdr-mega-all"><Search size={16} /> Browse all artisans <ArrowRight size={15} /></Link>
                    <LinkButton to="/post-job" size="sm" leftIcon={<ClipboardList size={15} />}>Request for Service</LinkButton>
                  </div>
                </div>
              )}
            </li>

            {/* For Artisans */}
            <li className="hdr-dropdown" onMouseEnter={() => hoverOpen('artisans')} onMouseLeave={hoverClose}>
              <button className={`hdr-link ${openMenu === 'artisans' ? 'is-open' : ''}`} onClick={() => toggle('artisans')} aria-expanded={openMenu === 'artisans'}>
                For Artisans <ChevronDown size={15} className="hdr-chev" />
              </button>
              {openMenu === 'artisans' && (
                <div className="hdr-menu">
                  <Link to="/become-artisan" className="hdr-menu-item"><ShieldCheck size={16} /> Become an artisan</Link>
                  {user && <Link to="/my-jobs" className="hdr-menu-item"><Briefcase size={16} /> My jobs</Link>}
                  <Link to="/ambassador" className="hdr-menu-item"><Award size={16} /> Refer &amp; earn</Link>
                </div>
              )}
            </li>

            {/* Company */}
            <li className="hdr-dropdown" onMouseEnter={() => hoverOpen('company')} onMouseLeave={hoverClose}>
              <button className={`hdr-link ${openMenu === 'company' ? 'is-open' : ''}`} onClick={() => toggle('company')} aria-expanded={openMenu === 'company'}>
                Company <ChevronDown size={15} className="hdr-chev" />
              </button>
              {openMenu === 'company' && (
                <div className="hdr-menu">
                  {companyLinks.map((l) => <Link key={l.name} to={l.path} className="hdr-menu-item">{l.name}</Link>)}
                </div>
              )}
            </li>
          </ul>
        </nav>

        <div className="hdr-actions">
          {/* Notifications: shown on phones too, next to the menu button */}
          {user && (
            <div className="hdr-dropdown">
              <button
                className="hdr-icon-btn"
                onClick={() => toggle('bell')}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={openMenu === 'bell'}
              >
                <Bell size={19} />
                {unread > 0 && <span className="hdr-badge">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {openMenu === 'bell' && (
                <div className="hdr-menu hdr-menu-right notif-menu">
                  <div className="notif-head">
                    <strong>Notifications</strong>
                    {unread > 0 && <button className="notif-markall" onClick={markAll}>Mark all read</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty"><Bell size={22} /><span>You're all caught up.</span></div>
                  ) : (
                    notifications.slice(0, 12).map((n) => (
                      <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => openNotification(n)}>
                        <span className="notif-title">{n.title}</span>
                        {n.body && <span className="notif-body">{n.body}</span>}
                        <span className="notif-time">{new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <LinkButton to="/post-job" className="hdr-cta" leftIcon={<ClipboardList size={17} />}>Request for Service</LinkButton>

          {user ? (
            <div className="hdr-dropdown hdr-desktop-only">
              <button className={`hdr-user ${openMenu === 'user' ? 'is-open' : ''}`} onClick={() => toggle('user')} aria-label="Your account" aria-expanded={openMenu === 'user'}>
                <span className="hdr-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={16} />}
                </span>
                <ChevronDown size={15} className="hdr-chev" />
              </button>
              {openMenu === 'user' && (
                <div className="hdr-menu hdr-menu-right">
                  {user.email && <div className="hdr-menu-label">{user.email}</div>}
                  <Link to="/profile" className="hdr-menu-item"><User size={16} /> My account</Link>
                  <Link to="/my-jobs" className="hdr-menu-item"><Briefcase size={16} /> My jobs</Link>
                  {isAdmin && <Link to="/admin" className="hdr-menu-item"><LayoutDashboard size={16} /> Admin dashboard</Link>}
                  <button className="hdr-menu-item danger" onClick={() => signOut()}><LogOut size={16} /> Log out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="hdr-login hdr-desktop-only">Log in</Link>
          )}

          <button
            className="hdr-burger"
            onClick={() => setIsMenuOpen((o) => !o)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Phone / tablet menu: a sheet that slides down under the bar */}
      <div id="mobile-menu" className={`hdr-sheet ${isMenuOpen ? 'open' : ''}`} aria-hidden={!isMenuOpen}>
        <div className="hdr-sheet-inner container">
          <LinkButton to="/post-job" onClick={closeMobile} size="lg" fullWidth leftIcon={<ClipboardList size={18} />} tabIndex={sheetTab}>
            Request for Service
          </LinkButton>

          {user && (
            <Link to="/profile" onClick={closeMobile} className="hdr-sheet-account" tabIndex={sheetTab}>
              <span className="hdr-avatar hdr-avatar-lg">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={18} />}
              </span>
              <span className="hdr-sheet-account-text">
                <strong>My account</strong>
                {user.email && <span>{user.email}</span>}
              </span>
              <ArrowRight size={18} />
            </Link>
          )}

          <span className="hdr-sheet-heading">Services</span>
          <div className="hdr-sheet-chips">
            {serviceGroups.flatMap((g) => g.items).map(([slug, name]) => (
              <Link key={slug} to={`/find-artisans?category=${slug}`} className="hdr-chip" onClick={closeMobile} tabIndex={sheetTab}>{name}</Link>
            ))}
          </div>
          <Link to="/find-artisans" className="hdr-sheet-link strong" onClick={closeMobile} tabIndex={sheetTab}>
            <Search size={18} /> Browse all artisans <ArrowRight size={16} className="push" />
          </Link>

          <span className="hdr-sheet-heading">For artisans</span>
          <Link to="/become-artisan" className="hdr-sheet-link" onClick={closeMobile} tabIndex={sheetTab}><ShieldCheck size={18} /> Become an artisan</Link>
          {user && <Link to="/my-jobs" className="hdr-sheet-link" onClick={closeMobile} tabIndex={sheetTab}><Briefcase size={18} /> My jobs</Link>}
          <Link to="/ambassador" className="hdr-sheet-link" onClick={closeMobile} tabIndex={sheetTab}><Award size={18} /> Refer &amp; earn</Link>
          {isAdmin && <Link to="/admin" className="hdr-sheet-link" onClick={closeMobile} tabIndex={sheetTab}><LayoutDashboard size={18} /> Admin dashboard</Link>}

          <span className="hdr-sheet-heading">Company</span>
          <div className="hdr-sheet-grid">
            {companyLinks.map((l) => (
              <Link key={l.name} to={l.path} className="hdr-sheet-link small" onClick={closeMobile} tabIndex={sheetTab}>{l.name}</Link>
            ))}
          </div>

          <div className="hdr-sheet-foot">
            {user ? (
              <button className="btn btn-outline btn-lg btn-full-width" onClick={() => { signOut(); closeMobile(); }} tabIndex={sheetTab}>
                <LogOut size={18} /> Log out
              </button>
            ) : (
              <LinkButton to="/login" variant="outline" size="lg" fullWidth onClick={closeMobile} tabIndex={sheetTab}>Log in</LinkButton>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
