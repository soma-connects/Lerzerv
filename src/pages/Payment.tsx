import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Landmark, Copy, Check, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import './Payment.css';

const Payment: React.FC = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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

  const handleConfirmPayment = async () => {
    setIsConfirming(true);
    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: 'pending_verification', status: 'awaiting_confirmation' })
      .eq('id', bookingId);
    
    if (!error) {
      alert('Payment notification sent! The admin will verify your transfer shortly.');
      navigate('/profile');
    }
    setIsConfirming(false);
  };

  if (isLoading) return <div className="payment-loading">Loading payment secure checkout...</div>;
  if (!booking) return <div>Booking not found.</div>;

  return (
    <div className="payment-page">
      <div className="container">
        <Link to="/profile" className="back-link">
          <ArrowLeft size={18} /> Back to Profile
        </Link>

        <div className="payment-layout">
          <motion.div 
            className="payment-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
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
              onClick={handleConfirmPayment}
              disabled={isConfirming}
              rightIcon={isConfirming ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            >
              {isConfirming ? 'Notifying Admin...' : 'I have made the transfer'}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
