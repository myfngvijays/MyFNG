import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const ALLOWED_TEMPLATE_READ_ROLES = [
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
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null, userProfile: null };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, full_name, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden', user, userProfile: null };
  }

  return { ok: true, status: 200, error: null, user, userProfile };
}

async function assertTemplateReader(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null, userProfile: null };
  }

  const email = String(user.email || '').trim();
  const phone = String(user.phone || '').trim();
  const selectProfile = 'id, full_name, roles!inner(role_code)';

  const { data: byId } = await db
    .from('users_login')
    .select(selectProfile)
    .eq('id', user.id)
    .maybeSingle();
  const { data: byEmail } = !byId && email
    ? await db.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byId && !byEmail && phone
    ? await db.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };

  const userProfile = byId || byEmail || byPhone;
  const roleCode = String((userProfile as any)?.roles?.role_code || '').toUpperCase();
  if (!userProfile || !ALLOWED_TEMPLATE_READ_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden', user, userProfile: null };
  }

  return { ok: true, status: 200, error: null, user, userProfile };
}

function normalizeTemplateName(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

async function createTemplateOnMeta(payload: {
  template_name: string;
  language_code: string;
  category: string;
  body_text: string;
}) {
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  }
  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
  }

  const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.template_name,
      language: payload.language_code,
      category: payload.category,
      components: [
        {
          type: 'BODY',
          text: payload.body_text,
        },
      ],
    }),
    cache: 'no-store',
  });

  const metaResult = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(metaResult?.error?.error_user_msg || metaResult?.error?.message || '').trim() ||
      'Failed to create template on Meta';
    throw new Error(msg);
  }

  return metaResult;
}

async function verifyTemplateOnMeta(templateName: string) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,status,language,category&limit=50&name=${encodeURIComponent(
    templateName
  )}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(payload?.error?.error_user_msg || payload?.error?.message || '').trim() ||
      'Meta verification call failed';
    throw new Error(msg);
  }
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const matched = data.find(
    (row: any) => String(row?.name || '').trim().toLowerCase() === templateName.toLowerCase()
  );
  return matched || null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertTemplateReader(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const roleCode = String((auth.userProfile as any)?.roles?.role_code || '').toUpperCase();
    const useAdminRead =
      roleCode === 'SUPER_ADMIN' ||
      roleCode === 'SUB_ADMIN' ||
      roleCode === 'LEAD_MANAGER' ||
      roleCode === 'TELECALLER' ||
      roleCode === 'RSA_MANAGER';
    const { supabaseAdmin } = getSupabaseAdmin();
    const readDb = useAdminRead && supabaseAdmin ? supabaseAdmin : db;

    const { data, error } = await readDb
      .from('whatsapp_templates')
      .select(
        'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta, created_at, updated_at'
      )
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let templates = Array.isArray(data) ? data : [];

    const isAuthRow = (row: any) => {
      const cat = String(row?.category || '').toLowerCase();
      const name = String(row?.template_name || '').trim().toLowerCase();
      return cat.includes('auth') || name.includes('otp') || name.startsWith('auth_');
    };

    // OTP / Auth templates are never useful in CRM chat for LM or telecaller.
    if (roleCode === 'LEAD_MANAGER' || roleCode === 'TELECALLER') {
      templates = templates.filter((row: any) => !isAuthRow(row));
    }

    // Telecallers: only Active + explicitly "Telecaller ON" (meta.crm_telecaller).
    // No name-based fallback — hide in admin must actually hide in app.
    if (roleCode === 'TELECALLER') {
      templates = templates.filter((row: any) => {
        if (row?.is_active === false) return false;
        const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
        return meta.crm_telecaller === true || meta.crm_telecaller === '1' || meta.crm_telecaller === 1;
      });
    }

    return NextResponse.json({
      success: true,
      templates,
      viewer_role: roleCode,
      telecaller_scoped: roleCode === 'TELECALLER',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const templateName = normalizeTemplateName(String(body?.template_name || ''));
    const displayName = String(body?.display_name || '').trim() || null;
    const languageCode = String(body?.language_code || 'en').trim() || 'en';
    const category = String(body?.category || 'UTILITY').trim().toUpperCase() || 'UTILITY';
    const bodyText = String(body?.body_text || '').trim();
    const variableKeys = Array.isArray(body?.variable_keys)
      ? body.variable_keys.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];
    const exampleValues = Array.isArray(body?.example_values)
      ? body.example_values.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];

    if (!templateName) {
      return NextResponse.json({ error: 'template_name is required' }, { status: 400 });
    }
    if (!bodyText) {
      return NextResponse.json({ error: 'body_text is required' }, { status: 400 });
    }

    // Create template on Meta first so local DB stays aligned with WABA source of truth.
    const metaCreated = await createTemplateOnMeta({
      template_name: templateName,
      language_code: languageCode,
      category,
      body_text: bodyText,
    });
    const verified = await verifyTemplateOnMeta(templateName);
    if (!verified) {
      return NextResponse.json(
        {
          error: `Template create was sent but not verifiable on this WABA (${WHATSAPP_BUSINESS_ACCOUNT_ID}). Check you are viewing the same WhatsApp account/business in Meta Manager and refresh filters.`,
        },
        { status: 502 }
      );
    }

    const metaStatus = String(verified?.status || metaCreated?.status || 'PENDING').toUpperCase();

    const { data, error } = await db
      .from('whatsapp_templates')
      .insert({
        template_name: templateName,
        display_name: displayName,
        language_code: languageCode,
        category,
        body_text: bodyText,
        variable_keys: variableKeys,
        example_values: exampleValues,
        is_active: metaStatus === 'APPROVED',
        meta: {
          source: 'meta_create',
          status: metaStatus,
          template_id: verified?.id || metaCreated?.id || null,
          category: verified?.category || metaCreated?.category || category,
          language: verified?.language || metaCreated?.language || languageCode,
          created_at: new Date().toISOString(),
          raw: {
            create_response: metaCreated,
            verify_response: verified,
          },
        },
        created_by: auth.userProfile.id,
        updated_at: new Date().toISOString(),
      })
      .select(
        'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta, created_at, updated_at'
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create template' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      template: data,
      meta: {
        id: verified?.id || metaCreated?.id || null,
        status: metaStatus,
      },
      message:
        metaStatus === 'APPROVED'
          ? 'Template created on Meta and synced locally.'
          : 'Template submitted to Meta and saved locally. In Meta Manager switch Status filter to All/Pending if not visible in Active.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
