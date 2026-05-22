import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import './Header.css';

export const Header: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'About', path: '/about' },
    { name: 'Careers', path: '/careers' },
    { name: 'Contact', path: '/contact' },
    { name: 'Track Order', path: '/track' },
  ];

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-container">
        <Link to="/" className="logo">
          <img src="/logo.png" alt="Lezerv Logo" className="logo-img" />
        </Link>

        <nav className="nav-desktop">
          <ul className="nav-list">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`nav-link ${location.pathname === link.path ? 'nav-link-active' : ''}`}
                >
                  {link.name}
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'nav-link-active' : ''}`}>
                  Admin
                </Link>
              </li>
            )}
          </ul>
          <div className="nav-actions">
            {user ? (
              <Link to="/profile">
                <Button variant="outline" size="md" leftIcon={<User size={18} />}>Profile</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="text" size="md">Login</Button>
                </Link>
                <Link to="/services">
                  <Button variant="primary" size="md">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </nav>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`nav-mobile ${isMenuOpen ? 'nav-mobile-open' : ''}`}>
        <ul className="nav-mobile-list">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`nav-mobile-link ${location.pathname === link.path ? 'nav-mobile-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/services" onClick={() => setIsMenuOpen(false)}>
              <Button variant="primary" size="lg" className="w-full">Get Started</Button>
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};
