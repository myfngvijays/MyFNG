import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!WHATSAPP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'WHATSAPP_ACCESS_TOKEN is not configured' }, { status: 500 });
    }

    const { id } = await params;
    const mediaId = String(id || '').trim();
    if (!mediaId) return NextResponse.json({ error: 'media id is required' }, { status: 400 });

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

    const metaResponse = await fetch(`${WHATSAPP_API_URL}/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      cache: 'no-store',
    });
    const metaPayload = await metaResponse.json().catch(() => ({}));
    if (!metaResponse.ok) {
      const msg = String(metaPayload?.error?.message || 'Failed to fetch media metadata');
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const mediaUrl = String(metaPayload?.url || '').trim();
    const mimeType = String(metaPayload?.mime_type || '').trim();
    if (!mediaUrl) {
      return NextResponse.json({ error: 'Media URL not available from Meta' }, { status: 404 });
    }

    const mediaResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      cache: 'no-store',
    });
    if (!mediaResponse.ok) {
      return NextResponse.json({ error: 'Failed to download media from Meta' }, { status: 502 });
    }

    const contentType = mediaResponse.headers.get('content-type') || mimeType || 'application/octet-stream';
    const buffer = await mediaResponse.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

