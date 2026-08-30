/**
 * User Profile API
 * GET /api/profile - Get current user profile
 * PUT /api/profile - Update current user profile
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('users_login')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Fetch role details separately
    if (profile.role_id) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('role_name, role_code')
        .eq('id', profile.role_id)
        .single();
      
      profile.role = roleData || { role_name: 'Unknown', role_code: 'UNKNOWN' };
    } else {
      profile.role = { role_name: 'Unknown', role_code: 'UNKNOWN' };
    }

    // Fetch workshop details separately if assigned
    if (profile.workshop_id) {
      const { data: workshopData } = await supabase
        .from('workshops')
        .select('name, address, city')
        .eq('id', profile.workshop_id)
        .single();
      
      profile.workshop = workshopData || null;
    } else {
      profile.workshop = null;
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error in GET /api/profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone, profile_image, department, first_name, last_name } = body;

    const first = String(first_name || '').trim();
    const last = String(last_name || '').trim();
    const joined =
      [first, last].filter(Boolean).join(' ') || String(full_name || '').trim();

    const basePatch: Record<string, unknown> = {
      full_name: joined || undefined,
      phone: phone || undefined,
      profile_image: profile_image || undefined,
      department: department || undefined,
      updated_at: new Date().toISOString(),
    };

    let updatedProfile: any = null;
    let error: any = null;

    const withNames = { ...basePatch };
    if (first) withNames.first_name = first;
    if (last || first) withNames.last_name = last;

    const firstTry = await supabase
      .from('users_login')
      .update(withNames)
      .eq('id', user.id)
      .select()
      .single();

    if (
      firstTry.error &&
      /column|first_name|last_name/i.test(firstTry.error.message || '')
    ) {
      const retry = await supabase
        .from('users_login')
        .update(basePatch)
        .eq('id', user.id)
        .select()
        .single();
      updatedProfile = retry.data;
      error = retry.error;
    } else {
      updatedProfile = firstTry.data;
      error = firstTry.error;
    }

    if (error || !updatedProfile) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Fetch role details
    if (updatedProfile.role_id) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('role_name, role_code')
        .eq('id', updatedProfile.role_id)
        .single();
      
      updatedProfile.role = roleData || { role_name: 'Unknown', role_code: 'UNKNOWN' };
    } else {
      updatedProfile.role = { role_name: 'Unknown', role_code: 'UNKNOWN' };
    }

    // Fetch workshop details if assigned
    if (updatedProfile.workshop_id) {
      const { data: workshopData } = await supabase
        .from('workshops')
        .select('name, address, city')
        .eq('id', updatedProfile.workshop_id)
        .single();
      
      updatedProfile.workshop = workshopData || null;
    } else {
      updatedProfile.workshop = null;
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error('Error in PUT /api/profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

