import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST - Upload media for a job
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get request body
    const body = await request.json();
    const { media_url, media_category, media_type, description, file_size_kb, thumbnail_url } = body;

    // Validate required fields
    if (!media_url || !media_category || !media_type) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['media_url', 'media_category', 'media_type']
      }, { status: 400 });
    }

    console.log('Media upload request:', { leadId, media_category, media_type, file_size_kb });

    // Validate media category
    const validCategories = ['BEFORE', 'PROGRESS', 'AFTER', 'EXTRA_WORK_PROOF', 'DAMAGE_FOUND', 'PARTS_USED'];
    if (!validCategories.includes(media_category)) {
      return NextResponse.json({ 
        error: 'Invalid media category',
        valid_categories: validCategories
      }, { status: 400 });
    }

    // Verify lead exists and is assigned to this mechanic
    const { data: mechanicJob, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('id, mechanic_id')
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .single();

    if (jobError || !mechanicJob) {
      return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Insert media record (using actual table column names)
    const { data: mediaRecord, error: insertError } = await supabase
      .from('mechanic_media')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        file_url: media_url,
        file_name: media_url.split('/').pop() || 'unknown',
        media_category,
        media_type,
        file_size_kb,
        caption: description || null,
        uploaded_at: now,
        created_at: now
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting media:', insertError);
      return NextResponse.json({ error: 'Failed to save media record' }, { status: 500 });
    }

    // Update image counts in mechanic_jobs
    const categoryCountMap: { [key: string]: string } = {
      'BEFORE': 'before_images_count',
      'PROGRESS': 'progress_images_count',
      'AFTER': 'after_images_count'
    };

    const countField = categoryCountMap[media_category];
    if (countField) {
      // Get current count
      const { data: currentJob } = await supabase
        .from('mechanic_jobs')
        .select(countField)
        .eq('lead_id', leadId)
        .single();

      if (currentJob) {
        const newCount = ((currentJob as any)[countField] || 0) + 1;
        await supabase
          .from('mechanic_jobs')
          .update({
            [countField]: newCount,
            updated_at: now
          })
          .eq('lead_id', leadId);
      }
    }

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'MEDIA_UPLOADED',
        action_description: `Uploaded ${media_category} ${media_type.toLowerCase()}`,
        metadata: {
          media_id: mediaRecord.id,
          media_category,
          media_type,
          file_size_kb
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Media uploaded successfully',
      media: mediaRecord
    }, { status: 201 });

  } catch (error) {
    console.error('Error in media upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Fetch all media for a job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Build query
    let query = supabase
      .from('mechanic_media')
      .select('*')
      .eq('lead_id', leadId)
      .order('uploaded_at', { ascending: false });

    // Filter by category if provided
    if (category) {
      query = query.eq('media_category', category);
    }

    const { data: mediaFiles, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching media:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }

    // Get image counts by category
    const counts = {
      BEFORE: mediaFiles?.filter(m => m.media_category === 'BEFORE').length || 0,
      PROGRESS: mediaFiles?.filter(m => m.media_category === 'PROGRESS').length || 0,
      AFTER: mediaFiles?.filter(m => m.media_category === 'AFTER').length || 0,
      EXTRA_WORK_PROOF: mediaFiles?.filter(m => m.media_category === 'EXTRA_WORK_PROOF').length || 0,
      DAMAGE_FOUND: mediaFiles?.filter(m => m.media_category === 'DAMAGE_FOUND').length || 0,
      PARTS_USED: mediaFiles?.filter(m => m.media_category === 'PARTS_USED').length || 0
    };

    return NextResponse.json({
      success: true,
      media: mediaFiles || [],
      counts,
      total: mediaFiles?.length || 0
    }, { status: 200 });

  } catch (error) {
    console.error('Error in fetch media API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific media file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');

    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
    }

    // Get media details
    const { data: media, error: mediaError } = await supabase
      .from('mechanic_media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Verify permission (mechanic can delete own uploads, admin/supervisor can delete any)
    const roleCode = (userProfile.roles as any)?.role_code;
    const canDelete =
      media.mechanic_id === userProfile.id ||
      ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode);

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete this media' }, { status: 403 });
    }

    // Delete media record
    const { error: deleteError } = await supabase
      .from('mechanic_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      console.error('Error deleting media:', deleteError);
      return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
    }

    // Update image counts
    const categoryCountMap: { [key: string]: string } = {
      'BEFORE': 'before_images_count',
      'PROGRESS': 'progress_images_count',
      'AFTER': 'after_images_count'
    };

    const countField = categoryCountMap[media.media_category];
    if (countField) {
      const { data: currentJob } = await supabase
        .from('mechanic_jobs')
        .select(countField)
        .eq('lead_id', media.lead_id)
        .single();

      if (currentJob && (currentJob as any)[countField] > 0) {
        const newCount = (currentJob as any)[countField] - 1;
        await supabase
          .from('mechanic_jobs')
          .update({
            [countField]: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('lead_id', media.lead_id);
      }
    }

    // TODO: Delete from storage bucket
    // Extract storage path from media_url and delete from Supabase Storage

    return NextResponse.json({
      success: true,
      message: 'Media deleted successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in delete media API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

