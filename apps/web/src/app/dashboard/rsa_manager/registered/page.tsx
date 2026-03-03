'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Link from 'next/link';
import { AlertCircle, ChevronRight, MapPin, Search } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function RSAManagerRegisteredPage() {
  const supabase = getBrowserClient();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');

  const openWhatsAppPreview = (phone: string | null | undefined) => {
    const value = String(phone || '').trim();
    if (!value) return;
    setWaPreviewPhone(value);
    setWaPreviewOpen(true);
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.id) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('id', authUser.id)
        .single();
      setUser(userProfile);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const rows = await RSAManagerService.getRegisteredLeads(user.id, 200, 0);
      setLeads(rows || []);
    } catch (e) {
      console.error('Error fetching registered RSA leads:', e);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = leads.filter((lead) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      String(lead.customer_name || '').toLowerCase().includes(s) ||
      String(lead.contact_number || '').includes(searchTerm) ||
      String(lead.vehicle_number || '').toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">✅ Registered Complaints</h1>
          <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">
            Newly registered & unassigned RSA complaints
          </p>
        </div>

        <div className="card">
          <div className="relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search by customer name, phone, or vehicle number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Registered ({filtered.length})
            </h2>
            <button
              type="button"
              className="btn btn-outline text-xs sm:text-sm"
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-3 text-gray-600 text-sm">Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm sm:text-base">No registered complaints found</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filtered.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/dashboard/rsa_manager/leads/${lead.id}`}
                  className="block border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                          {lead.customer_name || '—'}
                        </h3>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Registered
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs sm:text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Phone:</span>{' '}
                          {lead.contact_number ? (
                            <button
                              type="button"
                              className="text-green-700 hover:text-green-800 underline underline-offset-2"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openWhatsAppPreview(lead.contact_number);
                              }}
                            >
                              {lead.contact_number}
                            </button>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Vehicle:</span> {lead.vehicle_number || '—'}{' '}
                          {lead.vehicle_model ? `(${lead.vehicle_model})` : ''}
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Service:</span> {lead.service_type || '—'}
                        </div>
                      </div>

                      {lead.address ? (
                        <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">
                            {lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-2 text-[10px] sm:text-xs text-gray-500">
                        Registered: {formatDateTimeIST(lead.lead_registered_at || lead.requested_at)}
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <WhatsAppMobilePreviewModal
          isOpen={waPreviewOpen}
          phoneNumber={waPreviewPhone}
          title="WhatsApp Chat"
          onClose={() => setWaPreviewOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}

