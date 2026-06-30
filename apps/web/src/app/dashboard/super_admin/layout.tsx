'use client';

import React, { useMemo, useState } from 'react';
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
    name: 'App Membership & Offers',
    icon: Crown,
    description: 'Cards, post-booking offer & wallet',
    children: [
      {
        name: 'Membership Cards',
        href: '/dashboard/super_admin/membership-cards',
        icon: Crown,
        description: 'Animated promo cards & placements',
      },
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
      {
        name: 'Advance Coupon Management',
        href: '/dashboard/super_admin/advance-coupons',
        icon: Ticket,
        description: 'PCMS — campaigns & automation',
      },
    ],
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
    description: 'Brands, plans, T&C & FAQs',
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
      {
        name: 'FAQs (App + Web)',
        href: '/dashboard/super_admin/public-faqs',
        icon: HelpCircle,
        description: 'General, service & RSA FAQs',
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
    name: 'Intelligence & Automation',
    isSection: true,
  },
  {
    name: 'AI Learning Inbox',
    href: '/dashboard/super_admin/kb-questions',
    icon: MessageSquare,
    description: 'Review & add answers to KB'
  },
  {
    name: 'Admin AI Chat',
    href: '/dashboard/super_admin/admin-ai-chat',
    icon: Bot,
    description: 'Chat with MISA AI'
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
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserClient(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start collapsed; expand on hover
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Smart Tools': false,
    'App Content & Display': false,
    'App Membership & Offers': false,
    'Push Notifications': false,
    'Shared Content': false,
    'App Customers': false,
    WhatsApp: false,
  });

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
      pathname?.startsWith('/dashboard/super_admin/post-booking-membership') ||
      pathname?.startsWith('/dashboard/super_admin/wallet-logic') ||
      pathname?.startsWith('/dashboard/super_admin/wallet-credits') ||
      pathname?.startsWith('/dashboard/super_admin/advance-coupons')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'App Membership & Offers': true }));
    }
    if (pathname?.startsWith('/dashboard/super_admin/advance-notifications')) {
      setOpenGroups((prev) => ({ ...prev, 'Push Notifications': true }));
    }
    if (
      pathname?.startsWith('/dashboard/super_admin/brands') ||
      pathname?.startsWith('/dashboard/super_admin/website-images/vehicle-images') ||
      pathname?.startsWith('/dashboard/super_admin/membership-plans') ||
      pathname?.startsWith('/dashboard/super_admin/membership-terms') ||
      pathname?.startsWith('/dashboard/super_admin/public-faqs')
    ) {
      setOpenGroups((prev) => ({ ...prev, 'Shared Content': true }));
    }
  }, [pathname]);

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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar - Desktop */}
      <aside
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
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
          <div className="flex items-center">
            {sidebarOpen ? (
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-8 h-8 text-yellow-300" />
                  <h1 className="text-xl font-bold text-white">MyFNG</h1>
                </div>
                <p className="text-yellow-200 text-sm mt-1 font-semibold">Super Admin Control Panel</p>
              </div>
            ) : (
              <Shield className="w-8 h-8 mx-auto text-yellow-300" />
            )}
          </div>
        </div>

        {/* Navigation */}
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

            {/* Navigation */}
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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

