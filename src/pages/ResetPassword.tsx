import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, Check, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSEO } from '../hooks/useSEO';
import './Login.css';

const MIN_LENGTH = 6; // same as sign-up and Supabase's default

/** Supabase puts link errors in the URL hash, e.g. #error_code=otp_expired&error_description=… */
function linkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return hash.get('error_description') || hash.get('error');
}

/**
 * Step 2 of a password reset. The emailed link signs the person in (supabase-js reads
 * the token from the URL), so here we only ask for the new password and save it.
 * Signed-in people can also come here directly to change their password.
 */
const ResetPassword: React.FC = () => {
  useSEO({ title: 'Set a new password | Lezerv', description: 'Choose a new password for your Lezerv account.' });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [badLink] = useState(linkError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => navigate('/profile'), 1500);
  };

  // No session: the link expired, was already used, or someone opened this page directly.
  const noSession = !loading && !user;

  return (
    <div className="login-page">
      <motion.div className="login-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="login-header">
          <div className="login-logo">
            {done ? <Check size={32} color="var(--color-primary)" /> : <KeyRound size={32} color="var(--color-primary)" />}
          </div>
          <h1>{done ? 'Password changed' : noSession ? 'This link has expired' : 'Set a new password'}</h1>
          <p>
            {done
              ? "You're signed in. Taking you to your account…"
              : noSession
                ? (badLink ? `${badLink}. ` : '') + 'Reset links work once, for a limited time. Ask for a new one.'
                : `For ${user?.email ?? 'your account'}. Use it to sign in on the website and in the app.`}
          </p>
        </div>

        {loading && <div style={{ display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={24} /></div>}

        {noSession && !done && (
          <Link to="/forgot-password"><Button variant="primary" fullWidth size="lg">Send a new link</Button></Link>
        )}

        {user && !done && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="password">New password</label>
              <div className={`input-with-icon ${password ? 'has-value' : ''}`}>
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Type it again</label>
              <div className={`input-with-icon ${confirm ? 'has-value' : ''}`}>
                <Lock size={18} className="input-icon" />
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
              rightIcon={isLoading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            >
              {isLoading ? 'Saving...' : 'Save new password'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
