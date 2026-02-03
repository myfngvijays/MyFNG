import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/leads/[id]/job-card
 * 
 * Create a new job card for a lead
 * 
 * Body:
 * - labor_charges: Optional labor charges (default: 0)
 * - additional_work: Optional additional work description
 * - mechanic_notes: Optional mechanic notes
 */
export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has permission (Admin, Supervisor, or Mechanic)
    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoles = ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_MECHANIC'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const leadId = params.id;
    const { labor_charges = 0, additional_work, mechanic_notes } = await request.json();

    // Check if lead exists
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, lead_number')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check if job card already exists
    const { data: existingJobCard } = await supabase
      .from('job_cards')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (existingJobCard) {
      return NextResponse.json({ error: 'Job card already exists for this lead' }, { status: 400 });
    }

    // Generate job card number (format: JC-YYYYMMDD-XXXXXX)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the next sequence number for today
    const { data: todayCards } = await supabase
      .from('job_cards')
      .select('job_card_number')
      .like('job_card_number', `JC-${dateStr}-%`)
      .order('job_card_number', { ascending: false })
      .limit(1);

    let sequenceNum = 1;
    if (todayCards && todayCards.length > 0) {
      const lastNumber = todayCards[0].job_card_number;
      const lastSequence = parseInt(lastNumber.split('-')[2] || '0');
      sequenceNum = lastSequence + 1;
    }

    const jobCardNumber = `JC-${dateStr}-${String(sequenceNum).padStart(6, '0')}`;

    // Create job card
    const { data: jobCard, error: createError } = await supabase
      .from('job_cards')
      .insert({
        lead_id: leadId,
        job_card_number: jobCardNumber,
        labor_charges: labor_charges || 0,
        additional_work: additional_work || null,
        mechanic_notes: mechanic_notes || null,
        created_by: userProfile.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating job card:', createError);
      return NextResponse.json({ 
        error: 'Failed to create job card',
        details: createError.message 
      }, { status: 500 });
    }

    // Update lead with job_card_number
    await supabase
      .from('service_leads')
      .update({ job_card_number: jobCardNumber })
      .eq('id', leadId);

    // Log activity
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'JOB_CARD_CREATED',
      event_description: `Job card ${jobCardNumber} created`,
      created_by: userProfile.id
    });

    return NextResponse.json({
      success: true,
      message: 'Job card created successfully',
      data: jobCard
    });

  } catch (error: any) {
    console.error('Create job card API error:', error);
    return NextResponse.json(
      { error: 'Failed to create job card', details: error.message },
      { status: 500 }
    );
  }
}

