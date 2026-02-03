/**
 * Auditor Audit Detail API
 * GET /api/auditor/audits/[id]
 * 
 * Get detailed information about a specific audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    // Try to fetch as job card audit first
    const { data: jobCardAudit, error: jobCardError } = await supabase
      .from('audits')
      .select(`
        *,
        lead:service_leads!lead_id(
          *,
          workshop:workshops!workshop_id(id, name, city, address, phone, latitude, longitude),
          customer:customers(id, full_name, phone, email),
          mechanic_jobs(
            id,
            mechanic:users_login!mechanic_id(full_name),
            mechanic_status,
            before_photos,
            during_photos,
            after_photos,
            parts_photos
          ),
          lead_extra_charges(
            id,
            charge_type,
            amount,
            description,
            approved_by,
            status
          )
        ),
        auditor:users_login!auditor_id(full_name, phone)
      `)
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (jobCardAudit && !jobCardError) {
      // Get checklist items
      const { data: checklistItems } = await supabase
        .from('audit_job_card_checklist')
        .select('*')
        .eq('audit_id', auditId)
        .order('category', { ascending: true });

      // Get image verification
      const { data: imageVerification } = await supabase
        .from('audit_image_verification')
        .select('*')
        .eq('audit_id', auditId)
        .order('image_category', { ascending: true });

      // Get findings
      const { data: findings } = await supabase
        .from('audit_findings')
        .select('*')
        .eq('audit_id', auditId)
        .order('severity', { ascending: false });

      // Get media files
      const { data: mediaFiles } = await supabase
        .from('audit_media_files')
        .select('*')
        .eq('audit_id', auditId)
        .order('uploaded_at', { ascending: false });

      return NextResponse.json({
        audit: {
          ...jobCardAudit,
          type: 'JOB_CARD',
          lead_id: jobCardAudit.lead_id,
          workshop_id: (jobCardAudit.lead as any)?.workshop?.id || null,
        },
        checklist: checklistItems || [],
        image_verification: imageVerification || [],
        findings: findings || [],
        media: mediaFiles || [],
      });
    }

    // Try workshop audit
    const { data: workshopAudit, error: workshopError } = await supabase
      .from('workshop_audits')
      .select(`
        *,
        workshop:workshops!workshop_id(
          *,
          certifications:workshop_certifications(*)
        ),
        auditor:users_login!auditor_id(full_name, phone)
      `)
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (workshopAudit && !workshopError) {
      // Get checklist items
      const { data: checklistItems } = await supabase
        .from('audit_checklist_items')
        .select('*')
        .eq('audit_id', auditId)
        .order('category', { ascending: true });

      // Get media files
      const { data: mediaFiles } = await supabase
        .from('audit_media')
        .select('*')
        .eq('audit_id', auditId)
        .order('uploaded_at', { ascending: false });

      // Get action items
      const { data: actionItems } = await supabase
        .from('audit_action_items')
        .select('*')
        .eq('audit_id', auditId)
        .order('priority', { ascending: false });

      return NextResponse.json({
        audit: {
          ...workshopAudit,
          type: 'WORKSHOP_FACILITY',
          workshop_id: workshopAudit.workshop_id,
        },
        checklist: checklistItems || [],
        media: mediaFiles || [],
        action_items: actionItems || [],
      });
    }

    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in GET /api/auditor/audits/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

