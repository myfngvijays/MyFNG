import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chargebacks/[id]/respond
 * Submit evidence for chargeback case
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

    const chargebackId = params.id;
    const body = await request.json();
    
    const {
      our_response,
      defense_summary,
      evidence = [],
      defense_strength = 'MODERATE'
    } = body;

    // Get chargeback case
    const { data: chargebackCase } = await supabase
      .from('chargeback_cases')
      .select('*')
      .eq('id', chargebackId)
      .single();

    if (!chargebackCase) {
      return NextResponse.json({ error: 'Chargeback case not found' }, { status: 404 });
    }

    // Check if already responded
    if (chargebackCase.status === 'EVIDENCE_SUBMITTED') {
      return NextResponse.json({ 
        error: 'Evidence already submitted',
        status: chargebackCase.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update chargeback case
    const { data: updatedCase, error: updateError } = await supabase
      .from('chargeback_cases')
      .update({
        status: 'EVIDENCE_SUBMITTED',
        our_response,
        defense_summary,
        evidence: [...(chargebackCase.evidence || []), ...evidence],
        defense_strength,
        response_submitted_at: now,
        response_submitted_by: user.id
      })
      .eq('id', chargebackId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating chargeback:', updateError);
      return NextResponse.json({ 
        error: 'Failed to submit evidence',
        details: updateError.message
      }, { status: 500 });
    }

    // TODO: Actually submit to PG API

    return NextResponse.json({
      success: true,
      message: 'Evidence submitted successfully',
      case: updatedCase
    });

  } catch (error: any) {
    console.error('Error submitting chargeback evidence:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/chargebacks/[id]
 * Get chargeback case details
 */
export async function GET(
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

    const { data: chargebackCase } = await supabase
      .from('chargeback_cases')
      .select(`
        *,
        payment:payment_transactions(*),
        invoice:invoices(*),
        lead:service_leads(*)
      `)
      .eq('id', params.id)
      .single();

    if (!chargebackCase) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      case: chargebackCase
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

