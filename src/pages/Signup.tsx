import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { ambassadorService } from '../services/ambassadorService';
import './Login.css'; // Reusing some login styles for consistency

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;
      
      // Attribute referral if a code was stored from a ?ref= link
      const refCode = ambassadorService.getReferralCode();
      if (refCode) {
        try {
          // Get the newly created user's ID from the signup response
          const { data: { user: newUser } } = await supabase.auth.getUser();
          if (newUser) {
            await ambassadorService.attachReferralToSignup(newUser.id, email, refCode);
          }
        } catch (refErr) {
          console.warn('Referral attribution on signup failed:', refErr);
        }
      }

      // Usually Supabase sends a confirmation email
      alert('Registration successful! Please check your email for a confirmation link.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div 
        className="login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="login-header">
          <div className="login-logo">
            <ShieldCheck size={32} color="var(--color-primary)" />
          </div>
          <h1>Create Account</h1>
          <p>Join Lezerv to track your home service bookings.</p>
        </div>

        <form onSubmit={handleSignup} className="login-form">
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <div className={`input-with-icon ${fullName ? 'has-value' : ''}`}>
              <User size={18} className="input-icon" />
              <input 
                id="fullName"
                type="text" 
                placeholder="John Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className={`input-with-icon ${email ? 'has-value' : ''}`}>
              <Mail size={18} className="input-icon" />
              <input 
                id="email"
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className={`input-with-icon ${password ? 'has-value' : ''}`}>
              <Lock size={18} className="input-icon" />
              <input 
                id="password"
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <Button 
            type="submit" 
            variant="primary" 
            fullWidth 
            size="lg"
            disabled={isLoading}
            rightIcon={isLoading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </form>

        <div className="login-footer" style={{ marginTop: 'var(--spacing-xl)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
