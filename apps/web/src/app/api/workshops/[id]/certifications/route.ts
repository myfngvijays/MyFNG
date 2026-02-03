/**
 * Workshop Certifications API
 * Purpose: Manage workshop certifications
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
    const { searchParams } = new URL(request.url);
    const is_valid = searchParams.get('is_valid');

    let query = supabase
      .from('workshop_certifications')
      .select(`
        *,
        verified_by_user:users_login!verified_by(id, full_name)
      `)
      .eq('workshop_id', workshopId)
      .order('expiry_date', { ascending: true });

    if (is_valid !== null) {
      query = query.eq('is_valid', is_valid === 'true');
    }

    const { data: certifications, error: certError } = await query;

    if (certError) {
      console.error('Error fetching certifications:', certError);
      return NextResponse.json({ error: 'Failed to fetch certifications' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      certifications: certifications || [],
      total: certifications?.length || 0,
      valid: certifications?.filter((c: any) => c.is_valid).length || 0,
      expired: certifications?.filter((c: any) => !c.is_valid).length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get certifications API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Add Certification
 */
export async function POST(
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
    const body = await request.json();
    const {
      certification_type,
      certification_name,
      issuing_authority,
      issue_date,
      expiry_date,
      document_url,
      document_number,
    } = body;

    if (!certification_type || !certification_name) {
      return NextResponse.json({
        error: 'Missing required fields: certification_type, certification_name',
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const expiry = expiry_date ? new Date(expiry_date) : null;
    const isExpired = expiry ? expiry < new Date() : false;

    const { data: certification, error: certError } = await supabase
      .from('workshop_certifications')
      .insert({
        workshop_id: workshopId,
        certification_type: certification_type,
        certification_name: certification_name,
        issuing_authority: issuing_authority,
        issue_date: issue_date,
        expiry_date: expiry_date,
        is_valid: !isExpired,
        verification_status: 'PENDING',
        document_url: document_url,
        document_number: document_number,
        created_at: now,
      })
      .select()
      .single();

    if (certError) {
      console.error('Error creating certification:', certError);
      return NextResponse.json({ error: 'Failed to add certification' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Certification added successfully',
      certification: certification,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in add certification API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

