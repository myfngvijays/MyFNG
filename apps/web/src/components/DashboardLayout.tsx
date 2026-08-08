'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Wrench, 
  LogOut, 
  Menu, 
  X,
  Home,
  Users,
  User,
  FileText,
  Tag,
  Settings,
  Building2,
  TrendingUp,
  Shield,
  Briefcase,
  Activity,
  Truck,
  Car,
  Phone,
  ClipboardList,
  Calendar,
  CheckCircle,
  DollarSign,
  Clock,
  AlertTriangle,
  Star,
  Megaphone,
  BarChart3,
  ClipboardCheck,
  Globe,
  MessageSquare,
  MessageCircle,
  MapPin,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/NotificationBell';
import WhatsAppChatListModal from '@/components/shared/WhatsAppChatListModal';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';

const AANSH_SESSION_KEY = 'myfng:aansh_session';
const AANSH_OPTIONAL_SKIP_KEY = 'myfng:aansh_optional_skip';

function getStoredAanshSession(): { session_token: string; aansh_id: number; expires_at: string } | null {
  try {
    const raw = sessionStorage.getItem(AANSH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { session_token?: string; aansh_id?: number; expires_at?: string };
    if (!parsed?.session_token || parsed?.aansh_id == null || !parsed?.expires_at) return null;
    return {
      session_token: parsed.session_token,
      aansh_id: parsed.aansh_id,
      expires_at: parsed.expires_at,
    };
  } catch {
    return null;
  }
}

function setStoredAanshSession(session: { session_token: string; aansh_id: number; expires_at: string } | null) {
  try {
    if (session) sessionStorage.setItem(AANSH_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(AANSH_SESSION_KEY);
  } catch {
    // ignore
  }
}

function getAanshOptionalSkip(): boolean {
  try {
    return sessionStorage.getItem(AANSH_OPTIONAL_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

function setAanshOptionalSkip(skip: boolean) {
  try {
    if (skip) sessionStorage.setItem(AANSH_OPTIONAL_SKIP_KEY, '1');
    else sessionStorage.removeItem(AANSH_OPTIONAL_SKIP_KEY);
  } catch {
    // ignore
  }
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: string;
}

type MenuItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  children?: MenuItem[];
};

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userProfile, setUser, setUserProfile, setRole, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Mobile: open/close. Default closed on small screens, open on lg+.
    try {
      return window.innerWidth >= 1024;
    } catch {
      return true;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Desktop: start collapsed and expand on hover.
    return true;
  });
  const [loading, setLoading] = useState(true);

  const eligibleForAansh = role && ['TELECALLER', 'RSA_MANAGER'].includes(role.toUpperCase());
  const [aanshAvailable, setAanshAvailable] = useState<{ aansh_id: number; system_name: string | null }[]>([]);
  const [aanshSession, setAanshSession] = useState<{
    session_token: string;
    aansh_id: number;
    expires_at: string;
  } | null>(null);
  const [aanshModalOpen, setAanshModalOpen] = useState(false);
  const [aanshLoading, setAanshLoading] = useState(false);
  const [aanshClaiming, setAanshClaiming] = useState(false);
  const whatsappFabEnabled = role && ['TELECALLER', 'RSA_MANAGER'].includes(role.toUpperCase());
  const [waListOpen, setWaListOpen] = useState(false);
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const [waPreviewMessage, setWaPreviewMessage] = useState('');
  const [waUnreadCount, setWaUnreadCount] = useState(0);
  const [waRefreshSignal, setWaRefreshSignal] = useState(0);
  const waAssignedPhonesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    checkAuth();
  }, []);

  // Mobile / WebView: drawer overlays content — close on navigate; never push main aside
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch {
      setSidebarOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      try {
        if (window.innerWidth >= 1024) setSidebarOpen(true);
        else setSidebarOpen(false);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!eligibleForAansh || loading) return;
    const stored = getStoredAanshSession();
    if (stored) {
      setAanshSession(stored);
      setAanshModalOpen(false);
    }
    let cancelled = false;
    setAanshLoading(true);
    fetch('/api/sarv-aansh/session/available')
      .then((r) => r.json())
      .then(async (data: { available?: { aansh_id: number; system_name: string | null }[]; currentSession?: { aansh_id: number; session_token: string; expires_at: string } | null }) => {
        if (cancelled) return;
        setAanshAvailable(Array.isArray(data.available) ? data.available : []);
        if (data.currentSession?.session_token && data.currentSession?.aansh_id != null) {
          const session = {
            session_token: data.currentSession.session_token,
            aansh_id: data.currentSession.aansh_id,
            expires_at: data.currentSession.expires_at,
          };
          setAanshOptionalSkip(false);
          setAanshSession(session);
          setStoredAanshSession(session);
          setAanshModalOpen(false);
          return;
        }
        const hadStored = stored ?? getStoredAanshSession();
        if (hadStored) {
          const heart = await fetch('/api/sarv-aansh/session/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_token: hadStored.session_token }),
          }).then((res) => res.json()).catch(() => ({}));
          if (!cancelled && heart?.expires_at) {
            const session = { ...hadStored, expires_at: heart.expires_at };
            setAanshOptionalSkip(false);
            setAanshSession(session);
            setStoredAanshSession(session);
            setAanshModalOpen(false);
            return;
          }
        }
        if (!cancelled) {
          setAanshSession(null);
          setStoredAanshSession(null);
          if (Array.isArray(data.available) && data.available.length > 0 && !getAanshOptionalSkip()) {
            setAanshModalOpen(true);
          } else {
            setAanshModalOpen(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAanshAvailable([]);
          setStoredAanshSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAanshLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, eligibleForAansh]);

  useEffect(() => {
    if (!aanshSession?.session_token) return;
    const sendHeartbeat = () => {
      fetch('/api/sarv-aansh/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: aanshSession.session_token }),
      })
        .then((r) => r.json())
        .then((data: { expires_at?: string }) => {
          if (data.expires_at) {
            setAanshSession((prev) => {
              if (!prev) return null;
              const next = { ...prev, expires_at: data.expires_at! };
              setStoredAanshSession(next);
              return next;
            });
          }
        })
        .catch(() => {
          // Network blips/background throttling are common when window loses focus.
          // Keep session and retry on next tick/focus instead of dropping immediately.
        });
    };

    // Kick once immediately so active session reflects quickly after tab/window switch.
    sendHeartbeat();
    const t = setInterval(sendHeartbeat, 120000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    const onFocus = () => sendHeartbeat();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [aanshSession?.session_token]);

  // Notification sounds via Web Audio API
  const playMessageSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      // WhatsApp-style double pop notification
      const notes = [
        { freq: 1318, start: 0, dur: 0.08 },     // E6
        { freq: 1568, start: 0.1, dur: 0.08 },    // G6
        { freq: 2093, start: 0.2, dur: 0.12 },    // C7
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(0.45, t + n.start);
        gain.gain.exponentialRampToValueAtTime(0.01, t + n.start + n.dur);
        osc.start(t + n.start);
        osc.stop(t + n.start + n.dur);
      }
    } catch { /* audio not available */ }
  }, []);

  const callRingRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  const startCallRing = useCallback(() => {
    if (callRingRef.current) return;
    try {
      const ctx = new AudioContext();
      let stopped = false;

      const ringLoop = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        // Classic phone ring: two-tone burst
        for (const burst of [0, 0.5]) {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.value = 440;
          osc2.frequency.value = 480;
          gain.gain.setValueAtTime(0.35, t + burst);
          gain.gain.setValueAtTime(0.35, t + burst + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.01, t + burst + 0.4);
          osc1.start(t + burst);
          osc1.stop(t + burst + 0.4);
          osc2.start(t + burst);
          osc2.stop(t + burst + 0.4);
        }
        if (!stopped) setTimeout(ringLoop, 2000);
      };
      ringLoop();

      callRingRef.current = {
        ctx,
        stop: () => {
          stopped = true;
          ctx.close().catch(() => {});
          callRingRef.current = null;
        },
      };
    } catch { /* audio not available */ }
  }, []);

  const stopCallRing = useCallback(() => {
    callRingRef.current?.stop();
  }, []);

  // Track seen call IDs to avoid duplicate notifications on updates
  const seenCallIdsRef = useRef<Set<string>>(new Set());

  // Real-time WhatsApp unread badge for assigned chats
  useEffect(() => {
    const profileId = userProfile?.id;
    if (!whatsappFabEnabled || loading || !profileId) return;
    const supabase = createClient();
    let cancelled = false;

    const normPhone = (p: string) => {
      const d = String(p || '').replace(/\D/g, '');
      if (!d) return '';
      return d.startsWith('91') ? d : `91${d}`;
    };

    const init = async () => {
      try {
        const { data: assignments } = await supabase
          .from('whatsapp_chat_assignments')
          .select('phone')
          .contains('assigned_to_ids', [profileId]);
        if (cancelled) return;
        const phones = new Set((assignments || []).map((a: any) => normPhone(a.phone)));
        waAssignedPhonesRef.current = phones;
        if (phones.size === 0) { setWaUnreadCount(0); return; }
      } catch {
        // ignore
      }
    };
    void init();

    const handleInboundCall = (payload: any) => {
      const row: any = payload.new || {};
      const dir = String(row.direction || '').toUpperCase();
      if (dir !== 'INBOUND') return;
      const status = String(row.call_status || '').toUpperCase();
      const caller = normPhone(String(row.customer_phone || ''));
      if (!waAssignedPhonesRef.current.has(caller)) return;

      if (['ENDED', 'MISSED', 'REJECTED', 'FAILED'].includes(status)) {
        stopCallRing();
        return;
      }
      if (!['INITIATED', 'RINGING', 'ACCEPTED'].includes(status)) return;
      const callId = String(row.id || row.provider_call_id || '');
      if (seenCallIdsRef.current.has(callId)) return;
      seenCallIdsRef.current.add(callId);
      setWaUnreadCount((prev) => prev + 1);
      startCallRing();
    };

    const channel = supabase
      .channel('wa-unread-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const row: any = payload.new || {};
          const dir = String(row.direction || '').toUpperCase();
          if (dir !== 'INBOUND') return;
          const sender = normPhone(String(row.sender_phone || ''));
          setWaRefreshSignal((prev) => prev + 1);
          setWaUnreadCount((prev) => prev + 1);
          playMessageSound();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_call_logs' },
        handleInboundCall
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_call_logs' },
        handleInboundCall
      )
      .subscribe();

    return () => {
      cancelled = true;
      stopCallRing();
      supabase.removeChannel(channel);
    };
  }, [whatsappFabEnabled, loading, userProfile?.id, playMessageSound, startCallRing, stopCallRing]);

  const handleOpenWaList = useCallback(() => {
    setWaUnreadCount(0);
    stopCallRing();
    setWaListOpen(true);
  }, [stopCallRing]);

  // Note: do NOT auto-release on beforeunload.
  // Refresh/navigation also triggers beforeunload, which would incorrectly free Aansh.
  // Session release is explicit on logout (or by admin manual remove).

  const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
    const promise = Promise.resolve(p as any) as Promise<T>;
    return await new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
      promise.then((v) => {
        clearTimeout(t);
        resolve(v);
      }).catch((e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  };

  const checkAuth = async () => {
    try {
      const supabase = createClient();
      // On some navigations the auth store can take a moment to hydrate.
      // Use a timeout guard so the dashboard doesn't get stuck on spinner.
      const sessionRes = await withTimeout(supabase.auth.getSession(), 8000, 'auth.getSession');
      const authUser = sessionRes?.data?.session?.user || null;

      if (!authUser) {
        router.push('/login');
        return;
      }

      // Get user profile
      const selectProfile = `
          *,
          role:roles(role_code, role_name),
          workshop:workshops(*)
        `;

      // Primary: users_login.id == auth user id (some installs)
      let profile: any = null;
      try {
        const byId = await withTimeout(
          supabase.from('users_login').select(selectProfile).eq('id', authUser.id).maybeSingle(),
          8000,
          'users_login by id'
        );
        profile = byId?.data || null;
      } catch {
        profile = null;
      }

      // Fallback: users_login mapped by email/phone (common in this codebase)
      if (!profile) {
        const email = (authUser.email || '').trim();
        const phone = (authUser.phone || '').trim();
        try {
          if (email) {
            const byEmail = await withTimeout(
              supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle(),
              8000,
              'users_login by email'
            );
            profile = byEmail?.data || null;
          }
        } catch {
          // ignore
        }
        try {
          if (!profile && phone) {
            const byPhone = await withTimeout(
              supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle(),
              8000,
              'users_login by phone'
            );
            profile = byPhone?.data || null;
          }
        } catch {
          // ignore
        }
      }

      if (profile) {
        setUser(authUser);
        setUserProfile(profile);
        const roleCode = (profile?.role as any)?.role_code;
        if (roleCode) setRole(roleCode);

        // Check if user has correct role for this page
        // For SUB_ADMIN, allow access to sub_admin routes
        const normalizedRole = role.toLowerCase();
        const normalizedUserRole = roleCode.toLowerCase();
        const superAdminOverride = normalizedUserRole === 'super_admin';
        if (
          !superAdminOverride &&
          normalizedUserRole !== normalizedRole &&
          normalizedRole !== 'sub_admin' &&
          normalizedRole !== 'subadmin'
        ) {
          router.push(`/dashboard/${roleCode.toLowerCase()}`);
        }
      } else {
        // If profile lookup fails (timeout/RLS), still allow rendering so navigation doesn't get stuck.
        setUser(authUser);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (eligibleForAansh && aanshSession?.session_token) {
      try {
        await fetch('/api/sarv-aansh/session/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: aanshSession.session_token }),
        });
      } catch {
        // best-effort release
      }
      setAanshSession(null);
      setStoredAanshSession(null);
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  const handleAanshClaim = async (aanshId: number) => {
    setAanshClaiming(true);
    try {
      const res = await fetch('/api/sarv-aansh/session/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aansh_id: aanshId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Claim failed');
      const session = {
        session_token: data.session_token,
        aansh_id: data.aansh_id,
        expires_at: data.expires_at,
      };
      setAanshOptionalSkip(false);
      setAanshSession(session);
      setStoredAanshSession(session);
      setAanshModalOpen(false);
      setAanshAvailable((prev) => prev.filter((item) => item.aansh_id !== aanshId));
    } catch (e: any) {
      alert(e?.message || 'Failed to claim Aansh');
    } finally {
      setAanshClaiming(false);
    }
  };

  const openAanshSelector = async () => {
    if (!eligibleForAansh) return;
    setAanshOptionalSkip(false);
    setAanshModalOpen(true);
    setAanshLoading(true);
    try {
      const res = await fetch('/api/sarv-aansh/session/available');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load Aansh options');
      setAanshAvailable(Array.isArray(data.available) ? data.available : []);
      if (data.currentSession?.session_token && data.currentSession?.aansh_id != null) {
        const session = {
          session_token: data.currentSession.session_token,
          aansh_id: data.currentSession.aansh_id,
          expires_at: data.currentSession.expires_at,
        };
        setAanshSession(session);
        setStoredAanshSession(session);
      }
    } catch {
      setAanshAvailable([]);
    } finally {
      setAanshLoading(false);
    }
  };

  // Get role-specific menu items
  const getMenuItems = () => {
    const roleCode = role.toUpperCase();
    
    const menus: Record<string, MenuItem[]> = {
      'SUPER_ADMIN': [
        { href: '/dashboard/super_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/super_admin/users', icon: <Users className="w-5 h-5" />, label: 'User Management' },
        { href: '/dashboard/super_admin/workshops', icon: <Building2 className="w-5 h-5" />, label: 'Workshops' },
        { href: '/dashboard/super_admin/workshops/public-pages', icon: <Globe className="w-5 h-5" />, label: 'Public Pages' },
        { href: '/dashboard/super_admin/additional-jobs-master', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Additional Jobs Master' },
        { href: '/dashboard/super_admin/advance-coupons', icon: <Tag className="w-5 h-5" />, label: 'Advance Coupon Management' },
        { href: '/dashboard/super_admin/manual-invoices', icon: <FileText className="w-5 h-5" />, label: 'Manual Invoices' },
        { href: '/dashboard/super_admin/telecaller-distribution', icon: <Phone className="w-5 h-5" />, label: 'Telecaller Distribution' },
        {
          href: '/dashboard/super_admin/whatsapp-templates',
          icon: <MessageSquare className="w-5 h-5" />,
          label: 'WhatsApp',
          children: [
            { href: '/dashboard/super_admin/whatsapp-templates', icon: <MessageSquare className="w-5 h-5" />, label: 'WhatsApp Templates' },
            { href: '/dashboard/super_admin/whatsapp-dashboard', icon: <BarChart3 className="w-5 h-5" />, label: 'WhatsApp Dashboard' },
            { href: '/dashboard/super_admin/whatsapp-messages', icon: <ClipboardList className="w-5 h-5" />, label: 'Message Logs' },
            { href: '/dashboard/super_admin/bot-flow', icon: <Activity className="w-5 h-5" />, label: 'Bot Flow' },
          ],
        },
        { href: '/dashboard/super_admin/lead-history', icon: <ClipboardList className="w-5 h-5" />, label: 'Lead History' },
        { href: '/dashboard/super_admin/kb-questions', icon: <ClipboardList className="w-5 h-5" />, label: 'AI Learning Inbox' },
        {
          href: '/dashboard/super_admin/website-images',
          icon: <Globe className="w-5 h-5" />,
          label: 'Website Images',
          children: [
            { href: '/dashboard/super_admin/website-images', icon: <Globe className="w-5 h-5" />, label: 'All Images' },
            { href: '/dashboard/super_admin/website-images/home-carousel', icon: <Globe className="w-5 h-5" />, label: 'Home Carousel' },
            { href: '/dashboard/super_admin/website-images/promo-banners', icon: <Megaphone className="w-5 h-5" />, label: 'Promo Banners' },
            { href: '/dashboard/super_admin/website-images/customer-reviews', icon: <Star className="w-5 h-5" />, label: 'Customer Reviews' },
            { href: '/dashboard/super_admin/website-images/rsa-hero', icon: <AlertTriangle className="w-5 h-5" />, label: 'RSA Hero' },
            { href: '/dashboard/super_admin/membership-plans', icon: <Star className="w-5 h-5" />, label: 'Membership Plans' },
          ],
        },
        { href: '/dashboard/super_admin/bookings', icon: <FileText className="w-5 h-5" />, label: 'Bookings & Leads' },
        { href: '/dashboard/super_admin/analytics-hub?section=overview', icon: <TrendingUp className="w-5 h-5" />, label: 'Analytics Hub' },
        { href: '/dashboard/super_admin/reports', icon: <TrendingUp className="w-5 h-5" />, label: 'Reports & Analytics' },
        { href: '/dashboard/super_admin/audit-logs', icon: <Shield className="w-5 h-5" />, label: 'Audit Logs' },
        { href: '/dashboard/super_admin/settings', icon: <Settings className="w-5 h-5" />, label: 'System Settings' },
      ],
      'WORKSHOP_ADMIN': [
        { href: '/dashboard/workshop_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop_admin/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
        { href: '/dashboard/workshop_admin/pending-leads', icon: <Clock className="w-5 h-5" />, label: 'Pending Lead Approval' },
        { href: '/dashboard/workshop_admin/leads', icon: <FileText className="w-5 h-5" />, label: 'All Leads' },
        { href: '/dashboard/workshop_admin/public-page', icon: <Globe className="w-5 h-5" />, label: 'Public Page' },
        { href: '/dashboard/workshop_admin/staff', icon: <Users className="w-5 h-5" />, label: 'Staff Management' },
        { href: '/dashboard/workshop_admin/jobs', icon: <Wrench className="w-5 h-5" />, label: 'Active Jobs' },
        { href: '/dashboard/workshop_admin/additional-jobs-master', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Additional Jobs Master' },
        { href: '/dashboard/workshop_admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
      ],
      'WORKSHOP_SUPERVISOR': [
        { href: '/dashboard/workshop_supervisor', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop_supervisor/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
        { href: '/dashboard/workshop_supervisor/pending-leads', icon: <Clock className="w-5 h-5" />, label: 'Pending Lead Approval' },
        { href: '/dashboard/workshop_supervisor/day-planning', icon: <Calendar className="w-5 h-5" />, label: 'Day Planning' },
        { href: '/dashboard/workshop_supervisor/jobs', icon: <Wrench className="w-5 h-5" />, label: 'Manage Jobs' },
        { href: '/dashboard/workshop_supervisor/qc-queue', icon: <CheckCircle className="w-5 h-5" />, label: 'QC Queue' },
        { href: '/dashboard/workshop_supervisor/extra-work', icon: <DollarSign className="w-5 h-5" />, label: 'Additional Jobs Approval' },
        { href: '/dashboard/workshop_supervisor/pickup-delivery', icon: <Truck className="w-5 h-5" />, label: 'Pickup & Delivery' },
        { href: '/dashboard/workshop_supervisor/additional-jobs-master', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Additional Jobs Master' },
        { href: '/dashboard/workshop_supervisor/team-overview', icon: <Users className="w-5 h-5" />, label: 'Team Overview' },
        { href: '/dashboard/workshop_supervisor/daily-report', icon: <FileText className="w-5 h-5" />, label: 'Daily Report' },
        { href: '/dashboard/workshop_supervisor/analytics', icon: <TrendingUp className="w-5 h-5" />, label: 'Analytics' },
        { href: '/dashboard/workshop_supervisor/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'WORKSHOP_MECHANIC': [
        { href: '/dashboard/workshop_mechanic', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop_mechanic/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
        { href: '/dashboard/workshop_mechanic/jobs', icon: <Wrench className="w-5 h-5" />, label: 'My Jobs' },
        { href: '/dashboard/workshop_mechanic/history', icon: <ClipboardList className="w-5 h-5" />, label: 'Job History' },
        { href: '/dashboard/workshop_mechanic/profile', icon: <Users className="w-5 h-5" />, label: 'Profile' },
      ],
      'WORKSHOP_PICKUP_BOY': [
        { href: '/dashboard/workshop_pickup_boy', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop_pickup_boy/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
        { href: '/dashboard/workshop_pickup_boy/tasks', icon: <Truck className="w-5 h-5" />, label: 'My Tasks' },
        { href: '/dashboard/workshop_pickup_boy/history', icon: <ClipboardList className="w-5 h-5" />, label: 'Task History' },
        { href: '/dashboard/workshop_pickup_boy/profile', icon: <Users className="w-5 h-5" />, label: 'Profile' },
      ],
      'LEAD_MANAGER': [
        { href: '/dashboard/lead_manager', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/lead_manager/leads', icon: <FileText className="w-5 h-5" />, label: 'Manage Leads' },
        { href: '/dashboard/lead_manager/workshops', icon: <Building2 className="w-5 h-5" />, label: 'Workshops' },
        { href: '/dashboard/lead_manager/reports', icon: <TrendingUp className="w-5 h-5" />, label: 'Reports' },
      ],
      'RSA_MANAGER': [
        { href: '/dashboard/rsa_manager', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/rsa_manager/leads', icon: <FileText className="w-5 h-5" />, label: 'View All Complaints' },
        { href: '/dashboard/rsa_manager/create-complaint', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Create Complaint' },
        { href: '/dashboard/rsa_manager/car-service-enquiry', icon: <Car className="w-5 h-5" />, label: 'Car Service Enquiry' },
        { href: '/dashboard/rsa_manager/registered', icon: <ClipboardCheck className="w-5 h-5" />, label: 'View Registered' },
        { href: '/dashboard/rsa_manager/rsa-sessions', icon: <Activity className="w-5 h-5" />, label: 'Active Aansh Sessions' },
        { href: '/dashboard/rsa_manager/payments', icon: <DollarSign className="w-5 h-5" />, label: 'Payment' },
        { href: '/dashboard/rsa_manager/mechanics', icon: <Wrench className="w-5 h-5" />, label: 'Manage Mechanics' },
        { href: '/dashboard/rsa_manager/service-partners', icon: <Building2 className="w-5 h-5" />, label: 'Service Partners' },
        { href: '/dashboard/rsa_manager/membership-customer', icon: <Users className="w-5 h-5" />, label: 'Membership Customer' },
        { href: '/dashboard/rsa_manager/reports', icon: <BarChart3 className="w-5 h-5" />, label: 'Reports' },
        { href: '/dashboard/rsa_manager/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
      ],
      'CUSTOMER': [
        { href: '/dashboard/customer', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/customer/bookings', icon: <Car className="w-5 h-5" />, label: 'My Bookings' },
        { href: '/dashboard/customer/vehicles', icon: <Car className="w-5 h-5" />, label: 'My Vehicles' },
        { href: '/dashboard/customer/invoices', icon: <FileText className="w-5 h-5" />, label: 'Invoices' },
        { href: '/dashboard/customer/support', icon: <Phone className="w-5 h-5" />, label: 'Support' },
        { href: '/dashboard/customer/profile', icon: <Users className="w-5 h-5" />, label: 'Profile' },
      ],
      'HOME_SERVICE_MANAGER': [
        { href: '/dashboard/home_service_manager', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/home_service_manager/leads', icon: <FileText className="w-5 h-5" />, label: 'Leads' },
        { href: '/dashboard/home_service_manager/vans', icon: <Truck className="w-5 h-5" />, label: 'Service Vans' },
        { href: '/dashboard/home_service_manager/technicians', icon: <Users className="w-5 h-5" />, label: 'Technicians' },
        { href: '/dashboard/home_service_manager/reports', icon: <TrendingUp className="w-5 h-5" />, label: 'Reports' },
      ],
      'COMPANY_MECHANIC_RSA': [
        { href: '/dashboard/company_mechanic_rsa', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/company_mechanic_rsa/tasks', icon: <Wrench className="w-5 h-5" />, label: 'My Tasks' },
        { href: '/dashboard/company_mechanic_rsa/history', icon: <ClipboardList className="w-5 h-5" />, label: 'History' },
        { href: '/dashboard/company_mechanic_rsa/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'COMPANY_VAN_TECHNICIAN': [
        { href: '/dashboard/company_van_technician', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/company_van_technician/tasks', icon: <Wrench className="w-5 h-5" />, label: 'My Tasks' },
        { href: '/dashboard/company_van_technician/history', icon: <ClipboardList className="w-5 h-5" />, label: 'History' },
        { href: '/dashboard/company_van_technician/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'COMPANY_VAN_DRIVER': [
        { href: '/dashboard/company_van_driver', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/company_van_driver/tasks', icon: <Truck className="w-5 h-5" />, label: 'My Trips' },
        { href: '/dashboard/company_van_driver/history', icon: <ClipboardList className="w-5 h-5" />, label: 'History' },
        { href: '/dashboard/company_van_driver/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'TELECALLER': [
        { href: '/dashboard/telecaller', icon: <Home className="w-5 h-5" />, label: 'Home' },
        { href: '/dashboard/telecaller/leads', icon: <ClipboardList className="w-5 h-5" />, label: 'Leads' },
        { href: '/dashboard/telecaller/book', icon: <Phone className="w-5 h-5" />, label: 'Book' },
        { href: '/dashboard/telecaller/workshops', icon: <MapPin className="w-5 h-5" />, label: 'Workshops' },
        { href: '/dashboard/telecaller/engage', icon: <Calendar className="w-5 h-5" />, label: 'Engage' },
        { href: '/dashboard/telecaller/me', icon: <User className="w-5 h-5" />, label: 'Me' },
      ],
      'SUB_ADMIN': [
        { href: '/dashboard/sub_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/sub_admin/team', icon: <Users className="w-5 h-5" />, label: 'Team Management' },
        { href: '/dashboard/sub_admin/whatsapp-templates', icon: <MessageSquare className="w-5 h-5" />, label: 'WhatsApp Templates' },
        { href: '/dashboard/sub_admin/leads', icon: <FileText className="w-5 h-5" />, label: 'Leads' },
        ...((((userProfile as any)?.department) === 'CSE') ? [{ href: '/dashboard/sub_admin/dialer-leads', icon: <Phone className="w-5 h-5" />, label: 'Dialer Leads' }] : []),
        { href: '/dashboard/sub_admin/escalations', icon: <AlertTriangle className="w-5 h-5" />, label: 'Escalations' },
        { href: '/dashboard/sub_admin/performance', icon: <TrendingUp className="w-5 h-5" />, label: 'Performance' },
        { href: '/dashboard/sub_admin/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'SUBADMIN': [
        { href: '/dashboard/subadmin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/sub_admin/whatsapp-templates', icon: <MessageSquare className="w-5 h-5" />, label: 'WhatsApp Templates' },
      ],
      'AUDITOR': [
        { href: '/dashboard/auditor', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/auditor/audits', icon: <Shield className="w-5 h-5" />, label: 'My Audits' },
        { href: '/dashboard/auditor/workshops', icon: <Building2 className="w-5 h-5" />, label: 'Workshops' },
        { href: '/dashboard/auditor/escalations', icon: <AlertTriangle className="w-5 h-5" />, label: 'Escalations' },
        { href: '/dashboard/auditor/performance', icon: <TrendingUp className="w-5 h-5" />, label: 'Performance' },
        { href: '/dashboard/auditor/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'CUSTOMER_SERVICE_EXECUTIVE': [
        { href: '/dashboard/cse', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/cse/call-panel', icon: <Phone className="w-5 h-5" />, label: 'Call Panel' },
        { href: '/dashboard/cse/tickets', icon: <FileText className="w-5 h-5" />, label: 'Tickets' },
        { href: '/dashboard/cse/callbacks', icon: <Clock className="w-5 h-5" />, label: 'Callbacks' },
        { href: '/dashboard/cse/ratings', icon: <Star className="w-5 h-5" />, label: 'Ratings' },
        { href: '/dashboard/cse/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'CSE': [
        { href: '/dashboard/cse', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/cse/call-panel', icon: <Phone className="w-5 h-5" />, label: 'Call Panel' },
        { href: '/dashboard/cse/tickets', icon: <FileText className="w-5 h-5" />, label: 'Tickets' },
        { href: '/dashboard/cse/callbacks', icon: <Clock className="w-5 h-5" />, label: 'Callbacks' },
        { href: '/dashboard/cse/ratings', icon: <Star className="w-5 h-5" />, label: 'Ratings' },
        { href: '/dashboard/cse/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'DIGITAL_MARKETING': [
        { href: '/dashboard/digital_marketing', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/digital_marketing/blogs', icon: <FileText className="w-5 h-5" />, label: 'Blogs' },
        { href: '/dashboard/digital_marketing/blogs/categories', icon: <Tag className="w-5 h-5" />, label: 'Blog Categories' },
        { href: '/dashboard/digital_marketing/campaigns', icon: <Megaphone className="w-5 h-5" />, label: 'Campaigns' },
        { href: '/dashboard/digital_marketing/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
        { href: '/dashboard/digital_marketing/leads', icon: <Users className="w-5 h-5" />, label: 'Leads' },
        { href: '/dashboard/digital_marketing/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
      'DIGITAL_AUTHOR': [
        { href: '/dashboard/digital_author', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/digital_author/blogs', icon: <FileText className="w-5 h-5" />, label: 'My Blogs' },
        { href: '/dashboard/digital_author/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
      ],
    };

    return menus[roleCode] || [
      { href: `/dashboard/${role.toLowerCase()}`, icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
      { href: `/dashboard/${role.toLowerCase()}/profile`, icon: <Users className="w-5 h-5" />, label: 'Profile' },
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  const menuItems = getMenuItems();

  const headerOffsetClass =
    'top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-[calc(4rem+env(safe-area-inset-top))]';
  const mainPadTopClass =
    'pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pt-[calc(4rem+env(safe-area-inset-top))]';

  return (
    <div className="admin-shell">
      {/* Header */}
      <header className="admin-header">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <Link href={`/dashboard/${role.toLowerCase()}`} className="flex items-center min-w-0">
              <img
                src="/logo.png"
                alt="MyFNG"
                className="h-8 sm:h-9 md:h-10 w-auto max-w-[140px] sm:max-w-none object-contain"
              />
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 flex-shrink-0">
            {eligibleForAansh && (
              <button
                type="button"
                onClick={openAanshSelector}
                title="Change Aansh"
                className="hidden sm:inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100"
              >
                {aanshSession ? `Aansh: ${aanshSession.aansh_id}` : 'Select Aansh'}
              </button>
            )}
            <NotificationBell />
            
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="text-right hidden md:block">
                <p className="font-medium text-xs sm:text-sm truncate max-w-[120px]">{userProfile?.full_name}</p>
                <p className="text-xs text-gray-500 truncate max-w-[120px]">{userProfile?.role?.role_name}</p>
              </div>
              
              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg text-red-600"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar — overlay on mobile/WebView; docked on lg+ */}
      <aside
        onMouseEnter={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarCollapsed(false);
        }}
        onMouseLeave={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarCollapsed(true);
        }}
        className={`fixed left-0 ${headerOffsetClass} h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] sm:h-[calc(100dvh-4rem-env(safe-area-inset-top))] bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 shadow-2xl transition-all duration-300 ease-in-out lg:translate-x-0 w-[min(18rem,85vw)] sm:w-64 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } z-30 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <nav className="flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-2">
            {menuItems.map((item) => {
              if (item.children && item.children.length > 0) {
                const childActive = item.children.some((child) => pathname === child.href);
                return (
                  <div key={item.label} className="space-y-1">
                    <div
                      className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg text-sm sm:text-base ${
                        childActive ? 'bg-white/15 text-white font-semibold' : 'text-white/90 font-medium'
                      } ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className={`${sidebarCollapsed ? 'lg:hidden' : ''} truncate`}>{item.label}</span>
                    </div>
                    <div className={`${sidebarCollapsed ? 'lg:hidden' : ''} ml-4 sm:ml-5 space-y-1`}>
                      {item.children.map((child) => (
                        <NavLink
                          key={child.href}
                          href={child.href}
                          icon={child.icon}
                          active={pathname === child.href}
                          collapsed={false}
                          label={child.label}
                          onNavigate={() => {
                            try {
                              if (window.innerWidth < 1024) setSidebarOpen(false);
                            } catch {
                              setSidebarOpen(false);
                            }
                          }}
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  active={pathname === item.href}
                  collapsed={sidebarCollapsed}
                  label={item.label}
                  onNavigate={() => {
                    try {
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    } catch {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="p-2 sm:p-3 md:p-4 border-t border-blue-500/30">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base text-white hover:bg-red-500/30 font-medium ${
                sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarCollapsed ? 'lg:hidden' : ''} truncate`}>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content — fixed icon-rail margin on desktop; expanded labels overlay (no content shift) */}
      <main
        className={`admin-main ml-0 lg:ml-20 ${mainPadTopClass} min-h-[100dvh] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="admin-page">{children}</div>
      </main>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Aansh selector modal (TELECALLER / RSA_MANAGER) - only after session check done, so refresh keeps same Aansh */}
      {eligibleForAansh && aanshModalOpen && !aanshLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Select Aansh ID</h2>
              {aanshSession ? (
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setAanshModalOpen(false)}
                >
                  Close
                </button>
              ) : null}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Choose an available Aansh to receive SARV calls, or continue without selecting one for now. Claimed Aansh is released on logout.
            </p>
            {aanshSession ? (
              <p className="text-xs text-blue-700 mb-3">Current Aansh: {aanshSession.aansh_id}</p>
            ) : null}
            {aanshLoading ? (
              <div className="py-6 text-center text-gray-500">Loading...</div>
            ) : aanshAvailable.length === 0 ? (
              <p className="text-sm text-amber-600 py-2">No Aansh IDs available. Contact admin or try again later.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {aanshAvailable.map((item) => (
                  <button
                    key={item.aansh_id}
                    type="button"
                    onClick={() => handleAanshClaim(item.aansh_id)}
                    disabled={aanshClaiming}
                    className="w-full flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-50"
                  >
                    {aanshClaiming ? 'Claiming...' : item.system_name ? `${item.system_name} (${item.aansh_id})` : `Aansh ${item.aansh_id}`}
                  </button>
                ))}
              </div>
            )}
            {!aanshSession && (
              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => {
                  setAanshOptionalSkip(true);
                  setAanshModalOpen(false);
                }}
              >
                Proceed without Aansh
              </button>
            )}
          </div>
        </div>
      )}

      {whatsappFabEnabled ? (
        <>
          <button
            type="button"
            onClick={handleOpenWaList}
            title="Open WhatsApp chats"
            className="fixed z-40 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-[1.03] hover:bg-[#1ebe5c] bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]"
          >
            <MessageCircle className="h-6 w-6" />
            {waUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow-lg ring-2 ring-white animate-bounce">
                {waUnreadCount > 99 ? '99+' : waUnreadCount}
              </span>
            )}
          </button>
          <WhatsAppChatListModal
            isOpen={waListOpen}
            title="WhatsApp Chats"
            refreshSignal={waRefreshSignal}
            hideLeadPool={role?.toUpperCase() === 'TELECALLER'}
            onClose={() => setWaListOpen(false)}
            onOpenChat={(phone, preview) => {
              setWaListOpen(false);
              setWaUnreadCount(0);
              setWaPreviewPhone(phone);
              setWaPreviewMessage(
                String(preview || '').trim() || 'Namaste! Hum aapki RSA request me assist karne ke liye available hain.'
              );
              setWaPreviewOpen(true);
            }}
          />
          <WhatsAppMobilePreviewModal
            isOpen={waPreviewOpen}
            phoneNumber={waPreviewPhone}
            title="WhatsApp Chat"
            previewMessage={waPreviewMessage}
            onClose={() => setWaPreviewOpen(false)}
            onBack={() => {
              setWaPreviewOpen(false);
              setWaListOpen(true);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  active,
  collapsed,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
  label?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      title={collapsed ? (label || (typeof children === 'string' ? children : '')) : undefined}
      aria-label={collapsed ? (label || (typeof children === 'string' ? children : undefined)) : undefined}
      className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base ${
        active 
          ? 'bg-white text-blue-700 shadow-lg font-semibold' 
          : 'text-white hover:bg-blue-500/30 font-medium'
      } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className={`${collapsed ? 'lg:hidden' : ''} truncate`}>{children}</span>
    </Link>
  );
}

