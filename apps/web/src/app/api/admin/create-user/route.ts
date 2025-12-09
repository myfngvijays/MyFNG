import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify user is authenticated and is SUPER_ADMIN
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is SUPER_ADMIN
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('role:roles!role_id(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roleCode = (userProfile.role as any)?.role_code;
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { 
      full_name, 
      email, 
      phone, 
      password, 
      role_id, 
      workshop_id, 
      assigned_manager_id, 
      department 
    } = body;

    // Validation
    if (!full_name || !email || !password || !role_id) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, email, password, role_id' },
        { status: 400 }
      );
    }

    // Use Supabase Admin API to create user (bypasses email confirmation)
    const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not found' },
        { status: 500 }
      );
    }

    // Create user via Admin API (bypasses email confirmation)
    const adminResponse = await fetch(`${supabaseAdminUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: full_name,
          phone: phone || null
        }
      })
    });

    if (!adminResponse.ok) {
      const errorData = await adminResponse.json();
      console.error('Supabase Admin API error:', errorData);
      return NextResponse.json(
        { error: errorData.error_description || errorData.message || 'Failed to create user in auth system' },
        { status: adminResponse.status }
      );
    }

    const authUser = await adminResponse.json();

    // Insert into users_login table
    const { data: userData, error: insertError } = await supabase
      .from('users_login')
      .insert([{
        id: authUser.id,
        full_name: full_name,
        email: email,
        phone: phone || null,
        role_id: role_id,
        workshop_id: workshop_id || null,
        assigned_manager_id: assigned_manager_id || null,
        department: department || null,
        is_active: true
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting user into users_login:', insertError);
      
      // If user was created in auth but failed in DB, try to clean up
      // (Optional: delete auth user if DB insert fails)
      
      return NextResponse.json(
        { error: `Database error: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: userData
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
