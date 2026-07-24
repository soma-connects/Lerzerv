import React, { Suspense, lazy, useEffect } from 'react';
import type { ComponentType } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';

// Lazy import with recovery: if a chunk fails to load (flaky network / a new
// deploy invalidated old chunk names), reload the app once to fetch fresh
// assets instead of hanging forever on the Suspense fallback.
function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((err) => {
      const key = 'lz_chunk_reloaded';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // halt while reloading
      }
      throw err;
    })
  );
}

// Lazy load pages for performance
const Home = lazyWithRetry(() => import('./pages/Home'));
const About = lazyWithRetry(() => import('./pages/About'));
const Careers = lazyWithRetry(() => import('./pages/Careers'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const Services = lazyWithRetry(() => import('./pages/Services'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Admin = lazyWithRetry(() => import('./pages/Admin'));
const Payment = lazyWithRetry(() => import('./pages/Payment'));
const TrackOrder = lazyWithRetry(() => import('./pages/TrackOrder'));
const Terms = lazyWithRetry(() => import('./pages/Terms'));
const Privacy = lazyWithRetry(() => import('./pages/Privacy'));
const Ambassador = lazyWithRetry(() => import('./pages/Ambassador'));
const ArtisanOnboard = lazyWithRetry(() => import('./pages/ArtisanOnboard'));
const FindArtisans = lazyWithRetry(() => import('./pages/FindArtisans'));
const ArtisanProfile = lazyWithRetry(() => import('./pages/ArtisanProfile'));
const MyJobs = lazyWithRetry(() => import('./pages/MyJobs'));
const PostJob = lazyWithRetry(() => import('./pages/PostJob'));

import { ambassadorService } from './services/ambassadorService';

const App: React.FC = () => {
  // Capture referral code from URL on any page load
  useEffect(() => {
    // A successful load means chunks are healthy — clear the reload guard.
    sessionStorage.removeItem('lz_chunk_reloaded');
    ambassadorService.captureReferralCode();
    // Track the click if a code was captured
    const code = ambassadorService.getReferralCode();
    if (code) {
      ambassadorService.trackReferralClick(code);
    }
  }, []);

  return (
    <Router>
      <AuthProvider>
        <Layout>
        <ChunkErrorBoundary>
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/services" element={<Services />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/payment/:bookingId" element={<Payment />} />
            <Route path="/track" element={<TrackOrder />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/ambassador" element={<Ambassador />} />
            <Route path="/become-artisan" element={<ArtisanOnboard />} />
            <Route path="/find-artisans" element={<FindArtisans />} />
            <Route path="/artisan/:id" element={<ArtisanProfile />} />
            <Route path="/my-jobs" element={<MyJobs />} />
            <Route path="/post-job" element={<PostJob />} />
          </Routes>
        </Suspense>
        </ChunkErrorBoundary>
      </Layout>
    </AuthProvider>
    </Router>
  );
};

export default App;
