'use client';

import { formatDateDMY } from "@/lib/utils";
/**
 * Customer Dashboard
 * Phase 4 - Task WA-403
 * 
 * Features:
 * - View active leads
 * - Create new lead
 * - View service history
 * - View invoices
 * - Profile management
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Clock,
  CheckCircle,
  FileText,
  User,
  Car,
  LogOut,
  Bell,
  Settings,
  History,
} from 'lucide-react';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    total: 0,
  });
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCustomerData();
    fetch('/api/customer/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event_name: 'dashboard_viewed', event_group: 'engagement' }),
    }).catch(() => {});
  }, []);

  async function fetchCustomerData() {
    try {
      const [meRes, leadsRes, flagsRes] = await Promise.all([
        fetch('/api/customer/auth/me', { credentials: 'include' }),
        fetch('/api/customer/leads', { credentials: 'include' }),
        fetch('/api/customer/feature-flags', { credentials: 'include' }),
      ]);

      if (!meRes.ok) {
        router.push('/customer/login');
        return;
      }

      const meData = await meRes.json().catch(() => ({}));
      const customerData = meData?.customer ?? null;
      setCustomer(customerData);

      const leadsData = leadsRes.ok ? (await leadsRes.json().catch(() => ({})))?.leads ?? [] : [];
      setLeads(leadsData);
      const flagsData = flagsRes.ok ? (await flagsRes.json().catch(() => ({})))?.flags ?? {} : {};
      setFlags(flagsData);

      const allLeads = Array.isArray(leadsData) ? leadsData : [];
      setStats({
        active: allLeads.filter((l: any) => !['CLOSED', 'REJECTED', 'CANCELLED'].includes(l?.status)).length,
        completed: allLeads.filter((l: any) => l?.status === 'CLOSED').length,
        total: allLeads.length,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      router.push('/customer/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/customer/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.push('/customer/login');
      router.refresh();
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800';
      case 'ACCEPTED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': case 'CLOSED': return 'bg-gray-100 text-gray-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome, {customer?.full_name?.split(' ')[0]}!
                </h1>
                <p className="text-sm text-gray-600">{customer?.email || customer?.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-full relative">
                <Bell className="w-6 h-6 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <Link
            href="/customer/create-lead"
            className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Request New Service
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Services</p>
                <p className="text-3xl font-bold text-brand-primary mt-1">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-brand-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Services</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Car className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Services */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Recent Services</h2>
              <Link href="/customer/orders" className="text-brand-primary hover:underline text-sm font-medium">
                View All
              </Link>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {leads.length === 0 ? (
              <div className="p-8 text-center">
                <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No service requests yet</p>
                <Link
                  href="/customer/create-lead"
                  className="inline-flex items-center gap-2 text-brand-primary hover:underline font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create your first service request
                </Link>
              </div>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{lead.lead_number}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(lead.status)}`}>
                          {lead.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        🚗 {lead.vehicle_make} {lead.vehicle_model} ({lead.vehicle_number})
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        🔧 {lead.service_type}
                      </p>
                      <p className="text-xs text-gray-500">
                        Created: {formatDateDMY(lead.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/customer/track/${lead.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors text-sm font-medium"
                      >
                        Track Status
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/customer/orders" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <History className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Service History</h3>
                <p className="text-sm text-gray-600">View all past services</p>
              </div>
            </div>
          </Link>

          <Link href="/customer/wallet" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Wallet</h3>
                <p className="text-sm text-gray-600">Offers and virtual cash</p>
              </div>
            </div>
          </Link>

          <Link href="/customer/profile" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Settings className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Profile Settings</h3>
                <p className="text-sm text-gray-600">Manage your account</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {(flags.customer_referral ?? true) && <Link href="/customer/refer" className="bg-white rounded-lg shadow p-3 text-center text-sm">Refer & Earn</Link>}
          <Link href="/customer/notifications" className="bg-white rounded-lg shadow p-3 text-center text-sm">Notification Toggles</Link>
          <Link href="/customer/vehicles" className="bg-white rounded-lg shadow p-3 text-center text-sm">My Vehicle</Link>
          <Link href="/customer/support" className="bg-white rounded-lg shadow p-3 text-center text-sm">Help & Support</Link>
          {(flags.customer_membership ?? true) && <Link href="/customer/membership" className="bg-white rounded-lg shadow p-3 text-center text-sm">Membership</Link>}
          {(flags.customer_cart ?? true) && <Link href="/customer/cart" className="bg-white rounded-lg shadow p-3 text-center text-sm">Cart</Link>}
        </div>
      </main>
    </div>
  );
}

