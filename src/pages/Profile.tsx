import React, { useState, useEffect } from 'react';
import { User, Settings, Shield, LogOut, Package, Wallet } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import './Profile.css';

const Profile: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [personalBookings, setPersonalBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setIsLoading(true);
      
      try {
        // 1. Sync old local orders (Isolated so failure doesn't block loading)
        try {
          await bookingService.syncGuestBookings();
        } catch (syncErr) {
          console.warn('Guest sync failed, continuing to load existing bookings:', syncErr);
        }

        // 2. Fetch using the service (Now standardized)
        const bookings = await bookingService.getMyBookings();
        setPersonalBookings(bookings);
      } catch (err) {
        console.error('Error loading profile data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading || !user) return <div className="loading-container">Loading profile...</div>;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="user-brief">
              <div className="user-avatar">{user.email?.charAt(0).toUpperCase()}</div>
              <div className="user-meta">
                <h3>{user.user_metadata.full_name || 'User'}</h3>
                <p>{user.email}</p>
              </div>
            </div>
            <nav className="profile-nav">
              <Button variant="text" fullWidth className="nav-item active" leftIcon={<User size={18} />}>My Profile</Button>
              <Button variant="text" fullWidth className="nav-item" leftIcon={<Settings size={18} />}>Settings</Button>
              <hr />
              <Button variant="text" fullWidth className="nav-item logout" leftIcon={<LogOut size={18} />} onClick={handleSignOut}>Sign Out</Button>
            </nav>
          </aside>

          <main className="profile-main">
            <header className="profile-header">
              <h1>My Account</h1>
              <p>Manage your account settings and track your real-time service history.</p>
            </header>

            <div className="profile-sections">
              <section className="profile-section">
                <div className="section-header">
                  <h2>Booking History</h2>
                  <Button variant="text" size="sm" onClick={() => navigate('/services')}>New Request</Button>
                </div>
                <div className="profile-bookings-list">
                  {isLoading ? (
                    <div className="loading-bookings">Fetching your bookings...</div>
                  ) : personalBookings.length === 0 ? (
                    <div className="empty-bookings">
                      <Package size={48} className="empty-icon" />
                      <p>You haven't made any bookings yet.</p>
                      <Button variant="outline" size="sm" onClick={() => navigate('/services')}>Browse Services</Button>
                    </div>
                  ) : (
                    <div className="bookings-table-container">
                      <table className="bookings-table">
                        <thead>
                          <tr>
                            <th>Service</th>
                            <th>Order Number</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalBookings.map((booking) => (
                            <tr key={booking.id}>
                              <td>
                                <div className="service-cell">
                                  <strong>{booking.service_name}</strong>
                                  <span className="location-hint">{booking.location.city}</span>
                                </div>
                              </td>
                              <td><span className="order-badge">{booking.order_number}</span></td>
                              <td>{booking.date} at {booking.time}</td>
                              <td>
                                <span className={`status-pill status-${booking.status}`}>
                                  {booking.status}
                                </span>
                              </td>
                              <td>
                                <span className="price-text">{booking.amount_due || 'Pending'}</span>
                              </td>
                              <td>
                                {booking.status === 'approved' && booking.payment_status === 'unpaid' ? (
                                  <Link to={`/payment/${booking.id}`}>
                                    <Button variant="primary" size="sm" leftIcon={<Wallet size={14} />}>Pay Now</Button>
                                  </Link>
                                ) : (
                                  <span className="action-placeholder">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <section className="profile-section">
                <div className="section-header">
                  <h2>Security</h2>
                  <Button variant="outline" size="sm">Update</Button>
                </div>
                <div className="security-item">
                  <div className="security-icon"><Shield size={20} /></div>
                  <div className="security-info">
                    <h4>Two-Factor Authentication</h4>
                    <p>Add an extra layer of security to your account.</p>
                  </div>
                  <div className="security-action">Disabled</div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Profile;
