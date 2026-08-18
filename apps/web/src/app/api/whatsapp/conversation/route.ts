import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'LEAD_MANAGER',
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'BILLING_SPECIALIST',
];

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

/** Collapse lead wrappers so "WhatsApp (91…) · Msg: Hello" ≈ "Hello" for dedupe. */
function normalizeInboundCore(text: string): string {
  let t = String(text || '').trim().toLowerCase();
  t = t.replace(/^whatsapp\s*\([^)]*\)\s*[·•\-|:]?\s*(msg|message)?\s*[:=]?\s*/i, '');
  t = t.replace(/^(msg|message)\s*[:=]\s*/i, '');
  return t.replace(/\s+/g, ' ').trim();
}

async function resolveUserProfile(db: any, user: any) {
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await db.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await db.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await db.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };
  return byEmail || byPhone || byId;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user);
    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = String(userProfile?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db: any = supabaseAdmin || supabase;
    if (!supabaseAdmin && adminError) {
      console.warn('[whatsapp/conversation] admin unavailable:', adminError);
    }

    const phoneRaw = String(request.nextUrl.searchParams.get('phone') || '').trim();
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 40);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 40;
    const beforeCreatedAtRaw = String(
      request.nextUrl.searchParams.get('before_created_at') || ''
    ).trim();
    const beforeCreatedAt = beforeCreatedAtRaw ? new Date(beforeCreatedAtRaw).toISOString() : null;

    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }
    const local10 = normalized.slice(-10);

    // Cursor-based fetch with strict normalized filtering for large chats.
    const fetchBatchSize = Math.max(limit * 5, 120);
    const strictMatches: any[] = [];
    let cursorCreatedAt: string | null = beforeCreatedAt;
    let hasMore = false;
    let safety = 0;

    while (strictMatches.length < limit + 1 && safety < 6) {
      safety += 1;

      let query = db
        .from('whatsapp_messages')
        .select(
          'id, provider_message_id, direction, message_type, sender_phone, recipient_phone, template_name, text_body, media_url, media_mime_type, media_caption, payload, meta, status, error_message, status_at, created_at'
        )
        .or(
          [
            `sender_phone.ilike.%${normalized}%`,
            `recipient_phone.ilike.%${normalized}%`,
            `sender_phone.ilike.%${local10}%`,
            `recipient_phone.ilike.%${local10}%`,
          ].join(','),
        )
        .order('created_at', { ascending: false })
        .limit(fetchBatchSize);

      if (cursorCreatedAt) {
        query = query.lt('created_at', cursorCreatedAt);
      }

      const { data: batch, error } = await query;
      if (error) {
        return NextResponse.json(
          { error: error.message || 'Failed to fetch conversation' },
          { status: 500 }
        );
      }

      const rows = batch || [];
      if (rows.length === 0) break;

      const strictBatch = rows.filter((row: any) => {
        const sender = normalizePhone(String(row?.sender_phone || ''));
        const recipient = normalizePhone(String(row?.recipient_phone || ''));
        const senderDigits = String(row?.sender_phone || '').replace(/\D/g, '');
        const recipientDigits = String(row?.recipient_phone || '').replace(/\D/g, '');
        return (
          sender === normalized ||
          recipient === normalized ||
          senderDigits.endsWith(local10) ||
          recipientDigits.endsWith(local10)
        );
      });
      strictMatches.push(...strictBatch);

      const lastRow = rows[rows.length - 1];
      cursorCreatedAt = String(lastRow?.created_at || '').trim() || null;

      if (rows.length < fetchBatchSize) break;
      if (!cursorCreatedAt) break;
    }

    hasMore = strictMatches.length > limit;
    const selected = strictMatches.slice(0, limit);
    const nextCursor = selected.length > 0 ? selected[selected.length - 1]?.created_at || null : null;

    // First page only: seed chat from CRM lead inbound text when WhatsApp archive is empty/partial.
    // Overview list often shows coupon_meta / enquiry text that was never stored in whatsapp_messages.
    let messages = selected.reverse();
    if (!beforeCreatedAt) {
      try {
        const { data: leads } = await db
          .from('service_leads')
          .select(
            'id, customer_name, customer_phone, problem_description, description, coupon_meta, created_at, updated_at',
          )
          .is('deleted_at', null)
          .or(`customer_phone.ilike.%${local10}%`)
          .order('updated_at', { ascending: false })
          .limit(8);

        const existingBodies = new Set(
          messages
            .map((m: any) => normalizeInboundCore(String(m?.text_body || m?.media_caption || '')))
            .filter(Boolean),
        );

        const seeds: any[] = [];
        for (const lead of leads || []) {
          const phone = normalizePhone(String(lead.customer_phone || ''));
          if (phone !== normalized && !String(lead.customer_phone || '').replace(/\D/g, '').endsWith(local10)) {
            continue;
          }
          const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
          const candidates = [
            String(meta.last_inbound_message || '').trim(),
            String(meta.first_message || '').trim(),
            String(meta.customer_message || '').trim(),
            String(lead.problem_description || '').trim(),
            String(lead.description || '').trim(),
          ].filter((t) => t.length > 0);

          for (const text of candidates) {
            const key = normalizeInboundCore(text);
            if (!key || existingBodies.has(key)) continue;
            // Skip if this candidate is only a wrapped duplicate of a shorter body already present
            let isWrappedDup = false;
            for (const existing of existingBodies) {
              if (key.includes(existing) && existing.length >= 12 && key.length > existing.length + 8) {
                isWrappedDup = true;
                break;
              }
              if (existing.includes(key) && key.length >= 12 && existing.length > key.length + 8) {
                isWrappedDup = true;
                break;
              }
            }
            if (isWrappedDup) continue;
            existingBodies.add(key);
            const at =
              String(meta.last_inbound_at || meta.inbound_at || '').trim() ||
              lead.updated_at ||
              lead.created_at ||
              new Date().toISOString();
            seeds.push({
              id: `lead-seed-${lead.id}-${seeds.length}`,
              provider_message_id: null,
              direction: 'INBOUND',
              message_type: 'TEXT',
              sender_phone: normalized,
              recipient_phone: null,
              template_name: null,
              text_body: text.slice(0, 4000),
              media_url: null,
              media_mime_type: null,
              media_caption: null,
              payload: { source: 'service_lead', lead_id: lead.id },
              meta: { seeded_from_lead: true, lead_id: lead.id },
              status: 'RECEIVED',
              error_message: null,
              status_at: at,
              created_at: at,
            });
          }
          if (seeds.length >= 6) break;
        }

        if (seeds.length > 0) {
          messages = [...seeds, ...messages].sort(
            (a, b) =>
              new Date(a.created_at || a.status_at || 0).getTime() -
              new Date(b.created_at || b.status_at || 0).getTime(),
          );
        }
      } catch (seedErr) {
        console.warn('[whatsapp/conversation] lead seed skipped', seedErr);
      }
    }

    // Final inbound dedupe (real + seed) — prefer shorter / non-wrapped body
    {
      const seen = new Map<string, number>();
      const deduped: any[] = [];
      for (const row of messages) {
        const core = normalizeInboundCore(String(row?.text_body || row?.media_caption || ''));
        const dir = String(row?.direction || '').toUpperCase();
        if (dir === 'INBOUND' && core) {
          const prevIdx = seen.get(core);
          if (prevIdx != null) {
            const prev = deduped[prevIdx];
            const prevText = String(prev?.text_body || prev?.media_caption || '');
            const curText = String(row?.text_body || row?.media_caption || '');
            const preferCurrent =
              curText.length < prevText.length ||
              (/^whatsapp\s*\(/i.test(prevText) && !/^whatsapp\s*\(/i.test(curText));
            if (preferCurrent) deduped[prevIdx] = row;
            continue;
          }
          seen.set(core, deduped.length);
        }
        deduped.push(row);
      }
      messages = deduped;
    }

    return NextResponse.json({
      success: true,
      phone: normalized,
      messages,
      has_more: hasMore,
      next_before_created_at: hasMore ? nextCursor : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
