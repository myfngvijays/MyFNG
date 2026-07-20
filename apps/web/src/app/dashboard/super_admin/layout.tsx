'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import {
  LayoutDashboard,
  Users,
  Store,
  Building2,
  DollarSign,
  Settings,
  BarChart3,
  Shield,
  Activity,
  LogOut,
  Menu,
  X,
  ChevronRight,
  FileText,
  Package,
  Tags,
  MapPin,
  AlertTriangle,
  History,
  FileCheck,
  ClipboardCheck,
  Wrench,
  Car,
  Globe,
  Bot,
  MessageSquare,
  Image as ImageIcon,
  Megaphone,
  Ticket,
  ClipboardList,
  Bell,
  Send,
  Flame,
  Star,
  Crown,
  Sparkles,
  Smartphone,
  Wallet,
  Coins,
  Timer,
  PanelBottom,
  TrendingUp,
  HelpCircle,
  LineChart,
  Gift,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  HeartPulse,
} from 'lucide-react';

type NavItem = {
  name: string;
  isSection?: boolean;
  href?: string;
  icon?: any;
  description?: string;
  children?: Array<{ name: string; href: string; icon: any; description: string }>;
};

const navigationItems: NavItem[] = [
  {
    name: 'Overview',
    isSection: true,
  },
  {
    name: 'Dashboard',
    href: '/dashboard/super_admin',
    icon: LayoutDashboard,
    description: 'Overview & Metrics'
  },
  {
    name: 'Operations',
    isSection: true,
  },
  {
    name: 'Workshops',
    href: '/dashboard/super_admin/workshops',
    icon: Building2,
    description: 'Workshop Management'
  },
  {
    name: 'Bookings & Leads',
    href: '/dashboard/super_admin/bookings',
    icon: ClipboardList,
    description: 'Service Leads & AI Bookings'
  },
  {
    name: 'RSA',
    href: '/dashboard/super_admin/rsa',
    icon: AlertTriangle,
    description: 'RSA tools & mappings'
  },
  {
    name: 'Telecaller Distribution',
    href: '/dashboard/super_admin/telecaller-distribution',
    icon: Users,
    description: 'Auto-assignment allocation settings'
  },
  {
    name: 'Manual Invoice',
    href: '/dashboard/super_admin/manual-invoices',
    icon: FileText,
    description: 'CSV upload & manual invoices'
  },
  {
    name: 'Catalog & Pricing',
    isSection: true,
  },
  {
    name: 'Products & Inventory',
    href: '/dashboard/super_admin/inventory/products',
    icon: Package,
    description: 'Manage Master Products'
  },
  {
    name: 'Service Packages',
    href: '/dashboard/super_admin/inventory/packages',
    icon: Wrench,
    description: 'Manage Service Packages'
  },
  {
    name: 'Additional Jobs Master',
    href: '/dashboard/super_admin/additional-jobs-master',
    icon: ClipboardCheck,
    description: 'Manage workshop-wise additional jobs'
  },
  {
    name: 'Workshop Pricing',
    href: '/dashboard/super_admin/inventory/pricing',
    icon: Tags,
    description: 'Manage Product Prices'
  },
  {
    name: 'Service Pricing',
    href: '/dashboard/super_admin/inventory/service-pricing',
    icon: Tags,
    description: 'Manage Service Type Prices'
  },
  {
    name: 'Zones',
    href: '/dashboard/super_admin/inventory/zones',
    icon: MapPin,
    description: 'Manage Zones'
  },
  {
    name: 'Mobile App',
    isSection: true,
  },
  {
    name: 'App Customers',
    icon: Smartphone,
    description: 'App users & membership holders',
    children: [
      {
        name: 'Customers',
        href: '/dashboard/super_admin/customer-insights',
        icon: Smartphone,
        description: 'App users, bookings & wallet',
      },
      {
        name: 'Membership Customers',
        href: '/dashboard/super_admin/membership-customers',
        icon: Crown,
        description: 'Prime members — plans & benefits',
      },
    ],
  },
  {
    name: 'App Content & Display',
    icon: Smartphone,
    description: 'Banners, carousel, reviews & footer',
    children: [
      {
        name: 'Home Carousel Images',
        href: '/dashboard/super_admin/website-images/home-carousel',
        icon: ImageIcon,
        description: 'Top hero carousel banners',
      },
      {
        name: 'Promo Banners',
        href: '/dashboard/super_admin/website-images/promo-banners',
        icon: Megaphone,
        description: 'Loan, E-Challan, Fuel, Sell Car etc.',
      },
      {
        name: 'Customer Reviews',
        href: '/dashboard/super_admin/website-images/customer-reviews',
        icon: Star,
        description: 'Home screen reviews',
      },
      {
        name: 'App Footer Content',
        href: '/dashboard/super_admin/app-footer',
        icon: PanelBottom,
        description: 'Headline & stats at bottom of screens',
      },
    ],
  },
  {
    name: 'Membership',
    icon: Crown,
    description: 'Cards, plans & terms',
    children: [
      {
        name: 'Membership Cards',
        href: '/dashboard/super_admin/membership-cards',
        icon: Crown,
        description: 'Animated promo cards & placements',
      },
      {
        name: 'Membership Plans',
        href: '/dashboard/super_admin/membership-plans',
        icon: Crown,
        description: 'Prime tiers, pricing & benefits (app + web)',
      },
      {
        name: 'Membership T&C',
        href: '/dashboard/super_admin/membership-terms',
        icon: Crown,
        description: 'RSA & Prime terms (app + website)',
      },
    ],
  },
  {
    name: 'Wallet & Offers',
    icon: Wallet,
    description: 'Wallet, referrals & post-booking',
    children: [
      {
        name: 'Post-Booking Prime Offer',
        href: '/dashboard/super_admin/post-booking-membership',
        icon: Timer,
        description: 'Timer upsell after booking & settings',
      },
      {
        name: 'Wallet Logic',
        href: '/dashboard/super_admin/wallet-logic',
        icon: Wallet,
        description: 'Service %, membership %, welcome bonus',
      },
      {
        name: 'Wallet Credits',
        href: '/dashboard/super_admin/wallet-credits?section=bulk',
        icon: Coins,
        description: 'Bulk add wallet balance to selected users',
      },
      {
        name: 'Refer & Earn',
        href: '/dashboard/super_admin/referral',
        icon: Gift,
        description: 'Referral rewards, friend bonus & activity',
      },
    ],
  },
  {
    name: 'Advance Coupon Management',
    href: '/dashboard/super_admin/advance-coupons',
    icon: Ticket,
    description: 'PCMS — campaigns & automation',
  },
  {
    name: 'App Popups',
    href: '/dashboard/super_admin/app-popups',
    icon: Megaphone,
    description: 'Create & manage app popups',
  },
  {
    name: 'App Settings Menu',
    href: '/dashboard/super_admin/app-settings-menu',
    icon: Smartphone,
    description: 'Toggle app menu items on/off',
  },
  {
    name: 'Push Notifications',
    icon: Bell,
    description: 'FCM admin console',
    children: [
      {
        name: 'Push Dashboard',
        href: '/dashboard/super_admin/advance-notifications?section=dashboard',
        icon: LayoutDashboard,
        description: 'Devices & broadcast KPIs',
      },
      {
        name: 'Firebase Settings',
        href: '/dashboard/super_admin/advance-notifications?section=firebase',
        icon: Flame,
        description: 'FCM credentials',
      },
      {
        name: 'Send Notification',
        href: '/dashboard/super_admin/advance-notifications?section=compose',
        icon: Send,
        description: 'Compose & broadcast',
      },
      {
        name: 'Notification History',
        href: '/dashboard/super_admin/advance-notifications?section=history',
        icon: History,
        description: 'Delivery logs',
      },
    ],
  },
  {
    name: 'Smart Tools',
    icon: Sparkles,
    description: 'Smart tools config & data',
    children: [
      {
        name: 'Smart Tools Handler',
        href: '/dashboard/super_admin/smart-tools',
        icon: Wrench,
        description: 'Enable, order & membership-gate tools',
      },
      {
        name: 'Smart Health Check Reports',
        href: '/dashboard/super_admin/vehicle-health-reports',
        icon: Activity,
        description: 'Health checkup reports from app',
      },
      {
        name: 'Car Resale Value',
        href: '/dashboard/super_admin/car-resale-valuations',
        icon: TrendingUp,
        description: 'Resale estimates from app',
      },
    ],
  },
  {
    name: 'App + Website',
    isSection: true,
  },
  {
    name: 'Analytics',
    href: '/dashboard/super_admin/analytics-hub?section=overview',
    icon: LineChart,
    description: 'Firebase GA4, Clarity — Android, iOS & Web',
  },
  {
    name: 'Shared Content',
    icon: Globe,
    description: 'Brands, vehicles & FAQs',
    children: [
      {
        name: 'Car Brand Images',
        href: '/dashboard/super_admin/brands',
        icon: Car,
        description: 'Brand logos (app carousel + website)',
      },
      {
        name: 'Vehicle Images',
        href: '/dashboard/super_admin/website-images/vehicle-images',
        icon: Car,
        description: 'Vehicle model images (app profile)',
      },
      {
        name: 'FAQs (App + Web)',
        href: '/dashboard/super_admin/public-faqs',
        icon: HelpCircle,
        description: 'General, service & RSA FAQs',
      },
      {
        name: 'Advanced SEO',
        href: '/dashboard/super_admin/site-seo',
        icon: Search,
        description: 'Website page titles, meta & OG tags',
      },
    ],
  },
  {
    name: 'Admin Users',
    isSection: true,
  },
  {
    name: 'Users & Roles',
    href: '/dashboard/super_admin/users',
    icon: Users,
    description: 'User & Role Management'
  },
  {
    name: 'Role Permissions',
    href: '/dashboard/super_admin/roles',
    icon: Shield,
    description: 'View role access & permissions'
  },
  {
    name: 'Intelligence & Automation',
    isSection: true,
  },
  {
    name: 'MISA AI',
    icon: Bot,
    description: 'Dashboard, conversations, usage & billing',
    children: [
      {
        name: 'MISA Dashboard',
        href: '/dashboard/super_admin/misa-ai',
        icon: BarChart3,
        description: 'Usage, bookings, billing & performance',
      },
      {
        name: 'AI Learning Inbox',
        href: '/dashboard/super_admin/kb-questions',
        icon: MessageSquare,
        description: 'Review & add answers to KB',
      },
      {
        name: 'Admin AI Chat',
        href: '/dashboard/super_admin/admin-ai-chat',
        icon: Bot,
        description: 'Chat with MISA — MyFNG Instant Service Assistant',
      },
    ],
  },
  {
    name: 'WhatsApp',
    icon: MessageSquare,
    description: 'Dashboard, message, template & bot flow',
    children: [
      {
        name: 'WhatsApp Dashboard',
        href: '/dashboard/super_admin/whatsapp-dashboard',
        icon: BarChart3,
        description: 'Delivery & messaging overview',
      },
      {
        name: 'Message Logs',
        href: '/dashboard/super_admin/whatsapp-messages',
        icon: ClipboardList,
        description: 'Outbound messages, failures & export',
      },
      {
        name: 'WhatsApp Message',
        href: '/dashboard/super_admin/whatsapp-chat',
        icon: MessageSquare,
        description: 'Open WhatsApp style chat',
      },
      {
        name: 'WhatsApp Templates',
        href: '/dashboard/super_admin/whatsapp-templates',
        icon: MessageSquare,
        description: 'Create/manage WhatsApp templates',
      },
      {
        name: 'WhatsApp Automation',
        href: '/dashboard/super_admin/whatsapp-automation',
        icon: Send,
        description: 'Booking & lifecycle WhatsApp triggers',
      },
      {
        name: 'Bot Flow',
        href: '/dashboard/super_admin/bot-flow',
        icon: Bot,
        description: 'Configure WhatsApp bot flow',
      },
    ],
  },
  {
    name: 'System & Governance',
    isSection: true,
  },
  {
    name: 'System Monitor',
    href: '/dashboard/super_admin/system-monitor',
    icon: HeartPulse,
    description: 'Real-time health check & alerts'
  },
  {
    name: 'Audit Logs',
    href: '/dashboard/super_admin/audit-logs',
    icon: Activity,
    description: 'System Activity Tracking'
  },
  {
    name: 'Security Events',
    href: '/dashboard/super_admin/security-events',
    icon: AlertTriangle,
    description: 'Security Incidents & Events'
  },
  {
    name: 'Config Changes',
    href: '/dashboard/super_admin/config-changes',
    icon: History,
    description: 'System Configuration History'
  },
  {
    name: 'Compliance Reports',
    href: '/dashboard/super_admin/compliance-reports',
    icon: FileCheck,
    description: 'GDPR, SOC2, ISO27001 Reports'
  },
  {
    name: 'Finance',
    href: '/dashboard/super_admin/finance',
    icon: DollarSign,
    description: 'Payouts & Revenue'
  },
  {
    name: 'System Settings',
    href: '/dashboard/super_admin/settings',
    icon: Settings,
    description: 'System Configuration'
  },
  {
    name: 'Reports',
    href: '/dashboard/super_admin/reports',
    icon: BarChart3,
    description: 'Analytics & Reports'
  }
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isSiteSeoPage = pathname?.includes('/site-seo') ?? false;
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserClient(), []);
  const [authReady, setAuthReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Smart Tools': false,
    'App Content & Display': false,
    'Membership': false,
    'Wallet & Offers': false,
    'Push Notifications': false,
    'Shared Content': false,
    'App Customers': false,
    WhatsApp: false,
    'MISA AI': false,
  });

  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('users_login')
        .select('is_active, roles!inner(role_code)')
        .eq('id', user.id)
        .maybeSingle();
      const roleCode = String((profile?.roles as { role_code?: string } | null)?.role_code || '');
      if (!profile?.is_active || !roleCode) {
        router.replace('/login');
        return;
      }
      if (roleCode === 'APP_OPERATIONS') {
        router.replace('/dashboard/app_operations');
        return;
      }
      if (roleCode !== 'SUPER_ADMIN') {
        router.replace(`/dashboard/${roleCode.toLowerCase()}`);
        return;
      }
      if (active) setAuthReady(true);
    })();
    return () => { active = false; };
  }, [router, supabase]);

  React.useEffect(() => {
    if (
      pathname?.startsWith('/dashboard/super_admin/customer-insights') ||
      pathname?.startsWith('/dashboard/super_admin/membership-customers')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'App Customers': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/vehicle-health-reports') ||
      pathname?.startsWith('/dashboard/super_admin/car-resale-valuations') ||
      pathname?.startsWith('/dashboard/super_admin/smart-tools')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'Smart Tools': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/website-images/home-carousel') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/promo-banners') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/customer-reviews') ||
      pathname?.startsWith('/dashboard/super_admin/app-footer')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'App Content & Display': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/membership-cards') ||
      pathname?.startsWith('/dashboard/super_admin/membership-plans') ||
      pathname?.startsWith('/dashboard/super_admin/membership-terms')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'Membership': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/post-booking-membership') ||
      pathname?.startsWith('/dashboard/super_admin/wallet-logic') ||
      pathname?.startsWith('/dashboard/super_admin/wallet-credits') ||
      pathname?.startsWith('/dashboard/super_admin/referral')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'Wallet & Offers': true }));
    }
    if (pathname?.startsWith('/dashboard/super_admin/advance-notifications')) {
      setOpenGroups((prev) => ({ ...prev, 'Push Notifications': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/misa-ai') ||
      pathname?.startsWith('/dashboard/super_admin/kb-questions') ||
      pathname?.startsWith('/dashboard/super_admin/admin-ai-chat')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'MISA AI': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/brands') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/vehicle-images') ||
      pathname?.startsWith('/dashboard/super_admin/public-faqs') ||
      pathname?.startsWith('/dashboard/super_admin/site-seo')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'Shared Content': true }));
    }
  }, [pathname]);

  const flatNavItems = useMemo(() => {
    const items: Array<{ name: string; href: string; icon: any; description: string; parent?: string }> = [];
    for (const item of navigationItems) {
      if (item.isSection) continue;
      if (item.href) {
        items.push({ name: item.name, href: item.href, icon: item.icon, description: item.description || '' });
      }
      if (item.children) {
        for (const child of item.children) {
          items.push({ name: child.name, href: child.href, icon: child.icon, description: child.description, parent: item.name });
        }
      }
    }
    return items;
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return flatNavItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.parent && item.parent.toLowerCase().includes(q)),
    );
  }, [searchQuery, flatNavItems]);

  const handleSearchNav = useCallback((href: string) => {
    router.push(href);
    setSearchQuery('');
    setMobileMenuOpen(false);
  }, [router]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 150);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await supabase.auth.signOut();
      router.push('/login');
    }
  };

  const isActive = (href: string) => {
    const [path, queryString] = href.split('?');
    if (path === '/dashboard/super_admin') {
      return pathname === path;
    }
    if (!pathname?.startsWith(path)) return false;
    if (queryString) {
      const expected = new URLSearchParams(queryString);
      for (const [key, value] of expected.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
    }
    return true;
  };

  const isGroupActive = (item: NavItem) => {
    if (!item.children?.length) return false;
    return item.children.some((c) => isActive(c.href));
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${isSiteSeoPage ? 'bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/40' : 'bg-gray-50'}`}>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar - Desktop */}
      <aside
        onMouseEnter={() => { if (!sidebarPinned) setSidebarOpen(true); }}
        onMouseLeave={() => { if (!sidebarPinned) { setSidebarOpen(false); setSearchQuery(''); } }}
        className={`
          hidden lg:flex flex-col
          ${sidebarOpen ? 'w-72' : 'w-20'}
          bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 text-white
          transition-all duration-700 ease-in-out
          shadow-2xl
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-blue-400/30">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-8 h-8 text-yellow-300" />
                    <h1 className="text-xl font-bold text-white">MyFNG</h1>
                  </div>
                  <p className="text-yellow-200 text-sm mt-1 font-semibold">Super Admin Control Panel</p>
                </div>
                <button
                  onClick={() => {
                    if (sidebarPinned) {
                      setSidebarPinned(false);
                      setSidebarOpen(false);
                    } else {
                      setSidebarPinned(true);
                      setSidebarOpen(true);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-blue-500/40 transition-colors"
                  title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
                >
                  {sidebarPinned ? <PanelLeftClose className="w-5 h-5 text-blue-200" /> : <PanelLeftOpen className="w-5 h-5 text-blue-200" />}
                </button>
              </>
            ) : (
              <Shield className="w-8 h-8 mx-auto text-yellow-300" />
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-4 pb-1">
          {sidebarOpen ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu… (⌘K)"
                className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-white text-gray-800 text-sm placeholder:text-gray-400 border border-blue-300/50 focus:outline-none focus:ring-2 focus:ring-yellow-300/60 shadow-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setSidebarOpen(true); setTimeout(() => searchInputRef.current?.focus(), 150); }}
              className="w-full flex items-center justify-center py-2.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30"
            >
              <Search className="w-5 h-5 text-blue-200" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {sidebarOpen && searchQuery.trim() ? (
          <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-3">
            <div className="space-y-1">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-blue-200/70 text-sm">No results for &quot;{searchQuery}&quot;</div>
              ) : (
                searchResults.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleSearchNav(item.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                        active ? 'bg-white text-blue-700 shadow-lg font-semibold' : 'text-white hover:bg-blue-500/30'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                      <div className="flex-1 text-left">
                        <div className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-white'}`}>{item.name}</div>
                        <div className={`text-xs mt-0.5 ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                          {item.parent ? `${item.parent} › ` : ''}{item.description}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </nav>
        ) : (
        <nav className="flex-1 min-h-0 overflow-y-auto py-6 px-3">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              if (item.isSection) {
                return sidebarOpen ? (
                  <div key={`section-${item.name}`} className="px-3 pt-3 first:pt-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-100/85">
                      {item.name}
                    </div>
                  </div>
                ) : (
                  <div key={`section-${item.name}`} className="h-1.5" />
                );
              }

              const Icon = item.icon;
              const active = item.href ? isActive(item.href) : isGroupActive(item);

              // Dropdown group: Website Images / WhatsApp
              if (item.children?.length) {
                const isOpen = Boolean(openGroups[item.name]);
                return (
                  <div key={item.name} className="space-y-2">
                    <button
                      onClick={() => {
                        if (!sidebarOpen) {
                          // If collapsed, go to first child for faster access.
                          router.push(item.children![0].href);
                          return;
                        }
                        setOpenGroups((prev) => ({ ...prev, [item.name]: !prev[item.name] }));
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-blue-700 shadow-lg font-semibold'
                            : 'text-white hover:bg-blue-500/30'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                      {sidebarOpen && (
                        <div className="flex-1 text-left">
                          <div className={`font-semibold ${active ? 'text-blue-700' : 'text-white'}`}>
                            {item.name}
                          </div>
                          <div className={`text-xs mt-0.5 ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                            {item.description}
                          </div>
                        </div>
                      )}
                      {sidebarOpen ? (
                        <ChevronRight
                          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : ''} ${
                            active ? 'text-blue-700' : 'text-white'
                          }`}
                        />
                      ) : null}
                    </button>

                    {sidebarOpen && isOpen ? (
                      <div className="ml-2 space-y-2">
                        {item.children.map((c) => {
                          const ChildIcon = c.icon;
                          const childActive = isActive(c.href);
                          return (
                            <button
                              key={c.href}
                              onClick={() => router.push(c.href)}
                              className={`
                                w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                                transition-all duration-200
                                ${
                                  childActive
                                    ? 'bg-white text-blue-700 shadow font-semibold'
                                    : 'text-white hover:bg-blue-500/20'
                                }
                              `}
                            >
                              <ChildIcon className={`w-4 h-4 flex-shrink-0 ${childActive ? 'text-blue-700' : 'text-white'}`} />
                              <div className="flex-1 text-left">
                                <div className={`text-sm font-semibold ${childActive ? 'text-blue-700' : 'text-white'}`}>
                                  {c.name}
                                </div>
                                <div className={`text-xs mt-0.5 ${childActive ? 'text-blue-600' : 'text-blue-100'}`}>
                                  {c.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <button
                  key={item.href ?? item.name}
                  onClick={() => {
                    if (!item.href) return;
                    router.push(item.href);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-white text-blue-700 shadow-lg font-semibold'
                        : 'text-white hover:bg-blue-500/30'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                  {sidebarOpen && (
                    <div className="flex-1 text-left">
                      <div className={`font-semibold ${active ? 'text-blue-700' : 'text-white'}`}>
                        {item.name}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          active ? 'text-blue-600' : 'text-blue-100'
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
        )}

        {/* Logout Button */}
        <div className="p-4 border-t border-blue-400/30">
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg
              bg-red-600 hover:bg-red-700 transition-colors
              text-white font-semibold shadow-lg
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Mobile Menu */}
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 flex flex-col bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 text-white z-40 shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-blue-400/30">
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-yellow-300" />
                <div>
                  <h1 className="text-xl font-bold text-white">MyFNG</h1>
                  <p className="text-yellow-200 text-sm font-semibold">Super Admin Control Panel</p>
                </div>
              </div>
            </div>

            {/* Mobile Search */}
            <div className="px-3 pt-4 pb-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-200" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search menu…"
                  className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-blue-500/30 text-white text-sm placeholder:text-blue-200/70 border border-blue-400/30 focus:outline-none focus:ring-2 focus:ring-yellow-300/50 focus:bg-blue-500/40"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-blue-200 hover:text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Search Results */}
            {searchQuery.trim() ? (
              <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-3">
                <div className="space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-blue-200/70 text-sm">No results for &quot;{searchQuery}&quot;</div>
                  ) : (
                    searchResults.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <button
                          key={item.href}
                          onClick={() => handleSearchNav(item.href)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                            active ? 'bg-white text-blue-700 shadow-lg font-semibold' : 'text-white hover:bg-blue-500/30'
                          }`}
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                          <div className="flex-1 text-left">
                            <div className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-white'}`}>{item.name}</div>
                            <div className={`text-xs mt-0.5 ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                              {item.parent ? `${item.parent} › ` : ''}{item.description}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </nav>
            ) : (
            <nav className="flex-1 min-h-0 overflow-y-auto py-6 px-3">
              <div className="space-y-2">
                {navigationItems.map((item) => {
                  if (item.isSection) {
                    return (
                      <div key={`mobile-section-${item.name}`} className="px-3 pt-3 first:pt-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-100/85">
                          {item.name}
                        </div>
                      </div>
                    );
                  }

                  const Icon = item.icon;
              const active = item.href ? isActive(item.href) : isGroupActive(item);

              if (item.children?.length) {
                const isOpen = Boolean(openGroups[item.name]);
                return (
                  <div key={item.name} className="space-y-2">
                    <button
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [item.name]: !prev[item.name] }))}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-blue-700 shadow-lg font-semibold'
                            : 'text-white hover:bg-blue-500/30'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-white'}`} />
                      <div className="flex-1 text-left">
                        <div className={`font-semibold ${active ? 'text-blue-700' : 'text-white'}`}>
                          {item.name}
                        </div>
                        <div className={`text-xs mt-0.5 ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                          {item.description}
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {isOpen ? (
                      <div className="ml-2 space-y-2">
                        {item.children.map((c) => {
                          const ChildIcon = c.icon;
                          const childActive = isActive(c.href);
                          return (
                            <button
                              key={c.href}
                              onClick={() => {
                                router.push(c.href);
                                setMobileMenuOpen(false);
                              }}
                              className={`
                                w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                                transition-all duration-200
                                ${
                                  childActive
                                    ? 'bg-white text-blue-700 shadow font-semibold'
                                    : 'text-white hover:bg-blue-500/20'
                                }
                              `}
                            >
                              <ChildIcon className={`w-4 h-4 ${childActive ? 'text-blue-700' : 'text-white'}`} />
                              <div className="flex-1 text-left">
                                <div className={`text-sm font-semibold ${childActive ? 'text-blue-700' : 'text-white'}`}>
                                  {c.name}
                                </div>
                                <div className={`text-xs mt-0.5 ${childActive ? 'text-blue-600' : 'text-blue-100'}`}>
                                  {c.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

                  return (
                    <button
                      key={item.href ?? item.name}
                      onClick={() => {
                        if (!item.href) return;
                        router.push(item.href);
                        setMobileMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-blue-700 shadow-lg font-semibold'
                            : 'text-white hover:bg-blue-500/30'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-white'}`} />
                      <div className="flex-1 text-left">
                        <div className={`font-semibold ${active ? 'text-blue-700' : 'text-white'}`}>
                          {item.name}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            active ? 'text-blue-600' : 'text-blue-100'
                          }`}
                        >
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>
            )}

            {/* Logout Button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-400/30">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white font-semibold shadow-lg"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${isSiteSeoPage ? 'bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/40' : ''}`}>
        {children}
      </main>
    </div>
  );
}

