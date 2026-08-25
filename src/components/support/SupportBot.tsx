import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, X, Send, Bot, User as UserIcon, ArrowRight,
  LifeBuoy, CheckCircle2, ExternalLink, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supportBotEngine, ESCALATE_ACTION, WHATSAPP_URL } from '../../services/supportBot';
import type { IBotAction, IBotMessage } from '../../services/supportBot';
import { supportService } from '../../services/supportService';
import './SupportBot.css';

/** A rendered turn: a bot answer carries its own links and follow-ups. */
interface IChatEntry {
  key: string;
  role: 'user' | 'bot';
  text: string;
  at: string;
  actions?: IBotAction[];
  followUps?: string[];
}

type TView = 'chat' | 'escalate' | 'submitted';

const GREETING: IChatEntry = {
  key: 'greeting',
  role: 'bot',
  text:
    'Hi, I am the Lezerv assistant 👋\n\nI can help you book a service, find an artisan, check prices or sort out your account. If I cannot answer, I will put you through to a human.',
  at: new Date().toISOString(),
  followUps: [
    'How do I book a service?',
    'How much does it cost?',
    'Which areas do you cover?',
    'How do I become an artisan?',
  ],
};

/**
 * Renders the bot's light markup: **bold**, bullet lines and blank-line
 * paragraphs. Deliberately builds React nodes rather than setting HTML.
 */
const RichText: React.FC<{ text: string }> = ({ text }) => {
  const withBold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

  return (
    <>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <span key={i} className="sb-gap" />;
        if (/^[•\d]/.test(trimmed) && (trimmed.startsWith('•') || /^\d+\./.test(trimmed))) {
          return (
            <span key={i} className="sb-bullet">
              {withBold(trimmed)}
            </span>
          );
        }
        return (
          <span key={i} className="sb-line">
            {withBold(trimmed)}
          </span>
        );
      })}
    </>
  );
};

/**
 * The floating support assistant.
 *
 * Answers from the knowledge base, offers in-app navigation, and hands off
 * to a human when it cannot resolve something — carrying the transcript so
 * the customer never has to explain twice. Guests can escalate too; they
 * are replied to by email rather than the notification bell.
 */
export const SupportBot: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<TView>('chat');
  const [entries, setEntries] = useState<IChatEntry[]>([GREETING]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  /** Consecutive unanswered questions — two in a row and we offer a human. */
  const [misses, setMisses] = useState(0);
  const [topic, setTopic] = useState<string | null>(null);

  // Escalation form
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** The transcript that travels with an escalated ticket. */
  const transcript = useMemo<IBotMessage[]>(
    () => entries.map((e) => ({ role: e.role, text: e.text, at: e.at })),
    [entries]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, thinking, view]);

  useEffect(() => {
    if (open && view === 'chat') inputRef.current?.focus();
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const push = useCallback((entry: Omit<IChatEntry, 'key' | 'at'>) => {
    setEntries((prev) => [
      ...prev,
      { ...entry, key: `${prev.length}-${Date.now()}`, at: new Date().toISOString() },
    ]);
  }, []);

  const openEscalation = useCallback(
    (prefillSubject?: string) => {
      // Prefill from the session and the conversation so the handoff is
      // one line of typing, not a form to fill from scratch.
      setForm((f) => ({
        ...f,
        name: f.name || (user?.user_metadata?.full_name as string) || '',
        email: f.email || user?.email || '',
        subject:
          f.subject ||
          prefillSubject ||
          [...entries].reverse().find((e) => e.role === 'user')?.text ||
          '',
      }));
      setFormError(null);
      setView('escalate');
    },
    [entries, user]
  );

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || thinking) return;

      push({ role: 'user', text: question });
      setInput('');
      setThinking(true);

      try {
        const answer = await supportBotEngine.answer(question, transcript);
        setTopic(answer.topic);
        push({
          role: 'bot',
          text: answer.text,
          actions: answer.actions,
          followUps: answer.followUps,
        });

        const nextMisses = answer.resolved ? 0 : misses + 1;
        setMisses(nextMisses);

        // Two dead ends in a row: stop making them ask again.
        if (nextMisses >= 2) {
          push({
            role: 'bot',
            text: 'I do not want to keep you going in circles — let me get a human on this.',
            actions: [{ label: 'Talk to our team', to: ESCALATE_ACTION }],
          });
          setMisses(0);
        }
      } catch (err) {
        console.error('Support bot failed to answer:', err);
        push({
          role: 'bot',
          text: 'Something went wrong on my end. Let me hand you to a person instead.',
          actions: [{ label: 'Talk to our team', to: ESCALATE_ACTION }],
        });
      } finally {
        setThinking(false);
      }
    },
    [misses, push, thinking, transcript]
  );

  const runAction = useCallback(
    (action: IBotAction) => {
      if (action.to === ESCALATE_ACTION) {
        openEscalation();
        return;
      }
      if (action.external) {
        window.open(action.to, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(action.to);
      setOpen(false);
    },
    [navigate, openEscalation]
  );

  const submitEscalation = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setSending(true);

      const result = await supportService.createTicket(
        {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          subject: form.subject,
        },
        transcript,
        { topic, pagePath: location.pathname }
      );

      setSending(false);

      if (!result.success || !result.data) {
        setFormError(result.error?.message ?? 'Could not send that. Please try again.');
        return;
      }

      setTicketRef(result.data.id.slice(0, 8).toUpperCase());
      setView('submitted');
    },
    [form, location.pathname, topic, transcript]
  );

  const restart = useCallback(() => {
    setEntries([{ ...GREETING, at: new Date().toISOString() }]);
    setMisses(0);
    setTopic(null);
    setTicketRef(null);
    setForm((f) => ({ ...f, subject: '' }));
    setView('chat');
  }, []);

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        className={`sb-launcher ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="lezerv-support-bot"
        aria-label={open ? 'Close the Lezerv assistant' : 'Open the Lezerv assistant'}
      >
        {open ? <X size={26} /> : <MessageCircle size={26} />}
        {!open && <span className="sb-launcher-tip">Need help?</span>}
      </button>

      {open && (
        <section
          id="lezerv-support-bot"
          className="sb-panel"
          role="dialog"
          aria-label="Lezerv assistant"
        >
          <header className="sb-header">
            <div className="sb-header-id">
              <span className="sb-avatar" aria-hidden="true"><Bot size={18} /></span>
              <div>
                <p className="sb-title">Lezerv Assistant</p>
                <p className="sb-status">
                  <span className="sb-dot" aria-hidden="true" />
                  Answers instantly · humans on standby
                </p>
              </div>
            </div>
            <div className="sb-header-tools">
              {view === 'chat' && entries.length > 1 && (
                <button type="button" className="sb-icon-btn" onClick={restart} aria-label="Start over">
                  <RotateCcw size={16} />
                </button>
              )}
              <button
                type="button"
                className="sb-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close the assistant"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* ── Conversation ─────────────────────────────────────── */}
          {view === 'chat' && (
            <>
              <div
                className="sb-scroll"
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-atomic="false"
              >
                {entries.map((entry) => (
                  <div key={entry.key} className={`sb-turn sb-turn-${entry.role}`}>
                    <span className="sb-turn-avatar" aria-hidden="true">
                      {entry.role === 'bot' ? <Bot size={15} /> : <UserIcon size={15} />}
                    </span>
                    <div className="sb-bubble-group">
                      <div className="sb-bubble">
                        <RichText text={entry.text} />
                      </div>

                      {entry.actions && entry.actions.length > 0 && (
                        <div className="sb-actions">
                          {entry.actions.map((action) => (
                            <button
                              key={action.to + action.label}
                              type="button"
                              className={`sb-action ${action.to === ESCALATE_ACTION ? 'is-human' : ''}`}
                              onClick={() => runAction(action)}
                            >
                              {action.to === ESCALATE_ACTION ? <LifeBuoy size={14} /> : <ArrowRight size={14} />}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {entry.followUps && entry.followUps.length > 0 && (
                        <div className="sb-chips">
                          {entry.followUps.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              className="sb-chip"
                              onClick={() => send(chip)}
                              disabled={thinking}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {thinking && (
                  <div className="sb-turn sb-turn-bot">
                    <span className="sb-turn-avatar" aria-hidden="true"><Bot size={15} /></span>
                    <div className="sb-bubble sb-typing" aria-label="Assistant is typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </div>

              <form
                className="sb-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything about Lezerv…"
                  aria-label="Your question"
                  disabled={thinking}
                />
                <button type="submit" aria-label="Send" disabled={thinking || !input.trim()}>
                  <Send size={17} />
                </button>
              </form>

              <button type="button" className="sb-footer-link" onClick={() => openEscalation()}>
                <LifeBuoy size={14} /> Talk to a human instead
              </button>
            </>
          )}

          {/* ── Handoff to a human ───────────────────────────────── */}
          {view === 'escalate' && (
            <div className="sb-scroll sb-form-wrap">
              <p className="sb-form-intro">
                Tell us how to reach you and a Lezerv human will pick this up. Your chat so far is
                attached, so you will not have to explain it twice.
              </p>

              <form className="sb-form" onSubmit={submitEscalation}>
                <label>
                  Your name
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ada Obi"
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label>
                  Phone <span className="sb-optional">(optional)</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0801 234 5678"
                  />
                </label>
                <label>
                  What do you need help with?
                  <textarea
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    rows={4}
                    placeholder="Describe the issue in your own words"
                    required
                  />
                </label>

                {formError && <p className="sb-error" role="alert">{formError}</p>}

                <div className="sb-form-actions">
                  <button type="button" className="sb-ghost" onClick={() => setView('chat')}>
                    Back to chat
                  </button>
                  <button type="submit" className="sb-primary" disabled={sending}>
                    {sending ? 'Sending…' : 'Send to our team'}
                  </button>
                </div>
              </form>

              <div className="sb-alt">
                <span>Prefer WhatsApp?</span>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="sb-whatsapp">
                  Chat on WhatsApp <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* ── Confirmation ─────────────────────────────────────── */}
          {view === 'submitted' && (
            <div className="sb-scroll sb-done">
              <CheckCircle2 size={44} className="sb-done-icon" aria-hidden="true" />
              <h3>We have got it</h3>
              <p>
                Your request is with our support team
                {ticketRef && <> — reference <strong>#{ticketRef}</strong></>}.
              </p>
              <p className="sb-done-note">
                {user
                  ? 'We will reply here in your notifications, and by email.'
                  : `We will reply to ${form.email}. Keep an eye on your inbox (and spam folder).`}
              </p>
              <div className="sb-form-actions sb-done-actions">
                <button type="button" className="sb-ghost" onClick={restart}>
                  Ask something else
                </button>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sb-primary sb-primary-link"
                >
                  Nudge us on WhatsApp
                </a>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
};

export default SupportBot;
