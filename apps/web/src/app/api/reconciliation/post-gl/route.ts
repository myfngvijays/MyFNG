/**
 * Post GL Entries API
 * Phase 3 - Step 8: Accounts Reconciliation
 * Purpose: Post double-entry bookkeeping entries to General Ledger
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export async function POST(request: NextRequest) {
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

    // Verify user has accounts permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'accounts', 'finance_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      reference_type, // invoice, payment, payout, refund
      reference_id,
      reference_number,
      description,
      posting_period,
    } = body;

    if (!reference_type || !reference_id) {
      return NextResponse.json({
        error: 'Missing required fields: reference_type, reference_id',
      }, { status: 400 });
    }

    // Get reference entity details
    let entityData: any = null;
    let entries: any[] = [];

    if (reference_type === 'payment') {
      const { data: payment } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          invoice:invoices!invoice_id(
            id,
            invoice_number,
            final_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_tax,
            base_amount,
            extra_charges,
            parts_cost
          )
        `)
        .eq('id', reference_id)
        .single();

      if (payment && payment.invoice) {
        entityData = payment;
        const invoice = payment.invoice;
        const amount = parseFloat(payment.amount || '0');

        // Debit: Bank/Cash (depending on payment method)
        const debitAccount = payment.payment_method === 'CASH' ? 'CASH' : 'BANK';
        entries.push({
          entry_type: 'DEBIT',
          account_type: debitAccount,
          account_name: `${debitAccount}_ACCOUNT`,
          amount: amount,
          reference_type: 'payment',
          reference_id: payment.id,
          reference_number: payment.transaction_id,
          description: `Payment received for invoice ${invoice.invoice_number}`,
        });

        // Credit: Accounts Receivable
        entries.push({
          entry_type: 'CREDIT',
          account_type: 'ACCOUNTS_RECEIVABLE',
          account_name: 'ACCOUNTS_RECEIVABLE',
          amount: amount,
          reference_type: 'payment',
          reference_id: payment.id,
          reference_number: payment.transaction_id,
          description: `Payment received for invoice ${invoice.invoice_number}`,
        });
      }
    } else if (reference_type === 'invoice') {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', reference_id)
        .single();

      if (invoice) {
        entityData = invoice;
        const revenueAmount = parseFloat(invoice.base_amount || '0') + 
                            parseFloat(invoice.extra_charges || '0') + 
                            parseFloat(invoice.parts_cost || '0');
        const taxAmount = parseFloat(invoice.total_tax || '0');

        // Debit: Accounts Receivable
        entries.push({
          entry_type: 'DEBIT',
          account_type: 'ACCOUNTS_RECEIVABLE',
          account_name: 'ACCOUNTS_RECEIVABLE',
          amount: parseFloat(invoice.final_amount || '0'),
          reference_type: 'invoice',
          reference_id: invoice.id,
          reference_number: invoice.invoice_number,
          description: `Invoice ${invoice.invoice_number} generated`,
        });

        // Credit: Revenue
        entries.push({
          entry_type: 'CREDIT',
          account_type: 'REVENUE',
          account_name: 'SERVICE_REVENUE',
          amount: revenueAmount,
          reference_type: 'invoice',
          reference_id: invoice.id,
          reference_number: invoice.invoice_number,
          description: `Service revenue for invoice ${invoice.invoice_number}`,
        });

        // Credit: Tax Payable (CGST)
        if (parseFloat(invoice.cgst_amount || '0') > 0) {
          entries.push({
            entry_type: 'CREDIT',
            account_type: 'TAX_CGST',
            account_name: 'CGST_PAYABLE',
            amount: parseFloat(invoice.cgst_amount || '0'),
            reference_type: 'invoice',
            reference_id: invoice.id,
            reference_number: invoice.invoice_number,
            description: `CGST for invoice ${invoice.invoice_number}`,
          });
        }

        // Credit: Tax Payable (SGST)
        if (parseFloat(invoice.sgst_amount || '0') > 0) {
          entries.push({
            entry_type: 'CREDIT',
            account_type: 'TAX_SGST',
            account_name: 'SGST_PAYABLE',
            amount: parseFloat(invoice.sgst_amount || '0'),
            reference_type: 'invoice',
            reference_id: invoice.id,
            reference_number: invoice.invoice_number,
            description: `SGST for invoice ${invoice.invoice_number}`,
          });
        }

        // Credit: Tax Payable (IGST)
        if (parseFloat(invoice.igst_amount || '0') > 0) {
          entries.push({
            entry_type: 'CREDIT',
            account_type: 'TAX_IGST',
            account_name: 'IGST_PAYABLE',
            amount: parseFloat(invoice.igst_amount || '0'),
            reference_type: 'invoice',
            reference_id: invoice.id,
            reference_number: invoice.invoice_number,
            description: `IGST for invoice ${invoice.invoice_number}`,
          });
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({
        error: 'No GL entries to post',
        hint: 'Reference entity not found or invalid',
      }, { status: 400 });
    }

    // Verify double-entry balance
    const totalDebits = entries
      .filter((e) => e.entry_type === 'DEBIT')
      .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
    const totalCredits = entries
      .filter((e) => e.entry_type === 'CREDIT')
      .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json({
        error: 'Double-entry balance mismatch',
        total_debits: totalDebits,
        total_credits: totalCredits,
        difference: totalDebits - totalCredits,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const period = posting_period || new Date().toISOString().split('T')[0];

    // Post all entries
    const glEntries = entries.map((entry) => ({
      ...entry,
      posting_period: period,
      posted_at: now,
      posted_by: userProfile.id,
      notes: description || entry.description,
    }));

    const { data: postedEntries, error: postError } = await supabase
      .from('gl_entries')
      .insert(glEntries)
      .select();

    if (postError) {
      console.error('Error posting GL entries:', postError);
      return NextResponse.json({ error: 'Failed to post GL entries' }, { status: 500 });
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'gl_entries_posted',
      entityType: reference_type as any,
      entityId: reference_id,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        reference_type,
        reference_id,
        reference_number,
        entries_count: entries.length,
        total_debits: totalDebits,
        total_credits: totalCredits,
        posting_period: period,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'GL entries posted successfully',
      entries: postedEntries,
      summary: {
        total_entries: entries.length,
        total_debits: totalDebits,
        total_credits: totalCredits,
        posting_period: period,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in post GL entries API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

