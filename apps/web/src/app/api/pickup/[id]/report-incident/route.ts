import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { notifyWorkshopRoles } from '@/lib/notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/report-incident
 * Report an incident during pickup/drop
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
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

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { 
      incident_type, 
      description, 
      severity, 
      location_address,
      latitude,
      longitude,
      photo_urls 
    } = body;

    if (!incident_type || !description || !severity) {
      return NextResponse.json({ 
        error: 'Incident type, description, and severity are required' 
      }, { status: 400 });
    }

    // Get lead details for notifications
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*, workshop:workshops(*)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Get workshop admin and supervisor IDs for notifications
    const { data: notifyUsers, error: notifyError } = await supabase
      .from('users_login')
      .select('id, role:roles(*)')
      .eq('workshop_id', lead.workshop_id)
      .in('role.role_code', ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR']);

    const notifiedUserIds = notifyUsers?.map(u => u.id) || [];

    // Create incident report
    const { data: incident, error: incidentError } = await supabase
      .from('pickup_incidents')
      .insert({
        lead_id: leadId,
        reported_by: user.id,
        incident_type,
        description,
        severity,
        location_address,
        latitude,
        longitude,
        photo_urls: photo_urls || [],
        notified_users: notifiedUserIds,
        status: 'OPEN',
      })
      .select()
      .single();

    if (incidentError) {
      return NextResponse.json({ 
        error: 'Failed to create incident report', 
        details: incidentError.message 
      }, { status: 500 });
    }

    // Update pickup tracking status based on incident type
    if (['WRONG_CUSTOMER', 'VEHICLE_NOT_AVAILABLE', 'CUSTOMER_REFUSED'].includes(incident_type)) {
      await supabase
        .from('pickup_tracking')
        .update({
          pickup_status: 'FAILED_PICKUP',
          updated_at: new Date().toISOString(),
        })
        .eq('lead_id', leadId);
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'INCIDENT_REPORTED',
      description: `Incident reported: ${incident_type}`,
      metadata: { incident_id: incident.id, incident_type, severity },
    });

    // Notify workshop admin/supervisor (final)
    try {
      const sev = String(severity || '').toUpperCase();
      const priority = sev === 'CRITICAL' ? 'URGENT' : sev === 'HIGH' ? 'HIGH' : 'MEDIUM';
      const leadNumber = (lead as any)?.lead_number || leadId;
      const title = 'Pickup/Drop issue reported';
      const msg = `Lead ${leadNumber}: ${incident_type}. ${String(description || '').trim()}`;

      if (lead.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: lead.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title,
          message: msg,
          priority: priority as any,
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_supervisor/pickup-delivery`,
          metadata: {
            incident_id: incident.id,
            incident_type,
            severity,
          },
        });
      }
    } catch (e) {
      console.warn('Incident notification failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      data: incident,
      message: 'Incident reported successfully',
    });
  } catch (error: any) {
    console.error('Error reporting incident:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

