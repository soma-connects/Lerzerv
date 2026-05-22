import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  MapPin, 
  Calendar, 
  Search,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { bookingService } from '../services/bookingService';
import type { IStoredBooking } from '../types/api';
import './MyBookings.css';

const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<IStoredBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await bookingService.getMyBookings();
        setBookings(data);
      } catch (error) {
        console.error('Failed to fetch bookings', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="text-tertiary" />;
      case 'confirmed': return <CheckCircle2 size={16} className="text-secondary" />;
      case 'completed': return <CheckCircle2 size={16} className="text-primary" />;
      case 'cancelled': return <XCircle size={16} className="text-error" />;
      default: return <AlertCircle size={16} />;
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = b.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         b.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || b.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="bookings-page">
      <div className="container">
        <header className="bookings-header">
          <div className="header-text">
            <h1>My Bookings</h1>
            <p>Track and manage your service requests.</p>
          </div>
          <Button variant="primary">Book New Service</Button>
        </header>

        <div className="bookings-controls">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by service or order ID..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <Filter size={18} className="filter-icon" />
            <select value={filter} onChange={e => setFilter(e.target.value as any)}>
              <option value="all">All Bookings</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Fetching your orders...</p>
          </div>
        ) : filteredBookings.length > 0 ? (
          <div className="bookings-list">
            {filteredBookings.map((booking) => (
              <motion.div 
                key={booking.id}
                className="booking-item-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.005 }}
              >
                <div className="booking-item-main">
                  <div className="booking-item-info">
                    <div className="booking-order-id">
                      {booking.orderNumber}
                    </div>
                    <h3>{booking.serviceName}</h3>
                    <div className="booking-meta">
                      <span className="meta-item">
                        <Calendar size={14} />
                        {new Date(booking.date).toLocaleDateString('en-NG', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })} at {booking.time}
                      </span>
                      <span className="meta-item">
                        <MapPin size={14} />
                        {booking.location.estate ? `${booking.location.estate}, ` : ''}{booking.location.city}
                      </span>
                    </div>
                  </div>
                  <div className="booking-item-actions">
                    <div className={`status-badge status-${booking.status}`}>
                      {getStatusIcon(booking.status)}
                      {getStatusLabel(booking.status)}
                    </div>
                    <Button variant="outline" size="sm" rightIcon={<ChevronRight size={16} />}>
                      Details
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <Clock size={64} strokeWidth={1.5} />
            </div>
            <h2>No bookings found</h2>
            <p>You haven't made any service requests yet or none match your search criteria.</p>
            <div className="empty-actions">
              <Link to="/services">
                <Button variant="primary" size="lg">Explore Our Services</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
