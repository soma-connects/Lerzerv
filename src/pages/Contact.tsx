import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Phone, MapPin, ShieldCheck, Clock, Send,
  MessageSquare, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { contactService } from '../services/contactService';
import './Contact.css';
import { useSEO } from '../hooks/useSEO';

interface FormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const INITIAL_DATA: FormData = {
  name: '',
  email: '',
  phone: '',
  subject: 'general',
  message: ''
};

const SUBJECT_OPTIONS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'booking', label: 'Booking Support' },
  { value: 'artisan', label: 'Become a Partner' },
  { value: 'corporate', label: 'Corporate Partnerships' },
  { value: 'technical', label: 'Technical Issue' }
];

const Contact: React.FC = () => {
  useSEO({
    title: 'Contact Us | Lezerv Home Services & Support Nigeria',
    description: 'Get in touch with Lezerv. Contact our support team for cleaning, plumbing, electrical, and other home service bookings or partnerships in Lagos and Abuja.',
    keywords: 'contact lezerv, lezerv phone number, support home services nigeria, cleaning service contact, local artisan support lagos'
  });

  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFocusedField(null);
  };

  const handleFocus = (field: string) => {
    setFocusedField(field);
  };

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null;

    switch (field) {
      case 'name':
        return formData.name.trim().length < 2 ? 'Please enter your full name' : null;
      case 'email':
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ? 'Please enter a valid email' : null;
      case 'phone':
        return formData.phone && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone)
          ? 'Please enter a valid phone number'
          : null;
      case 'message':
        return formData.message.trim().length < 10 ? 'Message must be at least 10 characters' : null;
      default:
        return null;
    }
  };

  const isFormValid = () => {
    return formData.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      formData.message.trim().length >= 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Touch all fields to show errors
    setTouched({
      name: true,
      email: true,
      phone: true,
      message: true
    });

    if (!isFormValid()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await contactService.submitInquiry({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to submit your message.');
      }

      setIsSubmitted(true);
      setFormData(INITIAL_DATA);
      setTouched({});
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setSubmitError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmitError(null);
    setFormData(INITIAL_DATA);
    setTouched({});
  };

  return (
    <div className="contact-page">
      {/* Hero Header */}
      <section className="contact-hero">
        <div className="container">
          <motion.div
            className="contact-header"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="contact-label">Contact Us</span>
            <h1>Get in Touch</h1>
            <p>
              Have questions about our services or need help with a booking?
              Our team is here to support you 24/7.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="contact-content">
        <div className="container">
          <div className="contact-grid">
            {/* Form */}
            <motion.main
              className="contact-form-container"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <AnimatePresence mode="wait">
                {isSubmitted ? (
                  <motion.div
                    key="success"
                    className="submission-success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="success-icon">
                      <CheckCircle2 size={56} strokeWidth={1.5} />
                    </div>
                    <h2>Message Sent!</h2>
                    <p>Thank you for reaching out. A member of our support team will get back to you within 24 hours.</p>
                    <div className="success-details">
                      <div className="success-item">
                        <Clock size={16} />
                        <span>Typical response time: 2-4 hours</span>
                      </div>
                      <div className="success-item">
                        <Mail size={16} />
                        <span>Check your inbox for confirmation</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      size="lg"
                    >
                      Send Another Message
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="form-header">
                      <MessageSquare size={24} className="form-header-icon" />
                      <h2>Send us a Message</h2>
                    </div>

                    <form className="contact-form" onSubmit={handleSubmit} noValidate>
                      {submitError && (
                        <div className="submit-error-banner">
                          <AlertCircle size={18} />
                          <span>{submitError}</span>
                        </div>
                      )}
                      <div className="form-row">
                        <div className={`form-group ${getFieldError('name') ? 'has-error' : ''} ${focusedField === 'name' ? 'is-focused' : ''}`}>
                          <label htmlFor="name">
                            Full Name <span className="required">*</span>
                          </label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            placeholder="John Doe"
                            autoComplete="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            onBlur={() => handleBlur('name')}
                            onFocus={() => handleFocus('name')}
                            aria-invalid={!!getFieldError('name')}
                            aria-describedby={getFieldError('name') ? 'name-error' : undefined}
                          />
                          <AnimatePresence>
                            {getFieldError('name') && (
                              <motion.span
                                id="name-error"
                                className="field-error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                <AlertCircle size={14} />
                                {getFieldError('name')}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className={`form-group ${getFieldError('email') ? 'has-error' : ''} ${focusedField === 'email' ? 'is-focused' : ''}`}>
                          <label htmlFor="email">
                            Email Address <span className="required">*</span>
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            placeholder="john@example.com"
                            autoComplete="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={() => handleBlur('email')}
                            onFocus={() => handleFocus('email')}
                            aria-invalid={!!getFieldError('email')}
                            aria-describedby={getFieldError('email') ? 'email-error' : undefined}
                          />
                          <AnimatePresence>
                            {getFieldError('email') && (
                              <motion.span
                                id="email-error"
                                className="field-error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                <AlertCircle size={14} />
                                {getFieldError('email')}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className={`form-group ${getFieldError('phone') ? 'has-error' : ''} ${focusedField === 'phone' ? 'is-focused' : ''}`}>
                          <label htmlFor="phone">
                            Phone Number <span className="optional">(optional)</span>
                          </label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            placeholder="+234 80X XXX XXXX"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            onBlur={() => handleBlur('phone')}
                            onFocus={() => handleFocus('phone')}
                            aria-invalid={!!getFieldError('phone')}
                            aria-describedby={getFieldError('phone') ? 'phone-error' : undefined}
                          />
                          <AnimatePresence>
                            {getFieldError('phone') && (
                              <motion.span
                                id="phone-error"
                                className="field-error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                <AlertCircle size={14} />
                                {getFieldError('phone')}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className={`form-group ${focusedField === 'subject' ? 'is-focused' : ''}`}>
                          <label htmlFor="subject">Inquiry Type</label>
                          <div className="select-wrapper">
                            <select
                              id="subject"
                              name="subject"
                              value={formData.subject}
                              onChange={handleChange}
                              onFocus={() => handleFocus('subject')}
                              onBlur={() => handleBlur('subject')}
                            >
                              {SUBJECT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className={`form-group full-width ${getFieldError('message') ? 'has-error' : ''} ${focusedField === 'message' ? 'is-focused' : ''}`}>
                        <label htmlFor="message">
                          How can we help? <span className="required">*</span>
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          rows={5}
                          placeholder="Tell us more about your request..."
                          required
                          value={formData.message}
                          onChange={handleChange}
                          onBlur={() => handleBlur('message')}
                          onFocus={() => handleFocus('message')}
                          aria-invalid={!!getFieldError('message')}
                          aria-describedby={getFieldError('message') ? 'message-error' : undefined}
                        />
                        <div className="textarea-meta">
                          <AnimatePresence>
                            {getFieldError('message') && (
                              <motion.span
                                id="message-error"
                                className="field-error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                <AlertCircle size={14} />
                                {getFieldError('message')}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span className={`char-count ${formData.message.length >= 10 ? 'valid' : ''}`}>
                            {formData.message.length}/500
                          </span>
                        </div>
                      </div>

                      <div className="form-footer">
                        <div className="secure-badge">
                          <ShieldCheck size={18} />
                          <span>256-bit SSL encrypted</span>
                        </div>
                        <Button
                          type="submit"
                          isLoading={isSubmitting}
                          disabled={!isFormValid() && Object.keys(touched).length > 0}
                          size="lg"
                          rightIcon={isSubmitting ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                        >
                          {isSubmitting ? 'Sending...' : 'Send Message'}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.main>

            {/* Sidebar */}
            <motion.aside
              className="contact-sidebar"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {/* Quick Contact Card */}
              <div className="sidebar-card contact-quick">
                <h3>Quick Contact</h3>
                <div className="quick-item">
                  <div className="quick-icon primary">
                    <Phone size={20} />
                  </div>
                  <div className="quick-content">
                    <span className="quick-label">Call Us</span>
                    <a href="tel:+2349046367604" className="quick-value">0904 636 7604</a>
                    <span className="quick-meta">24/7 Support</span>
                  </div>
                </div>
                <div className="quick-item">
                  <div className="quick-icon secondary">
                    <Mail size={20} />
                  </div>
                  <div className="quick-content">
                    <span className="quick-label">Email Us</span>
                    <a href="mailto:support@lezerv.com" className="quick-value">support@lezerv.com</a>
                    <span className="quick-meta">Response in 2-4 hrs</span>
                  </div>
                </div>
              </div>

              {/* Hours Card */}
              <div className="sidebar-card contact-hours">
                <h3>Business Hours</h3>
                <ul className="hours-list">
                  <li>
                    <span className="day">Monday — Friday</span>
                    <span className="time">8:00 AM — 6:00 PM</span>
                  </li>
                  <li>
                    <span className="day">Saturday</span>
                    <span className="time">9:00 AM — 4:00 PM</span>
                  </li>
                  <li className="highlight">
                    <span className="day">Emergency Support</span>
                    <span className="time">24/7 Available</span>
                  </li>
                </ul>
              </div>

              {/* Location Card */}
              <div className="sidebar-card contact-location">
                <h3>
                  <MapPin size={18} />
                  Our Headquarters
                </h3>
                <address>
                  123 Artisan Plaza,<br />
                  Victoria Island,<br />
                  Lagos, Nigeria
                </address>
                <div className="map-container">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3964.728551475147!2d3.4173!3d6.4281!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103bf53280e4953f%3A0x8cd935ad44930527!2sVictoria%20Island%2C%20Lagos!5e0!3m2!1sen!2sng!4v1714650000000!5m2!1sen!2sng"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Lezerv Office Location"
                  />
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;