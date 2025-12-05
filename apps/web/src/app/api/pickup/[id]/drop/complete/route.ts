import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/drop/complete
 * Complete drop process
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { 
      notes, 
      latitude, 
      longitude,
      payment_mode,
      payment_amount,
      payment_proof_url,
      odometer_reading,        // ✨ NEW: Odometer reading at delivery
      final_remarks,           // ✨ NEW: Customer issues reported at delivery
      invoice_paid,            // ✨ NEW: Invoice payment verification
      invoice_id               // ✨ NEW: Reference to invoice
    } = body;

    // Check if minimum drop photos are uploaded
    const { count: photoCount, error: photoCountError } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'DROP_%');

    if (photoCountError) {
      return NextResponse.json({ error: 'Failed to check photos' }, { status: 500 });
    }

    if ((photoCount || 0) < 3) {
      return NextResponse.json({ 
        error: 'Minimum 3 drop photos required',
        required_photos: ['DROP_FRONT', 'DROP_INTERIOR', 'AFTER_WORK']
      }, { status: 400 });
    }

    // Update drop tracking with all new fields
    const updateData: any = {
      drop_status: 'DELIVERED',
      drop_completed_time: new Date().toISOString(),
      drop_odometer_reading: odometer_reading || null, // ✨ NEW: Odometer reading at delivery
      drop_final_remarks: final_remarks || null,        // ✨ NEW: Customer issues reported at delivery
      drop_notes: notes,
      updated_at: new Date().toISOString(),
    };
    
    // Add invoice verification if provided
    if (invoice_paid !== undefined) {
      updateData.invoice_paid = invoice_paid;
      if (invoice_paid) {
        updateData.invoice_paid_at = new Date().toISOString();
        updateData.invoice_paid_by = user.id;
      }
      if (invoice_id) {
        updateData.invoice_id = invoice_id;
      }
    }

    // Add payment info if COD
    if (payment_mode === 'COD' && payment_amount) {
      updateData.payment_mode = payment_mode;
      updateData.payment_amount = payment_amount;
      updateData.payment_collected_at = new Date().toISOString();
      if (payment_proof_url) {
        updateData.payment_proof_url = payment_proof_url;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update(updateData)
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to complete drop', details: updateError.message }, { status: 500 });
    }

    // Log location
    if (latitude && longitude) {
      await supabase.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'AT_DROP',
      });
    }

    // Update lead status to COMPLETED
    await supabase
      .from('service_leads')
      .update({ 
        status: 'COMPLETED', 
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', leadId);

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'DROP_COMPLETED',
      description: 'Vehicle delivered to customer',
      metadata: { notes, latitude, longitude, payment_mode, payment_amount },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Drop completed successfully',
    });
  } catch (error: any) {
    console.error('Error completing drop:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

