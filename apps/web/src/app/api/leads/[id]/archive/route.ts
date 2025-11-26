/**
 * Archive Lead API
 * Phase 4 - Step 11: Archive Job & Lock Records
 * Purpose: Archive completed leads and make them read-only
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import crypto from 'crypto';

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has archival permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'system'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead with all related data
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          payment_status,
          archived_at
        )
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead can be archived
    if (lead.status !== 'COMPLETED' && lead.status !== 'CLOSED') {
      return NextResponse.json({
        error: 'Lead cannot be archived',
        current_status: lead.status,
        hint: 'Lead must be COMPLETED or CLOSED before archival',
      }, { status: 400 });
    }

    // Check if invoice is paid
    if (lead.invoice && lead.invoice.payment_status !== 'PAID') {
      return NextResponse.json({
        error: 'Invoice must be paid before archival',
        payment_status: lead.invoice.payment_status,
      }, { status: 400 });
    }

    // Check if CSE follow-up is completed (optional check)
    // Can be skipped if not required

    const now = new Date().toISOString();

    // Generate checksum for data integrity
    const dataToHash = JSON.stringify({
      lead_id: leadId,
      invoice_id: lead.invoice_id,
      final_amount: lead.final_amount,
      status: lead.status,
      archived_at: now,
    });
    const checksum = crypto.createHash('sha256').update(dataToHash).digest('hex');

    // Archive lead
    await supabase
      .from('service_leads')
      .update({
        read_only: true,
        archived_at: now,
        archived_by: userProfile.id,
        archive_checksum: checksum,
        status: 'CLOSED', // Final status
        updated_at: now,
      })
      .eq('id', leadId);

    // Archive invoice
    if (lead.invoice_id) {
      const invoiceChecksum = crypto.createHash('sha256').update(JSON.stringify({
        invoice_id: lead.invoice_id,
        invoice_number: lead.invoice?.invoice_number,
        final_amount: lead.invoice?.final_amount,
        archived_at: now,
      })).digest('hex');

      await supabase
        .from('invoices')
        .update({
          read_only: true,
          archived_at: now,
          archived_by: userProfile.id,
          archive_checksum: invoiceChecksum,
          updated_at: now,
        })
        .eq('id', lead.invoice_id);
    }

    // Create archival event
    await supabase
      .from('lead_events')
      .insert({
        lead_id: leadId,
        event_type: 'LEAD_ARCHIVED',
        event_data: {
          archived_at: now,
          archived_by: userProfile.id,
          archive_checksum: checksum,
        },
        actor_id: userProfile.id,
        actor_role: userProfile.role,
        actor_name: userProfile.name,
        created_at: now,
      });

    // Create finance event
    await createFinanceEvent({
      eventType: 'lead_archived',
      entityType: 'invoice',
      entityId: lead.invoice_id || leadId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        lead_id: leadId,
        invoice_id: lead.invoice_id,
        archive_checksum: checksum,
        archived_at: now,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Lead archived successfully',
      lead_id: leadId,
      archived_at: now,
      archive_checksum: checksum,
      read_only: true,
      next_step: 'Lead is now read-only and archived',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in archive lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET Archived Lead (Read-only view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    const leadId = params.id;

    // Get lead (read-only view)
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        invoice:invoices!invoice_id(*),
        workshop:workshops!workshop_id(*),
        customer:users_login!customer_id(*)
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: lead,
      is_archived: lead.read_only || false,
      archived_at: lead.archived_at,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get archived lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

