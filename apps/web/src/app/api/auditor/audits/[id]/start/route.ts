/**
 * Start Audit API
 * POST /api/auditor/audits/[id]/start
 * 
 * Start an audit (mark as IN_PROGRESS)
 * For on-ground audits: record GPS location
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
    const auditId = params.id;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Auditor role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { audit_mode, latitude, longitude } = body;

    // Try job card audit first
    const { data: jobCardAudit } = await supabase
      .from('audits')
      .select('id, status, auditor_id')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (jobCardAudit) {
      // Update job card audit
      const updateData: any = {
        status: 'IN_PROGRESS',
        audit_date: new Date().toISOString(),
      };

      if (audit_mode === 'ON_GROUND') {
        updateData.audit_mode = 'ON_GROUND';
        if (latitude && longitude) {
          updateData.arrival_latitude = latitude;
          updateData.arrival_longitude = longitude;
          updateData.arrival_time = new Date().toISOString();
        }
      } else {
        updateData.audit_mode = 'DIGITAL';
      }

      const { error: updateError } = await supabase
        .from('audits')
        .update(updateData)
        .eq('id', auditId);

      if (updateError) {
        throw updateError;
      }

      // Log activity
      await supabase.from('lead_activities').insert({
        lead_id: jobCardAudit.id,
        user_id: user.id,
        activity_type: 'AUDIT_STARTED',
        description: `Audit started by auditor (${audit_mode || 'DIGITAL'})`,
      });

      return NextResponse.json({
        success: true,
        message: 'Audit started successfully',
        audit: {
          id: auditId,
          status: 'IN_PROGRESS',
          audit_mode: audit_mode || 'DIGITAL',
        },
      });
    }

    // Try workshop audit
    const { data: workshopAudit } = await supabase
      .from('workshop_audits')
      .select('id, audit_status, auditor_id')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (workshopAudit) {
      const updateData: any = {
        audit_status: 'IN_PROGRESS',
        actual_start_time: new Date().toISOString(),
      };

      if (audit_mode === 'ON_GROUND' && latitude && longitude) {
        updateData.arrival_latitude = latitude;
        updateData.arrival_longitude = longitude;
        updateData.arrival_time = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('workshop_audits')
        .update(updateData)
        .eq('id', auditId);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: 'Workshop audit started successfully',
        audit: {
          id: auditId,
          status: 'IN_PROGRESS',
        },
      });
    }

    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in POST /api/auditor/audits/[id]/start:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

