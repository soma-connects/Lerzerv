import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, MessageSquare, Send, X, Check, Star, Briefcase, Ban, Play, MapPin, Hand, ClipboardList,
  Receipt, ThumbsUp, ThumbsDown, CalendarClock, Eye, Camera,
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

/** ₦ with thousands separators, e.g. 52000 -> "₦52,000". */
const naira = (amount: number | string | null | undefined): string => {
  const n = Number(amount);
  if (!isFinite(n)) return '—';
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
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

// ── Quote modal (artisan) ──────────────────────────────────
const QuoteModal: React.FC<{ job: any; onClose: () => void; onDone: () => void }> = ({ job, onClose, onDone }) => {
  const [amount, setAmount] = useState(job.quoted_amount ? String(Math.round(Number(job.quoted_amount))) : '');
  const [note, setNote] = useState(job.quote_note || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const valid = isFinite(value) && value > 0;

  const submit = async () => {
    if (!valid) { setError('Enter the amount you are charging.'); return; }
    setSubmitting(true); setError(null);
    const res = await artisanService.submitQuote(job.id, value, note.trim() || undefined);
    setSubmitting(false);
    if (res.success) onDone(); else setError(res.error?.message || 'Could not send the quote.');
  };

  return (
    <div className="review-overlay" onClick={onClose}>
      <motion.div className="review-modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <button className="review-close" onClick={onClose}><X size={18} /></button>
        <h3>{job.quoted_amount ? 'Revise your price' : 'Send your price'}</h3>
        <p className="review-sub">For "{job.title}". The client accepts before any work is charged.</p>

        <label className="quote-label">
          Your price (₦)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="52000"
            autoFocus
          />
        </label>
        {valid && <p className="quote-preview">Client sees {naira(value)}</p>}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What's included? e.g. materials, number of cleaners, hours (optional)"
        />
        {error && <div className="review-error">{error}</div>}
        <Button variant="primary" size="lg" fullWidth disabled={submitting || !valid} onClick={submit}
          rightIcon={submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}>
          {submitting ? 'Sending…' : 'Send price to client'}
        </Button>
      </motion.div>
    </div>
  );
};

// ── Site visit modal (artisan) ─────────────────────────────
const VisitModal: React.FC<{ job: any; onClose: () => void; onDone: () => void }> = ({ job, onClose, onDone }) => {
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ success: boolean; error?: { message: string } }>) => {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (res.success) onDone(); else setError(res.error?.message || 'That did not work.');
  };

  return (
    <div className="review-overlay" onClick={onClose}>
      <motion.div className="review-modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <button className="review-close" onClick={onClose}><X size={18} /></button>
        <h3>See the place first</h3>
        <p className="review-sub">
          Scope changes once you are standing there. Record the visit and your next price is
          sent as a firm one rather than an estimate.
        </p>

        <label className="quote-label">
          Propose a time to visit
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <Button variant="outline" size="md" fullWidth disabled={busy || !when}
          leftIcon={<CalendarClock size={16} />}
          onClick={() => run(() => artisanService.scheduleSiteVisit(job.id, when))}>
          Propose this time
        </Button>

        <p className="visit-or">or</p>

        <Button variant="primary" size="lg" fullWidth disabled={busy}
          leftIcon={busy ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
          onClick={() => run(() => artisanService.confirmSiteVisited(job.id))}>
          I have seen the place
        </Button>
        {error && <div className="review-error">{error}</div>}
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
  const [quoteJob, setQuoteJob] = useState<any>(null);
  const [visitJob, setVisitJob] = useState<any>(null);
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
                    {j.agreed_amount ? (
                      <div className="quote-strip agreed">
                        <Check size={15} />
                        <span>Agreed <strong>{naira(j.agreed_amount)}</strong></span>
                        {j.commission_amount != null && (
                          <span className="quote-takehome">You receive {naira(Number(j.agreed_amount) - Number(j.commission_amount))} after commission</span>
                        )}
                      </div>
                    ) : j.quoted_amount ? (
                      <div className="quote-strip pending">
                        <Receipt size={15} />
                        <span>You quoted <strong>{naira(j.quoted_amount)}</strong> — waiting on the client</span>
                      </div>
                    ) : j.quote_declined_at ? (
                      <div className="quote-strip declined">
                        <ThumbsDown size={15} />
                        <span>Client declined your last price — send a revised one</span>
                      </div>
                    ) : (
                      <div className="quote-strip prompt">
                        <Receipt size={15} />
                        <span>No price sent yet. Send one so the client can approve the work.</span>
                      </div>
                    )}
                    {!j.agreed_amount && ['assigned', 'in_progress'].includes(j.status) && (
                      <div className={`visit-strip ${j.visited_at ? 'done' : ''}`}>
                        {j.visited_at ? (
                          <><Eye size={14} /><span>Site seen — your prices go out as firm</span></>
                        ) : j.visit_scheduled_for ? (
                          <><CalendarClock size={14} /><span>Visit proposed for {new Date(j.visit_scheduled_for).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></>
                        ) : (
                          <><CalendarClock size={14} /><span>Not seen yet — anything you send is an estimate</span></>
                        )}
                        {(j.photos?.length ?? 0) > 0 && (
                          <span className="visit-photos"><Camera size={13} /> {j.photos.length} photo{j.photos.length === 1 ? '' : 's'} attached</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="job-actions">
                    {j.conversation_id && <Button size="sm" variant="outline" leftIcon={<MessageSquare size={16} />} onClick={() => setChatJob(j)}>Chat</Button>}
                    {!j.agreed_amount && !j.visited_at && ['assigned', 'in_progress'].includes(j.status) && (
                      <Button size="sm" variant="outline" leftIcon={<CalendarClock size={16} />} onClick={() => setVisitJob(j)}>
                        Site visit
                      </Button>
                    )}
                    {!j.agreed_amount && ['assigned', 'in_progress'].includes(j.status) && (
                      <Button size="sm" variant={j.quoted_amount ? 'outline' : 'primary'} leftIcon={<Receipt size={16} />} onClick={() => setQuoteJob(j)}>
                        {j.quoted_amount ? 'Revise price' : j.visited_at ? 'Send firm price' : 'Send estimate'}
                      </Button>
                    )}
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
            <h2><ClipboardList size={18} /> Your service requests</h2>
            <Link to="/post-job"><Button size="sm" variant="primary">Request for Service</Button></Link>
          </div>
          {posted.length === 0 ? (
            <div className="mj-empty">
              <p>You haven't requested any service yet.</p>
              <Link to="/post-job"><Button variant="primary" leftIcon={<ClipboardList size={16} />}>Request for a service</Button></Link>
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
                    {j.agreed_amount ? (
                      <div className="quote-strip agreed">
                        <Check size={15} />
                        <span>Price agreed: <strong>{naira(j.agreed_amount)}</strong></span>
                      </div>
                    ) : j.quoted_amount ? (
                      <div className="quote-offer">
                        <div className="quote-offer-head">
                          <Receipt size={16} />
                          <span>
                            {j.artisan_name || 'Your artisan'} quoted <strong>{naira(j.quoted_amount)}</strong>
                            <span className={`quote-tag ${j.quote_is_firm ? 'firm' : 'estimate'}`}>
                              {j.quote_is_firm ? 'firm — after site visit' : 'estimate'}
                            </span>
                          </span>
                        </div>
                        {!j.quote_is_firm && (
                          <p className="quote-offer-warn">
                            This is priced from your description. Once your artisan sees the place the
                            real scope can differ, so the final price may change.
                          </p>
                        )}
                        {j.quote_note && <p className="quote-offer-note">{j.quote_note}</p>}
                        <div className="quote-offer-actions">
                          <Button size="sm" variant="primary" leftIcon={<ThumbsUp size={15} />} disabled={busyId === j.id}
                            onClick={() => act(() => artisanService.respondToQuote(j.id, true), j.id)}>
                            Accept {naira(j.quoted_amount)}
                          </Button>
                          <Button size="sm" variant="outline" leftIcon={<ThumbsDown size={15} />} disabled={busyId === j.id}
                            onClick={() => {
                              const reason = window.prompt('Let the artisan know why (optional) — they can send a revised price:') ?? undefined;
                              act(() => artisanService.respondToQuote(j.id, false, reason), j.id);
                            }}>
                            Decline
                          </Button>
                        </div>
                      </div>
                    ) : null}
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
      <AnimatePresence>{quoteJob && <QuoteModal job={quoteJob} onClose={() => setQuoteJob(null)} onDone={() => { setQuoteJob(null); load(); }} />}</AnimatePresence>
      <AnimatePresence>{visitJob && <VisitModal job={visitJob} onClose={() => setVisitJob(null)} onDone={() => { setVisitJob(null); load(); }} />}</AnimatePresence>
    </div>
  );
};

export default MyJobs;
