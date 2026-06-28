import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { debitWallet } from '@/lib/wallet-service';
import {
  assertWalletAdmin,
  resolveCustomerWalletMatches,
  resolveWalletBulkEntries,
  sumMatchAmounts,
} from '@/lib/wallet/walletBulkAdmin';
import { WALLET_BULK_MAX_ENTRIES, walletBulkLimitError } from '@/lib/wallet/walletBulkConstants';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await assertWalletAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const campaignLabel = typeof body.campaign_label === 'string' ? body.campaign_label.trim() : '';
    const dryRun = body.dry_run === true;

    let entries;
    try {
      entries = await resolveWalletBulkEntries(body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No valid phone + amount entries found' }, { status: 400 });
    }

    if (entries.length > WALLET_BULK_MAX_ENTRIES) {
      return NextResponse.json({ error: walletBulkLimitError(entries.length) }, { status: 400 });
    }

    const { matches, notFoundPhones, invalidAmountPhones } = await resolveCustomerWalletMatches(
      supabaseAdmin,
      entries,
    );

    if (matches.length === 0) {
      return NextResponse.json(
        {
          error: 'No matching customers found.',
          not_found_phones: notFoundPhones,
          debited_count: 0,
        },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        matched_count: matches.length,
        total_debit: sumMatchAmounts(matches),
        not_found_phones: notFoundPhones,
        preview: matches.map((m) => ({
          phone: m.phone,
          full_name: m.full_name,
          amount: m.amount,
          current_balance: m.current_balance,
          balance_after: Math.max(0, m.current_balance - m.amount),
          sufficient: m.current_balance >= m.amount,
        })),
      });
    }

    const batchId = randomUUID();
    const label = note || (campaignLabel ? `Bulk debit — ${campaignLabel}` : 'Bulk wallet debit from admin');

    const results: Array<{
      phone: string;
      full_name: string | null;
      amount: number;
      debited: number;
      balance_after: number;
      duplicate: boolean;
      error?: string;
    }> = [];

    let debitedCount = 0;
    let skippedCount = 0;

    for (const match of matches) {
      try {
        const idempotencyKey = `admin-bulk-debit:${batchId}:${match.customer_id}`;
        const result = await debitWallet(supabaseAdmin, match.customer_id, match.amount, {
          source: 'ADMIN_DEBIT',
          idempotencyKey,
          metadata: {
            label,
            admin_user_id: auth.userId,
            admin_note: note || null,
            campaign_label: campaignLabel || null,
            bulk_batch_id: batchId,
          },
        });

        if (result.duplicate) skippedCount += 1;
        else debitedCount += 1;

        results.push({
          phone: match.phone,
          full_name: match.full_name,
          amount: match.amount,
          debited: result.debited,
          balance_after: result.balance_after,
          duplicate: result.duplicate,
        });

        await supabaseAdmin.from('customer_analytics_events').insert({
          customer_id: match.customer_id,
          event_name: 'wallet_admin_debit',
          event_group: 'wallet',
          properties: {
            amount: result.debited,
            balance_after: result.balance_after,
            admin_user_id: auth.userId,
            bulk_batch_id: batchId,
            duplicate: result.duplicate,
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Debit failed';
        results.push({
          phone: match.phone,
          full_name: match.full_name,
          amount: match.amount,
          debited: 0,
          balance_after: match.current_balance,
          duplicate: false,
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      debited_count: debitedCount,
      skipped_count: skippedCount,
      matched_count: matches.length,
      total_debited: results.reduce((sum, r) => sum + (r.debited || 0), 0),
      not_found_phones: notFoundPhones,
      invalid_amount_phones: invalidAmountPhones,
      results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
