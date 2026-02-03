/**
 * Get Billing Actions for Lead API
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ lead_id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.lead_id;

    const { data: actions, error: actionsError } = await supabase
      .from('billing_team_actions')
      .select(`
        *,
        billing_member:users_login!billing_member_id(id, full_name, role)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (actionsError) {
      console.error('Error fetching billing actions:', actionsError);
      return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      actions: actions || [],
      total: actions?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get billing actions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

