import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

function digits10(input: unknown): string {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

function extractVehicleNumber(vehicleDetails: string): string | null {
  const candidate = vehicleDetails.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  if (regex.test(candidate)) return candidate;
  return null;
}

function parseAmount(input: unknown): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/telecaller/rsa-complaints/[id]
 * Fetch single RSA lead for edit (only if registered by this telecaller).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: lead, error } = await db
      .from('rsa_leads')
      .select(
        'id, customer_name, contact_number, alternate_number, vehicle_number, vehicle_model, service_type, source, location_link, drop_location, customer_quoted_amount, advance_payment, problem, description, lead_status, complaint_status, assigned_mechanic_id, registered_by_id, lead_registered_at, media_upload'
      )
      .eq('id', leadId)
      .maybeSingle();

    if (error || !lead?.id) {
      return NextResponse.json({ error: 'RSA lead not found', details: error?.message }, { status: 404 });
    }

    if (roleCode === 'TELECALLER' && String(lead.registered_by_id) !== String(profile.id)) {
      return NextResponse.json({ error: 'Forbidden: not your lead' }, { status: 403 });
    }

    return NextResponse.json({ success: true, lead }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/telecaller/rsa-complaints/[id]
 * Update RSA lead. Allowed only if no mechanic is assigned and lead is registered by this telecaller.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    const isFormData =
      contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded');

    let body: Record<string, unknown> = {};
    let mediaFiles: File[] = [];

    if (isFormData) {
      const fd = await request.formData();
      const keyMap = [
        'customer_name',
        'contact_number',
        'alternate_number',
        'vehicle_number',
        'vehicle_model',
        'vehicle_details',
        'source',
        'location_link',
        'drop_location',
        'service_type',
        'customer_quoted_amount',
        'advance_payment',
        'problem',
        'description',
      ] as const;
      for (const key of keyMap) {
        if (fd.has(key)) body[key] = String(fd.get(key) ?? '');
      }
      mediaFiles = (fd.getAll('media') || []).filter((f): f is File => f instanceof File);
    } else {
      body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: existing, error: fetchErr } = await db
      .from('rsa_leads')
      .select('id, registered_by_id, assigned_mechanic_id, media_upload')
      .eq('id', leadId)
      .maybeSingle();

    if (fetchErr || !existing?.id) {
      return NextResponse.json({ error: 'RSA lead not found' }, { status: 404 });
    }

    if (roleCode === 'TELECALLER' && String(existing.registered_by_id) !== String(profile.id)) {
      return NextResponse.json({ error: 'Forbidden: not your lead' }, { status: 403 });
    }

    if (existing.assigned_mechanic_id) {
      return NextResponse.json(
        { error: 'Lead cannot be edited after a mechanic has been assigned.' },
        { status: 403 }
      );
    }

    const existingMediaUrls: string[] = Array.isArray(existing.media_upload)
      ? existing.media_upload.filter((u: unknown) => typeof u === 'string' && Boolean(String(u).trim()))
      : [];

    if (mediaFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
    }
    if (existingMediaUrls.length + mediaFiles.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Only ${Math.max(0, MAX_FILES - existingMediaUrls.length)} additional image(s) can be uploaded` },
        { status: 400 }
      );
    }
    for (const f of mediaFiles) {
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${f.name}. Max 10MB` }, { status: 413 });
      }
      const mime = String(f.type || '').toLowerCase();
      if (!mime.startsWith('image/')) {
        return NextResponse.json({ error: `Only image files allowed: ${f.name}` }, { status: 400 });
      }
    }

    const contact_number = body.contact_number != null ? digits10(body.contact_number) : undefined;
    const alternate_number = body.alternate_number != null ? digits10(body.alternate_number) || null : undefined;
    const vehicle_number_raw = String(body.vehicle_number ?? '').trim();
    const vehicle_details = String(body.vehicle_details ?? '').trim();
    const vehicle_number =
      (vehicle_number_raw ? extractVehicleNumber(vehicle_number_raw) : null) ||
      (vehicle_details ? extractVehicleNumber(vehicle_details) : undefined);
    const vehicle_model = body.vehicle_model != null ? String(body.vehicle_model).trim() || null : undefined;
    const customer_quoted_amount = body.customer_quoted_amount != null ? parseAmount(body.customer_quoted_amount) : undefined;
    const lead_status = body.lead_status != null ? String(body.lead_status).trim().toLowerCase() || null : undefined;
    const complaint_status =
      body.complaint_status != null ? String(body.complaint_status).trim().toLowerCase() || null : undefined;
    const cancelled_remark =
      body.cancelled_remark != null ? String(body.cancelled_remark).trim() || null : undefined;

    const payload: Record<string, unknown> = {};
    if (body.customer_name !== undefined) payload.customer_name = String(body.customer_name).trim();
    if (contact_number !== undefined) payload.contact_number = contact_number;
    if (alternate_number !== undefined) payload.alternate_number = alternate_number;
    if (vehicle_number !== undefined) payload.vehicle_number = vehicle_number;
    if (vehicle_model !== undefined) payload.vehicle_model = vehicle_model;
    if (body.source !== undefined) payload.source = String(body.source).trim() || null;
    if (body.location_link !== undefined) payload.location_link = String(body.location_link).trim() || null;
    if (body.drop_location !== undefined) payload.drop_location = String(body.drop_location).trim() || null;
    if (body.service_type !== undefined) payload.service_type = String(body.service_type).trim();
    if (customer_quoted_amount !== undefined) payload.customer_quoted_amount = customer_quoted_amount;
    if (body.advance_payment !== undefined) payload.advance_payment = String(body.advance_payment).trim() || null;
    if (body.problem !== undefined) payload.problem = String(body.problem).trim() || null;
    if (body.description !== undefined) payload.description = String(body.description).trim() || null;
    if (lead_status !== undefined) payload.lead_status = lead_status;
    if (complaint_status !== undefined) payload.complaint_status = complaint_status;
    if (cancelled_remark !== undefined) payload.cancelled_remark = cancelled_remark;

    if (mediaFiles.length > 0) {
      const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
      if (!supabaseAdmin) {
        return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
      }

      const uploadedUrls: string[] = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        const ext = (file.name || 'jpg').split('.').pop() || 'jpg';
        const safeExt = ext.toLowerCase().slice(0, 8);
        const filePath = `rsa-complaints/${leadId}/${Date.now()}_edit_${i + 1}.${safeExt}`;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await (supabaseAdmin as any).storage.from('service-media').upload(filePath, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (uploadError) {
          return NextResponse.json(
            { error: 'Failed to upload media', details: uploadError.message, file: file.name },
            { status: 500 }
          );
        }

        const { data: publicUrlData } = (supabaseAdmin as any).storage.from('service-media').getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
      }

      if (uploadedUrls.length > 0) {
        payload.media_upload = [...existingMediaUrls, ...uploadedUrls];
      }
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ success: true, id: leadId }, { status: 200 });
    }

    const isCancelledNow = String(payload.lead_status || payload.complaint_status || '')
      .toLowerCase()
      .includes('cancelled');
    if (isCancelledNow) {
      payload.cancelled_at = new Date().toISOString();
    }

    payload.updated_at = new Date().toISOString();

    const { error: updateErr } = await db
      .from('rsa_leads')
      .update(payload)
      .eq('id', leadId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update lead', details: updateErr.message }, { status: 500 });
    }

    // Best-effort timeline/history on status changes.
    if (lead_status !== undefined || complaint_status !== undefined) {
      const statusForLogs = String((payload.complaint_status || payload.lead_status || '') as string).trim() || 'updated';
      const changedByName = String((profile as any)?.full_name || (profile as any)?.email || 'Telecaller');
      const notes =
        String(cancelled_remark || '').trim() ||
        (statusForLogs === 'cancelled' ? 'Cancelled by telecaller' : `Status updated to ${statusForLogs}`);
      const now = new Date().toISOString();
      try {
        await db.from('rsa_lead_timeline').insert({
          lead_id: leadId,
          status: statusForLogs,
          status_description: notes,
          updated_by_id: profile.id,
          updated_by_name: changedByName,
          updated_at: now,
          created_at: now,
        });
      } catch {
        // ignore
      }
      try {
        await db.from('rsa_lead_status_history').insert({
          rsa_lead_id: leadId,
          status: statusForLogs,
          changed_at: now,
          changed_by: profile.id,
          changed_by_name: changedByName,
          notes,
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ success: true, id: leadId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
