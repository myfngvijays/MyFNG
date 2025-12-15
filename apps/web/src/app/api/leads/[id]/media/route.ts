import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

type RoleCode =
  | 'SUPER_ADMIN'
  | 'SUB_ADMIN'
  | 'WORKSHOP_ADMIN'
  | 'WORKSHOP_SUPERVISOR'
  | 'WORKSHOP_MECHANIC'
  | 'WORKSHOP_PICKUP_BOY';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, profile: null, roleCode: null as string | null, error: 'Unauthorized' };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const profile = byEmail || byPhone || byId;
  const roleCode = (profile?.roles as any)?.role_code || null;
  return { user, profile, roleCode, error: profile ? null : 'User profile not found' };
}

async function assertLeadAccess(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient<Database>>,
  leadId: string,
  roleCode: string | null,
  userId: string,
  userWorkshopId: string | null
) {
  // NOTE: Supabase typed client can infer `never` here depending on generated Database types.
  // We intentionally cast to a minimal shape to keep build stable.
  const { data: lead, error } = (await supabaseAdmin
    .from('service_leads')
    .select('id, workshop_id, assigned_mechanic_id, assigned_pickup_boy_id')
    .eq('id', leadId)
    .maybeSingle()) as any as {
    data: {
      id: string;
      workshop_id: string | null;
      assigned_mechanic_id: string | null;
      assigned_pickup_boy_id: string | null;
    } | null;
    error: any;
  };

  if (error || !lead) return { ok: false, status: 404 as const, payload: { error: 'Lead not found' } };

  const rc = roleCode as RoleCode | null;
  const isPrivileged = rc === 'SUPER_ADMIN' || rc === 'SUB_ADMIN';

  if (isPrivileged) return { ok: true, lead };

  if (!rc) return { ok: false, status: 403 as const, payload: { error: 'Forbidden: Role not found' } };

  if (rc === 'WORKSHOP_ADMIN' || rc === 'WORKSHOP_SUPERVISOR') {
    if (!userWorkshopId || lead.workshop_id !== userWorkshopId) {
      return { ok: false, status: 403 as const, payload: { error: 'Forbidden: Lead not in your workshop' } };
    }
    return { ok: true, lead };
  }

  if (rc === 'WORKSHOP_MECHANIC') {
    if (lead.assigned_mechanic_id !== userId) {
      return { ok: false, status: 403 as const, payload: { error: 'Forbidden: Lead not assigned to you' } };
    }
    return { ok: true, lead };
  }

  if (rc === 'WORKSHOP_PICKUP_BOY') {
    if (lead.assigned_pickup_boy_id !== userId) {
      return { ok: false, status: 403 as const, payload: { error: 'Forbidden: Lead not assigned to you' } };
    }
    return { ok: true, lead };
  }

  return { ok: false, status: 403 as const, payload: { error: 'Forbidden' } };
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) {
    return { supabaseAdmin: null, error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set' };
  }
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const leadId = params.id;
    const access = await assertLeadAccess(supabaseAdmin, leadId, roleCode, profile.id, profile.workshop_id || null);
    if (!access.ok) return NextResponse.json(access.payload, { status: access.status });

    const { data, error: fetchError } = await supabaseAdmin
      .from('lead_media')
      .select(
        `
        *,
        uploader:uploaded_by(full_name)
      `
      )
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch media', details: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, media: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const leadId = params.id;
    const access = await assertLeadAccess(supabaseAdmin, leadId, roleCode, profile.id, profile.workshop_id || null);
    if (!access.ok) return NextResponse.json(access.payload, { status: access.status });

    const body = await request.json().catch(() => ({}));
    const {
      file_url,
      media_type,
      category,
      description,
      file_name,
      file_size,
      mime_type,
    } = body || {};

    if (!file_url || !media_type || !category) {
      return NextResponse.json(
        { error: 'Missing required fields', required: ['file_url', 'media_type', 'category'] },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('lead_media')
      .insert({
        lead_id: leadId,
        file_url,
        media_type,
        category,
        description: description || null,
        file_name: file_name || null,
        file_size: file_size || null,
        mime_type: mime_type || null,
        uploaded_by: profile.id,
        created_at: now,
      } as any)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Failed to save media record', details: insertError.message }, { status: 500 });
    }

    // Non-blocking audit/event
    await supabaseAdmin.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'MEDIA_UPLOADED',
      event_description: `${media_type} uploaded - ${category}`,
      event_data: { media_category: category, media_type, file_name },
      created_by: profile.id,
      created_at: now,
    } as any);

    return NextResponse.json({ success: true, media: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const leadId = params.id;
    const access = await assertLeadAccess(supabaseAdmin, leadId, roleCode, profile.id, profile.workshop_id || null);
    if (!access.ok) return NextResponse.json(access.payload, { status: access.status });

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');
    if (!mediaId) return NextResponse.json({ error: 'media_id is required' }, { status: 400 });

    // Fetch record first to enforce ownership for mechanics/pickup boys (optional strictness)
  const { data: mediaRow } = (await supabaseAdmin
    .from('lead_media')
    .select('id, uploaded_by')
    .eq('id', mediaId)
    .eq('lead_id', leadId)
    .maybeSingle()) as any as { data: { id: string; uploaded_by: string | null } | null };

    if (!mediaRow) return NextResponse.json({ error: 'Media not found' }, { status: 404 });

    const rc = roleCode as RoleCode | null;
    const isPrivileged = rc === 'SUPER_ADMIN' || rc === 'SUB_ADMIN' || rc === 'WORKSHOP_ADMIN' || rc === 'WORKSHOP_SUPERVISOR';
    if (!isPrivileged && mediaRow.uploaded_by !== profile.id) {
      return NextResponse.json({ error: 'Forbidden: Can only delete your own uploads' }, { status: 403 });
    }

    const { error: delError } = await supabaseAdmin
      .from('lead_media')
      .delete()
      .eq('id', mediaId)
      .eq('lead_id', leadId);

    if (delError) return NextResponse.json({ error: 'Failed to delete media', details: delError.message }, { status: 500 });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

