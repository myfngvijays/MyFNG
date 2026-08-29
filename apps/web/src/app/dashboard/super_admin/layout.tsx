'use client';

import React, { Suspense, useMemo, useState, useRef, useCallback } from 'react';
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
  MinusCircle,
  Settings2,
  Code2,
  List,
  Layers,
  Clock3,
  Link2,
  Workflow,
  PhoneCall,
  Headphones,
  Brain,
  Plug,
  BookOpen,
  Mail,
  Hash,
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
    name: 'Recordings',
    href: '/dashboard/super_admin/recordings',
    icon: Headphones,
    description: 'Call recordings play & search'
  },
  {
    name: 'AI Suite',
    href: '/dashboard/super_admin/ai-suite',
    icon: Sparkles,
    description: 'Call IQ, Lead IQ, Workflow, Sales Playbook',
    children: [
      { name: 'Overview', href: '/dashboard/super_admin/ai-suite', icon: Sparkles, description: 'Call IQ + Lead IQ hub' },
      { name: 'Call IQ', href: '/dashboard/super_admin/call-intelligence', icon: Brain, description: 'Sales SOP audit on calls' },
      { name: 'Lead IQ', href: '/dashboard/super_admin/lead-iq', icon: Sparkles, description: 'Lead brief, scripts, next move' },
      { name: 'Workflow', href: '/dashboard/super_admin/ai-suite/workflow', icon: Workflow, description: 'Recording → CRM status → SOP' },
      { name: 'Sales Playbook', href: '/dashboard/super_admin/ai-suite/playbook', icon: BookOpen, description: 'ICP, USPs, objections, prompts' },
    ],
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
    name: 'Click to Call',
    href: '/dashboard/super_admin/click-to-call',
    icon: PhoneCall,
    description: 'Smartflo gateway & telecaller from-numbers'
  },
  {
    name: 'Manual Invoice',
    href: '/dashboard/super_admin/manual-invoices',
    icon: FileText,
    description: 'CSV upload & manual invoices'
  },
  {
    name: 'Link Manager',
    href: '/dashboard/super_admin/link-manager',
    icon: Link2,
    description: 'Bitly-style short links, QR & tracking'
  },
  {
    name: 'Universal Link',
    href: '/dashboard/super_admin/universal-link',
    icon: Smartphone,
    description: 'App download smart link & iOS/Android analytics'
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
        name: 'Special Welcome Bonus',
        href: '/dashboard/super_admin/welcome-bonus-overrides',
        icon: Gift,
        description: '₹1500 override list — login & credit status',
      },
      {
        name: 'Workshop Proximity',
        href: '/dashboard/super_admin/workshop-proximity',
        icon: MapPin,
        description: 'Walk-in alerts near service centers',
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
    description: 'Banners, carousel, reviews, popups & footer',
    children: [
      {
        name: 'App Popups',
        href: '/dashboard/super_admin/app-popups',
        icon: Megaphone,
        description: 'Create & manage app popups',
      },
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
        name: 'RSA Hero Banner',
        href: '/dashboard/super_admin/website-images/rsa-hero',
        icon: AlertTriangle,
        description: 'RSA landing / hero image',
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
        name: 'Bulk Credit',
        href: '/dashboard/super_admin/wallet-credits?section=bulk',
        icon: Coins,
        description: 'Bulk add wallet balance',
      },
      {
        name: 'Bulk Debit',
        href: '/dashboard/super_admin/wallet-credits?section=debit',
        icon: MinusCircle,
        description: 'Bulk remove wallet balance',
      },
      {
        name: 'Wallet Credit History',
        href: '/dashboard/super_admin/wallet-credits?section=history',
        icon: History,
        description: 'Audit trail & CSV export',
      },
      {
        name: 'Refer & Rise',
        href: '/dashboard/super_admin/refer-and-rise',
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
        name: 'Templates',
        href: '/dashboard/super_admin/advance-notifications?section=templates',
        icon: FileText,
        description: 'Manual + automation copy',
      },
      {
        name: 'Send Notification',
        href: '/dashboard/super_admin/advance-notifications?section=compose',
        icon: Send,
        description: 'Compose & broadcast',
      },
      {
        name: 'Advanced Send',
        href: '/dashboard/super_admin/advance-notifications?section=advanced',
        icon: Sparkles,
        description: 'City, membership & phone targeting',
      },
      {
        name: 'Campaigns',
        href: '/dashboard/super_admin/advance-notifications?section=campaigns',
        icon: Timer,
        description: 'Scheduled + A/B campaigns',
      },
      {
        name: 'Notification History',
        href: '/dashboard/super_admin/advance-notifications?section=history',
        icon: History,
        description: 'Delivery & open/click logs',
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
    icon: LineChart,
    description: 'Firebase GA4, Clarity — Android, iOS & Web',
    children: [
      {
        name: 'Overview',
        href: '/dashboard/super_admin/analytics-hub?section=overview',
        icon: LineChart,
        description: 'Android, iOS & Web status',
      },
      {
        name: 'Platforms',
        href: '/dashboard/super_admin/analytics-hub?section=platforms',
        icon: Layers,
        description: 'Per-platform tracking',
      },
      {
        name: 'Events',
        href: '/dashboard/super_admin/analytics-hub?section=events',
        icon: List,
        description: 'Tracked events catalog',
      },
      {
        name: 'Live Data',
        href: '/dashboard/super_admin/analytics-hub?section=live',
        icon: Activity,
        description: 'Real-time GA4 metrics',
      },
      {
        name: 'Settings',
        href: '/dashboard/super_admin/analytics-hub?section=settings',
        icon: Settings2,
        description: 'Firebase GA4 & Clarity IDs',
      },
      {
        name: 'Code Reference',
        href: '/dashboard/super_admin/analytics-hub?section=code',
        icon: Code2,
        description: 'Files & tracking reference',
      },
    ],
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
    description: 'Create roles & manage permissions'
  },
  {
    name: 'Fraud Cases',
    href: '/dashboard/super_admin/fraud',
    icon: AlertTriangle,
    description: 'Fraud alerts & case review'
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
        name: 'WhatsApp Settings',
        href: '/dashboard/super_admin/whatsapp-settings',
        icon: Settings2,
        description: 'WABA, token, app secret & webhook keys',
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
        name: 'Workflow Builder',
        href: '/dashboard/super_admin/whatsapp-workflows',
        icon: Workflow,
        description: 'Visual WhatsApp bot / workflow canvas',
      },
      {
        name: 'WhatsApp Cron',
        href: '/dashboard/super_admin/whatsapp-cron',
        icon: Clock3,
        description: 'Supabase cron jobs, times & run now',
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
    name: 'DLT SMS',
    icon: Mail,
    description: 'TRAI DLT headers, templates & SMS gateway',
    children: [
      {
        name: 'DLT Dashboard',
        href: '/dashboard/super_admin/dlt-sms?section=dashboard',
        icon: LayoutDashboard,
        description: 'Entity, header & template counts',
      },
      {
        name: 'Entity',
        href: '/dashboard/super_admin/dlt-sms?section=entity',
        icon: Building2,
        description: 'PE ID, operator & approval status',
      },
      {
        name: 'Header SMS',
        href: '/dashboard/super_admin/dlt-sms?section=headers',
        icon: Hash,
        description: 'Sender IDs (MYFNG / TRANS / PROMO)',
      },
      {
        name: 'Consent Templates',
        href: '/dashboard/super_admin/dlt-sms?section=consent',
        icon: FileText,
        description: 'Promotional consent templates',
      },
      {
        name: 'Content Templates',
        href: '/dashboard/super_admin/dlt-sms?section=content',
        icon: MessageSquare,
        description: 'DLT-approved SMS bodies',
      },
      {
        name: 'Own SMS pipe',
        href: '/dashboard/super_admin/dlt-sms?section=telemarketers',
        icon: Plug,
        description: 'Own Jio/Airtel operator HTTP pipe',
      },
      {
        name: 'CTA Whitelisting',
        href: '/dashboard/super_admin/dlt-sms?section=cta',
        icon: Link2,
        description: 'URLs and numbers in SMS',
      },
      {
        name: 'Send SMS',
        href: '/dashboard/super_admin/dlt-sms?section=compose',
        icon: Send,
        description: 'Test send with approved template',
      },
      {
        name: 'Transaction History',
        href: '/dashboard/super_admin/dlt-sms?section=history',
        icon: History,
        description: 'SMS delivery logs',
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
    name: 'API Services Map',
    href: '/dashboard/super_admin/api-services',
    icon: Layers,
    description: 'Free vs paid APIs & admin menu dependencies'
  },
  {
    name: 'MyFNG MCP',
    href: '/dashboard/super_admin/myfng-mcp',
    icon: Plug,
    description: 'Read-only MCP package — tools catalog & setup',
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
  // Next.js requires useSearchParams() to be wrapped in Suspense during prerender.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-sm text-gray-500">Loading…</div>
        </div>
      }
    >
      <SuperAdminLayoutInner>{children}</SuperAdminLayoutInner>
    </Suspense>
  );
}

function SuperAdminLayoutInner({
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
    Analytics: false,
    WhatsApp: false,
    'MISA AI': false,
  });

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        let profile: any = null;
        const { data: byId } = await supabase
          .from('users_login')
          .select('is_active, email, roles!inner(role_code)')
          .eq('id', user.id)
          .maybeSingle();
        profile = byId;
        if (!profile && user.email) {
          const { data: byEmail } = await supabase
            .from('users_login')
            .select('is_active, email, roles!inner(role_code)')
            .ilike('email', user.email)
            .maybeSingle();
          profile = byEmail;
        }
        const roleCode = String((profile?.roles as { role_code?: string } | null)?.role_code || '');
        if (!profile?.is_active || !roleCode) {
          router.replace('/login');
          return;
        }
        if (roleCode === 'APP_OPERATIONS') {
          router.replace('/dashboard/lead_manager');
          return;
        }
        if (roleCode !== 'SUPER_ADMIN') {
          const { getRoleDashboardHome } = await import('@/lib/dashboard/roleHome');
          router.replace(getRoleDashboardHome(roleCode));
          return;
        }
        if (active) setAuthReady(true);
      } catch {
        if (active) router.replace('/login');
      }
    })();
    return () => { active = false; };
  }, [router, supabase]);

  React.useEffect(() => {
    if (
      pathname?.startsWith('/dashboard/super_admin/customer-insights') ||
      pathname?.startsWith('/dashboard/super_admin/welcome-bonus-overrides') ||
      pathname?.startsWith('/dashboard/super_admin/workshop-proximity') ||
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
      pathname?.startsWith('/dashboard/super_admin/app-popups') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/home-carousel') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/promo-banners') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/customer-reviews') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/rsa-hero') ||
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
      pathname?.startsWith('/dashboard/super_admin/refer-and-rise') ||
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
    if (pathname?.startsWith('/dashboard/super_admin/analytics-hub')) {
      setOpenGroups((prev) => ({ ...prev, Analytics: true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/whatsapp-') ||
      pathname?.startsWith('/dashboard/super_admin/bot-flow') ||
      pathname?.startsWith('/dashboard/super_admin/whatsapp-workflows')
    ) {
      setOpenGroups((prev) => ({ ...prev, WhatsApp: true }));
    }
    if (pathname?.startsWith('/dashboard/super_admin/dlt-sms')) {
      setOpenGroups((prev) => ({ ...prev, 'DLT SMS': true }));
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
      try {
        const { clearTelecallerCrmFilterPrefs } = await import('@/lib/telecaller/crmFilterPrefs');
        clearTelecallerCrmFilterPrefs();
      } catch {
        /* ignore */
      }
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
    <div
      className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden ${
        isSiteSeoPage ? 'bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/40' : 'bg-gray-50'
      }`}
      style={{
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Mobile top bar */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <img src="/logo.png" alt="MyFNG" className="h-8 w-auto object-contain" />
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop: menu scrolls in the middle; logout always pinned at bottom */}
      <aside
        onMouseEnter={() => { if (!sidebarPinned) setSidebarOpen(true); }}
        onMouseLeave={() => { if (!sidebarPinned) { setSidebarOpen(false); setSearchQuery(''); } }}
        className={`
          hidden lg:flex flex-col h-full min-h-0 overflow-hidden
          ${sidebarOpen ? 'w-72' : 'w-20'}
          bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 text-white
          transition-all duration-700 ease-in-out
          shadow-2xl
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-blue-400/30">
          <div className="flex items-center justify-between gap-2">
            {sidebarOpen ? (
              <>
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm">
                    <img
                      src="/logo.png"
                      alt="MyFNG"
                      className="h-9 w-auto max-w-[140px] object-contain"
                    />
                  </div>
                  <p className="text-yellow-200 text-sm mt-2 font-semibold">Super Admin Control Panel</p>
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
                  className="p-1.5 rounded-lg hover:bg-blue-500/40 transition-colors shrink-0"
                  title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
                >
                  {sidebarPinned ? <PanelLeftClose className="w-5 h-5 text-blue-200" /> : <PanelLeftOpen className="w-5 h-5 text-blue-200" />}
                </button>
              </>
            ) : (
              <div className="mx-auto rounded-xl bg-white p-1.5 shadow-sm">
                <img src="/logo.png" alt="MyFNG" className="h-8 w-8 object-contain" />
              </div>
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
        <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
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
                  <div key={item.name} className="space-y-1">
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
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-blue-700 shadow-lg font-semibold'
                            : 'text-white hover:bg-blue-500/30'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                      {sidebarOpen && (
                        <div className="min-w-0 flex-1 text-left">
                          <div className={`font-semibold truncate ${active ? 'text-blue-700' : 'text-white'}`}>
                            {item.name}
                          </div>
                          <div className={`text-xs mt-0.5 truncate ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                            {item.description}
                          </div>
                        </div>
                      )}
                      {sidebarOpen ? (
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''} ${
                            active ? 'text-blue-700' : 'text-white'
                          }`}
                        />
                      ) : null}
                    </button>

                    {sidebarOpen && isOpen ? (
                      <div className="ml-4 border-l border-white/25 pl-2 space-y-1">
                        {item.children.map((c) => {
                          const ChildIcon = c.icon;
                          const childActive = isActive(c.href);
                          return (
                            <button
                              key={c.href}
                              onClick={() => router.push(c.href)}
                              className={`
                                w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                                transition-all duration-200
                                ${
                                  childActive
                                    ? 'bg-white text-blue-700 shadow font-semibold'
                                    : 'text-white hover:bg-blue-500/20'
                                }
                              `}
                            >
                              <ChildIcon className={`w-4 h-4 shrink-0 ${childActive ? 'text-blue-700' : 'text-white'}`} />
                              <div className="min-w-0 flex-1 text-left">
                                <div className={`text-sm font-semibold truncate ${childActive ? 'text-blue-700' : 'text-white'}`}>
                                  {c.name}
                                </div>
                                <div className={`text-xs mt-0.5 truncate ${childActive ? 'text-blue-600' : 'text-blue-100'}`}>
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
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-white text-blue-700 shadow-lg font-semibold'
                        : 'text-white hover:bg-blue-500/30'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                  {sidebarOpen && (
                    <div className="min-w-0 flex-1 text-left">
                      <div className={`font-semibold truncate ${active ? 'text-blue-700' : 'text-white'}`}>
                        {item.name}
                      </div>
                      <div
                        className={`text-xs mt-0.5 truncate ${
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

        {/* Logout always visible at sidebar bottom; only the menu above scrolls */}
        <div className="shrink-0 border-t border-blue-400/30 bg-blue-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`
              w-full flex items-center gap-3 px-3 py-3 rounded-lg
              bg-red-600 hover:bg-red-700 transition-colors
              text-white font-semibold shadow-lg
              ${sidebarOpen ? 'justify-start' : 'justify-center'}
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
          <aside className="lg:hidden fixed inset-y-0 left-0 w-[min(18rem,88vw)] flex flex-col bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 text-white z-40 shadow-2xl overflow-hidden">
            {/* Header */}
            <div
              className="p-4 sm:p-6 border-b border-blue-400/30"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            >
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
                  <img src="/logo.png" alt="MyFNG" className="h-9 w-auto max-w-[130px] object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-yellow-200 text-sm font-semibold">Super Admin</p>
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
            <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3">
              <div className="space-y-1">
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
                  <div key={item.name} className="space-y-1">
                    <button
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [item.name]: !prev[item.name] }))}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-blue-700 shadow-lg font-semibold'
                            : 'text-white hover:bg-blue-500/30'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                      <div className="min-w-0 flex-1 text-left">
                        <div className={`font-semibold truncate ${active ? 'text-blue-700' : 'text-white'}`}>
                          {item.name}
                        </div>
                        <div className={`text-xs mt-0.5 truncate ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                          {item.description}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {isOpen ? (
                      <div className="ml-4 border-l border-white/25 pl-2 space-y-1">
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
                                w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                                transition-all duration-200
                                ${
                                  childActive
                                    ? 'bg-white text-blue-700 shadow font-semibold'
                                    : 'text-white hover:bg-blue-500/20'
                                }
                              `}
                            >
                              <ChildIcon className={`w-4 h-4 shrink-0 ${childActive ? 'text-blue-700' : 'text-white'}`} />
                              <div className="min-w-0 flex-1 text-left">
                                <div className={`text-sm font-semibold truncate ${childActive ? 'text-blue-700' : 'text-white'}`}>
                                  {c.name}
                                </div>
                                <div className={`text-xs mt-0.5 truncate ${childActive ? 'text-blue-600' : 'text-blue-100'}`}>
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
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-blue-700 shadow-lg font-semibold'
                            : 'text-white hover:bg-blue-500/30'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-700' : 'text-white'}`} />
                      <div className="min-w-0 flex-1 text-left">
                        <div className={`font-semibold truncate ${active ? 'text-blue-700' : 'text-white'}`}>
                          {item.name}
                        </div>
                        <div
                          className={`text-xs mt-0.5 truncate ${
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

            {/* Logout always visible at drawer bottom */}
            <div className="shrink-0 border-t border-blue-400/30 bg-blue-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white font-semibold shadow-lg"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 min-w-0 overflow-x-hidden overflow-y-auto ${
          isSiteSeoPage ? 'bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/40' : ''
        }`}
      >
        <div
          className="lg:hidden"
          style={{ height: 'calc(3.25rem + env(safe-area-inset-top))' }}
          aria-hidden
        />
        <div className="min-w-0 w-full max-w-full overflow-x-hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </main>
    </div>
  );
}

