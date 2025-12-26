import { createClient as createSupabaseAnonClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAnonClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

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

    const leadId = params.id;
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const point = String(formData.get('point') || '').trim(); // new numbering (1..)
    const serial = String(formData.get('serial') || '').trim(); // old serial (internal), optional

    if (!file || !point) {
      return NextResponse.json({ error: 'file and point are required' }, { status: 400 });
    }

    // Workshop-scoped access check using service role
    const { data: lead, error: leadErr } = (await supabaseAdmin
      .from('service_leads')
      .select('id, workshop_id, assigned_mechanic_id, assigned_pickup_boy_id')
      .eq('id', leadId)
      .maybeSingle()) as any;
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const isPrivileged = roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN';
    if (!isPrivileged) {
      // allow supervisor/admin only (QC flow)
      if (roleCode === 'WORKSHOP_ADMIN' || roleCode === 'WORKSHOP_SUPERVISOR') {
        if (!profile.workshop_id || lead.workshop_id !== profile.workshop_id) {
          return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Upload to Storage via authed client (same as existing routes)
    const fileExt = (file.name || 'jpg').split('.').pop() || 'jpg';
    const safeExt = fileExt.toLowerCase().slice(0, 8);
    const filePath = `qc-proof/${leadId}/P${point}_${Date.now()}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage.from('service-media').upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) {
      console.error('[upload-qc-proof] Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload proof', details: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from('service-media').getPublicUrl(filePath);
    const fileUrl = publicUrlData.publicUrl;

    const now = new Date().toISOString();

    // IMPORTANT:
    // UI expects lead_media.media_type to be 'IMAGE' | 'VIDEO' | 'DOCUMENT' (see MediaSection).
    // Older code used 'PHOTO' which gets rendered as a video placeholder.
    const inferredMediaType = (file.type || '').toLowerCase().startsWith('video/') ? 'VIDEO' : 'IMAGE';

    // Save record in lead_media (schema-safe: only base + optional fields)
    const payloadBase: any = {
      lead_id: leadId,
      file_url: fileUrl,
      file_name: `QC_PROOF__P${point}__${file.name || 'upload'}`,
      file_size: (file as any)?.size ?? null,
      mime_type: file.type || null,
      uploaded_by: profile.id,
      created_at: now,
    };

    const optional: any = {
      category: 'QC_PROOF',
      description: `QC Proof | point=${point}${serial ? ` | serial=${serial}` : ''}`,
    };

    let inserted: any = null;
    let lastError: any = null;
    for (const variant of ['full', 'base'] as const) {
      const payload =
        variant === 'full'
          ? { ...payloadBase, ...optional, media_type: inferredMediaType }
          : { ...payloadBase, media_type: inferredMediaType };
      const { data, error } = await supabaseAdmin.from('lead_media').insert(payload as any).select().maybeSingle();
      if (!error && data) {
        inserted = data;
        break;
      }
      lastError = error;
    }

    if (!inserted) {
      console.error('[upload-qc-proof] DB insert error:', lastError);
      return NextResponse.json({ error: 'Failed to save proof record', details: lastError?.message || 'Unknown insert error' }, { status: 500 });
    }

    await supabaseAdmin.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'QC_PROOF_UPLOADED',
      event_description: `QC proof uploaded for point ${point}`,
      event_data: { point, serial: serial || null, file_url: fileUrl },
      created_by: profile.id,
      created_at: now,
    } as any);

    return NextResponse.json({ success: true, file_url: fileUrl, media: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


