import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is pickup boy
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { photos, category, title, description } = body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'At least one photo is required' }, { status: 400 });
    }

    if (!category || !['BEFORE', 'AFTER', 'DAMAGE'].includes(category)) {
      return NextResponse.json({ 
        error: 'Invalid category',
        hint: 'Category must be BEFORE, AFTER, or DAMAGE'
      }, { status: 400 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Pickup task not found' }, { status: 404 });
    }

    // Verify task is assigned to this pickup boy
    if (lead.assigned_pickup_boy_id !== userProfile.id) {
      return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Insert photo records
    const photoRecords = photos.map((photo: any) => ({
      lead_id: leadId,
      media_type: 'IMAGE',
      file_url: photo.url,
      file_name: photo.file_name || 'pickup_photo',
      category: category,
      title: photo.title || title || `${category} Photo`,
      description: photo.description || description || '',
      uploaded_by: userProfile.id,
      created_at: now
    }));

    const { data: insertedPhotos, error: insertError } = await supabase
      .from('lead_media')
      .insert(photoRecords)
      .select();

    if (insertError) {
      console.error('Error uploading photos:', insertError);
      return NextResponse.json({ error: 'Failed to upload photos' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PHOTOS_UPLOADED',
        description: `Pickup boy uploaded ${photos.length} ${category.toLowerCase()} photo(s)`,
        metadata: {
          pickup_boy_id: userProfile.id,
          category: category,
          photo_count: photos.length,
          uploaded_at: now
        }
      });

    return NextResponse.json({
      success: true,
      message: `${photos.length} photo(s) uploaded successfully`,
      photos: insertedPhotos,
      total_count: photos.length
    }, { status: 201 });

  } catch (error) {
    console.error('Error in upload photos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

