/**
 * Upload Audit Media API
 * POST /api/auditor/audits/[id]/upload-media
 * 
 * Upload photos/videos during audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auditId = params.id;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Auditor role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null;
    const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null;

    if (!file || !category) {
      return NextResponse.json({ error: 'File and category are required' }, { status: 400 });
    }

    // Verify audit exists and belongs to auditor
    const { data: audit } = await supabase
      .from('audits')
      .select('id, lead_id')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (!audit) {
      // Try workshop audit
      const { data: workshopAudit } = await supabase
        .from('workshop_audits')
        .select('id')
        .eq('id', auditId)
        .eq('auditor_id', user.id)
        .single();

      if (!workshopAudit) {
        return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `audit-${auditId}-${Date.now()}.${fileExt}`;
      const filePath = `audits/${auditId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audit-media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audit-media')
        .getPublicUrl(filePath);

      // Save to audit_media table
      const { data: mediaRecord, error: mediaError } = await supabase
        .from('audit_media')
        .insert({
          audit_id: auditId,
          media_type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
          media_url: publicUrl,
          category: category,
          title: title,
          description: description,
          latitude: latitude,
          longitude: longitude,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (mediaError) {
        throw mediaError;
      }

      return NextResponse.json({
        success: true,
        media: mediaRecord,
      });
    }

    // Upload for job card audit
    const fileExt = file.name.split('.').pop();
    const fileName = `audit-${auditId}-${Date.now()}.${fileExt}`;
    const filePath = `audits/${auditId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audit-media')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audit-media')
      .getPublicUrl(filePath);

    // Save to audit_media_files table
    const { data: mediaRecord, error: mediaError } = await supabase
      .from('audit_media_files')
      .insert({
        audit_id: auditId,
        media_type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
        media_url: publicUrl,
        category: category,
        title: title,
        description: description,
        latitude: latitude,
        longitude: longitude,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (mediaError) {
      throw mediaError;
    }

    return NextResponse.json({
      success: true,
      media: mediaRecord,
    });
  } catch (error: any) {
    console.error('Error in POST /api/auditor/audits/[id]/upload-media:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

