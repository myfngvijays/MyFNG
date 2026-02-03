import { createClient as createSupabaseAnonClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) return { supabaseAdmin: null as any, error: 'SUPABASE_SERVICE_ROLE_KEY not set' };
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null };
}

const VALID_BEFORE_TYPES = new Set([
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
  'BEFORE_DAMAGE',
  'BEFORE_TYRE',
]);

function inferSlotKey(row: any): string | null {
  const t = String(row?.photo_type || row?.category || '').trim().toUpperCase();
  if (t) return t;
  const fn = String(row?.file_name || '').trim();
  const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
  return m?.[1] ? m[1] : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    // Support both:
    // - Cookie auth (web)
    // - Authorization: Bearer <access_token> (mobile/external)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let supabase: any = null;
    let user: any = null;

    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token || token.toLowerCase() === 'undefined' || token.toLowerCase() === 'null') {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      supabase = createSupabaseAnonClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error: userError } = await supabase.auth.getUser(token);
      user = data?.user || null;
      if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    } else {
      supabase = await createClientFromRequest(request);
      const { data, error: userError } = await supabase.auth.getUser();
      user = data?.user || null;
      if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';
    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const profile = (byEmail || byPhone) as any;
    const roleCode = (profile?.roles as any)?.role_code as string | undefined;
    if (!profile || !roleCode) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const formData = await request.formData();
    const photoTypeRaw = (formData.get('photoType') || formData.get('photo_type') || '') as string;
    // We accept photo_category from client but store it in description (lead_media schema varies across installs)
    const photoCategoryRaw = (formData.get('photoCategory') || formData.get('photo_category') || 'before') as string;
    const file = formData.get('file') as File | null;
    const odometerReading = (formData.get('odometer_reading') as string | null) || null;
    const latitude = (formData.get('latitude') as string | null) || null;
    const longitude = (formData.get('longitude') as string | null) || null;

    const photoType = String(photoTypeRaw || '').trim().toUpperCase();
    const photoCategory = String(photoCategoryRaw || '').trim().toLowerCase() || 'before';

    if (!file || !photoType) {
      return NextResponse.json({ error: 'file and photo_type are required' }, { status: 400 });
    }
    if (!VALID_BEFORE_TYPES.has(photoType)) {
      return NextResponse.json({ error: 'Invalid photo_type for pickup/visit', provided_type: photoType }, { status: 400 });
    }

    // Check lead access using service role (workshop-scoped)
    const { data: lead, error: leadErr } = (await supabaseAdmin
      .from('service_leads')
      .select('id, workshop_id, assigned_mechanic_id, assigned_pickup_boy_id')
      .eq('id', leadId)
      .maybeSingle()) as any;
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const isPrivileged = roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN';
    if (!isPrivileged) {
      if (
        roleCode === 'WORKSHOP_ADMIN' ||
        roleCode === 'WORKSHOP_SUPERVISOR' ||
        roleCode === 'WORKSHOP_ADVISOR' ||
        roleCode === 'WORKSHOP_ADVISER'
      ) {
        if (!profile.workshop_id || lead.workshop_id !== profile.workshop_id) {
          return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
        }
      } else if (roleCode === 'WORKSHOP_PICKUP_BOY') {
        if (lead.assigned_pickup_boy_id !== profile.id) {
          return NextResponse.json({ error: 'Forbidden: Lead not assigned to you' }, { status: 403 });
        }
      } else if (roleCode === 'WORKSHOP_MECHANIC') {
        if (lead.assigned_mechanic_id !== profile.id) {
          return NextResponse.json({ error: 'Forbidden: Lead not assigned to you' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Upload to Storage via service role
    const fileExt = (file.name || 'jpg').split('.').pop() || 'jpg';
    const safeExt = fileExt.toLowerCase().slice(0, 8);
    const filePath = `vehicle-photos/${leadId}/${photoType}_${Date.now()}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using authed client (same behavior as existing uploads)
    const { error: uploadError } = await supabase.storage.from('service-media').upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) {
      console.error('[upload-pickup-visit-photos] Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload photo', details: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from('service-media').getPublicUrl(filePath);
    const fileUrl = publicUrlData.publicUrl;

    const now = new Date().toISOString();
    const isVideo = (file.type || '').startsWith('video/');
    // lead_media schema varies across installs:
    // - some expect PHOTO/VIDEO
    // - some expect BEFORE/AFTER/PROGRESS etc
    const mediaTypeCandidates = isVideo ? ['VIDEO', 'PHOTO', 'BEFORE'] : ['PHOTO', 'VIDEO', 'BEFORE'];
    const descriptionParts = [
      `PhotoCategory: ${photoCategory}`,
      odometerReading ? `Odometer: ${odometerReading}` : null,
      latitude && longitude ? `GPS: ${latitude},${longitude}` : null,
    ].filter(Boolean);

    const storedFileName = `${photoType}__${file.name || 'upload'}`;

    const payloadBase: any = {
      lead_id: leadId,
      file_url: fileUrl,
      file_name: storedFileName,
      file_size: (file as any)?.size ?? null,
      mime_type: file.type || null,
      uploaded_by: profile.id,
      created_at: now,
    };

    // Optional columns (may not exist depending on schema)
    const optional: any = {
      category: photoType,
      description: descriptionParts.length ? descriptionParts.join(' | ') : null,
    };

    let inserted: any = null;
    let lastError: any = null;

    for (const media_type of mediaTypeCandidates) {
      // Try with optional fields first, then without (schema-safe fallback)
      for (const variant of ['full', 'base'] as const) {
        const payload = variant === 'full' ? { ...payloadBase, ...optional, media_type } : { ...payloadBase, media_type };
        const { data, error: insErr } = await supabaseAdmin.from('lead_media').insert(payload as any).select().maybeSingle();
        if (!insErr && data) {
          inserted = data;
          break;
        }
        lastError = insErr;
        // If error is about missing columns, keep trying base variant or next media_type.
      }
      if (inserted) break;
    }

    if (!inserted) {
      console.error('[upload-pickup-visit-photos] DB insert error:', lastError);
      return NextResponse.json(
        { error: 'Failed to save media record', details: lastError?.message || 'Unknown insert error' },
        { status: 500 }
      );
    }

    // Persist pickup-boy odometer reading (so supervisor pickup details can display it).
    // The odometer input is collected when uploading BEFORE_DASHBOARD photo.
    try {
      const odo = odometerReading == null ? NaN : Number(String(odometerReading).trim());
      if (photoType === 'BEFORE_DASHBOARD' && Number.isFinite(odo) && odo > 0) {
        // 1) pickup_tracking.pickup_odometer_reading (canonical for pickup flow)
        // Some installs may not have created_at on pickup_tracking; be schema-tolerant.
        const upsertWithCreatedAt = await supabaseAdmin
          .from('pickup_tracking')
          .upsert(
            {
              lead_id: leadId,
              pickup_odometer_reading: odo,
              updated_at: now,
              created_at: now,
            } as any,
            { onConflict: 'lead_id' }
          );
        if (upsertWithCreatedAt.error && (upsertWithCreatedAt.error as any)?.code === '42703') {
          await supabaseAdmin
            .from('pickup_tracking')
            .upsert(
              {
                lead_id: leadId,
                pickup_odometer_reading: odo,
                updated_at: now,
              } as any,
              { onConflict: 'lead_id' }
            );
        }

        // 2) service_leads.vehicle_odometer (used across UI/invoice/PDF)
        // Best-effort: don't overwrite an existing positive odometer.
        const existingOdo = Number((lead as any)?.vehicle_odometer || 0) || 0;
        if (!(existingOdo > 0)) {
          await supabaseAdmin
            .from('service_leads')
            .update({ vehicle_odometer: odo, updated_at: now } as any)
            .eq('id', leadId);
        }
      }
    } catch {
      // Non-blocking: odometer persistence is best-effort
    }

    // Best-effort activity/event
    await supabaseAdmin.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'MEDIA_UPLOADED',
      event_description: `Pickup/Visit photo uploaded - ${photoType}`,
      event_data: { category: photoType, photo_category: photoCategory, file_url: fileUrl },
      created_by: profile.id,
      created_at: now,
    } as any);

    return NextResponse.json({ success: true, media: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

