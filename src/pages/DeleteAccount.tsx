import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supportService } from '../services/supportService';
import { useSEO } from '../hooks/useSEO';
import './Legal.css';
import './Contact.css';

/**
 * Account deletion requests, for people who no longer have the app or can't sign in.
 * Google Play requires a web page like this for any app with accounts. A request
 * becomes a support ticket (create_support_ticket, open to signed-out visitors);
 * the team confirms by email and deletes within 30 days. Signed-in app users can
 * also ask from Settings → Delete account.
 */
const DeleteAccount: React.FC = () => {
  useSEO({
    title: 'Delete Your Account | Lezerv',
    description: 'Ask Lezerv to delete your account and personal data.',
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await supportService.createTicket(
      {
        name,
        email,
        phone: phone.trim() || null,
        subject: 'Please delete my Lezerv account and personal data.' + (note.trim() ? ` ${note.trim()}` : ''),
      },
      [],
      { topic: 'account_deletion', pagePath: '/delete-account' },
    );
    setSending(false);
    if (res.success) setSent(true);
    else setError(res.error?.message || 'Could not send your request. Please try again.');
  };

  return (
    <div className="legal-page container section">
      <h1>Delete your Lezerv account</h1>
      <p className="last-updated">For the Lezerv app and lezerv.com</p>

      <section>
        <h2>The quickest way</h2>
        <p>
          In the Lezerv app, open <strong>Account → Settings → Delete account</strong>. If you no
          longer have the app or can't sign in, use the form below.
        </p>
      </section>

      <section>
        <h2>What happens</h2>
        <p>
          We confirm the request by email, then delete your account and personal data within 30
          days: your name, phone number, email, saved addresses, location, chat messages, photos
          and notification settings. We keep only what the law requires us to keep, such as
          records of payments, and only for as long as it requires.
        </p>
      </section>

      <section>
        <h2>Request deletion</h2>
        {sent ? (
          <p>
            <CheckCircle2 size={18} style={{ verticalAlign: 'text-bottom' }} /> Request received. We'll
            email <strong>{email.trim()}</strong> to confirm it's you, then delete your account.
          </p>
        ) : (
          <form className="contact-form" onSubmit={submit}>
            {error && (
              <div className="submit-error-banner">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="del-name">Full name <span className="required">*</span></label>
              <input id="del-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="del-email">Email we can reach you on <span className="required">*</span></label>
              <input id="del-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="del-phone">Phone number on the account (if you signed in with your phone)</label>
              <input id="del-phone" type="tel" autoComplete="tel" placeholder="+234…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="del-note">Anything else we should know (optional)</label>
              <textarea id="del-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="form-footer">
              <Button
                type="submit"
                size="lg"
                isLoading={sending}
                disabled={sending || name.trim().length < 2 || !email.includes('@')}
                rightIcon={sending ? <Loader2 size={18} className="spin" /> : <Trash2 size={18} />}
              >
                {sending ? 'Sending…' : 'Request deletion'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default DeleteAccount;
