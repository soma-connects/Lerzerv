import React from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, ChefHat, ClipboardList, Droplets, Fuel, Gift, HandCoins, HardHat,
  Headphones, KeyRound, MessagesSquare, PlugZap, Search, Shirt, Snowflake, Sparkles, SprayCan, Sun,
  Wrench, Zap,
} from 'lucide-react';
import { LinkButton } from '../components/ui/LinkButton';
import { GiftArt, HeroScene, RequestArt, SafetyArt, StartCodeArt, ToolboxArt, VerifiedArt } from '../components/illustrations/Illustrations';
import { useSEO } from '../hooks/useSEO';
import { useRegion } from '../contexts/LocationContext';
import './Home.css';

// The eight most-asked-for services. Each tile opens Find Artisans already
// filtered to that category (same slugs as the header's Services menu).
const categories = [
  { slug: 'cleaning', name: 'Cleaning', blurb: 'Regular, deep and post-construction cleaning.', icon: SprayCan, tone: 'green', anim: 'shake' },
  { slug: 'plumbing', name: 'Plumbing', blurb: 'Leaks, blockages, fittings and water heaters.', icon: Wrench, tone: 'amber', anim: 'turn' },
  { slug: 'electrical', name: 'Electrical', blurb: 'Wiring, sockets, lighting and fault finding.', icon: PlugZap, tone: 'green', anim: 'flash' },
  { slug: 'generator-power', name: 'Generator & Power', blurb: 'Servicing, repairs and changeover set-up.', icon: Fuel, tone: 'amber', anim: 'buzz' },
  { slug: 'ac-refrigeration', name: 'AC & Refrigeration', blurb: 'AC servicing, gas top-ups, fridge repairs.', icon: Snowflake, tone: 'green', anim: 'spin' },
  { slug: 'solar-inverter', name: 'Solar & Inverter', blurb: 'Inverter, battery and panel installs and checks.', icon: Sun, tone: 'amber', anim: 'spin' },
  { slug: 'laundry', name: 'Laundry', blurb: 'Washing, ironing and dry cleaning.', icon: Shirt, tone: 'green', anim: 'sway' },
  { slug: 'cooking', name: 'Cooking', blurb: 'Home cooks for meal prep and family meals.', icon: ChefHat, tone: 'amber', anim: 'hop' },
] as const;

const popular: [string, string][] = [
  ['cleaning', 'Cleaning'],
  ['plumbing', 'Plumbing'],
  ['electrical', 'Electrical'],
  ['generator-power', 'Generator'],
  ['ac-refrigeration', 'AC repair'],
];

const steps = [
  { art: RequestArt, title: 'Tell us what you need', text: 'Request a service, or pick an artisan yourself. Say what needs doing and where.' },
  { art: VerifiedArt, title: 'Get a verified artisan', text: 'An ID-checked artisan near you takes the job and agrees the price with you first.' },
  { art: StartCodeArt, title: 'Relax while it gets done', text: 'Share your start code when they arrive, chat in the app and follow the job to the end.' },
];

// Outline icons drifting slowly behind the final call to action.
const floaters = [
  { icon: Wrench, cls: 'f1' }, { icon: Droplets, cls: 'f2' }, { icon: Zap, cls: 'f3' },
  { icon: Sparkles, cls: 'f4' }, { icon: Snowflake, cls: 'f5' }, { icon: Sun, cls: 'f6' },
];

const safety = [
  { icon: BadgeCheck, title: 'ID-checked artisans', text: 'Our team checks every artisan’s identity before they can take jobs.' },
  { icon: HandCoins, title: 'Price agreed first', text: 'You see the estimate or firm price and accept it before any work starts.' },
  { icon: KeyRound, title: 'Start codes', text: 'Your artisan proves they’re the right person with a code only you have.' },
  { icon: Headphones, title: 'People who help', text: 'Something not right? Reach our team on WhatsApp or in the app.' },
];

// Fade-and-rise when a section scrolls into view (once).
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

// A believable place for the example job card, in the visitor's city.
const sampleSpot: Record<string, string> = {
  Lagos: 'Lekki Phase 1',
  'Port Harcourt': 'GRA, Port Harcourt',
  Omoku: 'Omoku',
};

const Home: React.FC = () => {
  const { city } = useRegion();
  useSEO({
    title: 'Lezerv | Verified Home Services & Artisans in Nigeria',
    description: 'Hire ID-verified cleaners, plumbers, electricians, AC technicians, generator repairers and more. Request a service and Lezerv matches you with a verified artisan near you.',
    keywords: 'home services Nigeria, cleaning services Lagos, verified cleaners Port Harcourt, hire plumber Nigeria, electrician Lagos, generator repair Lagos, AC technician Port Harcourt, home services Omoku, local artisans Nigeria, professional cleaners Lagos, house cleaning Nigeria, handyman services Nigeria',
  });

  return (
    // reducedMotion="user": if someone turned on "reduce motion" on their
    // device, framer-motion skips the slide-in animations for them.
    <MotionConfig reducedMotion="user">
      <div className="home">
        {/* ───────────── Hero ───────────── */}
        <section className="home-hero">
          <div className="container home-hero-grid">
            <motion.div
              className="home-hero-copy"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <span className="home-pill">
                <BadgeCheck size={16} /> {city ? `Verified artisans in ${city}` : 'Verified artisans for your home'}
              </span>
              <h1>
                Live better.
                <span className="home-h1-accent">Your life, our priority.</span>
              </h1>
              <p className="home-lead">
                Request a service and we'll match you with a verified artisan or cleaner near you — plumbing, power,
                cooling, repairs and more. Agree the price, chat and track the job, all on Lezerv.
              </p>

              <div className="home-hero-actions">
                <LinkButton to="/post-job" size="lg" rightIcon={<ArrowRight size={19} />}>Request for Service</LinkButton>
                <LinkButton to="/find-artisans" size="lg" variant="outline" leftIcon={<Search size={18} />}>Find an artisan</LinkButton>
              </div>

              <div className="home-popular">
                <span>Popular:</span>
                {popular.map(([slug, name]) => (
                  <Link key={slug} to={`/find-artisans?category=${slug}`} className="home-chip">{name}</Link>
                ))}
              </div>
            </motion.div>

            {/* An illustrated home, drawn in SVG and animated (see
                components/illustrations). aria-hidden: it's decoration. */}
            <motion.div
              className="home-visual"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            >
              <HeroScene />
              <div className="hv-float hv-float-code">
                <KeyRound size={16} />
                <span>Start code</span>
                <b>4 8 2 1</b>
              </div>
              <div className="hv-float hv-float-msg">
                <MessagesSquare size={16} />
                <span>“I'm 10 minutes away”</span>
              </div>
              <div className="hv-float hv-float-status">
                <span className="hv-dot" />
                <span>Artisan on the way · {sampleSpot[city ?? 'Lagos'] ?? city}</span>
              </div>
            </motion.div>
          </div>

          <div className="container">
            <ul className="home-trust">
              <li><BadgeCheck size={18} /> ID-checked artisans</li>
              <li><HandCoins size={18} /> Agree the price before work</li>
              <li><KeyRound size={18} /> Start code at your door</li>
              <li><MessagesSquare size={18} /> Chat in the app</li>
            </ul>
          </div>
        </section>

        {/* ───────────── Categories ───────────── */}
        <section className="home-section">
          <div className="container">
            <motion.div className="home-head" {...reveal}>
              <span className="eyebrow">Services</span>
              <h2>What do you need help with?</h2>
              <p>Pick a service to see verified artisans who do it.</p>
            </motion.div>

            <div className="home-cats">
              {categories.map((c) => (
                <Link key={c.slug} to={`/find-artisans?category=${c.slug}`} className="home-cat">
                  <span className={`home-cat-icon tone-${c.tone}`} data-anim={c.anim}><c.icon size={24} /></span>
                  <span className="home-cat-name">{c.name}</span>
                  <span className="home-cat-blurb">{c.blurb}</span>
                  <ArrowRight size={18} className="home-cat-arrow" />
                </Link>
              ))}
            </div>

            <div className="home-cats-more">
              <Link to="/services" className="home-more-link">See all services and prices <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>

        {/* ───────────── How it works ───────────── */}
        <section className="home-section home-how">
          <div className="container">
            <motion.div className="home-head" {...reveal}>
              <span className="eyebrow">How it works</span>
              <h2>Help at home in three steps</h2>
            </motion.div>

            <ol className="home-steps">
              {steps.map((s, i) => (
                <motion.li key={s.title} className="home-step" {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
                  <div className="home-step-art"><s.art /></div>
                  <span className="home-step-num">Step {i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────────── Safety ───────────── */}
        <section className="home-section">
          <div className="container">
            <div className="home-safety">
              <motion.div className="home-safety-copy" {...reveal}>
                <SafetyArt className="home-safety-art" />
                <span className="eyebrow">Peace of mind</span>
                <h2>Safety is built into every job</h2>
                <p>
                  Letting someone into your home takes trust. These checks happen on every booking, so you know who is
                  coming, what it costs and who to call.
                </p>
                <LinkButton to="/services" variant="outline" rightIcon={<ArrowRight size={17} />}>How Lezerv works</LinkButton>
              </motion.div>

              <div className="home-safety-grid">
                {safety.map((s, i) => (
                  <motion.div key={s.title} className="home-safety-card" {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }}>
                    <span className="home-safety-icon"><s.icon size={22} /></span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── Artisans + referrals ───────────── */}
        <section className="home-section home-section-tight">
          <div className="container home-duo">
            <motion.div className="home-promo home-promo-green" {...reveal}>
              <span className="home-promo-icon"><HardHat size={26} /></span>
              <h2>Are you an artisan?</h2>
              <p>Get jobs from homeowners near you. Apply once, get verified, and choose the jobs you take.</p>
              <LinkButton to="/become-artisan" variant="light" rightIcon={<ArrowRight size={17} />}>Work with Lezerv</LinkButton>
              <ToolboxArt className="home-promo-art" />
            </motion.div>

            <motion.div className="home-promo home-promo-amber" {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
              <span className="home-promo-icon"><Gift size={26} /></span>
              <h2>Refer &amp; earn</h2>
              <p>Share Lezerv with friends and family. When they book, you earn rewards and they get a discount on their first booking.</p>
              <LinkButton to="/ambassador" variant="primary" rightIcon={<ArrowRight size={17} />}>Become an ambassador</LinkButton>
              <GiftArt className="home-promo-art" />
            </motion.div>
          </div>
        </section>

        {/* ───────────── Final call to action ───────────── */}
        <section className="home-section home-section-tight">
          <div className="container">
            <motion.div className="home-final" {...reveal}>
              <div className="home-final-floaters" aria-hidden="true">
                {floaters.map((f) => <f.icon key={f.cls} className={`home-floater ${f.cls}`} />)}
              </div>
              <h2>Ready for a stress-free home?</h2>
              <p>Tell us what needs doing and we'll find a verified artisan near you.</p>
              <div className="home-final-actions">
                <LinkButton to="/post-job" size="lg" variant="light" leftIcon={<ClipboardList size={18} />}>Request for Service</LinkButton>
                <LinkButton to="/services" size="lg" variant="outline-light">Browse services</LinkButton>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
};

export default Home;
