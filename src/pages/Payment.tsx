import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Landmark, 
  Copy, 
  Check, 
  ArrowLeft, 
  ShieldCheck, 
  Loader2, 
  CreditCard, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { emailService } from '../services/emailService';
import { ambassadorService } from '../services/ambassadorService';
import './Payment.css';

type TPaymentMethod = 'bank_transfer' | 'card' | 'pod' | null;

const Payment: React.FC = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  
  const [booking, setBooking] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Payment selection and method state
  const [paymentMethod, setPaymentMethod] = useState<TPaymentMethod>(null);
  
  // Credit Card state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardFocusedField, setCardFocusedField] = useState<'number' | 'name' | 'expiry' | 'cvv' | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingRes, settingsRes] = await Promise.all([
          supabase.from('bookings').select('*').eq('id', bookingId).single(),
          supabase.from('settings').select('*').eq('key', 'payment_details').single()
        ]);

        if (bookingRes.data) setBooking(bookingRes.data);
        if (settingsRes.data) setPaymentDetails(settingsRes.data.value);
      } catch (err) {
        console.error('Error fetching payment data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bookingId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleBankPaymentConfirm = async () => {
    setIsConfirming(true);
    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: 'pending_verification', status: 'awaiting_confirmation' })
      .eq('id', bookingId);
    
    setIsConfirming(false);
    if (!error) {
      // Notify Admin via email
      try {
        await emailService.sendPaymentNotificationEmail(
          booking?.order_number || 'N/A',
          booking?.customer?.name || 'Guest',
          booking?.amount_due || 'Pending Quote'
        );
      } catch (err) {
        console.warn('Failed to send admin payment email:', err);
      }
      alert('Payment notification sent! The admin will verify your transfer shortly.');
      navigate('/profile');
    } else {
      alert(`Error updating payment: ${error.message}`);
    }
  };

  const handleOnlineCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      alert('Please fill out all credit card fields.');
      return;
    }
    
    setIsConfirming(true);
    
    // Simulate a secure payment authorization process (spinner & delays)
    setTimeout(async () => {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', bookingId);
        
      setIsConfirming(false);
      if (!error) {
        // Award referral points since payment is fully successful
        try {
          await ambassadorService.completeReferral(bookingId!);
        } catch (refErr) {
          console.warn('Failed to credit ambassador points on card payment:', refErr);
        }
        alert('Payment Approved! Your service booking is now confirmed in real-time.');
        navigate('/profile');
      } else {
        alert(`Transaction failed: ${error.message}`);
      }
    }, 2500);
  };

  const handlePayOnDeliveryConfirm = async () => {
    setIsConfirming(true);
    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: 'pay_on_delivery', status: 'confirmed' })
      .eq('id', bookingId);
      
    setIsConfirming(false);
    if (!error) {
      alert('Pay on Delivery Confirmed! Your booking has been successfully scheduled.');
      navigate('/profile');
    } else {
      alert(`Error scheduling: ${error.message}`);
    }
  };

  // Format Card Number input with spaces
  const onCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const matched = rawVal.match(/.{1,4}/g);
    const formatted = matched ? matched.join(' ') : '';
    setCardNumber(formatted.substring(0, 19));
  };

  // Format Expiry MM/YY
  const onCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (rawVal.length <= 2) {
      setCardExpiry(rawVal);
    } else {
      setCardExpiry(`${rawVal.slice(0, 2)}/${rawVal.slice(2, 4)}`);
    }
  };

  if (isLoading) return <div className="payment-loading">Loading payment secure checkout...</div>;
  if (!booking) return <div className="payment-loading">Booking not found.</div>;

  return (
    <div className="payment-page">
      <div className="container">
        <Link to="/profile" className="back-link">
          <ArrowLeft size={18} /> Back to Profile
        </Link>

        <div className="payment-layout">
          <AnimatePresence mode="wait">
            {/* METHOD SELECTION SCREEN */}
            {paymentMethod === null && (
              <motion.div 
                className="payment-card selection-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                key="selection"
              >
                <div className="payment-header">
                  <div className="secure-badge">
                    <ShieldCheck size={16} /> SECURE CHECKOUT
                  </div>
                  <h1>Choose Payment Method</h1>
                  <p>Select how you would like to clear your quote for <strong>{booking.service_name}</strong>.</p>
                </div>

                <div className="payment-summary">
                  <div className="summary-row">
                    <span>Order Number</span>
                    <strong>{booking.order_number}</strong>
                  </div>
                  <div className="summary-total">
                    <span>Total Amount Due</span>
                    <span className="total-price">{booking.amount_due}</span>
                  </div>
                </div>

                <div className="methods-grid">
                  {/* DIRECT BANK TRANSFER */}
                  <div className="method-item" onClick={() => setPaymentMethod('bank_transfer')}>
                    <div className="method-icon-container">
                      <Landmark size={24} />
                    </div>
                    <div className="method-info">
                      <h3>Direct Bank Transfer</h3>
                      <p>Transfer from your bank app. Requires manual admin confirmation.</p>
                    </div>
                  </div>

                  {/* ONLINE CARD PAYMENT */}
                  <div className="method-item recommend" onClick={() => setPaymentMethod('card')}>
                    <span className="recommend-tag"><Sparkles size={10} /> Instant Confirmation</span>
                    <div className="method-icon-container">
                      <CreditCard size={24} />
                    </div>
                    <div className="method-info">
                      <h3>Pay Online (Card/USSD)</h3>
                      <p>Secure online processing. Instantly confirms your artisan visit.</p>
                    </div>
                  </div>

                  {/* PAY ON DELIVERY */}
                  <div className="method-item" onClick={() => setPaymentMethod('pod')}>
                    <div className="method-icon-container">
                      <DollarSign size={24} />
                    </div>
                    <div className="method-info">
                      <h3>Pay on Delivery</h3>
                      <p>Settle with the artisan in cash or transfer upon project completion.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* DIRECT BANK TRANSFER SCREEN */}
            {paymentMethod === 'bank_transfer' && (
              <motion.div 
                className="payment-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                key="bank_transfer"
              >
                <div className="method-breadcrumb" onClick={() => setPaymentMethod(null)}>
                  <ArrowLeft size={16} /> Choose different method
                </div>

                <div className="payment-header">
                  <div className="payment-icon">
                    <Landmark size={32} color="var(--color-primary)" />
                  </div>
                  <h1>Mobile Bank Transfer</h1>
                  <p>Please transfer the amount below to the provided bank account details.</p>
                </div>

                <div className="payment-summary">
                  <div className="summary-row">
                    <span>Service</span>
                    <strong>{booking.service_name}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Order Number</span>
                    <strong>{booking.order_number}</strong>
                  </div>
                  <div className="summary-total">
                    <span>Total Amount Due</span>
                    <span className="total-price">{booking.amount_due}</span>
                  </div>
                </div>

                <div className="bank-details-box">
                  <div className="bank-detail">
                    <label>Bank Name</label>
                    <div className="detail-value-row">
                      <span>{paymentDetails?.bank_name}</span>
                      <button onClick={() => handleCopy(paymentDetails?.bank_name)}><Copy size={16} /></button>
                    </div>
                  </div>
                  <div className="bank-detail">
                    <label>Account Number</label>
                    <div className="detail-value-row">
                      <span className="account-number">{paymentDetails?.account_number}</span>
                      <button onClick={() => handleCopy(paymentDetails?.account_number)}><Copy size={16} /></button>
                    </div>
                  </div>
                  <div className="bank-detail">
                    <label>Account Name</label>
                    <div className="detail-value-row">
                      <span>{paymentDetails?.account_name}</span>
                      <button onClick={() => handleCopy(paymentDetails?.account_name)}><Copy size={16} /></button>
                    </div>
                  </div>
                </div>

                <div className="payment-instructions">
                  <ShieldCheck size={20} />
                  <p>{paymentDetails?.instructions}</p>
                </div>

                {isCopied && <div className="copy-toast">Copied to clipboard!</div>}

                <Button 
                  variant="primary" 
                  fullWidth 
                  size="lg" 
                  onClick={handleBankPaymentConfirm}
                  disabled={isConfirming}
                  rightIcon={isConfirming ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                >
                  {isConfirming ? 'Notifying Admin...' : 'I have made the transfer'}
                </Button>
              </motion.div>
            )}

            {/* ONLINE CARD SECURE PROCESSING */}
            {paymentMethod === 'card' && (
              <motion.div 
                className="payment-card card-checkout-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                key="card"
              >
                <div className="method-breadcrumb" onClick={() => setPaymentMethod(null)}>
                  <ArrowLeft size={16} /> Choose different method
                </div>

                <div className="payment-header">
                  <div className="payment-icon">
                    <CreditCard size={32} color="var(--color-primary)" />
                  </div>
                  <h1>Pay with Credit Card</h1>
                  <p>Enter your card credentials below. Payments are securely encrypted.</p>
                </div>

                {/* VISUAL CARD PREVIEW */}
                <div className="credit-card-mockup">
                  <div className="card-mockup-inner">
                    <div className="card-top-row">
                      <span className="card-chip"></span>
                      <span className="card-logo">VISA</span>
                    </div>
                    <div className={`card-number-display ${cardFocusedField === 'number' ? 'focused' : ''}`}>
                      {cardNumber || '•••• •••• •••• ••••'}
                    </div>
                    <div className="card-bottom-row">
                      <div className={`card-name-display ${cardFocusedField === 'name' ? 'focused' : ''}`}>
                        <label>Cardholder</label>
                        <span>{cardName.toUpperCase() || 'FULL NAME'}</span>
                      </div>
                      <div className={`card-expiry-display ${cardFocusedField === 'expiry' ? 'focused' : ''}`}>
                        <label>Expires</label>
                        <span>{cardExpiry || 'MM/YY'}</span>
                      </div>
                      <div className={`card-cvv-display ${cardFocusedField === 'cvv' ? 'focused' : ''}`}>
                        <label>CVV</label>
                        <span>{cardCvv || '•••'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleOnlineCardPayment} className="card-checkout-form">
                  <div className="form-group">
                    <label>Card Number</label>
                    <input 
                      type="text" 
                      className="form-control card-input" 
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={onCardNumberChange}
                      onFocus={() => setCardFocusedField('number')}
                      onBlur={() => setCardFocusedField(null)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Cardholder Name</label>
                    <input 
                      type="text" 
                      className="form-control card-input" 
                      placeholder="John Doe"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      onFocus={() => setCardFocusedField('name')}
                      onBlur={() => setCardFocusedField(null)}
                      required
                    />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Expiration Date</label>
                      <input 
                        type="text" 
                        className="form-control card-input" 
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={onCardExpiryChange}
                        onFocus={() => setCardFocusedField('expiry')}
                        onBlur={() => setCardFocusedField(null)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>CVV</label>
                      <input 
                        type="password" 
                        maxLength={3}
                        className="form-control card-input" 
                        placeholder="123"
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        onFocus={() => setCardFocusedField('cvv')}
                        onBlur={() => setCardFocusedField(null)}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    variant="primary" 
                    fullWidth 
                    size="lg" 
                    disabled={isConfirming}
                    rightIcon={isConfirming ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  >
                    {isConfirming ? 'Processing Securely...' : `Pay ${booking.amount_due} Now`}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* PAY ON DELIVERY */}
            {paymentMethod === 'pod' && (
              <motion.div 
                className="payment-card pod-confirmation-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                key="pod"
              >
                <div className="method-breadcrumb" onClick={() => setPaymentMethod(null)}>
                  <ArrowLeft size={16} /> Choose different method
                </div>

                <div className="payment-header">
                  <div className="payment-icon">
                    <DollarSign size={32} color="var(--color-primary)" />
                  </div>
                  <h1>Confirm Pay on Delivery</h1>
                  <p>You can settle payment directly with our artisan once the service is complete.</p>
                </div>

                <div className="payment-summary">
                  <div className="summary-row">
                    <span>Order Number</span>
                    <strong>{booking.order_number}</strong>
                  </div>
                  <div className="summary-total">
                    <span>Total Amount to Pay</span>
                    <span className="total-price">{booking.amount_due}</span>
                  </div>
                </div>

                <div className="pod-notice-box">
                  <ShieldCheck size={24} className="pod-notice-icon" />
                  <div>
                    <h3>Satisfaction Guaranteed</h3>
                    <p>You only pay when the assigned artisan has successfully finished the task and met your standards. Payment can be made in cash or direct transfer to the artisan.</p>
                  </div>
                </div>

                <Button 
                  variant="primary" 
                  fullWidth 
                  size="lg" 
                  onClick={handlePayOnDeliveryConfirm}
                  disabled={isConfirming}
                  rightIcon={isConfirming ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                >
                  {isConfirming ? 'Scheduling Service...' : 'Confirm & Schedule Service'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Payment;
