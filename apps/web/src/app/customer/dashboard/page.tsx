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
import { createClient } from '@/lib/supabase/client';
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

  useEffect(() => {
    fetchCustomerData();
  }, []);

  async function fetchCustomerData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/customer/login');
        return;
      }

      // Fetch customer profile
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', user.id)
        .single();

      setCustomer(customerData);

      // Fetch customer leads
      const { data: leadsData } = await supabase
        .from('service_leads')
        .select('*')
        .eq('customer_phone', customerData?.phone)
        .order('created_at', { ascending: false })
        .limit(5);

      setLeads(leadsData || []);

      // Calculate stats
      const allLeads = leadsData || [];
      setStats({
        active: allLeads.filter(l => !['CLOSED', 'REJECTED', 'CANCELLED'].includes(l.status)).length,
        completed: allLeads.filter(l => l.status === 'CLOSED').length,
        total: allLeads.length,
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/customer/login');
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
                <p className="text-sm text-gray-600">{customer?.email}</p>
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
              <Link href="/customer/history" className="text-brand-primary hover:underline text-sm font-medium">
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
          <Link href="/customer/history" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
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

          <Link href="/customer/invoices" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Invoices</h3>
                <p className="text-sm text-gray-600">View & download invoices</p>
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
      </main>
    </div>
  );
}

