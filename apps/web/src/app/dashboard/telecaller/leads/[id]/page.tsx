'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime, formatDateTimeIST } from '@/lib/utils';
import {
  Phone, Mail, MapPin, Car, Calendar, Clock, FileText,
  User, Building2, PhoneCall, MessageSquare, Edit, ArrowLeft,
  CheckCircle, AlertCircle, TrendingUp, Share2, Users, Wrench, X
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SendWhatsAppModal from '@/components/shared/SendWhatsAppModal';
import CrmLeadEditForm from '@/components/telecaller/crm/CrmLeadEditForm';
import LeadTagsPanel from '@/components/telecaller/crm/LeadTagsPanel';
import LeadTimelinePanel from '@/components/telecaller/crm/LeadTimelinePanel';
import {
  leadDisplayStatus,
} from '@/lib/telecaller/leadDisplayStatus';
import { redactLeadSourceForTelecaller } from '@/lib/telecaller/redactLeadSource';
import { parseCallDisposition } from '@/lib/telecaller/callDisposition';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

function LeadDetailContent() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const leadId = params?.id as string;
  const isEmbed = searchParams?.get('embed') === '1';
  const wrap = (node: ReactNode) =>
    isEmbed ? (
      <div className="min-h-screen bg-slate-50">{node}</div>
    ) : (
      <DashboardLayout role={layoutRole}>{node}</DashboardLayout>
    );

  const [lead, setLead] = useState<any>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [sendingPricing, setSendingPricing] = useState(false);
  const [serviceGroups, setServiceGroups] = useState<Array<{ category: string; names: string[] }>>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [peers, setPeers] = useState<Array<{ id: string; full_name: string | null; phone: string | null }>>([]);
  const [peersLoading, setPeersLoading] = useState(false);
  const [assigningTc, setAssigningTc] = useState(false);
  const SHOW_SERVICE_ADDONS = false;

  function titleCaseCat(c: string) {
    return String(c || '')
      .replace(/^CAR\s+/i, '')
      .replace(/\s+SERVICE$/i, '')
      .replace(/\s+SERVICES$/i, '')
      .split(' ')
      .map((w) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : ''))
      .join(' ')
      .trim() || 'Other';
  }

  function parseIds(raw: any): string[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof raw !== 'string') return [];
    const s = raw.trim();
    if (!s) return [];
    // If it looks like JSON, try parsing; otherwise fallback to comma-separated.
    if (s.startsWith('[') || s.startsWith('{') || s.startsWith('"')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).map((v) => v.trim()).filter(Boolean);
      } catch {
        // fall through
      }
    }
    return s.split(',').map((v) => v.trim()).filter(Boolean);
  }

  function parseCodes(raw: any): string[] {
    return parseIds(raw).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
  }

  const [callLogData, setCallLogData] = useState({
    call_status: 'ANSWERED',
    call_duration: '',
    outcome: 'INFO_COLLECTED',
    activity: 'INTERESTED',
    lost_reason: '',
    notes: ''
  });

  type ActivityOpt = {
    id: string;
    label: string;
    call_status: string;
    outcome: string | null;
    lead_status: string | null;
    requires_lost_reason?: boolean;
    requires_follow_up?: boolean;
  };

  const FALLBACK_ACTIVITY: ActivityOpt[] = [
    { id: 'FRESH', label: 'Fresh', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: null },
    { id: 'INTERESTED', label: 'Interested', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: null },
    { id: 'WILL_VISIT', label: 'He will visit', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: null },
    { id: 'CALLBACK', label: 'Follow-up', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: null },
    { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed', call_status: 'ANSWERED', outcome: 'LEAD_CREATED', lead_status: 'VALIDATED' },
    { id: 'IN_SERVICE', label: 'In Service', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: 'IN_PROGRESS' },
    { id: 'SERVICE_DONE', label: 'Service Done', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: 'COMPLETED' },
    { id: 'LOST', label: 'Lost', call_status: 'ANSWERED', outcome: 'NOT_INTERESTED', lead_status: 'REJECTED', requires_lost_reason: true },
    { id: 'RINGING', label: 'Ringing / No answer', call_status: 'NO_ANSWER', outcome: null, lead_status: null },
  ];

  const [activityOptions, setActivityOptions] = useState<ActivityOpt[]>(FALLBACK_ACTIVITY);
  const [lostReasons, setLostReasons] = useState<string[]>([
    'Not Interested',
    'Unqualified Lead',
    'No-Response to Calls',
    'Already Service Done',
    'Under Warranty',
    'Looking For Authorised Service Center',
    'Other Reasons',
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lead-manager/statuses');
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(json?.statuses) ? json.statuses : [];
        if (rows.length) {
          setActivityOptions(
            rows.map((r: any) => ({
              id: String(r.code || '').toUpperCase(),
              label: String(r.name || r.code),
              call_status: String(r.call_status || 'ANSWERED').toUpperCase(),
              outcome: r.outcome ? String(r.outcome).toUpperCase() : null,
              lead_status: r.pipeline_status ? String(r.pipeline_status).toUpperCase() : null,
              requires_lost_reason: Boolean(r.requires_lost_reason) || String(r.code).toUpperCase() === 'LOST',
              requires_follow_up: Boolean(r.requires_follow_up),
            })),
          );
        }
        const reasons = Array.isArray(json?.lost_reasons) ? json.lost_reasons : [];
        if (reasons.length) {
          setLostReasons(reasons.map((r: any) => String(r.name || '').trim()).filter(Boolean));
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [followUpData, setFollowUpData] = useState({
    follow_up_type: 'CALLBACK',
    scheduled_time: '',
    reason: '',
    priority: 'NORMAL'
  });

  useEffect(() => {
    if (leadId) {
      fetchLeadDetails();
    }
  }, [leadId]);

  // View-first (admin-style). Edit only when ?edit=1
  useEffect(() => {
    setEditing(searchParams?.get('edit') === '1');
  }, [leadId, searchParams]);

  const exitEditing = () => {
    setEditing(false);
    router.replace(`${base}/leads/${leadId}`, { scroll: false });
  };

  const finishEditing = async () => {
    setEditing(false);
    router.replace(`${base}/leads/${leadId}`, { scroll: false });
    await fetchLeadDetails();
  };

  const sanitizeLead = (row: Record<string, any>) =>
    isLeadManager ? row : redactLeadSourceForTelecaller(row);

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name, phone, city),
          created_by:created_by_id(full_name),
          assigned_telecaller:assigned_telecaller_id(id, full_name, phone)
        `)
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      const raw = leadData as Record<string, any>;
      setLead(sanitizeLead(raw));

      // Fetch service types grouped by category (Periodic / AC / Brake / Engine …)
      if (leadData.service_type_ids) {
        const serviceIds = parseIds(leadData.service_type_ids);
        if (serviceIds.length > 0) {
          const [{ data: cats }, { data: serviceTypesData }] = await Promise.all([
            supabase.from('categories').select('uuid, category'),
            supabase
              .from('service_types')
              .select('id, name, category_uuid')
              .in('id', serviceIds),
          ]);
          const categoryMap: Record<string, string> = {};
          (cats || []).forEach((c: any) => {
            if (c.uuid && c.category) categoryMap[String(c.uuid)] = String(c.category);
          });
          const order = [
            'PERIODIC', 'ENGINE', 'AC', 'BATTERY', 'BRAKE', 'CLUTCH', 'TYRE', 'WHEEL',
            'DETAILING', 'DENTING', 'PAINTING', 'ELECTRICAL', 'SUSPENSION', 'STEERING',
          ];
          const grouped = new Map<string, string[]>();
          (serviceTypesData || []).forEach((st: any) => {
            const cat = st.category_uuid
              ? categoryMap[String(st.category_uuid)] || 'Other Services'
              : 'Other Services';
            const arr = grouped.get(cat) || [];
            arr.push(String(st.name || ''));
            grouped.set(cat, arr);
          });
          const groups = Array.from(grouped.entries())
            .map(([category, names]) => ({ category, names: names.filter(Boolean) }))
            .sort((a, b) => {
              const ia = order.findIndex((o) => a.category.toUpperCase().includes(o));
              const ib = order.findIndex((o) => b.category.toUpperCase().includes(o));
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
          setServiceGroups(groups);
        } else {
          setServiceGroups([]);
        }
      } else {
        setServiceGroups([]);
      }

      // Fetch subservice names if subservice_ids exists
      if (leadData.subservice_ids) {
        const subserviceIds = parseIds(leadData.subservice_ids);
        if (subserviceIds.length > 0) {
          const { data: subservicesData } = await supabase
            .from('service_addons')
            .select('id, name')
            .in('id', subserviceIds);

          if (subservicesData) {
            setSubserviceNames(subservicesData.map((sa) => sa.name));
          }
        }
      }

      // Fetch call logs + heal status if telecaller already logged Lost/etc. but lead stayed NEW
      let logs: any[] = [];
      try {
        const res = await fetch(`/api/telecaller/calls/${leadId}`, { method: 'GET' });
        const json = await res.json().catch(() => ({}));
        logs = res.ok && Array.isArray(json?.call_logs) ? json.call_logs : [];
        setCallLogs(logs);
      } catch {
        setCallLogs([]);
      }

      const safeLead = sanitizeLead(leadData as Record<string, any>);
      const meta =
        safeLead?.coupon_meta && typeof safeLead.coupon_meta === 'object'
          ? safeLead.coupon_meta
          : {};
      const hasDisposition = Boolean(meta.last_call_result || meta.last_call_label);
      if (!hasDisposition && logs.length > 0) {
        for (const log of logs) {
          const disp = parseCallDisposition({
            notes: log?.notes,
            outcome: log?.outcome,
            call_status: log?.call_status,
          });
          if (!disp || disp.result === 'RINGING') continue;
          try {
            const healRes = await fetch(`/api/telecaller/leads/${leadId}/heal-disposition`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                last_call_result: disp.result,
                last_call_label: disp.label,
                last_lost_reason: disp.lostReason,
                last_call_status: log?.call_status || 'ANSWERED',
                status: disp.leadStatus,
                telecaller_remarks: String(log?.notes || '')
                  .replace(/^\[[^\]]+\]\s*/, '')
                  .trim() || null,
                total_calls: Math.max(Number(leadData?.total_calls || 0), logs.length),
              }),
            });
            if (healRes.ok) {
              const healed = await healRes.json().catch(() => ({}));
              if (healed?.lead) {
                setLead(sanitizeLead(healed.lead as Record<string, any>));
              } else {
                setLead({
                  ...safeLead,
                  status: disp.leadStatus || safeLead.status,
                  total_calls: Math.max(Number(leadData?.total_calls || 0), logs.length),
                  coupon_meta: {
                    ...meta,
                    last_call_result: disp.result,
                    last_call_label: disp.label,
                    last_lost_reason: disp.lostReason,
                    last_call_status: log?.call_status || 'ANSWERED',
                  },
                });
              }
            }
          } catch (e) {
            console.warn('heal disposition from call logs failed', e);
          }
          break;
        }
      }

      // Fetch follow-ups
      const { data: followUpsData } = await supabase
        .from('telecaller_follow_ups')
        .select('*, telecaller:telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('scheduled_time', { ascending: false });

      setFollowUps(followUpsData || []);

    } catch (error) {
      console.error('Error fetching lead details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCallLog() {
    try {
      const selected =
        activityOptions.find((o) => o.id === callLogData.activity) || activityOptions[0];
      const needsLost = Boolean(selected.requires_lost_reason) || selected.id === 'LOST';
      if (needsLost && !callLogData.lost_reason.trim()) {
        alert('Please select a lost reason');
        return;
      }
      const statusLabel =
        needsLost && callLogData.lost_reason
          ? `Lost · ${callLogData.lost_reason}`
          : selected.label;
      const notesParts = [`[${statusLabel}]`, callLogData.notes.trim() || null].filter(Boolean);

      const res = await fetch('/api/telecaller/calls/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          call_type: 'OUTBOUND',
          call_status: selected.call_status,
          call_duration: callLogData.call_duration ? parseInt(callLogData.call_duration) : null,
          outcome: selected.outcome,
          activity: selected.id,
          pipeline_status: selected.lead_status,
          notes: notesParts.join(' '),
          phone_number: lead?.customer_phone,
        }),
      });

      if (res.ok) {
        setCallLogData({
          call_status: 'ANSWERED',
          call_duration: '',
          outcome: 'INFO_COLLECTED',
          activity: 'INTERESTED',
          lost_reason: '',
          notes: ''
        });
        setShowCallLogForm(false);
        fetchLeadDetails();
        alert('Call log added successfully!');
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error('Call log API error:', errJson);
        alert(errJson?.error || 'Failed to add call log');
      }
    } catch (error) {
      console.error('Error adding call log:', error);
      alert('Failed to add call log');
    }
  }

  async function handleAddFollowUp() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Resolve users_login profile robustly (email -> phone -> id)
      const email = (user.email || '').trim();
      const phone = (user.phone || '').trim();
      const selectCols = 'id';

      const { data: byEmail } = email
        ? await supabase.from('users_login').select(selectCols).ilike('email', email).maybeSingle()
        : { data: null as any };
      const { data: byPhone } = !byEmail && phone
        ? await supabase.from('users_login').select(selectCols).eq('phone', phone).maybeSingle()
        : { data: null as any };
      const { data: byId } = !byEmail && !byPhone
        ? await supabase.from('users_login').select(selectCols).eq('id', user.id).maybeSingle()
        : { data: null as any };
      const userProfile = byEmail || byPhone || byId;

      // Convert datetime-local -> ISO UTC for consistent storage
      // datetime-local gives "YYYY-MM-DDTHH:mm" (no timezone, treated as browser's local time)
      // new Date() interprets it as local time, toISOString() converts to UTC automatically
      const scheduledLocal = followUpData.scheduled_time;
      const scheduledIso = scheduledLocal 
        ? new Date(scheduledLocal).toISOString()
        : null;

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .insert([{
          lead_id: leadId,
          telecaller_id: userProfile?.id,
          follow_up_type: followUpData.follow_up_type,
          scheduled_time: scheduledIso,
          reason: followUpData.reason,
          priority: followUpData.priority,
          status: 'PENDING'
        }]);

      if (!error) {
        // Update lead's follow_up flags
        await supabase
          .from('service_leads')
          .update({
            follow_up_required: true,
            next_follow_up_at: scheduledIso
          })
          .eq('id', leadId);

        setFollowUpData({
          follow_up_type: 'CALLBACK',
          scheduled_time: '',
          reason: '',
          priority: 'NORMAL'
        });
        setShowFollowUpForm(false);
        fetchLeadDetails();
        alert('Follow-up scheduled successfully!');
      }
    } catch (error) {
      console.error('Error adding follow-up:', error);
      alert('Failed to schedule follow-up');
    }
  }

  async function openSharePanel() {
    setShareOpen(true);
    setPeersLoading(true);
    try {
      const res = await fetch('/api/telecaller/crm/transfer?peers=1');
      const json = await res.json().catch(() => ({}));
      setPeers(Array.isArray(json?.peers) ? json.peers : []);
    } catch {
      setPeers([]);
    } finally {
      setPeersLoading(false);
    }
  }

  async function assignOrTransferTelecaller(toId: string, type: 'TRANSFER' | 'SHARE' = 'TRANSFER') {
    if (!toId) return;
    setAssigningTc(true);
    try {
      if (isLeadManager) {
        const res = await fetch('/api/lead-manager/assign-telecaller', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId, telecaller_id: toId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || 'Assign failed');
      } else {
        const res = await fetch('/api/telecaller/crm/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            to_telecaller_id: toId,
            transfer_type: type,
            reason: type === 'SHARE' ? 'Shared from lead detail' : 'Transferred from lead detail',
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || 'Transfer failed');
      }
      setShareOpen(false);
      await fetchLeadDetails();
      alert(isLeadManager ? 'Telecaller assigned' : 'Lead updated');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAssigningTc(false);
    }
  }

  const PIPELINE = [
    { id: 'NEW', label: 'Fresh' },
    { id: 'INTERESTED', label: 'Interested' },
    { id: 'WILL_VISIT', label: 'Will Visit' },
    { id: 'VALIDATED', label: 'Confirmed' },
    { id: 'IN_PROGRESS', label: 'In Service' },
    { id: 'COMPLETED', label: 'Done' },
  ] as const;

  function pipelineActiveIndex(l: any): number {
    const result = String(l?.coupon_meta?.last_call_result || '').toUpperCase();
    const status = String(l?.status || '').toUpperCase();
    if (status === 'REJECTED' || result === 'LOST') return -1;
    if (status === 'COMPLETED') return 5;
    if (status === 'IN_PROGRESS') return 4;
    if (status === 'VALIDATED' || result === 'BOOKING_CONFIRMED') return 3;
    if (result === 'WILL_VISIT') return 2;
    if (result === 'INTERESTED') return 1;
    if (l?.is_incomplete) return 0;
    return 0;
  }

  if (loading) {
    return wrap(
      <div className="flex items-center justify-center h-48 sm:h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading lead details...</p>
        </div>
      </div>,
    );
  }

  if (!lead) {
    return wrap(
      <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-500">Lead not found</p>
          <Link href={`${base}/leads`} className="btn btn-primary mt-4">
            Back to Leads
          </Link>
        </div>,
    );
  }

  return wrap(
    <>
      <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-8">
        {editing ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {lead.customer_phone ? (
                <a
                  href={`tel:${lead.customer_phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white shadow-sm"
                >
                  <PhoneCall className="w-4 h-4" /> Call
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void openSharePanel()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200"
              >
                <Share2 className="w-4 h-4" />
                {isLeadManager ? 'Assign' : 'Share'}
              </button>
            </div>
            <CrmLeadEditForm
              leadId={leadId}
              embedded
              onCancel={exitEditing}
              onSaved={() => void finishEditing()}
            />
          </div>
        ) : (
          <>
        <div className="relative overflow-hidden rounded-2xl bg-[#023D95] text-white p-4 sm:p-6 shadow-lg">
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {!isEmbed ? (
                  <button type="button" onClick={() => router.push(`${base}/leads`)} className="rounded-xl bg-white/15 hover:bg-white/25 p-2 shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                    {isLeadManager ? 'Lead Manager · Service Lead Details' : 'Telecaller · Service Lead Details'}
                  </p>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black truncate mt-0.5 text-white">
                    {lead.customer_name || 'Unknown customer'}
                  </h1>
                  <p className="text-sm text-blue-50 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-mono font-bold text-white">#{lead.lead_number}</span>
                    <span className="text-white/95">{lead.customer_phone}</span>
                    <span className="text-white/90">Created {formatDateTime(lead.created_at)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {lead.customer_phone ? (
                  <a
                    href={`tel:${lead.customer_phone}`}
                    title="Call"
                    aria-label="Call"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow"
                  >
                    <PhoneCall className="w-4 h-4" />
                  </a>
                ) : null}
                {lead.customer_phone ? (
                  <button
                    type="button"
                    title="WhatsApp"
                    aria-label="WhatsApp"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('myfng:open-wa-chat', {
                          detail: {
                            phone: String(lead.customer_phone || '').replace(/\D/g, ''),
                            preview: lead.problem_description || undefined,
                          },
                        }),
                      );
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white shadow"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Edit"
                  aria-label="Edit"
                  onClick={() => {
                    setEditing(true);
                    router.replace(`${base}/leads/${leadId}?edit=1${isEmbed ? '&embed=1' : ''}`, { scroll: false });
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#023D95]"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title={isLeadManager ? 'Assign TC' : 'Share'}
                  aria-label={isLeadManager ? 'Assign TC' : 'Share'}
                  onClick={() => void openSharePanel()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{leadDisplayStatus(lead)}</span>
              {lead.is_incomplete ? (
                <span className="rounded-full bg-amber-400 text-amber-950 px-3 py-1 text-xs font-black">Incomplete</span>
              ) : null}
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Priority {lead.lead_priority || 'NORMAL'}</span>
              {lead.assigned_telecaller?.full_name ? (
                <span className="rounded-full bg-indigo-300/30 px-3 py-1 text-xs font-semibold inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> TC: {lead.assigned_telecaller.full_name}
                </span>
              ) : (
                <span className="rounded-full bg-rose-400/30 px-3 py-1 text-xs font-semibold">Telecaller unassigned</span>
              )}
              {lead.workshop?.name ? (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {lead.workshop.name}
                </span>
              ) : null}
            </div>

            <div className="rounded-xl bg-white/10 p-3 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-[520px]">
                {PIPELINE.map((step, idx) => {
                  const active = pipelineActiveIndex(lead);
                  const lost = active < 0;
                  const done = !lost && idx <= active;
                  const current = !lost && idx === active;
                  return (
                    <div key={step.id} className="flex items-center flex-1 min-w-0">
                      <div className={`flex-1 rounded-lg px-2 py-1.5 text-center text-[10px] sm:text-[11px] font-bold truncate ${
                        lost ? 'bg-rose-500/40 text-white' : done ? (current ? 'bg-white text-[#023D95]' : 'bg-emerald-400/80 text-emerald-950') : 'bg-white/10 text-blue-100'
                      }`}>{step.label}</div>
                      {idx < PIPELINE.length - 1 ? <div className={`w-2 h-0.5 shrink-0 ${done ? 'bg-emerald-300' : 'bg-white/20'}`} /> : null}
                    </div>
                  );
                })}
              </div>
              {pipelineActiveIndex(lead) < 0 ? (
                <p className="text-[11px] text-rose-100 mt-2 font-semibold">Lead marked Lost / Rejected</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
              <h2 className="text-base sm:text-lg font-black text-[#023D95] flex items-center gap-2 mb-3"><User className="w-5 h-5" /> Customer</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoItem icon={<User className="w-4 h-4" />} label="Name" value={lead.customer_name || '—'} />
                <InfoItem icon={<Phone className="w-4 h-4" />} label="Phone" value={lead.customer_phone || '—'} />
                {lead.customer_alternate_phone ? <InfoItem icon={<Phone className="w-4 h-4" />} label="Alternate" value={lead.customer_alternate_phone} /> : null}
                {lead.customer_email ? <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={lead.customer_email} /> : null}
                <InfoItem icon={<MapPin className="w-4 h-4" />} label="City" value={lead.city || 'N/A'} />
                {lead.pincode ? <InfoItem icon={<MapPin className="w-4 h-4" />} label="Pincode" value={lead.pincode} /> : null}
                {lead.customer_address ? <InfoItem icon={<MapPin className="w-4 h-4" />} label="Address" value={lead.customer_address} className="sm:col-span-2" /> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
              <h2 className="text-base sm:text-lg font-black text-[#023D95] flex items-center gap-2 mb-3"><Car className="w-5 h-5" /> Vehicle</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoItem icon={<Car className="w-4 h-4" />} label="Registration" value={lead.vehicle_number || 'Not provided'} />
                <InfoItem icon={<Car className="w-4 h-4" />} label="Make" value={lead.vehicle_make || 'N/A'} />
                <InfoItem icon={<Car className="w-4 h-4" />} label="Model" value={lead.vehicle_model || 'N/A'} />
                {lead.vehicle_variant ? <InfoItem icon={<Car className="w-4 h-4" />} label="Variant" value={lead.vehicle_variant} /> : null}
                {lead.vehicle_year ? <InfoItem icon={<Calendar className="w-4 h-4" />} label="Year" value={String(lead.vehicle_year)} /> : null}
                {lead.vehicle_fuel_type ? <InfoItem icon={<Car className="w-4 h-4" />} label="Fuel" value={lead.vehicle_fuel_type} /> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
              <h2 className="text-base sm:text-lg font-black text-[#023D95] flex items-center gap-2 mb-3"><FileText className="w-5 h-5" /> Service</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Service types</p>
                  {serviceGroups.length > 0 ? serviceGroups.map((group) => (
                    <div key={group.category} className="mb-2">
                      <p className="text-[11px] font-bold text-blue-800/80 uppercase tracking-wide mb-1">{titleCaseCat(group.category)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.names.map((n) => (
                          <span key={n} className="rounded-full bg-blue-50 text-blue-800 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-blue-100">{n}</span>
                        ))}
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-500">Not specified</p>}
                </div>
                {(lead.problem_description || lead.description) ? (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Customer message</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{lead.problem_description || lead.description}</p>
                  </div>
                ) : null}
                {lead.payment_mode ? (
                  <p className="text-sm text-slate-700"><span className="font-bold">Payment:</span> {lead.payment_mode}</p>
                ) : null}
                {lead.pickup_required ? (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <p className="text-sm font-bold text-blue-800">Pickup required</p>
                    {lead.pickup_address ? <p className="text-sm text-slate-600 mt-1">{lead.pickup_address}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 sm:p-5 shadow-sm">
              <h2 className="text-base sm:text-lg font-black text-[#023D95] flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5" /> Payment & pricing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Estimated amount"
                  value={
                    lead.estimated_amount != null && lead.estimated_amount !== ''
                      ? `Rs ${Number(lead.estimated_amount).toLocaleString('en-IN')}`
                      : '—'
                  }
                />
                <InfoItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Actual / payable"
                  value={
                    lead.actual_amount != null && lead.actual_amount !== ''
                      ? `Rs ${Number(lead.actual_amount).toLocaleString('en-IN')}`
                      : lead.payable_amount != null
                        ? `Rs ${Number(lead.payable_amount).toLocaleString('en-IN')}`
                        : '—'
                  }
                />
                <InfoItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Coupon code"
                  value={
                    lead.coupon_display_code ||
                    lead.coupon_code ||
                    (lead.coupon_meta as any)?.coupon_code ||
                    '—'
                  }
                />
                <InfoItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Discount"
                  value={
                    Number(lead.discount_amount || lead.coupon_display_discount || 0) > 0
                      ? `Rs ${Number(lead.discount_amount || lead.coupon_display_discount).toLocaleString('en-IN')}`
                      : '—'
                  }
                />
                <InfoItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Payment mode"
                  value={lead.payment_mode || '—'}
                />
                <InfoItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Payment status"
                  value={lead.payment_status || '—'}
                />
                {Number((lead.coupon_meta as any)?.wallet_deduction || lead.wallet_deduction || 0) >
                0 ? (
                  <InfoItem
                    icon={<FileText className="w-4 h-4" />}
                    label="Wallet used"
                    value={`Rs ${Number(
                      (lead.coupon_meta as any)?.wallet_deduction || lead.wallet_deduction,
                    ).toLocaleString('en-IN')}`}
                  />
                ) : null}
                {Number((lead.coupon_meta as any)?.service_subtotal || 0) > 0 ? (
                  <InfoItem
                    icon={<FileText className="w-4 h-4" />}
                    label="Service subtotal"
                    value={`Rs ${Number((lead.coupon_meta as any).service_subtotal).toLocaleString('en-IN')}`}
                  />
                ) : null}
              </div>
            </div>

            {isLeadManager ? (
              <div className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5 shadow-sm">
                <h2 className="text-base sm:text-lg font-black text-[#023D95] mb-3">
                  Campaign / source (managers)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoItem
                    icon={<FileText className="w-4 h-4" />}
                    label="Lead source"
                    value={
                      lead.lead_source ||
                      lead.created_from ||
                      lead.booking_source_label ||
                      '—'
                    }
                  />
                  <InfoItem icon={<FileText className="w-4 h-4" />} label="UTM source" value={lead.utm_source || '—'} />
                  <InfoItem icon={<FileText className="w-4 h-4" />} label="UTM medium" value={lead.utm_medium || '—'} />
                  <InfoItem icon={<FileText className="w-4 h-4" />} label="UTM campaign" value={lead.utm_campaign || '—'} />
                  <InfoItem icon={<FileText className="w-4 h-4" />} label="UTM term" value={lead.utm_term || '—'} />
                  <InfoItem icon={<FileText className="w-4 h-4" />} label="UTM content" value={lead.utm_content || '—'} />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h2 className="text-base sm:text-lg font-black text-[#023D95] flex items-center gap-2">
                  <PhoneCall className="w-5 h-5" /> Activity · Calls ({callLogs.length})
                </h2>
                <button type="button" onClick={() => setShowCallLogForm(!showCallLogForm)} className="rounded-xl bg-[#004AAD] text-white px-3 py-2 text-xs font-bold">
                  {showCallLogForm ? 'Close' : '+ Log disposition'}
                </button>
              </div>
              {showCallLogForm && (
                <div className="mb-4 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select
                    value={callLogData.activity}
                    onChange={(e) => {
                      const next = e.target.value;
                      const opt = activityOptions.find((o) => o.id === next);
                      const needsLost = Boolean(opt?.requires_lost_reason) || next === 'LOST';
                      setCallLogData({
                        ...callLogData,
                        activity: next,
                        lost_reason: needsLost ? callLogData.lost_reason : '',
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  >
                    {activityOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {(callLogData.activity === 'LOST' ||
                    activityOptions.find((o) => o.id === callLogData.activity)?.requires_lost_reason) && (
                    <select value={callLogData.lost_reason} onChange={(e) => setCallLogData({ ...callLogData, lost_reason: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl">
                      <option value="">Select lost reason</option>
                      {lostReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  <input type="number" placeholder="Duration (seconds)" value={callLogData.call_duration} onChange={(e) => setCallLogData({ ...callLogData, call_duration: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  <textarea placeholder="Notes / remarks..." value={callLogData.notes} onChange={(e) => setCallLogData({ ...callLogData, notes: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl" rows={3} />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddCallLog} className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-sm font-bold">Save</button>
                    <button type="button" onClick={() => setShowCallLogForm(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">Cancel</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {callLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No call activity yet</p>
                ) : callLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${log.call_status === 'ANSWERED' ? 'bg-emerald-100 text-emerald-700' : log.call_status === 'NO_ANSWER' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-700'}`}>
                        {String(log.notes || '').match(/^\[([^\]]+)\]/)?.[1] || log.call_status}
                      </span>
                      {log.call_duration ? <span className="text-xs text-slate-500">{Math.floor(log.call_duration / 60)}m {log.call_duration % 60}s</span> : null}
                      {log.outcome ? <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">{log.outcome}</span> : null}
                    </div>
                    {log.notes ? <p className="text-sm text-slate-700">{log.notes}</p> : null}
                    <p className="text-[11px] text-slate-500 mt-1">{formatDateTime(log.created_at)} · {log.telecaller?.full_name || 'Telecaller'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="font-black text-[#023D95] mb-3">Quick stats</h3>
              <div className="space-y-2.5">
                <StatItem label="Total calls" value={Math.max(Number(lead.total_calls || 0), callLogs.length)} icon={<PhoneCall className="w-4 h-4" />} />
                {lead.last_call_at ? <StatItem label="Last call" value={formatDateTime(lead.last_call_at)} icon={<Clock className="w-4 h-4" />} /> : null}
              </div>
            </div>

            <LeadTagsPanel leadId={leadId} canManage={isLeadManager} />
            <LeadTimelinePanel leadId={leadId} />

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-black text-indigo-900 flex items-center gap-1.5"><Users className="w-4 h-4" /> Telecaller</h3>
                <button type="button" onClick={() => void openSharePanel()} className="text-xs font-bold text-indigo-700 hover:underline">{lead.assigned_telecaller_id ? 'Change' : 'Assign'}</button>
              </div>
              {lead.assigned_telecaller?.full_name ? (
                <div>
                  <p className="font-bold text-slate-900">{lead.assigned_telecaller.full_name}</p>
                  {lead.assigned_telecaller.phone ? (
                    <a href={`tel:${lead.assigned_telecaller.phone}`} className="text-sm text-indigo-700 font-semibold">{lead.assigned_telecaller.phone}</a>
                  ) : <p className="text-xs text-slate-500">No phone on profile</p>}
                </div>
              ) : <p className="text-sm text-rose-700 font-semibold">Unassigned — assign for follow-up</p>}
              {isLeadManager ? (
                <Link href="/dashboard/lead_manager/assignment" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-800 hover:underline">
                  <Wrench className="w-3.5 h-3.5" /> Workshop assignment queue
                </Link>
              ) : null}
            </div>

            {lead.workshop ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="font-black text-[#023D95] flex items-center gap-1.5 mb-2"><Building2 className="w-4 h-4" /> Workshop</h3>
                <p className="font-bold">{lead.workshop.name}</p>
                <p className="text-sm text-slate-600">{lead.workshop.city}</p>
                <p className="text-sm text-slate-600">{lead.workshop.phone}</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-[#023D95] flex items-center gap-1.5"><Clock className="w-4 h-4" /> Follow-ups</h3>
                <button type="button" onClick={() => setShowFollowUpForm(!showFollowUpForm)} className="text-xs font-bold text-[#004AAD]">+ Add</button>
              </div>
              {showFollowUpForm && (
                <div className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <select value={followUpData.follow_up_type} onChange={(e) => setFollowUpData({ ...followUpData, follow_up_type: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded-lg">
                    <option value="CALLBACK">Follow-up</option>
                    <option value="PRICE_CONFIRMATION">Price Confirmation</option>
                    <option value="INFO_PENDING">Info Pending</option>
                    <option value="SLOT_CONFIRMATION">Slot Confirmation</option>
                  </select>
                  <input type="datetime-local" value={followUpData.scheduled_time} onChange={(e) => setFollowUpData({ ...followUpData, scheduled_time: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded-lg" />
                  <textarea placeholder="Reason..." value={followUpData.reason} onChange={(e) => setFollowUpData({ ...followUpData, reason: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded-lg" rows={2} />
                  <select value={followUpData.priority} onChange={(e) => setFollowUpData({ ...followUpData, priority: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded-lg">
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  <button type="button" onClick={handleAddFollowUp} className="w-full rounded-lg bg-[#004AAD] text-white py-1.5 text-xs font-bold">Schedule</button>
                </div>
              )}
              {followUps.length === 0 ? <p className="text-sm text-slate-400">No follow-ups</p> : (
                <div className="space-y-2">
                  {followUps.map((fu: any) => (
                    <div key={fu.id} className={`rounded-lg p-2.5 text-xs border ${fu.status === 'PENDING' ? 'border-violet-200 bg-violet-50' : 'border-slate-200'}`}>
                      <p className="font-bold text-violet-900">{fu.follow_up_type || 'Follow-up'}</p>
                      <p className="text-violet-800">{fu.scheduled_time ? formatDateTimeIST(fu.scheduled_time) : '—'}</p>
                      {fu.reason ? <p className="text-slate-600 mt-0.5">{fu.reason}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
              <h3 className="font-black text-[#023D95] mb-1">Quick actions</h3>
              <button type="button" onClick={() => setShowWhatsAppModal(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#004AAD] text-[#004AAD] py-2.5 text-sm font-bold hover:bg-blue-50">
                <MessageSquare className="w-4 h-4" /> Send WhatsApp
              </button>
              <button
                type="button"
                disabled={sendingPricing}
                onClick={async () => {
                  const pincode = String(lead?.pincode || '').replace(/\D/g, '').slice(0, 6);
                  const carModel = [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ').trim();
                  const serviceTypeIds = parseIds(lead?.service_type_ids);
                  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
                  const savedCategories = Array.isArray((meta as any).pricing_categories)
                    ? (meta as any).pricing_categories.map((c: any) => String(c || '').trim()).filter(Boolean)
                    : [];
                  const pricingCategories = savedCategories.length ? savedCategories : ['Car Periodic Service'];
                  if (!/^\d{6}$/.test(pincode)) { alert('Fill 6-digit pincode on the lead first.'); return; }
                  if (!carModel) { alert('Fill car model on the lead first.'); return; }
                  const modeHint = serviceTypeIds.length ? 'selected plan(s) only' : `all ${pricingCategories.join(', ')} plans`;
                  if (!confirm(`Send pricing (${modeHint}) · ${carModel} · PIN ${pincode}?`)) return;
                  setSendingPricing(true);
                  try {
                    const res = await fetch(`/api/telecaller/leads/${leadId}/send-pricing`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        pincode,
                        carModel,
                        serviceTypeIds: serviceTypeIds.length ? serviceTypeIds : undefined,
                        categories: serviceTypeIds.length ? (pricingCategories.length ? pricingCategories : undefined) : pricingCategories,
                      }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || !json?.success) throw new Error(json?.message || json?.error || 'Failed to send pricing');
                    alert(json.message || 'Pricing sent on WhatsApp.');
                  } catch (e: any) {
                    alert(e?.message || 'Could not send pricing link.');
                  } finally {
                    setSendingPricing(false);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#004AAD] text-white py-2.5 text-sm font-bold disabled:opacity-50"
              >
                <TrendingUp className="w-4 h-4" />
                {sendingPricing ? 'Sending…' : 'Send Pricing on WhatsApp'}
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-black text-[#023D95]">{isLeadManager ? 'Assign telecaller' : 'Share / Transfer'}</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {peersLoading ? <p className="text-sm text-slate-400 text-center py-8">Loading…</p> : peers.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No telecallers found</p> : peers.map((peer) => (
                <button key={peer.id} type="button" disabled={assigningTc} onClick={() => void assignOrTransferTelecaller(peer.id, 'TRANSFER')} className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-indigo-50 flex items-center justify-between gap-2 disabled:opacity-50">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{peer.full_name || 'Telecaller'}</p>
                    <p className="text-xs text-slate-500">{peer.phone || 'No phone'}</p>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700">Assign</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <SendWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        leadId={leadId}
        leadNumber={lead?.lead_number}
        defaultPhone={lead?.customer_phone}
        defaultCustomerName={lead?.customer_name}
      />
    </>,
  );
}

export default function LeadDetailPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="telecaller">
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary mx-auto" />
              <p className="mt-3 text-gray-600 text-sm">Loading lead details...</p>
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <LeadDetailContent />
    </Suspense>
  );
}


interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}

function InfoItem({ icon, label, value, className = '' }: InfoItemProps) {
  return (
    <div className={`flex items-start gap-2 sm:gap-3 ${className}`}>
      <div className="text-gray-400 mt-0.5 sm:mt-1 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900 break-words text-xs sm:text-sm">{value}</p>
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatItem({ label, value, icon }: StatItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="text-gray-400 flex-shrink-0">{icon}</div>
        <span className="text-xs sm:text-sm text-gray-600">{label}</span>
      </div>
      <span className="font-semibold text-xs sm:text-sm">{value}</span>
    </div>
  );
}

