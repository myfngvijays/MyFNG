'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateTimeIST } from '@/lib/utils';
import {
  ArrowLeft, MapPin, Phone, Mail, Car, Wrench,
  Clock, User, AlertCircle, CheckCircle, XCircle,
  MessageSquare, Calendar, DollarSign, Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';

function normalizePincode(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function formatAssignmentDateTime(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasTimezone = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(raw);
  // These assignment fields are often stored as naive UTC timestamps.
  // When timezone is missing, treat them as UTC to avoid GMT/IST drift in UI.
  const normalized = hasTimezone ? raw : `${raw}Z`;
  return formatDateTimeIST(normalized);
}

export function RSALeadDetailPageView({ embedded = false }: { embedded?: boolean }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const layoutRole = pathname?.includes('/dashboard/super_admin') ? 'super_admin' : 'rsa_manager';
  const backHref = layoutRole === 'super_admin' ? '/dashboard/super_admin/rsa' : '/dashboard/rsa_manager';
  const supabase = getBrowserClient();

  const shell = (node: ReactNode) =>
    embedded ? <>{node}</> : <DashboardLayout role={layoutRole}>{node}</DashboardLayout>;
  
  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [showAssignManager, setShowAssignManager] = useState(false);
  const [showAssignMechanic, setShowAssignMechanic] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusQuotedAmount, setStatusQuotedAmount] = useState('');
  const [statusMechanicAmount, setStatusMechanicAmount] = useState('');
  const [mechanicSearchPincode, setMechanicSearchPincode] = useState('');
  const [mechanicSearchTerm, setMechanicSearchTerm] = useState('');
  const [mechanicSearching, setMechanicSearching] = useState(false);
  const [mechanicSearchNotice, setMechanicSearchNotice] = useState<string>('');
  const [pincodeDraft, setPincodeDraft] = useState('');
  const [editingPincode, setEditingPincode] = useState(false);
  const [savingPincode, setSavingPincode] = useState(false);
  const [suggestedPincode, setSuggestedPincode] = useState<string | null>(null);
  const [suggestedProvider, setSuggestedProvider] = useState<string | null>(null);
  const [detectingPincode, setDetectingPincode] = useState(false);
  const [editingMechanicAmount, setEditingMechanicAmount] = useState(false);
  const [mechanicAmountDraft, setMechanicAmountDraft] = useState('');
  const [savingMechanicAmount, setSavingMechanicAmount] = useState(false);
  const [changingMechanic, setChangingMechanic] = useState(false);
  const [rsaMediaUploading, setRsaMediaUploading] = useState(false);
  const [rsaMediaError, setRsaMediaError] = useState('');
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const leadStatus = String(lead?.lead_status || lead?.complaint_status || '').toLowerCase();
  const showFinanceInStatusModal = newStatus === 'completed' || newStatus === 'cancelled';
  const canTransferManager = leadStatus !== 'completed' && leadStatus !== 'cancelled' && leadStatus !== 'closed';

  const formatServiceAreasLabel = (areas: any[]) => {
    if (!Array.isArray(areas) || areas.length === 0) return '';
    const labels = areas
      .map((a: any) => {
        if (a == null) return '';
        if (typeof a === 'string' || typeof a === 'number') return String(a).trim();
        const pincode = String(a?.pincode ?? '').trim();
        const area = String(a?.area ?? '').trim();
        const state = String(a?.state ?? '').trim();
        const left = area || pincode;
        if (!left && !state) return '';
        return state ? `${left} • ${state}` : left;
      })
      .filter(Boolean);
    return labels.join(', ');
  };
  const openWhatsAppPreview = (phone: string | null | undefined) => {
    const value = String(phone || '').trim();
    if (!value) return;
    setWaPreviewPhone(value);
    setWaPreviewOpen(true);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchLeadDetail();
      fetchTimeline();
      fetchManagers();
    }
  }, [params.id]);

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

  const fetchLeadDetail = async () => {
    setLoading(true);
    try {
      const leadData = await RSAManagerService.getLeadById(params.id as string);
      setLead(leadData);
      setPincodeDraft(String((leadData as any)?.pincode || '').trim());
      setMechanicAmountDraft(
        leadData && (leadData as any).payment_to_mechanic != null
          ? String((leadData as any).payment_to_mechanic)
          : ''
      );
      setEditingMechanicAmount(false);
      setEditingPincode(false);
      setSuggestedPincode(null);
      setSuggestedProvider(null);
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectPincodeFromMap = async (link: string) => {
    const url = String(link || '').trim();
    if (!url) return;
    setDetectingPincode(true);
    try {
      const res = await fetch(`/api/rsa/pincode-from-map?url=${encodeURIComponent(url)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to detect pincode');
      const pc = json?.pincode ? String(json.pincode).replace(/\D/g, '').slice(0, 6) : '';
      setSuggestedPincode(pc || null);
      setSuggestedProvider(json?.provider ? String(json.provider) : null);
    } catch {
      setSuggestedPincode(null);
      setSuggestedProvider(null);
    } finally {
      setDetectingPincode(false);
    }
  };

  useEffect(() => {
    const link = String(lead?.location_link || '').trim();
    if (!link) return;
    // Best-effort background suggestion; no auto-save.
    detectPincodeFromMap(link);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.location_link]);

  const fetchTimeline = async () => {
    try {
      const timelineData = await RSAManagerService.getLeadTimeline(params.id as string);
      setTimeline(timelineData);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const managersData = await RSAManagerService.getAllManagers();
      setManagers(managersData);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleClaimLead = async () => {
    if (!user) return;
    
    try {
      const result = await RSAManagerService.claimLead(
        params.id as string,
        user.id,
        user.full_name || user.email
      );
      
      if (result.success) {
        alert('Lead claimed successfully!');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error claiming lead:', error);
      alert('Failed to claim lead');
    }
  };

  const handleAssignToManager = async () => {
    if (!selectedManagerId || !user) return;
    
    try {
      const result = await RSAManagerService.assignLead(
        params.id as string,
        user.id,
        selectedManagerId,
        user.full_name || user.email
      );
      
      if (result.success) {
        alert('Lead assigned successfully!');
        setShowAssignManager(false);
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error assigning lead:', error);
      alert('Failed to assign lead');
    }
  };

  const handleSearchMechanics = async () => {
    if (!lead) return;
    
    try {
      const pin = String(lead.pincode || '').trim();
      setMechanicSearchPincode(pin);
      setMechanicSearchTerm('');
      setMechanicSearchNotice('');
      setMechanicSearching(true);
      let mechanicsData = await RSAManagerService.searchMechanics({
        pincode: pin || undefined,
        searchTerm: undefined,
      });

      // Prefer available mechanics; if none found for pincode, fallback to all mechanics.
      const list = Array.isArray(mechanicsData) ? mechanicsData : [];
      const available = list.filter((m: any) => m?.is_available);
      if (pin && list.length === 0) {
        const fallback = await RSAManagerService.searchMechanics({
          pincode: undefined,
          searchTerm: undefined,
        });
        mechanicsData = Array.isArray(fallback) ? fallback : [];
        setMechanicSearchNotice(`No mechanics matched pincode ${pin}. Showing all mechanics.`);
      } else if (pin && list.length > 0 && available.length === 0) {
        setMechanicSearchNotice(`No available mechanics for pincode ${pin}. Showing busy mechanics too.`);
      }

      setMechanics((Array.isArray(mechanicsData) ? mechanicsData : []) || []);
      setShowAssignMechanic(true);
    } catch (error) {
      console.error('Error searching mechanics:', error);
      alert('Failed to search mechanics');
      setMechanics([]);
    }
    finally {
      setMechanicSearching(false);
    }
  };

  const runMechanicSearch = async () => {
    const pin = String(mechanicSearchPincode || '').trim();
    const term = String(mechanicSearchTerm || '').trim();
    setMechanicSearching(true);
    setMechanicSearchNotice('');
    try {
      let mechanicsData = await RSAManagerService.searchMechanics({
        pincode: pin || undefined,
        searchTerm: term || undefined,
      });

      const list = Array.isArray(mechanicsData) ? mechanicsData : [];
      if (pin && list.length === 0) {
        const fallback = await RSAManagerService.searchMechanics({
          pincode: undefined,
          searchTerm: term || undefined,
        });
        mechanicsData = Array.isArray(fallback) ? fallback : [];
        setMechanicSearchNotice(`No mechanics matched pincode ${pin}. Showing all mechanics.`);
      }

      setMechanics((Array.isArray(mechanicsData) ? mechanicsData : []) || []);
      setSelectedMechanicId('');
    } catch (error) {
      console.error('Error searching mechanics:', error);
      alert('Failed to search mechanics');
      setMechanics([]);
    } finally {
      setMechanicSearching(false);
    }
  };

  const handleAssignMechanic = async () => {
    if (!selectedMechanicId) return;
    
    try {
      const res = await fetch(`/api/rsa/leads/${encodeURIComponent(String(params.id))}/mechanic`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mechanic_id: selectedMechanicId,
          payment_to_mechanic: paymentAmount ? Number(paymentAmount) : null,
          remark: remark || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to assign mechanic');

      alert(changingMechanic ? 'Mechanic changed successfully!' : 'Mechanic assigned successfully!');
        setShowAssignMechanic(false);
        setSelectedMechanicId('');
        setPaymentAmount('');
        setRemark('');
        setChangingMechanic(false);
        fetchLeadDetail();
        fetchTimeline();
    } catch (error) {
      console.error('Error assigning mechanic:', error);
      alert((error as any)?.message || 'Failed to assign mechanic');
    }
  };

  const handleSaveMechanicAmount = async () => {
    if (!lead?.id) return;
    setSavingMechanicAmount(true);
    try {
      const res = await fetch(`/api/rsa/leads/${encodeURIComponent(String(lead.id))}/payment-to-mechanic`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_to_mechanic: mechanicAmountDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details ? `${json?.error || 'Failed'}: ${json.details}` : (json?.error || 'Failed to update mechanic amount'));
      setLead((p: any) => (p ? { ...p, payment_to_mechanic: json?.payment_to_mechanic ?? null } : p));
      setEditingMechanicAmount(false);
    } catch (e: any) {
      console.error('Failed to update mechanic amount:', e);
      alert(e?.message || 'Failed to update mechanic amount');
    } finally {
      setSavingMechanicAmount(false);
    }
  };

  const handleAddMedia = async (files: FileList | null) => {
    try {
      setRsaMediaError('');
      if (!lead?.id) return;
      const list = files ? Array.from(files) : [];
      if (!list.length) return;
      if (list.length > 5) {
        setRsaMediaError('Maximum 5 images allowed');
        return;
      }

      setRsaMediaUploading(true);
      const fd = new FormData();
      for (const f of list) fd.append('media', f);
      const res = await fetch(`/api/rsa/leads/${encodeURIComponent(String(lead.id))}/media`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details ? `${json?.error || 'Failed'}: ${json.details}` : (json?.error || 'Failed to upload media'));

      const next = Array.isArray(json?.media_upload) ? json.media_upload : null;
      if (next) setLead((p: any) => (p ? { ...p, media_upload: next } : p));
      fetchTimeline();
    } catch (e: any) {
      console.error('Failed to upload media:', e);
      setRsaMediaError(e?.message || 'Failed to upload media');
    } finally {
      setRsaMediaUploading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    try {
      if (showFinanceInStatusModal) {
        const financeRes = await fetch(`/api/rsa/leads/${encodeURIComponent(String(params.id))}/finance`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customer_quoted_amount: statusQuotedAmount,
            payment_to_mechanic: statusMechanicAmount,
          }),
        });
        const financeJson = await financeRes.json().catch(() => ({}));
        if (!financeRes.ok) {
          throw new Error(financeJson?.details ? `${financeJson?.error || 'Failed'}: ${financeJson.details}` : (financeJson?.error || 'Failed to update finance details'));
        }
      }

      const result = await RSAManagerService.updateLeadStatus(
        params.id as string,
        newStatus,
        statusNotes
      );
      
      if (result.success) {
        alert('Status updated successfully!');
        setShowUpdateStatus(false);
        setNewStatus('');
        setStatusNotes('');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const openUpdateStatusModal = () => {
    setNewStatus('');
    setStatusNotes('');
    setStatusQuotedAmount(
      lead?.customer_quoted_amount != null && lead?.customer_quoted_amount !== ''
        ? String(lead.customer_quoted_amount)
        : ''
    );
    setStatusMechanicAmount(
      lead?.payment_to_mechanic != null && lead?.payment_to_mechanic !== ''
        ? String(lead.payment_to_mechanic)
        : ''
    );
    setShowUpdateStatus(true);
  };

  const handleSavePincode = async () => {
    if (!lead?.id) return;
    const next = normalizePincode(pincodeDraft);
    if (next && next.length !== 6) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setSavingPincode(true);
    try {
      const res = await fetch(`/api/rsa/leads/${encodeURIComponent(String(lead.id))}/pincode`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pincode: next || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to update pincode');
      }

      setLead((prev: any) => (prev ? { ...prev, pincode: json?.pincode ?? (next || null) } : prev));
      setEditingPincode(false);
    } catch (e: any) {
      console.error('Failed to update pincode:', e);
      alert(e?.message || 'Failed to update pincode');
    } finally {
      setSavingPincode(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assigned' },
      'assigned_to_manager': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Assigned to Manager' },
      'assigned_to_mechanic': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Assigned to Mechanic' },
      'in_progress': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Reached' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };
    
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return shell(
      <div className="p-3 sm:p-4 md:p-5 lg:p-6">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm md:text-base">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return shell(
      <div className="p-3 sm:p-4 md:p-5 lg:p-6">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:h-16 md:w-16 text-gray-400 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">Lead not found</p>
          <Link
            href={backHref}
            className="text-red-600 hover:underline mt-2 sm:mt-3 md:mt-4 inline-block text-xs sm:text-sm md:text-base"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return shell(
    <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-900 text-xs sm:text-sm md:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          {!lead.assigned_manager_id && (
            <button
              onClick={handleClaimLead}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              Claim Lead
            </button>
          )}
          {canTransferManager ? (
            <button
              onClick={() => setShowAssignManager(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              {lead.assigned_manager_id ? 'Transfer Manager' : 'Assign Manager'}
            </button>
          ) : null}
          {lead.assigned_manager_id === user?.id && (
            <>
              <button
                onClick={openUpdateStatusModal}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                Update Status
              </button>
              <button
                onClick={async () => {
                  setChangingMechanic(Boolean(lead.assigned_mechanic_id));
                  await handleSearchMechanics();
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                {lead.assigned_mechanic_id ? 'Change Mechanic' : 'Assign Mechanic'}
              </button>
            </>
          )}
        </div>
      </div>

        {/* Lead Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5 lg:p-6 mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">{lead.customer_name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {getStatusBadge(lead.lead_status || lead.complaint_status)}
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold rounded ${
                  lead.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                  lead.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  lead.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {lead.priority?.toUpperCase() || 'MEDIUM'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mt-4 sm:mt-5 md:mt-6">
            {/* Customer Info */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Customer Information
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  {lead.contact_number ? (
                    <button
                      type="button"
                      className="text-green-700 hover:text-green-800 underline underline-offset-2"
                      onClick={() => openWhatsAppPreview(lead.contact_number)}
                    >
                      {lead.contact_number}
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                {lead.alternate_number && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>
                      Alt:{' '}
                      <button
                        type="button"
                        className="text-green-700 hover:text-green-800 underline underline-offset-2"
                        onClick={() => openWhatsAppPreview(lead.alternate_number)}
                      >
                        {lead.alternate_number}
                      </button>
                    </span>
                  </div>
                )}
                {lead.address && (
                  <div className="flex items-start gap-1.5 sm:gap-2 text-gray-600">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>{lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">Pincode:</span>
                    {editingPincode ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs sm:text-sm w-28"
                          placeholder="6 digits"
                          value={pincodeDraft}
                          onChange={(e) => setPincodeDraft(normalizePincode(e.target.value))}
                          inputMode="numeric"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={handleSavePincode}
                          disabled={savingPincode}
                          className="px-2.5 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-[10px] sm:text-xs"
                        >
                          {savingPincode ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPincode(false);
                            setPincodeDraft(String(lead.pincode || '').trim());
                          }}
                          disabled={savingPincode}
                          className="px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-[10px] sm:text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{lead.pincode || '—'}</span>
                        {lead.location_link ? (
                          <button
                            type="button"
                            onClick={() => detectPincodeFromMap(String(lead.location_link))}
                            disabled={detectingPincode}
                            className="text-gray-600 hover:underline text-[10px] sm:text-xs flex-shrink-0"
                            title="Detect pincode from map link"
                          >
                            {detectingPincode ? 'Detecting…' : 'Detect'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditingPincode(true)}
                          className="text-red-600 hover:underline text-[10px] sm:text-xs flex-shrink-0"
                        >
                          {lead.pincode ? 'Edit' : 'Add'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {!editingPincode && !lead.pincode && suggestedPincode ? (
                  <div className="ml-6 sm:ml-7 text-[10px] sm:text-xs text-gray-500">
                    Suggested from map{suggestedProvider ? ` (${suggestedProvider})` : ''}: <b>{suggestedPincode}</b>{' '}
                    <button
                      type="button"
                      className="text-red-600 hover:underline ml-1"
                      onClick={() => {
                        setPincodeDraft(suggestedPincode);
                        setEditingPincode(true);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                ) : null}
                {lead.location_link && (
                  <a
                    href={lead.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 sm:gap-2 text-red-600 hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    View on Map
                  </a>
                )}
              </div>
            </div>

            {/* Vehicle Info */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <Car className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Vehicle Information
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                <div><span className="font-medium">Number:</span> {lead.vehicle_number}</div>
                {lead.vehicle_model && (
                  <div><span className="font-medium">Model:</span> {lead.vehicle_model}</div>
                )}
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              Service Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-600">Service Type:</span>
                <p className="text-gray-900">{lead.service_type || '—'}</p>
              </div>
              {lead.drop_location ? (
                <div className="sm:col-span-2 lg:col-span-1">
                  <span className="font-medium text-gray-600">Drop Location:</span>
                  {(() => {
                    const raw = String(lead.drop_location || '').trim();
                    const isUrl = /^https?:\/\//i.test(raw);
                    const href = isUrl
                      ? raw
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:underline break-words inline-block"
                        title="Open in Maps"
                      >
                        {raw}
                      </a>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            {(lead.problem || lead.description) ? (
              <div className="mt-3 sm:mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {lead.problem ? (
                  <div>
                    <span className="font-medium text-gray-600 text-xs sm:text-sm">Problem:</span>
                    <p className="text-gray-800 text-xs sm:text-sm mt-0.5 sm:mt-1 whitespace-pre-wrap">{lead.problem}</p>
                  </div>
                ) : null}
                {lead.description ? (
                  <div>
                    <span className="font-medium text-gray-600 text-xs sm:text-sm">Description:</span>
                    <p className="text-gray-800 text-xs sm:text-sm mt-0.5 sm:mt-1 whitespace-pre-wrap">{lead.description}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Assignment Info */}
          <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Assignment Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              {lead.registered_by_name && (
                <div>
                  <span className="font-medium text-gray-600">Registered By:</span>
                  <p className="text-gray-900">{lead.registered_by_name}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs">
                    {formatAssignmentDateTime(lead.lead_registered_at)}
                  </p>
                </div>
              )}
              {lead.assigned_manager_name && (
                <div>
                  <span className="font-medium text-gray-600">Assigned Manager:</span>
                  <p className="text-gray-900">{lead.assigned_manager_name}</p>
                  {lead.assigned_to_manager_at && (
                    <p className="text-gray-500 text-[10px] sm:text-xs">
                      {formatAssignmentDateTime(lead.assigned_to_manager_at)}
                    </p>
                  )}
                </div>
              )}
              {lead.assigned_mechanic_name && (
                <div>
                  <span className="font-medium text-gray-600">Assigned Mechanic:</span>
                  <p className="text-gray-900">{lead.assigned_mechanic_name}</p>
                  {lead.assigned_mechanic_contact && (
                    <p className="text-gray-600 text-xs sm:text-sm">
                      <button
                        type="button"
                        className="text-green-700 hover:text-green-800 underline underline-offset-2"
                        onClick={() => openWhatsAppPreview(lead.assigned_mechanic_contact)}
                      >
                        {lead.assigned_mechanic_contact}
                      </button>
                    </p>
                  )}
                  {lead.mechanic_assigned_datetime && (
                    <p className="text-gray-500 text-[10px] sm:text-xs">
                      Assigned: {formatAssignmentDateTime(lead.mechanic_assigned_datetime)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          {(lead.customer_quoted_amount != null || lead.advance_payment || lead.payment_to_mechanic != null) && (
            <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Payment Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <span className="font-medium text-gray-600">Quoted Amount:</span>
                  <p className="text-gray-900 text-base sm:text-lg font-semibold">
                    {lead.customer_quoted_amount != null && lead.customer_quoted_amount !== ''
                      ? `₹${lead.customer_quoted_amount}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Advance Amount:</span>
                  <p className="text-gray-900">
                    {lead.advance_payment
                      ? (/^\d+(\.\d+)?$/.test(String(lead.advance_payment).trim())
                          ? `₹${String(lead.advance_payment).trim()}`
                          : String(lead.advance_payment))
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Mechanic Amount:</span>
                  {editingMechanicAmount ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                        value={mechanicAmountDraft}
                        onChange={(e) => setMechanicAmountDraft(e.target.value)}
                        placeholder="Amount"
                      />
                      <button
                        type="button"
                        disabled={savingMechanicAmount}
                        onClick={handleSaveMechanicAmount}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] sm:text-xs disabled:opacity-50"
                      >
                        {savingMechanicAmount ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        disabled={savingMechanicAmount}
                        onClick={() => {
                          setEditingMechanicAmount(false);
                          setMechanicAmountDraft(
                            lead.payment_to_mechanic != null ? String(lead.payment_to_mechanic) : ''
                          );
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-[10px] sm:text-xs disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900">
                        {lead.payment_to_mechanic != null && lead.payment_to_mechanic !== ''
                          ? `₹${lead.payment_to_mechanic}`
                          : '—'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingMechanicAmount(true)}
                        className="px-2 py-1 border border-gray-300 rounded text-[10px] sm:text-xs hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Remarks */}
          {(lead.remark || lead.assigned_remark || lead.dispatch_remark) && (
            <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Remarks
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                {lead.remark && (
                  <div>
                    <span className="font-medium text-gray-600">General:</span>
                    <p className="text-gray-700">{lead.remark}</p>
                  </div>
                )}
                {lead.assigned_remark && (
                  <div>
                    <span className="font-medium text-gray-600">Assignment:</span>
                    <p className="text-gray-700">{lead.assigned_remark}</p>
                  </div>
                )}
                {lead.dispatch_remark && (
                  <div>
                    <span className="font-medium text-gray-600">Dispatch:</span>
                    <p className="text-gray-700">{lead.dispatch_remark}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media */}
          <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Media
              </h3>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={rsaMediaUploading}
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    handleAddMedia(files);
                    // reset
                    e.currentTarget.value = '';
                  }}
                />
                {rsaMediaUploading ? 'Uploading…' : 'Add Media'}
              </label>
            </div>

            {rsaMediaError ? (
              <div className="mb-3 text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {rsaMediaError}
              </div>
            ) : null}

            {Array.isArray(lead.media_upload) && lead.media_upload.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {lead.media_upload.map((url: string, index: number) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={url}
                      alt={`Media ${index + 1}`}
                      className="w-full h-24 sm:h-28 md:h-32 object-cover rounded-lg hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-gray-600">No media uploaded yet.</p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5 lg:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Timeline</h2>
          <div className="space-y-3 sm:space-y-4">
            {timeline.map((entry) => (
              <div key={entry.id} className="flex gap-2 sm:gap-3 md:gap-4 pb-3 sm:pb-4 border-b border-gray-200 last:border-0">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{entry.status}</h4>
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      {formatDateTimeIST(entry.updated_at)}
                    </span>
                  </div>
                  {entry.status_description && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{entry.status_description}</p>
                  )}
                  {entry.updated_by_name && (
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">By: {entry.updated_by_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assign Manager Modal */}
        {showAssignManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-md w-full mx-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
                {lead?.assigned_manager_id ? 'Transfer to Manager' : 'Assign to Manager'}
              </h3>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg mb-3 sm:mb-4 text-xs sm:text-sm"
              >
                <option value="">Select Manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} ({manager.email})
                  </option>
                ))}
              </select>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowAssignManager(false);
                    setSelectedManagerId('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignToManager}
                  disabled={!selectedManagerId}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs sm:text-sm"
                >
                  {lead?.assigned_manager_id ? 'Transfer' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Mechanic Modal */}
        {showAssignMechanic && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Assign Mechanic</h3>

              {/* Search */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Pincode
                  </label>
                  <input
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                    placeholder="6-digit pincode"
                    value={mechanicSearchPincode}
                    onChange={(e) => setMechanicSearchPincode(normalizePincode(e.target.value))}
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                    Auto-filled from customer pincode
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Search (Name / Code / Number)
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                      placeholder="Type mechanic name, code, or phone…"
                      value={mechanicSearchTerm}
                      onChange={(e) => setMechanicSearchTerm(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={runMechanicSearch}
                      disabled={mechanicSearching}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-xs sm:text-sm whitespace-nowrap"
                    >
                      {mechanicSearching ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>

              {mechanicSearchNotice ? (
                <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  {mechanicSearchNotice}
                </div>
              ) : null}

              {/* Quick pick list (no dropdown needed) */}
              {mechanics.length > 0 ? (
                <div className="mb-3 sm:mb-4">
                  <div className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                    Available mechanics
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mechanics
                      .slice()
                      .sort((a: any, b: any) => Number(!!b?.is_available) - Number(!!a?.is_available))
                      .slice(0, 12)
                      .map((m: any) => {
                        const active = selectedMechanicId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedMechanicId(m.id)}
                            className={`text-left border rounded-lg px-3 py-2 transition ${
                              active
                                ? 'border-green-600 bg-green-50'
                                : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {m.mechanic_name || '—'}
                                </div>
                                <div className="text-[10px] sm:text-xs text-gray-600 truncate">
                                  {m.mechanic_code ? `Code: ${m.mechanic_code}` : ''}
                                  {m.number ? `  •  ${m.number}` : ''}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                  m.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {m.is_available ? 'Available' : 'Busy'}
                              </span>
                            </div>
                            {Array.isArray(m.service_areas) && m.service_areas.length > 0 ? (
                              <div className="mt-1 text-[10px] sm:text-xs text-gray-500 truncate">
                                Areas: {formatServiceAreasLabel(m.service_areas)}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                  {mechanics.length > 12 ? (
                    <div className="mt-2 text-[10px] sm:text-xs text-gray-500">
                      Showing top 12. Use search to narrow more.
                    </div>
                  ) : null}
                </div>
              ) : null}
              
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Select Mechanic
                </label>
                <select
                  value={selectedMechanicId}
                  onChange={(e) => setSelectedMechanicId(e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                >
                  <option value="">Select Mechanic</option>
                  {mechanics.map((mechanic) => (
                    <option key={mechanic.id} value={mechanic.id}>
                      {mechanic.mechanic_name} ({mechanic.mechanic_code}) - 
                      {mechanic.is_available ? ' Available' : ' Busy'}
                    </option>
                  ))}
                </select>
                {mechanics.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-600">
                    {mechanicSearching ? 'Searching mechanics…' : 'No mechanics found for the current search.'}
                  </p>
                ) : null}
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Payment Amount (Optional)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                />
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Remark (Optional)
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter any remarks"
                  rows={3}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowAssignMechanic(false);
                    setSelectedMechanicId('');
                    setPaymentAmount('');
                    setRemark('');
                    setMechanics([]);
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignMechanic}
                  disabled={!selectedMechanicId}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs sm:text-sm"
                >
                  {changingMechanic ? 'Change Mechanic' : 'Assign Mechanic'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Status Modal */}
        {showUpdateStatus && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-md w-full mx-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Update Status</h3>
              
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                >
                  <option value="">Select Status</option>
                  <option value="in_progress">Reached</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Enter notes about status change"
                  rows={3}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                />
              </div>
              {showFinanceInStatusModal && (
                <div className="mb-3 sm:mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Finance Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quoted Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={statusQuotedAmount}
                        onChange={(e) => setStatusQuotedAmount(e.target.value)}
                        placeholder="Enter quoted amount"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Mechanic Payment
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={statusMechanicAmount}
                        onChange={(e) => setStatusMechanicAmount(e.target.value)}
                        placeholder="Enter mechanic payment"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowUpdateStatus(false);
                    setNewStatus('');
                    setStatusNotes('');
                    setStatusQuotedAmount('');
                    setStatusMechanicAmount('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
        <WhatsAppMobilePreviewModal
          isOpen={waPreviewOpen}
          phoneNumber={waPreviewPhone}
          title="WhatsApp Chat"
          onClose={() => setWaPreviewOpen(false)}
        />
    </div>
  );
}

export default function RSALeadDetailPage() {
  return <RSALeadDetailPageView />;
}