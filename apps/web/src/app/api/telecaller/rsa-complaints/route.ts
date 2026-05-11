import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

function digits10(input: unknown) {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

function parseAmount(input: unknown): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractVehicleNumber(vehicleDetails: string): string | null {
  // Match common Indian format e.g. MH12AB1234 (allow separators/spaces in input)
  const candidate = vehicleDetails.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  if (regex.test(candidate)) return candidate;
  return null;
}

async function resolveUserProfile(supabase: any, user: any) {
  const email = (user?.email || '').trim();
  const phone = (user?.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';

  const { data: byEmail, error: byEmailError } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null as any, error: null as any };
  const { data: byPhone, error: byPhoneError } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null as any, error: null as any };
  const { data: byId, error: byIdError } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user?.id).maybeSingle()
    : { data: null as any, error: null as any };

  const profile = byEmail || byPhone || byId;
  const lookupErrors = [byEmailError?.message, byPhoneError?.message, byIdError?.message].filter(Boolean);
  return { profile, lookupErrors };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profile, lookupErrors } = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: user.email || null,
          user_phone: user.phone || null,
          profile_lookup_errors: lookupErrors,
        },
        { status: 404 }
      );
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Telecaller only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: leads, error } = await db
      .from('rsa_leads')
      .select(
        'id, customer_name, contact_number, vehicle_number, vehicle_model, service_type, lead_status, complaint_status, source, location_link, media_upload, lead_registered_at, requested_at, assigned_mechanic_id'
      )
      .eq('registered_by_id', profile.id)
      .order('lead_registered_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSA leads', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, leads: leads || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profile, lookupErrors } = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: user.email || null,
          user_phone: user.phone || null,
          profile_lookup_errors: lookupErrors,
        },
        { status: 404 }
      );
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Telecaller only' }, { status: 403 });
    }

    const fd = await request.formData();

    const customer_name = String(fd.get('customer_name') || '').trim();
    const contact_number = digits10(fd.get('contact_number'));
    const alternate_number = digits10(fd.get('alternate_number')) || null;
    const vehicle_details = String(fd.get('vehicle_details') || '').trim();
    const vehicle_number_raw = String(fd.get('vehicle_number') || '').trim();
    const vehicle_model_raw = String(fd.get('vehicle_model') || '').trim();
    const source = String(fd.get('source') || '').trim() || null;
    const location_link = String(fd.get('location_link') || '').trim() || null;
    const drop_location = String(fd.get('drop_location') || '').trim() || null;
    const service_type = String(fd.get('service_type') || '').trim();
    const customer_quoted_amount = parseAmount(fd.get('customer_quoted_amount'));
    const advance_payment = String(fd.get('advance_payment') || '').trim() || null;
    const problem = String(fd.get('problem') || '').trim() || null;

    const mediaFiles = (fd.getAll('media') || []).filter(Boolean) as File[];

    if (!customer_name) return NextResponse.json({ error: 'customer_name is required' }, { status: 400 });
    if (!contact_number || contact_number.length < 10) {
      return NextResponse.json({ error: 'Valid 10-digit contact_number is required' }, { status: 400 });
    }
    if (!service_type) return NextResponse.json({ error: 'service_type is required' }, { status: 400 });
    if (service_type.toLowerCase() === 'towing' && !drop_location) {
      return NextResponse.json({ error: 'drop_location is required for towing' }, { status: 400 });
    }

    if (mediaFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
    }

    for (const f of mediaFiles) {
      if (!f || typeof (f as any).arrayBuffer !== 'function') continue;
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${f.name}. Max 10MB` }, { status: 413 });
      }
      const mime = String(f.type || '').toLowerCase();
      if (!mime.startsWith('image/')) {
        return NextResponse.json({ error: `Only image files allowed: ${f.name}` }, { status: 400 });
      }
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const db = supabaseAdmin as any;
    const now = new Date().toISOString();

    const vehicle_number =
      (vehicle_number_raw ? extractVehicleNumber(vehicle_number_raw) : null) ||
      (vehicle_details ? extractVehicleNumber(vehicle_details) : null);

    const vehicle_model = vehicle_model_raw || (vehicle_details || null);

    const registeredByName = String(profile.full_name || profile.email || '').trim() || null;

    const insertPayload: any = {
      customer_name,
      contact_number,
      alternate_number,
      vehicle_number,
      vehicle_model,
      service_type,
      source,
      location_link,
      drop_location,
      customer_quoted_amount,
      advance_payment,
      problem,
      description: problem,
      lead_status: 'pending',
      complaint_status: 'registered',
      registered_by_id: profile.id,
      registered_by_name: registeredByName,
      lead_registered_at: now,
      register_datetime: now,
      requested_at: now,
      updated_at: now,
      delete_status: false,
    };

    const { data: lead, error: insErr } = await db.from('rsa_leads').insert(insertPayload).select('id').single();
    if (insErr || !lead?.id) {
      return NextResponse.json({ error: 'Failed to create RSA complaint', details: insErr?.message }, { status: 500 });
    }

    const urls: string[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const ext = (file.name || 'jpg').split('.').pop() || 'jpg';
      const safeExt = ext.toLowerCase().slice(0, 8);
      const filePath = `rsa-complaints/${lead.id}/${Date.now()}_${i + 1}.${safeExt}`;

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
      if (publicUrlData?.publicUrl) urls.push(publicUrlData.publicUrl);
    }

    if (urls.length > 0) {
      const { error: upErr } = await db
        .from('rsa_leads')
        .update({ media_upload: urls, updated_at: now })
        .eq('id', lead.id);
      if (upErr) {
        // non-fatal, but report
        return NextResponse.json(
          { success: true, id: lead.id, warning: 'Created complaint but failed to attach media', media_error: upErr.message },
          { status: 201 }
        );
      }
    }

    // Best-effort timeline/history (schema should exist per RSA migrations)
    try {
      await db.from('rsa_lead_timeline').insert({
        lead_id: lead.id,
        status: 'registered',
        status_description: 'Complaint registered',
        updated_by_id: profile.id,
        updated_by_name: registeredByName,
        updated_at: now,
        created_at: now,
      });
    } catch {
      // ignore
    }
    try {
      await db.from('rsa_lead_status_history').insert({
        rsa_lead_id: lead.id,
        status: 'registered',
        changed_at: now,
        changed_by: profile.id,
        changed_by_name: registeredByName,
        notes: 'Registered by telecaller',
      });
    } catch {
      // ignore
    }

    // Re-push enriched lead to TeleCRM. The DB trigger has already merged this
    // RSA lead's fields (name/city/vehicle/quoted amount/location) into any
    // telecrm_api rows for the same mobile. Push the latest snapshot now so
    // TeleCRM reflects the registered complaint without waiting for the cron.
    try {
      const { syncTelecrmRowByMobileSafe } = await import('@/lib/telecrm/push');
      syncTelecrmRowByMobileSafe(db, contact_number, 'rsa-complaint create telecrm-push');
    } catch (e: any) {
      console.error('[rsa-complaints POST] telecrm push schedule failed:', e?.message || e);
    }

    return NextResponse.json({ success: true, id: lead.id, media_upload: urls }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

