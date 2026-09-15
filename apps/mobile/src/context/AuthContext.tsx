import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseAccessToken, rememberAccessToken, supabase, withTimeout, clearAccessToken } from '../lib/supabase';
import { syncCallerIdAuth } from '../lib/callerIdNative';
import {
  deactivateStaffFcmPushTokens,
  registerAndSyncFcmPushToken,
  subscribeToFcmTokenRefresh,
} from '../services/pushNotifications';

function normalizeProfile(data: any) {
  if (!data) return data;
  const joined = [data.first_name, data.last_name]
    .map((s: any) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
  return { ...data, full_name: joined || data.full_name };
}

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role?: {
    role_code: string;
    role_name: string;
  };
  phone?: string;
  department?: string | null;
  created_at?: string;
  workshop_id?: string | null;
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
  refreshUserProfile: () => Promise<UserProfile | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const role = userProfile?.role?.role_code || null;

  // Register mobile FCM token after login and keep the single active device in sync.
  useEffect(() => {
    if (!user?.id) return;
    void registerAndSyncFcmPushToken(user.id).catch(() => null);
    const unsubscribe = subscribeToFcmTokenRefresh(() => {
      void registerAndSyncFcmPushToken(user.id).catch(() => null);
    });
    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    // Check for existing session
    void withTimeout(supabase.auth.getSession(), 6000, 'Session')
      .then(({ data: { session } }) => {
        if (session?.user) {
          rememberAccessToken(session.access_token);
          syncCallerIdAuth(session.access_token);
          setUser(session.user);

          // Fetch user profile with role
          void withTimeout(
            Promise.resolve(
              supabase
                .from('users_login')
                .select(`
                  *,
                  role:roles!role_id(role_code, role_name)
                `)
                .eq('id', session.user.id)
                .single(),
            ),
            8000,
            'Profile',
          ).then(({ data, error }) => {
            if (error) {
              console.error('Error fetching user profile:', error);
              setIsLoading(false);
              return;
            }
            if (data) {
              setUserProfile(normalizeProfile(data));
            }
            setIsLoading(false);
          }).catch(() => {
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.access_token) {
            rememberAccessToken(session.access_token);
            syncCallerIdAuth(session.access_token);
          }
          if (session?.user) {
            setUser((prev) => (prev?.id === session.user.id ? prev : session.user));
          }
          return;
        }
        if (event === 'SIGNED_OUT') {
          syncCallerIdAuth('');
          setUser(null);
          setUserProfile(null);
          return;
        }
        if (session?.user) {
          rememberAccessToken(session.access_token);
          syncCallerIdAuth(session.access_token);
          setUser((prev) => (prev?.id === session.user.id ? prev : session.user));
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
                setUserProfile(normalizeProfile(data));
              }
            });
        }
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    if (!current) return null;
    const { data, error } = await supabase
      .from('users_login')
      .select(
        `
        *,
        role:roles!role_id(role_code, role_name),
        workshop:workshops!workshop_id(id, name)
      `,
      )
      .eq('id', current.id)
      .maybeSingle();
    if (error || !data) return null;
    const next = normalizeProfile(data);
    setUserProfile(next);
    return next;
  }, []);

  const logout = async () => {
    try {
      await Promise.race([
        deactivateStaffFcmPushTokens(),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      /* best-effort — stale tokens are deactivated on next login */
    }
    clearAccessToken();
    // Punch out before session ends so Live Floor flips to Off Duty
    try {
      const roleCode = String(
        (userProfile as any)?.role?.role_code ||
          (userProfile as any)?.roles?.role_code ||
          '',
      ).toUpperCase();
      if (roleCode === 'TELECALLER' || roleCode === 'LEAD_MANAGER' || roleCode === 'APP_OPERATIONS') {
        const { apiFetch } = await import('../lib/api');
        await Promise.race([
          apiFetch('/api/telecaller/crm/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'punch_out' }),
            timeoutMs: 4000,
          }),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
      }
    } catch {
      /* best-effort */
    }
    try {
      await withTimeout(supabase.auth.signOut(), 5000, 'Sign out');
    } catch {
      /* session already gone */
    }
    clearAccessToken();
    syncCallerIdAuth('');
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
        refreshUserProfile,
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

