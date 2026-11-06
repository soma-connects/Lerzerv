import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Ban, Check, KeyRound, Lock, MessageSquare, X } from 'lucide-react';
import { artisanService } from '../../services/artisanService';
import './JobTracker.css';

/**
 * "Track your job" for a client: where the job is up to, who is coming, and
 * the start code to give at the door. Opens as a side panel from My jobs.
 *
 * There is no moving map: live location sharing is switched off (migration
 * 0033) until it can be done privately, so the panel shows the job's area.
 */

export interface TrackedJob {
  id: string;
  title: string;
  status: string;
  created_at: string;
  area_name?: string | null;
  category_name?: string | null;
  artisan_name?: string | null;
  assigned_artisan_id?: string | null;
  agreed_amount?: number | string | null;
  quoted_amount?: number | string | null;
  quote_is_firm?: boolean | null;
  visit_scheduled_for?: string | null;
  conversation_id?: string | null;
  job_number?: string | null;
}

const naira = (n: number | string | null | undefined) => {
  const v = Number(n);
  return Number.isFinite(v) ? `₦${v.toLocaleString('en-NG', { maximumFractionDigits: 0 })}` : '';
};
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const STATUS: Record<string, string> = {
  open: 'Finding an artisan', assigned: 'Artisan assigned', in_progress: 'Work in progress', completed: 'Done', cancelled: 'Cancelled',
};

export const JobTracker: React.FC<{ job: TrackedJob; onClose: () => void; onChat?: () => void }> = ({ job, onClose, onChat }) => {
  const [code, setCode] = useState<{ code: string; locked: boolean } | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    let alive = true;
    artisanService.getStartCode(job.id).then((c) => { if (alive) setCode(c); });
    return () => { alive = false; };
  }, [job.id]);

  // Escape closes the panel, like the other dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const s = job.status;
  const cancelled = s === 'cancelled';
  const name = job.artisan_name || '';
  const first = name.split(' ')[0] || 'Your artisan';
  const assigned = !!job.assigned_artisan_id || ['assigned', 'in_progress', 'completed'].includes(s);
  const agreed = !!job.agreed_amount;
  const started = ['in_progress', 'completed'].includes(s);
  const done = s === 'completed';

  const steps = [
    { title: 'Request sent', note: when(job.created_at), done: true },
    {
      title: assigned ? `${first} accepted` : 'Finding your artisan',
      note: assigned ? 'ID-checked by Lezerv' : 'We’re matching you with a verified artisan nearby',
      done: assigned,
    },
    {
      title: 'Price agreed',
      note: agreed
        ? `${naira(job.agreed_amount)}${job.quote_is_firm ? '' : ' · estimate, firm price after the visit'}`
        : job.quoted_amount
          ? `${first} sent ${naira(job.quoted_amount)}: accept or decline on My jobs`
          : job.visit_scheduled_for
            ? `Visit on ${when(job.visit_scheduled_for)}, then a price`
            : 'Your artisan sends a price before any work',
      done: agreed,
    },
    {
      title: 'Work started',
      note: code ? 'After you give your start code at the door' : 'When your artisan starts',
      done: started,
    },
    { title: 'Done', note: done ? 'Thanks! Leave a review on My jobs' : 'You’ll confirm the job is finished', done },
  ];
  const current = cancelled ? -1 : steps.findIndex((st) => !st.done);

  return (
    <div className="jt-overlay" onClick={onClose}>
      <motion.aside
        className="jt-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jt-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <header className="jt-head">
          <div className="jt-head-text">
            <span className="jt-sub">{[job.job_number, job.area_name].filter(Boolean).join(' · ') || job.category_name || 'Your request'}</span>
            <h2 id="jt-title">{job.title}</h2>
          </div>
          <span className={`jt-status s-${s}`}>{STATUS[s] || s}</span>
          <button type="button" className="jt-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="jt-body">
          {/* The job's area: a drawn map, no live position */}
          <section className="jt-map" aria-label="Job area">
            <svg viewBox="0 0 358 170" aria-hidden="true">
              <rect width="358" height="170" fill="#e7f2ea" />
              <path d="M-10 130 Q120 100 200 120 T370 92" stroke="#fff" strokeWidth="16" fill="none" />
              <path d="M90 -10 Q110 80 80 180" stroke="#fff" strokeWidth="12" fill="none" />
              <path d="M262 -10 Q250 70 300 180" stroke="#fff" strokeWidth="10" fill="none" />
              <rect x="20" y="18" width="50" height="34" rx="8" fill="#d6ead9" />
              <rect x="140" y="22" width="70" height="40" rx="8" fill="#d6ead9" />
              <rect x="296" y="26" width="46" height="46" rx="8" fill="#d6ead9" />
              <circle cx="320" cy="150" r="14" fill="#cfe8f3" />
              <ellipse className="jt-ring" cx="178" cy="104" rx="16" ry="5" fill="none" stroke="#0e6e2f" strokeWidth="2.5" />
              <g className="jt-pin">
                <path d="M178 46c-12 0-20 9-20 19 0 13 20 33 20 33s20-20 20-33c0-10-8-19-20-19z" fill="#0e6e2f" />
                <path d="M170 68l8-7 8 7v9h-16z" fill="#fff" />
              </g>
            </svg>
            <div className="jt-map-note">
              <Lock size={15} />
              <span>{job.area_name ? `${job.area_name}. ` : ''}Live location isn’t shared: you’ll see each step here as it happens.</span>
            </div>
          </section>

          {cancelled && (
            <div className="jt-cancelled"><Ban size={18} /> This request was cancelled.</div>
          )}

          {assigned && !cancelled && (
            <section className="jt-artisan">
              <span className="jt-avatar">{name ? initials(name) : '?'}</span>
              <div className="jt-artisan-text">
                <strong>{name || 'Your artisan'}</strong>
                <span><BadgeCheck size={14} /> ID-checked by Lezerv{job.category_name ? ` · ${job.category_name}` : ''}</span>
              </div>
              {onChat && job.conversation_id && (
                <button type="button" className="jt-chat" onClick={onChat} aria-label={`Chat with ${first}`}>
                  <MessageSquare size={19} />
                </button>
              )}
            </section>
          )}

          {code && !cancelled && (
            <section className="jt-code">
              {code.locked ? (
                <>
                  <h3><Lock size={17} /> Start code locked</h3>
                  <p>Too many wrong codes were tried. Our team will contact you before the job starts.</p>
                </>
              ) : started ? (
                <>
                  <h3><Check size={17} /> Start code used</h3>
                  <p>{first} gave the right code and the work has started.</p>
                </>
              ) : (
                <>
                  <div className="jt-code-head">
                    <h3><KeyRound size={17} /> Your start code</h3>
                    <button type="button" className="jt-code-btn" onClick={() => setShowCode((v) => !v)} aria-expanded={showCode}>
                      {showCode ? 'Hide' : 'Show code'}
                    </button>
                  </div>
                  {showCode && (
                    <div className="jt-digits" aria-live="polite" aria-label={`Start code ${code.code.split('').join(' ')}`}>
                      {code.code.split('').map((d, i) => (
                        <motion.span key={i} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.1 }}>
                          {d}
                        </motion.span>
                      ))}
                    </div>
                  )}
                  <p>Only give it when {first === 'Your artisan' ? 'your artisan' : first} is at your door. It’s how you know the right person came.</p>
                </>
              )}
            </section>
          )}

          <section className="jt-steps" aria-label="Progress">
            <ol>
              {steps.map((st, i) => (
                <li key={st.title} className={cancelled ? 'off' : st.done ? 'done' : i === current ? 'now' : 'todo'}>
                  <span className="jt-dot" aria-hidden="true">{st.done && !cancelled && <Check size={13} strokeWidth={3} />}</span>
                  <div>
                    <strong>{st.title}</strong>
                    <span>{st.note}</span>
                  </div>
                  {i === current && <span className="sr-only">(current step)</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </motion.aside>
    </div>
  );
};
