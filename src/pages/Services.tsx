import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Check, ArrowRight, Sparkles, Zap, Wrench, Shield, Clock, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import BookingFlow from '../components/booking/BookingFlow';
import './Services.css';

interface ServiceTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

interface Category {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  tiers: ServiceTier[];
}

const STATIC_SERVICE_CATEGORIES: Category[] = [
  {
    id: 'cleaning',
    title: 'Professional Cleaning',
    description: 'Expert cleaning solutions for Nigerian homes, apartments, and estates.',
    icon: <Sparkles size={28} />,
    color: 'var(--color-primary)',
    tiers: [
      {
        name: 'Standard Home Clean',
        price: '₦5,000 - ₦10,000',
        description: 'Perfect for regular upkeep of your flat or duplex.',
        features: [
          'Detailed Floor Mopping',
          'Kitchen & Bathroom Sanitization',
          'Dusting of All Surfaces',
          'Trash Disposal',
          'Window Internal Wiping'
        ]
      },
      {
        name: 'Premium Service',
        price: '₦10,000 - ₦20,000',
        description: 'Comprehensive deep cleaning for new or renovated properties.',
        features: [
          'Paint & Cement Stain Removal',
          'Deep Floor Scrubbing',
          'Full Kitchen Degreasing',
          'Window & Frame Detailing',
          'Sanitization of All Fixtures',
          'De-webbing & Wall Cleaning'
        ],
        recommended: true
      }
    ]
  },
  {
    id: 'power-water',
    title: 'Power & Water Utilities',
    description: 'Specialized maintenance for the essential systems that keep your home running.',
    icon: <Zap size={28} />,
    color: 'var(--color-tertiary)',
    tiers: [
      {
        name: 'Generator Servicing',
        price: '₦10,000',
        description: 'Routine maintenance for your Mikano, Perkins, or small portable sets.',
        features: [
          'Oil & Filter Change',
          'Plug Replacement',
          'Control Panel Inspection',
          'Battery Health Check',
          'Performance Tuning'
        ]
      },
      {
        name: 'Borehole & Plumbing',
        price: '₦25,000',
        description: 'Pump repairs, tank cleaning, and full plumbing diagnostics.',
        features: [
          'Submersible Pump Repair',
          'Overhead Tank Cleaning',
          'Pipe Leak Detection',
          'Pressure Pump Calibration',
          'Water Treatment Check'
        ]
      }
    ]
  },
  {
    id: 'artisan-work',
    title: 'Expert Artisans',
    description: 'Verified professionals for structural repairs and technical installations.',
    icon: <Wrench size={28} />,
    color: 'var(--color-secondary)',
    tiers: [
      {
        name: 'Technical Repairs',
        price: '₦12,000',
        description: 'AC servicing, electrical faults, and carpentry fixes.',
        features: [
          'AC Gas Refilling & Cleaning',
          'Electrical Fault Tracing',
          'Inverter & Solar Check-up',
          'Furniture & Cabinet Repair',
          'Door Lock Installations'
        ]
      },
      {
        name: 'Full Estate Maintenance',
        price: 'Negotiable',
        description: 'End-to-end maintenance for property owners and estate managers.',
        features: [
          'Interlocking Tile Repair',
          'Fumigation & Pest Control',
          'Compound Cleaning',
          'Gate Automation Support',
          '24/7 Priority Response'
        ]
      }
    ]
  }
];

const Services: React.FC = () => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase.from('services').select('*');
        
        if (!error && data && data.length > 0) {
          const grouped = data.reduce((acc: any, service: any) => {
            if (!acc[service.category]) {
              acc[service.category] = {
                id: service.category.toLowerCase(),
                title: service.category,
                description: 'Professional ' + service.category + ' services.',
                icon: <Sparkles size={28} />,
                color: 'var(--color-primary)',
                tiers: []
              };
            }
            acc[service.category].tiers.push({
              name: service.title,
              price: service.price,
              description: service.description,
              features: service.features || [],
              recommended: service.recommended
            });
            return acc;
          }, {});
          setCategories(Object.values(grouped));
        } else {
          setCategories(STATIC_SERVICE_CATEGORIES);
        }
      } catch (err) {
        setCategories(STATIC_SERVICE_CATEGORIES);
      } finally {
        // Done
      }
    };

    fetchServices();
  }, []);

  const handleBook = (categoryTitle: string, tierName: string) => {
    setSelectedService(`${categoryTitle} - ${tierName}`);
    setIsBookingOpen(true);
  };

  return (
    <div className="services-page">
      {/* Hero Header */}
      <section className="services-hero">
        <div className="container">
          <motion.div
            className="services-header"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="services-label">Our Services</span>
            <h1>Premium Home Services</h1>
            <p>Reliable artisans and cleaning professionals at your doorstep. Transparent pricing, no hidden fees.</p>

            <div className="trust-pills">
              <span className="trust-pill"><Shield size={16} /> Verified Artisans</span>
              <span className="trust-pill"><Clock size={16} /> Same-Day Available</span>
              <span className="trust-pill"><Star size={16} /> 4.9/5 Rating</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <div className="container">
        {categories.map((category, idx) => (
          <motion.section
            key={category.id}
            className="service-category-section"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
          >
            <div className="category-header">
              <div className="category-icon" style={{ color: category.color }}>
                {category.icon}
              </div>
              <div className="category-info">
                <h2>{category.title}</h2>
                <p>{category.description}</p>
              </div>
            </div>

            <div className="tiers-grid">
              {category.tiers.map((tier, tIdx) => (
                <motion.div
                  key={tier.name}
                  className={`tier-card ${tier.recommended ? 'tier-recommended' : ''}`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: tIdx * 0.1,
                    type: "spring",
                    stiffness: 100
                  }}
                  whileHover={{ y: -8 }}
                >
                  {tier.recommended && (
                    <div className="recommendation-badge">
                      <Star size={14} fill="currentColor" /> Most Popular
                    </div>
                  )}

                  <div className="tier-header">
                    <h3>{tier.name}</h3>
                    <div className="tier-price">
                      <span className="price-label">From</span>
                      <span className="price-amount">{tier.price}</span>
                    </div>
                  </div>

                  <p className="tier-desc">{tier.description}</p>

                  <ul className="tier-features">
                    {tier.features.map(f => (
                      <li key={f}>
                        <div className="feature-check">
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="tier-card-footer-layout">
                    <Button
                      variant={tier.recommended ? 'primary' : 'outline'}
                      fullWidth
                      size="lg"
                      rightIcon={<ArrowRight size={18} />}
                      onClick={() => handleBook(category.title, tier.name)}
                    >
                      Book This Service
                    </Button>
                    <a 
                      href={`https://wa.me/2349046367604?text=${encodeURIComponent(`Hello Lezerv, I would like to book the service: ${category.title} (${tier.name}).`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="whatsapp-direct-link"
                    >
                      Or book directly via WhatsApp
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      {/* Bottom CTA */}
      <section className="services-cta">
        <div className="container">
          <div className="cta-card">
            <h2>Need something else?</h2>
            <p>We handle custom jobs too. Post a job describing what you need and we'll match you with the right verified artisan near you.</p>
            <Link to="/post-job"><Button variant="secondary" size="lg" rightIcon={<ArrowRight size={18} />}>Post a Custom Job</Button></Link>
          </div>
        </div>
      </section>

      <BookingFlow 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        serviceName={selectedService} 
      />
    </div>
  );
};

export default Services;