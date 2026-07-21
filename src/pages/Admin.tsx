import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Clock, 
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
  Database,
  Eye,
  Award,
  AlertCircle,
  Download,
  Copy
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
import { jobService } from '../services/jobService';
import type { TJob, TNewJob } from '../services/jobService';
import { userService } from '../services/userService';
import type { TUserProfile } from '../services/userService';
import { ambassadorService } from '../services/ambassadorService';
import { artisanService } from '../services/artisanService';
import './Admin.css';

type TBooking = {
  id: string;
  order_number: string;
  service_name: string;
  status: 'pending' | 'approved' | 'declined' | 'on hold/queue' | 'awaiting_confirmation' | 'confirmed' | 'completed' | 'cancelled';
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
  cv_url?: string | null;
  created_at: string;
};

type TToast = {
  id: string;
  title: string;
  message: string;
};

const Admin: React.FC = () => {
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'jobs' | 'users' | 'settings' | 'applications' | 'ambassadors' | 'artisans' | 'dispatch'>('bookings');
  const [bookings, setBookings] = useState<TBooking[]>([]);
  const [services, setServices] = useState<TService[]>([]);
  const [applications, setApplications] = useState<TApplication[]>([]);
  const [jobs, setJobs] = useState<TJob[]>([]);
  const [users, setUsers] = useState<TUserProfile[]>([]);
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [dispatchJobs, setDispatchJobs] = useState<any[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
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
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<TApplication | null>(null);
  const [featuresInput, setFeaturesInput] = useState('');
  const [newService, setNewService] = useState<TNewService>({
    title: '',
    category: 'Professional Cleaning',
    price: '',
    description: '',
    features: [],
    recommended: false
  });

  // Jobs tab states
  const [isSeedingJobs, setIsSeedingJobs] = useState(false);
  const [isAddJobDrawerOpen, setIsAddJobDrawerOpen] = useState(false);
  const [newJob, setNewJob] = useState<TNewJob>({
    title: '',
    department: '',
    location: '',
    type: 'Full-Time',
    role_type: 'artisan',
    description: '',
    responsibilities: '',
    requirements: '',
    benefits: ''
  });

  // Price Review Custom Modal States
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedBookingForPrice, setSelectedBookingForPrice] = useState<TBooking | null>(null);
  const [inputPrice, setInputPrice] = useState('');

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
      const [bookingsRes, servicesRes, settingsRes, applicationsRes, jobsRes, usersRes, ambassadorsRes, referralsRes, artisansRes, dispatchRes] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        pricingService.fetchServices(),
        pricingService.fetchPaymentSettings(),
        supabase.from('job_applications').select('*').order('created_at', { ascending: false }),
        jobService.fetchJobs(),
        userService.fetchUsers(),
        supabase.from('ambassadors').select('*').order('created_at', { ascending: false }),
        supabase.from('referrals').select('*, ambassadors(name, referral_code)').order('created_at', { ascending: false }),
        artisanService.adminFetchArtisans(),
        artisanService.adminFetchJobs()
      ]);

      if (bookingsRes.data) setBookings(bookingsRes.data as TBooking[]);
      if (servicesRes.success && servicesRes.data) setServices(servicesRes.data);
      if (settingsRes.success && settingsRes.data) setPaymentSettings(settingsRes.data);
      if (applicationsRes.data) setApplications(applicationsRes.data as TApplication[]);
      if (jobsRes.success && jobsRes.data) setJobs(jobsRes.data);
      if (usersRes.success && usersRes.data) setUsers(usersRes.data);
      if (ambassadorsRes.data) setAmbassadors(ambassadorsRes.data);
      if (referralsRes.data) setReferrals(referralsRes.data);
      if (artisansRes) setArtisans(artisansRes);
      if (dispatchRes) setDispatchJobs(dispatchRes);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  const viewApplicants = async (jobId: string) => {
    if (expandedJobId === jobId) { setExpandedJobId(null); return; }
    setExpandedJobId(jobId);
    setLoadingApplicants(true);
    const list = await artisanService.adminGetApplicants(jobId);
    setApplicants(list);
    setLoadingApplicants(false);
  };

  const viewKyc = async (path: string) => {
    const url = await artisanService.kycSignedUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
    else triggerToast('Error', 'Could not open document.');
  };

  const assignJob = async (jobId: string, artisanId: string, name: string) => {
    const res = await artisanService.adminAssignJob(jobId, artisanId);
    if (res.success) {
      triggerToast('Job Assigned', `${name} has been assigned. Call them to confirm availability.`);
      setExpandedJobId(null);
      fetchData();
    } else {
      triggerToast('Error', res.error?.message || 'Failed to assign.');
    }
  };

  const updateBookingStatus = async (id: string, status: string, amount?: string) => {
    const updates: { status: string; amount_due?: string; payment_status?: string } = { status };
    if (amount) updates.amount_due = amount;
    if (status === 'approved') {
      updates.payment_status = 'unpaid';
    }
    
    const { error } = await supabase.from('bookings').update(updates).eq('id', id);
    if (!error) {
      triggerToast('Booking Status Updated', `Booking has been set to "${status}" successfully.`);
      if (status === 'completed') {
        try {
          await ambassadorService.completeReferral(id);
        } catch (refErr) {
          console.error('Failed to complete referral points:', refErr);
        }
      }
      fetchData();
    } else {
      triggerToast('Update Failed', error.message);
    }
  };

  const findServiceBasePrice = (serviceName: string) => {
    let service = services.find(s => s.title.toLowerCase().trim() === serviceName.toLowerCase().trim());
    if (service) return service.price;
    
    service = services.find(s => 
      serviceName.toLowerCase().includes(s.title.toLowerCase()) || 
      s.title.toLowerCase().includes(serviceName.toLowerCase())
    );
    if (service) return service.price;
    return '₦12,500';
  };

  const openApproveModal = (booking: TBooking) => {
    setSelectedBookingForPrice(booking);
    if (booking.amount_due && booking.amount_due !== 'Pending Quote') {
      setInputPrice(booking.amount_due.replace(/₦/g, '').replace(/,/g, ''));
    } else {
      const basePrice = findServiceBasePrice(booking.service_name);
      const match = basePrice.match(/\d+([\d,]*)/);
      if (match) {
        setInputPrice(match[0].replace(/,/g, ''));
      } else {
        setInputPrice('');
      }
    }
    setIsPriceModalOpen(true);
  };

  const handleApproveWithPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForPrice) return;
    
    let formattedPrice = inputPrice.trim();
    if (formattedPrice) {
      // Add thousands separator if not already present
      const cleanVal = formattedPrice.replace(/[^0-9.]/g, '');
      const parts = cleanVal.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formattedPrice = `₦${parts.join('.')}`;
    }
    
    updateBookingStatus(selectedBookingForPrice.id, 'approved', formattedPrice || undefined);
    setIsPriceModalOpen(false);
    setSelectedBookingForPrice(null);
    setInputPrice('');
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

  const handleDeleteJob = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the job position "${title}"?`)) {
      const res = await jobService.deleteJob(id);
      if (res.success) {
        triggerToast('Job Deleted', `"${title}" has been successfully removed.`);
        fetchData();
      } else {
        triggerToast('Delete Failed', res.error?.message || 'Could not delete job.');
      }
    }
  };

  const handleSeedJobs = async () => {
    setIsSeedingJobs(true);
    const res = await jobService.seedDefaultJobs();
    setIsSeedingJobs(false);
    
    if (res.success) {
      triggerToast('Jobs Seeded', 'Default job positions have been populated.');
      fetchData();
    } else {
      triggerToast('Seeding Failed', res.error?.message || 'Could not seed default jobs.');
    }
  };

  const handleAddJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await jobService.addJob(newJob);
    if (res.success) {
      setIsAddJobDrawerOpen(false);
      triggerToast('Job Created', `"${newJob.title}" is now active.`);
      setNewJob({
        title: '',
        department: '',
        location: '',
        type: 'Full-Time',
        role_type: 'artisan',
        description: '',
        responsibilities: '',
        requirements: '',
        benefits: ''
      });
      fetchData();
    } else {
      triggerToast('Creation Failed', res.error?.message || 'Could not create new job.');
    }
  };

  const handleUpdateUserRole = async (id: string, currentRole: 'user' | 'admin') => {
    const newRole = currentRole === 'user' ? 'admin' : 'user';
    const confirmMsg = `Are you sure you want to ${newRole === 'admin' ? 'PROMOTE' : 'DEMOTE'} this user to ${newRole}?`;
    if (window.confirm(confirmMsg)) {
      const res = await userService.updateUserRole(id, newRole);
      if (res.success) {
        triggerToast('User Role Updated', `User role successfully changed to ${newRole}.`);
        fetchData();
      } else {
        triggerToast('Update Failed', res.error?.message || 'Could not update user role.');
      }
    }
  };

  const handleDeleteUserProfile = async (id: string, email: string) => {
    if (window.confirm(`Are you sure you want to remove the profile for user "${email}"?`)) {
      const res = await userService.deleteUser(id);
      if (res.success) {
        triggerToast('User Removed', `User profile "${email}" has been deleted.`);
        fetchData();
      } else {
        triggerToast('Removal Failed', res.error?.message || 'Could not remove user.');
      }
    }
  };

  const handleExportUsersCSV = () => {
    if (users.length === 0) {
      triggerToast('No Users', 'There are no users to export.');
      return;
    }
    const headers = ['ID', 'Email', 'Full Name', 'Role', 'Created At'];
    const csvRows = [
      headers.join(','),
      ...users.map(u => [
        u.id,
        `"${u.email.replace(/"/g, '""')}"`,
        `"${(u.full_name || '').replace(/"/g, '""')}"`,
        u.role,
        u.created_at || ''
      ].join(','))
    ];
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "lezerv_registered_users.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Export Successful', 'Registered users exported as CSV.');
  };

  const handleCopyUserEmails = () => {
    if (users.length === 0) {
      triggerToast('No Users', 'There are no user emails to copy.');
      return;
    }
    const emailList = users.map(u => u.email).filter(Boolean).join(', ');
    navigator.clipboard.writeText(emailList);
    triggerToast('Copied to Clipboard', 'All user email addresses copied to clipboard.');
  };

  const handleExportArtisansCSV = () => {
    if (artisans.length === 0) {
      triggerToast('No Artisans', 'There are no artisans to export.');
      return;
    }
    const headers = ['ID', 'User ID', 'Display Name', 'Email', 'Phone', 'City', 'Experience', 'Verified', 'Status', 'Joined At'];
    const csvRows = [
      headers.join(','),
      ...artisans.map(a => {
        const priv = a.artisan_private || {};
        const matchingUser = users.find(u => u.id === a.user_id);
        const email = matchingUser ? matchingUser.email : '';
        return [
          a.id,
          a.user_id,
          `"${a.display_name.replace(/"/g, '""')}"`,
          `"${email.replace(/"/g, '""')}"`,
          `"${(priv.phone || '').replace(/"/g, '""')}"`,
          `"${a.city.replace(/"/g, '""')}"`,
          `${a.years_experience || 0}y`,
          a.is_verified ? 'Yes' : 'No',
          a.status,
          a.created_at || ''
        ].join(',');
      })
    ];
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "lezerv_artisans.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Export Successful', 'Artisans exported as CSV.');
  };

  const handleCopyArtisanEmails = () => {
    if (artisans.length === 0) {
      triggerToast('No Artisans', 'There are no artisan emails to copy.');
      return;
    }
    const emails = artisans.map(a => {
      const matchingUser = users.find(u => u.id === a.user_id);
      return matchingUser ? matchingUser.email : null;
    }).filter(Boolean);

    if (emails.length === 0) {
      triggerToast('No Emails Found', 'No email addresses found for the artisans.');
      return;
    }

    navigator.clipboard.writeText(emails.join(', '));
    triggerToast('Copied to Clipboard', `All (${emails.length}) artisan email addresses copied.`);
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
            <button className={activeTab === 'jobs' ? 'active' : ''} onClick={() => setActiveTab('jobs')}>Jobs</button>
            <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Users</button>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Payment Details</button>
            <button className={activeTab === 'applications' ? 'active' : ''} onClick={() => setActiveTab('applications')}>
              Applications
              {unreadApplicationsCount > 0 && (
                <span className="admin-badge-count">{unreadApplicationsCount}</span>
              )}
            </button>
            <button className={activeTab === 'ambassadors' ? 'active' : ''} onClick={() => setActiveTab('ambassadors')}>Ambassadors</button>
            <button className={activeTab === 'artisans' ? 'active' : ''} onClick={() => setActiveTab('artisans')}>
              Artisans
              {artisans.filter((a) => a.status === 'pending').length > 0 && (
                <span className="tab-badge">{artisans.filter((a) => a.status === 'pending').length}</span>
              )}
            </button>
            <button className={activeTab === 'dispatch' ? 'active' : ''} onClick={() => setActiveTab('dispatch')}>
              Applications
              {dispatchJobs.filter((j) => j.status === 'open').length > 0 && (
                <span className="tab-badge">{dispatchJobs.filter((j) => j.status === 'open').length}</span>
              )}
            </button>
          </nav>
        </header>

        {/* Action Required Banner */}
        {bookings.filter(b => b.status === 'pending' || b.status === 'awaiting_confirmation').length > 0 && (
          <div className="admin-alert-banner" style={{
            background: 'var(--color-tertiary-container)',
            border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-tertiary-container)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: 'var(--spacing-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <AlertCircle size={20} color="var(--color-tertiary)" />
            <span>
              <strong>Action Required:</strong> You have{' '}
              <strong>{bookings.filter(b => b.status === 'pending').length}</strong> pending booking request(s) and{' '}
              <strong>{bookings.filter(b => b.status === 'awaiting_confirmation').length}</strong> payment confirmation(s) awaiting your review.
            </span>
          </div>
        )}

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
                      <th>Amount</th>
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
                          <td>
                            <strong className="amount-cell">{booking.amount_due || 'Pending Quote'}</strong>
                          </td>
                          <td>
                            <span className={`status-pill status-${booking.status.replace(/ /g, '-').replace(/\//g, '-')}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="table-actions">
                            {(booking.status === 'pending' || booking.status === 'on hold/queue') && (
                              <>
                                <Button size="sm" variant="primary" onClick={() => openApproveModal(booking)}>
                                  Approve
                                </Button>
                                
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="btn-decline"
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to decline booking ${booking.order_number}?`)) {
                                      updateBookingStatus(booking.id, 'declined');
                                    }
                                  }}
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                            
                            {booking.status === 'pending' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="btn-hold"
                                onClick={() => updateBookingStatus(booking.id, 'on hold/queue')}
                              >
                                Hold / Queue
                              </Button>
                            )}

                            {booking.status === 'awaiting_confirmation' && (
                              <Button size="sm" variant="primary" onClick={async () => {
                                const { error } = await supabase
                                  .from('bookings')
                                  .update({ status: 'confirmed', payment_status: 'paid' })
                                  .eq('id', booking.id);
                                if (!error) {
                                  try {
                                    await ambassadorService.completeReferral(booking.id);
                                  } catch (refErr) {
                                    console.error('Failed to complete referral points:', refErr);
                                  }
                                  triggerToast('Payment Confirmed', `Order ${booking.order_number} is now marked as confirmed.`);
                                  fetchData();
                                }
                              }}>Confirm Payment</Button>
                            )}

                            {booking.payment_status !== 'paid' && booking.status !== 'declined' && booking.status !== 'cancelled' && booking.status !== 'awaiting_confirmation' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}
                                onClick={async () => {
                                  if (window.confirm(`Mark order ${booking.order_number} payment as PAID?`)) {
                                    const { error } = await supabase
                                      .from('bookings')
                                      .update({ payment_status: 'paid' })
                                      .eq('id', booking.id);
                                    if (!error) {
                                      try {
                                        await ambassadorService.completeReferral(booking.id);
                                      } catch (refErr) {
                                        console.error('Failed to complete referral points:', refErr);
                                      }
                                      triggerToast('Payment Confirmed', `Order ${booking.order_number} marked as PAID.`);
                                      fetchData();
                                    } else {
                                      triggerToast('Error', error.message);
                                    }
                                  }
                                }}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
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

        {activeTab === 'jobs' && (
          <div className="admin-content-card">
            <div className="card-header">
              <div>
                <h2>Open Vacancies</h2>
                <p className="card-desc">Add new corporate roles or artisan partner contracts dynamically.</p>
              </div>
              <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setIsAddJobDrawerOpen(true)}>Add Job Position</Button>
            </div>
            <div className="admin-table-container">
              {jobs.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Department / Category</th>
                      <th>Location</th>
                      <th>Role Type</th>
                      <th>Tag / Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job: TJob) => (
                      <tr key={job.id}>
                        <td className="font-semibold">{job.title}</td>
                        <td>
                          <span className={`status-pill status-${job.department.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}>
                            {job.department}
                          </span>
                        </td>
                        <td>{job.location}</td>
                        <td>
                          <span className={`status-pill status-${job.role_type}`}>
                            {job.role_type === 'artisan' ? 'Artisan' : 'Corporate'}
                          </span>
                        </td>
                        <td>
                          <span className="price-tag">{job.type}</span>
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button 
                              className="btn-icon-action delete-action"
                              onClick={() => handleDeleteJob(job.id, job.title)}
                              title="Delete Job"
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
                  <h3>Jobs Database is Empty</h3>
                  <p>Populate your database with the default corporate positions and artisan cleaning categories in a single click.</p>
                  <button 
                    className="seeding-btn" 
                    onClick={handleSeedJobs}
                    disabled={isSeedingJobs}
                  >
                    {isSeedingJobs ? (
                      <>Seeding vacancies...</>
                    ) : (
                      <>
                        <Database size={16} />
                        Seed Default Jobs
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-content-card">
            <div className="card-header">
              <div>
                <h2>Registered Users</h2>
                <p className="card-desc">Monitor accounts, manage roles, and toggle administrator credentials.</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleExportUsersCSV}
                  leftIcon={<Download size={14} />}
                >
                  Export CSV
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleCopyUserEmails}
                  leftIcon={<Copy size={14} />}
                >
                  Copy Emails
                </Button>
              </div>
            </div>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Joined Date</th>
                    <th>Email Address</th>
                    <th>Full Name</th>
                    <th>Current Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(users.length > 0 ? users : (user ? [{
                    id: user.id,
                    email: user.email || '',
                    full_name: user.user_metadata.full_name || 'System Admin',
                    role: 'admin' as const,
                    created_at: user.created_at
                  }] : [])).map((u) => (
                    <tr key={u.id}>
                      <td className="whitespace-nowrap text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '—'}
                      </td>
                      <td className="font-semibold">{u.email}</td>
                      <td>{u.full_name || 'User'}</td>
                      <td>
                        <span className={`status-pill status-${u.role}`}>
                          {u.role === 'admin' ? 'Administrator' : 'User'}
                        </span>
                      </td>
                      <td>
                        <div className="table-row-actions">
                          {/* Cannot demote yourself */}
                          {user && user.id !== u.id && (
                            <>
                              <Button 
                                size="sm" 
                                variant={u.role === 'admin' ? 'secondary' : 'primary'}
                                onClick={() => handleUpdateUserRole(u.id, u.role)}
                              >
                                {u.role === 'admin' ? 'Demote to User' : 'Make Admin'}
                              </Button>
                              <button 
                                className="btn-icon-action delete-action"
                                onClick={() => handleDeleteUserProfile(u.id, u.email)}
                                title="Delete User Profile"
                                style={{ marginLeft: 'var(--spacing-sm)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {user && user.id === u.id && (
                            <span className="text-sm text-slate-400 italic">Logged In (Self)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <th>CV / Portfolio</th>
                    <th>Cover Note</th>
                    <th>Actions</th>
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
                        <td>
                          {app.cv_url ? (
                            <a 
                              href={app.cv_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="cv-link-btn"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--color-primary)',
                                textDecoration: 'underline',
                                fontWeight: 'bold',
                                fontSize: '0.8rem'
                              }}
                            >
                              <FileText size={14} /> View CV
                            </a>
                          ) : (
                            <span style={{ color: 'var(--color-outline)' }}>—</span>
                          )}
                        </td>
                        <td className="experience-cell text-sm max-w-xs italic" title={app.message || ''}>
                          {app.message || '—'}
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button 
                              className="btn-icon-action"
                              onClick={() => {
                                setSelectedApplication(app);
                                setIsApplicationModalOpen(true);
                              }}
                              title="View Full Application Details"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="empty-table-cell">
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

        {activeTab === 'ambassadors' && (
          <>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><User size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Total Ambassadors</span>
                  <span className="stat-value">{ambassadors.length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--color-tertiary)' }}><Clock size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Referrals Tracked</span>
                  <span className="stat-value">{referrals.length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--color-secondary)' }}><Award size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Total Points Active</span>
                  <span className="stat-value">
                    {ambassadors.reduce((acc, curr) => acc + (curr.total_points || 0), 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-content-card">
              <div className="card-header">
                <h2>Ambassadors List</h2>
                <p className="card-desc">Monitor ambassador points, suspension status, and their active grades.</p>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Applied Date</th>
                      <th>Ambassador Info</th>
                      <th>Referral Code</th>
                      <th>Points</th>
                      <th>Referrals</th>
                      <th>Grade Level</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambassadors.length > 0 ? (
                      ambassadors.map((amb) => (
                        <tr key={amb.id}>
                          <td className="whitespace-nowrap text-sm">
                            {new Date(amb.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </td>
                          <td>
                            <div className="candidate-cell">
                              <span className="candidate-name">{amb.name}</span>
                              <div className="candidate-links">
                                <a href={`mailto:${amb.email}`} title="Send Email" className="candidate-link-icon">
                                  <Mail size={14} />
                                  <span>{amb.email}</span>
                                </a>
                                <a href={`tel:${amb.phone}`} title="Call Phone" className="candidate-link-icon">
                                  <Phone size={14} />
                                  <span>{amb.phone}</span>
                                </a>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="order-badge" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>
                              {amb.referral_code}
                            </span>
                          </td>
                          <td>
                            <strong>{amb.total_points || 0}</strong>
                          </td>
                          <td>{amb.total_referrals || 0}</td>
                          <td>
                            <span className={`status-pill status-${(amb.total_points < 50 ? 'bronze' : amb.total_points < 100 ? 'silver' : amb.total_points < 200 ? 'gold' : 'platinum')}`}>
                              {amb.total_points < 50 ? 'Bronze' : amb.total_points < 100 ? 'Silver' : amb.total_points < 200 ? 'Gold' : 'Platinum'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill status-${amb.status}`}>
                              {amb.status}
                            </span>
                          </td>
                          <td className="table-actions">
                            {/* No pending state actions since join is instant */}

                            {amb.status === 'approved' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={async () => {
                                    const res = await ambassadorService.updateAmbassadorStatus(amb.id, 'suspended');
                                    if (res.success) {
                                      triggerToast('Ambassador Suspended', `${amb.name} is now suspended.`);
                                      fetchData();
                                    } else {
                                      triggerToast('Error', res.error?.message || 'Failed to suspend.');
                                    }
                                  }}
                                >
                                  Suspend
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={async () => {
                                    const valueStr = window.prompt(`Adjust points for ${amb.name} (e.g. 100 to add, -50 to subtract):`, '100');
                                    if (valueStr === null) return;
                                    const pts = parseInt(valueStr, 10);
                                    if (isNaN(pts)) {
                                      alert('Invalid points input.');
                                      return;
                                    }
                                    const res = await ambassadorService.adjustPoints(amb.id, pts);
                                    if (res.success) {
                                      triggerToast('Points Adjusted', `Ambassador's points adjusted by ${pts}.`);
                                      fetchData();
                                    } else {
                                      triggerToast('Error', res.error?.message || 'Failed to adjust points.');
                                    }
                                  }}
                                >
                                  Adjust Pts
                                </Button>
                              </>
                            )}

                            {amb.status === 'suspended' && (
                              <Button 
                                size="sm" 
                                variant="primary"
                                onClick={async () => {
                                  const res = await ambassadorService.updateAmbassadorStatus(amb.id, 'approved');
                                  if (res.success) {
                                    triggerToast('Ambassador Reactivated', `${amb.name} is active again.`);
                                    fetchData();
                                  } else {
                                    triggerToast('Error', res.error?.message || 'Failed to reactivate.');
                                  }
                                }}
                              >
                                Reactivate
                              </Button>
                            )}

                            {amb.status === 'rejected' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={async () => {
                                  const res = await ambassadorService.updateAmbassadorStatus(amb.id, 'approved');
                                  if (res.success) {
                                    triggerToast('Application Approved', `${amb.name} is now an active ambassador.`);
                                    fetchData();
                                  } else {
                                    triggerToast('Error', res.error?.message || 'Failed to approve application.');
                                  }
                                }}
                              >
                                Approve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">
                          <Award size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                          <p>No ambassadors found.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Second Card: Referral Tracking Logs */}
            <div className="admin-content-card" style={{ marginTop: 'var(--spacing-xl)' }}>
              <div className="card-header">
                <h2>Referral Activity Logs</h2>
                <p className="card-desc">Track real-time visitor clicks, user signups, and booking conversions driven by ambassadors.</p>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Activity Date</th>
                      <th>Ambassador</th>
                      <th>Referral Code</th>
                      <th>Customer Email / ID</th>
                      <th>Current Status</th>
                      <th>Points Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.length > 0 ? (
                      referrals.map((ref) => (
                        <tr key={ref.id}>
                          <td className="whitespace-nowrap text-sm">
                            {new Date(ref.created_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td>
                            <strong>{ref.ambassadors?.name || 'Unknown'}</strong>
                          </td>
                          <td>
                            <span className="order-badge" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>
                              {ref.referral_code}
                            </span>
                          </td>
                          <td className="text-sm">
                            {ref.referred_email || ref.referred_user_id || <span style={{ color: 'var(--color-outline)' }}>Visitor (Anonymous)</span>}
                          </td>
                          <td>
                            <span className={`status-pill status-${ref.status === 'signed_up' ? 'artisan' : ref.status === 'booked' ? 'pending' : ref.status === 'completed' ? 'confirmed' : 'on-hold-queue'}`}>
                              {ref.status}
                            </span>
                          </td>
                          <td>
                            <strong>{ref.points_awarded || 0} pt</strong>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
                          <Award size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                          <p>No referral clicks or conversions tracked yet.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'artisans' && (
          <>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><Briefcase size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Total Artisans</span>
                  <span className="stat-value">{artisans.length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--color-tertiary)' }}><Clock size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Pending Review</span>
                  <span className="stat-value">{artisans.filter((a) => a.status === 'pending').length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--color-secondary)' }}><Check size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Approved &amp; Live</span>
                  <span className="stat-value">{artisans.filter((a) => a.status === 'approved').length}</span>
                </div>
              </div>
            </div>

            <div className="admin-content-card">
              <div className="card-header">
                <div>
                  <h2>Artisan Verification Queue</h2>
                  <p className="card-desc">Review new artisan applications, verify identity (NIN), and approve them to go live in search.</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={handleExportArtisansCSV}
                    leftIcon={<Download size={14} />}
                  >
                    Export CSV
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={handleCopyArtisanEmails}
                    leftIcon={<Copy size={14} />}
                  >
                    Copy Emails
                  </Button>
                </div>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Applied</th>
                      <th>Artisan</th>
                      <th>Services</th>
                      <th>Location</th>
                      <th>Exp.</th>
                      <th>Verified</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artisans.length > 0 ? (
                      artisans.map((a) => {
                        const priv = a.artisan_private || {};
                        const cats = (a.artisan_categories || [])
                          .map((c: any) => c.service_categories?.name)
                          .filter(Boolean);
                        return (
                          <tr key={a.id}>
                            <td className="whitespace-nowrap text-sm">
                              {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td>
                              <div className="candidate-cell">
                                <span className="candidate-name">{a.display_name}</span>
                                <div className="candidate-links">
                                  {priv.phone && (
                                    <a href={`tel:${priv.phone}`} title="Call" className="candidate-link-icon">
                                      <Phone size={14} /><span>{priv.phone}</span>
                                    </a>
                                  )}
                                  {(() => {
                                    const matchingUser = users.find(u => u.id === a.user_id);
                                    if (matchingUser && matchingUser.email) {
                                      return (
                                        <a href={`mailto:${matchingUser.email}`} title="Email" className="candidate-link-icon">
                                          <Mail size={14} /><span>{matchingUser.email}</span>
                                        </a>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {priv.id_number && (
                                    <span className="candidate-link-icon" title="ID number">
                                      <Hash size={14} /><span>{priv.id_number}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="kyc-links">
                                  {priv.id_doc_path
                                    ? <button type="button" className="kyc-link" onClick={() => viewKyc(priv.id_doc_path)}>ID{priv.id_type ? ` · ${priv.id_type.replace('_', ' ')}` : ''}</button>
                                    : <span className="kyc-missing">No ID</span>}
                                  {priv.bill_doc_path
                                    ? <button type="button" className="kyc-link" onClick={() => viewKyc(priv.bill_doc_path)}>Bill</button>
                                    : <span className="kyc-missing">No bill</span>}
                                  {priv.passport_path
                                    ? <button type="button" className="kyc-link" onClick={() => viewKyc(priv.passport_path)}>Photo</button>
                                    : <span className="kyc-missing">No photo</span>}
                                </div>
                              </div>
                            </td>
                            <td className="text-sm">{cats.length ? cats.join(', ') : <span style={{ color: 'var(--color-outline)' }}>—</span>}</td>
                            <td className="text-sm">
                              {a.city}
                              {a.lat != null
                                ? <span title="GPS set" style={{ color: 'var(--color-secondary)', marginLeft: 4 }}>📍</span>
                                : <span title="No GPS" style={{ color: 'var(--color-error)', marginLeft: 4 }}>⚠</span>}
                            </td>
                            <td>{a.years_experience || 0}y</td>
                            <td>
                              <button
                                type="button"
                                className={`verify-toggle ${a.is_verified ? 'on' : ''}`}
                                title={a.is_verified ? 'Verified — click to un-verify' : 'Not verified — click to verify'}
                                onClick={async () => {
                                  const res = await artisanService.adminSetVerified(a.id, !a.is_verified);
                                  if (res.success) { triggerToast('Updated', `${a.display_name} ${!a.is_verified ? 'verified' : 'un-verified'}.`); fetchData(); }
                                  else triggerToast('Error', res.error?.message || 'Failed.');
                                }}
                              >
                                {a.is_verified ? <><Check size={12} /> Verified</> : 'Verify'}
                              </button>
                            </td>
                            <td><span className={`status-pill status-${a.status}`}>{a.status}</span></td>
                            <td className="table-actions">
                              {a.status !== 'approved' && (
                                <Button size="sm" variant="primary"
                                  onClick={async () => {
                                    const res = await artisanService.adminSetStatus(a.id, 'approved');
                                    if (res.success) { triggerToast('Artisan Approved', `${a.display_name} is now live.`); fetchData(); }
                                    else triggerToast('Error', res.error?.message || 'Failed.');
                                  }}>Approve</Button>
                              )}
                              {a.status === 'pending' && (
                                <Button size="sm" variant="outline"
                                  onClick={async () => {
                                    const res = await artisanService.adminSetStatus(a.id, 'rejected');
                                    if (res.success) { triggerToast('Rejected', `${a.display_name} was rejected.`); fetchData(); }
                                  }}>Reject</Button>
                              )}
                              {a.status === 'approved' && (
                                <Button size="sm" variant="outline"
                                  onClick={async () => {
                                    const res = await artisanService.adminSetStatus(a.id, 'suspended');
                                    if (res.success) { triggerToast('Suspended', `${a.display_name} is suspended.`); fetchData(); }
                                  }}>Suspend</Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">
                          <Briefcase size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                          <p>No artisan applications yet.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'dispatch' && (
          <>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--color-tertiary)' }}><Clock size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Open (need assigning)</span>
                  <span className="stat-value">{dispatchJobs.filter((j) => j.status === 'open').length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Briefcase size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Active Jobs</span>
                  <span className="stat-value">{dispatchJobs.filter((j) => ['assigned', 'in_progress'].includes(j.status)).length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--color-secondary)' }}><Check size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">Completed</span>
                  <span className="stat-value">{dispatchJobs.filter((j) => j.status === 'completed').length}</span>
                </div>
              </div>
            </div>

            <div className="admin-content-card">
              <div className="card-header">
                <h2>Service Requests</h2>
                <p className="card-desc">Assign posted jobs to interested artisans. After assigning, call the artisan to confirm availability.</p>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Posted</th>
                      <th>Job</th>
                      <th>Service</th>
                      <th>Area</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchJobs.length > 0 ? (
                      dispatchJobs.map((j) => (
                        <React.Fragment key={j.id}>
                          <tr>
                            <td className="whitespace-nowrap text-sm">{new Date(j.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                            <td><div className="candidate-cell"><span className="candidate-name">{j.title}</span>{j.description && <span className="text-sm" style={{ color: 'var(--color-outline)' }}>{j.description.slice(0, 60)}</span>}</div></td>
                            <td className="text-sm">{j.category_name || '—'}</td>
                            <td className="text-sm">{j.area_name || '—'}</td>
                            <td><span className={`status-pill status-${j.status === 'open' ? 'pending' : j.status === 'completed' ? 'confirmed' : j.status === 'cancelled' ? 'suspended' : 'artisan'}`}>{j.status}</span></td>
                            <td className="text-sm">{j.assigned_name || <span style={{ color: 'var(--color-outline)' }}>—</span>}</td>
                            <td className="table-actions">
                              {j.status === 'open' && (
                                <Button size="sm" variant="primary" onClick={() => viewApplicants(j.id)}>
                                  {expandedJobId === j.id ? 'Hide' : 'View applicants'}
                                </Button>
                              )}
                            </td>
                          </tr>
                          {expandedJobId === j.id && (
                            <tr>
                              <td colSpan={7} style={{ background: 'var(--color-surface-container-low)', padding: 'var(--spacing-md)' }}>
                                {loadingApplicants ? (
                                  <div style={{ textAlign: 'center', padding: '1rem' }}>Loading applicants…</div>
                                ) : applicants.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-on-surface-variant)' }}>No artisans have expressed interest yet.</div>
                                ) : (
                                  <div className="applicant-list">
                                    {applicants.map((ap) => (
                                      <div key={ap.artisan_id} className="applicant-row">
                                        <div>
                                          <strong>{ap.display_name}</strong>{ap.is_verified && <Check size={13} style={{ color: 'var(--color-secondary)', verticalAlign: 'middle', marginLeft: 4 }} />}
                                          <div className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                                            ⭐ {Number(ap.avg_rating).toFixed(1)} ({ap.total_reviews}) · {ap.completed_jobs} jobs · {ap.phone || 'no phone'}
                                          </div>
                                          {ap.note && <div className="text-sm" style={{ fontStyle: 'italic' }}>"{ap.note}"</div>}
                                        </div>
                                        <Button size="sm" variant="primary" onClick={() => assignJob(j.id, ap.artisan_id, ap.display_name)}>Assign</Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr><td colSpan={7} className="empty-table-cell"><Briefcase size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} /><p>No jobs posted yet.</p></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
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

      {/* Sliding Add Job Drawer Modal */}
      <AnimatePresence>
        {isAddJobDrawerOpen && (
          <div className="add-service-overlay" onClick={() => setIsAddJobDrawerOpen(false)}>
            <motion.div 
              className="add-service-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="drawer-header">
                <h3>Add Job Vacancy</h3>
                <button className="btn-close-drawer" onClick={() => setIsAddJobDrawerOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <form className="drawer-form" onSubmit={handleAddJobSubmit}>
                <div className="form-group">
                  <label>Job Title</label>
                  <div className="admin-input-wrapper">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Certified Electrician or Accountant"
                      value={newJob.title}
                      onChange={e => setNewJob({...newJob, title: e.target.value})}
                    />
                    <Briefcase size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Role Type (artisan or corporate)</label>
                  <div className="admin-input-wrapper">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. artisan or corporate"
                      value={newJob.role_type}
                      onChange={e => {
                        const val = e.target.value.toLowerCase().trim() as 'artisan' | 'corporate';
                        setNewJob({
                          ...newJob, 
                          role_type: val,
                          type: val === 'artisan' ? 'Apply for this role' : 'Full-Time'
                        });
                      }}
                    />
                    <Sparkles size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Department / Category</label>
                  <div className="admin-input-wrapper">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Engineering, Logistics, Plumbing Services"
                      value={newJob.department}
                      onChange={e => setNewJob({...newJob, department: e.target.value})}
                    />
                    <Sparkles size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Job Location</label>
                  <div className="admin-input-wrapper">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Remote, Abuja, or Lagos (Ikeja, Yaba)"
                      value={newJob.location}
                      onChange={e => setNewJob({...newJob, location: e.target.value})}
                    />
                    <FileText size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Employment Type / Tag</label>
                  <div className="admin-input-wrapper">
                    <select
                      value={newJob.type}
                      onChange={e => setNewJob({...newJob, type: e.target.value})}
                      className="admin-select"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: 'white', border: '1px solid var(--color-outline-variant)' }}
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Commission-Based">Commission-Based</option>
                      <option value="Part-Time">Part-Time</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Job Description / Summary</label>
                  <div className="admin-input-wrapper">
                    <textarea 
                      rows={3} 
                      required 
                      placeholder="About the company and core summary of the vacancy..."
                      value={newJob.description || ''}
                      onChange={e => setNewJob({...newJob, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Key Responsibilities (one per line)</label>
                  <div className="admin-input-wrapper">
                    <textarea 
                      rows={4} 
                      placeholder="e.g. Identify and acquire new customers&#10;Promote Lezerv services&#10;Track leads and report conversions"
                      value={newJob.responsibilities || ''}
                      onChange={e => setNewJob({...newJob, responsibilities: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Job Requirements (one per line)</label>
                  <div className="admin-input-wrapper">
                    <textarea 
                      rows={4} 
                      placeholder="e.g. Good communication skills&#10;Active use of WhatsApp&#10;Ability to work independently"
                      value={newJob.requirements || ''}
                      onChange={e => setNewJob({...newJob, requirements: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Benefits & Commission (one per line)</label>
                  <div className="admin-input-wrapper">
                    <textarea 
                      rows={4} 
                      placeholder="e.g. Flexible schedule&#10;15% commission on every booking&#10;Performance bonuses"
                      value={newJob.benefits || ''}
                      onChange={e => setNewJob({...newJob, benefits: e.target.value})}
                    />
                  </div>
                </div>

                <div className="drawer-footer">
                  <Button type="button" variant="outline" onClick={() => setIsAddJobDrawerOpen(false)}>Cancel</Button>
                  <Button type="submit">Publish Position</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Price Review & Approval Modal */}
      <AnimatePresence>
        {isPriceModalOpen && selectedBookingForPrice && (
          <div className="modal-overlay" onClick={() => setIsPriceModalOpen(false)}>
            <motion.div 
              className="custom-price-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Price Review & Approve</h2>
                <button className="btn-close-modal" onClick={() => setIsPriceModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleApproveWithPriceSubmit} className="modal-form">
                <div className="modal-info-box">
                  <div className="info-item">
                    <span className="info-label">Order</span>
                    <strong>{selectedBookingForPrice.order_number}</strong>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Service</span>
                    <strong title={selectedBookingForPrice.service_name}>{selectedBookingForPrice.service_name}</strong>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Customer</span>
                    <strong title={selectedBookingForPrice.customer.name}>{selectedBookingForPrice.customer.name}</strong>
                  </div>
                </div>

                <div className="price-review-alert-card">
                  <div className="price-review-header">
                    <Sparkles size={16} className="text-secondary" />
                    <span>Pricing Standard Comparison</span>
                  </div>
                  <div className="price-review-body">
                    <div className="price-row-item">
                      <span className="price-row-label">Base / Service Area Price</span>
                      <strong className="price-row-value text-secondary">
                        {findServiceBasePrice(selectedBookingForPrice.service_name)}
                      </strong>
                    </div>
                    <div className="price-row-item">
                      <span className="price-row-label">Current Invoice Quote</span>
                      <strong className="price-row-value">
                        {selectedBookingForPrice.amount_due || 'Pending Quote'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quote-price">Set Final Quote / Price <span className="required">*</span></label>
                  <div className="price-input-wrapper">
                    <span className="currency-prefix">₦</span>
                    <input 
                      type="text" 
                      id="quote-price"
                      required
                      placeholder="e.g. 12,500"
                      value={inputPrice}
                      onChange={e => setInputPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                      autoFocus
                    />
                  </div>
                  <p className="field-hint">Verify details, adjust base price if additional labor/materials are required, or let it be to charge standard price.</p>
                </div>

                <div className="modal-footer">
                  <Button type="button" variant="outline" className="btn-modal-cancel" onClick={() => setIsPriceModalOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" className="btn-modal-approve">Approve & Price</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Application Details Modal */}
      <AnimatePresence>
        {isApplicationModalOpen && selectedApplication && (
          <div className="modal-overlay" onClick={() => setIsApplicationModalOpen(false)}>
            <motion.div 
              className="custom-price-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '600px', width: '90%' }}
            >
              <div className="modal-header">
                <h2>Application Details</h2>
                <button className="btn-close-modal" onClick={() => setIsApplicationModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{selectedApplication.name}</h3>
                      <p style={{ color: 'var(--color-outline)', fontSize: '0.9rem' }}>{selectedApplication.role_title} <span className={`status-pill status-${selectedApplication.role_type}`} style={{ marginLeft: '0.5rem' }}>{selectedApplication.role_type}</span></p>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>
                      {new Date(selectedApplication.created_at).toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--color-surface-variant)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</p>
                      <a href={`mailto:${selectedApplication.email}`} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{selectedApplication.email}</a>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</p>
                      <a href={`tel:${selectedApplication.phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{selectedApplication.phone}</a>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '0.25rem' }}>Specialty & Experience</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{selectedApplication.experience}</p>
                  </div>

                  {selectedApplication.message && (
                    <div>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '0.25rem' }}>Cover Note / Message</h4>
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', fontStyle: 'italic', background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-primary)' }}>{selectedApplication.message}</p>
                    </div>
                  )}

                  {selectedApplication.cv_url && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <a 
                        href={selectedApplication.cv_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                      >
                        <FileText size={16} /> View CV / Portfolio Document
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="outline" className="btn-modal-cancel" onClick={() => setIsApplicationModalOpen(false)}>Close</Button>
              </div>
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
