import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UNCategorized_ID = 'other-services';
const UNCategorized_NAME = 'Other Services';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true as const, status: 200, error: null };
}

async function fetchCategories(supabaseAdmin: any) {
  const attempts = [
    () =>
      supabaseAdmin
        .from('categories')
        .select('uuid, category, status, sequence')
        .eq('status', true)
        .order('sequence')
        .order('category')
        .limit(200),
    () => supabaseAdmin.from('categories').select('uuid, category, sequence').order('sequence').order('category').limit(200),
    () => supabaseAdmin.from('categories').select('uuid, category').order('category').limit(200),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (!error && Array.isArray(data) && data.length > 0) return data;
  }
  return [];
}

async function fetchServiceTypes(supabaseAdmin: any) {
  const attempts = [
    () =>
      supabaseAdmin
        .from('service_types')
        .select('id, name, base_price, category_uuid, is_active')
        .eq('is_active', true)
        .order('name')
        .limit(1000),
    () =>
      supabaseAdmin
        .from('service_types')
        .select('id, name, category_uuid, is_active')
        .eq('is_active', true)
        .order('name')
        .limit(1000),
    () => supabaseAdmin.from('service_types').select('id, name, base_price, category_uuid').order('name').limit(1000),
    () => supabaseAdmin.from('service_types').select('id, name, category_uuid').order('name').limit(1000),
    () => supabaseAdmin.from('service_types').select('id, name').order('name').limit(1000),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (!error && Array.isArray(data) && data.length > 0) return data;
  }
  return [];
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const [categoriesRaw, serviceRows] = await Promise.all([
      fetchCategories(supabaseAdmin),
      fetchServiceTypes(supabaseAdmin),
    ]);

    const categoryMeta = new Map<
      string,
      { id: string; name: string; sequence: number }
    >();

    for (const cat of categoriesRaw) {
      const id = String(cat.uuid || '');
      if (!id) continue;
      categoryMeta.set(id, {
        id,
        name: String(cat.category || 'Category'),
        sequence: Number(cat.sequence ?? 999),
      });
    }

    const services = serviceRows.map((row: any) => {
      const categoryId = row.category_uuid ? String(row.category_uuid) : UNCategorized_ID;
      const category = categoryMeta.get(categoryId);
      return {
        id: String(row.id),
        name: String(row.name || 'Service'),
        base_price: Number(row.base_price || 0),
        category_id: categoryId,
        category_name: category?.name || UNCategorized_NAME,
        category_sequence: category?.sequence ?? 9999,
      };
    });

    const groupMap = new Map<string, { category_id: string; category_name: string; category_sequence: number; services: typeof services }>();

    for (const svc of services) {
      const existing = groupMap.get(svc.category_id);
      if (existing) {
        existing.services.push(svc);
      } else {
        groupMap.set(svc.category_id, {
          category_id: svc.category_id,
          category_name: svc.category_name,
          category_sequence: svc.category_sequence,
          services: [svc],
        });
      }
    }

    const groups = Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        services: group.services.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        if (a.category_sequence !== b.category_sequence) return a.category_sequence - b.category_sequence;
        return a.category_name.localeCompare(b.category_name);
      });

    const categories = groups.map((g) => ({
      id: g.category_id,
      name: g.category_name,
      count: g.services.length,
      sequence: g.category_sequence,
    }));

    return NextResponse.json({
      success: true,
      count: services.length,
      categories,
      groups,
      services,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
