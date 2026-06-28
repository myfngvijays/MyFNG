import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { creditWallet } from '@/lib/wallet-service';
import { dispatchPushToCustomer } from '@/lib/push/dispatchCustomerPush';
import {
  insertPushNotificationLog,
  PUSH_LOG_TYPE_WALLET_BULK,
} from '@/lib/push/notificationLog';
import {
  assertWalletAdmin,
  computeExpiresAt,
  resolveCustomerWalletMatches,
  resolveWalletBulkEntries,
  sumMatchAmounts,
} from '@/lib/wallet/walletBulkAdmin';
import {
  renderWalletCreditPushTemplate,
  WALLET_BULK_MAX_ENTRIES,
  WALLET_CREDIT_PUSH_DEFAULT_MESSAGE,
  WALLET_CREDIT_PUSH_DEFAULT_TITLE,
  walletBulkLimitError,
} from '@/lib/wallet/walletBulkConstants';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

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
    const sendPush = body.send_push !== false;
    const pushTitle =
      typeof body.push_title === 'string' && body.push_title.trim()
        ? body.push_title.trim()
        : WALLET_CREDIT_PUSH_DEFAULT_TITLE;
    const pushMessageTemplate =
      typeof body.push_message === 'string' && body.push_message.trim()
        ? body.push_message.trim()
        : WALLET_CREDIT_PUSH_DEFAULT_MESSAGE;
    const expiresInDays = body.expires_in_days != null ? Number(body.expires_in_days) : null;
    const expiresAt = computeExpiresAt(expiresInDays);

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
          error: 'No matching customers found for the given number(s).',
          not_found_phones: notFoundPhones,
          invalid_amount_phones: invalidAmountPhones,
          credited_count: 0,
        },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        matched_count: matches.length,
        total_credit: sumMatchAmounts(matches),
        not_found_phones: notFoundPhones,
        invalid_amount_phones: invalidAmountPhones,
        variable_amounts: new Set(matches.map((m) => m.amount)).size > 1,
        preview: matches.map((m) => ({
          phone: m.phone,
          customer_id: m.customer_id,
          full_name: m.full_name,
          amount: m.amount,
          current_balance: m.current_balance,
          balance_after: m.current_balance + m.amount,
          expires_at: expiresAt,
        })),
      });
    }

    const batchId = randomUUID();
    const label =
      note ||
      (campaignLabel ? `Bulk credit — ${campaignLabel}` : 'Bulk wallet credit from admin');

    const results: Array<{
      phone: string;
      customer_id: string;
      full_name: string | null;
      amount: number;
      credited: number;
      balance_after: number;
      duplicate: boolean;
      push_delivered?: number;
      error?: string;
    }> = [];

    let creditedCount = 0;
    let skippedCount = 0;
    let pushDelivered = 0;

    for (const match of matches) {
      try {
        const idempotencyKey = `admin-bulk-credit:${batchId}:${match.customer_id}`;
        const result = await creditWallet(supabaseAdmin, match.customer_id, match.amount, {
          source: 'ADMIN_CREDIT',
          idempotencyKey,
          expiresAt,
          metadata: {
            label,
            admin_user_id: auth.userId,
            admin_note: note || null,
            campaign_label: campaignLabel || null,
            bulk_batch_id: batchId,
            expires_in_days: expiresInDays || null,
          },
        });

        if (result.duplicate) {
          skippedCount += 1;
        } else {
          creditedCount += 1;
        }

        let pushResult = { delivered: 0 };
        if (sendPush && !result.duplicate && result.credited > 0) {
          const pushVars = {
            amount: inr(result.credited),
            balance: inr(result.balance_after),
            name: match.full_name || 'Customer',
          };
          pushResult = await dispatchPushToCustomer(match.customer_id, {
            title: renderWalletCreditPushTemplate(pushTitle, pushVars),
            body: renderWalletCreditPushTemplate(pushMessageTemplate, pushVars),
            notificationType: 'WALLET_CREDIT',
            data: {
              customer_id: match.customer_id,
              amount: String(result.credited),
              balance_after: String(result.balance_after),
            },
          });
          pushDelivered += pushResult.delivered;
        }

        results.push({
          phone: match.phone,
          customer_id: match.customer_id,
          full_name: match.full_name,
          amount: match.amount,
          credited: result.credited,
          balance_after: result.balance_after,
          duplicate: result.duplicate,
          push_delivered: pushResult.delivered,
        });

        await supabaseAdmin.from('customer_analytics_events').insert({
          customer_id: match.customer_id,
          event_name: 'wallet_admin_credit',
          event_group: 'wallet',
          properties: {
            amount: result.credited,
            balance_after: result.balance_after,
            admin_user_id: auth.userId,
            note: note || null,
            campaign_label: campaignLabel || null,
            bulk_batch_id: batchId,
            duplicate: result.duplicate,
            push_delivered: pushResult.delivered,
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Credit failed';
        results.push({
          phone: match.phone,
          customer_id: match.customer_id,
          full_name: match.full_name,
          amount: match.amount,
          credited: 0,
          balance_after: match.current_balance,
          duplicate: false,
          error: message,
        });
      }
    }

    await supabaseAdmin.from('customer_analytics_events').insert({
      customer_id: matches[0]?.customer_id,
      event_name: 'wallet_bulk_credit',
      event_group: 'wallet',
      properties: {
        batch_id: batchId,
        admin_user_id: auth.userId,
        campaign_label: campaignLabel || null,
        note: note || null,
        matched_count: matches.length,
        credited_count: creditedCount,
        skipped_count: skippedCount,
        total_credited: sumMatchAmounts(matches.filter((_, i) => results[i]?.credited > 0)),
        not_found_phones: notFoundPhones,
        invalid_amount_phones: invalidAmountPhones,
        failed_count: results.filter((r) => r.error).length,
        push_delivered: pushDelivered,
        send_push: sendPush,
        expires_at: expiresAt,
      },
    });

    if (sendPush && creditedCount > 0) {
      const { data: adminUser } = await supabaseAdmin
        .from('users_login')
        .select('full_name')
        .eq('id', auth.userId)
        .maybeSingle();

      const pushLogStatus =
        pushDelivered > 0
          ? pushDelivered < creditedCount
            ? ('PARTIAL' as const)
            : ('SENT' as const)
          : ('FCM_FAILED' as const);

      await insertPushNotificationLog({
        recipient: 'CUSTOMER',
        type: PUSH_LOG_TYPE_WALLET_BULK,
        message: `[${pushTitle}] Wallet bulk credit — ${creditedCount} user(s)`,
        status: pushLogStatus,
        meta: {
          title: pushTitle,
          body: pushMessageTemplate,
          batch_id: batchId,
          credited_count: creditedCount,
          matched_count: matches.length,
          push_delivered: pushDelivered,
          campaign_label: campaignLabel || null,
          sent_by: adminUser?.full_name || 'Admin',
          sent_by_id: auth.userId,
          devices: pushDelivered,
          devices_attempted: creditedCount,
          notification_type: 'WALLET_CREDIT',
        },
      });
    }

    return NextResponse.json({
      success: true,
      dry_run: false,
      batch_id: batchId,
      total_credited: results.reduce((sum, r) => sum + (r.credited || 0), 0),
      credited_count: creditedCount,
      skipped_count: skippedCount,
      matched_count: matches.length,
      push_delivered: pushDelivered,
      not_found_phones: notFoundPhones,
      invalid_amount_phones: invalidAmountPhones,
      variable_amounts: new Set(matches.map((m) => m.amount)).size > 1,
      results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
