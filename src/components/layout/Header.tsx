import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, ChevronDown, LogOut, Briefcase, LayoutDashboard, Bell } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type INotification } from '../../services/notificationService';
import './Header.css';

// Primary links always visible on desktop
const primaryLinks = [
  { name: 'Post a Job', path: '/post-job' },
  { name: 'Find Artisans', path: '/find-artisans' },
  { name: 'For Artisans', path: '/become-artisan' },
];

// Secondary links tucked into the "More" dropdown
const moreLinks = [
  { name: 'About', path: '/about' },
  { name: 'How it works', path: '/services' },
  { name: 'Careers', path: '/careers' },
  { name: 'Ambassador', path: '/ambassador' },
  { name: 'Track Order', path: '/track' },
  { name: 'Contact', path: '/contact' },
];

const allMobileLinks = [{ name: 'Home', path: '/' }, ...primaryLinks, ...moreLinks];

export const Header: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const moreRef = useRef<HTMLLIElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

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
    setBellOpen(false);
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

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click or route change
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setUserOpen(false);
    setBellOpen(false);
    setIsMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-container">
        <Link to="/" className="logo">
          <img src="/logo.png" alt="Lezerv" className="logo-img" />
        </Link>

        <nav className="nav-desktop">
          <ul className="nav-list">
            {primaryLinks.map((link) => (
              <li key={link.path}>
                <Link to={link.path} className={`nav-link ${isActive(link.path) ? 'nav-link-active' : ''}`}>
                  {link.name}
                </Link>
              </li>
            ))}
            <li className="nav-dropdown" ref={moreRef}>
              <button className="nav-link nav-more" onClick={() => setMoreOpen((v) => !v)}>
                More <ChevronDown size={15} className={`chev ${moreOpen ? 'open' : ''}`} />
              </button>
              {moreOpen && (
                <div className="dropdown-menu">
                  {moreLinks.map((link) => (
                    <Link key={link.name} to={link.path} className="dropdown-item">{link.name}</Link>
                  ))}
                </div>
              )}
            </li>
          </ul>

          <div className="nav-actions">
            {user && (
              <div className="nav-dropdown" ref={bellRef}>
                <button className="bell-btn" onClick={() => setBellOpen((v) => !v)} aria-label="Notifications">
                  <Bell size={19} />
                  {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
                </button>
                {bellOpen && (
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
            {user ? (
              <div className="nav-dropdown" ref={userRef}>
                <button className="user-chip" onClick={() => setUserOpen((v) => !v)}>
                  <span className="user-avatar"><User size={16} /></span>
                  <ChevronDown size={15} className={`chev ${userOpen ? 'open' : ''}`} />
                </button>
                {userOpen && (
                  <div className="dropdown-menu dropdown-right">
                    <Link to="/my-jobs" className="dropdown-item"><Briefcase size={16} /> My Jobs</Link>
                    <Link to="/profile" className="dropdown-item"><User size={16} /> Profile</Link>
                    {isAdmin && <Link to="/admin" className="dropdown-item"><LayoutDashboard size={16} /> Admin</Link>}
                    <button className="dropdown-item danger" onClick={() => signOut()}><LogOut size={16} /> Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login"><Button variant="text" size="md">Login</Button></Link>
                <Link to="/find-artisans"><Button variant="primary" size="md">Get Started</Button></Link>
              </>
            )}
          </div>
        </nav>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`nav-mobile ${isMenuOpen ? 'nav-mobile-open' : ''}`}>
        <ul className="nav-mobile-list">
          {allMobileLinks.map((link) => (
            <li key={link.name}>
              <Link to={link.path} className={`nav-mobile-link ${isActive(link.path) ? 'nav-mobile-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}>
                {link.name}
              </Link>
            </li>
          ))}
          {user && (
            <>
              <li><Link to="/my-jobs" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>My Jobs</Link></li>
              <li><Link to="/profile" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>Profile</Link></li>
              {isAdmin && <li><Link to="/admin" className="nav-mobile-link" onClick={() => setIsMenuOpen(false)}>Admin</Link></li>}
            </>
          )}
          <li className="nav-mobile-cta">
            {user ? (
              <Button variant="outline" size="lg" fullWidth onClick={() => { signOut(); setIsMenuOpen(false); }}>Log out</Button>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMenuOpen(false)}><Button variant="outline" size="lg" fullWidth>Login</Button></Link>
                <Link to="/find-artisans" onClick={() => setIsMenuOpen(false)}><Button variant="primary" size="lg" fullWidth>Get Started</Button></Link>
              </>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
};
