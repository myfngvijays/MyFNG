/**
 * Customer Complaints API
 * GET /api/complaints - Fetch all complaints with filters
 * POST /api/complaints - Create a new complaint
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateComplaintInput, ComplaintsResponse } from '@/shared/types/complaints-fraud';
import { createNotification, notifyWorkshopRoles } from '@/lib/notifications';

/**
 * GET /api/complaints
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const priority = searchParams.get('priority');
    const complaintType = searchParams.get('complaint_type');
    const workshopId = searchParams.get('workshop_id');
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('customer_complaints')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (priority) query = query.eq('priority', priority);
    if (complaintType) query = query.eq('complaint_type', complaintType);
    if (workshopId) query = query.eq('workshop_id', workshopId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching complaints:', error);
      return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });
    }

    const response: ComplaintsResponse = {
      complaints: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/complaints:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/complaints
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateComplaintInput = await request.json();

    // Validate required fields
    if (!body.complaint_type || !body.description) {
      return NextResponse.json(
        { error: 'Complaint type and description are required' },
        { status: 400 }
      );
    }

    // Generate complaint number
    const complaintNumber = `CMP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .insert({
        complaint_number: complaintNumber,
        lead_id: body.lead_id || null,
        customer_id: body.customer_id || user.id,
        workshop_id: body.workshop_id || null,
        mechanic_id: body.mechanic_id || null,
        pickup_boy_id: body.pickup_boy_id || null,
        complaint_type: body.complaint_type,
        complaint_category: body.complaint_category || null,
        severity: body.severity || 'MEDIUM',
        priority: body.priority || 'NORMAL',
        description: body.description,
        customer_expected_resolution: body.customer_expected_resolution || null,
        attachments: body.attachments || [],
        status: 'OPEN',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating complaint:', error);
      return NextResponse.json({ error: 'Failed to create complaint' }, { status: 500 });
    }

    // Notify Workshop Admin/Supervisor if complaint is tied to a workshop
    try {
      const workshopId = (complaint as any)?.workshop_id as string | null | undefined;
      if (workshopId) {
        const leadId = (complaint as any)?.lead_id as string | null | undefined;
        let leadNumber: string | undefined;
        if (leadId) {
          const { data: lead } = await supabase
            .from('service_leads')
            .select('lead_number')
            .eq('id', leadId)
            .maybeSingle();
          leadNumber = (lead as any)?.lead_number || leadId;
        }

        const complaintNumber = (complaint as any)?.complaint_number || 'Complaint';
        const complaintType = (complaint as any)?.complaint_type || 'Complaint';
        const severity = (complaint as any)?.severity || 'MEDIUM';

        await notifyWorkshopRoles({
          workshopId,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title: `Customer Complaint Raised (${severity})`,
          message: leadNumber
            ? `${complaintNumber}: ${complaintType} for lead ${leadNumber}. Please review and act.`
            : `${complaintNumber}: ${complaintType}. Please review and act.`,
          priority: severity === 'CRITICAL' || severity === 'HIGH' ? 'URGENT' : 'HIGH',
          leadId: leadId || undefined,
          leadNumber,
          actionUrl: leadId ? `/dashboard/workshop_admin/leads/${leadId}` : '/dashboard/workshop_admin',
          metadata: {
            kind: 'CUSTOMER_COMPLAINT',
            complaint_id: (complaint as any)?.id,
            complaint_number: complaintNumber,
            complaint_type: complaintType,
            severity,
            priority: (complaint as any)?.priority,
          },
        });
      }
    } catch (e) {
      console.warn('Workshop complaint notification failed (non-blocking):', e);
    }

    // Notify assigned mechanic (mechanic-focused)
    try {
      const complaintNumber = (complaint as any)?.complaint_number || 'Complaint';
      const complaintType = (complaint as any)?.complaint_type || 'Complaint';
      const severity = (complaint as any)?.severity || 'MEDIUM';

      const leadId = (complaint as any)?.lead_id as string | null | undefined;
      let leadNumber: string | undefined;
      let mechanicId = (complaint as any)?.mechanic_id as string | null | undefined;
      let pickupBoyId = (complaint as any)?.pickup_boy_id as string | null | undefined;

      if (leadId) {
        const { data: lead } = await supabase
          .from('service_leads')
          .select('lead_number, assigned_mechanic_id, assigned_pickup_boy_id')
          .eq('id', leadId)
          .maybeSingle();
        leadNumber = (lead as any)?.lead_number || leadId;
        mechanicId = mechanicId || (lead as any)?.assigned_mechanic_id || null;
        pickupBoyId = pickupBoyId || (lead as any)?.assigned_pickup_boy_id || null;
      }

      if (mechanicId) {
        await createNotification({
          userId: mechanicId,
          type: 'CUSTOMER_COMPLAINT',
          title: `Customer Complaint Logged (${severity})`,
          message: leadNumber
            ? `${complaintNumber}: ${complaintType} for lead ${leadNumber}. Await supervisor instructions.`
            : `${complaintNumber}: ${complaintType}. Await supervisor instructions.`,
          priority: severity === 'CRITICAL' || severity === 'HIGH' ? 'URGENT' : 'HIGH',
          leadId: leadId || undefined,
          leadNumber,
          actionUrl: leadId ? `/dashboard/workshop_mechanic/jobs/${leadId}/manage` : undefined,
          metadata: {
            kind: 'MECHANIC_COMPLAINT',
            complaint_id: (complaint as any)?.id,
            complaint_number: complaintNumber,
            complaint_type: complaintType,
            severity,
          },
        });
      }

      // Notify pickup boy if complaint is related to pickup/delivery
      if (pickupBoyId) {
        await createNotification({
          userId: pickupBoyId,
          type: 'CUSTOMER_COMPLAINT',
          title: `Customer Complaint Logged (${severity})`,
          message: leadNumber
            ? `${complaintNumber}: ${complaintType} for lead ${leadNumber}. Await supervisor instructions.`
            : `${complaintNumber}: ${complaintType}. Await supervisor instructions.`,
          priority: severity === 'CRITICAL' || severity === 'HIGH' ? 'URGENT' : 'HIGH',
          leadId: leadId || undefined,
          leadNumber,
          actionUrl: leadId ? `/dashboard/workshop_pickup_boy/tasks/${leadId}` : undefined,
          metadata: {
            kind: 'PICKUP_BOY_COMPLAINT',
            complaint_id: (complaint as any)?.id,
            complaint_number: complaintNumber,
            complaint_type: complaintType,
            severity,
          },
        });
      }
    } catch (e) {
      console.warn('Mechanic/Pickup Boy complaint notification failed (non-blocking):', e);
    }

    return NextResponse.json({ success: true, complaint }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/complaints:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

