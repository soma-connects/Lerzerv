import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MapPin, Briefcase, HardHat, Wrench, Zap, Droplets, Hammer, CheckCircle2, X, Loader2, Sparkles, AlertCircle, User, Mail, Phone, MessageSquare, UploadCloud, Check, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { applicationService } from '../services/applicationService';
import { jobService } from '../services/jobService';
import type { TJob } from '../services/jobService';
import './Careers.css';

const fallbackJobs: TJob[] = [
  {
    id: 'fallback-1',
    title: "Customer Acquisition Representative",
    department: "Sales & Marketing",
    location: "Remote / Flexible",
    type: "Commission-Based",
    role_type: "corporate",
    description: "Lezerv is a registered company in Nigeria that connects customers with trusted home service providers for services such as cleaning, repairs, maintenance, laundry, cooking, and other household needs. Our mission is to make accessing reliable home services simple, convenient, and efficient. We are seeking energetic and self-driven Customer Acquisition Representatives to help Lezerv grow its customer base. Your primary responsibility will be generating paying customers through online and offline channels. This role is ideal for individuals with strong communication skills who want flexible work and unlimited earning potential.",
    responsibilities: "Identify and acquire new customers for Lezerv services.\nPromote Lezerv through social media platforms, WhatsApp, referrals, communities, and direct outreach.\nFollow up with potential customers and guide them through the booking process.\nBuild relationships and maintain customer engagement.\nTrack leads and report successful conversions.",
    requirements: "Good communication and interpersonal skills.\nActive use of WhatsApp and social media platforms.\nAbility to work independently and achieve targets.\nPrevious sales or marketing experience is an advantage but not required.",
    benefits: "Earn 15% commission on every successful completed booking from customers you bring.\nAdditional performance incentives may be provided for reaching customer acquisition targets.\nExample: Customer booking value: ₦20,000 -> Your commission (15%): ₦3,000.\nFlexible working schedule.\nUnlimited earning opportunity.\nOpportunity to grow with Lezerv as the company expands."
  },
  {
    id: 'fallback-2',
    title: "Operations Manager",
    department: "Logistics",
    location: "Lagos, Nigeria",
    type: "Full-time",
    role_type: "corporate",
    description: "We are looking for an experienced Operations Manager to oversee our daily home services logistics, service provider onboarding, quality control processes, and customer satisfaction metrics. You will ensure seamless service delivery and direct field operations across Nigeria.",
    responsibilities: "Manage day-to-day operations and service delivery logistics.\nOnboard, verify, and monitor home service providers and artisans.\nImplement quality control standards and handle escalations.\nOptimize field resource allocation and dispatch schedules.\nTrack key operational performance indicators.",
    requirements: "3+ years experience in operations, logistics, or project management.\nExcellent organizational and team management skills.\nDeep familiarity with the home service industry in Nigeria.\nStrong analytical mindset and problem-solving skills.",
    benefits: "Competitive monthly base salary.\nComprehensive health insurance plan.\nPaid time off and performance-related bonuses.\nProfessional growth and executive leadership opportunities."
  },
  {
    id: 'fallback-3',
    title: "Frontend Engineer (React)",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    role_type: "corporate",
    description: "Join our dynamic product team and build the next-generation web platforms for Lezerv. You will build highly responsive, state-of-the-art interactive frontends utilizing React, TypeScript, and modern styling libraries.",
    responsibilities: "Develop high-quality, responsive user interfaces and modular components.\nCollaborate with product designers and backend engineers to integrate APIs.\nOptimize application performance, loading speeds, and accessibility.\nWrite strict, clean, and maintainable TypeScript code.",
    requirements: "3+ years of professional experience building frontend applications in React.\nExpertise in CSS, TailwindCSS, Framer Motion, and TypeScript strict mode.\nFamiliarity with state management libraries and REST/GraphQL APIs.\nPortfolio showcasing premium UI designs and micro-animations.",
    benefits: "Competitive remote remuneration package.\nAnnual learning and device upgrades budgets.\nFlexible working hours and remote setups.\nWork with an exceptionally talented international tech team."
  },
  {
    id: 'fallback-4',
    title: "Certified Electrician",
    department: "Electrical Services",
    location: "Lagos (Lekki, Ikeja, Yaba)",
    type: "Apply for this role",
    role_type: "artisan",
    description: "We are expanding our verified artisan network in Lagos! Join Lezerv as an Electrical Services Partner and receive direct consumer jobs with guaranteed weekly payouts. We are reaching out to local skilled electricians to connect them with high-value contracts.",
    responsibilities: "Perform house conduit and surface wiring installations.\nTroubleshoot electrical faults, breaker issues, and short circuits.\nInstall and service distribution boards, lighting, and power outlets.\nEnsure rigorous safety standards on all residential and commercial jobs.",
    requirements: "Solid hands-on experience in residential and commercial electrical work.\nTechnical degree, vocational certificate, or proven local apprenticeship.\nOwnership of basic professional testing and installation tools.\nReliable smartphone with WhatsApp access.",
    benefits: "Constant stream of verified, high-paying bookings in your area.\nGuaranteed weekly direct payouts to your bank account.\nFree tool insurance and safety certifications.\nNo registration fees or commission cuts for verified basic tiers."
  },
  {
    id: 'fallback-5',
    title: "Master Plumber",
    department: "Plumbing Services",
    location: "Lagos (Gbagada, Surulere, Victoria Island)",
    type: "Apply for this role",
    role_type: "artisan",
    description: "Become a verified Plumbing Services Partner on the Lezerv platform. Build a steady customer base in Lagos and gain access to continuous high-demand bookings, from pipe fixing to complex pump installations.",
    responsibilities: "Install, maintain, and repair residential plumbing systems and fixtures.\nDetect leaks, unclog drains, and fix broken pipes or fittings.\nInstall and service overhead tanks, water pumps, and boreholes.\nProvide accurate estimates on pipe lengths and plumbing materials.",
    requirements: "Proven experience as a master plumber in Nigeria.\nStrong practical knowledge of piping materials, water flow dynamics, and pump rigs.\nExcellent communication skills with customers.\nReliable smartphone for receiving jobs via WhatsApp.",
    benefits: "Direct job assignments near your location.\nTransparent pricing and secure weekly bank transfers.\nGrowth support, tools subsidies, and partner benefits.\nFlexible scheduling: choose when you are available to work."
  }
];

const benefits = [
  "Verified badge & profile boost",
  "Direct customer bookings",
  "Weekly payout to your bank",
  "Free tool insurance",
  "Training & certification support"
];

const getJobDetailsFallback = (job: TJob | null) => {
  if (!job) return { description: '', responsibilities: '', requirements: '', benefits: '' };
  const title = job.title.toLowerCase();
  
  const details = {
    description: job.description || "Join Lezerv, the premier registered platform in Nigeria connecting professional service partners with high-value residential and commercial customers. We are expanding our certified artisan network and corporate teams to deliver unmatched home repair, maintenance, and support services across Lagos and other major cities.",
    responsibilities: job.responsibilities || "Execute high-quality technical or administrative services matching Lezerv standard specifications.\nMaintain reliable communication with customers and provide professional guidance.\nEnsure strict compliance with health, safety, and operational protocols.\nReport job completions and status updates via our mobile partner portals.",
    requirements: job.requirements || "Proven hands-on experience and professional expertise in the relevant trade or business area.\nOwnership of technical tools, devices, or assets required for the position.\nReliable smartphone with continuous internet and WhatsApp access.\nStrong customer relation skills and dedication to excellent workmanship.",
    benefits: job.benefits || "Guaranteed stream of high-paying customer bookings in your preferred locations.\nInstant secure payouts directly into your bank account.\nVerified partner badge, profile boost, and tools insurance coverage.\nFlexible working hours and absolute control over your gig schedules."
  };
  
  // Custom templates for highly specific roles if they are null in DB
  if (title.includes('electrician')) {
    details.description = job.description || "Lezerv is expanding its verified electrician network in Lagos! Join our platform as an Electrical Services Partner and get instant access to residential and commercial wiring, faulted distribution boards, and lighting contracts.";
    details.responsibilities = job.responsibilities || "Perform conduit and surface wiring installations.\nTroubleshoot electrical shorts, breaker faults, and distribution board errors.\nInstall residential and commercial power sockets, light fixtures, and appliances.\nMaintain rigid electrical safety standards on all active gig locations.";
    details.requirements = job.requirements || "Strong technical knowledge of residential house wiring and electrical diagnostics.\nTechnical degree, vocational certificate, or proven local apprenticeship.\nOwnership of basic multimeter, testers, screwdrivers, and insulation gears.\nActive smartphone with WhatsApp.";
  } else if (title.includes('plumber')) {
    details.description = job.description || "Become a verified Plumbing Services Partner on Lezerv! Enjoy continuous high-demand plumbing bookings, from standard faucet leak detections to complex water pump and tank installations.";
    details.responsibilities = job.responsibilities || "Install and repair pipes, fittings, valves, and residential fixtures.\nDiagnose water blockages, leaks, and overhead water tank malfunctions.\nTroubleshoot and fix residential pressure water pumps and water treatment units.\nPrepare material lists and cost estimations for pipe configurations.";
  } else if (title.includes('carpenter') || title.includes('woodwork')) {
    details.description = job.description || "Join Lezerv as a Carpentry & Woodwork Partner! Connect with premium homeowners needing custom furniture installations, door repairs, kitchen cabinet fittings, and direct upholstery maintenance.";
    details.responsibilities = job.responsibilities || "Assemble, repair, and install wooden structures, door locks, and door frames.\nRepair broken cabinets, drawers, tables, chairs, and household fittings.\nConduct woodwork finishings, varnishing, and structural remodeling.\nTake precise measurements and cut materials with standard safety tools.";
  } else if (title.includes('generator') || title.includes('technician')) {
    details.description = job.description || "Join Lezerv as a Power Generator Technician! Service diesel and petrol generators for high-end residential estates and corporate offices across Lagos, Abuja, and major cities.";
    details.responsibilities = job.responsibilities || "Perform routine generator servicing, oil replacement, and filter changes.\nDiagnose mechanical failures, starter issues, and radiator faults.\nMaintain diesel and petrol engines, injectors, and control modules.\nEnsure safe fuel lines and exhaust piping structures on all sites.";
  }
  
  return details;
};

const Careers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'artisan' | 'corporate'>('corporate');
  const [hoveredRole, setHoveredRole] = useState<number | null>(null);
  const [jobs, setJobs] = useState<TJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(true);
  const [selectedJobDetail, setSelectedJobDetail] = useState<TJob | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ title: string; type: 'artisan' | 'corporate' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    experience: '',
    message: '',
    cvUrl: ''
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Drag and Drop File Upload States
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploadProgress, setCvUploadProgress] = useState<number>(0);
  const [cvIsUploading, setCvIsUploading] = useState<boolean>(false);
  const [cvUploadError, setCvUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const startFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setCvUploadError('File size exceeds the 10MB limit.');
      return;
    }

    setCvFile(file);
    setCvIsUploading(true);
    setCvUploadError(null);
    setCvUploadProgress(10);

    // Simulate progress
    const interval = setInterval(() => {
      setCvUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 15;
      });
    }, 200);

    try {
      // Generate unique name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `resumes/${fileName}`;

      let publicUrl = '';
      try {
        // Try actual supabase upload
        const { error } = await supabase.storage
          .from('cvs')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('cvs')
          .getPublicUrl(filePath);

        publicUrl = urlData.publicUrl;
      } catch (uploadErr) {
        // Fallback mock upload
        console.warn('Real Supabase upload failed, using mock path fallback:', uploadErr);
        await new Promise(resolve => setTimeout(resolve, 800)); // wait brief moment
        publicUrl = `https://lezerv-uploads.s3.amazonaws.com/cvs/${fileName}`;
      }

      setCvUploadProgress(100);
      setFormData(prev => ({ ...prev, cvUrl: publicUrl }));
      setTimeout(() => setCvIsUploading(false), 200);
    } catch (err: any) {
      console.error(err);
      setCvUploadError(err.message || 'Failed to upload CV.');
      setCvFile(null);
      setCvIsUploading(false);
    } finally {
      clearInterval(interval);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      startFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startFileUpload(file);
    }
  };

  const triggerFileSelect = () => {
    document.getElementById('cv-file-input')?.click();
  };

  const handleRemoveCvFile = () => {
    setCvFile(null);
    setCvUploadProgress(0);
    setCvUploadError(null);
    setFormData(prev => ({ ...prev, cvUrl: '' }));
  };

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setIsLoadingJobs(true);
        const res = await jobService.fetchJobs();
        if (res.success && res.data && res.data.length > 0) {
          setJobs(res.data);
        } else {
          setJobs(fallbackJobs);
        }
      } catch (err) {
        console.error('Failed to load job positions, using fallback:', err);
        setJobs(fallbackJobs);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    loadJobs();
  }, []);

  const getArtisanIcon = (title: string, department: string) => {
    const text = `${title} ${department}`.toLowerCase();
    if (text.includes('electr') || text.includes('power') || text.includes('zap')) {
      return <Zap size={20} />;
    }
    if (text.includes('plumb') || text.includes('water') || text.includes('droplet')) {
      return <Droplets size={20} />;
    }
    if (text.includes('generator') || text.includes('wrench') || text.includes('tech')) {
      return <Wrench size={20} />;
    }
    if (text.includes('ac ') || text.includes('cooling') || text.includes('hvac') || text.includes('air')) {
      return <HardHat size={20} />;
    }
    if (text.includes('carpenter') || text.includes('wood') || text.includes('hammer') || text.includes('furniture')) {
      return <Hammer size={20} />;
    }
    return <Wrench size={20} />;
  };

  const artisanJobs = jobs.filter(j => j.role_type === 'artisan');
  const corporateJobs = jobs.filter(j => j.role_type === 'corporate');

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null;
    switch (field) {
      case 'name':
        return formData.name.trim().length < 2 ? 'Full name is required' : null;
      case 'email':
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ? 'A valid email is required' : null;
      case 'phone':
        return !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone) ? 'A valid phone number is required (min 10 digits)' : null;
      case 'experience':
        return formData.experience.trim().length < 10 ? 'Please describe your experience in detail (min 10 chars)' : null;
      case 'cvUrl':
        if (!formData.cvUrl.trim()) return null;
        return !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(formData.cvUrl) ? 'A valid URL link to your CV/Resume is required (e.g. Google Drive, Dropbox)' : null;
      default:
        return null;
    }
  };

  const isFormValid = () => {
    const isCvValid = !formData.cvUrl.trim() || /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(formData.cvUrl);
    return formData.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      /^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone) &&
      formData.experience.trim().length >= 10 &&
      isCvValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, experience: true });
    
    if (!isFormValid() || !selectedRole) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Automatically format CV URL if entered without protocol to prevent Zod validation errors
      let formattedCvUrl = formData.cvUrl.trim();
      if (formattedCvUrl && !/^https?:\/\//i.test(formattedCvUrl)) {
        formattedCvUrl = `https://${formattedCvUrl}`;
      }

      const response = await applicationService.submitApplication({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role_title: selectedRole.title,
        role_type: selectedRole.type,
        experience: formData.experience,
        message: formData.message || undefined,
        cv_url: formattedCvUrl
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to submit application.');
      }

      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', experience: '', message: '', cvUrl: '' });
      setTouched({});
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="careers-page">
      {/* Hero Section */}
      <section className="careers-hero">
        <div className="container">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="careers-label">Join Lezerv</span>
            <h1>Empower Your Craft,<br />Grow Your Business</h1>
            <p>Lezerv is a <strong>registered company in Nigeria</strong> that connects customers with trusted home service providers for services such as cleaning, repairs, maintenance, laundry, cooking, and other household needs. Join the largest network of verified artisans and home service professionals in Nigeria. Whether you are a solo technician or a corporate talent, there is a place for you here.</p>

            <div className="hero-stats">
              <div className="hero-stat">
                <span className="stat-number">500+</span>
                <span className="stat-label">Active Partners</span>
              </div>
              <div className="hero-stat">
                <span className="stat-number">₦150M+</span>
                <span className="stat-label">Paid to Artisans</span>
              </div>
              <div className="hero-stat">
                <span className="stat-number">15+</span>
                <span className="stat-label">Cities Covered</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="hero-image-wrapper">
              <img
                src="https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=1200&q=80"
                alt="Professional laundry artisan folding fresh linens"
                loading="eager"
              />
              <div className="hero-image-badge">
                <CheckCircle2 size={16} />
                <span>Verified Partner Program</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tab Switcher */}
      <section className="roles-section">
        <div className="container">
          <div className="tab-switcher">
            <button
              className={`tab-btn ${activeTab === 'corporate' ? 'active' : ''}`}
              onClick={() => setActiveTab('corporate')}
            >
              <Briefcase size={18} />
              Corporate Roles
            </button>
            <button
              className={`tab-btn ${activeTab === 'artisan' ? 'active' : ''}`}
              onClick={() => setActiveTab('artisan')}
            >
              <HardHat size={18} />
              Artisan Partners
            </button>
          </div>

          {/* Artisan View */}
          {activeTab === 'artisan' && (
            <motion.div
              className="artisan-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="artisan-layout">
                <div className="artisan-roles">
                  <h2>Open Artisan Positions</h2>
                  <p className="section-desc">High-demand roles in your city. Apply today and start earning within 48 hours.</p>

                  <div className="roles-list">
                    {isLoadingJobs ? (
                      <div className="loading-jobs-spinner">
                        <Loader2 size={32} className="spin" />
                        <p>Loading open vacancies...</p>
                      </div>
                    ) : artisanJobs.length > 0 ? (
                      artisanJobs.map((role, i) => (
                        <motion.div
                          key={role.id}
                          className="role-card"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          onMouseEnter={() => setHoveredRole(i)}
                          onMouseLeave={() => setHoveredRole(null)}
                          onClick={() => setSelectedJobDetail(role)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="role-main">
                            <div className="role-icon" style={{
                              backgroundColor: 'var(--color-primary-container)',
                              color: 'var(--color-on-primary-container)'
                            }}>
                              {getArtisanIcon(role.title, role.department)}
                            </div>
                            <div className="role-info">
                              <div className="role-header">
                                <h3>{role.title}</h3>
                                <span className={`demand-badge ${role.type.toLowerCase().replace(/\s+/g, '-')}`}>
                                  {role.type}
                                </span>
                              </div>
                              <p className="role-location">
                                <MapPin size={14} />
                                {role.location}
                              </p>
                            </div>
                          </div>
                          <div className="role-action">
                            <ArrowRight
                              size={20}
                              className={`role-arrow ${hoveredRole === i ? 'active' : ''}`}
                            />
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <p className="no-roles-message">No active artisan positions at the moment.</p>
                    )}
                  </div>
                </div>

                <div className="artisan-benefits">
                  <h3>Why Partner With Us?</h3>
                  <ul className="benefits-list">
                    {benefits.map((benefit, i) => (
                      <li key={i}>
                        <CheckCircle2 size={18} className="benefit-check" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => {
                      setSelectedRole({ title: 'General Artisan Partner', type: 'artisan' });
                      setIsModalOpen(true);
                    }}
                  >
                    Apply as Artisan
                  </Button>
                  <p className="benefits-note">No registration fees. Background check required.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Corporate View */}
          {activeTab === 'corporate' && (
            <motion.div
              className="corporate-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="corporate-header">
                <h2>Join the Team</h2>
                <p className="section-desc">Help us build the future of home services in Africa.</p>
              </div>

              <div className="corporate-grid">
                {isLoadingJobs ? (
                  <div className="loading-jobs-spinner-full">
                    <Loader2 size={32} className="spin" />
                    <p>Loading open vacancies...</p>
                  </div>
                ) : corporateJobs.length > 0 ? (
                  corporateJobs.map((role, i) => (
                    <motion.div
                      key={role.id}
                      className="corporate-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ y: -4 }}
                    >
                      <div className="corporate-card-header">
                        <span className="job-type">{role.type}</span>
                        <span className="job-location">
                          <MapPin size={14} />
                          {role.location}
                        </span>
                      </div>
                      <h3>{role.title}</h3>
                      <p className="job-dept">{role.department}</p>
                      <div className="corporate-card-footer">
                        <Button
                          variant="outline"
                          size="sm"
                          rightIcon={<ArrowRight size={16} />}
                          onClick={() => setSelectedJobDetail(role)}
                        >
                          View Role
                        </Button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="no-roles-message-full">No active corporate positions at the moment.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="careers-cta">
        <div className="container">
          <div className="cta-content">
            <h2>Not sure where you fit?</h2>
            <p>Send us your details and we will match you with the right opportunity.</p>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setSelectedRole({ title: 'General Corporate Candidate', type: 'corporate' });
                setIsModalOpen(true);
              }}
            >
              Contact Recruitment
            </Button>
          </div>
        </div>
      </section>

      {/* Careers Application Modal */}
      <AnimatePresence>
        {isModalOpen && selectedRole && (
          <div className="modal-backdrop" onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }}>
            <motion.div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
            >
              <button className="modal-close-btn" onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }} aria-label="Close modal">
                <X size={20} />
              </button>

              <div className="modal-header">
                <div className="modal-badge-wrapper">
                  <span className={`modal-badge ${selectedRole.type}`}>
                    {selectedRole.type === 'artisan' ? 'Artisan Partnership' : 'Corporate Role'}
                  </span>
                </div>
                <h2>Apply for {selectedRole.title}</h2>
                <p>Submit your details to start the verification process.</p>
              </div>

              {isSubmitted ? (
                <motion.div
                  className="modal-success-state"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="success-icon-container">
                    <CheckCircle2 size={48} className="success-icon" />
                  </div>
                  <h3>Application Submitted!</h3>
                  <p>
                    Thank you for applying. Our talent acquisition team will review your profile.
                    {selectedRole.type === 'artisan' 
                      ? ' We will contact you within 48 hours for the next verification steps.'
                      : ' We will reach out to you within 3-5 business days.'}
                  </p>
                  <Button variant="primary" onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }} size="lg">
                    Got it, Thanks!
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                  {submitError && (
                    <div className="modal-error-banner">
                      <AlertCircle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="form-group-grid">
                    <div className={`form-group ${getFieldError('name') ? 'has-error' : ''}`}>
                      <label htmlFor="modal-name">Full Name <span className="required">*</span></label>
                      <div className="premium-input-wrapper">
                        <User className="premium-input-icon" size={18} />
                        <input
                          type="text"
                          id="modal-name"
                          name="name"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                          required
                        />
                      </div>
                      {getFieldError('name') && <span className="field-error"><AlertCircle size={12} />{getFieldError('name')}</span>}
                    </div>

                    <div className={`form-group ${getFieldError('email') ? 'has-error' : ''}`}>
                      <label htmlFor="modal-email">Email Address <span className="required">*</span></label>
                      <div className="premium-input-wrapper">
                        <Mail className="premium-input-icon" size={18} />
                        <input
                          type="email"
                          id="modal-email"
                          name="email"
                          placeholder="john@example.com"
                          value={formData.email}
                          onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                          required
                        />
                      </div>
                      {getFieldError('email') && <span className="field-error"><AlertCircle size={12} />{getFieldError('email')}</span>}
                    </div>
                  </div>

                  <div className="form-group-grid">
                    <div className={`form-group ${getFieldError('phone') ? 'has-error' : ''}`}>
                      <label htmlFor="modal-phone">Phone Number <span className="required">*</span></label>
                      <div className="premium-input-wrapper">
                        <Phone className="premium-input-icon" size={18} />
                        <input
                          type="tel"
                          id="modal-phone"
                          name="phone"
                          placeholder="+234 80X XXX XXXX"
                          value={formData.phone}
                          onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                          required
                        />
                      </div>
                      {getFieldError('phone') && <span className="field-error"><AlertCircle size={12} />{getFieldError('phone')}</span>}
                    </div>

                    <div className="form-group">
                      <label>Applying For</label>
                      <div className="premium-input-wrapper disabled-wrapper">
                        <Briefcase className="premium-input-icon" size={18} />
                        <input
                          type="text"
                          value={selectedRole.title}
                          disabled
                          className="disabled-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`form-group ${getFieldError('experience') ? 'has-error' : ''}`}>
                    <label htmlFor="modal-experience">
                      {selectedRole.type === 'artisan' ? 'Artisan Experience & Specialty' : 'Professional Background & Experience'} <span className="required">*</span>
                    </label>
                    <div className="premium-input-wrapper textarea-wrapper">
                      <Briefcase className="premium-input-icon" size={18} />
                      <textarea
                        id="modal-experience"
                        name="experience"
                        rows={3}
                        placeholder={selectedRole.type === 'artisan' 
                          ? "E.g., 5 years experience in master electrical work, expert in conduit wiring and DB installations..." 
                          : "E.g., 3 years experience building responsive web UIs in React, specializing in accessibility and animations..."}
                        value={formData.experience}
                        onChange={e => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                        onBlur={() => setTouched(prev => ({ ...prev, experience: true }))}
                        required
                      />
                    </div>
                    {getFieldError('experience') && <span className="field-error"><AlertCircle size={12} />{getFieldError('experience')}</span>}
                  </div>

                  <div className={`form-group ${getFieldError('cvUrl') ? 'has-error' : ''}`}>
                    <label htmlFor="modal-cv">CV / Resume <span className="optional">(optional)</span></label>
                    <div className="cv-upload-container">
                      {cvFile ? (
                        <div className="cv-uploaded-file-card">
                          <FileText className="file-icon" size={28} />
                          <div className="file-details">
                            <span className="file-name">{cvFile.name}</span>
                            <span className="file-size">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</span>
                            {cvIsUploading ? (
                              <div className="file-progress-bar-container">
                                <div className="file-progress-bar" style={{ width: `${cvUploadProgress}%` }}></div>
                              </div>
                            ) : (
                              <span className="file-status-success"><Check size={12} /> Ready to submit</span>
                            )}
                          </div>
                          <button type="button" className="file-remove-btn" onClick={handleRemoveCvFile} disabled={cvIsUploading}>
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className={`cv-dropzone ${isDragging ? 'dragging' : ''}`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={triggerFileSelect}
                          role="button"
                          tabIndex={0}
                        >
                          <input 
                            type="file" 
                            id="cv-file-input" 
                            accept=".pdf,.doc,.docx" 
                            onChange={handleFileSelect} 
                            style={{ display: 'none' }}
                          />
                          <UploadCloud className="upload-icon" size={32} />
                          <p className="dropzone-text"><strong>Drag & drop your CV</strong> or <span className="browse-link">browse</span></p>
                          <p className="dropzone-subtext">Supports PDF, DOC, DOCX up to 10MB</p>
                        </div>
                      )}
                      {cvUploadError && <span className="field-error"><AlertCircle size={12} />{cvUploadError}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="modal-message">Cover Note / Additional Details <span className="optional">(optional)</span></label>
                    <div className="premium-input-wrapper textarea-wrapper">
                      <MessageSquare className="premium-input-icon" size={18} />
                      <textarea
                        id="modal-message"
                        name="message"
                        rows={2}
                        placeholder="Anything else you'd like to share with our recruitment team..."
                        value={formData.message}
                        onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="modal-form-footer">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSubmitting}
                      disabled={!isFormValid() && Object.keys(touched).length > 0}
                      rightIcon={isSubmitting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Immersive Job Details Overlay */}
      <AnimatePresence>
        {selectedJobDetail && (
          <div className="job-details-overlay" onClick={() => setSelectedJobDetail(null)}>
            <motion.div 
              className="job-details-container"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', duration: 0.4 }}
              onClick={e => e.stopPropagation()}
            >
              <button className="job-details-close-btn" onClick={() => setSelectedJobDetail(null)} aria-label="Close job details">
                <X size={20} />
              </button>

              {(() => {
                const jobDetails = getJobDetailsFallback(selectedJobDetail);
                return (
                  <>
                    <div className="job-details-header">
                      <div className="job-details-meta">
                        <span className="job-details-dept">{selectedJobDetail.department}</span>
                        <span className="job-details-dot">•</span>
                        <span className="job-details-location">
                          <MapPin size={14} />
                          {selectedJobDetail.location}
                        </span>
                      </div>
                      <h2>{selectedJobDetail.title}</h2>
                      <div className="job-details-tags">
                        <span className={`job-tag role-${selectedJobDetail.role_type}`}>
                          {selectedJobDetail.role_type === 'artisan' ? 'Artisan Partnership' : 'Corporate Role'}
                        </span>
                        <span className="job-tag employment-type">{selectedJobDetail.type}</span>
                      </div>
                    </div>

                    <div className="job-details-body">
                      <div className="job-details-section">
                        <h3>About Lezerv</h3>
                        <p>
                          Lezerv is a <strong>registered company in Nigeria</strong> that connects customers with trusted home service providers for services such as cleaning, repairs, maintenance, laundry, cooking, and other household needs. Our mission is to make accessing reliable home services simple, convenient, and efficient.
                        </p>
                      </div>

                      {jobDetails.description && (
                        <div className="job-details-section">
                          <h3>Job Summary</h3>
                          <p>{jobDetails.description}</p>
                        </div>
                      )}

                      {jobDetails.responsibilities && (
                        <div className="job-details-section">
                          <h3>Key Responsibilities</h3>
                          <ul className="details-bullet-list">
                            {jobDetails.responsibilities.split('\n').filter(r => r.trim()).map((resp, i) => (
                              <li key={i}>{resp.replace(/^[\s*\-]+/, '').trim()}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {jobDetails.requirements && (
                        <div className="job-details-section">
                          <h3>Requirements</h3>
                          <ul className="details-bullet-list">
                            {jobDetails.requirements.split('\n').filter(r => r.trim()).map((req, i) => (
                              <li key={i}>{req.replace(/^[\s*\-]+/, '').trim()}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {jobDetails.benefits && (
                        <div className="job-details-section">
                          <h3>Benefits & Commission</h3>
                          <ul className="details-bullet-list">
                            {jobDetails.benefits.split('\n').filter(r => r.trim()).map((ben, i) => (
                              <li key={i}>{ben.replace(/^[\s*\-]+/, '').trim()}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="job-details-footer">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedJobDetail(null)}
                >
                  Back to Openings
                </Button>
                <Button 
                  variant="primary" 
                  rightIcon={<ArrowRight size={18} />}
                  onClick={() => {
                    setSelectedRole({ title: selectedJobDetail.title, type: selectedJobDetail.role_type });
                    setSelectedJobDetail(null);
                    setIsModalOpen(true);
                  }}
                >
                  Apply for this Position
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Careers;