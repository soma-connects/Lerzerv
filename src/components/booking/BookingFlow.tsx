import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import './BookingFlow.css';
import { bookingService } from '../../services/bookingService';
import type { IBookingRequest } from '../../types/api';

interface BookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
}

type Step = 'details' | 'schedule' | 'info' | 'review' | 'success';

const BookingFlow: React.FC<BookingFlowProps> = ({ isOpen, onClose, serviceName }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBooking, setSavedBooking] = useState<any>(null);
  const [formData, setFormData] = useState({
    details: '',
    date: '',
    time: '',
    address: '',
    city: 'Lagos',
    estate: '',
    name: '',
    email: '',
    phone: ''
  });

  const steps: Step[] = ['details', 'schedule', 'info', 'review'];
  const currentStepIdx = steps.indexOf(currentStep);

  const handleNext = async () => {
    if (currentStep === 'details') setCurrentStep('schedule');
    else if (currentStep === 'schedule') setCurrentStep('info');
    else if (currentStep === 'info') setCurrentStep('review');
    else if (currentStep === 'review') {
      await submitBooking();
    }
  };

  const submitBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    const request: IBookingRequest = {
      serviceName,
      details: formData.details,
      date: formData.date,
      time: formData.time,
      location: {
        city: formData.city,
        estate: formData.estate,
        address: formData.address
      },
      customer: {
        name: formData.name,
        phone: formData.phone,
        email: formData.email
      }
    };

    try {
      const response = await bookingService.submitBooking(request);
      if (response.success) {
        setSavedBooking(response.data);
        setCurrentStep('success');
      } else {
        setError(response.error?.message || 'Failed to submit booking. Please try again.');
      }
    } catch (err) {
      setError('A network error occurred. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'schedule') setCurrentStep('details');
    else if (currentStep === 'info') setCurrentStep('schedule');
    else if (currentStep === 'review') setCurrentStep('info');
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="booking-modal-overlay" onClick={onClose}>
      <motion.div 
        className="booking-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <header className="booking-header">
          <h2>Book {serviceName}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </header>

        {currentStep !== 'success' && (
          <div className="booking-steps">
            {steps.map((s, idx) => (
              <div 
                key={s} 
                className={`step-indicator ${idx <= currentStepIdx ? 'step-indicator-active' : ''}`}
              />
            ))}
          </div>
        )}

        <div className="booking-content">
          <AnimatePresence mode="wait">
            {currentStep === 'details' && (
              <motion.div 
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="booking-step-title">
                  <h3>Service Requirements</h3>
                  <p>Give us more context to assign the right professional.</p>
                </div>
                <div className="form-group">
                  <label>Service Description / Special Requests</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="e.g. My generator is making a loud noise, or I need the deep clean to focus on the master bedroom and kitchen cabinets."
                    value={formData.details}
                    onChange={e => updateField('details', e.target.value)}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 'schedule' && (
              <motion.div 
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="booking-step-title">
                  <h3>Preferred Arrival Time</h3>
                  <p>When would you like our professional to visit?</p>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control"
                    value={formData.date}
                    onChange={e => updateField('date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Preferred Window</label>
                  <select 
                    className="form-control"
                    value={formData.time}
                    onChange={e => updateField('time', e.target.value)}
                  >
                    <option value="">Select a window</option>
                    <option value="morning">Morning (8 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                    <option value="evening">Evening (4 PM - 7 PM)</option>
                  </select>
                </div>
              </motion.div>
            )}

            {currentStep === 'info' && (
              <motion.div 
                key="info"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="booking-step-title">
                  <h3>Contact & Location</h3>
                  <p>Where is the service needed?</p>
                </div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                  />
                </div>
                <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>City / State</label>
                    <select 
                      className="form-control"
                      value={formData.city}
                      onChange={e => updateField('city', e.target.value)}
                    >
                      <option value="Lagos">Lagos</option>
                      <option value="Abuja">Abuja</option>
                      <option value="Port Harcourt">Port Harcourt</option>
                      <option value="Ibadan">Ibadan</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Estate / Area (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. VGC, Gwarinpa, etc."
                      value={formData.estate}
                      onChange={e => updateField('estate', e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Exact Address</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="House number, Street name"
                    value={formData.address}
                    onChange={e => updateField('address', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp / Phone Number</label>
                  <input 
                    type="tel" 
                    className="form-control"
                    placeholder="080 1234 5678"
                    value={formData.phone}
                    onChange={e => updateField('phone', e.target.value)}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 'review' && (
              <motion.div 
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="booking-step-title">
                  <h3>Confirm Booking</h3>
                  <p>Please double-check your details before submitting.</p>
                </div>
                <div className="booking-summary bg-surface-container p-lg rounded-xl">
                  <div className="summary-item">
                    <span>Service</span>
                    <span>{serviceName}</span>
                  </div>
                  <div className="summary-item">
                    <span>Location</span>
                    <span>{formData.estate ? `${formData.estate}, ${formData.city}` : formData.city}</span>
                  </div>
                  <div className="summary-item">
                    <span>Date</span>
                    <span>{formData.date || 'Not set'}</span>
                  </div>
                  <div className="summary-item">
                    <span>Contact</span>
                    <span>{formData.phone || 'Not set'}</span>
                  </div>
                  <div className="summary-item">
                    <span>Fee Type</span>
                    <span>Service Base + Inspection</span>
                </div>
              </div>
                {error && (
                  <div className="booking-error-message" style={{ marginTop: 'var(--spacing-md)' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 'success' && (
              <motion.div 
                key="success"
                className="success-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}
              >
                <div className="success-icon" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <CheckCircle2 size={64} color="var(--color-secondary)" style={{ margin: '0 auto' }} />
                </div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginBottom: 'var(--spacing-md)' }}>
                  Booking Request Sent!
                </h3>

                <div 
                  className="order-number-display" 
                  onClick={() => {
                    onClose();
                    navigate(`/track?order=${savedBooking?.order_number}`);
                  }}
                  style={{ 
                    background: 'var(--color-surface-container)', 
                    padding: '1rem', 
                    borderRadius: 'var(--radius-lg)',
                    margin: '1.5rem 0',
                    border: '1px dashed var(--color-primary)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <span style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '0.25rem' }}>Your Tracking Number</span>
                  <strong style={{ fontSize: '1.5rem', letterSpacing: '2px', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                    {savedBooking?.order_number || 'LZ-PROCESSING'}
                  </strong>
                  <span style={{ fontSize: '10px', color: 'var(--color-secondary)', display: 'block', marginTop: '0.5rem', fontWeight: 'bold' }}>
                    Click to track instantly
                  </span>
                </div>

                <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: 'var(--spacing-xl)' }}>
                  Please save this number to <strong>Track your Order</strong> without an account. A verified professional will call you shortly to confirm the appointment.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  <Button variant="primary" onClick={() => {
                    onClose();
                    navigate('/profile');
                  }} fullWidth>
                    View in Profile
                  </Button>
                  <Button variant="outline" onClick={onClose} fullWidth>
                    Return to Home
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {currentStep !== 'success' && (
          <footer className="booking-footer">
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              {currentStepIdx > 0 && (
                <Button 
                  variant="outline" 
                  leftIcon={<ArrowLeft size={18} />}
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}
            </div>
            <Button 
              variant="primary" 
              rightIcon={isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (currentStep === 'review' ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />)}
              onClick={handleNext}
              disabled={(currentStep === 'schedule' && !formData.date) || isSubmitting}
            >
              {isSubmitting ? 'Processing...' : (currentStep === 'review' ? 'Book Now' : 'Next Step')}
            </Button>
          </footer>
        )}
      </motion.div>
    </div>
  );
};

export default BookingFlow;
