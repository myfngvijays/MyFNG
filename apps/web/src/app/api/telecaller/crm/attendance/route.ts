import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

function isMissingTableError(err: any) {
  const msg = String(err?.message || err?.details || err?.hint || '');
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    /telecaller_attendance/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /relation/i.test(msg)
  );
}

/**
 * GET  /api/telecaller/crm/attendance — today status + recent history
 * POST /api/telecaller/crm/attendance — punch_in | punch_out
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    if (!profile?.id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    // IST calendar date for "today"
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const openRes = await db
      .from('telecaller_attendance')
      .select('*')
      .eq('telecaller_id', profile.id)
      .is('punch_out_at', null)
      .order('punch_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openRes.error && isMissingTableError(openRes.error)) {
      return NextResponse.json({
        success: true,
        is_punched_in: false,
        open_session: null,
        today: [],
        history: [],
        warning: 'Run database migration 282_telecaller_crm_advanced.sql to enable attendance',
      });
    }

    if (openRes.error) {
      return NextResponse.json({
        success: true,
        is_punched_in: false,
        open_session: null,
        today: [],
        history: [],
        warning: openRes.error.message,
      });
    }

    const { data: history, error: histErr } = await db
      .from('telecaller_attendance')
      .select('*')
      .eq('telecaller_id', profile.id)
      .order('punch_in_at', { ascending: false })
      .limit(14);

    const { data: todayRows } = await db
      .from('telecaller_attendance')
      .select('*')
      .eq('telecaller_id', profile.id)
      .eq('work_date', today);

    return NextResponse.json({
      success: true,
      is_punched_in: Boolean(openRes.data),
      open_session: openRes.data || null,
      today: todayRows || [],
      history: histErr ? [] : history || [],
      profile_id: profile.id,
    });
  } catch (e: any) {
    if (isMissingTableError(e)) {
      return NextResponse.json({
        success: true,
        is_punched_in: false,
        open_session: null,
        today: [],
        history: [],
        warning: 'Run database migration 282_telecaller_crm_advanced.sql to enable attendance',
      });
    }
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    if (!profile?.id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').toLowerCase();
    const lat = body?.lat != null ? Number(body.lat) : null;
    const lng = body?.lng != null ? Number(body.lng) : null;
    const notes = body?.notes ? String(body.notes) : null;

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;
    const now = new Date().toISOString();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    if (action === 'punch_in') {
      const { data: open, error: openErr } = await db
        .from('telecaller_attendance')
        .select('id')
        .eq('telecaller_id', profile.id)
        .is('punch_out_at', null)
        .maybeSingle();

      if (openErr && isMissingTableError(openErr)) {
        return NextResponse.json({
          error: 'Run database migration 282_telecaller_crm_advanced.sql first',
        }, { status: 503 });
      }
      if (openErr) return NextResponse.json({ error: openErr.message }, { status: 400 });

      if (open) {
        return NextResponse.json({ success: true, session: open, already: true });
      }

      const { data, error } = await db
        .from('telecaller_attendance')
        .insert([{
          telecaller_id: profile.id,
          punch_in_at: now,
          punch_in_lat: lat,
          punch_in_lng: lng,
          notes,
          work_date: today,
        }])
        .select('*')
        .single();

      if (error) {
        if (isMissingTableError(error)) {
          return NextResponse.json({
            error: 'Run database migration 282_telecaller_crm_advanced.sql first',
          }, { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, session: data });
    }

    if (action === 'punch_out') {
      const { data: open, error: openErr } = await db
        .from('telecaller_attendance')
        .select('*')
        .eq('telecaller_id', profile.id)
        .is('punch_out_at', null)
        .order('punch_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openErr) return NextResponse.json({ error: openErr.message }, { status: 400 });
      if (!open) return NextResponse.json({ error: 'No open session' }, { status: 400 });

      const { data, error } = await db
        .from('telecaller_attendance')
        .update({
          punch_out_at: now,
          punch_out_lat: lat,
          punch_out_lng: lng,
          notes: notes || open.notes,
          updated_at: now,
        })
        .eq('id', open.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, session: data });
    }

    return NextResponse.json({ error: 'action must be punch_in or punch_out' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Punch failed' }, { status: 500 });
  }
}
