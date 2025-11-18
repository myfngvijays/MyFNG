import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  role: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
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
  setUserProfile: (userProfile) => set({ userProfile, role: userProfile?.role || null }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, userProfile: null, role: null }),
}));
