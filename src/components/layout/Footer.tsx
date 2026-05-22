import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <img src="/logo.png" alt="Lezerv Logo" className="footer-logo-img" />
          </Link>
          <p className="footer-tagline">Reliable services to make your life easier every day.</p>
          <div className="footer-locations">
            <span>Lagos</span>
            <span className="dot"></span>
            <span>Abuja</span>
            <span className="dot"></span>
            <span>Port Harcourt</span>
          </div>
        </div>

        <div className="footer-links">
          <Link to="/services" className="footer-link">Our Services</Link>
          <Link to="/about" className="footer-link">About Us</Link>
          <Link to="/careers" className="footer-link">Careers</Link>
          <Link to="/contact" className="footer-link">Contact</Link>
          <Link to="/privacy" className="footer-link">Privacy Policy</Link>
        </div>

        <div className="footer-copyright">
          © {currentYear} Lezerv. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
