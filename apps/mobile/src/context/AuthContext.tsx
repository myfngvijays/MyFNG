import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerAndSyncFcmPushToken } from '../services/pushNotifications';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: {
    role_code: string;
    role_name: string;
  };
  phone?: string;
  department?: string | null;
  created_at?: string;
  workshop?: {
    id: string;
    name?: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const role = userProfile?.role?.role_code || null;

  // Register mobile push token (Expo) after login
  useEffect(() => {
    if (!user?.id) return;
    // Best-effort; never block app render
    void registerAndSyncFcmPushToken(user.id).catch(() => null);
  }, [user?.id]);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        
        // Fetch user profile with role
        supabase
          .from('users_login')
          .select(`
            *,
            role:roles!role_id(role_code, role_name)
          `)
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('Error fetching user profile:', error);
              setIsLoading(false);
              return;
            }
            if (data) {
              setUserProfile(data);
            }
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        
        // Fetch user profile with role
        supabase
          .from('users_login')
          .select(`
            *,
            role:roles!role_id(role_code, role_name)
          `)
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('Error fetching user profile:', error);
              return;
            }
            if (data) {
              setUserProfile(data);
            }
          });
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    // Punch out before session ends so Live Floor flips to Off Duty
    try {
      const roleCode = String(
        (userProfile as any)?.role?.role_code ||
          (userProfile as any)?.roles?.role_code ||
          '',
      ).toUpperCase();
      if (roleCode === 'TELECALLER' || roleCode === 'LEAD_MANAGER' || roleCode === 'APP_OPERATIONS') {
        const { apiFetch } = await import('../lib/api');
        await apiFetch('/api/telecaller/crm/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'punch_out' }),
        });
      }
    } catch {
      /* best-effort */
    }
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role,
        isLoading,
        setUser,
        setUserProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

