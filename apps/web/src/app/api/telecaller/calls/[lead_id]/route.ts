/**
 * Get Call Logs for Lead API
 */

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lead_id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id } = await params;
    const leadId = String(lead_id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    // Resolve users_login profile robustly (email -> phone -> id) + role_code
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null as any };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null as any };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null as any };
    const userProfile = byEmail || byPhone || byId;
    const roleCode = (userProfile?.roles as any)?.role_code || null;

    // Prefer service-role client for reading call logs (avoids RLS mismatch)
    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    // Authorization: for TELECALLER, require that this lead is readable under RLS.
    // This matches the UI (lead detail page uses the client/RLS to fetch the lead).
    if (roleCode === 'TELECALLER') {
      const { data: canReadLead } = await supabase
        .from('service_leads')
        .select('id')
        .eq('id', leadId)
        .maybeSingle();
      if (!canReadLead) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let logsQuery = db
      .from('telecaller_call_logs')
      .select(`
        *,
        telecaller:users_login!telecaller_id(id, full_name)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    const { data: callLogs, error: logsError } = await logsQuery;

    if (logsError) {
      console.error('Error fetching call logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      call_logs: callLogs || [],
      total: callLogs?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get call logs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

