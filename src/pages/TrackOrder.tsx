import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import './TrackOrder.css';

const TrackOrder: React.FC = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<string[]>([]);

  const { user, loading: authLoading } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    console.log('TrackOrder state:', { user, authLoading });
    const saved = JSON.parse(localStorage.getItem('lezerv_recent_orders') || '[]');
    setRecentOrders(saved);

    // Check for order parameter in URL
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    if (orderParam) {
      handleTrack(undefined, orderParam);
    }
  }, [user]);

  const handleClaim = async () => {
    if (!user || !booking) return;
    setIsClaiming(true);
    const { error } = await supabase
      .from('bookings')
      .update({ user_id: user.id })
      .eq('id', booking.id);
    
    if (!error) {
      setBooking({ ...booking, user_id: user.id });
      alert('This booking has been linked to your account successfully!');
    }
    setIsClaiming(false);
  };

  const handleTrack = async (e?: React.FormEvent, manualNo?: string) => {
    if (e) e.preventDefault();
    const query = manualNo || orderNumber;
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setBooking(null);

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('order_number', query.trim().toUpperCase())
        .single();

      if (error || !data) {
        throw new Error('Order not found. Please check the number and try again.');
      }

      // AUTO-LINK: If user is logged in and booking is a guest booking, link it now
      if (user && !data.user_id) {
        await supabase
          .from('bookings')
          .update({ user_id: user.id })
          .eq('id', data.id);
        data.user_id = user.id; // Update local state
      }

      setBooking(data);
      if (manualNo) setOrderNumber(manualNo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="track-page">
      <div className="container">
        <div className="track-container">
          <div className="track-header">
            <h1>Track Your Request</h1>
            <p>Enter your order number or select a recent request below.</p>
          </div>

          <form onSubmit={handleTrack} className="track-search-form">
            <div className="search-input-wrapper">
              <Search size={20} className="search-icon" />
              <input 
                type="text" 
                placeholder="LZ-123456"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                autoFocus
              />
              <Button 
                type="submit" 
                variant="primary" 
                disabled={isLoading}
              >
                {isLoading ? 'Searching...' : 'Track'}
              </Button>
            </div>
          </form>

          {recentOrders.length > 0 && !booking && (
            <div className="recent-orders-hint">
              <span>Your Recent Requests:</span>
              <div className="recent-tags">
                {recentOrders.map(no => (
                  <button key={no} onClick={() => handleTrack(undefined, no)} className="recent-tag">
                    <Clock size={14} />
                    {no}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                className="track-error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AlertCircle size={20} />
                <span>{error}</span>
              </motion.div>
            )}

            {booking && (
              <motion.div 
                className="track-result-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={booking.id}
              >
                <div className="result-main">
                  <div className="booking-summary">
                    <span className="order-tag">{booking.order_number}</span>
                    <h2>{booking.service_name}</h2>
                    <p className="booking-meta">{booking.date} at {booking.time}</p>
                  </div>
                  <div className="status-indicator">
                    <span className={`status-pill status-${booking.status.replace(/ /g, '-').replace(/\//g, '-')}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>

                <div className="result-details">
                  <div className="detail-item">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{booking.location.estate || booking.location.city}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Payment Status</span>
                    <span className={`payment-text ${booking.payment_status}`}>{booking.payment_status}</span>
                  </div>
                </div>

                {user && !booking.user_id && (
                  <div className="claim-banner">
                    <p>This is a guest booking. Would you like to link it to your account?</p>
                    <Button variant="outline" size="sm" onClick={handleClaim} disabled={isClaiming}>
                      {isClaiming ? 'Linking...' : 'Link to Account'}
                    </Button>
                  </div>
                )}

                {booking.status === 'approved' && booking.payment_status === 'unpaid' && (
                  <div className="payment-cta">
                    <div className="cta-info">
                      <h3>Action Required: Payment</h3>
                      <p>Your request has been approved! The final price is <strong>{booking.amount_due}</strong>.</p>
                    </div>
                    <Link to={`/payment/${booking.id}`}>
                      <Button variant="primary" rightIcon={<ArrowRight size={18} />}>Proceed to Payment</Button>
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!booking && !isLoading && !error && (
            <div className="track-empty-state">
              <div className="empty-icon-circle">
                <Package size={48} strokeWidth={1.5} />
              </div>
              <h3>Ready to track your order?</h3>
              <p>Enter the order number (e.g., LZ-123456) sent to your email to see real-time updates on your service request.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackOrder;
