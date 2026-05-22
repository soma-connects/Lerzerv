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
  Briefcase,
  Landmark,
  Hash,
  User,
  FileText,
  Check,
  Trash2,
  Edit2,
  Database
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { pricingService } from '../services/pricingService';
import type { 
  TService, 
  TNewService, 
  TPaymentSettings 
} from '../services/pricingService';
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

const Admin: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'settings' | 'applications'>('bookings');
  const [bookings, setBookings] = useState<TBooking[]>([]);
  const [services, setServices] = useState<TService[]>([]);
  const [applications, setApplications] = useState<TApplication[]>([]);
  const [unreadApplicationsCount, setUnreadApplicationsCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<TToast[]>([]);
  
  // Settings tab states
  const [paymentSettings, setPaymentSettings] = useState<TPaymentSettings>({
    bank_name: '',
    account_number: '',
    account_name: '',
    instructions: ''
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Pricing tab states
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [featuresInput, setFeaturesInput] = useState('');
  const [newService, setNewService] = useState<TNewService>({
    title: '',
    category: 'Professional Cleaning',
    price: '',
    description: '',
    features: [],
    recommended: false
  });

  const triggerToast = (title: string, message: string) => {
    const toastId = Date.now().toString();
    setNotifications((prev) => [...prev, { id: toastId, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== toastId));
    }, 5000);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();

      const channel = supabase
        .channel('realtime_admin_job_applications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'job_applications' },
          (payload: { new: TApplication }) => {
            const newApp = payload.new;
            setApplications((prev) => [newApp, ...prev]);
            triggerToast('New Career Application!', `${newApp.name} applied as ${newApp.role_title}`);
            setUnreadApplicationsCount((prev) => prev + 1);
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
        pricingService.fetchServices(),
        pricingService.fetchPaymentSettings(),
        supabase.from('job_applications').select('*').order('created_at', { ascending: false })
      ]);

      if (bookingsRes.data) setBookings(bookingsRes.data as TBooking[]);
      if (servicesRes.success && servicesRes.data) setServices(servicesRes.data);
      if (settingsRes.success && settingsRes.data) setPaymentSettings(settingsRes.data);
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
    setIsSavingSettings(true);
    const res = await pricingService.savePaymentSettings(paymentSettings);
    setIsSavingSettings(false);
    
    if (res.success) {
      triggerToast('Settings Saved', 'Bank transfer details updated successfully.');
    } else {
      triggerToast('Save Failed', res.error?.message || 'Could not save payment details.');
    }
  };

  const startEditingPrice = (id: string, currentPrice: string) => {
    setEditingServiceId(id);
    setEditingPrice(currentPrice);
  };

  const cancelEditingPrice = () => {
    setEditingServiceId(null);
    setEditingPrice('');
  };

  const saveServicePrice = async (id: string) => {
    const res = await pricingService.updateServicePrice(id, editingPrice);
    if (res.success) {
      setEditingServiceId(null);
      triggerToast('Price Updated', 'The service price has been updated in real-time.');
      fetchData();
    } else {
      triggerToast('Update Failed', res.error?.message || 'Could not update price.');
    }
  };

  const handleDeleteService = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the service "${title}"?`)) {
      const res = await pricingService.deleteService(id);
      if (res.success) {
        triggerToast('Service Deleted', `"${title}" has been successfully removed.`);
        fetchData();
      } else {
        triggerToast('Delete Failed', res.error?.message || 'Could not delete service.');
      }
    }
  };

  const handleSeedServices = async () => {
    setIsSeeding(true);
    const res = await pricingService.seedDefaultServices();
    setIsSeeding(false);
    
    if (res.success) {
      triggerToast('Database Seeded', 'Default services have been populated.');
      fetchData();
    } else {
      triggerToast('Seeding Failed', res.error?.message || 'Could not seed default services.');
    }
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const featuresList = featuresInput.split('\n').map(f => f.trim()).filter(Boolean);
    const payload = { ...newService, features: featuresList };

    const res = await pricingService.addService(payload);
    if (res.success) {
      setIsAddModalOpen(false);
      triggerToast('Service Created', `"${newService.title}" is now active.`);
      setNewService({
        title: '',
        category: 'Professional Cleaning',
        price: '',
        description: '',
        features: [],
        recommended: false
      });
      setFeaturesInput('');
      fetchData();
    } else {
      triggerToast('Creation Failed', res.error?.message || 'Could not create new service.');
    }
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
              <div>
                <h2>Service Pricing</h2>
                <p className="card-desc">Control public service tiers and adjust prices real-time.</p>
              </div>
              <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setIsAddModalOpen(true)}>Add Service</Button>
            </div>
            <div className="admin-table-container">
              {services.length > 0 ? (
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
                    {services.map((service: TService) => (
                      <tr key={service.id}>
                        <td className="font-semibold">{service.title}</td>
                        <td>
                          <span className={`status-pill status-${service.category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}>
                            {service.category}
                          </span>
                        </td>
                        <td>
                          {editingServiceId === service.id ? (
                            <div className="inline-price-edit-container" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                className="inline-price-input"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                autoFocus
                              />
                              <button 
                                className="inline-price-btn btn-save" 
                                onClick={() => saveServicePrice(service.id)}
                                title="Save Price"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                className="inline-price-btn btn-cancel" 
                                onClick={cancelEditingPrice}
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="price-tag">{service.price}</span>
                          )}
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button 
                              className="btn-icon-action edit-action"
                              onClick={() => startEditingPrice(service.id, service.price)}
                              title="Edit Price"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              className="btn-icon-action delete-action"
                              onClick={() => handleDeleteService(service.id, service.title)}
                              title="Delete Service"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="seeding-dashboard-card">
                  <div className="seeding-dashboard-card-icon">
                    <Database size={32} />
                  </div>
                  <h3>Pricing Database is Empty</h3>
                  <p>Populate your database with the default Nigerian premium cleaning and utility artisan services in a single click.</p>
                  <button 
                    className="seeding-btn" 
                    onClick={handleSeedServices}
                    disabled={isSeeding}
                  >
                    {isSeeding ? (
                      <>Seeding database...</>
                    ) : (
                      <>
                        <Database size={16} />
                        Seed Default Services
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="admin-content-card p-4">
            <div className="settings-form-container">
              <div className="settings-header-banner">
                <div className="settings-header-banner-icon">
                  <Landmark size={22} />
                </div>
                <div className="settings-header-banner-text">
                  <h3>Bank Transfer Settings</h3>
                  <p>Credentials and payment instructions are rendered automatically in client billing interfaces once orders are approved.</p>
                </div>
              </div>
              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Bank Name</label>
                    <div className="admin-input-wrapper">
                      <input 
                        type="text" 
                        placeholder="Zenith Bank"
                        value={paymentSettings.bank_name} 
                        onChange={e => setPaymentSettings({...paymentSettings, bank_name: e.target.value})} 
                      />
                      <Landmark size={18} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <div className="admin-input-wrapper">
                      <input 
                        type="text" 
                        placeholder="1234567890"
                        value={paymentSettings.account_number} 
                        onChange={e => setPaymentSettings({...paymentSettings, account_number: e.target.value})} 
                      />
                      <Hash size={18} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Account Name</label>
                    <div className="admin-input-wrapper">
                      <input 
                        type="text" 
                        placeholder="Lezerv Limited"
                        value={paymentSettings.account_name} 
                        onChange={e => setPaymentSettings({...paymentSettings, account_name: e.target.value})} 
                      />
                      <User size={18} />
                    </div>
                  </div>
                  <div className="form-group form-group-full">
                    <label>Payment Instructions</label>
                    <div className="admin-input-wrapper">
                      <textarea 
                        rows={4} 
                        placeholder="Please use your Order Number as the transfer description."
                        value={paymentSettings.instructions} 
                        onChange={e => setPaymentSettings({...paymentSettings, instructions: e.target.value})} 
                      />
                      <FileText size={18} />
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={saveSettings} 
                  leftIcon={<Save size={18} />}
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? 'Saving Details...' : 'Save Payment Details'}
                </Button>
              </div>
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

      {/* Sliding Add Service Drawer Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="add-service-overlay" onClick={() => setIsAddModalOpen(false)}>
            <motion.div 
              className="add-service-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="drawer-header">
                <h3>Add New Service</h3>
                <button className="btn-close-drawer" onClick={() => setIsAddModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <form className="drawer-form" onSubmit={handleAddServiceSubmit}>
                <div className="form-group">
                  <label>Service Title</label>
                  <div className="admin-input-wrapper">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Standard Home Clean"
                      value={newService.title}
                      onChange={e => setNewService({...newService, title: e.target.value})}
                    />
                    <Sparkles size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <div className="admin-input-wrapper">
                    <select
                      value={newService.category}
                      onChange={e => setNewService({...newService, category: e.target.value})}
                    >
                      <option value="Professional Cleaning">Professional Cleaning</option>
                      <option value="Power & Water Utilities">Power & Water Utilities</option>
                      <option value="Expert Artisans">Expert Artisans</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Current Price Description</label>
                  <div className="admin-input-wrapper">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. ₦10,000 or Negotiable"
                      value={newService.price}
                      onChange={e => setNewService({...newService, price: e.target.value})}
                    />
                    <Hash size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Service Description</label>
                  <div className="admin-input-wrapper">
                    <textarea 
                      rows={3} 
                      required 
                      placeholder="Enter details on what the service covers..."
                      value={newService.description}
                      onChange={e => setNewService({...newService, description: e.target.value})}
                    />
                    <FileText size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Service Features (one per line)</label>
                  <div className="admin-input-wrapper">
                    <textarea 
                      rows={4} 
                      placeholder="Floor Mopping&#10;Sanitization&#10;Trash Disposal"
                      value={featuresInput}
                      onChange={e => setFeaturesInput(e.target.value)}
                    />
                    <Plus size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox"
                      checked={newService.recommended}
                      onChange={e => setNewService({...newService, recommended: e.target.checked})}
                    />
                    Mark as Recommended Service
                  </label>
                </div>

                <div className="drawer-footer">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Service</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
