import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  userProfile: any | null;
  role: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: any) => void;
  setRole: (role: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, userProfile: null, role: null }),
}));
