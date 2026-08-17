import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'LEAD_MANAGER',
];

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

function ts(value?: string | null): number {
  if (!value) return 0;
  const n = new Date(value).getTime();
  return Number.isNaN(n) ? 0 : n;
}

function getChatPhone(row: any): string {
  const direction = String(row?.direction || '').toUpperCase();
  const sender = normalizePhone(String(row?.sender_phone || ''));
  const recipient = normalizePhone(String(row?.recipient_phone || ''));

  if (direction === 'INBOUND') return sender;
  if (direction === 'OUTBOUND') return recipient;
  return recipient || sender;
}

function leadMessagePreview(lead: any): string {
  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const fromMeta =
    String(meta.last_inbound_message || meta.first_message || '').trim() ||
    String(meta.meta_referral?.headline || '').trim();
  if (fromMeta) return fromMeta.slice(0, 180);
  const fromProblem = String(lead?.problem_description || lead?.description || '').trim();
  if (fromProblem) return fromProblem.slice(0, 180);
  const label = String(meta.last_call_label || '').trim();
  if (label) return label.slice(0, 180);
  const name = String(lead?.customer_name || '').trim();
  if (name) return `Lead: ${name}`;
  return 'No WhatsApp messages yet';
}

async function loadTelecallerLeadPhones(
  db: any,
  telecallerId: string,
  unassigned: boolean,
): Promise<Map<string, any>> {
  const byPhone = new Map<string, any>();
  // Hard cap — inbox must stay fast (no multi-page scan + N+1 WA lookups).
  const LIMIT = 120;

  let query = db
    .from('service_leads')
    .select(
      'customer_phone, customer_name, problem_description, description, coupon_meta, updated_at, created_at',
    )
    .is('deleted_at', null)
    .not('customer_phone', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(LIMIT);

  query = unassigned
    ? query.is('assigned_telecaller_id', null)
    : query.or(
        `assigned_telecaller_id.eq.${telecallerId},created_by_id.eq.${telecallerId}`,
      );

  let { data, error } = await query;

  // Fallback if created_by_id missing / filter rejected
  if (error && !unassigned) {
    console.warn('[whatsapp/chats] assignee or-filter failed, assigned-only', error.message);
    const retry = await db
      .from('service_leads')
      .select(
        'customer_phone, customer_name, problem_description, description, coupon_meta, updated_at, created_at',
      )
      .is('deleted_at', null)
      .not('customer_phone', 'is', null)
      .eq('assigned_telecaller_id', telecallerId)
      .order('updated_at', { ascending: false })
      .limit(LIMIT);
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  for (const row of data || []) {
    const phone = normalizePhone(String(row.customer_phone || ''));
    if (!phone || byPhone.has(phone)) continue;
    const meta = row?.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};
    const leadInboundAt =
      String(meta.last_inbound_at || meta.inbound_at || '').trim() ||
      row.updated_at ||
      row.created_at ||
      null;
    const preview = leadMessagePreview(row);
    const waInbound = Boolean(meta.whatsapp_inbound || meta.whatsapp_enquiry);
    byPhone.set(phone, {
      phone,
      customer_name: String(row.customer_name || '').trim() || null,
      lead_message_preview: preview,
      lead_inbound_at: leadInboundAt,
      whatsapp_inbound: waInbound,
      last_message_preview: preview,
      last_message_type: null,
      last_direction: waInbound ? 'INBOUND' : null,
      last_status: null,
      last_message_at: leadInboundAt,
    });
  }

  return byPhone;
}

async function getTelecallerWhatsappChats(
  db: any,
  telecallerId: string,
  mode: string,
  searchDigits: string,
) {
  const unassigned = mode === 'unassigned';
  const byPhone = await loadTelecallerLeadPhones(db, telecallerId, unassigned);

  // Also include explicit WhatsApp chat assignments for this telecaller.
  if (!unassigned) {
    try {
      const { data: assignedRows, error: assignedError } = await db
        .from('whatsapp_chat_assignments')
        .select('phone')
        .contains('assigned_to_ids', [telecallerId])
        .limit(80);
      if (!assignedError) {
        for (const row of assignedRows || []) {
          const phone = normalizePhone(String(row?.phone || ''));
          if (!phone || byPhone.has(phone)) continue;
          byPhone.set(phone, {
            phone,
            customer_name: null,
            last_message_preview: 'Assigned WhatsApp chat',
            last_message_type: null,
            last_direction: null,
            last_status: null,
            last_message_at: null,
          });
        }
      }
    } catch {
      /* assignments table optional */
    }
  }

  if (searchDigits) {
    for (const phone of [...byPhone.keys()]) {
      if (!phone.includes(searchDigits)) byPhone.delete(phone);
    }
  }

  // Skip N+1 whatsapp_messages enrich — lead preview is enough for inbox list.
  // Opening a chat loads full history separately.
  const chats = Array.from(byPhone.values())
    .map(({ lead_message_preview: _lp, lead_inbound_at: _la, whatsapp_inbound: _wi, ...rest }) => rest)
    .sort((a, b) => ts(b.last_message_at) - ts(a.last_message_at));

  return {
    chats,
    count: chats.length,
    lead_count: chats.length,
    scanned_messages: 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
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
    const roleCode = String((userProfile as any)?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const mode = String(request.nextUrl.searchParams.get('mode') || 'assigned').toLowerCase();
    const scanRaw = Number(request.nextUrl.searchParams.get('scan') || 50000);
    const scanLimit = Number.isFinite(scanRaw) ? Math.max(200, Math.min(200000, Math.floor(scanRaw))) : 50000;
    const searchRaw = String(request.nextUrl.searchParams.get('search') || '').trim();
    const searchDigits = searchRaw.replace(/\D/g, '');

    if (roleCode === 'TELECALLER') {
      const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
      if (!supabaseAdmin) {
        return NextResponse.json(
          { error: adminError || 'Server configuration error' },
          { status: 503 },
        );
      }
      // Telecallers only work assigned leads; unassigned pool is distributed by admin.
      if (mode === 'unassigned') {
        return NextResponse.json({
          success: true,
          chats: [],
          count: 0,
          lead_count: 0,
          scanned_messages: 0,
          mode,
          scope: 'unassigned_leads_disabled',
        });
      }
      const result = await getTelecallerWhatsappChats(
        supabaseAdmin,
        String(userProfile.id),
        mode,
        searchDigits,
      );
      return NextResponse.json({
        success: true,
        ...result,
        mode,
        scope: mode === 'unassigned' ? 'unassigned_leads' : 'my_assigned_leads',
      });
    }

    let assignedPhoneSet: Set<string> | null = null;
    let excludePhoneSet: Set<string> | null = null;

    if (roleCode === 'RSA_MANAGER') {
      if (mode === 'unassigned') {
        const allAssignedPhones: string[] = [];
        let assignOffset = 0;
        const assignBatch = 1000;
        while (true) {
          const { data: batch, error: batchError } = await db
            .from('whatsapp_chat_assignments')
            .select('phone')
            .range(assignOffset, assignOffset + assignBatch - 1);
          if (batchError) {
            return NextResponse.json({ error: batchError.message || 'Failed to load assignments' }, { status: 500 });
          }
          const rows = batch || [];
          for (const row of rows) {
            const p = normalizePhone(String(row?.phone || ''));
            if (p) allAssignedPhones.push(p);
          }
          if (rows.length < assignBatch) break;
          assignOffset += assignBatch;
        }
        excludePhoneSet = new Set(allAssignedPhones);
      } else {
        const { data: assignedRows, error: assignedError } = await db
          .from('whatsapp_chat_assignments')
          .select('phone')
          .contains('assigned_to_ids', [userProfile.id]);
        if (assignedError) {
          return NextResponse.json({ error: assignedError.message || 'Failed to load assigned chats' }, { status: 500 });
        }
        assignedPhoneSet = new Set(
          (assignedRows || [])
            .map((row: any) => normalizePhone(String(row?.phone || '')))
            .filter(Boolean)
        );
        if (assignedPhoneSet.size === 0) {
          return NextResponse.json({
            success: true,
            chats: [],
            count: 0,
            scanned_messages: 0,
          });
        }
      }
    }

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 2000);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.floor(limitRaw))) : 2000;

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
        if (assignedPhoneSet && !assignedPhoneSet.has(phone)) continue;
        if (excludePhoneSet && excludePhoneSet.has(phone)) continue;
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
