import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Clock, 
  MoreHorizontal,
  Save,
  Plus,
  Sparkles,
  X,
  Mail,
  Phone,
  Briefcase
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import './Admin.css';

type TBooking = {
  id: string;
  order_number: string;
  service_name: string;
  status: 'pending' | 'approved' | 'awaiting_confirmation' | 'confirmed' | 'completed' | 'cancelled';
  amount_due?: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  created_at: string;
  payment_status?: string;
};

type TService = {
  id: string;
  title: string;
  category: string;
  price: string;
};

type TApplication = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role_title: string;
  role_type: 'artisan' | 'corporate';
  experience: string;
  message?: string | null;
  created_at: string;
};

type TToast = {
  id: string;
  title: string;
  message: string;
};

type TPaymentSettings = {
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions: string;
};

const Admin: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'settings' | 'applications'>('bookings');
  const [bookings, setBookings] = useState<TBooking[]>([]);
  const [services, setServices] = useState<TService[]>([]);
  const [applications, setApplications] = useState<TApplication[]>([]);
  const [unreadApplicationsCount, setUnreadApplicationsCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<TToast[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<TPaymentSettings>({
    bank_name: '',
    account_number: '',
    account_name: '',
    instructions: ''
  });

  useEffect(() => {
    if (isAdmin) {
      fetchData();

      // Subscribe to real-time updates for job applications
      const channel = supabase
        .channel('realtime_admin_job_applications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'job_applications' },
          (payload: { new: TApplication }) => {
            const newApp = payload.new;
            setApplications((prev: TApplication[]) => [newApp, ...prev]);
            
            // Show custom in-app glassmorphic notification toast
            const toastId = Date.now().toString();
            setNotifications((prev: TToast[]) => [
              ...prev,
              {
                id: toastId,
                title: 'New Career Application!',
                message: `${newApp.name} applied as ${newApp.role_title}`
              }
            ]);

            // Auto-dismiss toast after 6 seconds
            setTimeout(() => {
              setNotifications((prev: TToast[]) => prev.filter((n: TToast) => n.id !== toastId));
            }, 6000);

            // Increment unread count if we are not actively viewing the applications tab
            setUnreadApplicationsCount((prev: number) => prev + 1);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'applications') {
      setUnreadApplicationsCount(0);
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const [bookingsRes, servicesRes, settingsRes, applicationsRes] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('services').select('*').order('category'),
        supabase.from('settings').select('*').eq('key', 'payment_details').single(),
        supabase.from('job_applications').select('*').order('created_at', { ascending: false })
      ]);

      if (bookingsRes.data) setBookings(bookingsRes.data as TBooking[]);
      if (servicesRes.data) setServices(servicesRes.data as TService[]);
      if (settingsRes.data) setPaymentSettings(settingsRes.data.value as TPaymentSettings);
      if (applicationsRes.data) setApplications(applicationsRes.data as TApplication[]);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  const updateBookingStatus = async (id: string, status: string, amount?: string) => {
    const updates: { status: string; amount_due?: string } = { status };
    if (amount) updates.amount_due = amount;
    
    const { error } = await supabase.from('bookings').update(updates).eq('id', id);
    if (!error) fetchData();
  };

  const saveSettings = async () => {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'payment_details', value: paymentSettings });
    if (!error) alert('Settings saved successfully!');
  };

  if (loading) return <div>Loading...</div>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="admin-page">
      <div className="container-fluid">
        <header className="admin-header">
          <div>
            <h1>Management Console</h1>
            <p>Control pricing, payments, and service requests.</p>
          </div>
          <nav className="admin-tabs">
            <button className={activeTab === 'bookings' ? 'active' : ''} onClick={() => setActiveTab('bookings')}>Bookings</button>
            <button className={activeTab === 'services' ? 'active' : ''} onClick={() => setActiveTab('services')}>Pricing</button>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Payment Details</button>
            <button className={activeTab === 'applications' ? 'active' : ''} onClick={() => setActiveTab('applications')}>
              Applications
              {unreadApplicationsCount > 0 && (
                <span className="admin-badge-count">{unreadApplicationsCount}</span>
              )}
            </button>
          </nav>
        </header>

        {activeTab === 'bookings' && (
          <>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><ShoppingBag size={20} /></div>
                <div className="stat-info"><span className="stat-label">Total Orders</span><span className="stat-value">{bookings.length}</span></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{color: 'var(--color-tertiary)'}}><Clock size={20} /></div>
                <div className="stat-info"><span className="stat-label">Pending</span><span className="stat-value">{bookings.filter((b: TBooking) => b.status === 'pending').length}</span></div>
              </div>
            </div>

            <div className="admin-content-card">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Service</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length > 0 ? (
                      bookings.map((booking: TBooking) => (
                        <tr key={booking.id}>
                          <td>{booking.order_number}</td>
                          <td>{booking.service_name}</td>
                          <td>{booking.customer.name}</td>
                          <td><span className={`status-pill status-${booking.status}`}>{booking.status}</span></td>
                          <td className="table-actions">
                            {booking.status === 'pending' && (
                              <Button size="sm" onClick={() => {
                                const amount = prompt('Enter the final price for this service (e.g. ₦12,500):');
                                if (amount) updateBookingStatus(booking.id, 'approved', amount);
                              }}>Approve & Price</Button>
                            )}
                            {booking.status === 'awaiting_confirmation' && (
                              <Button size="sm" variant="secondary" onClick={async () => {
                                const { error } = await supabase
                                  .from('bookings')
                                  .update({ status: 'confirmed', payment_status: 'paid' })
                                  .eq('id', booking.id);
                                if (!error) fetchData();
                              }}>Confirm Payment</Button>
                            )}
                            <Button variant="text" size="sm"><MoreHorizontal size={18} /></Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">
                          <ShoppingBag size={32} style={{opacity: 0.3, marginBottom: '0.5rem'}} />
                          <p>No service requests found in the system.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'services' && (
          <div className="admin-content-card">
            <div className="card-header">
              <h2>Service Pricing</h2>
              <Button size="sm" leftIcon={<Plus size={16} />}>Add Service</Button>
            </div>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Service Title</th>
                    <th>Category</th>
                    <th>Current Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length > 0 ? (
                    services.map((service: TService) => (
                      <tr key={service.id}>
                        <td>{service.title}</td>
                        <td>{service.category}</td>
                        <td>{service.price}</td>
                        <td><Button variant="outline" size="sm">Edit Price</Button></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-table-cell">
                        <Plus size={32} style={{opacity: 0.3, marginBottom: '0.5rem'}} />
                        <p>No services defined in the database.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="admin-content-card p-4">
            <h2>Bank Transfer Details</h2>
            <p className="mb-4">These details will be shown to users when their service is approved.</p>
            <div className="settings-form">
              <div className="form-group">
                <label>Bank Name</label>
                <input type="text" value={paymentSettings.bank_name} onChange={e => setPaymentSettings({...paymentSettings, bank_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input type="text" value={paymentSettings.account_number} onChange={e => setPaymentSettings({...paymentSettings, account_number: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Account Name</label>
                <input type="text" value={paymentSettings.account_name} onChange={e => setPaymentSettings({...paymentSettings, account_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Payment Instructions</label>
                <textarea rows={3} value={paymentSettings.instructions} onChange={e => setPaymentSettings({...paymentSettings, instructions: e.target.value})} />
              </div>
              <Button onClick={saveSettings} leftIcon={<Save size={18} />}>Save Payment Details</Button>
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="admin-content-card">
            <div className="card-header">
              <h2>Career Applications</h2>
              <p className="card-desc">Review submitted job requests and artisan partnerships in real-time.</p>
            </div>
            
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Candidate</th>
                    <th>Role Title</th>
                    <th>Role Type</th>
                    <th>Specialty & Experience</th>
                    <th>Cover Note</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length > 0 ? (
                    applications.map((app: TApplication) => (
                      <tr key={app.id}>
                        <td className="whitespace-nowrap text-sm">
                          {new Date(app.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td>
                          <div className="candidate-cell">
                            <span className="candidate-name">{app.name}</span>
                            <div className="candidate-links">
                              <a href={`mailto:${app.email}`} title="Send Email" className="candidate-link-icon">
                                <Mail size={14} />
                                <span>{app.email}</span>
                              </a>
                              <a href={`tel:${app.phone}`} title="Call Phone" className="candidate-link-icon">
                                <Phone size={14} />
                                <span>{app.phone}</span>
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="font-semibold">{app.role_title}</td>
                        <td>
                          <span className={`status-pill status-${app.role_type}`}>
                            {app.role_type === 'artisan' ? 'Artisan' : 'Corporate'}
                          </span>
                        </td>
                        <td className="experience-cell text-sm max-w-xs" title={app.experience}>
                          {app.experience}
                        </td>
                        <td className="experience-cell text-sm max-w-xs italic" title={app.message || ''}>
                          {app.message || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-table-cell">
                        <Briefcase size={32} style={{opacity: 0.3, marginBottom: '0.5rem'}} />
                        <p>No job applications found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Realtime glassmorphic notifications */}
      <div className="admin-toast-container">
        <AnimatePresence>
          {notifications.map((notif: TToast) => (
            <motion.div
              key={notif.id}
              className="admin-toast"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            >
              <div className="toast-icon">
                <Sparkles size={18} />
              </div>
              <div className="toast-content">
                <h4>{notif.title}</h4>
                <p>{notif.message}</p>
              </div>
              <button 
                className="toast-close"
                onClick={() => setNotifications((prev: TToast[]) => prev.filter((n: TToast) => n.id !== notif.id))}
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Admin;
