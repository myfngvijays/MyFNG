/**
 * Workshop Compliance API
 * Purpose: Get compliance history and current status
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

    const workshopId = params.id;

    // Get compliance history
    const { data: history, error: historyError } = await supabase
      .from('workshop_compliance_history')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('snapshot_date', { ascending: false })
      .limit(12); // Last 12 months

    if (historyError) {
      console.error('Error fetching compliance history:', historyError);
      return NextResponse.json({ error: 'Failed to fetch compliance history' }, { status: 500 });
    }

    // Get current certifications
    const { data: certifications } = await supabase
      .from('workshop_certifications')
      .select('*')
      .eq('workshop_id', workshopId);

    // Get latest audit
    const { data: latestAudit } = await supabase
      .from('workshop_audits')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .single();

    // Get open action items
    const { data: openActions } = await supabase
      .from('audit_action_items')
      .select('*')
      .eq('workshop_id', workshopId)
      .eq('status', 'OPEN');

    // Calculate current compliance score
    const validCerts = certifications?.filter((c: any) => c.is_valid).length || 0;
    const expiredCerts = certifications?.filter((c: any) => !c.is_valid).length || 0;
    const overdueActions = openActions?.filter((a: any) => {
      if (!a.due_date) return false;
      return new Date(a.due_date) < new Date();
    }).length || 0;

    const currentCompliance = {
      overall_score: latestAudit?.overall_score || 0,
      audit_grade: latestAudit?.audit_grade || null,
      valid_certifications: validCerts,
      expired_certifications: expiredCerts,
      open_action_items: openActions?.length || 0,
      overdue_action_items: overdueActions,
      compliance_status: overdueActions > 0 || expiredCerts > 0 ? 'NON_COMPLIANT' : 'COMPLIANT',
    };

    return NextResponse.json({
      success: true,
      current_compliance: currentCompliance,
      compliance_history: history || [],
      latest_audit: latestAudit,
      certifications: certifications || [],
      open_action_items: openActions || [],
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get compliance API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

