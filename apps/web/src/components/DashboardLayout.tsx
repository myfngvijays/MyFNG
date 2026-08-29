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
  CircleDot,
  Settings,
  Building2,
  TrendingUp,
  Shield,
  Briefcase,
  Activity,
  Truck,
  Car,
  Phone,
  PhoneCall,
  Headphones,
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
  Download,
  BookOpen,
  UserPlus,
  Sparkles,
  GitBranch,
  Smartphone,
  Crown,
  Gift,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/NotificationBell';
import ReminderHeaderIcon from '@/components/ReminderHeaderIcon';
import WhatsAppWebWorkspace from '@/components/shared/WhatsAppWebWorkspace';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { dashboardRolesMatch, getRoleDashboardHome } from '@/lib/dashboard/roleHome';
import IncomingClickToCallBanner from '@/components/telecaller/crm/IncomingClickToCallBanner';

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
  /** Optional — if omitted, resolved from auth profile after login. */
  role?: string;
}

type MenuItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  children?: MenuItem[];
  /** Special action instead of navigation (e.g. open WhatsApp workspace). */
  action?: 'open-wa-inbox';
};

export default function DashboardLayout({ children, role: roleProp }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userProfile, setUser, setUserProfile, setRole, logout } = useAuthStore();
  const role = String(
    roleProp || (userProfile as any)?.role?.role_code || '',
  ).trim();
  const roleCode = role.toUpperCase();
  const isAdvisor = roleCode === 'WORKSHOP_SUPERVISOR';
  const workshopRoleLabel =
    roleCode === 'WORKSHOP_SUPERVISOR'
      ? 'Workshop Advisor'
      : roleCode === 'WORKSHOP_ADMIN'
        ? 'Workshop Owner'
        : roleCode === 'WORKSHOP_MECHANIC'
          ? 'Workshop Mechanic'
          : roleCode === 'WORKSHOP_PICKUP_BOY'
            ? 'Pickupboy / Driver'
            : null;
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Mobile: open/close. Default closed on small screens, open on lg+.
    try {
      return window.innerWidth >= 1024;
    } catch {
      return true;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(() => !useAuthStore.getState().userProfile);

  const eligibleForAansh = role && ['TELECALLER', 'RSA_MANAGER', 'LEAD_MANAGER'].includes(role.toUpperCase());
  const [aanshAvailable, setAanshAvailable] = useState<{ aansh_id: number; system_name: string | null }[]>([]);
  const [aanshSession, setAanshSession] = useState<{
    session_token: string;
    aansh_id: number;
    expires_at: string;
  } | null>(null);
  const [aanshModalOpen, setAanshModalOpen] = useState(false);
  const [aanshLoading, setAanshLoading] = useState(false);
  const [aanshClaiming, setAanshClaiming] = useState(false);
  const whatsappFabEnabled = role && ['TELECALLER', 'RSA_MANAGER', 'LEAD_MANAGER'].includes(role.toUpperCase());
  const [waWorkspaceOpen, setWaWorkspaceOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const [waPreviewMessage, setWaPreviewMessage] = useState('');
  const [waUnreadCount, setWaUnreadCount] = useState(0);
  const [waRefreshSignal, setWaRefreshSignal] = useState(0);
  const waAssignedPhonesRef = useRef<Set<string>>(new Set());
  const headerRef = useRef<HTMLElement | null>(null);
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(64);

  useEffect(() => {
    checkAuth();
  }, []);

  // Keep sidebar glued under the real header height (avoids Tailwind/cache top-calc misses
  // that left only bottom-0 and made the menu float in the lower half).
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      // Guard against bad measurements pushing the rail halfway down the screen
      if (h > 0 && h < 160) setHeaderHeightPx(h);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [loading]);

  useEffect(() => {
    if (!waWorkspaceOpen) return;
    setSidebarCollapsed(true);
    const nav = sidebarNavRef.current;
    if (nav) nav.scrollTop = 0;
  }, [waWorkspaceOpen]);

  // Mobile / WebView: drawer overlays content — close on navigate; never push main aside
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch {
      setSidebarOpen(false);
    }
    // Leads / other pages must not stay hidden under WhatsApp overlay
    setWaWorkspaceOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (String(role || '').toUpperCase() !== 'WORKSHOP_SUPERVISOR') return;
    [
      '/dashboard/workshop-advisor',
      '/dashboard/workshop-advisor/pending-leads',
      '/dashboard/workshop-advisor/day-planning',
      '/dashboard/workshop-advisor/jobs',
      '/dashboard/workshop-advisor/qc-queue',
      '/dashboard/workshop-advisor/extra-work',
      '/dashboard/workshop-advisor/pickup-delivery',
      '/dashboard/workshop-advisor/team-overview',
      '/dashboard/workshop-advisor/profile',
      '/dashboard/workshop-advisor/readme',
    ].forEach((href) => router.prefetch(href));
  }, [role, router]);

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
      const last10 = d.slice(-10);
      if (last10.length === 10) return `91${last10}`;
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
      try {
        window.dispatchEvent(new CustomEvent('myfng:wa-unread-bump'));
      } catch {
        /* ignore */
      }
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
          const sender = normPhone(String(row.sender_phone || ''));
          const recipient = normPhone(String(row.recipient_phone || ''));
          const customerPhone = dir === 'INBOUND' ? sender : recipient || sender;
          // Refresh inbox for every new message (inbound + outbound/AI), not only inbound.
          setWaRefreshSignal((prev) => prev + 1);
          try {
            window.dispatchEvent(
              new CustomEvent('myfng:wa-message', {
                detail: { phone: customerPhone, direction: dir },
              }),
            );
          } catch {
            /* ignore */
          }
          if (dir !== 'INBOUND') return;
          setWaUnreadCount((prev) => prev + 1);
          try {
            window.dispatchEvent(new CustomEvent('myfng:wa-unread-bump'));
          } catch {
            /* ignore */
          }
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
    setWaPreviewPhone('');
    setWaPreviewMessage('');
    setWaWorkspaceOpen(true);
  }, [stopCallRing]);

  useEffect(() => {
    if (!whatsappFabEnabled) return;
    const onOpen = () => handleOpenWaList();
    const onOpenChat = (ev: Event) => {
      const detail = (ev as CustomEvent<{ phone?: string; preview?: string }>).detail || {};
      const phone = String(detail.phone || '').replace(/\D/g, '');
      setWaUnreadCount(0);
      stopCallRing();
      if (!phone) {
        handleOpenWaList();
        return;
      }
      setWaPreviewPhone(phone.length === 10 ? `91${phone}` : phone);
      setWaPreviewMessage(
        String(detail.preview || '').trim() ||
          'Namaste! MyFNG se baat kar rahe hain — aapki service request me help karenge.',
      );
      setWaWorkspaceOpen(true);
    };
    window.addEventListener('myfng:open-wa-inbox', onOpen);
    window.addEventListener('myfng:open-wa-chat', onOpenChat as EventListener);
    return () => {
      window.removeEventListener('myfng:open-wa-inbox', onOpen);
      window.removeEventListener('myfng:open-wa-chat', onOpenChat as EventListener);
    };
  }, [whatsappFabEnabled, handleOpenWaList, stopCallRing]);

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
      // Keep auth gate snappy — long waits make every login feel stuck on spinner.
      const AUTH_MS = 4500;
      let authUser: { id: string; email?: string | null; phone?: string | null } | null = null;

      try {
        const sessionRes = await withTimeout(supabase.auth.getSession(), AUTH_MS, 'auth.getSession');
        authUser = sessionRes?.data?.session?.user || null;
      } catch (sessionErr) {
        console.warn('auth.getSession slow/failed, retrying via getUser:', sessionErr);
      }

      if (!authUser) {
        try {
          const userRes = await withTimeout(supabase.auth.getUser(), AUTH_MS, 'auth.getUser');
          authUser = userRes?.data?.user || null;
        } catch (userErr) {
          console.warn('auth.getUser retry failed:', userErr);
        }
      }

      if (!authUser) {
        router.push('/login');
        return;
      }

      const selectProfile = `
          *,
          role:roles(role_code, role_name),
          workshop:workshops(*)
        `;

      const email = (authUser.email || '').trim();
      const phone = (authUser.phone || '').trim();

      // Parallel profile lookup — don't wait id then email then phone serially (was up to 24s).
      let profile: any = null;
      try {
        const lookups: PromiseLike<any>[] = [
          supabase.from('users_login').select(selectProfile).eq('id', authUser.id).maybeSingle(),
        ];
        if (email) {
          lookups.push(
            supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle(),
          );
        }
        if (phone) {
          lookups.push(
            supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle(),
          );
        }
        const results = await withTimeout(Promise.all(lookups), AUTH_MS, 'users_login profile');
        for (const r of results) {
          if (r?.data) {
            profile = r.data;
            break;
          }
        }
      } catch {
        profile = null;
      }

      if (profile) {
        if (profile.is_active === false) {
          await supabase.auth.signOut();
          logout();
          router.push('/login');
          return;
        }
        setUser(authUser);
        setUserProfile(profile);
        const roleCode = (profile?.role as any)?.role_code;
        if (roleCode) setRole(roleCode);

        // Only enforce role mismatch when a role prop was explicitly passed
        if (roleProp && roleCode) {
          const normalizedRole = String(roleProp).toLowerCase();
          const normalizedUserRole = String(roleCode).toLowerCase();
          const superAdminOverride = normalizedUserRole === 'super_admin';
          const retiredAppOpsAsLeadManager =
            normalizedUserRole === 'app_operations' && normalizedRole === 'lead_manager';
          if (
            !superAdminOverride &&
            !retiredAppOpsAsLeadManager &&
            !dashboardRolesMatch(roleProp, roleCode) &&
            normalizedRole !== 'sub_admin' &&
            normalizedRole !== 'subadmin'
          ) {
            router.push(getRoleDashboardHome(roleCode));
          }
        }
      } else {
        setUser(authUser);
      }
    } catch (error) {
      console.warn('Auth check failed:', error);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.user) {
          router.push('/login');
        }
      } catch {
        // stay on page; user can refresh
      }
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
    // Header logout must punch out — otherwise Live Floor keeps showing On Floor
    const roleCode =
      String((userProfile as any)?.role?.role_code || role || '').toUpperCase() || '';
    if (roleCode === 'TELECALLER' || roleCode === 'LEAD_MANAGER') {
      try {
        const { ensureTelecallerPunchOutOnLogout } = await import(
          '@/lib/telecaller/ensurePunchInOnLogin'
        );
        await ensureTelecallerPunchOutOnLogout();
      } catch {
        /* continue logout */
      }
    }
    try {
      const { clearTelecallerCrmFilterPrefs } = await import('@/lib/telecaller/crmFilterPrefs');
      clearTelecallerCrmFilterPrefs();
    } catch {
      /* ignore */
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
    const roleCode = String(role || '').toUpperCase();
    if (!roleCode) {
      return [{ href: '/dashboard', icon: <Home className="w-5 h-5" />, label: 'Dashboard' }];
    }
    
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
        { href: '/dashboard/super_admin/click-to-call', icon: <Phone className="w-5 h-5" />, label: 'Click to Call' },
        {
          href: '/dashboard/super_admin/whatsapp-templates',
          icon: <MessageSquare className="w-5 h-5" />,
          label: 'WhatsApp',
          children: [
            { href: '/dashboard/super_admin/whatsapp-templates', icon: <MessageSquare className="w-5 h-5" />, label: 'WhatsApp Templates' },
            { href: '/dashboard/super_admin/whatsapp-dashboard', icon: <BarChart3 className="w-5 h-5" />, label: 'WhatsApp Dashboard' },
            { href: '/dashboard/super_admin/whatsapp-workflows', icon: <Activity className="w-5 h-5" />, label: 'Workflow Builder' },
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
        { href: '/dashboard/super_admin/recordings', icon: <Headphones className="w-5 h-5" />, label: 'Recordings' },
        {
          href: '/dashboard/super_admin/ai-suite',
          icon: <Sparkles className="w-5 h-5" />,
          label: 'AI Suite',
          children: [
            { href: '/dashboard/super_admin/ai-suite', icon: <Sparkles className="w-5 h-5" />, label: 'Overview' },
            { href: '/dashboard/super_admin/call-intelligence', icon: <Activity className="w-5 h-5" />, label: 'Call IQ' },
            { href: '/dashboard/super_admin/lead-iq', icon: <Sparkles className="w-5 h-5" />, label: 'Lead IQ' },
            { href: '/dashboard/super_admin/ai-suite/workflow', icon: <GitBranch className="w-5 h-5" />, label: 'Workflow' },
            { href: '/dashboard/super_admin/ai-suite/playbook', icon: <BookOpen className="w-5 h-5" />, label: 'Sales Playbook' },
          ],
        },
        { href: '/dashboard/super_admin/lead-tags', icon: <Tag className="w-5 h-5" />, label: 'Lead Tags' },
        { href: '/dashboard/super_admin/lead-statuses', icon: <CircleDot className="w-5 h-5" />, label: 'Lead Status' },
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
        { href: '/dashboard/workshop-advisor', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop-advisor/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
        { href: '/dashboard/workshop-advisor/pending-leads', icon: <Clock className="w-5 h-5" />, label: 'Lead Approval' },
        { href: '/dashboard/workshop-advisor/day-planning', icon: <Calendar className="w-5 h-5" />, label: 'Day Planning' },
        { href: '/dashboard/workshop-advisor/jobs', icon: <Wrench className="w-5 h-5" />, label: 'Jobs' },
        { href: '/dashboard/workshop-advisor/qc-queue', icon: <CheckCircle className="w-5 h-5" />, label: 'QC Queue' },
        { href: '/dashboard/workshop-advisor/extra-work', icon: <DollarSign className="w-5 h-5" />, label: 'Extra Jobs' },
        { href: '/dashboard/workshop-advisor/pickup-delivery', icon: <Truck className="w-5 h-5" />, label: 'Pickup' },
        { href: '/dashboard/workshop-advisor/additional-jobs-master', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Jobs Master' },
        { href: '/dashboard/workshop-advisor/team-overview', icon: <Users className="w-5 h-5" />, label: 'Team' },
        { href: '/dashboard/workshop-advisor/daily-report', icon: <FileText className="w-5 h-5" />, label: 'Daily Report' },
        { href: '/dashboard/workshop-advisor/analytics', icon: <TrendingUp className="w-5 h-5" />, label: 'Analytics' },
        { href: '/dashboard/workshop-advisor/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
        { href: '/dashboard/workshop-advisor/readme', icon: <BookOpen className="w-5 h-5" />, label: 'ReadMe' },
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
        { href: '/dashboard/lead_manager', icon: <Home className="w-5 h-5" />, label: 'Home' },
        { href: '/dashboard/lead_manager/leads', icon: <ClipboardList className="w-5 h-5" />, label: 'Leads' },
        { href: '/dashboard/lead_manager/recordings', icon: <Headphones className="w-5 h-5" />, label: 'Recordings' },
        {
          href: '/dashboard/lead_manager/ai-suite',
          icon: <Sparkles className="w-5 h-5" />,
          label: 'AI Suite',
          children: [
            { href: '/dashboard/lead_manager/ai-suite', icon: <Sparkles className="w-5 h-5" />, label: 'Overview' },
            { href: '/dashboard/lead_manager/call-intelligence', icon: <Activity className="w-5 h-5" />, label: 'Call IQ' },
            { href: '/dashboard/lead_manager/lead-iq', icon: <Sparkles className="w-5 h-5" />, label: 'Lead IQ' },
            { href: '/dashboard/lead_manager/ai-suite/workflow', icon: <GitBranch className="w-5 h-5" />, label: 'Workflow' },
            { href: '/dashboard/lead_manager/ai-suite/playbook', icon: <BookOpen className="w-5 h-5" />, label: 'Sales Playbook' },
          ],
        },
        { href: '/dashboard/lead_manager/followups', icon: <Clock className="w-5 h-5" />, label: 'Reminders' },
        {
          href: '#whatsapp',
          icon: <MessageCircle className="w-5 h-5" />,
          label: 'WhatsApp',
          action: 'open-wa-inbox',
        },
        { href: '/dashboard/lead_manager/team-whatsapp', icon: <MessageCircle className="w-5 h-5" />, label: 'Team WA' },
        { href: '/dashboard/lead_manager/floor', icon: <Activity className="w-5 h-5" />, label: 'Live floor' },
        {
          href: '/dashboard/lead_manager/login-activity',
          icon: <Clock className="w-5 h-5" />,
          label: 'Login activity',
        },
        { href: '/dashboard/lead_manager/whatsapp-dnd', icon: <AlertTriangle className="w-5 h-5" />, label: 'WA DND' },
        { href: '/dashboard/lead_manager/book', icon: <Phone className="w-5 h-5" />, label: 'Book' },
        { href: '/dashboard/lead_manager/assignment', icon: <FileText className="w-5 h-5" />, label: 'Assignment' },
        { href: '/dashboard/lead_manager/workshops', icon: <Building2 className="w-5 h-5" />, label: 'Workshops' },
        { href: '/dashboard/lead_manager/customer-insights', icon: <Smartphone className="w-5 h-5" />, label: 'App Customers' },
        { href: '/dashboard/lead_manager/workshop-proximity', icon: <MapPin className="w-5 h-5" />, label: 'Workshop Proximity' },
        { href: '/dashboard/lead_manager/membership-customers', icon: <Crown className="w-5 h-5" />, label: 'Membership Customers' },
        { href: '/dashboard/lead_manager/referral', icon: <Gift className="w-5 h-5" />, label: 'Refer & Rise' },
        { href: '/dashboard/lead_manager/escalations', icon: <AlertTriangle className="w-5 h-5" />, label: 'Escalations' },
        { href: '/dashboard/lead_manager/team', icon: <Users className="w-5 h-5" />, label: 'Team' },
        {
          href: '/dashboard/lead_manager/telecallers',
          icon: <UserPlus className="w-5 h-5" />,
          label: 'Telecaller IDs',
        },
        { href: '/dashboard/lead_manager/click-to-call', icon: <Phone className="w-5 h-5" />, label: 'Click to Call' },
        { href: '/dashboard/lead_manager/tags', icon: <Tag className="w-5 h-5" />, label: 'Lead tags' },
        { href: '/dashboard/lead_manager/statuses', icon: <CircleDot className="w-5 h-5" />, label: 'Lead status' },
        {
          href: '/dashboard/lead_manager/templates',
          icon: <MessageSquare className="w-5 h-5" />,
          label: 'Msg Templates',
          children: [
            { href: '/dashboard/lead_manager/templates', icon: <Phone className="w-5 h-5" />, label: 'Call scripts' },
            {
              href: '/dashboard/lead_manager/templates?tab=whatsapp',
              icon: <MessageSquare className="w-5 h-5" />,
              label: 'WhatsApp templates',
            },
          ],
        },
        { href: '/dashboard/lead_manager/reports/pipeline', icon: <BarChart3 className="w-5 h-5" />, label: 'Pipeline' },
        {
          href: '/dashboard/lead_manager/reports',
          icon: <TrendingUp className="w-5 h-5" />,
          label: 'Reports',
          children: [
            { href: '/dashboard/lead_manager/reports', icon: <TrendingUp className="w-5 h-5" />, label: 'Overview' },
            { href: '/dashboard/lead_manager/reports/leaderboard', icon: <TrendingUp className="w-5 h-5" />, label: 'Leaderboard' },
            { href: '/dashboard/lead_manager/reports/calls', icon: <Phone className="w-5 h-5" />, label: 'Call activity' },
            { href: '/dashboard/lead_manager/reports/exports', icon: <Download className="w-5 h-5" />, label: 'Exports' },
            { href: '/dashboard/lead_manager/reports/duplicates', icon: <Users className="w-5 h-5" />, label: 'Duplicates' },
          ],
        },
        { href: '/dashboard/lead_manager/readme', icon: <BookOpen className="w-5 h-5" />, label: 'ReadMe' },
        { href: '/dashboard/lead_manager/me', icon: <User className="w-5 h-5" />, label: 'My Profile' },
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
        { href: '/dashboard/telecaller/followups', icon: <Clock className="w-5 h-5" />, label: 'Reminders' },
        {
          href: '#whatsapp',
          icon: <MessageCircle className="w-5 h-5" />,
          label: 'WhatsApp',
          action: 'open-wa-inbox',
        },
        { href: '/dashboard/telecaller/book', icon: <Phone className="w-5 h-5" />, label: 'Book' },
        { href: '/dashboard/telecaller/dialer', icon: <PhoneCall className="w-5 h-5" />, label: 'Dialer' },
        { href: '/dashboard/telecaller/workshops', icon: <MapPin className="w-5 h-5" />, label: 'Workshops' },
        {
          href: '/dashboard/telecaller/templates',
          icon: <MessageSquare className="w-5 h-5" />,
          label: 'Call scripts',
        },
        {
          href: '/dashboard/telecaller/reports',
          icon: <BarChart3 className="w-5 h-5" />,
          label: 'Reports',
          children: [
            { href: '/dashboard/telecaller/reports', icon: <BarChart3 className="w-5 h-5" />, label: 'Overview' },
            { href: '/dashboard/telecaller/reports/leaderboard', icon: <TrendingUp className="w-5 h-5" />, label: 'Your leaderboard' },
            { href: '/dashboard/telecaller/reports/calls', icon: <Phone className="w-5 h-5" />, label: 'Call activity' },
            { href: '/dashboard/telecaller/reports/duplicates', icon: <Users className="w-5 h-5" />, label: 'Duplicates' },
          ],
        },
        { href: '/dashboard/telecaller/me', icon: <User className="w-5 h-5" />, label: 'My Profile' },
        { href: '/dashboard/telecaller/readme', icon: <BookOpen className="w-5 h-5" />, label: 'ReadMe' },
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
      { href: `/dashboard/${roleCode.toLowerCase()}`, icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
      { href: `/dashboard/${roleCode.toLowerCase()}/profile`, icon: <Users className="w-5 h-5" />, label: 'Profile' },
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

  return (
    <div className="admin-shell">
      {/* Header */}
      <header ref={headerRef} className="admin-header">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <Link href={getRoleDashboardHome(role || 'lead_manager')} className="flex items-center min-w-0">
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
            <ReminderHeaderIcon />
            <NotificationBell />
            
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="text-right hidden md:block min-w-0">
                <p className="font-medium text-xs sm:text-sm truncate max-w-[120px] lg:max-w-[160px]">{userProfile?.full_name}</p>
                <p className="text-xs text-gray-500 truncate max-w-[120px] lg:max-w-[160px]">
                  {workshopRoleLabel || userProfile?.role?.role_name}
                </p>
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
          if (waWorkspaceOpen) return;
          if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarCollapsed(false);
        }}
        onMouseLeave={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarCollapsed(true);
        }}
        style={{
          position: 'fixed',
          left: 0,
          // When WhatsApp is open it is top:0 — keep the rail aligned to the same top
          // so icons are not floating mid-screen under an empty gap.
          top: waWorkspaceOpen ? 0 : headerHeightPx,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
        }}
        className={`bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 shadow-2xl transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 w-[min(18rem,85vw)] sm:w-64 ${
          waWorkspaceOpen || sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${waWorkspaceOpen ? 'z-[10001]' : 'z-30'} ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav
          ref={sidebarNavRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-2"
          style={{
            display: 'block',
            marginTop: 0,
            paddingTop: undefined,
            alignContent: 'start',
          }}
        >
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
                      <span className={`${sidebarCollapsed ? 'lg:hidden' : ''} min-w-0 leading-snug break-words`}>{item.label}</span>
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
                item.action === 'open-wa-inbox' ? (
                  <button
                    key={item.label}
                    type="button"
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('myfng:open-wa-inbox'));
                      try {
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      } catch {
                        setSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base ${
                      waWorkspaceOpen || sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
                    } ${
                      waWorkspaceOpen
                        ? 'bg-[#25D366] text-white font-semibold shadow-lg hover:bg-[#1ebe5c]'
                        : 'text-white hover:bg-blue-500/30 font-medium'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className={`${waWorkspaceOpen || sidebarCollapsed ? 'lg:hidden' : ''} min-w-0 leading-snug break-words`}>
                      {item.label}
                    </span>
                    {waUnreadCount > 0 ? (
                      <span
                        className={`${waWorkspaceOpen || sidebarCollapsed ? 'lg:hidden' : ''} ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white`}
                      >
                        {waUnreadCount > 99 ? '99+' : waUnreadCount}
                      </span>
                    ) : null}
                  </button>
                ) : (
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
                )
              );
            })}
        </nav>
        <div className="shrink-0 border-t border-blue-500/30 p-2 sm:p-3 md:p-4">
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base text-white hover:bg-red-500/30 font-medium ${
              sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`${sidebarCollapsed ? 'lg:hidden' : ''} truncate`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main: padding (not margin) so width:100% is not clipped on the right */}
      <main
        className="admin-main min-h-[100dvh] w-full max-w-full pb-[env(safe-area-inset-bottom)] lg:pl-20"
        style={{ paddingTop: headerHeightPx }}
      >
        <div className="admin-page dashboard-page">{children}</div>
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
          {!waWorkspaceOpen ? (
            <button
              type="button"
              onClick={handleOpenWaList}
              title="WhatsApp inbox"
              aria-label="Open WhatsApp inbox"
              className="fixed z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition hover:scale-[1.05] hover:bg-[#1ebe5c] bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]"
            >
              <WhatsAppIcon className="h-7 w-7" />
              {waUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow-lg ring-2 ring-white animate-bounce">
                  {waUnreadCount > 99 ? '99+' : waUnreadCount}
                </span>
              )}
            </button>
          ) : null}
          <WhatsAppWebWorkspace
            isOpen={waWorkspaceOpen}
            title="WhatsApp"
            refreshSignal={waRefreshSignal}
            hideLeadPool={role?.toUpperCase() === 'TELECALLER'}
            showAssigneeFilter={['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(
              String(role || '').toUpperCase(),
            )}
            initialPhone={waPreviewPhone}
            initialPreview={waPreviewMessage}
            onClose={() => {
              setWaWorkspaceOpen(false);
              setWaPreviewPhone('');
              setWaPreviewMessage('');
            }}
          />
        </>
      ) : null}

      {['TELECALLER', 'LEAD_MANAGER'].includes(role.toUpperCase()) ? (
        <IncomingClickToCallBanner />
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
      <span className={`${collapsed ? 'lg:hidden' : ''} min-w-0 leading-snug break-words`}>{children}</span>
    </Link>
  );
}

