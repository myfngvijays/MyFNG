'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Car, Clock, CheckCircle, MapPin, Phone } from 'lucide-react';
import { DashboardCard, StatsGrid, ListItem } from '@/components/RoleDashboards';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from "@/lib/utils";

export default function CustomerDashboard() {
  const router = useRouter();
  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);
  const [stats, setStats] = useState([
    { label: 'Active Bookings', value: '0', icon: <Car className="w-8 h-8" />, color: 'text-brand-primary' },
    { label: 'In Service', value: '0', icon: <Clock className="w-8 h-8" />, color: 'text-blue-500' },
    { label: 'Completed', value: '0', icon: <CheckCircle className="w-8 h-8" />, color: 'text-green-500' },
    { label: 'This Month', value: '₹0', icon: <Car className="w-8 h-8" />, color: 'text-purple-500' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, []);

  async function fetchCustomerData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, email, phone')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      // Fetch active services (created by customer email/phone)
      const { data: active } = await supabase
        .from('service_leads')
        .select('*, workshop_id(name)')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .in('status', ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'])
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch completed service history
      const { data: history } = await supabase
        .from('service_leads')
        .select('*, workshop_id(name)')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false })
        .limit(5);

      // Get stats
      const { count: activeCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .in('status', ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']);

      const { count: inServiceCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .eq('status', 'IN_PROGRESS');

      const { count: completedCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .eq('status', 'COMPLETED');

      // Calculate this month's total
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: thisMonthServices } = await supabase
        .from('service_leads')
        .select('actual_amount')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .eq('status', 'COMPLETED')
        .gte('completed_at', startOfMonth.toISOString());

      const monthTotal = thisMonthServices?.reduce((sum, service) => sum + (Number(service.actual_amount) || 0), 0) || 0;

      setActiveServices(active || []);
      setServiceHistory(history || []);
      setStats([
        { label: 'Active Bookings', value: (activeCount || 0).toString(), icon: <Car className="w-8 h-8" />, color: 'text-brand-primary' },
        { label: 'In Service', value: (inServiceCount || 0).toString(), icon: <Clock className="w-8 h-8" />, color: 'text-brand-primary' },
        { label: 'Completed', value: (completedCount || 0).toString(), icon: <CheckCircle className="w-8 h-8" />, color: 'text-green-500' },
        { label: 'This Month', value: `₹${(monthTotal / 1000).toFixed(1)}K`, icon: <Car className="w-8 h-8" />, color: 'text-brand-secondary' },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="customer">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-text-body text-sm sm:text-base">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-4 sm:mb-5 md:mb-6">
          <h1 className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">🚗 My Dashboard</h1>
          <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Track your vehicle services</p>
        </div>

        {/* Quick Action - Book New Service */}
        <div className="card bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2">Need Service?</h2>
          <p className="mb-3 sm:mb-4 text-sm sm:text-base">Book a service for your vehicle in just a few clicks</p>
          <button className="btn bg-white text-brand-primary hover:bg-gray-100 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
            <Car className="w-4 h-4 sm:w-5 sm:h-5" />
            Book New Service
          </button>
        </div>

        <StatsGrid stats={stats} />

        {/* Active Bookings */}
        <DashboardCard title="Active Services">
          <div className="space-y-3">
            {activeServices.length > 0 ? (
              activeServices.map((service) => {
                const statusColors: Record<string, string> = {
                  'NEW': 'border-yellow-500',
                  'ASSIGNED': 'border-blue-400',
                  'ACCEPTED': 'border-green-400',
                  'IN_PROGRESS': 'border-blue-500',
                };
                const statusBadges: Record<string, { label: string; color: string }> = {
                  'NEW': { label: 'NEW', color: 'bg-yellow-100 text-yellow-700' },
                  'ASSIGNED': { label: 'ASSIGNED', color: 'bg-blue-100 text-blue-700' },
                  'ACCEPTED': { label: 'ACCEPTED', color: 'bg-green-100 text-green-700' },
                  'IN_PROGRESS': { label: 'IN PROGRESS', color: 'bg-blue-100 text-blue-700' },
                };
                
                return (
                  <div key={service.id} className={`border-l-4 ${statusColors[service.status]} pl-4`}>
                    <ListItem
                      title={`${service.service_type} - ${service.vehicle_number}`}
                      subtitle={`${service.vehicle_make || ''} ${service.vehicle_model || ''}`.trim() || 'Vehicle'}
                      metadata={[
                        `Workshop: ${service.workshop_id?.name || 'Not assigned'}`,
                        `Lead: ${service.lead_number}`,
                        service.estimated_amount ? `Estimate: ₹${service.estimated_amount}` : ''
                      ].filter(Boolean)}
                      badge={statusBadges[service.status]}
                      actions={
                        <>
                          <button className="btn btn-primary flex-1 text-sm">
                            View Details
                          </button>
                          {service.workshop_id && (
                            <button className="btn btn-outline flex-1 text-sm">
                              <Phone className="w-4 h-4" />
                              Call
                            </button>
                          )}
                        </>
                      }
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-text-body text-center py-4">No active services</p>
            )}
          </div>
        </DashboardCard>

        {/* Service History */}
        <DashboardCard title="Recent Service History">
          <div className="space-y-2">
            {serviceHistory.length > 0 ? (
              serviceHistory.map((service) => (
                <ListItem
                  key={service.id}
                  title={`${service.service_type} - ${service.vehicle_number}`}
                  subtitle={`Completed on ${formatDateDMY(service.completed_at)}`}
                  metadata={[
                    `Workshop: ${service.workshop_id?.name || 'N/A'}`,
                    service.actual_amount ? `Amount: ₹${service.actual_amount.toLocaleString()}` : ''
                  ].filter(Boolean)}
                  badge={{ label: 'COMPLETED', color: 'bg-green-100 text-green-700' }}
                />
              ))
            ) : (
              <p className="text-text-body text-center py-4">No service history</p>
            )}
          </div>
        </DashboardCard>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <QuickLink title="My Vehicles" icon={<Car />} onClick={() => router.push('/dashboard/customer/vehicles')} />
          <QuickLink title="Service History" icon={<Clock />} onClick={() => router.push('/dashboard/customer/service-history')} />
          <QuickLink title="Support" icon={<Phone />} onClick={() => router.push('/dashboard/customer/support')} />
          <QuickLink title="Profile" icon={<CheckCircle />} onClick={() => router.push('/dashboard/customer/profile')} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function QuickLink({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="card hover:shadow-lg transition text-center p-3 sm:p-4">
      <div className="flex flex-col items-center gap-1.5 sm:gap-2">
        <div className="text-brand-primary text-xl sm:text-2xl">{icon}</div>
        <span className="text-xs sm:text-sm font-medium text-text-heading">{title}</span>
      </div>
    </button>
  );
}

