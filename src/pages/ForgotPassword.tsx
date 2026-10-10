import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Loader2, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { userService } from '../services/userService';
import { useSEO } from '../hooks/useSEO';
import './Login.css';

/**
 * Step 1 of a password reset: ask for the email and send the link. The link opens
 * /reset-password (step 2). Login links here, and so does the Android app.
 */
const ForgotPassword: React.FC = () => {
  useSEO({ title: 'Reset your password | Lezerv', description: 'Get a link to set a new Lezerv password.' });
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const res = await userService.sendPasswordReset(email.trim());
    setIsLoading(false);
    if (res.success) setSentTo(email.trim());
    else setError(res.error?.message || 'Could not send the link. Please try again.');
  };

  return (
    <div className="login-page">
      <motion.div className="login-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="login-header">
          <div className="login-logo">
            <KeyRound size={32} color="var(--color-primary)" />
          </div>
          <h1>Forgot your password?</h1>
          <p>
            {sentTo
              ? <>If <strong>{sentTo}</strong> has a Lezerv account, we've sent it a link to set a new password. It can take a few minutes; check your spam folder too.</>
              : "Enter the email you signed up with and we'll send you a link to set a new one."}
          </p>
        </div>

        {!sentTo && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className={`input-with-icon ${email ? 'has-value' : ''}`}>
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
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
              {isLoading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        )}

        <div className="login-footer">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
