import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Briefcase, HardHat, Wrench, Zap, Droplets, Hammer, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import './Careers.css';

interface CorporateRole {
  title: string;
  dept: string;
  location: string;
  type: string;
}

interface ArtisanRole {
  title: string;
  location: string;
  icon: React.ReactNode;
  demand: 'High' | 'Very High' | 'Urgent';
}

const corporateRoles: CorporateRole[] = [
  {
    title: "Operations Manager",
    dept: "Logistics",
    location: "Lagos, Nigeria",
    type: "Full-time"
  },
  {
    title: "Frontend Engineer (React)",
    dept: "Engineering",
    location: "Remote",
    type: "Full-time"
  },
  {
    title: "Growth Specialist",
    dept: "Marketing",
    location: "Abuja, Nigeria",
    type: "Full-time"
  },
  {
    title: "Customer Success Lead",
    dept: "Operations",
    location: "Lagos, Nigeria",
    type: "Full-time"
  }
];

const artisanRoles: ArtisanRole[] = [
  {
    title: "Certified Electrician",
    location: "Lagos (Lekki, Ikeja, Yaba)",
    icon: <Zap size={20} />,
    demand: "Very High"
  },
  {
    title: "Master Plumber",
    location: "Abuja (Gwarinpa, Maitama, Wuse)",
    icon: <Droplets size={20} />,
    demand: "High"
  },
  {
    title: "Generator Technician",
    location: "Port Harcourt & Aba",
    icon: <Wrench size={20} />,
    demand: "Urgent"
  },
  {
    title: "AC & Cooling Expert",
    location: "Lagos / Abuja",
    icon: <HardHat size={20} />,
    demand: "Very High"
  },
  {
    title: "Carpenter & Woodwork",
    location: "Lagos (Island & Mainland)",
    icon: <Hammer size={20} />,
    demand: "High"
  }
];

const benefits = [
  "Verified badge & profile boost",
  "Direct customer bookings",
  "Weekly payout to your bank",
  "Free tool insurance",
  "Training & certification support"
];

const Careers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'artisan' | 'corporate'>('artisan');
  const [hoveredRole, setHoveredRole] = useState<number | null>(null);

  return (
    <div className="careers-page">
      {/* Hero Section */}
      <section className="careers-hero">
        <div className="container">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="careers-label">Join Lezerv</span>
            <h1>Empower Your Craft,<br />Grow Your Business</h1>
            <p>Join the largest network of verified artisans and home service professionals in Nigeria. Whether you are a solo technician or a corporate talent, there is a place for you here.</p>

            <div className="hero-stats">
              <div className="hero-stat">
                <span className="stat-number">500+</span>
                <span className="stat-label">Active Partners</span>
              </div>
              <div className="hero-stat">
                <span className="stat-number">₦150M+</span>
                <span className="stat-label">Paid to Artisans</span>
              </div>
              <div className="hero-stat">
                <span className="stat-number">15+</span>
                <span className="stat-label">Cities Covered</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="hero-image-wrapper">
              <img
                src="/images/laundry-hero.png"
                alt="Professional laundry artisan folding fresh linens"
                loading="eager"
              />
              <div className="hero-image-badge">
                <CheckCircle2 size={16} />
                <span>Verified Partner Program</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tab Switcher */}
      <section className="roles-section">
        <div className="container">
          <div className="tab-switcher">
            <button
              className={`tab-btn ${activeTab === 'artisan' ? 'active' : ''}`}
              onClick={() => setActiveTab('artisan')}
            >
              <HardHat size={18} />
              Artisan Partners
            </button>
            <button
              className={`tab-btn ${activeTab === 'corporate' ? 'active' : ''}`}
              onClick={() => setActiveTab('corporate')}
            >
              <Briefcase size={18} />
              Corporate Roles
            </button>
          </div>

          {/* Artisan View */}
          {activeTab === 'artisan' && (
            <motion.div
              className="artisan-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="artisan-layout">
                <div className="artisan-roles">
                  <h2>Open Artisan Positions</h2>
                  <p className="section-desc">High-demand roles in your city. Apply today and start earning within 48 hours.</p>

                  <div className="roles-list">
                    {artisanRoles.map((role, i) => (
                      <motion.div
                        key={i}
                        className="role-card"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onMouseEnter={() => setHoveredRole(i)}
                        onMouseLeave={() => setHoveredRole(null)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="role-main">
                          <div className="role-icon" style={{
                            backgroundColor: role.demand === 'Urgent' ? 'var(--color-error-container)' : 'var(--color-primary-container)',
                            color: role.demand === 'Urgent' ? 'var(--color-on-error-container)' : 'var(--color-on-primary-container)'
                          }}>
                            {role.icon}
                          </div>
                          <div className="role-info">
                            <div className="role-header">
                              <h3>{role.title}</h3>
                              <span className={`demand-badge ${role.demand.toLowerCase().replace(' ', '-')}`}>
                                {role.demand} Demand
                              </span>
                            </div>
                            <p className="role-location">
                              <MapPin size={14} />
                              {role.location}
                            </p>
                          </div>
                        </div>
                        <div className="role-action">
                          <ArrowRight
                            size={20}
                            className={`role-arrow ${hoveredRole === i ? 'active' : ''}`}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="artisan-benefits">
                  <h3>Why Partner With Us?</h3>
                  <ul className="benefits-list">
                    {benefits.map((benefit, i) => (
                      <li key={i}>
                        <CheckCircle2 size={18} className="benefit-check" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="primary" size="lg" fullWidth>
                    Apply as Artisan
                  </Button>
                  <p className="benefits-note">No registration fees. Background check required.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Corporate View */}
          {activeTab === 'corporate' && (
            <motion.div
              className="corporate-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="corporate-header">
                <h2>Join the Team</h2>
                <p className="section-desc">Help us build the future of home services in Africa.</p>
              </div>

              <div className="corporate-grid">
                {corporateRoles.map((role, i) => (
                  <motion.div
                    key={i}
                    className="corporate-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -4 }}
                  >
                    <div className="corporate-card-header">
                      <span className="job-type">{role.type}</span>
                      <span className="job-location">
                        <MapPin size={14} />
                        {role.location}
                      </span>
                    </div>
                    <h3>{role.title}</h3>
                    <p className="job-dept">{role.dept}</p>
                    <div className="corporate-card-footer">
                      <Button variant="outline" size="sm" rightIcon={<ArrowRight size={16} />}>
                        View Role
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="careers-cta">
        <div className="container">
          <div className="cta-content">
            <h2>Not sure where you fit?</h2>
            <p>Send us your details and we will match you with the right opportunity.</p>
            <Button variant="secondary" size="lg">Contact Recruitment</Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Careers;