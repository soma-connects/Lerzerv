import React from 'react';
import { motion, MotionConfig } from 'framer-motion';
import {
  ArrowRight as ArrowIcon, Eraser, Zap, Droplets, Gift, ShieldCheck, MessageCircle, KeyRound,
  ChefHat, Shirt, Search, UserCheck, Handshake, Star, MapPin, Check,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { HeroPhone } from '../components/home/HeroPhone';
import doorstep640 from '../assets/home/doorstep-640.webp';
import doorstep1024 from '../assets/home/doorstep-1024.webp';
import './Home.css';

/** Rise into view once, as the visitor scrolls. MotionConfig below turns it off for reduced motion. */
const rise = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] as const },
};

const SERVICES = [
  { id: 'cleaning', title: 'Professional Cleaning', text: 'Standard and deep cleaning for flats, duplexes and post-construction projects.', Icon: Eraser, tone: 'sea', cta: 'View pricing', to: '/services' },
  { id: 'power', title: 'Power & Cooling', text: 'Generator maintenance, AC servicing and solar checks to keep the lights on.', Icon: Zap, tone: 'night', cta: 'Book now', to: '/post-job?category=generator-power', hot: true },
  { id: 'plumbing', title: 'Water Systems', text: 'Borehole pump repairs, tank cleaning and plumbing fixes across major estates.', Icon: Droplets, tone: 'sky', cta: 'Book an artisan', to: '/post-job?category=plumbing' },
  { id: 'cooking', title: 'Cooking & Catering', text: 'Chefs for weekly meal prep, family dinners or special events at home.', Icon: ChefHat, tone: 'sun', cta: 'View tiers', to: '/services' },
  { id: 'laundry', title: 'Laundry & Pressing', text: 'Wash, iron and starch with pickup from your door and delivery back.', Icon: Shirt, tone: 'mint', cta: 'View pricing', to: '/services' },
] as const;

const MARQUEE = [
  'AC servicing', 'Generator repair', 'Deep cleaning', 'Borehole & tank', 'Wash, iron & starch',
  'Meal prep', 'Plumbing', 'Electrical', 'Post-construction clean', 'Solar checks',
];

const STEPS = [
  { Icon: Search, title: 'Request a service', text: 'Say what you need, where, and when suits you.' },
  { Icon: UserCheck, title: 'A verified artisan accepts', text: 'Someone near you, ID-checked by Lezerv, takes the job.' },
  { Icon: MessageCircle, title: 'Agree the price in chat', text: 'Settle the quote before any work starts. No surprises.' },
  { Icon: KeyRound, title: 'Start code at the door', text: 'Your 4-digit code proves the right person has arrived.' },
];

const Home: React.FC = () => {
  useSEO({
    title: 'Lezerv | #1 Verified Home Services & Artisans in Nigeria',
    description: "Nigeria's #1 platform for verified home services and local artisans. Hire professional cleaners, plumbers, electricians, AC technicians, generator repairers, and carpenters in Lagos and Abuja.",
    keywords: 'home services Nigeria, cleaning services Lagos, verified cleaners Abuja, hire plumber Nigeria, electrician Lagos, generator repair Lagos, AC technician Abuja, local artisans Nigeria, professional cleaners Lagos, house cleaning Nigeria, handyman services Nigeria'
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="hm">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="hm-hero">
          <div className="hm-aurora" aria-hidden="true">
            <span className="hm-blob hm-blob-a" />
            <span className="hm-blob hm-blob-b" />
            <span className="hm-blob hm-blob-c" />
          </div>

          <div className="hm-hero-inner">
            <motion.div
              className="hm-hero-copy"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            >
              <motion.span className="hm-badge" variants={heroItem}>
                <MapPin size={14} /> Lagos · Abuja · Port Harcourt
              </motion.span>
              <motion.h1 variants={heroItem}>
                Home services, done by <span className="hm-ink">people you can trust.</span>
              </motion.h1>
              <motion.p className="hm-lead" variants={heroItem}>
                Request a service and a verified artisan or cleaner near you takes it: plumbing, power,
                cooling, cleaning, cooking and laundry. Agree the price in chat before anyone starts.
              </motion.p>
              <motion.div className="hm-actions" variants={heroItem}>
                <Link to="/post-job">
                  <Button variant="primary" size="lg" rightIcon={<ArrowIcon size={20} />}>Request for Service</Button>
                </Link>
                <Link to="/services">
                  <Button variant="outline" size="lg">Browse Services</Button>
                </Link>
              </motion.div>
              <motion.ul className="hm-trust" variants={heroItem}>
                <li><ShieldCheck size={16} /> Verified artisans</li>
                <li><MessageCircle size={16} /> In-app chat</li>
                <li><KeyRound size={16} /> Start codes</li>
              </motion.ul>
            </motion.div>

            <motion.div
              className="hm-hero-visual"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
            >
              <HeroPhone />
            </motion.div>
          </div>
        </section>

        {/* ── Marquee ──────────────────────────────────────── */}
        <div className="hm-marquee" aria-label="Services on Lezerv">
          <div className="hm-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} aria-hidden={i >= MARQUEE.length || undefined}>{m}<i className="hm-sep" /></span>
            ))}
          </div>
        </div>

        {/* ── Services ─────────────────────────────────────── */}
        <section className="hm-section">
          <div className="container">
            <motion.header className="hm-head" {...rise}>
              <p className="hm-kicker">Services</p>
              <h2>Reliable help for everything your home needs</h2>
              <p>Verified professionals for the jobs that keep a Nigerian home running.</p>
            </motion.header>

            <div className="hm-services">
              {SERVICES.map(({ id, title, text, Icon, tone, cta, to, ...rest }, i) => (
                <motion.article
                  key={id}
                  className={`hm-service hm-tone-${tone}`}
                  {...rise}
                  transition={{ ...rise.transition, delay: i * 0.07 }}
                >
                  <Link to={to} className="hm-service-link">
                    <div className="hm-service-art" aria-hidden="true">
                      <span className="hm-service-ring" />
                      <Icon size={40} strokeWidth={1.6} />
                    </div>
                    <div className="hm-service-body">
                      {'hot' in rest && <span className="hm-hot"><span className="hm-hot-dot" />High demand</span>}
                      <h3>{title}</h3>
                      <p>{text}</p>
                      <span className="hm-more">{cta} <ArrowIcon size={16} /></span>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="hm-section hm-how">
          <div className="container">
            <motion.header className="hm-head" {...rise}>
              <p className="hm-kicker">How it works</p>
              <h2>From request to done, in four steps</h2>
            </motion.header>
            <ol className="hm-steps">
              <motion.span
                className="hm-steps-line"
                aria-hidden="true"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
              {STEPS.map(({ Icon, title, text }, i) => (
                <motion.li key={title} className="hm-step" {...rise} transition={{ ...rise.transition, delay: 0.15 + i * 0.15 }}>
                  <span className="hm-step-icon"><Icon size={22} /><b>{i + 1}</b></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── At your door ─────────────────────────────────── */}
        <section className="hm-section">
          <div className="container hm-door">
            <motion.figure className="hm-door-photo" {...rise}>
              <img
                src={doorstep1024}
                srcSet={`${doorstep640} 640w, ${doorstep1024} 1024w`}
                sizes="(min-width: 900px) 520px, 92vw"
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                alt="A Lezerv laundry rider handing a customer her freshly pressed clothes at her apartment door"
              />
              <figcaption className="hm-door-chip"><Check size={16} /> Picked up, pressed, delivered</figcaption>
            </motion.figure>
            <motion.div className="hm-door-copy" {...rise} transition={{ ...rise.transition, delay: 0.1 }}>
              <p className="hm-kicker">At your door</p>
              <h2>We come to you, so your day doesn't stop</h2>
              <p>
                Laundry picked up and brought back pressed. A chef in your kitchen for the week's meals.
                An AC technician before the heat gets to you. You stay home, or don't. We work around you.
              </p>
              <ul className="hm-checks">
                <li><Check size={18} /> Book for today or schedule ahead</li>
                <li><Check size={18} /> Chat with your artisan before they arrive</li>
                <li><Check size={18} /> Rate every job, so the best rise to the top</li>
              </ul>
              <Link to="/services">
                <Button variant="primary" size="lg" rightIcon={<ArrowIcon size={20} />}>See laundry pricing</Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── Safety ───────────────────────────────────────── */}
        <section className="hm-safety">
          <div className="container">
            <motion.header className="hm-head hm-head-light" {...rise}>
              <p className="hm-kicker">Your safety</p>
              <h2>Trust is built into every booking</h2>
            </motion.header>
            <div className="hm-safety-grid">
              {[
                { Icon: UserCheck, title: 'Checked before they work', text: 'Artisans send ID before Lezerv lets them take jobs.' },
                { Icon: KeyRound, title: 'A code at the door', text: 'Only the artisan you booked can start the job with your code.' },
                { Icon: Handshake, title: 'Price agreed first', text: 'The quote is settled in chat before any work begins.' },
              ].map(({ Icon, title, text }, i) => (
                <motion.div key={title} className="hm-safety-card" {...rise} transition={{ ...rise.transition, delay: i * 0.1 }}>
                  <span className="hm-safety-icon"><Icon size={24} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────── */}
        <section className="hm-section">
          <div className="container">
            <motion.header className="hm-head" {...rise}>
              <p className="hm-kicker">Customers</p>
              <h2>Trusted by homeowners in Lagos &amp; Abuja</h2>
            </motion.header>
            <div className="hm-quotes">
              <motion.blockquote className="hm-quote" {...rise}>
                <div className="hm-stars" aria-label="5 star rating">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} />)}</div>
                <p>"Lezerv is a lifesaver. Had a generator issue late at night in Lekki, and they got a verified mechanic to my place first thing in the morning."</p>
                <footer>
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFTbEcuYMATHPfQ_GDWr1GTIqkcxZ6q2rfuBe8AO_xkOVCh_yxyyrzrIkW-G2VyGn1nDDruUya0PgUg7uiQFsNBN6Htv0TYGJiGKdMBg_BvnMFf09s7MrujPpWWgYZ7faxSXxYEwxZ6oTdBfraAHSGQQEnnVfOAXFHv5RWCNNbnVDN0mV-89MO08ijUZ0yCWz-x17Nqk50P9b6BKbvNDB2cBA0JE7BaQbMZfQGe7n3LGUjKj3MUicpTAAZBpKeOYAZooHQ_eH4f8ch" alt="" loading="lazy" />
                  <cite>Olawale O.<span>Homeowner, Lekki</span></cite>
                </footer>
              </motion.blockquote>
              <motion.blockquote className="hm-quote" {...rise} transition={{ ...rise.transition, delay: 0.1 }}>
                <div className="hm-stars" aria-label="5 star rating">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} />)}</div>
                <p>"The deep cleaning service for my new apartment in Gwarinpa was exceptional. They removed every bit of paint and dust. Highly recommended!"</p>
                <footer>
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCenrzdSEflAZHlhjtGA53Ju9GmKi2n9tFDI9rrvxtEPa4X5PD88vLMmTC5hAmMr0LDTAZluiQphHXIh8YWNyXRGmDuzjQwE31c3VaL97so_8nw9vIaoJDiuEle6CmlxkYmNsMHtJHLBqfjw5in6GZj1ZIKpv4YTEyaKVyOtPtt9PeD71ikC0aEioO-e_ve9Sxy8sZEIUEtNj8FudhE6GbvoseZ-JKamEhQolgKkB95oABbVaQHWON11JOQ020eB2kwWMSLq7Ff74Nz" alt="" loading="lazy" />
                  <cite>Chioma E.<span>Property manager, Gwarinpa</span></cite>
                </footer>
              </motion.blockquote>
            </div>
          </div>
        </section>

        {/* ── Ambassador ───────────────────────────────────── */}
        <section className="hm-section hm-section-tight">
          <div className="container">
            <motion.div className="hm-promo" {...rise}>
              <span className="hm-promo-icon"><Gift size={28} /></span>
              <div>
                <h2>Earn rewards as a Lezerv Ambassador</h2>
                <p>Share Lezerv with friends and family. When they book a service you earn points, and they get a discount on their first booking.</p>
              </div>
              <Link to="/ambassador"><Button variant="secondary" size="lg">Become an Ambassador</Button></Link>
            </motion.div>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────── */}
        <section className="hm-section hm-section-tight">
          <div className="container">
            <motion.div className="hm-cta" {...rise}>
              <div className="hm-cta-texture" aria-hidden="true" />
              <h2>Ready for a stress-free home?</h2>
              <p>Tell us what needs doing. A verified artisan near you will take it from there.</p>
              <div className="hm-cta-actions">
                <Link to="/post-job"><Button variant="secondary" size="lg">Request for Service</Button></Link>
                <Link to="/become-artisan"><Button variant="outline" size="lg" className="hm-btn-light">Work as an Artisan</Button></Link>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
};

const heroItem = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] as const } },
};

export default Home;
