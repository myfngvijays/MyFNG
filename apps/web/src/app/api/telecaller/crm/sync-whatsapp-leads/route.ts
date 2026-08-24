import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { syncRecentWhatsAppInboundLeads } from '@/lib/whatsappAgents/inboundServiceLead';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER']);

/**
 * POST /api/telecaller/crm/sync-whatsapp-leads
 * Backfill service_leads from recent inbound WhatsApp messages.
 * Body: { hours?: number, phone?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await syncRecentWhatsAppInboundLeads({
      hours: body?.hours,
      limit: body?.limit,
      phone: body?.phone,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sync failed' }, { status: 500 });
  }
}
