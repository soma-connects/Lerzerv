import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MapPin, Briefcase, HardHat, Wrench, Zap, Droplets, Hammer, CheckCircle2, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { applicationService } from '../services/applicationService';
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
  tag: 'Needed' | 'Apply for this role';
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
    tag: "Needed"
  },
  {
    title: "Master Plumber",
    location: "Lagos (Gbagada, Surulere, Victoria Island)",
    icon: <Droplets size={20} />,
    tag: "Apply for this role"
  },
  {
    title: "Generator Technician",
    location: "Lagos (Ikorodu, Maryland, Festac)",
    icon: <Wrench size={20} />,
    tag: "Needed"
  },
  {
    title: "AC & Cooling Expert",
    location: "Lagos (Island & Mainland)",
    icon: <HardHat size={20} />,
    tag: "Apply for this role"
  },
  {
    title: "Carpenter & Woodwork",
    location: "Lagos (Ikoyi, Ajah, Yaba)",
    icon: <Hammer size={20} />,
    tag: "Needed"
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
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ title: string; type: 'artisan' | 'corporate' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    experience: '',
    message: ''
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null;
    switch (field) {
      case 'name':
        return formData.name.trim().length < 2 ? 'Full name is required' : null;
      case 'email':
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ? 'A valid email is required' : null;
      case 'phone':
        return !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone) ? 'A valid phone number is required (min 10 digits)' : null;
      case 'experience':
        return formData.experience.trim().length < 10 ? 'Please describe your experience in detail (min 10 chars)' : null;
      default:
        return null;
    }
  };

  const isFormValid = () => {
    return formData.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      /^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone) &&
      formData.experience.trim().length >= 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, experience: true });
    
    if (!isFormValid() || !selectedRole) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await applicationService.submitApplication({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role_title: selectedRole.title,
        role_type: selectedRole.type,
        experience: formData.experience,
        message: formData.message || undefined
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to submit application.');
      }

      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', experience: '', message: '' });
      setTouched({});
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                src="https://images.unsplash.com/photo-1545180136-156a63753768?auto=format&fit=crop&w=800&q=80"
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
                        onClick={() => {
                          setSelectedRole({ title: role.title, type: 'artisan' });
                          setIsModalOpen(true);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="role-main">
                          <div className="role-icon" style={{
                            backgroundColor: 'var(--color-primary-container)',
                            color: 'var(--color-on-primary-container)'
                          }}>
                            {role.icon}
                          </div>
                          <div className="role-info">
                            <div className="role-header">
                              <h3>{role.title}</h3>
                              <span className={`demand-badge ${role.tag.toLowerCase().replace(/\s+/g, '-')}`}>
                                {role.tag}
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
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => {
                      setSelectedRole({ title: 'General Artisan Partner', type: 'artisan' });
                      setIsModalOpen(true);
                    }}
                  >
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
                      <Button
                        variant="outline"
                        size="sm"
                        rightIcon={<ArrowRight size={16} />}
                        onClick={() => {
                          setSelectedRole({ title: role.title, type: 'corporate' });
                          setIsModalOpen(true);
                        }}
                      >
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
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setSelectedRole({ title: 'General Corporate Candidate', type: 'corporate' });
                setIsModalOpen(true);
              }}
            >
              Contact Recruitment
            </Button>
          </div>
        </div>
      </section>

      {/* Careers Application Modal */}
      <AnimatePresence>
        {isModalOpen && selectedRole && (
          <div className="modal-backdrop" onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }}>
            <motion.div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
            >
              <button className="modal-close-btn" onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }} aria-label="Close modal">
                <X size={20} />
              </button>

              <div className="modal-header">
                <div className="modal-badge-wrapper">
                  <span className={`modal-badge ${selectedRole.type}`}>
                    {selectedRole.type === 'artisan' ? 'Artisan Partnership' : 'Corporate Role'}
                  </span>
                </div>
                <h2>Apply for {selectedRole.title}</h2>
                <p>Submit your details to start the verification process.</p>
              </div>

              {isSubmitted ? (
                <motion.div
                  className="modal-success-state"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="success-icon-container">
                    <CheckCircle2 size={48} className="success-icon" />
                  </div>
                  <h3>Application Submitted!</h3>
                  <p>
                    Thank you for applying. Our talent acquisition team will review your profile.
                    {selectedRole.type === 'artisan' 
                      ? ' We will contact you within 48 hours for the next verification steps.'
                      : ' We will reach out to you within 3-5 business days.'}
                  </p>
                  <Button variant="primary" onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }} size="lg">
                    Got it, Thanks!
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                  {submitError && (
                    <div className="modal-error-banner">
                      <AlertCircle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="form-group-grid">
                    <div className={`form-group ${getFieldError('name') ? 'has-error' : ''}`}>
                      <label htmlFor="modal-name">Full Name <span className="required">*</span></label>
                      <input
                        type="text"
                        id="modal-name"
                        name="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                        required
                      />
                      {getFieldError('name') && <span className="field-error"><AlertCircle size={12} />{getFieldError('name')}</span>}
                    </div>

                    <div className={`form-group ${getFieldError('email') ? 'has-error' : ''}`}>
                      <label htmlFor="modal-email">Email Address <span className="required">*</span></label>
                      <input
                        type="email"
                        id="modal-email"
                        name="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                        required
                      />
                      {getFieldError('email') && <span className="field-error"><AlertCircle size={12} />{getFieldError('email')}</span>}
                    </div>
                  </div>

                  <div className="form-group-grid">
                    <div className={`form-group ${getFieldError('phone') ? 'has-error' : ''}`}>
                      <label htmlFor="modal-phone">Phone Number <span className="required">*</span></label>
                      <input
                        type="tel"
                        id="modal-phone"
                        name="phone"
                        placeholder="+234 80X XXX XXXX"
                        value={formData.phone}
                        onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                        required
                      />
                      {getFieldError('phone') && <span className="field-error"><AlertCircle size={12} />{getFieldError('phone')}</span>}
                    </div>

                    <div className="form-group">
                      <label>Applying For</label>
                      <input
                        type="text"
                        value={selectedRole.title}
                        disabled
                        className="disabled-input"
                      />
                    </div>
                  </div>

                  <div className={`form-group ${getFieldError('experience') ? 'has-error' : ''}`}>
                    <label htmlFor="modal-experience">
                      {selectedRole.type === 'artisan' ? 'Artisan Experience & Specialty' : 'Professional Background & Experience'} <span className="required">*</span>
                    </label>
                    <textarea
                      id="modal-experience"
                      name="experience"
                      rows={3}
                      placeholder={selectedRole.type === 'artisan' 
                        ? "E.g., 5 years experience in master electrical work, expert in conduit wiring and DB installations..." 
                        : "E.g., 3 years experience building responsive web UIs in React, specializing in accessibility and animations..."}
                      value={formData.experience}
                      onChange={e => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                      onBlur={() => setTouched(prev => ({ ...prev, experience: true }))}
                      required
                    />
                    {getFieldError('experience') && <span className="field-error"><AlertCircle size={12} />{getFieldError('experience')}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="modal-message">Cover Note / Additional Details <span className="optional">(optional)</span></label>
                    <textarea
                      id="modal-message"
                      name="message"
                      rows={2}
                      placeholder="Anything else you'd like to share with our recruitment team..."
                      value={formData.message}
                      onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    />
                  </div>

                  <div className="modal-form-footer">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSubmitting}
                      disabled={!isFormValid() && Object.keys(touched).length > 0}
                      rightIcon={isSubmitting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Careers;