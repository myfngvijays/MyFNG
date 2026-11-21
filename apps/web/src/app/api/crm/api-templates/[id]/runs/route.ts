import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiTemplates, tableMissingResponse } from '@/lib/crm/apiTemplateAdmin';

export const dynamic = 'force-dynamic';

/** Last sends of one template (newest first). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 200);
  const { data, error } = await auth.db
    .from('crm_api_template_runs')
    .select('id, lead_id, lead_number, trigger, ok, status_code, error, request_body, response_body, duration_ms, run_by_name, created_at')
    .eq('template_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, runs: data || [] });
}
