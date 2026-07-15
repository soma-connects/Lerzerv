import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight as ArrowIcon, Eraser, Zap, Droplets, Gift, ShieldCheck, MessageCircle, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import './Home.css';

const Home: React.FC = () => {
  const [heroLoaded, setHeroLoaded] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <motion.div
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.h1 variants={itemVariants}>
            <span className="headline-primary">Live Better.</span>{' '}
            <span className="headline-secondary">Your Life, Our Priority.</span>
          </motion.h1>
          <motion.p className="hero-text" variants={itemVariants}>
            Apply for a service and we'll match you with a verified artisan or cleaner near you — plumbing, power, cooling, repairs and more. Chat and pay safely, all on Lezerv.
          </motion.p>
          <motion.div className="hero-actions" variants={itemVariants}>
            <Link to="/post-job">
              <Button variant="primary" size="lg" rightIcon={<ArrowIcon size={20} />}>Apply for Service</Button>
            </Link>
            <Link to="/services">
              <Button variant="outline" size="lg">Browse Services</Button>
            </Link>
          </motion.div>
          <motion.div className="hero-trust" variants={itemVariants}>
            <span><ShieldCheck size={16} /> Verified artisans</span>
            <span><MessageCircle size={16} /> In-app chat</span>
            <span><Lock size={16} /> Secure payments</span>
          </motion.div>
        </motion.div>

        <motion.div
          className={`hero-image-container ${!heroLoaded ? 'loading' : ''}`}
          initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="hero-image-bg"></div>
          {!heroLoaded && <div className="image-skeleton" aria-hidden="true" />}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUBCTpiyl-_anQ6YNpqMAgiaCxHJP0yOd_XFMzPnXTSMwwPD1xm7FhR5lmMpbu-a4NioT1x56TdJoOvRNLpHDZ9jieUQnoF32OOMKnBvPZ7QK4d44bZga2WivlN649WnuO3UOWTHdRtML7K9yijLaGWs1OMVEH6o8wmqY_uVjbEGhtLoNwssbsul7MwjF3RmmzaFqQBpcopsjOCgOkVrS0gC6jAO61mR7YN2_6b5Cht4hP4OIrSyuKk-YgQwq3P-Y8FdMDWfwDNTWs"
            alt="Perfectly maintained Nigerian home"
            className="hero-image"
            onLoad={() => setHeroLoaded(true)}
            style={{ opacity: heroLoaded ? 1 : 0 }}
          />
        </motion.div>
      </section>

      {/* Services Section */}
      <section className="services">
        <div className="container">
          <div className="section-header">
            <h2>Reliable Solutions for Local Needs</h2>
            <p>Verified professionals ready to keep your home running smoothly.</p>
          </div>

          <div className="services-grid">
            <motion.div
              className="service-card"
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 300 }}
              role="article"
              aria-label="Professional Cleaning service"
              tabIndex={0}
            >
              <div className="service-icon icon-primary">
                <Eraser size={28} />
              </div>
              <h3>Professional Cleaning</h3>
              <p>Standard and deep cleaning for flats, duplexes, and post-construction projects.</p>
              <Link to="/services" className="service-link">
                <Button variant="text" rightIcon={<ArrowIcon size={18} />}>View Pricing</Button>
              </Link>
            </motion.div>

            <motion.div
              className="service-card service-card-featured"
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 300 }}
              role="article"
              aria-label="Power and Cooling service"
              tabIndex={0}
            >
              <div className="service-icon icon-white">
                <Zap size={28} />
              </div>
              <h3>Power & Cooling</h3>
              <p>Generator maintenance, AC servicing, and solar system diagnostics to keep the lights on.</p>
              <div className="service-badge">
                <span className="dot"></span>
                HIGH DEMAND
              </div>
              <Link to="/services?category=power" className="featured-link">
                <Button variant="text" rightIcon={<ArrowIcon size={18} />}>Book Now</Button>
              </Link>
            </motion.div>

            <motion.div
              className="service-card"
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 300 }}
              role="article"
              aria-label="Water Systems service"
              tabIndex={0}
            >
              <div className="service-icon icon-tertiary">
                <Droplets size={28} />
              </div>
              <h3>Water Systems</h3>
              <p>Borehole pump repairs, tank cleaning, and plumbing fixes across all major estates.</p>
              <Link to="/services" className="service-link">
                <Button variant="text" rightIcon={<ArrowIcon size={18} />}>Book Artisan</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works container">
        <div className="section-header">
          <h2>How Lezerv Works</h2>
          <p>Get help in three simple steps.</p>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Pick a Service</h3>
            <p>Choose from cleaning, power, plumbing, and more.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Get Matched</h3>
            <p>We connect you with a verified artisan near you.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Relax</h3>
            <p>Track the job and pay securely when it's done.</p>
          </div>
        </div>
      </section>

      {/* Ambassador Promo Section */}
      <section className="ambassador-promo">
        <div className="container">
          <motion.div
            className="promo-banner"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="promo-icon">
              <Gift size={32} />
            </div>
            <h2>Earn Rewards as a Lezerv Ambassador</h2>
            <p>Share Lezerv with friends and family. When they book a service, you earn points — and they get a discount on their first booking.</p>
            <Link to="/ambassador">
              <Button variant="secondary" size="lg">Become an Ambassador</Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials container">
        <h2>Trusted by Homeowners in Lagos & Abuja</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFTbEcuYMATHPfQ_GDWr1GTIqkcxZ6q2rfuBe8AO_xkOVCh_yxyyrzrIkW-G2VyGn1nDDruUya0PgUg7uiQFsNBN6Htv0TYGJiGKdMBg_BvnMFf09s7MrujPpWWgYZ7faxSXxYEwxZ6oTdBfraAHSGQQEnnVfOAXFHv5RWCNNbnVDN0mV-89MO08ijUZ0yCWz-x17Nqk50P9b6BKbvNDB2cBA0JE7BaQbMZfQGe7n3LGUjKj3MUicpTAAZBpKeOYAZooHQ_eH4f8ch" alt="Olawale O." loading="lazy" />
            <div className="testimonial-content">
              <div className="stars" aria-label="5 star rating">★★★★★</div>
              <p>"Lezerv is a lifesaver. Had a generator issue late at night in Lekki, and they got a verified mechanic to my place first thing in the morning."</p>
              <cite>— Olawale O., Homeowner</cite>
            </div>
          </div>
          <div className="testimonial-card">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCenrzdSEflAZHlhjtGA53Ju9GmKi2n9tFDI9rrvxtEPa4X5PD88vLMmTC5hAmMr0LDTAZluiQphHXIh8YWNyXRGmDuzjQwE31c3VaL97so_8nw9vIaoJDiuEle6CmlxkYmNsMHtJHLBqfjw5in6GZj1ZIKpv4YTEyaKVyOtPtt9PeD71ikC0aEioO-e_ve9Sxy8sZEIUEtNj8FudhE6GbvoseZ-JKamEhQolgKkB95oABbVaQHWON11JOQ020eB2kwWMSLq7Ff74Nz" alt="Chioma E." loading="lazy" />
            <div className="testimonial-content">
              <div className="stars" aria-label="5 star rating">★★★★★</div>
              <p>"The deep cleaning service for my new apartment in Gwarinpa was exceptional. They removed every bit of paint and dust. Highly recommended!"</p>
              <cite>— Chioma E., Property Manager</cite>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta container">
        <div className="cta-banner">
          <h2>Ready for a stress-free Nigerian home?</h2>
          <p>Join thousands of property owners who trust Lezerv for their daily and emergency maintenance needs.</p>
          <div className="cta-banner-actions">
            <Link to="/post-job"><Button variant="secondary" size="lg">Apply for Service</Button></Link>
            <Link to="/become-artisan"><Button variant="outline" size="lg" className="cta-outline-light">Work as an Artisan</Button></Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;