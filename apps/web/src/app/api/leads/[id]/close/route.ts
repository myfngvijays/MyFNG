import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/[id]/close
 * Close and archive lead after completion
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'CSE'];
    
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead } = await supabase
      .from('service_leads')
      .select('*, invoice:invoices(*), job_card:job_cards(*)')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Validation checks
    const errors = [];
    
    // 1. Check invoice status
    const invoice = lead.invoice as any;
    if (!invoice) {
      errors.push('Invoice not generated');
    } else if (invoice.payment_status !== 'PAID') {
      errors.push('Invoice not paid');
    }

    // 2. Check delivery status
    if (!['DELIVERED', 'CLOSED'].includes(lead.status)) {
      errors.push('Lead not delivered');
    }

    // 3. Check CSE follow-up (optional but recommended)
    if (!lead.cse_followup_completed && roleCode !== 'SUPER_ADMIN') {
      errors.push('CSE follow-up not completed (override with SUPER_ADMIN)');
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot close lead',
        validation_errors: errors
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Close and archive lead
    const { data: closedLead, error: closeError } = await supabase
      .from('service_leads')
      .update({
        status: 'CLOSED',
        closed_by: user.id,
        final_closure_at: now,
        read_only: true,
        archived_at: now,
        archived_by: user.id,
        // Generate checksum for tamper-proof archival
        archive_checksum: `CHK-${Date.now()}-${leadId.substr(0, 8)}`,
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (closeError) {
      console.error('Error closing lead:', closeError);
      return NextResponse.json({ 
        error: 'Failed to close lead',
        details: closeError.message
      }, { status: 500 });
    }

    // Lock invoice (make immutable)
    if (invoice) {
      await supabase
        .from('invoices')
        .update({
          read_only: true,
          archived_at: now,
          archived_by: user.id,
          archive_checksum: `CHK-${Date.now()}-${invoice.id.substr(0, 8)}`
        })
        .eq('id', invoice.id);
    }

    // Lock job card (make immutable)
    const jobCard = lead.job_card as any;
    if (jobCard) {
      await supabase
        .from('job_cards')
        .update({
          is_immutable: true,
          locked_at: now,
          locked_by: user.id,
          lock_reason: 'Lead closed and archived'
        })
        .eq('id', jobCard.id);
    }

    // Create lead event
    await supabase
      .from('lead_events')
      .insert({
        lead_id: leadId,
        event_type: 'lead_closed',
        event_description: `Lead ${lead.lead_number} closed and archived`,
        event_data: {
          closed_by: user.id,
          invoice_id: invoice?.id,
          final_amount: invoice?.total_amount,
          csat: lead.csat
        },
        actor_id: user.id,
        actor_role: roleCode
      });

    // Create finance event
    if (invoice) {
      await createFinanceEvent({
        eventType: 'lead_archived',
        entityType: 'invoice',
        entityId: invoice.id,
        actorId: user.id,
        actorRole: roleCode,
        eventData: {
          lead_id: leadId,
          lead_number: lead.lead_number,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          final_amount: invoice.total_amount,
          closed_at: now
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Lead closed and archived successfully',
      lead: closedLead,
      archived_entities: {
        lead: true,
        invoice: !!invoice,
        job_card: !!jobCard
      },
      checksums: {
        lead: closedLead.archive_checksum,
        invoice: invoice ? `CHK-${Date.now()}-${invoice.id.substr(0, 8)}` : null
      }
    });

  } catch (error: any) {
    console.error('Error closing lead:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

