import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LifeBuoy, Mail, Phone, MapPin, Bot, User as UserIcon, Headset,
  Send, Check, RefreshCw, Inbox, Clock,
} from 'lucide-react';
import { supportService } from '../../services/supportService';
import type {
  ISupportTicket, ISupportTicketMessage, TTicketStatus,
} from '../../services/supportService';
import './SupportInbox.css';

type TFilter = TTicketStatus | 'all';

const FILTERS: Array<{ key: TFilter; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Awaiting reply' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

/** Maps ticket status onto the admin console's existing pill styles. */
const STATUS_PILL: Record<TTicketStatus, string> = {
  open: 'status-pending',
  pending: 'status-artisan',
  resolved: 'status-approved',
  closed: 'status-on-hold-queue',
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/**
 * Escalations from the support bot. Each ticket arrives with the chat
 * that preceded it, so an admin can see exactly where the bot ran out of
 * road before replying.
 */
export const SupportInbox: React.FC = () => {
  const [tickets, setTickets] = useState<ISupportTicket[]>([]);
  const [filter, setFilter] = useState<TFilter>('open');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ISupportTicketMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  /** Sequence number of the latest openTicket call; stale loads are dropped. */
  const openRequestRef = useRef(0);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId]
  );

  const counts = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === 'open').length,
      pending: tickets.filter((t) => t.status === 'pending').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
    }),
    [tickets]
  );

  // Always fetch everything: the counts above describe the whole queue,
  // and filtering client-side keeps switching tabs instant.
  const loadTickets = useCallback(async () => {
    setLoading(true);
    const rows = await supportService.listAll();
    setTickets(rows);
    setLoading(false);
  }, []);

  // Initial load. State is only touched after the await, and never once
  // the tab has been navigated away from.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await supportService.listAll();
      if (cancelled) return;
      setTickets(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const openTicket = useCallback(async (ticketId: string) => {
    // Guard against out-of-order responses. Clicking ticket A then B can
    // resolve A last, which would leave B selected while A's messages are
    // on screen — and a reply typed there would go to the wrong customer.
    const request = ++openRequestRef.current;
    setSelectedId(ticketId);
    setReply('');
    setError(null);
    setThreadLoading(true);

    const messages = await supportService.getMessages(ticketId);
    if (request !== openRequestRef.current) return; // a newer ticket won

    setThread(messages);
    setThreadLoading(false);
  }, []);

  // Live-update the open thread so two admins don't talk over each other.
  useEffect(() => {
    if (!selectedId) return;
    const channel = supportService.subscribe(selectedId, (message) => {
      setThread((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    return () => { supportService.unsubscribe(channel); };
  }, [selectedId]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread]);

  const sendReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedId || !reply.trim()) return;

      setSending(true);
      setError(null);
      const result = await supportService.reply(selectedId, reply.trim());
      setSending(false);

      if (!result.success) {
        setError(result.error?.message ?? 'Could not send the reply.');
        return;
      }

      setReply('');
      if (result.data) {
        const sent = result.data;
        setThread((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
      // The reply moves the ticket to "awaiting reply".
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedId ? { ...t, status: 'pending' as TTicketStatus } : t))
      );
    },
    [reply, selectedId]
  );

  const changeStatus = useCallback(async (ticketId: string, status: TTicketStatus) => {
    setError(null);
    const result = await supportService.setStatus(ticketId, status);
    if (!result.success) {
      setError(result.error?.message ?? 'Could not update the ticket.');
      return;
    }
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)),
    [filter, tickets]
  );

  return (
    <>
      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--color-tertiary)' }}><Inbox size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Open</span>
            <span className="stat-value">{counts.open}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Clock size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Awaiting client</span>
            <span className="stat-value">{counts.pending}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--color-secondary)' }}><Check size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Resolved</span>
            <span className="stat-value">{counts.resolved}</span>
          </div>
        </div>
      </div>

      <div className="admin-content-card">
        <div className="card-header si-card-header">
          <div>
            <h2>Support Inbox</h2>
            <p className="card-desc">
              Questions the assistant could not resolve. Each ticket carries the chat that led to it.
            </p>
          </div>
          <button type="button" className="si-refresh" onClick={loadTickets} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'si-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="si-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? 'active' : ''}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key !== 'all' && counts[f.key as keyof typeof counts] > 0 && (
                <span className="si-count">{counts[f.key as keyof typeof counts]}</span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="si-error" role="alert">{error}</p>}

        <div className="si-layout">
          {/* ── Queue ─────────────────────────────────────────────── */}
          <div className="si-list">
            {loading ? (
              <p className="si-empty">Loading tickets…</p>
            ) : visible.length === 0 ? (
              <div className="si-empty">
                <LifeBuoy size={26} />
                <p>Nothing here. The assistant is handling everything on its own.</p>
              </div>
            ) : (
              visible.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`si-row ${selectedId === ticket.id ? 'is-active' : ''}`}
                  onClick={() => openTicket(ticket.id)}
                >
                  <div className="si-row-top">
                    <span className="si-row-name">{ticket.name}</span>
                    <span className={`status-pill ${STATUS_PILL[ticket.status]}`}>{ticket.status}</span>
                  </div>
                  <span className="si-row-subject">{ticket.subject}</span>
                  <div className="si-row-meta">
                    <span>{formatWhen(ticket.created_at)}</span>
                    {ticket.topic && <span className="si-topic">{ticket.topic}</span>}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* ── Thread ────────────────────────────────────────────── */}
          <div className="si-detail">
            {!selected ? (
              <div className="si-empty si-empty-detail">
                <LifeBuoy size={30} />
                <p>Pick a ticket to read the conversation and reply.</p>
              </div>
            ) : (
              <>
                <div className="si-detail-head">
                  <div>
                    <h3>{selected.subject}</h3>
                    <div className="si-contact">
                      <a href={`mailto:${selected.email}`}><Mail size={13} /> {selected.email}</a>
                      {selected.phone && (
                        <a href={`tel:${selected.phone}`}><Phone size={13} /> {selected.phone}</a>
                      )}
                      {selected.page_path && (
                        <span><MapPin size={13} /> {selected.page_path}</span>
                      )}
                    </div>
                  </div>
                  <div className="si-status-actions">
                    {selected.status !== 'resolved' && (
                      <button type="button" onClick={() => changeStatus(selected.id, 'resolved')}>
                        <Check size={14} /> Resolve
                      </button>
                    )}
                    {selected.status === 'resolved' && (
                      <button type="button" onClick={() => changeStatus(selected.id, 'open')}>
                        Reopen
                      </button>
                    )}
                    <button type="button" onClick={() => changeStatus(selected.id, 'closed')}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="si-thread" ref={threadRef}>
                  {threadLoading ? (
                    <p className="si-empty">Loading conversation…</p>
                  ) : (
                    thread.map((message) => (
                      <div key={message.id} className={`si-msg si-msg-${message.sender_role}`}>
                        <span className="si-msg-avatar" aria-hidden="true">
                          {message.sender_role === 'bot' ? <Bot size={13} />
                            : message.sender_role === 'agent' ? <Headset size={13} />
                            : <UserIcon size={13} />}
                        </span>
                        <div className="si-msg-body">
                          <span className="si-msg-role">
                            {message.sender_role === 'bot' ? 'Assistant'
                              : message.sender_role === 'agent' ? 'Lezerv team'
                              : selected.name}
                            <time dateTime={message.created_at}>{formatWhen(message.created_at)}</time>
                          </span>
                          <p>{message.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form className="si-reply" onSubmit={sendReply}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={`Reply to ${selected.name}…`}
                    rows={3}
                    aria-label="Your reply"
                  />
                  <button type="submit" disabled={sending || !reply.trim()}>
                    <Send size={15} /> {sending ? 'Sending…' : 'Send reply'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportInbox;
