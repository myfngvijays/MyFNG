/**
 * Workshop Audit Detail API
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
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

    const auditId = params.id;

    // Get audit with all related data
    const { data: audit, error: auditError } = await supabase
      .from('workshop_audits')
      .select(`
        *,
        workshop:workshops(*),
        auditor:users_login!auditor_id(*),
        approved_by_user:users_login!approved_by(*),
        checklist_items:audit_checklist_items(*),
        action_items:audit_action_items(*),
        media:audit_media(*)
      `)
      .eq('id', auditId)
      .single();

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      audit: audit,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get audit API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update Audit (Start, Complete, Approve)
 */
export async function PATCH(
  request: NextRequest,
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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const auditId = params.id;
    const body = await request.json();
    const { action, overall_score, strengths, weaknesses, recommendations, notes } = body;

    // Get audit
    const { data: audit, error: auditError } = await supabase
      .from('workshop_audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updateData: any = {
      updated_at: now,
    };

    if (action === 'START') {
      updateData.audit_status = 'IN_PROGRESS';
      updateData.actual_start_time = now;
    } else if (action === 'COMPLETE') {
      updateData.audit_status = 'COMPLETED';
      updateData.actual_end_time = now;
      if (audit.actual_start_time) {
        const start = new Date(audit.actual_start_time);
        const end = new Date(now);
        updateData.duration_minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
      }
      if (overall_score !== undefined) {
        updateData.overall_score = overall_score;
        updateData.score_percentage = (overall_score / (audit.max_score || 100)) * 100;
        // Calculate grade
        const percentage = updateData.score_percentage;
        if (percentage >= 90) updateData.audit_grade = 'A_PLUS';
        else if (percentage >= 80) updateData.audit_grade = 'A';
        else if (percentage >= 70) updateData.audit_grade = 'B';
        else if (percentage >= 60) updateData.audit_grade = 'C';
        else if (percentage >= 50) updateData.audit_grade = 'D';
        else updateData.audit_grade = 'F';
      }
      updateData.strengths = strengths;
      updateData.weaknesses = weaknesses;
      updateData.recommendations = recommendations;
      updateData.notes = notes;
    } else if (action === 'APPROVE') {
      updateData.audit_status = 'APPROVED';
      updateData.approved_by = userProfile.id;
      updateData.approved_at = now;
    }

    const { data: updatedAudit, error: updateError } = await supabase
      .from('workshop_audits')
      .update(updateData)
      .eq('id', auditId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating audit:', updateError);
      return NextResponse.json({ error: 'Failed to update audit' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Audit ${action.toLowerCase()} successfully`,
      audit: updatedAudit,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update audit API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

