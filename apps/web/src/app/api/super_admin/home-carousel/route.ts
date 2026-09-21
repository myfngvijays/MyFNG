import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'home_carousel_banners';

const LIGHT_CAROUSEL = {
  ganesh: {
    title: 'Ganesh Chaturthi Prime',
    image_url: 'https://myfng.in/media/banners/myfng-prime-ganesh-chaturthi-banner.png',
    route_name: 'Settings__Membership',
    route_params: { membershipType: 'SERVICE' },
    display_order: 0,
    is_active: true,
  },
  service: {
    title: 'Car Service',
    image_url: 'https://myfng.in/media/banners/myfng-car-service-light-banner.png',
    route_name: 'PublicBookServiceNow',
  },
  ai: {
    title: 'MyFNG AI',
    image_url: 'https://myfng.in/media/banners/myfng-misa-ai-light-banner.png',
    route_name: 'AIBooking',
  },
} as const;

function bannerText(row: { title?: string | null; image_url?: string | null; route_name?: string | null }) {
  return `${row?.title || ''} ${row?.image_url || ''} ${row?.route_name || ''}`;
}

function isGaneshBanner(row: { title?: string | null; image_url?: string | null }) {
  return /ganesh/i.test(bannerText(row));
}

function isServiceBanner(row: { title?: string | null; image_url?: string | null; route_name?: string | null }) {
  if (row.route_name === 'PublicBookServiceNow' || row.route_name === 'PublicServicePackages') return true;
  return /service/i.test(`${row.title || ''}`) && !/rsa|roadside/i.test(bannerText(row)) && !/prime|ganesh|membership/i.test(bannerText(row));
}

function isAiBanner(row: { title?: string | null; image_url?: string | null; route_name?: string | null }) {
  return row.route_name === 'AIBooking' || /misa|\bai\b/i.test(`${row.title || ''} ${row.image_url || ''}`);
}

function needsLightImage(row: { image_url?: string | null }, lightUrl: string) {
  return !String(row.image_url || '').includes(lightUrl.split('/').pop() || 'light-banner');
}

function isKeepLightBanner(row: { title?: string | null; image_url?: string | null }) {
  const url = String(row.image_url || '');
  return isGaneshBanner(row)
    || url.includes('car-service-light-banner')
    || url.includes('misa-ai-light-banner');
}

async function applyLightCarousel(supabase: any, rows: any[]) {
  let next = [...rows];

  if (!next.some(isGaneshBanner)) {
    const { data: inserted } = await supabase.from(TABLE).insert(LIGHT_CAROUSEL.ganesh).select().single();
    if (inserted) next = [inserted, ...next];
  }

  const service = next.find(isServiceBanner);
  if (service && needsLightImage(service, LIGHT_CAROUSEL.service.image_url)) {
    const { data: updated } = await supabase
      .from(TABLE)
      .update({
        title: LIGHT_CAROUSEL.service.title,
        image_url: LIGHT_CAROUSEL.service.image_url,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', service.id)
      .select()
      .single();
    if (updated) next = next.map((row) => (row.id === updated.id ? updated : row));
  }

  const ai = next.find(isAiBanner);
  if (ai && needsLightImage(ai, LIGHT_CAROUSEL.ai.image_url)) {
    const { data: updated } = await supabase
      .from(TABLE)
      .update({
        title: LIGHT_CAROUSEL.ai.title,
        image_url: LIGHT_CAROUSEL.ai.image_url,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ai.id)
      .select()
      .single();
    if (updated) next = next.map((row) => (row.id === updated.id ? updated : row));
  }

  const staleIds = next.filter((row) => row.is_active !== false && !isKeepLightBanner(row)).map((row) => row.id);
  if (staleIds.length) {
    const { data: hidden } = await supabase
      .from(TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', staleIds)
      .select();
    const hiddenIds = new Set((hidden || []).map((row: { id: string }) => row.id));
    next = next.map((row) => (hiddenIds.has(row.id) ? { ...row, is_active: false } : row));
  }

  return next;
}

async function requireSuperAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 }) };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 }) };
  }

  return { ok: true, user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[home-carousel][GET] supabase error:', error);
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable =
        code === '42P01' || /does not exist/i.test(error.message)
          ? 'Database table missing. Run `database/103_home_carousel_banners.sql` in Supabase (SQL editor) and reload.'
          : undefined;
      return NextResponse.json(
        {
          error: hintIfMissingTable || 'Failed to fetch banners',
          details: error.message,
          code,
          hint: (error as any).hint,
        },
        { status: 500 }
      );
    }

    const rows = await applyLightCarousel(supabase, data || []);
    return NextResponse.json({ data: rows });
  } catch (e: any) {
    console.error('[home-carousel][GET] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const { title, image_url, route_name, route_params, display_order, is_active } = body || {};

    if (!image_url || !route_name) {
      return NextResponse.json({ error: 'image_url and route_name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        title: title || null,
        image_url,
        route_name,
        route_params: route_params || {},
        display_order: Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
        is_active: is_active !== undefined ? !!is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[home-carousel][POST] supabase error:', error);
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable =
        code === '42P01' || /does not exist/i.test(error.message)
          ? 'Database table missing. Run `database/103_home_carousel_banners.sql` in Supabase (SQL editor) and retry.'
          : undefined;
      return NextResponse.json(
        {
          error: hintIfMissingTable || 'Failed to create banner',
          details: error.message,
          code,
          hint: (error as any).hint,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ data, message: 'Banner created successfully' });
  } catch (e: any) {
    console.error('[home-carousel][POST] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


