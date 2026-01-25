'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, User, Car, FileText, ExternalLink, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { formatDateDMY } from "@/lib/utils";

interface ExtraWorkRequest {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_fuel_type?: string | null;
  vehicle_class?: string | null;
  customer_public_enabled?: boolean;
  mechanic_name: string;
  description: string;
  reason: string;
  amount: number;
  oem_price?: number;
  oes_price?: number;
  labour_price?: number;
  part_price_type?: string;
  customer_approved?: boolean;
  customer_approved_at?: string | null;
  rejection_reason?: string | null;
  supervisor_approval_notes?: string | null;
  master_oem_price?: number;
  master_oes_price?: number;
  master_labour_price?: number;
  category: string;
  is_urgent: boolean;
  created_at: string;
  status: string;
}

export default function ExtraWorkApprovalsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ExtraWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedPricing, setEditedPricing] = useState<Record<string, { oem: string; oes: string; labour: string }>>(
    {}
  );
  const [expandedRequestIds, setExpandedRequestIds] = useState<Record<string, boolean>>({});
  
  const [savingLeadIds, setSavingLeadIds] = useState<Record<string, boolean>>({});
  const [cancellingRequestIds, setCancellingRequestIds] = useState<Record<string, boolean>>({});
  const [approvingRequestIds, setApprovingRequestIds] = useState<Record<string, boolean>>({});
  const [approveModal, setApproveModal] = useState<{
    open: boolean;
    requestId: string | null;
    choice: 'OEM' | 'OES';
  }>({ open: false, requestId: null, choice: 'OEM' });
  const [approveModalNotes, setApproveModalNotes] = useState('');

  const [publicLinkBusyByLeadId, setPublicLinkBusyByLeadId] = useState<Record<string, boolean>>({});

  function getDecisionLabel(r: ExtraWorkRequest) {
    const status = String(r.status || 'PENDING').toUpperCase();
    const byCustomer = Boolean(r.customer_approved_at);
    const customerApproved = Boolean(r.customer_approved);
    if (status === 'REJECTED') return byCustomer ? 'REJECTED • Customer' : 'REJECTED • Advisor';
    if (status === 'APPROVED') {
      const choice = String(r.part_price_type || 'OEM').toUpperCase();
      if (byCustomer && customerApproved) return `APPROVED • Customer (${choice})`;
      if (byCustomer && !customerApproved) return `APPROVED • Advisor (Override)`;
      return 'APPROVED • Advisor';
    }
    return 'PENDING';
  }

  const pendingRequests = useMemo(
    () => requests.filter((r) => String(r.status || 'PENDING').toUpperCase() === 'PENDING'),
    [requests]
  );

  async function cancelRequest(requestId: string) {
    const reason = (typeof window !== 'undefined'
      ? window.prompt('Cancel reason (optional):', '')
      : '') || '';
    try {
      setCancellingRequestIds((p) => ({ ...p, [requestId]: true }));
      const res = await fetch('/api/supervisor/extra-work/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, reason }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) {
        toast.error(data?.error || 'Failed to cancel');
        return;
      }
      toast.success('Cancelled');
      await fetchExtraWorkRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel');
    } finally {
      setCancellingRequestIds((p) => ({ ...p, [requestId]: false }));
    }
  }

  async function approveRequest(requestId: string, part_price_type: 'OEM' | 'OES', notes?: string) {
    try {
      setApprovingRequestIds((p) => ({ ...p, [requestId]: true }));
      const res = await fetch('/api/supervisor/extra-work/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, part_price_type, notes }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) {
        toast.error(data?.error || 'Failed to approve');
        return;
      }
      toast.success(`Approved (${part_price_type})`);
      await fetchExtraWorkRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve');
    } finally {
      setApprovingRequestIds((p) => ({ ...p, [requestId]: false }));
    }
  }

  const approveModalRequest = useMemo(() => {
    if (!approveModal.open || !approveModal.requestId) return null;
    return requests.find((r) => r.id === approveModal.requestId) || null;
  }, [approveModal.open, approveModal.requestId, requests]);

  const approveModalTotals = useMemo(() => {
    const r = approveModalRequest;
    if (!r) return { oem: 0, oes: 0 };
    const p = getEffectivePricingForRequest(r);
    return { oem: p.total_oem, oes: p.total_oes };
  }, [approveModalRequest, editedPricing]);

  const approveModalIsOverride = useMemo(() => {
    const r = approveModalRequest;
    if (!r) return false;
    const status = String(r.status || 'PENDING').toUpperCase();
    // Customer rejection sets status=REJECTED and customer_approved_at is set.
    return status === 'REJECTED' && Boolean(r.customer_approved_at);
  }, [approveModalRequest]);

  async function safeReadJson(res: Response): Promise<any | null> {
    try {
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    } catch {
      return null;
    }
  }

  async function setLeadPublicLinkEnabled(leadId: string, enabled: boolean) {
    try {
      setPublicLinkBusyByLeadId((p) => ({ ...p, [leadId]: true }));
      const res = await fetch(`/api/workshop/leads/${leadId}/public-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) {
        toast.error((data as any)?.error || 'Failed to update public link');
        return;
      }
      toast.success(enabled ? 'Public link enabled' : 'Public link disabled');
      await fetchExtraWorkRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update public link');
    } finally {
      setPublicLinkBusyByLeadId((p) => ({ ...p, [leadId]: false }));
    }
  }

  useEffect(() => {
    fetchExtraWorkRequests();
    
    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('extra-work-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_extra_charges'
        },
        (payload) => {
          console.log('Additional job request updated:', payload);
          fetchExtraWorkRequests();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function fetchExtraWorkRequests() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const email = (user.email || '').trim();
      const phone = (user.phone || '').trim();

      const { data: userProfileByEmail } = email
        ? await supabase.from('users_login').select('workshop_id').ilike('email', email).maybeSingle()
        : { data: null };

      const { data: userProfileByPhone } = !userProfileByEmail && phone
        ? await supabase.from('users_login').select('workshop_id').eq('phone', phone).maybeSingle()
        : { data: null };

      const userProfile = userProfileByEmail || userProfileByPhone;

      if (!userProfile?.workshop_id) {
        toast.error('User profile not found');
        return;
      }

      // Fetch workshop additional jobs master prices (for fallback display)
      const { data: masterJobs, error: masterError } = await supabase
        .from('additional_jobs_master')
        .select('id, name, oem_price, oes_price, labour_price, workshop_id, is_active, deleted_at')
        .or(`workshop_id.eq.${userProfile.workshop_id},workshop_id.is.null`)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (masterError) {
        console.warn('Failed to fetch additional_jobs_master:', masterError);
      }

      const normalizeName = (s: string) =>
        (s || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ');

      const masterByName = new Map<string, { id: string; oem: number; oes: number; labour: number; workshop_id: string | null }>();
      for (const it of masterJobs || []) {
        const key = normalizeName(String((it as any).name || ''));
        const id = String((it as any).id || '').trim();
        const oem = Number((it as any).oem_price);
        const oes = Number((it as any).oes_price);
        const labour = Number((it as any).labour_price);
        if (!key) continue;
        // Prefer workshop-specific row over global (null workshop_id) if duplicates exist
        if ((it as any).workshop_id === userProfile.workshop_id) {
          masterByName.set(key, {
            id,
            oem: Number.isFinite(oem) ? oem : 0,
            oes: Number.isFinite(oes) ? oes : 0,
            labour: Number.isFinite(labour) ? labour : 0,
            workshop_id: (it as any).workshop_id ?? null,
          });
        } else if (!masterByName.has(key)) {
          masterByName.set(key, {
            id,
            oem: Number.isFinite(oem) ? oem : 0,
            oes: Number.isFinite(oes) ? oes : 0,
            labour: Number.isFinite(labour) ? labour : 0,
            workshop_id: (it as any).workshop_id ?? null,
          });
        }
      }

      // Fetch labour matrix rates for these master items (best-effort)
      const masterIds = Array.from(new Set(Array.from(masterByName.values()).map((v) => v.id).filter(Boolean)));
      const labourRatesByJobId = new Map<string, Map<string, number>>();
      if (masterIds.length) {
        const { data: labourRates, error: lrErr } = await supabase
          .from('additional_jobs_master_labour_rates')
          .select('additional_job_id, fuel_type, car_class, labour_price')
          .in('additional_job_id', masterIds);
        if (lrErr) {
          console.warn('Failed to fetch additional_jobs_master_labour_rates:', lrErr);
        } else {
          for (const r of labourRates || []) {
            const jobId = String((r as any).additional_job_id || '').trim();
            const fuel = String((r as any).fuel_type || '').trim().toUpperCase();
            const cls = String((r as any).car_class || '').trim();
            const price = Number((r as any).labour_price ?? 0);
            if (!jobId || !fuel || !cls) continue;
            if (!Number.isFinite(price) || price < 0) continue;
            const key = `${fuel}::${cls.toLowerCase()}`;
            if (!labourRatesByJobId.has(jobId)) labourRatesByJobId.set(jobId, new Map());
            labourRatesByJobId.get(jobId)!.set(key, price);
          }
        }
      }

      // Fetch pending additional job requests
      // Some DBs may not yet have OEM/OES/Labour columns. Try full select first, fallback to legacy.
      let extraWork: any[] | null = null;
      let error: any = null;

      const fullSelect = `
          id,
          lead_id,
          description,
          reason,
          amount,
          oem_price,
          oes_price,
          labour_price,
          part_price_type,
          customer_approved,
          customer_approved_at,
          rejection_reason,
          supervisor_approval_notes,
          category,
          is_urgent,
          created_at,
          status,
          requested_by,
          service_leads!inner(
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_fuel_type,
            model_id,
            workshop_id,
            customer_public_enabled
          )
        `;

      const legacySelect = `
          id,
          lead_id,
          description,
          reason,
          amount,
          category,
          is_urgent,
          created_at,
          status,
          requested_by,
          service_leads!inner(
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_fuel_type,
            model_id,
            workshop_id,
            customer_public_enabled
          )
        `;

      const attempt = await supabase
        .from('lead_extra_charges')
        .select(fullSelect)
        .eq('service_leads.workshop_id', userProfile.workshop_id)
        .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: false });

      extraWork = attempt.data as any;
      error = attempt.error as any;

      if (error && (error.code === '42703' || /does not exist/i.test(String(error.message || '')))) {
        const fallback = await supabase
          .from('lead_extra_charges')
          .select(legacySelect)
          .eq('service_leads.workshop_id', userProfile.workshop_id)
          .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
          .order('is_urgent', { ascending: false })
          .order('created_at', { ascending: false });
        extraWork = fallback.data as any;
        error = fallback.error as any;
      }

      if (error) {
        console.error('Error fetching additional job:', error);
        toast.error('Failed to fetch additional job requests');
        return;
      }

      // Resolve car class for each lead (best-effort): model_id -> car_models.class
      const modelIds = Array.from(
        new Set(
          (extraWork || [])
            .map((r: any) => String(r?.service_leads?.model_id || '').trim())
            .filter((id: string) => id)
        )
      );
      const classByModelId = new Map<string, string>();
      if (modelIds.length) {
        const { data: models, error: cmErr } = await supabase.from('car_models').select('id, class').in('id', modelIds);
        if (cmErr) {
          console.warn('Failed to fetch car_models for class:', cmErr);
        } else {
          for (const m of models || []) {
            const id = String((m as any).id || '').trim();
            const cls = String((m as any).class || '').trim();
            if (id && cls) classByModelId.set(id, cls);
          }
        }
      }

      // Fetch mechanic names
      const requestsWithMechanics = await Promise.all((extraWork || []).map(async (req: any) => {
        const { data: mechanic } = await supabase
          .from('users_login')
          .select('full_name')
          .eq('id', req.requested_by)
          .single();

        const savedAmount = Number(req.amount);
        const amount = Number.isFinite(savedAmount) ? savedAmount : 0;
        const savedOem = Number((req as any).oem_price);
        const savedOes = Number((req as any).oes_price);
        const savedLabour = Number((req as any).labour_price);

        const fuelRaw = String(req?.service_leads?.vehicle_fuel_type || '').trim().toUpperCase();
        const fuel = fuelRaw === 'DIESEL' ? 'DIESEL' : fuelRaw === 'CNG' ? 'CNG' : fuelRaw ? 'PETROL' : '';
        const modelId = String(req?.service_leads?.model_id || '').trim();
        const vehicleClass = modelId ? (classByModelId.get(modelId) || null) : null;

        const master = masterByName.get(normalizeName(String(req.description || ''))) || {
          id: '',
          oem: 0,
          oes: 0,
          labour: 0,
          workshop_id: null,
        };

        // Matrix lookup: if (job + fuel + class) rate exists, override master labour; else fallback to default master labour
        let masterLabour = master.labour;
        if (master.id && fuel && vehicleClass) {
          const k = `${fuel}::${vehicleClass.toLowerCase()}`;
          const v = labourRatesByJobId.get(master.id)?.get(k);
          if (typeof v === 'number') masterLabour = v;
        }

        return {
          id: req.id,
          lead_id: req.lead_id,
          lead_number: req.service_leads.lead_number,
          customer_name: req.service_leads.customer_name,
          vehicle_number: req.service_leads.vehicle_number,
          vehicle_fuel_type: req.service_leads.vehicle_fuel_type ?? null,
          vehicle_class: vehicleClass,
          customer_public_enabled: Boolean((req.service_leads as any)?.customer_public_enabled),
          mechanic_name: mechanic?.full_name || 'Unknown',
          description: req.description,
          reason: req.reason,
          amount,
          oem_price: Number.isFinite(savedOem) ? savedOem : 0,
          oes_price: Number.isFinite(savedOes) ? savedOes : 0,
          labour_price: Number.isFinite(savedLabour) ? savedLabour : 0,
          part_price_type: (req as any).part_price_type,
          customer_approved: (req as any).customer_approved,
          customer_approved_at: (req as any).customer_approved_at,
          rejection_reason: (req as any).rejection_reason,
          supervisor_approval_notes: (req as any).supervisor_approval_notes,
          master_oem_price: master.oem,
          master_oes_price: master.oes,
          master_labour_price: masterLabour,
          category: req.category,
          is_urgent: req.is_urgent,
          created_at: req.created_at,
          status: req.status
        };
      }));

      // Sort by status first (PENDING first), then by created_at descending (latest first) within each status
      const statusWeight: Record<string, number> = { PENDING: 0, REJECTED: 1, APPROVED: 2 };
      requestsWithMechanics.sort((a, b) => {
        const statusDiff = (statusWeight[a.status] ?? 9) - (statusWeight[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        // Within same status, sort by created_at descending (latest first)
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });
      setRequests(requestsWithMechanics);
      setEditedPricing((prev) => {
        const next: Record<string, { oem: string; oes: string; labour: string }> = {};
        for (const r of requestsWithMechanics) {
          // Preserve any in-progress edits
          if (prev[r.id] !== undefined) {
            next[r.id] = prev[r.id];
            continue;
          }

          // If DB values exist use them, else fallback to master; legacy fallback: if amount > 0 and oem is 0 treat amount as OEM
          const oem = r.oem_price && r.oem_price > 0 ? r.oem_price : (r.amount > 0 ? r.amount : (r.master_oem_price || 0));
          const oes = r.oes_price && r.oes_price > 0 ? r.oes_price : (r.master_oes_price || 0);
          const labour = r.labour_price && r.labour_price > 0 ? r.labour_price : (r.master_labour_price || 0);

          next[r.id] = {
            oem: Number.isFinite(oem) ? String(oem) : '0',
            oes: Number.isFinite(oes) ? String(oes) : '0',
            labour: Number.isFinite(labour) ? String(labour) : '0',
          };
        }
        return next;
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load additional job requests');
    } finally {
      setLoading(false);
    }
  }

  async function saveLeadAmounts(leadId: string, requestIds: string[]) {
    try {
      setSavingLeadIds((p) => ({ ...p, [leadId]: true }));
      const payload = {
        lead_id: leadId,
        items: requestIds.map((id) => {
          const r = requests.find((x) => x.id === id);
          if (!r) {
            return { id, oem_price: 0, oes_price: 0, labour_price: 0 };
          }
          const p = getEffectivePricingForRequest(r);
          return {
            id,
            oem_price: p.oem,
            oes_price: p.oes,
            labour_price: p.labour,
          };
        }),
      };
      const res = await fetch('/api/supervisor/extra-work/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await safeReadJson(res);
      if (!res.ok) {
        toast.error(data?.error || 'Failed to save');
        return;
      }
      toast.success('Saved');
      await fetchExtraWorkRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSavingLeadIds((p) => ({ ...p, [leadId]: false }));
    }
  }

  function buildQuoteHtml(group: any) {
    const publicPath = `/customer/track/${group.lead_id}`;
    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;

    const escapeHtml = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const fmt = (n: number) =>
      `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const rows = group.items
      .map((r: ExtraWorkRequest) => {
        const p = getEffectivePricingForRequest(r);
        const priority = r.is_urgent ? 'HIGH' : 'NORMAL';
        const reason = escapeHtml(r.reason || '').replace(/\n/g, '<br/>');
        const desc = escapeHtml(r.description || '-');
        const priorityBadge =
          priority === 'HIGH'
            ? `<span class="badge badge-high">HIGH</span>`
            : `<span class="badge badge-normal">NORMAL</span>`;
        return `
          <tr>
            <td class="td td-item">
              <div class="item-title">${desc}</div>
            </td>
            <td class="td td-priority">${priorityBadge}</td>
            <td class="td td-note">${reason ? reason : '<span class="muted">—</span>'}</td>
            <td class="td td-num">${fmt(p.oem)}</td>
            <td class="td td-num">${fmt(p.oes)}</td>
            <td class="td td-num">${fmt(p.labour)}</td>
            <td class="td td-num td-strong">${fmt(p.total_oem)}</td>
            <td class="td td-num td-strong">${fmt(p.total_oes)}</td>
          </tr>
        `;
      })
      .join('');

    const totalOem = group.items.reduce((sum: number, r: ExtraWorkRequest) => sum + getEffectivePricingForRequest(r).total_oem, 0);
    const totalOes = group.items.reduce((sum: number, r: ExtraWorkRequest) => sum + getEffectivePricingForRequest(r).total_oes, 0);
    const now = new Date();

    return `
      <html>
        <head>
          <title>Additional Work Quote - ${group.lead_number}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            :root {
              --bg: #f6f7fb;
              --card: #ffffff;
              --text: #0f172a;
              --muted: #64748b;
              --border: #e2e8f0;
              --header1: #0ea5e9;
              --header2: #2563eb;
              --badge-high-bg: #fee2e2;
              --badge-high-text: #991b1b;
              --badge-normal-bg: #e0f2fe;
              --badge-normal-text: #075985;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
              background: var(--bg);
              color: var(--text);
              padding: 24px;
            }
            .container { max-width: 1100px; margin: 0 auto; }
            .header {
              border-radius: 14px;
              color: white;
              padding: 16px 18px;
              background: linear-gradient(90deg, var(--header1), var(--header2));
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 16px;
            }
            .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.2px; }
            .header .sub { margin-top: 6px; font-size: 12px; opacity: 0.9; }
            .chip {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 10px;
              border-radius: 999px;
              background: rgba(255,255,255,0.18);
              border: 1px solid rgba(255,255,255,0.25);
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
            }
            .card {
              margin-top: 14px;
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 14px;
              overflow: hidden;
            }
            .meta {
              padding: 14px 16px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px 16px;
              font-size: 13px;
            }
            .meta .row { display: flex; gap: 8px; min-width: 0; }
            .meta .k { color: var(--muted); width: 80px; flex: 0 0 auto; }
            .meta .v { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
            a { color: #1d4ed8; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .table-wrap { overflow-x: auto; border-top: 1px solid var(--border); }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            thead th {
              position: sticky;
              top: 0;
              background: #f8fafc;
              border-bottom: 1px solid var(--border);
              color: #334155;
              text-align: left;
              padding: 10px 12px;
              white-space: nowrap;
            }
            tbody tr:nth-child(odd) { background: #ffffff; }
            tbody tr:nth-child(even) { background: #fbfdff; }
            .td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
            .td-item { min-width: 220px; }
            .td-note { min-width: 220px; color: #334155; }
            .td-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
            .td-strong { font-weight: 800; }
            .item-title { font-weight: 700; }
            .muted { color: var(--muted); }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 4px 10px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.3px;
              border: 1px solid transparent;
            }
            .badge-high { background: var(--badge-high-bg); color: var(--badge-high-text); border-color: #fecaca; }
            .badge-normal { background: var(--badge-normal-bg); color: var(--badge-normal-text); border-color: #bae6fd; }
            tfoot td {
              padding: 12px;
              background: #f8fafc;
              border-top: 1px solid var(--border);
              font-weight: 800;
            }
            .totals {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              padding: 14px 16px;
              border-top: 1px solid var(--border);
              background: #fbfdff;
              font-size: 13px;
            }
            .totals .box {
              border: 1px solid var(--border);
              border-radius: 12px;
              padding: 10px 12px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }
            .totals .label { color: var(--muted); font-weight: 700; }
            .totals .value { font-weight: 900; }
            @media (max-width: 720px) {
              body { padding: 12px; }
              .meta { grid-template-columns: 1fr; }
              .totals { grid-template-columns: 1fr; }
            }
            @media print {
              body { background: white; padding: 0; }
              .header { border-radius: 0; }
              .card { border: none; border-radius: 0; }
              thead th { position: static; }
              a { color: black; text-decoration: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div>
                <h1>Additional Work Quote</h1>
                <div class="sub">Generated on ${escapeHtml(now.toLocaleString())}</div>
              </div>
              <div class="chip">Lead: ${escapeHtml(group.lead_number)}</div>
            </div>

            <div class="card">
              <div class="meta">
                <div class="row"><div class="k">Customer</div><div class="v">${escapeHtml(group.customer_name || '—')}</div></div>
                <div class="row"><div class="k">Vehicle</div><div class="v">${escapeHtml(group.vehicle_number || '—')}</div></div>
                <div class="row"><div class="k">Tracking</div><div class="v"><a href="${publicUrl}" rel="noopener noreferrer">${escapeHtml(publicUrl)}</a></div></div>
              </div>

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Priority</th>
                      <th>Remark / Note</th>
                      <th style="text-align:right;">OEM</th>
                      <th style="text-align:right;">OES</th>
                      <th style="text-align:right;">Labour</th>
                      <th style="text-align:right;">Total (OEM)</th>
                      <th style="text-align:right;">Total (OES)</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                  <tfoot>
                    <tr>
                      <td colspan="6" style="text-align:right;">Grand Total</td>
                      <td style="text-align:right;">${fmt(totalOem)}</td>
                      <td style="text-align:right;">${fmt(totalOes)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="totals">
                <div class="box">
                  <div class="label">Total (OEM)</div>
                  <div class="value">${fmt(totalOem)}</div>
                </div>
                <div class="box">
                  <div class="label">Total (OES)</div>
                  <div class="value">${fmt(totalOes)}</div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  function openPreview(group: any, autoPrint: boolean) {
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Popup blocked');
      return;
    }
    w.document.open();
    w.document.write(buildQuoteHtml(group));
    w.document.close();
    if (autoPrint) {
      w.focus();
      setTimeout(() => w.print(), 400);
    }
  }

  async function sendToCustomer(group: any) {
    const publicPath = `/customer/track/${group.lead_id}`;
    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;
    const totalOem = group.items.reduce((sum: number, r: ExtraWorkRequest) => sum + getEffectivePricingForRequest(r).total_oem, 0);
    const totalOes = group.items.reduce((sum: number, r: ExtraWorkRequest) => sum + getEffectivePricingForRequest(r).total_oes, 0);
    const msg = `Additional work quote for ${group.lead_number} (${group.vehicle_number})\\nOEM Total: ₹${totalOem.toFixed(
      2
    )}\\nOES Total: ₹${totalOes.toFixed(2)}\\nView: ${publicUrl}`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success('Message copied (share to customer)');
    } catch {
      toast.error('Failed to copy message');
    }
  }

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, string> = {
      'PARTS_REPLACEMENT': 'badge-blue',
      'ADDITIONAL_SERVICE': 'badge-green',
      'URGENT_REPAIR': 'badge-red',
      'EXTENDED_WORK': 'badge-yellow',
      'OTHER': 'badge-gray'
    };
    return badges[category] || 'badge-gray';
  };

  const groupedRequests = useMemo(() => {
    const byLead = new Map<
      string,
      {
        lead_id: string;
        lead_number: string;
        customer_name: string;
        vehicle_number: string;
        items: ExtraWorkRequest[];
        urgentCount: number;
      }
    >();

    for (const r of requests) {
      const existing = byLead.get(r.lead_id);
      const isPending = String(r.status || 'PENDING').toUpperCase() === 'PENDING';
      if (existing) {
        existing.items.push(r);
        if (isPending && r.is_urgent) existing.urgentCount += 1;
      } else {
        byLead.set(r.lead_id, {
          lead_id: r.lead_id,
          lead_number: r.lead_number,
          customer_name: r.customer_name,
          vehicle_number: r.vehicle_number,
          items: [r],
          urgentCount: isPending && r.is_urgent ? 1 : 0,
        });
      }
    }

    // Sort groups: groups with PENDING items first, then by latest created_at (descending)
    const groups = Array.from(byLead.values());
    groups.sort((a, b) => {
      const aHasPending = a.items.some((i) => String(i.status || 'PENDING').toUpperCase() === 'PENDING');
      const bHasPending = b.items.some((i) => String(i.status || 'PENDING').toUpperCase() === 'PENDING');
      
      // Groups with PENDING items come first
      if (aHasPending && !bHasPending) return -1;
      if (!aHasPending && bHasPending) return 1;
      
      // Within same category (both have PENDING or both don't), sort by latest created_at
      const aLatestTime = Math.max(...a.items.map((i) => new Date(i.created_at).getTime()));
      const bLatestTime = Math.max(...b.items.map((i) => new Date(i.created_at).getTime()));
      return bLatestTime - aLatestTime; // Descending (latest first)
    });

    return groups;
  }, [requests]);

  function getEditedPartNumber(raw: string, fallback: number) {
    const v = (raw ?? '').trim();
    const n = v === '' ? NaN : Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function getEffectivePricingForRequest(r: ExtraWorkRequest) {
    const p = editedPricing[r.id];
    const baseOem = r.oem_price && r.oem_price > 0 ? r.oem_price : (r.master_oem_price || 0);
    const baseOes = r.oes_price && r.oes_price > 0 ? r.oes_price : (r.master_oes_price || 0);
    const baseLabour = r.labour_price && r.labour_price > 0 ? r.labour_price : (r.master_labour_price || 0);
    const oem = p ? getEditedPartNumber(p.oem, baseOem) : baseOem;
    const oes = p ? getEditedPartNumber(p.oes, baseOes) : baseOes;
    const labour = p ? getEditedPartNumber(p.labour, baseLabour) : baseLabour;
    // If OEM/OES part price is 0, do NOT add labour into that option's total.
    // This prevents showing labour-only totals under OEM/OES columns.
    const total_oem = oem > 0 ? oem + labour : 0;
    const total_oes = oes > 0 ? oes + labour : 0;
    return { oem, oes, labour, total_oem, total_oes };
  }

  const getComputedTotalForRequest = (r: ExtraWorkRequest) => {
    // For dashboard summary we default to OEM total (customer may later pick OES)
    return getEffectivePricingForRequest(r).total_oem;
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">💰 Additional Jobs Approval</h1>
          <p className="text-white font-medium text-sm sm:text-base mt-0.5 sm:mt-1">Review and approve mechanic's additional job requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Lead Approval</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{pendingRequests.length}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Urgent Requests</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {pendingRequests.filter((r) => r.is_urgent).length}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <DollarSign className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Amount</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                  OEM: ₹{pendingRequests.reduce((sum, r) => sum + getEffectivePricingForRequest(r).total_oem, 0).toFixed(2)}
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                  OES: ₹{pendingRequests.reduce((sum, r) => sum + getEffectivePricingForRequest(r).total_oes, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">All Caught Up!</h3>
            <p className="text-gray-500 text-sm sm:text-base">No additional job requests.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {groupedRequests.map((group) => (
              <div 
                key={group.lead_id}
                className={`card hover:shadow-xl transition-shadow border-l-4 ${
                  group.urgentCount > 0 ? 'border-red-500 bg-red-50/40' : 'border-orange-500'
                }`}
              >
                <div className="space-y-3 sm:space-y-4">
                  {/* Lead Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="badge-blue text-sm sm:text-base md:text-lg">{group.lead_number}</span>
                        {group.urgentCount > 0 && (
                          <span className="badge-red flex items-center gap-1 text-[10px] sm:text-xs">
                            <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                            URGENT ({group.urgentCount})
                          </span>
                        )}
                        <span className="badge-gray text-[10px] sm:text-xs">
                          {group.items.length} request{group.items.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-sm sm:text-base truncate">{group.customer_name}</span>
                              <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">|</span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {(() => {
                                  const publicPath = `/customer/track/${group.lead_id}`;
                                  const publicUrl =
                                    typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;
                                  const enabled =
                                    group.items.some((it: any) => Boolean((it as any)?.customer_public_enabled)) || false;
                                  const busy = Boolean(publicLinkBusyByLeadId[group.lead_id]);
                                  return (
                                    <>
                                      {!enabled ? (
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-orange-700 hover:text-orange-800 font-semibold"
                                          disabled={busy}
                                          title="Enable public link for customer"
                                          onClick={() => setLeadPublicLinkEnabled(group.lead_id, true)}
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">{busy ? 'Enabling…' : 'Enable Public'}</span>
                                        </button>
                                      ) : (
                                        <>
                                          <a
                                            href={publicPath}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-blue-700 hover:text-blue-800 font-semibold"
                                            title="Open customer public page"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Public</span>
                                          </a>
                                          <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-red-700 hover:text-red-800"
                                            disabled={busy}
                                            title="Disable public link"
                                            onClick={() => setLeadPublicLinkEnabled(group.lead_id, false)}
                                          >
                                            <XCircle className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">{busy ? 'Disabling…' : 'Disable'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-gray-600 hover:text-gray-800"
                                            title="Copy public URL"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(publicUrl);
                                                toast.success('Public URL copied');
                                              } catch {
                                                toast.error('Failed to copy URL');
                                              }
                                            }}
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span className="hidden md:inline">Copy</span>
                                          </button>
                                        </>
                                      )}
                                      <code className="hidden lg:inline text-[10px] text-gray-500 bg-gray-50 border px-2 py-0.5 rounded max-w-[280px] truncate">
                                        {publicUrl}
                                      </code>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs sm:text-sm truncate">{group.vehicle_number}</span>
                              <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">|</span>
                              {(() => {
                                const publicPath = `/customer/track/${group.lead_id}`;
                                const publicUrl =
                                  typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;
                                return (
                                  <span className="text-[10px] sm:text-xs text-gray-500 truncate hidden md:inline">
                                    Public: <span className="font-mono">{publicUrl}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm text-gray-600">Total (editable)</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">
                        ₹
                        {group.items
                          .reduce((sum: number, r: ExtraWorkRequest) => sum + getComputedTotalForRequest(r), 0)
                          .toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Requests under same lead */}
                  <div className="rounded-lg border bg-white overflow-hidden">
                    <div className="p-3 sm:p-4 border-b bg-gray-50 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <div className="text-xs sm:text-sm text-gray-600">
                        Edit amounts below, then use lead actions.
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {(() => {
                          const pendingIds = group.items
                            .filter((i) => String(i.status || 'PENDING').toUpperCase() === 'PENDING')
                            .map((i) => i.id);
                          const disabledSave = pendingIds.length === 0;
                          const pendingGroup = { ...group, items: group.items.filter((i) => pendingIds.includes(i.id)) } as any;
                          const previewGroup = pendingIds.length ? pendingGroup : group;
                          return (
                            <>
                        <button
                          type="button"
                          className="btn btn-primary text-xs sm:text-sm"
                          disabled={disabledSave || Boolean(savingLeadIds[group.lead_id])}
                          onClick={() => saveLeadAmounts(group.lead_id, pendingIds)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline text-xs sm:text-sm"
                          onClick={() => openPreview(previewGroup, false)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline text-xs sm:text-sm"
                          onClick={() => openPreview(previewGroup, true)}
                        >
                          Download as PDF
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline text-xs sm:text-sm"
                          onClick={() => sendToCustomer(previewGroup)}
                        >
                          Send to customer
                        </button>
                        {disabledSave && (
                          <span className="text-xs text-gray-500 self-center">All items responded</span>
                        )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-white border-b">
                          <tr>
                            <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Item</th>
                            <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Priority</th>
                            <th className="p-3 font-semibold text-gray-700">Remark / Note</th>
                            <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Requested by</th>
                            <th className="p-3 font-semibold text-gray-700 whitespace-nowrap text-right">Prices (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.items.map((request: ExtraWorkRequest) => {
                            const p = editedPricing[request.id] || {
                              oem: String(request.oem_price || request.master_oem_price || 0),
                              oes: String(request.oes_price || request.master_oes_price || 0),
                              labour: String(request.labour_price || request.master_labour_price || 0),
                            };
                            const isExpanded = expandedRequestIds[request.id] ?? request.is_urgent;
                            const status = String(request.status || 'PENDING').toUpperCase();
                            const isPending = status === 'PENDING';
                            const decisionLabel = getDecisionLabel(request);
                            return (
                              <tr
                                key={request.id}
                                className={
                                  !isPending ? 'bg-gray-50/60' : request.is_urgent ? 'bg-red-50/60' : 'bg-white'
                                }
                              >
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold text-gray-900">{request.description}</div>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                                          status === 'PENDING'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : status === 'APPROVED'
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-red-100 text-red-800'
                                        }`}
                                      >
                                        {decisionLabel}
                                      </span>
                                      {isPending && (
                                        <button
                                          type="button"
                                          className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold border border-green-200 text-green-700 hover:bg-green-50"
                                          disabled={Boolean(approvingRequestIds[request.id])}
                                          onClick={() =>
                                            setApproveModal({
                                              open: true,
                                              requestId: request.id,
                                              choice: 'OEM',
                                            })
                                          }
                                          title="Approve this request as advisor (skips customer action)"
                                        >
                                          {approvingRequestIds[request.id] ? 'Approving…' : 'Approve'}
                                        </button>
                                      )}
                                      {!isPending &&
                                        status === 'REJECTED' &&
                                        Boolean(request.customer_approved_at) && (
                                          <button
                                            type="button"
                                            className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold border border-orange-200 text-orange-800 hover:bg-orange-50"
                                            disabled={Boolean(approvingRequestIds[request.id])}
                                            onClick={() => {
                                              setApproveModalNotes('');
                                              setApproveModal({
                                                open: true,
                                                requestId: request.id,
                                                choice: 'OEM',
                                              });
                                            }}
                                            title="Override customer rejection and approve (remark required)"
                                          >
                                            Override approve
                                          </button>
                                        )}
                                      {isPending && (
                                        <button
                                          type="button"
                                          className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                                          disabled={Boolean(cancellingRequestIds[request.id])}
                                          onClick={() => cancelRequest(request.id)}
                                          title="Cancel (reject) this request as advisor"
                                        >
                                          {cancellingRequestIds[request.id] ? 'Cancelling…' : 'Cancel'}
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-gray-500">{formatDateDMY(request.created_at)}</div>
                                    {status === 'REJECTED' && request.rejection_reason && (
                                      <div className="mt-1 text-[10px] sm:text-xs text-red-700">
                                        Reason: <span className="font-semibold">{request.rejection_reason}</span>
                                      </div>
                                    )}
                                    {status === 'APPROVED' && request.rejection_reason && Boolean(request.customer_approved_at) && (
                                      <div className="mt-1 text-[10px] sm:text-xs text-orange-700">
                                        Customer remark: <span className="font-semibold">{request.rejection_reason}</span>
                                      </div>
                                    )}
                                    {status === 'APPROVED' && request.supervisor_approval_notes && (
                                      <div className="mt-1 text-[10px] sm:text-xs text-blue-700">
                                        Advisor remark: <span className="font-semibold">{request.supervisor_approval_notes}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {request.is_urgent ? (
                                      <span className="badge-red inline-flex items-center gap-1 text-[10px] sm:text-xs">
                                        <AlertTriangle className="w-3 h-3" />
                                        HIGH
                                      </span>
                                    ) : (
                                      <span className="badge-gray text-[10px] sm:text-xs">NORMAL</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-gray-700 truncate max-w-[520px]">
                                        {isExpanded ? (request.reason || '—').split('\n')[0] : (request.reason || '—').split('\n')[0]}
                                      </div>
                                      <button
                                        type="button"
                                        className="text-[10px] sm:text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
                                        onClick={() =>
                                          setExpandedRequestIds((p) => ({
                                            ...p,
                                            [request.id]: !(p[request.id] ?? request.is_urgent),
                                          }))
                                        }
                                      >
                                        {isExpanded ? 'Hide' : 'Show'}
                                      </button>
                                    </div>
                                    {isExpanded && (
                                      <div className="mt-2 rounded-md border bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-line">
                                        {request.reason || '—'}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 font-semibold text-gray-800">{request.mechanic_name}</td>
                                  <td className="p-3 text-right">
                                    <div className="grid grid-cols-2 gap-2 justify-end">
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="text-[10px] sm:text-xs text-gray-500">OEM</span>
                                        <input
                                          type="number"
                                          value={p.oem}
                                          onChange={(e) => setEditedPricing((prev) => ({ ...prev, [request.id]: { ...p, oem: e.target.value } }))}
                                          className="input w-24 sm:w-28 text-sm px-3 py-1.5 text-right"
                                          min="0"
                                          step="0.01"
                                          disabled={!isPending}
                                        />
                                      </div>
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="text-[10px] sm:text-xs text-gray-500">OES</span>
                                        <input
                                          type="number"
                                          value={p.oes}
                                          onChange={(e) => setEditedPricing((prev) => ({ ...prev, [request.id]: { ...p, oes: e.target.value } }))}
                                          className="input w-24 sm:w-28 text-sm px-3 py-1.5 text-right"
                                          min="0"
                                          step="0.01"
                                          disabled={!isPending}
                                        />
                                      </div>
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="text-[10px] sm:text-xs text-gray-500">Lab</span>
                                        <input
                                          type="number"
                                          value={p.labour}
                                          onChange={(e) => setEditedPricing((prev) => ({ ...prev, [request.id]: { ...p, labour: e.target.value } }))}
                                          className="input w-24 sm:w-28 text-sm px-3 py-1.5 text-right"
                                          min="0"
                                          step="0.01"
                                          disabled={!isPending}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2 justify-end text-[10px] sm:text-xs text-gray-500">
                                        Customer will choose OEM/OES
                                      </div>
                                    </div>

                                    <div className="mt-1 text-[10px] sm:text-xs text-gray-500 text-right">
                                      Total (OEM): ₹{getEffectivePricingForRequest(request).total_oem.toFixed(2)} | Total (OES): ₹{getEffectivePricingForRequest(request).total_oes.toFixed(2)}
                                    </div>
                                  </td>
                                </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td className="p-3 text-right font-semibold text-gray-700" colSpan={4}>
                              Total
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              <div>OEM: ₹{group.items.reduce((sum: number, r: ExtraWorkRequest) => sum + getEffectivePricingForRequest(r).total_oem, 0).toFixed(2)}</div>
                              <div>OES: ₹{group.items.reduce((sum: number, r: ExtraWorkRequest) => sum + getEffectivePricingForRequest(r).total_oes, 0).toFixed(2)}</div>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal.open && approveModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setApproveModal({ open: false, requestId: null, choice: 'OEM' })}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border">
            <div className="p-4 border-b">
              <div className="text-lg font-bold text-gray-900">
                {approveModalIsOverride ? 'Override customer decision' : 'Approve Additional Work'}
              </div>
              <div className="text-sm text-gray-600 mt-1">{approveModalRequest.description}</div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Select price type</label>
                <select
                  className="input w-full"
                  value={approveModal.choice}
                  onChange={(e) =>
                    setApproveModal((p) => ({
                      ...p,
                      choice: (String(e.target.value).toUpperCase() === 'OES' ? 'OES' : 'OEM') as 'OEM' | 'OES',
                    }))
                  }
                >
                  <option value="OEM">OEM</option>
                  <option value="OES">OES</option>
                </select>
                <div className="mt-2 text-xs text-gray-600">
                  Total (OEM): <span className="font-semibold">₹{approveModalTotals.oem.toFixed(2)}</span> • Total (OES):{' '}
                  <span className="font-semibold">₹{approveModalTotals.oes.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Selected total:{' '}
                  <span className="font-bold text-gray-900">
                    ₹{(approveModal.choice === 'OES' ? approveModalTotals.oes : approveModalTotals.oem).toFixed(2)}
                  </span>
                </div>
              </div>

              {approveModalIsOverride && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Mandatory remark (why approving after customer rejected)
                  </label>
                  <textarea
                    className="input w-full min-h-[90px]"
                    value={approveModalNotes}
                    onChange={(e) => setApproveModalNotes(e.target.value)}
                    placeholder="e.g. Customer rejected by mistake, job is mandatory for safety..."
                  />
                  <div className="mt-1 text-xs text-gray-500">This remark will be saved in the approval notes.</div>
                </div>
              )}

              {approveModalRequest.reason && (
                <div className="text-xs text-gray-600 bg-gray-50 border rounded p-3 whitespace-pre-line">
                  {approveModalRequest.reason}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setApproveModal({ open: false, requestId: null, choice: 'OEM' })}
                disabled={Boolean(approvingRequestIds[approveModalRequest.id])}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={Boolean(approvingRequestIds[approveModalRequest.id])}
                onClick={async () => {
                  if (approveModalIsOverride && !approveModalNotes.trim()) {
                    toast.error('Remark is required to override customer rejection');
                    return;
                  }
                  await approveRequest(
                    approveModalRequest.id,
                    approveModal.choice,
                    approveModalIsOverride ? approveModalNotes.trim() : undefined
                  );
                  setApproveModal({ open: false, requestId: null, choice: 'OEM' });
                }}
              >
                {approvingRequestIds[approveModalRequest.id]
                  ? 'Approving…'
                  : approveModalIsOverride
                    ? `Override & approve (${approveModal.choice})`
                    : `Approve (${approveModal.choice})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

