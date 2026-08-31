import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeVehiclePhotoBuffer,
  type VehiclePhotoKind,
} from '@/lib/pickup/vehiclePhotoVision';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const params = await paramsPromise;
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as { role_code?: string } | null)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });
    }

    const leadId = params.id;
    const { data: lead } = await supabase
      .from('service_leads')
      .select('id, assigned_pickup_boy_id')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.assigned_pickup_boy_id && lead.assigned_pickup_boy_id !== user.id) {
      return NextResponse.json({ error: 'Not assigned to this lead' }, { status: 403 });
    }

    const formData = await request.formData();
    const kind = String(formData.get('kind') || '').trim().toLowerCase() as VehiclePhotoKind;
    const file = formData.get('file') as File | null;

    if (kind !== 'odometer' && kind !== 'fuel' && kind !== 'dashboard') {
      return NextResponse.json({ error: 'kind must be odometer, fuel, or dashboard' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Photo file is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Empty photo' }, { status: 400 });
    }

    const result = await analyzeVehiclePhotoBuffer(buffer, file.type || 'image/jpeg', kind);
    if (!result) {
      return NextResponse.json(
        {
          error: 'Could not read photo',
          hint: 'Enter km / fuel manually or retake a clearer photo',
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, kind, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
