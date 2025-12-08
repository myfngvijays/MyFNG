'use client';

import { useEffect, useState } from 'react';
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
  Settings,
  Bell,
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
  BarChart3
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: string;
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userProfile, setUser, setUserProfile, setRole, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Start visible by default
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push('/login');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles(role_code, role_name),
          workshop:workshops(*)
        `)
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(authUser);
        setUserProfile(profile);
        setRole(profile.role.role_code);

        // Check if user has correct role for this page
        // For SUB_ADMIN, allow access to sub_admin routes
        if (profile.role.role_code.toLowerCase() !== role.toLowerCase() && role.toLowerCase() !== 'sub_admin') {
          router.push(`/dashboard/${profile.role.role_code.toLowerCase()}`);
        }
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
        { href: '/dashboard/super_admin/leads', icon: <FileText className="w-5 h-5" />, label: 'All Leads' },
        { href: '/dashboard/super_admin/reports', icon: <TrendingUp className="w-5 h-5" />, label: 'Reports & Analytics' },
        { href: '/dashboard/super_admin/audit-logs', icon: <Shield className="w-5 h-5" />, label: 'Audit Logs' },
        { href: '/dashboard/super_admin/settings', icon: <Settings className="w-5 h-5" />, label: 'System Settings' },
      ],
      'WORKSHOP_ADMIN': [
        { href: '/dashboard/workshop_admin', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop_admin/pending-leads', icon: <Clock className="w-5 h-5" />, label: 'Pending Approvals' },
        { href: '/dashboard/workshop_admin/leads', icon: <FileText className="w-5 h-5" />, label: 'All Leads' },
        { href: '/dashboard/workshop_admin/staff', icon: <Users className="w-5 h-5" />, label: 'Staff Management' },
        { href: '/dashboard/workshop_admin/jobs', icon: <Wrench className="w-5 h-5" />, label: 'Active Jobs' },
        { href: '/dashboard/workshop_admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
      ],
      'WORKSHOP_SUPERVISOR': [
        { href: '/dashboard/workshop_supervisor', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
        { href: '/dashboard/workshop_supervisor/pending-leads', icon: <Clock className="w-5 h-5" />, label: 'Pending Approvals' },
        { href: '/dashboard/workshop_supervisor/day-planning', icon: <Calendar className="w-5 h-5" />, label: 'Day Planning' },
        { href: '/dashboard/workshop_supervisor/jobs', icon: <Wrench className="w-5 h-5" />, label: 'Manage Jobs' },
        { href: '/dashboard/workshop_supervisor/qc-queue', icon: <CheckCircle className="w-5 h-5" />, label: 'QC Queue' },
        { href: '/dashboard/workshop_supervisor/extra-work', icon: <DollarSign className="w-5 h-5" />, label: 'Extra Work Approvals' },
        { href: '/dashboard/workshop_supervisor/pickup-delivery', icon: <Truck className="w-5 h-5" />, label: 'Pickup & Delivery' },
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
        { href: '/dashboard/customer/support', icon: <Phone className="w-5 h-5" />, label: 'Support' },
        { href: '/dashboard/customer/profile', icon: <Users className="w-5 h-5" />, label: 'Profile' },
      ],
      'TELECALLER': [
        { href: '/dashboard/telecaller', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
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
        { href: '/dashboard/digital_marketing/campaigns', icon: <Megaphone className="w-5 h-5" />, label: 'Campaigns' },
        { href: '/dashboard/digital_marketing/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
        { href: '/dashboard/digital_marketing/content', icon: <FileText className="w-5 h-5" />, label: 'Content' },
        { href: '/dashboard/digital_marketing/leads', icon: <Users className="w-5 h-5" />, label: 'Leads' },
        { href: '/dashboard/digital_marketing/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
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
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X /> : <Menu />}
            </button>
            
            <Link href="/" className="flex items-center gap-2">
              <Wrench className="w-8 h-8 text-brand-fng" />
              <span className="text-2xl font-bold">
                <span className="text-brand-my">My</span>
                <span className="text-brand-fng">FNG</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-6 h-6 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-medium text-sm">{userProfile?.full_name}</p>
                <p className="text-xs text-gray-500">{userProfile?.role?.role_name}</p>
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
                title="Logout"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 shadow-2xl transition-transform lg:translate-x-0 w-64 z-30 overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-2">
          {getMenuItems().map((item) => (
            <NavLink 
              key={item.href} 
              href={item.href} 
              icon={item.icon}
              active={pathname === item.href}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-6">
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

function NavLink({ href, icon, children, active }: { href: string; icon: React.ReactNode; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-white text-blue-700 shadow-lg font-semibold' 
          : 'text-white hover:bg-blue-500/30 font-medium'
      }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

