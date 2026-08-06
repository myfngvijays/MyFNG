import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import {
  ADMIN_MENU_API_SUMMARY,
  API_SERVICES_CATALOG,
  API_SERVICE_TIER_LABELS,
  getEnvConfiguredKeys,
  isServiceConfigured,
  type ApiServiceTier,
} from '@/lib/admin/api-services-catalog';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const envStatus = getEnvConfiguredKeys();

    const services = API_SERVICES_CATALOG.map((entry) => ({
      ...entry,
      configured: isServiceConfigured(entry, envStatus),
      envStatus: Object.fromEntries(
        (entry.envKeys || []).map((key) => [key, envStatus[key] ?? false]),
      ),
    }));

    const counts: Record<ApiServiceTier, number> = {
      free: services.filter((s) => s.tier === 'free').length,
      paid: services.filter((s) => s.tier === 'paid').length,
      platform: services.filter((s) => s.tier === 'platform').length,
    };

    const configuredPaid = services.filter((s) => s.tier === 'paid' && s.configured).length;

    return NextResponse.json({
      tierLabels: API_SERVICE_TIER_LABELS,
      counts,
      configuredPaid,
      services,
      adminMenus: ADMIN_MENU_API_SUMMARY,
      notes: [
        'There is no Google Cloud “API Billing” product in this admin panel.',
        'Customer invoice billing (/api/billing/*) is separate from third-party API costs.',
        'Only MISA AI Dashboard shows live OpenAI org usage and estimated costs.',
      ],
      lastChecked: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
