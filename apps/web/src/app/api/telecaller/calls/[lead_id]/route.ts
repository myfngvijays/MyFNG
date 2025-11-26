/**
 * Get Call Logs for Lead API
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { lead_id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.lead_id;

    const { data: callLogs, error: logsError } = await supabase
      .from('telecaller_call_logs')
      .select(`
        *,
        telecaller:users_login!telecaller_id(id, full_name, role)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('Error fetching call logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      call_logs: callLogs || [],
      total: callLogs?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get call logs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

