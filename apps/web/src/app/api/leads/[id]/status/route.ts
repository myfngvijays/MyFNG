/**
 * Update Lead Status API Endpoint
 * POST /api/leads/{id}/status
 * Task: WA-301
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transitionStatus, type LeadStatus, type UserRole } from '@/lib/services/leadStatusService';

interface UpdateStatusRequest {
  newStatus: LeadStatus;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: UpdateStatusRequest = await request.json();
    
    if (!body.newStatus) {
      return NextResponse.json(
        { success: false, error: 'newStatus is required' },
        { status: 400 }
      );
    }

    // 3. Get user profile and role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, full_name, role_id, workshop_id, roles!role_id(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roleCode = (userProfile.roles as any)?.role_code as UserRole;
    if (!roleCode) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 400 }
      );
    }

    // 4. Transition status using service
    const result = await transitionStatus(
      params.id,
      body.newStatus,
      user.id,
      roleCode,
      body.notes
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Status updated to ${body.newStatus}`,
      lead: result.lead,
    });

  } catch (error) {
    console.error('Error in update status API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

