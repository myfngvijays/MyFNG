import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/upload-photos
 * Upload vehicle condition photos
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
    const photoType = formData.get('photo_type') as string;
    const file = formData.get('file') as File;
    const odometerReading = formData.get('odometer_reading') as string | null;
    const fuelLevel = formData.get('fuel_level') as string | null;
    const damageDescription = formData.get('damage_description') as string | null;
    const latitude = formData.get('latitude') as string | null;
    const longitude = formData.get('longitude') as string | null;

    if (!photoType || !file) {
      return NextResponse.json({ error: 'Photo type and file are required' }, { status: 400 });
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${leadId}/${photoType}_${Date.now()}.${fileExt}`;
    const filePath = `vehicle-photos/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload photo', details: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    const photoUrl = publicUrlData.publicUrl;

    // Save photo record to database
    const { data: photoRecord, error: photoError } = await supabase
      .from('vehicle_condition_photos')
      .insert({
        lead_id: leadId,
        photo_type: photoType,
        photo_url: photoUrl,
        uploaded_by: user.id,
        odometer_reading: odometerReading ? parseInt(odometerReading) : null,
        fuel_level: fuelLevel,
        damage_description: damageDescription,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      })
      .select()
      .single();

    if (photoError) {
      return NextResponse.json({ error: 'Failed to save photo record', details: photoError.message }, { status: 500 });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'PHOTO_UPLOADED',
      description: `Vehicle photo uploaded: ${photoType}`,
      metadata: { photo_type: photoType, photo_url: photoUrl },
    });

    return NextResponse.json({
      success: true,
      data: photoRecord,
      message: 'Photo uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

