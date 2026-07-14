import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, MessageSquare, Send, X, Check, Star, Briefcase, Ban, Play, MapPin, Hand, ClipboardList,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { artisanService } from '../services/artisanService';
import { messagingService, type IMessage } from '../services/messagingService';
import './MyJobs.css';

const STATUS_LABEL: Record<string, string> = {
  open: 'Finding an artisan', assigned: 'Assigned', in_progress: 'In progress',
  completed: 'Completed', cancelled: 'Cancelled',
};

// ── Chat panel ─────────────────────────────────────────────
const ChatPanel: React.FC<{ job: any; myUserId: string; onClose: () => void }> = ({ job, myUserId, onClose }) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  useEffect(() => {
    let channel: any;
    messagingService.getMessages(job.conversation_id).then((m) => {
      setMessages(m); setLoading(false); scrollDown();
      channel = messagingService.subscribe(job.conversation_id, (msg) => {
        setMessages((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]));
        scrollDown();
      });
    });
    return () => { if (channel) messagingService.unsubscribe(channel); };
  }, [job.conversation_id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const sent = await messagingService.sendMessage(job.conversation_id, text.trim());
    if (sent) { setMessages((prev) => (prev.some((p) => p.id === sent.id) ? prev : [...prev, sent])); setText(''); scrollDown(); }
    setSending(false);
  };

  const counterpart = job.iAmClient ? (job.artisan_name || 'Artisan') : (job.client_contact?.name || 'Client');

  return (
    <div className="chat-overlay" onClick={onClose}>
      <motion.div className="chat-panel" onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 240 }}>
        <div className="chat-head">
          <div><h3>{counterpart}</h3><span className="chat-sub">{job.title}</span></div>
          <button className="chat-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="chat-body">
          {loading ? <div className="chat-loading"><Loader2 className="animate-spin" size={22} /></div> :
            messages.map((m) => m.is_system ? (
              <div key={m.id} className="chat-system">{m.body}</div>
            ) : (
              <div key={m.id} className={`chat-bubble ${m.sender_id === myUserId ? 'mine' : 'theirs'}`}>
                <p>{m.body}</p>
                <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          <div ref={endRef} />
        </div>
        <form className="chat-input" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
          <button type="submit" disabled={sending || !text.trim()}>{sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</button>
        </form>
        <p className="chat-safety">🔒 Phone numbers, emails & links are hidden to keep you safe. Keep payment on Lezerv.</p>
      </motion.div>
    </div>
  );
};

// ── Review modal ───────────────────────────────────────────
const ReviewModal: React.FC<{ job: any; onClose: () => void; onDone: () => void }> = ({ job, onClose, onDone }) => {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true); setError(null);
    const res = await artisanService.submitJobReview(job.id, rating, comment.trim() || undefined);
    setSubmitting(false);
    if (res.success) onDone(); else setError(res.error?.message || 'Could not submit review.');
  };

  return (
    <div className="review-overlay" onClick={onClose}>
      <motion.div className="review-modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <button className="review-close" onClick={onClose}><X size={18} /></button>
        <h3>Review {job.artisan_name || 'your artisan'}</h3>
        <p className="review-sub">How was the "{job.title}" job?</p>
        <div className="review-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}>
              <Star size={30} className={n <= (hover || rating) ? 'rstar filled' : 'rstar'} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Share details of your experience (optional)" />
        {error && <div className="review-error">{error}</div>}
        <Button variant="primary" size="lg" fullWidth disabled={submitting} onClick={submit}
          rightIcon={submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}>
          {submitting ? 'Submitting…' : 'Submit review'}
        </Button>
      </motion.div>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────
const MyJobs: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [board, setBoard] = useState<any[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatJob, setChatJob] = useState<any | null>(null);
  const [reviewJob, setReviewJob] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ jobs, myUserId }, openJobs] = await Promise.all([
      artisanService.getDispatchJobs(),
      artisanService.getOpenJobs(),
    ]);
    setJobs(jobs); setMyUserId(myUserId); setBoard(openJobs);
    setLoading(false);
  }, []);

  useEffect(() => { if (!authLoading && user) load(); else if (!authLoading) setLoading(false); }, [authLoading, user, load]);

  const act = async (fn: () => Promise<any>, id: string) => {
    setBusyId(id); await fn(); await load(); setBusyId(null);
  };

  if (authLoading || loading) return <div className="my-jobs loading"><Loader2 className="animate-spin" size={30} /></div>;
  if (!user) return (
    <div className="my-jobs empty-gate"><h2>Sign in to see your jobs</h2><Link to="/login"><Button variant="primary">Login</Button></Link></div>
  );

  const posted = jobs.filter((j) => j.iAmClient);
  const assigned = jobs.filter((j) => j.iAmAssigned);
  const statusPill = (s: string) => <span className={`job-status s-${s}`}>{STATUS_LABEL[s] || s}</span>;

  return (
    <div className="my-jobs">
      <div className="mj-container">
        <h1>My Jobs</h1>

        {/* Artisan job board */}
        {board.length > 0 && (
          <section className="mj-section">
            <h2><Briefcase size={18} /> Available jobs in your areas <span className="mj-badge">{board.length}</span></h2>
            <div className="mj-list">
              {board.map((j) => (
                <div key={j.id} className="job-card">
                  <div className="job-main">
                    <div className="job-title-row"><h3>{j.title}</h3><span className="job-status s-open">Open</span></div>
                    <div className="job-meta">
                      {j.category_name && <span>{j.category_name}</span>}
                      {j.area_name && <span><MapPin size={13} /> {j.area_name}</span>}
                      {j.budget_note && <span className="job-quote">{j.budget_note}</span>}
                      <span className="job-date">{j.interest_count} interested</span>
                    </div>
                    {j.description && <p className="job-desc">{j.description}</p>}
                  </div>
                  <div className="job-actions">
                    {j.already_interested ? (
                      <span className="interested-tag"><Check size={15} /> Interest sent</span>
                    ) : (
                      <Button size="sm" variant="primary" leftIcon={<Hand size={16} />} disabled={busyId === j.id}
                        onClick={() => act(() => artisanService.expressInterest(j.id), j.id)}>I'm interested</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mj-hint">Expressing interest lets our team consider you. You'll be notified if you're assigned.</p>
          </section>
        )}

        {/* Jobs assigned to the artisan */}
        {assigned.length > 0 && (
          <section className="mj-section">
            <h2><Check size={18} /> Jobs assigned to you</h2>
            <div className="mj-list">
              {assigned.map((j) => (
                <div key={j.id} className="job-card">
                  <div className="job-main">
                    <div className="job-title-row"><h3>{j.title}</h3>{statusPill(j.status)}</div>
                    <div className="job-meta">
                      {j.category_name && <span>{j.category_name}</span>}
                      {j.area_name && <span><MapPin size={13} /> {j.area_name}</span>}
                      <span>For {j.client_contact?.name || 'a client'}</span>
                    </div>
                    {j.description && <p className="job-desc">{j.description}</p>}
                  </div>
                  <div className="job-actions">
                    {j.conversation_id && <Button size="sm" variant="outline" leftIcon={<MessageSquare size={16} />} onClick={() => setChatJob(j)}>Chat</Button>}
                    {j.status === 'assigned' && <Button size="sm" variant="primary" leftIcon={<Play size={16} />} disabled={busyId === j.id} onClick={() => act(() => artisanService.updateJobStatus(j.id, 'in_progress'), j.id)}>Start job</Button>}
                    {j.status === 'in_progress' && <Button size="sm" variant="primary" leftIcon={<Check size={16} />} disabled={busyId === j.id} onClick={() => act(() => artisanService.updateJobStatus(j.id, 'completed'), j.id)}>Mark complete</Button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Client's posted jobs */}
        <section className="mj-section">
          <div className="mj-section-head">
            <h2><ClipboardList size={18} /> Your posted jobs</h2>
            <Link to="/post-job"><Button size="sm" variant="primary">Post a job</Button></Link>
          </div>
          {posted.length === 0 ? (
            <div className="mj-empty">
              <p>You haven't posted any jobs yet.</p>
              <Link to="/post-job"><Button variant="primary" leftIcon={<ClipboardList size={16} />}>Post your first job</Button></Link>
            </div>
          ) : (
            <div className="mj-list">
              {posted.map((j) => (
                <div key={j.id} className="job-card">
                  <div className="job-main">
                    <div className="job-title-row"><h3>{j.title}</h3>{statusPill(j.status)}</div>
                    <div className="job-meta">
                      {j.category_name && <span>{j.category_name}</span>}
                      {j.area_name && <span><MapPin size={13} /> {j.area_name}</span>}
                      <span>{j.artisan_name ? `Artisan: ${j.artisan_name}` : 'Matching in progress'}</span>
                      <span className="job-date">{new Date(j.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {j.description && <p className="job-desc">{j.description}</p>}
                  </div>
                  <div className="job-actions">
                    {j.conversation_id && <Button size="sm" variant="outline" leftIcon={<MessageSquare size={16} />} onClick={() => setChatJob(j)}>Chat</Button>}
                    {['open', 'assigned'].includes(j.status) && <Button size="sm" variant="text" leftIcon={<Ban size={16} />} disabled={busyId === j.id} onClick={() => act(() => artisanService.updateJobStatus(j.id, 'cancelled'), j.id)}>Cancel</Button>}
                    {j.status === 'completed' && <Button size="sm" variant="primary" leftIcon={<Star size={16} />} onClick={() => setReviewJob(j)}>Leave review</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>{chatJob && <ChatPanel job={chatJob} myUserId={myUserId!} onClose={() => setChatJob(null)} />}</AnimatePresence>
      <AnimatePresence>{reviewJob && <ReviewModal job={reviewJob} onClose={() => setReviewJob(null)} onDone={() => { setReviewJob(null); load(); }} />}</AnimatePresence>
    </div>
  );
};

export default MyJobs;
