import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };

    // Failsafe: never leave the whole app stuck on a spinner if the auth
    // network request stalls (common in in-app browsers with flaky storage).
    const failsafe = setTimeout(finish, 6000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        // Admin check runs in the background — must NOT block app render.
        checkAdminStatus(session?.user ?? null);
      })
      .catch((err) => console.error('Error initializing auth session:', err))
      .finally(finish);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user ?? null);
      finish();
    });

    return () => { clearTimeout(failsafe); subscription.unsubscribe(); };
  }, []);

  const checkAdminStatus = async (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    
    // 1. Hardcoded admin emails
    const adminEmails = [
      'Lezervlimited@gmail.com', 
      'admin@lezerv.com', 
      'pauljizy@gmail.com', 
      'preciouspeter3173@gmail.com'
    ];
    const isHardcodedAdmin = adminEmails.includes(user.email ?? '');
    
    if (isHardcodedAdmin) {
      setIsAdmin(true);
      return;
    }

    // 2. Dynamic database check (gracefully falls back if table doesn't exist yet)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!error && data && data.role === 'admin') {
        setIsAdmin(true);
        return;
      }
    } catch (err) {
      console.warn('Could not verify admin role from database profiles, falling back:', err);
    }

    setIsAdmin(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
