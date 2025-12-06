import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Configure route for large file uploads (videos can be large)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large video uploads

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Maximum file size: 100MB (for videos)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

/**
 * POST /api/mechanic/jobs/[id]/upload-photos
 * Upload mechanic job photos with EXIF data extraction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const leadId = params.id;
    const formData = await request.formData();
    const photoType = formData.get('photoType') || formData.get('photo_type') as string;
    const photoCategory = formData.get('photoCategory') || formData.get('photo_category') as string;
    const file = formData.get('file') as File;
    const partId = formData.get('partId') as string | null;
    const latitude = formData.get('latitude') as string | null;
    const longitude = formData.get('longitude') as string | null;
    const odometerReading = formData.get('odometer_reading') as string | null;
    const annotations = formData.get('annotations') as string | null;
    const notes = formData.get('notes') as string | null;
    const exifData = formData.get('exif_data') as string | null;

    if (!photoType || !photoCategory || !file) {
      return NextResponse.json({ 
        error: 'Photo type, category, and file are required' 
      }, { status: 400 });
    }

    // Check file size (videos can be large)
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      return NextResponse.json({ 
        error: `File size too large: ${fileSizeMB}MB. Maximum allowed size is ${maxSizeMB}MB`,
        file_size: file.size,
        max_size: MAX_FILE_SIZE
      }, { status: 413 });
    }

    // Validate file type - support images and videos
    const fileLowerCaseName = file.name.toLowerCase();
    const fileExtension = fileLowerCaseName.split('.').pop();
    
    // Comprehensive list of image formats
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg', 'heic', 'heif', 'ico', 'jfif', 'pjpeg', 'pjp'];
    // Comprehensive list of video formats
    const videoExtensions = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'm4v', '3gp', 'mkv', 'flv', 'wmv', 'mpg', 'mpeg', 'm2v', 'ts', 'mts', 'f4v', 'asf', 'rm', 'rmvb', 'vob'];
    
    const isImage = file.type.startsWith('image/') || (fileExtension && imageExtensions.includes(fileExtension));
    const isVideo = file.type.startsWith('video/') || (fileExtension && videoExtensions.includes(fileExtension));

    if (!isImage && !isVideo) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload an image or video file.',
        file_type: file.type,
        file_name: file.name,
        file_extension: fileExtension
      }, { status: 400 });
    }

    // Validate photo type
    const validPhotoTypes = [
      'BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT',
      'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY', 'BEFORE_DAMAGE', 'BEFORE_TYRE',
      'DURING_OIL_DRAIN', 'DURING_OIL_POUR', 'DURING_FILTER_OLD', 'DURING_FILTER_NEW',
      'DURING_BRAKE_BEFORE', 'DURING_BRAKE_AFTER', 'DURING_AC_BEFORE', 'DURING_AC_AFTER',
      'DURING_PART_REMOVAL', 'DURING_PART_INSTALL',
      'AFTER_FRONT', 'AFTER_REAR', 'AFTER_LEFT', 'AFTER_RIGHT',
      'AFTER_ENGINE_BAY', 'AFTER_OLD_PARTS', 'AFTER_NEW_PARTS', 'AFTER_ODOMETER'
    ];

    if (!validPhotoTypes.includes(photoType as string)) {
      return NextResponse.json({ 
        error: 'Invalid photo type' 
      }, { status: 400 });
    }

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, roles!role_id(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Get lead first to check assignments
    const { data: leadData, error: leadError } = await supabase
      .from('service_leads')
      .select('assigned_supervisor_id, assigned_mechanic_id, workshop_id')
      .eq('id', leadId)
      .single();

    if (leadError || !leadData) {
      return NextResponse.json({ 
        error: 'Lead not found' 
      }, { status: 404 });
    }

    // Get job_id from lead_id
    // Use maybeSingle() to handle cases where job might not exist yet
    let { data: jobData, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('id, mechanic_id')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (jobError) {
      console.error('Error fetching mechanic_jobs:', jobError);
      return NextResponse.json({ 
        error: 'Failed to fetch job',
        details: jobError.message 
      }, { status: 500 });
    }

    // Auto-create mechanic_jobs record if it doesn't exist but mechanic is assigned
    if (!jobData && leadData.assigned_mechanic_id) {
      console.log('Auto-creating mechanic_jobs record for lead:', leadId);
      
      const { data: newJobData, error: createError } = await supabase
        .from('mechanic_jobs')
        .insert({
          lead_id: leadId,
          mechanic_id: leadData.assigned_mechanic_id,
          assigned_by: user.id, // Current user creating the record
          mechanic_status: 'ASSIGNED',
          job_priority: 'NORMAL',
        })
        .select('id, mechanic_id')
        .single();

      if (createError) {
        console.error('Error creating mechanic_jobs:', createError);
        return NextResponse.json({ 
          error: 'Failed to create job record',
          details: createError.message 
        }, { status: 500 });
      }

      jobData = newJobData;
    }

    if (!jobData) {
      return NextResponse.json({ 
        error: 'Job not found. Please ensure a mechanic is assigned to this lead.',
        details: 'No mechanic_jobs record found and no mechanic assigned to this lead'
      }, { status: 404 });
    }

    // Verify user is either:
    // 1. Assigned mechanic for this job, OR
    // 2. Assigned supervisor for this lead
    const isAssignedMechanic = jobData.mechanic_id === user.id;
    const isAssignedSupervisor = roleCode === 'WORKSHOP_SUPERVISOR' && leadData.assigned_supervisor_id === user.id;
    const isSuperAdmin = roleCode === 'SUPER_ADMIN';

    if (!isAssignedMechanic && !isAssignedSupervisor && !isSuperAdmin) {
      return NextResponse.json({ 
        error: 'You are not assigned to this job' 
      }, { status: 403 });
    }

    // Restrict mechanics to only upload "during" (work in progress) and parts-related photos
    // Supervisors and Super Admins can upload all types (before, during, after)
    if (isAssignedMechanic && !isSuperAdmin && roleCode !== 'WORKSHOP_SUPERVISOR') {
      // Mechanics can only upload:
      // 1. "during" category photos (work in progress)
      // 2. Photos with part_id (parts used) - any category allowed if partId is present
      
      const allowedCategoriesForMechanic = ['during'];
      const allowedPhotoTypesForMechanic = [
        'DURING_OIL_DRAIN', 'DURING_OIL_POUR', 'DURING_FILTER_OLD', 'DURING_FILTER_NEW',
        'DURING_BRAKE_BEFORE', 'DURING_BRAKE_AFTER', 'DURING_AC_BEFORE', 'DURING_AC_AFTER',
        'DURING_PART_REMOVAL', 'DURING_PART_INSTALL'
      ];

      // If partId is provided, allow any category (parts used photos)
      if (!partId) {
        // No partId - must be "during" category only
        if (!allowedCategoriesForMechanic.includes(photoCategory as string)) {
          return NextResponse.json({ 
            error: 'Mechanics can only upload work in progress photos. Please contact supervisor for before/after photos.',
            allowed_categories: allowedCategoriesForMechanic
          }, { status: 403 });
        }

        // Check if photo type is allowed (additional validation)
        if (!allowedPhotoTypesForMechanic.includes(photoType as string)) {
          return NextResponse.json({ 
            error: 'Invalid photo type for mechanic. Only work in progress photos are allowed.',
            allowed_types: allowedPhotoTypesForMechanic
          }, { status: 403 });
        }
      }
      // If partId is present, allow the upload (parts used photos can be any category)
    }

    // Upload file to Supabase Storage
    const fileExt = fileExtension || file.name.split('.').pop() || (isImage ? 'jpg' : 'mp4');
    const fileName = `${leadId}/${photoCategory}/${photoType}_${Date.now()}.${fileExt}`;
    const filePath = `mechanic-job-photos/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine correct content type - fix for PNG and video files
    // Some browsers/devices don't set correct MIME type, so infer from extension
    let contentType = file.type;
    const ext = (fileExtension || fileExt || '').toLowerCase();
    
    if (!contentType || contentType === 'application/octet-stream' || contentType === '') {
      // Infer content type from extension
      // Image formats
      if (ext === 'png') {
        contentType = 'image/png';
      } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'jfif' || ext === 'pjpeg' || ext === 'pjp') {
        contentType = 'image/jpeg';
      } else if (ext === 'gif') {
        contentType = 'image/gif';
      } else if (ext === 'webp') {
        contentType = 'image/webp';
      } else if (ext === 'bmp') {
        contentType = 'image/bmp';
      } else if (ext === 'tiff' || ext === 'tif') {
        contentType = 'image/tiff';
      } else if (ext === 'svg') {
        contentType = 'image/svg+xml';
      } else if (ext === 'heic') {
        contentType = 'image/heic';
      } else if (ext === 'heif') {
        contentType = 'image/heif';
      } else if (ext === 'ico') {
        contentType = 'image/x-icon';
      }
      // Video formats
      else if (ext === 'mp4' || ext === 'm4v') {
        contentType = 'video/mp4';
      } else if (ext === 'mov') {
        contentType = 'video/quicktime';
      } else if (ext === 'avi') {
        contentType = 'video/x-msvideo';
      } else if (ext === 'webm') {
        contentType = 'video/webm';
      } else if (ext === '3gp') {
        contentType = 'video/3gpp';
      } else if (ext === 'ogg' || ext === 'ogv') {
        contentType = 'video/ogg';
      } else if (ext === 'mkv') {
        contentType = 'video/x-matroska';
      } else if (ext === 'flv') {
        contentType = 'video/x-flv';
      } else if (ext === 'wmv') {
        contentType = 'video/x-ms-wmv';
      } else if (ext === 'mpg' || ext === 'mpeg' || ext === 'm2v') {
        contentType = 'video/mpeg';
      } else if (ext === 'ts' || ext === 'mts') {
        contentType = 'video/mp2t';
      } else if (ext === 'f4v') {
        contentType = 'video/x-f4v';
      } else if (ext === 'asf') {
        contentType = 'video/x-ms-asf';
      } else if (ext === 'rm' || ext === 'rmvb') {
        contentType = 'application/vnd.rn-realmedia';
      } else if (ext === 'vob') {
        contentType = 'video/dvd';
      } else {
        // Default fallback
        contentType = isImage ? 'image/jpeg' : 'video/mp4';
      }
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('service-media')
      .upload(filePath, buffer, {
        contentType: contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload photo', 
        details: uploadError.message 
      }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('service-media')
      .getPublicUrl(filePath);

    const photoUrl = publicUrlData.publicUrl;

    // Parse EXIF data if provided
    let exifDataParsed = null;
    if (exifData) {
      try {
        exifDataParsed = JSON.parse(exifData);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Parse annotations if provided
    let annotationsParsed = null;
    if (annotations) {
      try {
        annotationsParsed = JSON.parse(annotations);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Save photo record to database
    const photoRecordData: any = {
      job_id: jobData.id,
      lead_id: leadId,
      photo_type: photoType,
      photo_category: photoCategory,
      photo_url: photoUrl,
      uploaded_by: user.id,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      odometer_reading: odometerReading ? parseFloat(odometerReading) : null,
      exif_data: exifDataParsed,
      ...(partId && { part_id: partId }), // Add part_id if provided
      annotations: annotationsParsed,
      notes: notes || null,
    };

    const { data: photoRecord, error: photoError } = await supabase
      .from('mechanic_job_photos')
      .insert(photoRecordData)
      .select()
      .single();

    if (photoError) {
      console.error('Database insert error:', photoError);
      // Try to delete uploaded file if database insert fails
      try {
        await supabase.storage.from('service-media').remove([filePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
      return NextResponse.json({ 
        error: 'Failed to save photo record', 
        details: photoError.message 
      }, { status: 500 });
    }

    // Update odometer reading in mechanic_jobs if it's a dashboard photo
    if (photoCategory === 'before' && photoType === 'BEFORE_DASHBOARD' && odometerReading) {
      await supabase
        .from('mechanic_jobs')
        .update({ initial_odometer_reading: parseFloat(odometerReading) })
        .eq('id', jobData.id);
    }

    if (photoCategory === 'after' && photoType === 'AFTER_ODOMETER' && odometerReading) {
      await supabase
        .from('mechanic_jobs')
        .update({ final_odometer_reading: parseFloat(odometerReading) })
        .eq('id', jobData.id);
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'PHOTO_UPLOADED',
      description: `Mechanic photo uploaded: ${photoType} (${photoCategory})`,
      metadata: { 
        photo_type: photoType, 
        photo_category: photoCategory,
        photo_url: photoUrl 
      },
    });

    // Validate before inspection if it's a before photo
    if (photoCategory === 'before') {
      const { data: validationResult } = await supabase.rpc('validate_before_inspection', {
        job_id_param: jobData.id
      });

      return NextResponse.json({
        success: true,
        data: photoRecord,
        validation: validationResult,
        message: 'Photo uploaded successfully',
      });
    }

    return NextResponse.json({
      success: true,
      data: photoRecord,
      message: 'Photo uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mechanic/jobs/[id]/upload-photos
 * Get all photos for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;
    const category = request.nextUrl.searchParams.get('category'); // before, during, after

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, roles!role_id(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Get job_id from lead_id
    // Use maybeSingle() to handle cases where job might not exist yet
    const { data: jobData, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('id, mechanic_id')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (jobError) {
      console.error('Error fetching mechanic_jobs:', jobError);
      return NextResponse.json({ 
        error: 'Failed to fetch job',
        details: jobError.message 
      }, { status: 500 });
    }

    if (!jobData) {
      return NextResponse.json({ 
        error: 'Job not found. Please ensure a mechanic is assigned to this lead.',
        details: 'No mechanic_jobs record found for this lead_id'
      }, { status: 404 });
    }

    // Get lead to check supervisor assignment
    const { data: leadData, error: leadError } = await supabase
      .from('service_leads')
      .select('assigned_supervisor_id, assigned_mechanic_id')
      .eq('id', leadId)
      .single();

    if (leadError || !leadData) {
      return NextResponse.json({ 
        error: 'Lead not found' 
      }, { status: 404 });
    }

    // Verify user is either:
    // 1. Assigned mechanic for this job, OR
    // 2. Assigned supervisor for this lead, OR
    // 3. Super Admin
    const isAssignedMechanic = jobData.mechanic_id === user.id;
    const isAssignedSupervisor = roleCode === 'WORKSHOP_SUPERVISOR' && leadData.assigned_supervisor_id === user.id;
    const isSuperAdmin = roleCode === 'SUPER_ADMIN';

    if (!isAssignedMechanic && !isAssignedSupervisor && !isSuperAdmin) {
      return NextResponse.json({ 
        error: 'You are not authorized to view photos for this job' 
      }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('mechanic_job_photos')
      .select('*')
      .eq('job_id', jobData.id)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('photo_category', category);
    }

    const { data: photos, error: photosError } = await query;

    if (photosError) {
      return NextResponse.json({ 
        error: 'Failed to fetch photos', 
        details: photosError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: photos || [],
    });
  } catch (error: any) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mechanic/jobs/[id]/upload-photos
 * Delete a photo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;
    const photoId = request.nextUrl.searchParams.get('photo_id');

    if (!photoId) {
      return NextResponse.json({ 
        error: 'Photo ID is required' 
      }, { status: 400 });
    }

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, roles!role_id(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Get photo record
    const { data: photo, error: photoError } = await supabase
      .from('mechanic_job_photos')
      .select('*, mechanic_jobs!inner(id, mechanic_id, mechanic_status, lead_id)')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ 
        error: 'Photo not found' 
      }, { status: 404 });
    }

    // Get lead to check supervisor assignment
    const { data: leadData, error: leadError } = await supabase
      .from('service_leads')
      .select('assigned_supervisor_id')
      .eq('id', photo.mechanic_jobs.lead_id)
      .single();

    if (leadError || !leadData) {
      return NextResponse.json({ 
        error: 'Lead not found' 
      }, { status: 404 });
    }

    // Verify user is authorized:
    // 1. Assigned mechanic for this job, OR
    // 2. Assigned supervisor for this lead, OR
    // 3. Super Admin
    const isAssignedMechanic = photo.mechanic_jobs.mechanic_id === user.id;
    const isAssignedSupervisor = roleCode === 'WORKSHOP_SUPERVISOR' && leadData.assigned_supervisor_id === user.id;
    const isSuperAdmin = roleCode === 'SUPER_ADMIN';

    if (!isAssignedMechanic && !isAssignedSupervisor && !isSuperAdmin) {
      return NextResponse.json({ 
        error: 'You are not authorized to delete this photo' 
      }, { status: 403 });
    }

    if (photo.mechanic_jobs.mechanic_status === 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Cannot delete photos from completed jobs' 
      }, { status: 403 });
    }

    // Delete from storage
    const filePath = photo.photo_url.split('/').slice(-2).join('/');
    await supabase.storage
      .from('service-media')
      .remove([`mechanic-job-photos/${filePath}`]);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('mechanic_job_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      return NextResponse.json({ 
        error: 'Failed to delete photo', 
        details: deleteError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
