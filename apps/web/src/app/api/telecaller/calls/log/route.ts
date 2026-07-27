/**
 * Log Telecaller Call API
 * Purpose: Log telecaller call interactions
 */

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve users_login profile robustly (email -> phone -> id) + role_code via roles table
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, roles!inner(role_code)';

    const { data: byEmail, error: byEmailError } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null as any, error: null as any };
    const { data: byPhone, error: byPhoneError } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null as any, error: null as any };
    const { data: byId, error: byIdError } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null as any, error: null as any };

    const userProfile = byEmail || byPhone || byId;
    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [byEmailError?.message, byPhoneError?.message, byIdError?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    const roleCode = (userProfile.roles as any)?.role_code || null;
    const allowed = new Set(['TELECALLER', 'SUPER_ADMIN', 'LEAD_MANAGER', 'SUB_ADMIN']);
    if (!allowed.has(String(roleCode || ''))) {
      return NextResponse.json({ error: 'Forbidden: Telecaller only' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lead_id,
      call_type, // INBOUND, OUTBOUND
      call_status, // ANSWERED, MISSED, BUSY, NO_ANSWER, REJECTED
      call_duration,
      outcome, // LEAD_CREATED, FOLLOW_UP_SCHEDULED, NOT_INTERESTED, etc.
      customer_response,
      notes,
      next_action,
      next_action_time,
      phone_number,
      call_recording_url,
    } = body;

    if (!lead_id || !call_type || !call_status) {
      return NextResponse.json({
        error: 'Missing required fields: lead_id, call_type, call_status',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Prefer service-role client (bypasses RLS), fallback to user client
    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    // Create call log
    const { data: callLog, error: callError } = await db
      .from('telecaller_call_logs')
      .insert({
        lead_id: lead_id,
        telecaller_id: userProfile.id,
        call_type: call_type,
        call_status: call_status,
        call_duration: call_duration ?? null,
        outcome: outcome,
        customer_response: customer_response,
        notes: notes,
        next_action: next_action,
        next_action_time: next_action_time,
        phone_number: phone_number,
        call_recording_url: call_recording_url,
        created_at: now,
      })
      .select()
      .single();

    if (callError) {
      console.error('Error logging call:', callError);
      return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
    }

    // Lost / not interested → stop WhatsApp bot mid-flow (no more location/service prompts)
    const outcomeUpper = String(outcome || '').toUpperCase();
    const notesUpper = String(notes || '').toUpperCase();
    if (
      outcomeUpper === 'NOT_INTERESTED' ||
      notesUpper.includes('[LOST') ||
      notesUpper.includes('LOST ·')
    ) {
      try {
        const { stopWhatsAppBotForLostLead } = await import('@/lib/whatsappAgents/lostLeadGuard');
        const phone =
          phone_number ||
          (
            await db
              .from('service_leads')
              .select('customer_phone')
              .eq('id', lead_id)
              .maybeSingle()
          ).data?.customer_phone;
        await stopWhatsAppBotForLostLead(phone);
      } catch (stopErr) {
        console.warn('[calls/log] stop WhatsApp bot on Lost failed:', stopErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Call logged successfully',
      call_log: callLog,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in log call API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

