import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, MessageCircle, Mail, ClipboardList, ArrowRight } from 'lucide-react';
import { LinkButton } from '../ui/LinkButton';
import { BrandLogo } from '../ui/BrandLogo';
import './Footer.css';

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: 'Services',
    links: [
      ['Cleaning', '/find-artisans?category=cleaning'],
      ['Laundry', '/find-artisans?category=laundry'],
      ['Cooking', '/find-artisans?category=cooking'],
      ['Plumbing', '/find-artisans?category=plumbing'],
      ['Electrical', '/find-artisans?category=electrical'],
      ['Generator & Power', '/find-artisans?category=generator-power'],
      ['AC & Refrigeration', '/find-artisans?category=ac-refrigeration'],
    ],
  },
  {
    title: 'For artisans',
    links: [
      ['Become an artisan', '/become-artisan'],
      ['My jobs', '/my-jobs'],
      ['Refer & earn', '/ambassador'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About us', '/about'],
      ['How it works', '/services'],
      ['Blog & Events', '/blog'],
      ['Careers', '/careers'],
      ['Contact', '/contact'],
      ['Track order', '/track'],
    ],
  },
];

const legalLinks: [string, string][] = [
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Delete account', '/delete-account'],
];

// Pages that already end with their own "Request for Service" call to action,
// so the footer doesn't repeat it right underneath.
const NO_CTA = ['/', '/post-job', '/login', '/signup', '/forgot-password', '/reset-password', '/admin'];

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  const { pathname } = useLocation();
  const showCta = !NO_CTA.includes(pathname) && !pathname.startsWith('/payment');

  return (
    <footer className={`ftr ${showCta ? 'ftr-has-cta' : ''}`}>
      {showCta && (
        <div className="container">
          <div className="ftr-cta">
            <div className="ftr-cta-text">
              <h2>Need something fixed at home?</h2>
              <p>Tell us what you need and we'll match you with a verified artisan near you.</p>
            </div>
            <LinkButton to="/post-job" size="lg" leftIcon={<ClipboardList size={18} />}>Request for Service</LinkButton>
          </div>
        </div>
      )}

      <div className="ftr-panel">
        <div className="container">
          <div className="ftr-main">
            <div className="ftr-brand">
              <Link to="/" aria-label="Lezerv home" className="ftr-logo"><BrandLogo tone="light" /></Link>
              <p className="ftr-tagline">Verified home-service professionals, booked in a few taps. Reliable help, made simple.</p>
              <p className="ftr-location"><MapPin size={15} /> Lagos · Abuja · Port Harcourt</p>

              <div className="ftr-contact">
                <a href="https://wa.me/2349046367604" target="_blank" rel="noopener noreferrer" className="ftr-contact-link">
                  <span className="ftr-contact-icon"><MessageCircle size={17} /></span>
                  <span><small>WhatsApp</small>+234 904 636 7604</span>
                </a>
                <a href="mailto:hello@lezerv.com" className="ftr-contact-link">
                  <span className="ftr-contact-icon"><Mail size={17} /></span>
                  <span><small>Email</small>hello@lezerv.com</span>
                </a>
              </div>
            </div>

            <nav className="ftr-cols" aria-label="Footer">
              {columns.map((col) => (
                <div className="ftr-col" key={col.title}>
                  <h3 className="ftr-col-title">{col.title}</h3>
                  <ul>
                    {col.links.map(([name, path]) => (
                      <li key={name}><Link to={path} className="ftr-link">{name}</Link></li>
                    ))}
                  </ul>
                  {col.title === 'Services' && (
                    <Link to="/services" className="ftr-link ftr-link-all">All services <ArrowRight size={14} /></Link>
                  )}
                </div>
              ))}
            </nav>
          </div>

          <div className="ftr-bottom">
            <span>© {year} Lezerv. All rights reserved.</span>
            <ul className="ftr-legal">
              {legalLinks.map(([name, path]) => (
                <li key={name}><Link to={path} className="ftr-link">{name}</Link></li>
              ))}
            </ul>
            <span className="ftr-made">Built in Lagos 🇳🇬</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
