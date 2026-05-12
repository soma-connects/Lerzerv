import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Clock, 
  MoreHorizontal,
  Save,
  Plus
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Admin.css';

const Admin: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'settings'>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<any>({
    bank_name: '',
    account_number: '',
    account_name: '',
    instructions: ''
  });

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      const [bookingsRes, servicesRes, settingsRes] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('services').select('*').order('category'),
        supabase.from('settings').select('*').eq('key', 'payment_details').single()
      ]);

      if (bookingsRes.data) setBookings(bookingsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (settingsRes.data) setPaymentSettings(settingsRes.data.value);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      // Done
    }
  };

  const updateBookingStatus = async (id: string, status: string, amount?: string) => {
    const updates: any = { status };
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
                <div className="stat-info"><span className="stat-label">Pending</span><span className="stat-value">{bookings.filter(b => b.status === 'pending').length}</span></div>
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
                      bookings.map((booking) => (
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
                    services.map((service) => (
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
      </div>
    </div>
  );
};

export default Admin;
