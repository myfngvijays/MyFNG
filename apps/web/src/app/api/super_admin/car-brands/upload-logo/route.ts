import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/super_admin/car-brands/upload-logo
 * Upload brand logo to Supabase storage
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin (using roles table join)
    const { data: userData, error: roleError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (roleError || !userData) {
      console.error('Role check error:', roleError);
      return NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 });
    }

    const roleCode = (userData as any).roles?.role_code;
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const brandName = formData.get('brand_name') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only images (JPEG, PNG, WEBP, SVG) are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size must be less than 5MB' 
      }, { status: 400 });
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const sanitizedName = brandName 
      ? brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')
      : 'brand';
    const fileName = `${sanitizedName}-${Date.now()}.${fileExt}`;
    const filePath = `brands/${fileName}`;

    // Upload to Supabase Storage (car-brand bucket)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('car-brand')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload logo', 
        details: uploadError.message 
      }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('car-brand')
      .getPublicUrl(filePath);

    const logoUrl = publicUrlData.publicUrl;

    return NextResponse.json({
      success: true,
      logo_url: logoUrl,
      file_path: filePath,
      message: 'Logo uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

