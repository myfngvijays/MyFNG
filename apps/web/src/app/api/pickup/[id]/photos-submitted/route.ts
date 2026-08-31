import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { notifyPickupBoy, notifyWorkshopRoles } from '@/lib/notifications';
import { checkMandatoryPickupPhotos, isDummyPickupLead } from '@/lib/workshop/pickupPhotos';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/photos-submitted
 * Pickup boy confirms all vehicle photos uploaded — sends in-app + push notification.
 */
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

    const leadId = params.id;
    const body = await request.json().catch(() => ({}));
    const category = String(body?.category || 'PICKUP').toUpperCase();

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, lead_number, workshop_id, assigned_pickup_boy_id, created_from')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.assigned_pickup_boy_id !== user.id) {
      return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
    }

    const isDummy = isDummyPickupLead(lead);

    if (category === 'PICKUP' && !isDummy) {
      const photoCheck = await checkMandatoryPickupPhotos(supabase, leadId);
      if (!photoCheck.ok) {
        return NextResponse.json(
          {
            error: 'Mandatory pickup photos pending',
            missing_photos: photoCheck.missing,
          },
          { status: 400 },
        );
      }
    }

    const leadNumber = lead.lead_number || leadId;
    const isDrop = category === 'DROP';

    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: isDrop ? 'DROP_PHOTOS_SUBMITTED' : 'PICKUP_PHOTOS_SUBMITTED',
      description: isDrop
        ? 'Pickup boy submitted all delivery photos'
        : 'Pickup boy submitted all pickup photos',
      metadata: { category, dummy: isDummy },
    });

    try {
      const pickupTitle = isDrop ? 'Delivery photos uploaded' : 'Pickup photos uploaded';
      const pickupMsg = isDrop
        ? `Lead ${leadNumber}: Delivery photos submitted. Complete delivery when ready.`
        : `Lead ${leadNumber}: Pickup photos submitted. Mark vehicle picked when ready to leave.`;

      await notifyPickupBoy({
        pickupBoyId: user.id,
        type: 'SYSTEM_ALERT',
        title: pickupTitle,
        message: pickupMsg,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { kind: isDrop ? 'DROP_PHOTOS_SUBMITTED' : 'PICKUP_PHOTOS_SUBMITTED', category },
      });

      if (lead.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: lead.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title: isDrop ? 'Delivery photos uploaded' : 'Pickup photos uploaded',
          message: isDrop
            ? `Lead ${leadNumber}: Delivery photos uploaded by pickup boy.`
            : `Lead ${leadNumber}: Pickup photos uploaded by pickup boy.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop-advisor/pickup-delivery`,
          metadata: { kind: isDrop ? 'DROP_PHOTOS_SUBMITTED' : 'PICKUP_PHOTOS_SUBMITTED', category },
        });
      }
    } catch (e) {
      console.warn('Photos submitted notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: isDrop ? 'Delivery photos submitted' : 'Pickup photos submitted',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in photos-submitted API:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
