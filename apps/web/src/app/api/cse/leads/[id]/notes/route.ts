import { formatDateTime } from "@/lib/utils";
/**
 * CSE Add Internal Note API
 * POST /api/cse/leads/[id]/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const leadId = params.id;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify CSE role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE' && roleCode !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    const body = await request.json();
    const { note } = body;

    if (!note || note.trim().length === 0) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    // Get current lead to append note
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('internal_notes')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Append note to internal_notes
    const existingNotes = lead.internal_notes || '';
    const timestamp = formatDateTime(new Date());
    const newNote = `[${timestamp}] ${userProfile?.full_name || 'CSE'}: ${note}\n${existingNotes}`;

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        internal_notes: newNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error adding note:', updateError);
      return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'INTERNAL_NOTE_ADDED',
      description: 'Internal note added by CSE',
      metadata: { note },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Note added successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE add note API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

