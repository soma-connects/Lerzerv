import React, { useState, useEffect } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChefHat, ClipboardList, Droplets, Info, LocateFixed, MapPin, MessageCircle, Shirt, Sparkles, Wrench, Zap } from 'lucide-react';
import { LinkButton } from '../components/ui/LinkButton';
import { supabase } from '../lib/supabase';
import { useSEO } from '../hooks/useSEO';
import { useRegion } from '../contexts/LocationContext';
import './Services.css';

// Best-effort map from a catalog service to a dispatch category slug
const guessCategory = (text: string): string | undefined => {
  const t = text.toLowerCase();
  if (t.includes('clean')) return 'cleaning';
  if (t.includes('cook') || t.includes('chef') || t.includes('cater')) return 'cooking';
  if (t.includes('laundr') || t.includes('dry clean') || t.includes('press') || t.includes('wash')) return 'laundry';
  if (t.includes('solar') || t.includes('inverter')) return 'solar-inverter';
  if (t.includes('generator') || t.includes('power')) return 'generator-power';
  if (t.includes('borehole') || t.includes('plumb') || t.includes('tank') || t.includes('water')) return 'plumbing';
  if (t.includes('ac ') || t.includes('cooling') || t.includes('refrig')) return 'ac-refrigeration';
  if (t.includes('electric')) return 'electrical';
  if (t.includes('carpent') || t.includes('furniture') || t.includes('cabinet')) return 'carpentry';
  if (t.includes('paint')) return 'painting';
  if (t.includes('pest') || t.includes('fumig')) return 'pest-control';
  if (t.includes('tile') || t.includes('mason') || t.includes('interlock')) return 'masonry-tiling';
  if (t.includes('security') || t.includes('gate') || t.includes('lock')) return 'home-security';
  return undefined;
};

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
        name: 'Standard Clean',
        price: '₦30,000',
        description: 'Perfect for regular maintenance and keeping your space fresh.',
        features: [
          'Dusting & Vacuuming',
          'Mopping & Floor Cleaning',
          'Bathroom Sanitization',
          'Kitchen Surface Cleaning',
          'Trash Emptying'
        ]
      },
      {
        name: 'Deep Clean',
        price: '₦55,000',
        description: 'Comprehensive deep cleaning for new or renovated properties.',
        recommended: true,
        features: [
          'Paint & Cement Stain Removal',
          'Deep Floor Scrubbing',
          'Full Kitchen Degreasing',
          'Window & Frame Detailing',
          'Sanitization of All Fixtures',
          'De-webbing & Wall Cleaning'
        ]
      }
    ]
  },
  {
    id: 'plumbing',
    title: 'Water Systems',
    description: 'Borehole repairs, plumbing fixtures, and storage tank maintenance.',
    icon: <Wrench size={28} />,
    color: 'var(--color-tertiary)',
    tiers: [
      {
        name: 'Minor Fixes',
        price: '₦15,000',
        description: 'Quick repairs for leaks, taps, and bathroom fixtures.',
        features: [
          'Tap & Shower Installation',
          'Leak Detection & Repair',
          'WC & Flush Kit Fixes',
          'Drainage Clearing',
          '1-Month Service Guarantee'
        ]
      },
      {
        name: 'Borehole & Tank Service',
        price: '₦45,000',
        description: 'Pump repairs, tank cleaning, and full plumbing diagnostics.',
        recommended: true,
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
    id: 'power',
    title: 'Power & Cooling',
    description: 'AC servicing, generator maintenance, and solar power support.',
    icon: <Zap size={28} />,
    color: 'var(--color-secondary)',
    tiers: [
      {
        name: 'AC / Appliance Servicing',
        price: '₦15,000',
        description: 'Preventative cleaning and minor checks for ACs and machines.',
        features: [
          'AC Gas Refilling & Cleaning',
          'Electrical Fault Tracing',
          'Inverter & Solar Check-up',
          'Furniture & Cabinet Repair',
          'Door Lock Installations'
        ]
      },
      {
        name: 'Full System Check & Repair',
        price: '₦35,000',
        description: 'Advanced troubleshooting and parts installation.',
        recommended: true,
        features: [
          'Interlocking Tile Repair',
          'Fumigation & Pest Control',
          'Compound Cleaning',
          'Gate Automation Support',
          '24/7 Priority Response'
        ]
      }
    ]
  },
  {
    id: 'cooking',
    title: 'Cooking & Catering',
    description: 'Hire professional home cooks and chefs for custom meal prep, family dinners, or events.',
    icon: <ChefHat size={28} />,
    color: 'var(--color-tertiary)',
    tiers: [
      {
        name: 'Daily Meal Prep',
        price: '₦30,000',
        description: 'Standard cooking and meal prep for individuals or families.',
        features: [
          '3 Freshly Cooked Meals',
          'Kitchen Cleanup Included',
          'Menu Planning Support',
          'Standard Local Dishes',
          'Ingredient Checklist Provided'
        ]
      },
      {
        name: 'Premium Chef Service',
        price: '₦100,000',
        description: 'Multi-course menu prepared by a professional chef for special events or parties.',
        recommended: true,
        features: [
          'Custom Gourmet Menu',
          'Multi-Course Meal Preparation',
          'Elegant Plating & Service',
          'Complete Kitchen Cleanup',
          'Post-Event Kitchen Sanitization',
          'Premium Ingredients Sourcing'
        ]
      }
    ]
  },
  {
    id: 'laundry',
    title: 'Laundry & Pressing',
    description: 'Convenient laundry, dry cleaning, and ironing services with home pickup.',
    icon: <Shirt size={28} />,
    color: 'var(--color-primary)',
    tiers: [
      {
        name: 'Wash & Fold',
        price: '₦10,000',
        description: 'Standard machine wash and fold service for regular clothes.',
        features: [
          'Up to 15kg of Laundry',
          'Color Sorting & Care',
          'Eco-Friendly Detergent',
          'Neat Folding & Packing',
          'Next-Day Delivery Option'
        ]
      },
      {
        name: 'Wash, Iron & Starch',
        price: '₦18,000',
        description: 'Deep wash, professional pressing, and optional starching for formal wear.',
        recommended: true,
        features: [
          'Up to 25kg of Laundry',
          'Professional Ironing & Pressing',
          'Starching for Kaftans & Native Wears',
          'Garment Hanger Packing',
          'Free Pickup & Return Delivery',
          'Delicate Fabric Hand Wash'
        ]
      }
    ]
  }
];

const Services: React.FC = () => {
  useSEO({
    title: 'Home Services and Prices in Lagos, Port Harcourt & Omoku | Lezerv',
    description: 'Starting prices for cleaning, plumbing, borehole, AC, generator, cooking and laundry services. Each verified artisan sets their own price, and you agree it before work starts.',
    keywords: 'cleaning price Lagos, plumber price Port Harcourt, artisan prices Omoku, hire AC technician Nigeria, generator servicing costs, home repair services pricing Nigeria',
  });

  const navigate = useNavigate();
  const region = useRegion();
  const [categories, setCategories] = useState<(Category & { city?: string | null })[]>([]);
  // The city being looked at: the visitor's own unless they pick another.
  const [picked, setPicked] = useState<string | null>(null);
  const viewCity = picked ?? region.city ?? 'Lagos';
  const [locNote, setLocNote] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        // Prices the team keeps in the admin's pricing panel (table "services").
        const { data, error } = await supabase.from('services').select('*');
        if (!error && data && data.length > 0) {
          type ServiceRow = { category: string; title: string; price: string; description: string; features?: string[] | null; recommended?: boolean; city?: string | null };
          const grouped = (data as ServiceRow[]).reduce((acc: Record<string, Category & { city?: string | null }>, service) => {
            // A price row may name its city; rows without one are Lagos prices.
            const city = service.city || 'Lagos';
            const key = `${city}|${service.category}`;
            if (!acc[key]) {
              acc[key] = {
                id: String(service.category).toLowerCase(),
                title: service.category,
                description: 'Professional ' + service.category + ' services.',
                icon: <Sparkles size={24} />,
                color: 'var(--color-primary)',
                city,
                tiers: [],
              };
            }
            acc[key].tiers.push({
              name: service.title,
              price: service.price,
              description: service.description,
              features: service.features || [],
              recommended: service.recommended,
            });
            return acc;
          }, {});
          setCategories(Object.values(grouped));
        } else {
          setCategories(STATIC_SERVICE_CATEGORIES.map((c) => ({ ...c, city: 'Lagos' })));
        }
      } catch {
        setCategories(STATIC_SERVICE_CATEGORIES.map((c) => ({ ...c, city: 'Lagos' })));
      }
    };
    fetchServices();
  }, []);

  const handleBook = (categoryTitle: string, tierName?: string) => {
    const cat = guessCategory(`${categoryTitle} ${tierName ?? ''}`);
    const qs = new URLSearchParams();
    if (tierName) qs.set('title', tierName);
    if (cat) qs.set('category', cat);
    navigate(`/post-job?${qs.toString()}`);
  };

  const locate = async () => {
    setLocNote(null);
    const r = await region.detect();
    if (r.ok) { setPicked(null); setLocNote(null); }
    else setLocNote(r.reason === 'outside' ? 'You seem to be outside our areas. Pick a city above.' : 'We couldn’t get your location. Pick a city above.');
  };

  // Lagos prices are listed for every service. A city without its own prices
  // shows the same services with "Ask for a quote" (artisans there set them).
  const lagos = categories.filter((c) => c.city === 'Lagos');
  const own = categories.filter((c) => c.city === viewCity);
  const hasOwnPrices = own.length > 0;
  const groups = hasOwnPrices ? own : lagos;

  const groupIcon = (title: string) => {
    const slug = guessCategory(title);
    if (slug === 'cleaning') return <Sparkles size={22} />;
    if (slug === 'plumbing') return <Droplets size={22} />;
    if (slug === 'cooking') return <ChefHat size={22} />;
    if (slug === 'laundry') return <Shirt size={22} />;
    return <Zap size={22} />;
  };

  const cities = region.cities.length ? region.cities : ['Lagos', 'Port Harcourt', 'Omoku'];

  return (
    <MotionConfig reducedMotion="user">
      <div className="sv">
        <div className="container sv-wrap">
          <div className="sv-head">
            <div className="sv-head-copy">
              <span className="eyebrow">Services and prices</span>
              <h1>Prices in {viewCity}</h1>
              <p>
                Starting prices for {viewCity}. Every verified artisan sets their own price: you see it on their profile and
                agree it before any work starts.
              </p>
            </div>
            <div className="sv-cities" role="group" aria-label="City">
              {cities.map((c) => (
                <button key={c} type="button" className={`sv-city ${c === viewCity ? 'active' : ''}`} aria-pressed={c === viewCity} onClick={() => setPicked(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="sv-note">
            <MapPin size={18} />
            <span>
              {region.city && viewCity === region.city
                ? `We found you in ${region.city}. Pick another city above to compare.`
                : region.city
                  ? `Showing ${viewCity}. You're in ${region.city}.`
                  : `Showing ${viewCity}. Share your location and we'll pick your city for you.`}
            </span>
            {!region.city && (
              <button type="button" className="sv-note-btn" onClick={locate} disabled={region.detecting}>
                <LocateFixed size={15} /> {region.detecting ? 'Finding you…' : 'Use my location'}
              </button>
            )}
            {locNote && <span className="sv-note-warn" role="status">{locNote}</span>}
          </div>

          {!hasOwnPrices && (
            <div className="sv-quote-note">
              <Info size={18} />
              <span>
                We haven't set standard prices for {viewCity} yet. Artisans there set their own: see them on{' '}
                <Link to="/find-artisans">Find artisans</Link>, or request a service and get a price before anything starts.
              </span>
            </div>
          )}

          <div className="sv-grid">
            {groups.map((g, gi) => {
              const slug = guessCategory(g.title);
              return (
                <motion.section
                  key={`${g.city}-${g.id}`}
                  className="sv-card"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: (gi % 3) * 0.06 }}
                >
                  <div className="sv-card-head">
                    <span className={`sv-icon ${gi % 2 ? 'amber' : ''}`}>{groupIcon(g.title)}</span>
                    <div>
                      <h2>{g.title}</h2>
                      <p>{g.description}</p>
                    </div>
                  </div>

                  <ul className="sv-tiers">
                    {g.tiers.map((t) => (
                      <li key={t.name}>
                        <button type="button" className="sv-tier" onClick={() => handleBook(g.title, t.name)} aria-label={`Book ${t.name}`}>
                          <span className="sv-tier-text">
                            <span className="sv-tier-name">
                              {t.name}
                              {t.recommended && <span className="sv-popular">Popular</span>}
                            </span>
                            <span className="sv-tier-desc">{t.description}</span>
                          </span>
                          <span className="sv-tier-price" key={`${viewCity}-${t.name}`}>
                            {hasOwnPrices
                              ? <><small>from</small><strong>{t.price}</strong></>
                              : <strong className="sv-ask">Ask for a quote</strong>}
                          </span>
                        </button>
                        {t.features.length > 0 && (
                          <details className="sv-included">
                            <summary>What's included</summary>
                            <ul>{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="sv-card-foot">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleBook(g.title)}>
                      Book {g.title.toLowerCase()} <ArrowRight size={15} />
                    </button>
                    {slug && (
                      <Link to={`/find-artisans?category=${slug}`} className="sv-artisans-link">
                        See artisans' own prices
                      </Link>
                    )}
                  </div>
                </motion.section>
              );
            })}

            <section className="sv-card sv-custom">
              <h2>Need something not listed?</h2>
              <p>Describe the job and a verified artisan in {viewCity} gives you a price before anything starts.</p>
              <div className="sv-custom-actions">
                <LinkButton to="/post-job" variant="light" leftIcon={<ClipboardList size={17} />}>Request for Service</LinkButton>
                <a
                  className="sv-wa"
                  href={`https://wa.me/2349046367604?text=${encodeURIComponent(`Hello Lezerv, I need a service in ${viewCity}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={16} /> Or ask us on WhatsApp
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default Services;
