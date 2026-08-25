import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { IApiResponse } from '../types/api';
import type { IBotMessage } from './supportBot';

export type TTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TTicketSenderRole = 'user' | 'agent' | 'bot';

export interface ISupportTicket {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  topic: string | null;
  source: string;
  status: TTicketStatus;
  transcript: IBotMessage[];
  page_path: string | null;
  last_reply_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: TTicketSenderRole;
  body: string;
  created_at: string;
}

export const EscalationSchema = z.object({
  name: z.string().trim().min(2, 'Please tell us your name'),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z.string().trim().optional().nullable(),
  subject: z.string().trim().min(5, 'Please describe the issue in a few more words'),
});

export type TEscalation = z.infer<typeof EscalationSchema>;

/**
 * Pull a human-readable message off an unknown thrown value. Supabase
 * returns plain `{ message, code }` objects rather than Error instances,
 * so an `instanceof Error` check alone would discard the useful text.
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}


/**
 * Support tickets — the bot's handoff to a human.
 *
 * Writes all go through SECURITY DEFINER RPCs (migration 0016) so the
 * client cannot forge ownership, status or another user's ticket.
 */
export const supportService = {
  /**
   * Escalate a bot conversation to the team. Works for guests too — the
   * ticket then carries only the email they typed.
   */
  createTicket: async (
    escalation: TEscalation,
    transcript: IBotMessage[],
    options: { topic?: string | null; pagePath?: string | null } = {}
  ): Promise<IApiResponse<ISupportTicket>> => {
    try {
      const validated = EscalationSchema.parse(escalation);

      const { data, error } = await supabase
        .rpc('create_support_ticket', {
          p_name: validated.name,
          p_email: validated.email,
          p_subject: validated.subject,
          p_transcript: transcript,
          p_phone: validated.phone || null,
          p_topic: options.topic ?? null,
          p_page_path: options.pagePath ?? null,
        })
        .single();

      if (error) throw error;
      return { success: true, data: data as ISupportTicket };
    } catch (err: unknown) {
      console.error('Failed to create support ticket:', err);
      return {
        success: false,
        error: {
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR',
          message:
            err instanceof z.ZodError
              ? err.issues[0]?.message ?? 'Please check the form and try again.'
              : errorMessage(err) || 'Could not reach our support team. Please try again.',
        },
      };
    }
  },

  /** Tickets belonging to the signed-in user, newest first. */
  listMine: async (): Promise<ISupportTicket[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) { console.warn('listMine tickets failed:', error); return []; }
    return (data || []) as ISupportTicket[];
  },

  /** Admin queue. RLS blocks this for non-admins. */
  listAll: async (status?: TTicketStatus): Promise<ISupportTicket[]> => {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) { console.warn('listAll tickets failed:', error); return []; }
    return (data || []) as ISupportTicket[];
  },

  /** The full thread: replayed bot transcript, then the human exchange. */
  getMessages: async (ticketId: string): Promise<ISupportTicketMessage[]> => {
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) { console.warn('getMessages failed:', error); return []; }
    return (data || []) as ISupportTicketMessage[];
  },

  /** Reply as the ticket owner or, for admins, as the agent. */
  reply: async (ticketId: string, body: string): Promise<IApiResponse<ISupportTicketMessage>> => {
    try {
      const { data, error } = await supabase
        .rpc('reply_support_ticket', { p_ticket_id: ticketId, p_body: body })
        .single();
      if (error) throw error;
      return { success: true, data: data as ISupportTicketMessage };
    } catch (err: unknown) {
      console.error('Failed to reply to ticket:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: errorMessage(err) || 'Could not send your reply.' },
      };
    }
  },

  /** Admin only — move a ticket through its lifecycle. */
  setStatus: async (ticketId: string, status: TTicketStatus): Promise<IApiResponse<null>> => {
    try {
      const { error } = await supabase.rpc('admin_set_ticket_status', {
        p_ticket_id: ticketId,
        p_status: status,
      });
      if (error) throw error;
      return { success: true, data: null };
    } catch (err: unknown) {
      console.error('Failed to update ticket status:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: errorMessage(err) || 'Could not update the ticket.' },
      };
    }
  },

  /** Live updates on an open ticket thread. */
  subscribe: (ticketId: string, onInsert: (m: ISupportTicketMessage) => void): RealtimeChannel =>
    supabase
      .channel(`support_ticket:${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => onInsert(payload.new as ISupportTicketMessage)
      )
      .subscribe(),

  unsubscribe: (channel: RealtimeChannel) => {
    supabase.removeChannel(channel);
  },
};
