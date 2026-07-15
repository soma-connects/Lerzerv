import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Mail, ClipboardList } from 'lucide-react';
import { Button } from '../ui/Button';
import './Footer.css';

const serviceLinks: [string, string][] = [
  ['Cleaning', '/find-artisans?category=cleaning'],
  ['Plumbing', '/find-artisans?category=plumbing'],
  ['Electrical', '/find-artisans?category=electrical'],
  ['Generator & Power', '/find-artisans?category=generator-power'],
  ['AC & Refrigeration', '/find-artisans?category=ac-refrigeration'],
  ['Browse all services', '/services'],
];

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      {/* CTA strip */}
      <div className="footer-cta">
        <div className="container footer-cta-inner">
          <div>
            <h3>Need something fixed?</h3>
            <p>Apply for a service and we'll match you with a verified artisan near you.</p>
          </div>
          <Link to="/post-job"><Button variant="secondary" size="lg" leftIcon={<ClipboardList size={18} />}>Apply for Service</Button></Link>
        </div>
      </div>

      <div className="container footer-main">
        <div className="footer-brand">
          <Link to="/" className="footer-logo"><img src="/logo.png" alt="Lezerv" className="footer-logo-img" /></Link>
          <p className="footer-tagline">Verified home-service professionals across Lagos. Reliable help, made simple.</p>
          <div className="footer-locations"><MapPin size={14} /> Lagos · Abuja · Port Harcourt</div>
          <div className="footer-social">
            <a href="https://wa.me/2349046367604" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="WhatsApp"><MessageCircle size={18} /></a>
            <a href="mailto:hello@lezerv.com" className="social-btn" aria-label="Email"><Mail size={18} /></a>
          </div>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <span className="footer-col-title">Services</span>
            {serviceLinks.map(([name, path]) => <Link key={name} to={path} className="footer-link">{name}</Link>)}
          </div>
          <div className="footer-col">
            <span className="footer-col-title">For Artisans</span>
            <Link to="/become-artisan" className="footer-link">Become an artisan</Link>
            <Link to="/my-jobs" className="footer-link">My jobs</Link>
            <Link to="/ambassador" className="footer-link">Refer &amp; earn</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Company</span>
            <Link to="/about" className="footer-link">About us</Link>
            <Link to="/careers" className="footer-link">Careers</Link>
            <Link to="/contact" className="footer-link">Contact</Link>
            <Link to="/track" className="footer-link">Track order</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Legal</span>
            <Link to="/privacy" className="footer-link">Privacy policy</Link>
            <Link to="/terms" className="footer-link">Terms of service</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span>© {year} Lezerv. All rights reserved.</span>
          <span className="footer-madein">Built in Lagos 🇳🇬</span>
        </div>
      </div>
    </footer>
  );
};
