import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface IMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
}

/**
 * In-app chat. Messages are sent through the send_message RPC, which
 * redacts contact info server-side — the client cannot bypass it.
 */
export const messagingService = {
  /** All messages in a conversation, oldest first. */
  getMessages: async (conversationId: string): Promise<IMessage[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('getMessages failed:', error);
      return [];
    }
    return (data || []) as IMessage[];
  },

  /** Send a message (redacted server-side). Returns the stored (redacted) row. */
  sendMessage: async (conversationId: string, body: string): Promise<IMessage | null> => {
    const { data, error } = await supabase
      .rpc('send_message', { p_conversation_id: conversationId, p_body: body })
      .single();
    if (error) {
      console.warn('sendMessage failed:', error);
      return null;
    }
    return data as IMessage;
  },

  /** Subscribe to new messages in a conversation. Returns the channel to unsubscribe. */
  subscribe: (conversationId: string, onInsert: (m: IMessage) => void): RealtimeChannel => {
    return supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onInsert(payload.new as IMessage)
      )
      .subscribe();
  },

  unsubscribe: (channel: RealtimeChannel) => {
    supabase.removeChannel(channel);
  },
};
