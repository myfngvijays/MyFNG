import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'BILLING_SPECIALIST',
];

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
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
    const db: any = supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(db, user);
    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = userProfile?.roles?.role_code;
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
          'id, provider_message_id, direction, message_type, sender_phone, recipient_phone, template_name, text_body, media_url, media_mime_type, media_caption, payload, status, status_at, created_at'
        )
        .or(`sender_phone.ilike.%${normalized}%,recipient_phone.ilike.%${normalized}%`)
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
        return sender === normalized || recipient === normalized;
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

    return NextResponse.json({
      success: true,
      phone: normalized,
      messages: selected.reverse(),
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
