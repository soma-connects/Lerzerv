import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight as ArrowIcon, Eraser, Play, Zap, Droplets } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import './Home.css';

const Home: React.FC = () => {
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
      <section className="hero container">
        <motion.div 
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.h1 variants={itemVariants}>
            Live Better.<br />Your Life, Our Priority.
          </motion.h1>
          <motion.p className="hero-text" variants={itemVariants}>
            Reliable services to make your life easier every day. Connect with verified artisans and professional cleaners in Lagos, Abuja, and beyond.
          </motion.p>
          <motion.div className="hero-actions" variants={itemVariants}>
            <Link to="/services">
              <Button variant="primary" size="lg">Explore Services</Button>
            </Link>
            <Button variant="outline" size="lg" leftIcon={<Play size={20} />}>Get the App</Button>
          </motion.div>
        </motion.div>
        
        <motion.div 
          className="hero-image-container"
          initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="hero-image-bg"></div>
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUBCTpiyl-_anQ6YNpqMAgiaCxHJP0yOd_XFMzPnXTSMwwPD1xm7FhR5lmMpbu-a4NioT1x56TdJoOvRNLpHDZ9jieUQnoF32OOMKnBvPZ7QK4d44bZga2WivlN649WnuO3UOWTHdRtML7K9yijLaGWs1OMVEH6o8wmqY_uVjbEGhtLoNwssbsul7MwjF3RmmzaFqQBpcopsjOCgOkVrS0gC6jAO61mR7YN2_6b5Cht4hP4OIrSyuKk-YgQwq3P-Y8FdMDWfwDNTWs" 
            alt="Perfectly maintained Nigerian home" 
            className="hero-image"
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
            >
              <div className="service-icon icon-primary">
                <Eraser size={28} />
              </div>
              <h3>Professional Cleaning</h3>
              <p>Standard and deep cleaning for flats, duplexes, and post-construction projects.</p>
              <Link to="/services">
                <Button variant="text" rightIcon={<ArrowIcon size={18} />}>View Pricing</Button>
              </Link>
            </motion.div>

            <motion.div 
              className="service-card service-card-featured"
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 300 }}
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
            </motion.div>

            <motion.div 
              className="service-card"
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="service-icon icon-tertiary">
                <Droplets size={28} />
              </div>
              <h3>Water Systems</h3>
              <p>Borehole pump repairs, tank cleaning, and plumbing fixes across all major estates.</p>
              <Link to="/services">
                <Button variant="text" rightIcon={<ArrowIcon size={18} />}>Book Artisan</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials container">
        <h2>Trusted by Homeowners in Lagos & Abuja</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFTbEcuYMATHPfQ_GDWr1GTIqkcxZ6q2rfuBe8AO_xkOVCh_yxyyrzrIkW-G2VyGn1nDDruUya0PgUg7uiQFsNBN6Htv0TYGJiGKdMBg_BvnMFf09s7MrujPpWWgYZ7faxSXxYEwxZ6oTdBfraAHSGQQEnnVfOAXFHv5RWCNNbnVDN0mV-89MO08ijUZ0yCWz-x17Nqk50P9b6BKbvNDB2cBA0JE7BaQbMZfQGe7n3LGUjKj3MUicpTAAZBpKeOYAZooHQ_eH4f8ch" alt="Olawale O." />
            <div className="testimonial-content">
              <div className="stars">★★★★★</div>
              <p>"Lezerv is a lifesaver. Had a generator issue late at night in Lekki, and they got a verified mechanic to my place first thing in the morning."</p>
              <cite>— Olawale O., Homeowner</cite>
            </div>
          </div>
          <div className="testimonial-card">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCenrzdSEflAZHlhjtGA53Ju9GmKi2n9tFDI9rrvxtEPa4X5PD88vLMmTC5hAmMr0LDTAZluiQphHXIh8YWNyXRGmDuzjQwE31c3VaL97so_8nw9vIaoJDiuEle6CmlxkYmNsMHtJHLBqfjw5in6GZj1ZIKpv4YTEyaKVyOtPtt9PeD71ikC0aEioO-e_ve9Sxy8sZEIUEtNj8FudhE6GbvoseZ-JKamEhQolgKkB95oABbVaQHWON11JOQ020eB2kwWMSLq7Ff74Nz" alt="Chioma E." />
            <div className="testimonial-content">
              <div className="stars">★★★★★</div>
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
          <Button variant="secondary" size="lg">Join the Platform</Button>
        </div>
      </section>
    </div>
  );
};

export default Home;
