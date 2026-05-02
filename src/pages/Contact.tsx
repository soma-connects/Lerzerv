import React, { useState } from 'react';
import { Mail, Phone, MapPin, ShieldCheck, Clock, Send } from 'lucide-react';
import { Button } from '../components/ui/Button';
import './Contact.css';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'general',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call for production-grade feel
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page container section animate-fade-in">
      <header className="contact-header">
        <h1>Get in Touch</h1>
        <p>
          Have questions about our services or need help with a booking? Our team is here to support you 24/7.
        </p>
      </header>

      <div className="contact-grid">
        <main className="contact-form-container">
          {isSubmitted ? (
            <div className="submission-success text-center" style={{ padding: 'var(--spacing-2xl) 0' }}>
              <ShieldCheck size={64} color="var(--color-primary)" style={{ margin: '0 auto var(--spacing-lg)' }} />
              <h2>Message Sent!</h2>
              <p>Thank you for reaching out. A member of our support team will get back to you shortly.</p>
              <Button 
                variant="outline" 
                onClick={() => setIsSubmitted(false)}
                style={{ marginTop: 'var(--spacing-xl)' }}
              >
                Send Another Message
              </Button>
            </div>
          ) : (
            <>
              <h2>Send us a Message</h2>
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name" 
                      placeholder="John Doe" 
                      required 
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input 
                      type="email" 
                      id="email" 
                      name="email" 
                      placeholder="john@example.com" 
                      required 
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input 
                      type="tel" 
                      id="phone" 
                      name="phone" 
                      placeholder="+234 ..." 
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="subject">Inquiry Type</label>
                    <select 
                      id="subject" 
                      name="subject" 
                      value={formData.subject}
                      onChange={handleChange}
                    >
                      <option value="general">General Inquiry</option>
                      <option value="booking">Booking Support</option>
                      <option value="artisan">Become a Partner</option>
                      <option value="corporate">Corporate Partnerships</option>
                      <option value="technical">Technical Issue</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="message">How can we help?</label>
                  <textarea 
                    id="message" 
                    name="message" 
                    rows={6} 
                    placeholder="Tell us more about your request..." 
                    required
                    value={formData.message}
                    onChange={handleChange}
                  ></textarea>
                </div>

                <div className="form-footer">
                  <div className="secure-badge">
                    <ShieldCheck size={18} />
                    <span>Your data is secure and encrypted</span>
                  </div>
                  <Button 
                    type="submit" 
                    isLoading={isSubmitting}
                    rightIcon={<Send size={18} />}
                  >
                    Send Message
                  </Button>
                </div>
              </form>
            </>
          )}
        </main>

        <aside className="contact-sidebar">
          <div className="contact-info-card">
            <h3>Contact Information</h3>
            
            <div className="info-item">
              <div className="info-icon">
                <Phone size={20} />
              </div>
              <div>
                <h4>Call Us</h4>
                <p><a href="tel:+2349046367604">09046367604</a></p>
                <p>Support available 24/7</p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">
                <Mail size={20} />
              </div>
              <div>
                <h4>Email Us</h4>
                <p><a href="mailto:support@lezerv.com">support@lezerv.com</a></p>
                <p><a href="mailto:partners@lezerv.com">partners@lezerv.com</a></p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">
                <Clock size={20} />
              </div>
              <div>
                <h4>Business Hours</h4>
                <p>Monday - Friday: 8am - 6pm</p>
                <p>Saturday: 9am - 4pm</p>
                <p>24/7 Emergency Support Available</p>
              </div>
            </div>
          </div>

          <div className="contact-map-card">
            <h3>Our Headquarters</h3>
            <p><MapPin size={18} /> 123 Artisan Plaza, Victoria Island, Lagos</p>
            <div className="map-container">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3964.728551475147!2d3.4173!3d6.4281!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103bf53280e4953f%3A0x8cd935ad44930527!2sVictoria%20Island%2C%20Lagos!5e0!3m2!1sen!2sng!4v1714650000000!5m2!1sen!2sng" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="Lezerv Office Location"
              ></iframe>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Contact;