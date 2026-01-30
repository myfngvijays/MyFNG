'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Wrench, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
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
  Globe
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/NotificationBell';

const SIDEBAR_COLLAPSED_KEY = 'myfng:dashboardSidebarCollapsed';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: string;
}

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
    // Desktop: collapse/expand. Persisted across navigations.
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return raw === '1';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

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
        if (roleCode && roleCode.toLowerCase() !== role.toLowerCase() && role.toLowerCase() !== 'sub_admin') {
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
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  // Get role-specific menu items
  const getMenuItems = () => {
    const roleCode = role.toUpperCase();
    
    const menus: Record<string, Array<{ href: string; icon: React.ReactNode; label: string }>> = {
      'SUPER_ADMIN': [
        { href: '/dashboard/super_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/super_admin/users', icon: <Users className="w-5 h-5" />, label: 'User Management' },
        { href: '/dashboard/super_admin/workshops', icon: <Building2 className="w-5 h-5" />, label: 'Workshops' },
        { href: '/dashboard/super_admin/workshops/public-pages', icon: <Globe className="w-5 h-5" />, label: 'Public Pages' },
        { href: '/dashboard/super_admin/additional-jobs-master', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Additional Jobs Master' },
        { href: '/dashboard/super_admin/coupons', icon: <Tag className="w-5 h-5" />, label: 'Coupons' },
        { href: '/dashboard/super_admin/manual-invoices', icon: <FileText className="w-5 h-5" />, label: 'Manual Invoices' },
        { href: '/dashboard/super_admin/telecaller-distribution', icon: <Phone className="w-5 h-5" />, label: 'Telecaller Distribution' },
        { href: '/dashboard/super_admin/lead-history', icon: <ClipboardList className="w-5 h-5" />, label: 'Lead History' },
        { href: '/dashboard/super_admin/kb-manager', icon: <ClipboardList className="w-5 h-5" />, label: 'KB Manager' },
        { href: '/dashboard/super_admin/kb-questions', icon: <ClipboardList className="w-5 h-5" />, label: 'KB Questions' },
        { href: '/dashboard/super_admin/website-images', icon: <Globe className="w-5 h-5" />, label: 'Website Images' },
        { href: '/dashboard/super_admin/website-images/home-carousel', icon: <Globe className="w-5 h-5" />, label: 'Home Carousel' },
        { href: '/dashboard/super_admin/leads', icon: <FileText className="w-5 h-5" />, label: 'All Leads' },
        { href: '/dashboard/super_admin/reports', icon: <TrendingUp className="w-5 h-5" />, label: 'Reports & Analytics' },
        { href: '/dashboard/super_admin/audit-logs', icon: <Shield className="w-5 h-5" />, label: 'Audit Logs' },
        { href: '/dashboard/super_admin/settings', icon: <Settings className="w-5 h-5" />, label: 'System Settings' },
      ],
      'WORKSHOP_ADMIN': [
        { href: '/dashboard/workshop_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
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
        { href: '/dashboard/workshop_mechanic/jobs', icon: <Wrench className="w-5 h-5" />, label: 'My Jobs' },
        { href: '/dashboard/workshop_mechanic/history', icon: <ClipboardList className="w-5 h-5" />, label: 'Job History' },
        { href: '/dashboard/workshop_mechanic/profile', icon: <Users className="w-5 h-5" />, label: 'Profile' },
      ],
      'WORKSHOP_PICKUP_BOY': [
        { href: '/dashboard/workshop_pickup_boy', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
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
        { href: '/dashboard/rsa_manager/leads', icon: <FileText className="w-5 h-5" />, label: 'RSA Leads' },
        { href: '/dashboard/rsa_manager/mechanics', icon: <Wrench className="w-5 h-5" />, label: 'Mechanics' },
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
        { href: '/dashboard/telecaller', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/telecaller/enquiry-leads', icon: <FileText className="w-5 h-5" />, label: 'Enquiry' },
        { href: '/dashboard/telecaller/leads', icon: <FileText className="w-5 h-5" />, label: 'My Leads' },
        { href: '/dashboard/telecaller/leads/create', icon: <ClipboardList className="w-5 h-5" />, label: 'Create Lead' },
        { href: '/dashboard/telecaller/profile', icon: <Users className="w-5 h-5" />, label: 'My Profile' },
      ],
      'SUB_ADMIN': [
        { href: '/dashboard/sub_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/sub_admin/team', icon: <Users className="w-5 h-5" />, label: 'Team Management' },
        { href: '/dashboard/sub_admin/leads', icon: <FileText className="w-5 h-5" />, label: 'Leads' },
        { href: '/dashboard/sub_admin/escalations', icon: <AlertTriangle className="w-5 h-5" />, label: 'Escalations' },
        { href: '/dashboard/sub_admin/performance', icon: <TrendingUp className="w-5 h-5" />, label: 'Performance' },
        { href: '/dashboard/sub_admin/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
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

  return (
    <div className="min-h-screen bg-background-grey">
      {/* Header */}
      <header className="bg-white shadow-sm fixed top-0 w-full z-40">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden lg:inline-flex p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight
                className={`w-5 h-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
            
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Wrench className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-brand-fng flex-shrink-0" />
              <span className="text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap">
                <span className="text-brand-my">My</span>
                <span className="text-brand-fng">FNG</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            <NotificationBell />
            
            <div className="flex items-center gap-2 sm:gap-3">
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

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 shadow-2xl transition-all duration-300 ease-in-out lg:translate-x-0 w-56 sm:w-64 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } z-30 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <nav className="flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-2">
            {getMenuItems().map((item) => (
              <NavLink 
                key={item.href} 
                href={item.href} 
                icon={item.icon}
                active={pathname === item.href}
                collapsed={sidebarCollapsed}
                label={item.label}
              >
                {item.label}
              </NavLink>
            ))}
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

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-14 sm:pt-16 min-h-screen`}>
        <div className="p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

function NavLink({ href, icon, children, active, collapsed, label }: { href: string; icon: React.ReactNode; children: React.ReactNode; active?: boolean; collapsed?: boolean; label?: string }) {
  return (
    <Link
      href={href}
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

