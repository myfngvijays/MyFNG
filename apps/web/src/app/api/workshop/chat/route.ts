import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ChatButton = {
  id: string;
  label: string;
  action: { type: string; payload?: any };
  variant?: 'primary' | 'secondary' | 'danger';
};

type ChatMessage = {
  id: string;
  from: 'system' | 'user';
  text: string;
};

type ChatSession = {
  activeLeadId?: string | null;
  step?:
    | 'idle'
    | 'searching'
    | 'lead_open'
    | 'pick_mechanic_status'
    | 'pickup_collect_otp'
    | 'supervisor_pick_status'
    | 'supervisor_enable_pickup_collect'
    | 'confirm_accept'
    | 'confirm_reject'
    | 'collect_reject_reason'
    | 'update_details_pick_field'
    | 'update_details_collect_value'
    | 'confirm_update_details'
    | 'assign_team_pick_role'
    | 'assign_team_pick_user'
    | 'confirm_assign_team';
  draft?: Record<string, any>;
};

type ChatRequestBody = {
  input?: string | null;
  action?: { type: string; payload?: any } | null;
  session?: ChatSession | null;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickAuthHeaders(request: NextRequest): Record<string, string> {
  const h: Record<string, string> = {};
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization');
  if (cookie) h.cookie = cookie;
  if (authorization) h.authorization = authorization;
  return h;
}

async function callInternal(
  request: NextRequest,
  path: string,
  init: { method: string; body?: any }
) {
  const origin = new URL(request.url).origin;
  const headers: Record<string, string> = {
    ...pickAuthHeaders(request),
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${origin}${path}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function roleIsWorkshop(roleCode: string) {
  const r = String(roleCode || '').trim().toUpperCase();
  return (
    r === 'WORKSHOP_ADMIN' ||
    r === 'WORKSHOP_SUPERVISOR' ||
    r === 'WORKSHOP_MECHANIC' ||
    r === 'WORKSHOP_PICKUP_BOY'
  );
}

function buttonsForLead(roleCode: string, lead: any, meId: string): ChatButton[] {
  const r = String(roleCode || '').trim().toUpperCase();
  const status = String(lead?.status || '').trim().toUpperCase();
  const out: ChatButton[] = [];

  // Read-only lead: no mutations, only search
  if ((lead as any)?.read_only) {
    out.push({ id: 'search', label: 'Search other lead', action: { type: 'searchStart' } });
    return out;
  }

  if (r === 'WORKSHOP_ADMIN' || r === 'WORKSHOP_SUPERVISOR') {
    if (status === 'ASSIGNED_TO_WORKSHOP' || status === 'PENDING') {
      out.push(
        { id: 'accept', label: 'Accept', variant: 'primary', action: { type: 'acceptLead' } },
        { id: 'reject', label: 'Reject', variant: 'danger', action: { type: 'rejectLead' } }
      );
    }
    out.push(
      { id: 'update_details', label: 'Update details', action: { type: 'updateDetailsStart' } },
      { id: 'assign_team', label: 'Assign team', action: { type: 'assignTeamStart' } }
    );
  }

  if (r === 'WORKSHOP_SUPERVISOR') {
    out.push(
      { id: 'sup_change_status', label: 'Change status', action: { type: 'supervisorChangeStatus' } },
      { id: 'sup_enable_pickup', label: 'Enable pickup', action: { type: 'supervisorEnablePickup' } },
      { id: 'sup_qc_approve', label: 'QC approve', action: { type: 'supervisorApproveQc' } },
      { id: 'sup_qc_reject', label: 'QC reject', action: { type: 'supervisorRejectQc' } }
    );
  }

  if (r === 'WORKSHOP_MECHANIC' && String((lead as any)?.assigned_mechanic_id || '') === String(meId || '')) {
    out.push(
      { id: 'mech_start', label: 'Start job', variant: 'primary', action: { type: 'mechanicStart' } },
      { id: 'mech_status', label: 'Update status', action: { type: 'mechanicPickStatus' } },
      { id: 'mech_complete', label: 'Complete job', variant: 'primary', action: { type: 'mechanicComplete' } }
    );
  }

  if (r === 'WORKSHOP_PICKUP_BOY' && String((lead as any)?.assigned_pickup_boy_id || '') === String(meId || '')) {
    out.push(
      { id: 'p_start', label: 'Start pickup', variant: 'primary', action: { type: 'pickupStart' } },
      { id: 'p_arrived', label: 'Mark arrived', action: { type: 'pickupArrived' } },
      { id: 'p_verify', label: 'Verify pickup OTP', action: { type: 'pickupVerifyOtp' } },
      { id: 'p_complete', label: 'Complete pickup', action: { type: 'pickupComplete' } },
      { id: 'd_start', label: 'Start drop', action: { type: 'dropStart' } },
      { id: 'd_verify', label: 'Verify drop OTP', action: { type: 'pickupVerifyDropOtp' } },
      { id: 'd_complete', label: 'Complete drop', variant: 'primary', action: { type: 'dropComplete' } }
    );
  }

  out.push({ id: 'search', label: 'Search other lead', action: { type: 'searchStart' } });
  return out;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ messages: [{ id: uid('m'), from: 'system', text: 'Login expire ho gaya hai. Dubara login karke try karein.' }] }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
    const input = String(body?.input ?? '').trim();
    const action = body?.action ?? null;
    const session: ChatSession = {
      activeLeadId: body?.session?.activeLeadId ?? null,
      step: body?.session?.step ?? 'idle',
      draft: body?.session?.draft ?? {},
    };

    // Load profile + role + workshop_id (id/email/phone fallback like other routes)
    const selectMe = 'id, full_name, email, phone, workshop_id, roles!inner(role_code)';
    const email = String(user.email || '').trim();
    const phone = String(user.phone || '').trim();

    const { data: meById } = await supabase.from('users_login').select(selectMe).eq('id', user.id).maybeSingle();
    const { data: meByEmail } = !meById && email
      ? await supabase.from('users_login').select(selectMe).ilike('email', email).maybeSingle()
      : { data: null as any };
    const { data: meByPhone } = !meById && !meByEmail && phone
      ? await supabase.from('users_login').select(selectMe).eq('phone', phone).maybeSingle()
      : { data: null as any };

    const me = meById || meByEmail || meByPhone;
    if (!me) {
      return NextResponse.json(
        { messages: [{ id: uid('m'), from: 'system', text: 'User profile not found.' }] },
        { status: 404 }
      );
    }
    const roleCode = String((me as any)?.roles?.role_code || '').trim().toUpperCase();
    const workshopId = (me as any)?.workshop_id || null;
    if (!roleIsWorkshop(roleCode)) {
      return NextResponse.json({ messages: [{ id: uid('m'), from: 'system', text: 'Aapko is chat ka access nahi hai. Sirf workshop roles use kar sakte hain.' }] }, { status: 403 });
    }
    if (!workshopId) {
      return NextResponse.json({ messages: [{ id: uid('m'), from: 'system', text: 'Aapka workshop set nahi hai. Admin se contact karein.' }] }, { status: 400 });
    }

    const messages: ChatMessage[] = [];
    const buttons: ChatButton[] = [];

    const pushSystem = (text: string) => messages.push({ id: uid('m'), from: 'system', text });

    const doSearch = async (q: string) => {
      const query = String(q || '').trim();
      if (!query) {
        pushSystem('Search ke liye phone / vehicle no / lead no type karein.');
        return;
      }

      // Search directly via Supabase for fast UX; still workshop-scoped.
      const like = `%${query}%`;
      const { data: rows, error } = await supabase
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_phone, vehicle_number, status, created_at')
        .eq('workshop_id', workshopId)
        .or(
          [
            `customer_phone.ilike.${like}`,
            `vehicle_number.ilike.${like}`,
            `lead_number.ilike.${like}`,
            `customer_name.ilike.${like}`,
          ].join(',')
        )
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        pushSystem(`Search failed: ${error.message}`);
        return;
      }

      const results = (rows as any[]) || [];
      if (!results.length) {
        pushSystem('Koi lead nahi mila. Dusra search try karein.');
        return;
      }

      pushSystem('Matches mil gaye. Kaun sa open karna hai?');
      for (const r of results as any[]) {
        const label = [
          r.lead_number || r.id,
          r.customer_name || r.customer_phone || 'Customer',
          r.vehicle_number || '—',
          r.status || '—',
        ].filter(Boolean).join(' • ');
        buttons.push({
          id: `open_${r.id}`,
          label,
          action: { type: 'openLead', payload: { leadId: r.id } },
        });
      }
    };

    const openLead = async (leadId: string) => {
      const id = String(leadId || '').trim();
      if (!id) {
        pushSystem('Missing lead id.');
        return;
      }

      const { data: lead, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', id)
        .eq('workshop_id', workshopId)
        .maybeSingle();

      if (error) {
        pushSystem(`Failed to load lead: ${error.message}`);
        return;
      }
      if (!lead) {
        pushSystem('Lead not found (or not in your workshop).');
        return;
      }

      session.activeLeadId = id;
      session.step = 'lead_open';
      session.draft = {};

      const summary = [
        `Lead: ${(lead as any)?.lead_number || id}`,
        `Customer: ${(lead as any)?.customer_name || (lead as any)?.customer_phone || '—'}`,
        `Vehicle: ${(lead as any)?.vehicle_number || '—'}`,
        `Status: ${(lead as any)?.status || '—'}`,
        `Assigned: S:${(lead as any)?.assigned_supervisor_id ? 'Yes' : 'No'} M:${(lead as any)?.assigned_mechanic_id ? 'Yes' : 'No'} P:${(lead as any)?.assigned_pickup_boy_id ? 'Yes' : 'No'}`,
      ].join('\n');

      pushSystem(summary);
      if ((lead as any)?.read_only) {
        pushSystem('Ye lead locked hai (read-only). Is par changes nahi kiye ja sakte.');
      }
      buttons.push(...buttonsForLead(roleCode, lead, String((me as any)?.id || user.id)));
    };

    // Dispatch
    if (action?.type === 'searchStart') {
      session.step = 'searching';
      session.activeLeadId = null;
      session.draft = {};
      pushSystem('Search karein: phone / vehicle no / lead no type karein.');
    } else if (action?.type === 'help') {
      pushSystem(
        [
          'Help:',
          '- Search: phone / vehicle no / lead no / customer name type karein',
          '- Open lead: list se select karein',
          '- Actions: buttons use karein (Accept/Reject/Update/Assign)',
          '',
          'Note: Kuch steps me text required hota hai (reason/notes/value).',
        ].join('\n')
      );
      buttons.push({ id: 'search', label: 'Search lead/job', variant: 'primary', action: { type: 'searchStart' } });
    } else if (action?.type === 'searchSubmit') {
      session.step = 'searching';
      await doSearch(String(action?.payload?.query || ''));
    } else if (action?.type === 'openLead') {
      await openLead(String(action?.payload?.leadId || ''));
    } else if (action?.type === 'acceptLead') {
      const leadId = session.activeLeadId;
      if (!leadId) {
        pushSystem('Pehle lead open karein.');
      } else {
        session.step = 'confirm_accept';
        session.draft = { op: 'accept', leadId };
        pushSystem('Confirm: lead accept karna hai?');
        buttons.push(
          { id: 'confirm_accept', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'rejectLead') {
      const leadId = session.activeLeadId;
      if (!leadId) {
        pushSystem('Pehle lead open karein.');
      } else {
        session.step = 'collect_reject_reason';
        session.draft = { op: 'reject', leadId };
        pushSystem('Reject reason type karein (e.g. Customer not reachable).');
      }
    } else if (session.step === 'collect_reject_reason' && input) {
      session.draft = { ...(session.draft || {}), reason: input };
      session.step = 'confirm_reject';
      pushSystem(`Confirm reject?\nReason: ${input}`);
      buttons.push(
        { id: 'confirm_reject', label: 'Confirm', variant: 'danger', action: { type: 'confirm' } },
        { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
      );
    } else if (action?.type === 'updateDetailsStart') {
      if (!session.activeLeadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'update_details_pick_field';
        session.draft = { op: 'update_details', leadId: session.activeLeadId };
        pushSystem('Kaunsa field update karna hai?');
        const fields: Array<{ k: string; label: string }> = [
          { k: 'customer_name', label: 'Customer name' },
          { k: 'customer_alternate_phone', label: 'Alt phone' },
          { k: 'customer_email', label: 'Email' },
          { k: 'customer_address', label: 'Address' },
          { k: 'vehicle_odometer', label: 'Odometer' },
          { k: 'vehicle_vin', label: 'VIN' },
        ];
        for (const f of fields) {
          buttons.push({ id: `f_${f.k}`, label: f.label, action: { type: 'pickUpdateField', payload: { field: f.k } } });
        }
        buttons.push({ id: 'cancel', label: 'Cancel', action: { type: 'cancel' } });
      }
    } else if (action?.type === 'pickUpdateField') {
      const field = String(action?.payload?.field || '').trim();
      if (!field) pushSystem('Invalid field.');
      else {
        session.step = 'update_details_collect_value';
        session.draft = { ...(session.draft || {}), field };
        pushSystem(`Value type karein for: ${field}`);
      }
    } else if (session.step === 'update_details_collect_value' && input) {
      const field = String(session.draft?.field || '').trim();
      if (!field) pushSystem('Missing field. Cancel karke dubara try karein.');
      else {
        session.step = 'confirm_update_details';
        session.draft = { ...(session.draft || {}), value: input };
        pushSystem(`Confirm update?\n${field} = ${input}`);
        buttons.push(
          { id: 'confirm_update', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'assignTeamStart') {
      if (!session.activeLeadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'assign_team_pick_role';
        session.draft = { op: 'assign_team', leadId: session.activeLeadId };
        pushSystem('Kisko assign karna hai?');
        buttons.push(
          { id: 'pick_supervisor', label: 'Supervisor', action: { type: 'pickAssignRole', payload: { role: 'WORKSHOP_SUPERVISOR' } } },
          { id: 'pick_mechanic', label: 'Mechanic', action: { type: 'pickAssignRole', payload: { role: 'WORKSHOP_MECHANIC' } } },
          { id: 'pick_pickup', label: 'Pickup boy', action: { type: 'pickAssignRole', payload: { role: 'WORKSHOP_PICKUP_BOY' } } },
          { id: 'cancel', label: 'Cancel', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'pickAssignRole') {
      const pickRole = String(action?.payload?.role || '').trim().toUpperCase();
      session.step = 'assign_team_pick_user';
      session.draft = { ...(session.draft || {}), pickRole: pickRole };
      pushSystem('Staff list load ho rahi hai...');

      const staffRes = await callInternal(request, '/api/workshop/staff', { method: 'GET' });
      if (!staffRes.ok) {
        pushSystem(`Staff load failed (${staffRes.status}).`);
      } else {
        const staff = (staffRes.json as any)?.staff || [];
        const filtered = staff.filter((s: any) => String(s?.role_code || '').toUpperCase() === pickRole).slice(0, 12);
        if (!filtered.length) {
          pushSystem('Is role ka staff nahi mila.');
        } else {
          pushSystem('Select karein:');
          for (const s of filtered) {
            buttons.push({
              id: `u_${s.id}`,
              label: `${s.full_name} (${s.role_code})`,
              action: { type: 'pickAssignUser', payload: { userId: s.id } },
            });
          }
        }
        buttons.push({ id: 'cancel', label: 'Cancel', action: { type: 'cancel' } });
      }
    } else if (action?.type === 'pickAssignUser') {
      const userId = String(action?.payload?.userId || '').trim();
      const pickRole = String(session.draft?.pickRole || '').trim().toUpperCase();
      if (!userId || !pickRole) {
        pushSystem('Missing selection. Cancel karke dubara try karein.');
      } else {
        session.step = 'confirm_assign_team';
        session.draft = { ...(session.draft || {}), userId };
        pushSystem(`Confirm assign?\n${pickRole} -> ${userId}`);
        buttons.push(
          { id: 'confirm_assign', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'mechanicStart') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'mechanic_start', leadId };
        pushSystem('Confirm: job start karna hai?');
        buttons.push(
          { id: 'confirm_mech_start', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'mechanicPickStatus') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'pick_mechanic_status';
        session.draft = { op: 'mechanic_status', leadId };
        pushSystem('Mechanic status select karein:');
        buttons.push(
          { id: 'ms_inp', label: 'IN_PROGRESS', action: { type: 'mechanicSetStatus', payload: { status: 'IN_PROGRESS' } } },
          { id: 'ms_hold', label: 'HOLD', action: { type: 'mechanicSetStatus', payload: { status: 'HOLD' } } },
          { id: 'ms_wait', label: 'WAITING_APPROVAL', action: { type: 'mechanicSetStatus', payload: { status: 'WAITING_APPROVAL' } } },
          { id: 'cancel', label: 'Cancel', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'mechanicSetStatus') {
      const leadId = session.activeLeadId;
      const status = String(action?.payload?.status || '').trim().toUpperCase();
      if (!leadId) pushSystem('Pehle lead open karein.');
      else if (!status) pushSystem('Invalid status.');
      else {
        session.draft = { op: 'mechanic_status', leadId, status };
        pushSystem(`Confirm: status set to ${status}?`);
        buttons.push(
          { id: 'confirm_mech_status', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'mechanicComplete') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'mechanic_complete', leadId };
        pushSystem('Confirm: job complete karna hai? (Required photos missing ho sakte hain.)');
        buttons.push(
          { id: 'confirm_mech_complete', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'pickupStart') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'pickup_start', leadId };
        pushSystem('Confirm: pickup start karna hai?');
        buttons.push(
          { id: 'confirm_pickup_start', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'pickupArrived') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'pickup_arrived', leadId };
        pushSystem('Confirm: arrived mark karna hai?');
        buttons.push(
          { id: 'confirm_pickup_arrived', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'pickupVerifyOtp') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'pickup_collect_otp';
        session.draft = { op: 'pickup_verify_otp', leadId };
        pushSystem('Pickup OTP type karein (customer se):');
      }
    } else if (action?.type === 'pickupVerifyDropOtp') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'pickup_collect_otp';
        session.draft = { op: 'pickup_verify_drop_otp', leadId };
        pushSystem('Delivery OTP type karein (customer se):');
      }
    } else if (session.step === 'pickup_collect_otp' && input) {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        const otp = input.replace(/\s+/g, '');
        const existingOp = session.draft?.op || 'pickup_verify_otp';
        session.draft = { op: existingOp, leadId, otp };
        pushSystem(`Confirm OTP verify?\nOTP: ${otp}`);
        buttons.push(
          { id: 'confirm_otp', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'pickupComplete') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'pickup_complete', leadId };
        pushSystem('Confirm: pickup complete karna hai?');
        buttons.push(
          { id: 'confirm_pickup_complete', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'dropStart') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'drop_start', leadId };
        pushSystem('Confirm: drop start karna hai?');
        buttons.push(
          { id: 'confirm_drop_start', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'dropComplete') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'drop_complete', leadId };
        pushSystem('Confirm: drop complete karna hai? (OTP/photos/payment validations ho sakte hain.)');
        buttons.push(
          { id: 'confirm_drop_complete', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'supervisorChangeStatus') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'supervisor_pick_status';
        session.draft = { op: 'supervisor_change_status', leadId };
        pushSystem('New status select karein:');
        const opts = ['IN_PROGRESS', 'INSPECTED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_DELIVERY', 'REWORK_REQUIRED'];
        for (const s of opts) {
          buttons.push({ id: `ss_${s}`, label: s, action: { type: 'supervisorSetStatus', payload: { status: s } } });
        }
        buttons.push({ id: 'cancel', label: 'Cancel', action: { type: 'cancel' } });
      }
    } else if (action?.type === 'supervisorSetStatus') {
      const leadId = session.activeLeadId;
      const newStatus = String(action?.payload?.status || '').trim().toUpperCase();
      if (!leadId) pushSystem('Pehle lead open karein.');
      else if (!newStatus) pushSystem('Invalid status.');
      else {
        session.draft = { op: 'supervisor_change_status', leadId, new_status: newStatus };
        pushSystem(`Confirm: status change to ${newStatus}?`);
        buttons.push(
          { id: 'confirm_sup_status', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'supervisorEnablePickup') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.step = 'supervisor_enable_pickup_collect';
        session.draft = { op: 'supervisor_enable_pickup', leadId };
        pushSystem('Pickup address type karein (optional). Ya Skip karein.');
        buttons.push(
          { id: 'skip_pickup_addr', label: 'Skip', action: { type: 'supervisorEnablePickupSkip' } },
          { id: 'cancel', label: 'Cancel', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'supervisorEnablePickupSkip') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'supervisor_enable_pickup', leadId };
        pushSystem('Confirm: enable pickup?');
        buttons.push(
          { id: 'confirm_enable_pickup', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (session.step === 'supervisor_enable_pickup_collect' && input) {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'supervisor_enable_pickup', leadId, pickup_address: input };
        pushSystem(`Confirm: enable pickup?\nAddress: ${input}`);
        buttons.push(
          { id: 'confirm_enable_pickup', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'supervisorApproveQc') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'supervisor_approve_qc', leadId };
        pushSystem('Confirm: QC approve?');
        buttons.push(
          { id: 'confirm_qc_approve', label: 'Confirm', variant: 'primary', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'supervisorRejectQc') {
      const leadId = session.activeLeadId;
      if (!leadId) pushSystem('Pehle lead open karein.');
      else {
        session.draft = { op: 'supervisor_reject_qc', leadId };
        pushSystem('Confirm: QC reject?');
        buttons.push(
          { id: 'confirm_qc_reject', label: 'Confirm', variant: 'danger', action: { type: 'confirm' } },
          { id: 'cancel', label: 'Cancel', variant: 'secondary', action: { type: 'cancel' } }
        );
      }
    } else if (action?.type === 'confirm') {
      const op = String(session.draft?.op || '').trim();
      const leadId = String(session.draft?.leadId || session.activeLeadId || '').trim();
      if (!op || !leadId) {
        pushSystem('Nothing to confirm.');
      } else if (op === 'accept') {
        const res = await callInternal(request, `/api/workshop/leads/${leadId}/accept`, { method: 'POST' });
        if (!res.ok) pushSystem(`Accept failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Lead accepted.');
        await openLead(leadId);
      } else if (op === 'reject') {
        const reason = String(session.draft?.reason || '').trim();
        const res = await callInternal(request, `/api/workshop/leads/${leadId}/reject`, { method: 'POST', body: { reason } });
        if (!res.ok) pushSystem(`Reject failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Lead rejected.');
        await openLead(leadId);
      } else if (op === 'update_details') {
        const field = String(session.draft?.field || '').trim();
        const value = session.draft?.value;
        const patchBody: any = {};
        patchBody[field] = value;
        const res = await callInternal(request, `/api/workshop/leads/${leadId}/update-details`, { method: 'PATCH', body: patchBody });
        if (!res.ok) pushSystem(`Update failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Details updated.');
        await openLead(leadId);
      } else if (op === 'assign_team') {
        const pickRole = String(session.draft?.pickRole || '').trim().toUpperCase();
        const userId = String(session.draft?.userId || '').trim();
        const body: any = {};
        if (pickRole === 'WORKSHOP_MECHANIC') body.mechanic_id = userId;
        if (pickRole === 'WORKSHOP_SUPERVISOR') body.supervisor_id = userId;
        if (pickRole === 'WORKSHOP_PICKUP_BOY') body.pickup_boy_id = userId;
        const res = await callInternal(request, `/api/workshop/leads/${leadId}/assign-team`, { method: 'POST', body });
        if (!res.ok) pushSystem(`Assign failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Team assigned.');
        await openLead(leadId);
      } else if (op === 'mechanic_start') {
        const res = await callInternal(request, `/api/mechanic/jobs/${leadId}/start`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Start failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Job started.');
        await openLead(leadId);
      } else if (op === 'mechanic_status') {
        const status = String(session.draft?.status || '').trim().toUpperCase();
        const res = await callInternal(request, `/api/mechanic/jobs/${leadId}/status`, { method: 'POST', body: { status } });
        if (!res.ok) pushSystem(`Status update failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Status updated.');
        await openLead(leadId);
      } else if (op === 'mechanic_complete') {
        const res = await callInternal(request, `/api/mechanic/jobs/${leadId}/complete`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Complete failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Job completed.');
        await openLead(leadId);
      } else if (op === 'pickup_start') {
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/start`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Pickup start failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Pickup started.');
        await openLead(leadId);
      } else if (op === 'pickup_arrived') {
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/arrived`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Arrived failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Arrived marked.');
        await openLead(leadId);
      } else if (op === 'pickup_verify_otp') {
        const otp = String(session.draft?.otp || '').trim();
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/verify-otp`, { method: 'POST', body: { otp, otp_type: 'PICKUP' } });
        if (!res.ok) pushSystem(`OTP verify failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Pickup OTP verified.');
        await openLead(leadId);
      } else if (op === 'pickup_verify_drop_otp') {
        const otp = String(session.draft?.otp || '').trim();
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/verify-otp`, { method: 'POST', body: { otp, otp_type: 'DROP' } });
        if (!res.ok) pushSystem(`Drop OTP verify failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Delivery OTP verified.');
        await openLead(leadId);
      } else if (op === 'pickup_complete') {
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/complete`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Pickup complete failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Pickup completed.');
        await openLead(leadId);
      } else if (op === 'drop_start') {
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/drop/start`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Drop start failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Drop started.');
        await openLead(leadId);
      } else if (op === 'drop_complete') {
        const res = await callInternal(request, `/api/pickup/tasks/${leadId}/drop/complete`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`Drop complete failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Drop completed.');
        await openLead(leadId);
      } else if (op === 'supervisor_change_status') {
        const new_status = String(session.draft?.new_status || '').trim().toUpperCase();
        const res = await callInternal(request, `/api/supervisor/jobs/${leadId}/change-status`, { method: 'POST', body: { new_status } });
        if (!res.ok) pushSystem(`Status change failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Status changed.');
        await openLead(leadId);
      } else if (op === 'supervisor_enable_pickup') {
        const pickup_address = session.draft?.pickup_address;
        const body: any = {};
        if (pickup_address) body.pickup_address = pickup_address;
        const res = await callInternal(request, `/api/supervisor/jobs/${leadId}/enable-pickup`, { method: 'POST', body });
        if (!res.ok) pushSystem(`Enable pickup failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('Pickup enabled.');
        await openLead(leadId);
      } else if (op === 'supervisor_approve_qc') {
        const res = await callInternal(request, `/api/supervisor/jobs/${leadId}/approve-qc`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`QC approve failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('QC approved.');
        await openLead(leadId);
      } else if (op === 'supervisor_reject_qc') {
        const res = await callInternal(request, `/api/supervisor/jobs/${leadId}/reject-qc`, { method: 'POST', body: {} });
        if (!res.ok) pushSystem(`QC reject failed (${res.status}): ${(res.json as any)?.error || 'Unknown error'}`);
        else pushSystem('QC rejected.');
        await openLead(leadId);
      } else {
        pushSystem(`Unknown operation: ${op}`);
      }

      // Reset draft after confirm
      session.draft = {};
      session.step = 'lead_open';
    } else if (action?.type === 'cancel') {
      session.draft = {};
      session.step = session.activeLeadId ? 'lead_open' : 'idle';
      pushSystem('Cancelled.');
      if (session.activeLeadId) await openLead(String(session.activeLeadId));
      else buttons.push({ id: 'search', label: 'Search', action: { type: 'searchStart' } });
    } else if (input) {
      // Free text fallbacks
      if (session.step === 'searching') {
        await doSearch(input);
      } else if (session.step === 'idle') {
        session.step = 'searching';
        await doSearch(input);
      } else {
        pushSystem('Please use buttons to continue.');
        if (session.activeLeadId) await openLead(String(session.activeLeadId));
        else buttons.push({ id: 'search', label: 'Search', action: { type: 'searchStart' } });
      }
    } else {
      // First load
      if (!session.activeLeadId) {
        pushSystem(`Hi ${(me as any)?.full_name || 'there'}! Search se start karein.`);
        buttons.push(
          { id: 'search', label: 'Search lead/job', variant: 'primary', action: { type: 'searchStart' } },
          { id: 'help', label: 'Help', action: { type: 'help' } }
        );
      } else {
        await openLead(String(session.activeLeadId));
      }
    }

    return NextResponse.json({
      ok: true,
      roleCode,
      tookMs: Date.now() - startedAt,
      session,
      messages,
      buttons,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

