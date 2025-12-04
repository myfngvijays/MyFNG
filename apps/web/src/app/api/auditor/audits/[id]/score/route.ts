/**
 * Score Audit API
 * POST /api/auditor/audits/[id]/score
 * 
 * Submit scores for audit checklist items
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

    const body = await request.json();
    const { checklist_items, image_compliance_score, overall_score } = body;

    // Verify audit exists
    const { data: jobCardAudit } = await supabase
      .from('audits')
      .select('id, lead_id')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (jobCardAudit) {
      // Update checklist items
      if (checklist_items && Array.isArray(checklist_items)) {
        for (const item of checklist_items) {
          const { error: updateError } = await supabase
            .from('audit_job_card_checklist')
            .upsert({
              id: item.id,
              audit_id: auditId,
              category: item.category,
              item_name: item.item_name,
              item_description: item.item_description,
              is_verified: item.is_verified,
              verification_status: item.verification_status,
              points_awarded: item.points_awarded || 0,
              max_points: item.max_points || 10,
              verification_notes: item.verification_notes,
              checked_at: item.is_verified ? new Date().toISOString() : null,
              verified_at: item.verification_status === 'VERIFIED' ? new Date().toISOString() : null,
            }, {
              onConflict: 'id',
            });

          if (updateError) {
            console.error('Error updating checklist item:', updateError);
          }
        }
      }

      // Update audit scores
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (image_compliance_score !== undefined) {
        updateData.images_compliance_score = image_compliance_score;
      }

      if (overall_score !== undefined) {
        updateData.score = overall_score;
      }

      const { error: updateError } = await supabase
        .from('audits')
        .update(updateData)
        .eq('id', auditId);

      if (updateError) {
        throw updateError;
      }

      // Trigger score calculation
      await supabase.rpc('calculate_job_card_audit_score', { p_audit_id: auditId });

      return NextResponse.json({
        success: true,
        message: 'Scores updated successfully',
      });
    }

    // Try workshop audit
    const { data: workshopAudit } = await supabase
      .from('workshop_audits')
      .select('id')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (workshopAudit) {
      // Update checklist items for workshop audit
      if (checklist_items && Array.isArray(checklist_items)) {
        for (const item of checklist_items) {
          const { error: updateError } = await supabase
            .from('audit_checklist_items')
            .upsert({
              id: item.id,
              audit_id: auditId,
              category: item.category,
              item_name: item.item_name,
              points_awarded: item.points_awarded || 0,
              max_points: item.max_points || 10,
              status: item.status || 'PENDING',
              auditor_notes: item.auditor_notes,
              checked_at: new Date().toISOString(),
            }, {
              onConflict: 'id',
            });

          if (updateError) {
            console.error('Error updating checklist item:', updateError);
          }
        }
      }

      // Trigger score calculation for workshop audit
      await supabase.rpc('calculate_audit_score', { p_audit_id: auditId });
      await supabase.rpc('calculate_category_scores', { p_audit_id: auditId });

      return NextResponse.json({
        success: true,
        message: 'Workshop audit scores updated successfully',
      });
    }

    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in POST /api/auditor/audits/[id]/score:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

