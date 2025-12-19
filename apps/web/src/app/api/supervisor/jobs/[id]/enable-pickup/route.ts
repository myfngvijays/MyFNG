/**
 * Supervisor Enable Pickup API
 * Purpose: Allow workshop supervisor to enable pickup on a lead if not added yet.
 *
 * POST /api/supervisor/jobs/:id/enable-pickup
 * Body (optional): { pickup_address?: string | null, preferred_date?: string | null, preferred_time_slot?: string | null }
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };

    const { data: userProfileByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    const { data: userProfileById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json().catch(() => ({} as any));
    const providedPickupAddress = (body?.pickup_address ?? null) as string | null;
    const preferredDate = (body?.preferred_date ?? null) as string | null; // YYYY-MM-DD
    const preferredTimeSlot = (body?.preferred_time_slot ?? null) as string | null; // free text like "10:00 AM - 12:00 PM"

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Verify lead is from this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Job not in your workshop' }, { status: 403 });
    }

    // If already enabled, return success (idempotent)
    if (lead.pickup_required === true) {
      const now = new Date().toISOString();
      const pickupAddress =
        (providedPickupAddress || '').trim() ||
        (lead.pickup_address || '').trim() ||
        (lead.customer_address || '').trim() ||
        (lead.address || '').trim() ||
        null;

      const wantsUpdate =
        Boolean((providedPickupAddress || '').trim()) ||
        Boolean((preferredDate || '').trim()) ||
        Boolean((preferredTimeSlot || '').trim());

      if (!wantsUpdate) {
        return NextResponse.json(
          {
            success: true,
            message: 'Pickup is already enabled for this lead.',
          },
          { status: 200 }
        );
      }

      const updateData: any = {
        pickup_address: pickupAddress,
        preferred_date: preferredDate || null,
        preferred_time_slot: preferredTimeSlot || null,
        updated_at: now,
      };

      const { data: updatedLead, error: updateError } = await supabase
        .from('service_leads')
        .update(updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating pickup details:', updateError);
        return NextResponse.json({ error: 'Failed to update pickup details', details: updateError.message }, { status: 500 });
      }

      // Upsert pickup_tracking for scheduling visibility across dashboards (best-effort)
      const { error: trackingError } = await supabase
        .from('pickup_tracking')
        .upsert(
          {
            lead_id: leadId,
            pickup_address: pickupAddress,
            pickup_time_slot: preferredTimeSlot || null,
            updated_at: now,
          },
          { onConflict: 'lead_id' }
        );

      if (trackingError) {
        console.warn('Warning: failed to upsert pickup_tracking:', trackingError);
      }

      // Activity (best-effort)
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PICKUP_DETAILS_UPDATED',
        description: `Supervisor updated pickup details${preferredDate ? ` (${preferredDate}${preferredTimeSlot ? `, ${preferredTimeSlot}` : ''})` : ''}`,
        metadata: { pickup_address: pickupAddress, preferred_date: preferredDate, preferred_time_slot: preferredTimeSlot },
      });

      await supabase.from('supervisor_actions').insert({
        supervisor_id: userProfile.id,
        lead_id: leadId,
        action_type: 'PICKUP_DETAILS_UPDATED',
        action_description: 'Updated pickup details',
        action_data: {
          pickup_address: pickupAddress,
          preferred_date: preferredDate,
          preferred_time_slot: preferredTimeSlot,
        },
        created_at: now,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Pickup details updated.',
          lead: updatedLead,
        },
        { status: 200 }
      );
    }

    const now = new Date().toISOString();
    const pickupAddress =
      (lead.pickup_address || '').trim() ||
      (providedPickupAddress || '').trim() ||
      (lead.customer_address || '').trim() ||
      (lead.address || '').trim() ||
      null;

    const updateData: any = {
      pickup_required: true,
      pickup_status: lead.pickup_status || 'NOT_ASSIGNED',
      pickup_address: pickupAddress,
      preferred_date: preferredDate || null,
      preferred_time_slot: preferredTimeSlot || null,
      assigned_pickup_boy_id: null,
      updated_at: now,
    };

    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error enabling pickup:', updateError);
      return NextResponse.json({ error: 'Failed to enable pickup', details: updateError.message }, { status: 500 });
    }

    // Upsert pickup_tracking for scheduling visibility across dashboards (best-effort)
    const { error: trackingError } = await supabase
      .from('pickup_tracking')
      .upsert(
        {
          lead_id: leadId,
          pickup_address: pickupAddress,
          pickup_time_slot: preferredTimeSlot || null,
          updated_at: now,
        },
        { onConflict: 'lead_id' }
      );

    if (trackingError) {
      // Non-fatal: lead update succeeded, but tracking table didn't update.
      console.warn('Warning: failed to upsert pickup_tracking:', trackingError);
    }

    // Create activity log (best-effort)
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: userProfile.id,
      activity_type: 'PICKUP_ENABLED',
      description: `Supervisor enabled pickup for this lead${preferredDate ? ` (${preferredDate}${preferredTimeSlot ? `, ${preferredTimeSlot}` : ''})` : ''}`,
      metadata: {
        supervisor_id: userProfile.id,
        enabled_at: now,
        preferred_date: preferredDate,
        preferred_time_slot: preferredTimeSlot,
      },
    });

    // Log supervisor action (best-effort)
    await supabase.from('supervisor_actions').insert({
      supervisor_id: userProfile.id,
      lead_id: leadId,
      action_type: 'PICKUP_ENABLED',
      action_description: 'Enabled pickup for lead',
      action_data: {
        pickup_address: pickupAddress,
        preferred_date: preferredDate,
        preferred_time_slot: preferredTimeSlot,
      },
      created_at: now,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Pickup enabled. Now assign a pickup boy from Pickup & Delivery.',
        lead: updatedLead,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in enable pickup API:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

