/**
 * Log Telecaller Call API
 * Purpose: Log telecaller call interactions + sync lead disposition/status
 */

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';
import { parseCallDisposition } from '@/lib/telecaller/callDisposition';

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
      activity, // INTERESTED | LOST | BOOKING_CONFIRMED | …
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

    // Sync disposition onto service_leads (status + coupon_meta) so UI badge matches call history
    const disposition = parseCallDisposition({
      notes,
      outcome,
      activity,
      call_status,
    });
    let leadPatch: Record<string, unknown> | null = null;
    try {
      const { data: leadRow } = await db
        .from('service_leads')
        .select('id, status, total_calls, coupon_meta, customer_phone')
        .eq('id', lead_id)
        .maybeSingle();

      if (leadRow) {
        const prevMeta =
          leadRow.coupon_meta && typeof leadRow.coupon_meta === 'object'
            ? (leadRow.coupon_meta as Record<string, unknown>)
            : {};
        const totalCalls = Number(leadRow.total_calls || 0) + 1;
        const patch: Record<string, unknown> = {
          total_calls: totalCalls,
          updated_at: now,
        };

        if (disposition && disposition.result !== 'RINGING') {
          const historyEntry = {
            at: now,
            summary: `Call: ${disposition.label}`,
            remark: String(notes || '').replace(/^\[[^\]]+\]\s*/, '').trim() || null,
            status: disposition.result,
          };
          const prevHistory = Array.isArray(prevMeta.profile_history)
            ? prevMeta.profile_history
            : [];
          patch.coupon_meta = {
            ...prevMeta,
            last_call_status: call_status,
            last_call_result: disposition.result,
            last_call_label: disposition.label,
            last_call_at: now,
            last_lost_reason: disposition.lostReason,
            telecaller_remarks:
              String(notes || '').replace(/^\[[^\]]+\]\s*/, '').trim() ||
              prevMeta.telecaller_remarks ||
              null,
            profile_history: [historyEntry, ...prevHistory].slice(0, 50),
          };
          if (disposition.leadStatus) {
            const current = String(leadRow.status || '').toUpperCase();
            // Advance from early pipeline statuses; always allow Lost
            if (
              disposition.leadStatus === 'REJECTED' ||
              ['NEW', 'CONTACTED', 'INCOMPLETE', 'PENDING', 'ASSIGNED'].includes(current)
            ) {
              patch.status = disposition.leadStatus;
            }
          }
        }

        const { error: leadErr } = await db.from('service_leads').update(patch).eq('id', lead_id);
        if (leadErr) {
          console.warn('[calls/log] lead disposition sync failed:', leadErr.message);
        } else {
          leadPatch = patch;
        }
      }
    } catch (syncErr) {
      console.warn('[calls/log] lead disposition sync error:', syncErr);
    }

    // Lost / not interested → stop WhatsApp bot mid-flow (no more location/service prompts)
    const outcomeUpper = String(outcome || '').toUpperCase();
    const notesUpper = String(notes || '').toUpperCase();
    const isLost =
      disposition?.result === 'LOST' ||
      outcomeUpper === 'NOT_INTERESTED' ||
      notesUpper.includes('[LOST') ||
      notesUpper.includes('LOST ·') ||
      notesUpper.includes('LOST -');
    if (isLost) {
      try {
        const { stopWhatsAppBotForLostLead } = await import('@/lib/whatsappAgents/lostLeadGuard');
        let phone = phone_number || null;
        if (!phone) {
          const { data: phoneRow } = await db
            .from('service_leads')
            .select('customer_phone')
            .eq('id', lead_id)
            .maybeSingle();
          phone = phoneRow?.customer_phone || null;
        }
        await stopWhatsAppBotForLostLead(phone);
      } catch (stopErr) {
        console.warn('[calls/log] stop WhatsApp bot on Lost failed:', stopErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Call logged successfully',
      call_log: callLog,
      lead_updated: Boolean(leadPatch),
      disposition: disposition || null,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in log call API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

