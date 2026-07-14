import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, User, ChevronDown, LogOut, Briefcase, LayoutDashboard, Bell,
  Sparkles, Wrench, Zap, ShieldCheck, ClipboardList, Award, Search,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type INotification } from '../../services/notificationService';
import './Header.css';

// Artisan categories grouped for the Services mega-menu
const serviceGroups: { label: string; icon: React.ReactNode; items: [string, string][] }[] = [
  { label: 'Home Care', icon: <Sparkles size={16} />, items: [
    ['cleaning', 'Cleaning'], ['painting', 'Painting'], ['pest-control', 'Pest Control'], ['landscaping', 'Gardening & Landscaping'],
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
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unread = notifications.filter((n) => !n.read).length;
  const toggle = (name: string) => setOpenMenu((cur) => (cur === name ? null : name));

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
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => { setOpenMenu(null); setIsMenuOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    let channel: any;
    notificationService.list().then(setNotifications);
    channel = notificationService.subscribe(user.id, (n) =>
      setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]))
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

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-container">
        <Link to="/" className="logo"><img src="/logo.png" alt="Lezerv" className="logo-img" /></Link>

        <nav className="nav-desktop" ref={navRef}>
          <ul className="nav-list">
            {/* Services mega-menu */}
            <li className={`nav-dropdown ${openMenu === 'services' ? 'open' : ''}`}
              onMouseEnter={() => hoverOpen('services')} onMouseLeave={hoverClose}>
              <button className="nav-link nav-trigger" onClick={() => toggle('services')}>
                Services <ChevronDown size={15} className={`chev ${openMenu === 'services' ? 'open' : ''}`} />
              </button>
              {openMenu === 'services' && (
                <div className="mega-menu">
                  <div className="mega-groups">
                    {serviceGroups.map((g) => (
                      <div className="mega-col" key={g.label}>
                        <span className="mega-col-title">{g.icon} {g.label}</span>
                        {g.items.map(([slug, name]) => (
                          <Link key={slug} to={`/find-artisans?category=${slug}`} className="mega-item">{name}</Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="mega-foot">
                    <Link to="/find-artisans" className="mega-foot-link"><Search size={16} /> Browse all artisans</Link>
                    <Link to="/post-job"><Button variant="primary" size="sm" leftIcon={<ClipboardList size={15} />}>Post a job</Button></Link>
                  </div>
                </div>
              )}
            </li>

            {/* For Artisans */}
            <li className={`nav-dropdown ${openMenu === 'artisans' ? 'open' : ''}`}
              onMouseEnter={() => hoverOpen('artisans')} onMouseLeave={hoverClose}>
              <button className="nav-link nav-trigger" onClick={() => toggle('artisans')}>
                For Artisans <ChevronDown size={15} className={`chev ${openMenu === 'artisans' ? 'open' : ''}`} />
              </button>
              {openMenu === 'artisans' && (
                <div className="dropdown-menu">
                  <Link to="/become-artisan" className="dropdown-item"><ShieldCheck size={16} /> Become an artisan</Link>
                  {user && <Link to="/my-jobs" className="dropdown-item"><Briefcase size={16} /> My jobs</Link>}
                  <Link to="/ambassador" className="dropdown-item"><Award size={16} /> Refer &amp; earn</Link>
                </div>
              )}
            </li>

            {/* Company */}
            <li className={`nav-dropdown ${openMenu === 'company' ? 'open' : ''}`}
              onMouseEnter={() => hoverOpen('company')} onMouseLeave={hoverClose}>
              <button className="nav-link nav-trigger" onClick={() => toggle('company')}>
                Company <ChevronDown size={15} className={`chev ${openMenu === 'company' ? 'open' : ''}`} />
              </button>
              {openMenu === 'company' && (
                <div className="dropdown-menu">
                  {companyLinks.map((l) => <Link key={l.name} to={l.path} className="dropdown-item">{l.name}</Link>)}
                </div>
              )}
            </li>
          </ul>

          <div className="nav-actions">
            {user && (
              <div className={`nav-dropdown ${openMenu === 'bell' ? 'open' : ''}`}>
                <button className="bell-btn" onClick={() => toggle('bell')} aria-label="Notifications">
                  <Bell size={19} />
                  {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
                </button>
                {openMenu === 'bell' && (
                  <div className="dropdown-menu dropdown-right notif-menu">
                    <div className="notif-head">
                      <strong>Notifications</strong>
                      {unread > 0 && <button className="notif-markall" onClick={markAll}>Mark all read</button>}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="notif-empty">You're all caught up.</div>
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

            <Link to="/post-job" className="cta-desktop"><Button variant="primary" size="md" leftIcon={<ClipboardList size={17} />}>Post a Job</Button></Link>

            {user ? (
              <div className={`nav-dropdown ${openMenu === 'user' ? 'open' : ''}`}>
                <button className="user-chip" onClick={() => toggle('user')}>
                  <span className="user-avatar"><User size={16} /></span>
                  <ChevronDown size={15} className={`chev ${openMenu === 'user' ? 'open' : ''}`} />
                </button>
                {openMenu === 'user' && (
                  <div className="dropdown-menu dropdown-right">
                    <Link to="/profile" className="dropdown-item"><User size={16} /> My account</Link>
                    <Link to="/my-jobs" className="dropdown-item"><Briefcase size={16} /> My jobs</Link>
                    {isAdmin && <Link to="/admin" className="dropdown-item"><LayoutDashboard size={16} /> Admin</Link>}
                    <button className="dropdown-item danger" onClick={() => signOut()}><LogOut size={16} /> Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login"><Button variant="text" size="md">Login</Button></Link>
            )}
          </div>
        </nav>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`nav-mobile ${isMenuOpen ? 'nav-mobile-open' : ''}`}>
        <div className="nav-mobile-scroll">
          <span className="mob-heading">Services</span>
          {serviceGroups.flatMap((g) => g.items).map(([slug, name]) => (
            <Link key={slug} to={`/find-artisans?category=${slug}`} className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>{name}</Link>
          ))}
          <Link to="/find-artisans" className="nav-mobile-link strong" onClick={() => setIsMenuOpen(false)}>Browse all artisans</Link>

          <span className="mob-heading">For Artisans</span>
          <Link to="/become-artisan" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>Become an artisan</Link>
          {user && <Link to="/my-jobs" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>My jobs</Link>}
          <Link to="/ambassador" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>Refer &amp; earn</Link>

          <span className="mob-heading">Company</span>
          {companyLinks.map((l) => <Link key={l.name} to={l.path} className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>{l.name}</Link>)}

          {user && <><span className="mob-heading">Account</span>
            <Link to="/profile" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>My account</Link>
            {isAdmin && <Link to="/admin" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>Admin</Link>}</>}

          <div className="nav-mobile-cta">
            <Link to="/post-job" onClick={() => setIsMenuOpen(false)}><Button variant="primary" size="lg" fullWidth>Post a Job</Button></Link>
            {user ? (
              <Button variant="outline" size="lg" fullWidth onClick={() => { signOut(); setIsMenuOpen(false); }}>Log out</Button>
            ) : (
              <Link to="/login" onClick={() => setIsMenuOpen(false)}><Button variant="outline" size="lg" fullWidth>Login</Button></Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
