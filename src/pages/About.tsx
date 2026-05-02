import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Award, Clock } from 'lucide-react';
import './About.css';

const About: React.FC = () => {
  const values = [
    {
      icon: <ShieldCheck size={32} />,
      title: "Verified Trust",
      description: "We understand the importance of security in Nigerian homes. Every artisan on Lezerv undergoes a rigorous background check and physical verification.",
      color: "var(--color-primary-fixed)"
    },
    {
      icon: <Award size={32} />,
      title: "Skilled Craftsmanship",
      description: "We partner with the best technical hands in the country. From certified electricians to master plumbers, we ensure quality results for every job.",
      color: "var(--color-secondary-fixed)"
    },
    {
      icon: <Clock size={32} />,
      title: "Reliable Response",
      description: "No more endless waiting for 'I'm on my way'. Our professionals are committed to punctuality and transparent communication through the app.",
      color: "var(--color-tertiary-fixed)"
    }
  ];

  return (
    <div className="about-page">
      <section className="about-hero container">
        <div className="about-hero-grid">
          <div className="about-hero-text">
            <h1>Bringing Reliability to Every Nigerian Home.</h1>
            <p>
              Lezerv was founded to solve the most common headache for homeowners in Lagos, Abuja, and beyond: finding artisans you can actually trust. We are building a bridge between skilled professionals and the homes that need them.
            </p>
          </div>
          <div className="about-hero-image">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRJUKEo-WsLbwSIOz308c1_ibCIfV0j7u-PGw-eISZF6hvYypK5d9Iv9KCPLx4xkgEVgYTrOkcHkh6lmOtNFJ5JGBbPU6mU6W7EVhdS7gGwxCCItpth2oOrWrzpAxe5YhHLIKIUVCszmQVhgIQmtmWVQq92g9eB6tl8ZxUX7_pSCPkAtlBkqxhL1Av1ZG_YWO7OKP3gs3-byMlaUHULOnxkqAsX-aAfffqArNmGlFlFpUo7_uBo_A6f7lvIU-HIXW3Io36C2Kmx94p" alt="Professional service in Nigeria" />
          </div>
        </div>
      </section>

      <section className="values section">
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
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="value-icon" style={{ backgroundColor: value.color }}>
                  {value.icon}
                </div>
                <h3>{value.title}</h3>
                <p>{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="story container section">
        <div className="story-grid">
          <div className="story-text">
            <h2>Our Mission</h2>
            <p>
              Lezerv started after our team experienced the repeated frustration of sub-par repairs and unverified artisans during critical home emergencies. We saw a gap in the market for a tech-driven platform that prioritizes security and quality.
            </p>
            <p>
              Today, we are more than just a booking app. We are empowering local artisans with better tools and connecting them with property owners who value professional excellence. Our goal is to set the gold standard for home maintenance across Africa.
            </p>
          </div>
          <div className="story-images">
             <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdS3vNn_fl_ocYIyog5HOX1lhvwLTHwJFCHjSsIWNnebE5vO-KdhnMkGr0wTphBQhPzh3k2wUDilDXPSw6K9QjkHNailBJuN-kdE1POiOsdtT6FFSuM8ZpzECGQwqOySRa5UIhKm9d3ooMDmSIwIeykN_75ot3CShf42j1Ck2aq--DYkxadVzB_QUcrad62ghqR8EBJKK7NSRsHZfMMDw9W44EGmWuyD2XA6i6w7kLd-fVJ6nwi4rQx3SFdIcO-9fpdp-7ymmxuv-M" alt="Nigerian artisan community" />
             <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOJx65_ZR36uMRcqS5KcFfl2YuCYbA6V-eMeXYYe7ZURopCyOMvFz7ZW_waEVQ9B0MVW6h98UFRMec8VVK1OQ9N2_xo0UoIL98Zfizkq9CrcMe35Bgh8lWar-RFZqweaGJbiGmvGzzXjRDsW-U19CmAICkLZcfownodAKX3XmE-9PpHcx7JWgDP-Tx1A4BHj3z3GrBFqTtSqkB8fez8GknVGjPrHy95mcGslYY63pnoefoezBY84DPpuhuOe2SdyBWtR2eJW_5nhSC" alt="Service excellence" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
