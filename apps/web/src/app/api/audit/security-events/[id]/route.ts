/**
 * PATCH /api/audit/security-events/[id]
 * Update security event (e.g., mark as resolved)
 */

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles(role_code)')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Security event PATCH profile error:', profileError);
      return NextResponse.json(
        { error: 'Failed to verify access', details: profileError.message },
        { status: 500 }
      );
    }
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roleCode = (userProfile as { roles?: { role_code: string } })?.roles?.role_code ?? null;
    if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin or Sub Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resolved, resolved_by } = body;

    const updateData: { resolved: boolean; resolved_at: string | null; resolved_by: string | null } = {
      resolved: false,
      resolved_at: null,
      resolved_by: null,
    };
    if (resolved !== undefined) {
      updateData.resolved = Boolean(resolved);
      if (resolved) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = resolved_by || user.id;
      }
    }

    const { data: event, error } = await supabase
      .from('security_events')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating security event:', error);
      return NextResponse.json(
        { error: 'Failed to update security event', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, event },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/audit/security-events/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
