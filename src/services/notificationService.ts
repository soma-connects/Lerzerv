import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface INotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export const notificationService = {
  list: async (limit = 20): Promise<INotification[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('notifications list failed:', error); return []; }
    return (data || []) as INotification[];
  },

  markRead: async (id: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
  },

  markAllRead: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  },

  subscribe: (userId: string, onInsert: (n: INotification) => void): RealtimeChannel => {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const notif = payload.new as INotification;
          if (notif && notif.user_id === userId) {
            onInsert(notif);
          }
        }
      )
      .subscribe();
  },

  unsubscribe: (channel: RealtimeChannel) => {
    supabase.removeChannel(channel);
  },
};
