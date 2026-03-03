import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function messagePreviewFromRow(row: any): string {
  const text = String(row?.text_body || '').trim();
  if (text) return text;

  const caption = String(row?.media_caption || '').trim();
  if (caption) return caption;

  const template = String(row?.template_name || '').trim();
  if (template) return `Template: ${template}`;

  const type = String(row?.message_type || '').trim().toUpperCase();
  if (type === 'IMAGE') return 'Image';
  if (type === 'VIDEO') return 'Video';
  if (type === 'AUDIO') return 'Audio';
  if (type === 'DOCUMENT') return 'Document';
  if (type === 'TEMPLATE') return 'Template message';
  return 'Message';
}

function getChatPhone(row: any): string {
  const direction = String(row?.direction || '').toUpperCase();
  const sender = normalizePhone(String(row?.sender_phone || ''));
  const recipient = normalizePhone(String(row?.recipient_phone || ''));

  if (direction === 'INBOUND') return sender;
  if (direction === 'OUTBOUND') return recipient;
  return recipient || sender;
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
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(db, user);
    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = String(userProfile?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED_ADMIN_ROLES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 2000);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.floor(limitRaw))) : 2000;
    const scanRaw = Number(request.nextUrl.searchParams.get('scan') || 50000);
    const scanLimit = Number.isFinite(scanRaw) ? Math.max(200, Math.min(200000, Math.floor(scanRaw))) : 50000;
    const searchRaw = String(request.nextUrl.searchParams.get('search') || '').trim();
    const searchDigits = searchRaw.replace(/\D/g, '');

    const batchSize = 1000;
    const byPhone = new Map<string, any>();
    let scanned = 0;
    let cursorCreatedAt: string | null = null;
    let page = 0;

    while (scanned < scanLimit && byPhone.size < limit && page < 200) {
      page += 1;
      let query = db
        .from('whatsapp_messages')
        .select(
          'id, direction, sender_phone, recipient_phone, message_type, text_body, media_caption, template_name, status, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(batchSize);

      if (cursorCreatedAt) {
        query = query.lt('created_at', cursorCreatedAt);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message || 'Failed to fetch chats' }, { status: 500 });
      }

      const rows = data || [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const phone = getChatPhone(row);
        if (!phone) continue;
        if (searchDigits && !phone.includes(searchDigits)) continue;
        if (byPhone.has(phone)) continue;

        byPhone.set(phone, {
          phone,
          last_message_preview: messagePreviewFromRow(row),
          last_message_type: row?.message_type || null,
          last_direction: row?.direction || null,
          last_status: row?.status || null,
          last_message_at: row?.created_at || null,
        });

        if (byPhone.size >= limit) break;
      }

      scanned += rows.length;
      const last = rows[rows.length - 1];
      cursorCreatedAt = String(last?.created_at || '').trim() || null;
      if (rows.length < batchSize || !cursorCreatedAt) break;
    }

    return NextResponse.json({
      success: true,
      chats: Array.from(byPhone.values()),
      count: byPhone.size,
      scanned_messages: scanned,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
