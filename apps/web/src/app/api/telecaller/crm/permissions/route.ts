import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { resolveCrmPermissionsForUser } from '@/lib/telecaller/resolveCrmPermissions';

export const dynamic = 'force-dynamic';

/** GET — current user's effective CRM permissions (web + app). */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;

    const resolved = await resolveCrmPermissionsForUser(ctx.db, ctx.teleCallerId, ctx.roleCode);
    return NextResponse.json({
      ok: true,
      role: ctx.roleCode,
      ...resolved,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
