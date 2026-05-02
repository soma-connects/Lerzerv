import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Check, ArrowRight } from 'lucide-react';
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
  tiers: ServiceTier[];
}

const SERVICE_CATEGORIES: Category[] = [
  {
    id: 'cleaning',
    title: 'Professional Cleaning',
    description: 'Expert cleaning solutions for Nigerian homes, apartments, and estates.',
    tiers: [
      {
        name: 'Standard Home Clean',
        price: 'From ₦15,000',
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
        name: 'Post-Construction / Move-in',
        price: 'From ₦45,000',
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
    tiers: [
      {
        name: 'Generator Servicing',
        price: 'From ₦10,000',
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
        price: 'From ₦25,000',
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
    tiers: [
      {
        name: 'Technical Repairs',
        price: 'From ₦12,000',
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
        price: 'Custom Quote',
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

  const handleBook = (categoryTitle: string, tierName: string) => {
    setSelectedService(`${categoryTitle} - ${tierName}`);
    setIsBookingOpen(true);
  };

  return (
    <motion.div 
      className="services-page container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="services-header">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Premium Home Services
        </motion.h1>
        <p>Reliable artisans and cleaning professionals at your doorstep. Transparent pricing, no hidden fees.</p>
      </header>

      {SERVICE_CATEGORIES.map((category, idx) => (
        <section key={category.id} className="service-category-section">
          <motion.div 
            className="category-info"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.15 }}
          >
            <h2>{category.title}</h2>
            <p>{category.description}</p>
          </motion.div>
          
          <div className="tiers-grid">
            {category.tiers.map((tier, tIdx) => (
              <motion.div 
                key={tier.name}
                className={`tier-card ${tier.recommended ? 'tier-recommended' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: (idx * 0.2) + (tIdx * 0.1),
                  type: "spring",
                  stiffness: 100
                }}
              >
                {tier.recommended && <div className="recommendation-badge">Most Popular</div>}
                <h3>{tier.name}</h3>
                <div className="tier-price">{tier.price}</div>
                <p className="tier-desc">{tier.description}</p>
                
                <ul className="tier-features">
                  {tier.features.map(f => (
                    <li key={f}>
                      <Check size={18} color="var(--color-secondary)" /> 
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={tier.recommended ? 'primary' : 'outline'} 
                  fullWidth
                  rightIcon={<ArrowRight size={18} />}
                  onClick={() => handleBook(category.title, tier.name)}
                >
                  Book This Service
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      ))}

      <BookingFlow 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        serviceName={selectedService} 
      />
    </motion.div>
  );
};

export default Services;
