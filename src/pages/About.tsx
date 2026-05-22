import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Award, Clock, Users, MapPin, Phone } from 'lucide-react';
import './About.css';

const About: React.FC = () => {
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});

  const handleImageLoad = (key: string) => {
    setImagesLoaded(prev => ({ ...prev, [key]: true }));
  };

  const values = [
    {
      icon: <ShieldCheck size={32} />,
      title: "Verified Trust",
      description: "Every artisan on Lezerv undergoes rigorous background checks, physical verification, and skill assessment before joining our platform.",
      color: "var(--color-primary-container)",
      iconColor: "var(--color-on-primary-container)"
    },
    {
      icon: <Award size={32} />,
      title: "Skilled Craftsmanship",
      description: "We partner with certified electricians, master plumbers, and experienced technicians who deliver quality results on every job.",
      color: "var(--color-secondary-container)",
      iconColor: "var(--color-on-secondary-container)"
    },
    {
      icon: <Clock size={32} />,
      title: "Reliable Response",
      description: "No more 'I'm on my way' for hours. Our professionals are committed to punctuality with real-time tracking through the app.",
      color: "var(--color-tertiary-container)",
      iconColor: "var(--color-on-tertiary-container)"
    }
  ];

  const stats = [
    { number: "500+", label: "Verified Artisans", icon: <Users size={24} /> },
    { number: "Lagos & Abuja", label: "Cities Covered", icon: <MapPin size={24} /> },
    { number: "10,000+", label: "Jobs Completed", icon: <Phone size={24} /> }
  ];

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="container">
          <div className="about-hero-grid">
            <motion.div
              className="about-hero-text"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="about-label">About Lezerv</span>
              <h1>Bringing Reliability to Every Nigerian Home</h1>
              <p>
                Founded to solve the most common headache for homeowners in Lagos, Abuja, and beyond: finding artisans you can actually trust. We bridge the gap between skilled professionals and the homes that need them.
              </p>
              <div className="about-hero-stats">
                {stats.map((stat, index) => (
                  <div key={index} className="stat-item">
                    <div className="stat-icon">{stat.icon}</div>
                    <div className="stat-content">
                      <span className="stat-number">{stat.number}</span>
                      <span className="stat-label">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="about-hero-image"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className={`image-wrapper ${!imagesLoaded['hero'] ? 'loading' : ''}`}>
                {!imagesLoaded['hero'] && <div className="image-skeleton" aria-hidden="true" />}
                <img
                  src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80"
                  alt="Professional cleaner in a modern Lagos home"
                  onLoad={() => handleImageLoad('hero')}
                  style={{ opacity: imagesLoaded['hero'] ? 1 : 0 }}
                  loading="eager"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="values">
        <div className="container">
          <div className="section-header">
            <h2>Our Core Values</h2>
            <p>The standards we uphold to provide the best home service experience in Nigeria.</p>
          </div>
          <div className="values-grid">
            {values.map((value, index) => (
              <motion.div
                key={index}
                className="value-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                role="article"
                tabIndex={0}
              >
                <div
                  className="value-icon"
                  style={{ backgroundColor: value.color, color: value.iconColor }}
                >
                  {value.icon}
                </div>
                <h3>{value.title}</h3>
                <p>{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission / Story Section */}
      <section className="story">
        <div className="container">
          <div className="story-grid">
            <motion.div
              className="story-text"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="story-label">Our Story</span>
              <h2>From Frustration to Solution</h2>
              <p>
                Lezerv started after our team experienced the repeated frustration of sub-par repairs and unverified artisans during critical home emergencies. We saw a gap in the market for a tech-driven platform that prioritizes security and quality.
              </p>
              <p>
                Today, we are more than just a booking app. We empower local artisans with better tools and connect them with property owners who value professional excellence. Our goal is to set the gold standard for home maintenance across Africa.
              </p>
              <div className="story-highlights">
                <div className="highlight">
                  <span className="highlight-number">2021</span>
                  <span className="highlight-text">Founded in Lagos</span>
                </div>
                <div className="highlight">
                  <span className="highlight-number">98%</span>
                  <span className="highlight-text">Customer Satisfaction</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="story-images"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className={`story-image-wrapper ${!imagesLoaded['story1'] ? 'loading' : ''}`}>
                {!imagesLoaded['story1'] && <div className="image-skeleton" aria-hidden="true" />}
                <img
                  src="/images/laundry-delivery.png"
                  alt="Lezerv laundry delivery service in Abuja"
                  onLoad={() => handleImageLoad('story1')}
                  style={{ opacity: imagesLoaded['story1'] ? 1 : 0 }}
                  loading="lazy"
                />
              </div>
              <div className={`story-image-wrapper offset ${!imagesLoaded['story2'] ? 'loading' : ''}`}>
                {!imagesLoaded['story2'] && <div className="image-skeleton" aria-hidden="true" />}
                <img
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80"
                  alt="Nigerian plumber installing pipes on construction site"
                  onLoad={() => handleImageLoad('story2')}
                  style={{ opacity: imagesLoaded['story2'] ? 1 : 0 }}
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="trust-banner">
        <div className="container">
          <div className="trust-content">
            <h2>Join the Community of Satisfied Homeowners</h2>
            <p>From Lekki to Gwarinpa, from Victoria Island to Wuse — we are building a network you can rely on.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;