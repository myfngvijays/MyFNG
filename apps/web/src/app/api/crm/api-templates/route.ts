import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiTemplates, serializeTemplate, tableMissingResponse, templateFromBody } from '@/lib/crm/apiTemplateAdmin';
import { unknownVariables } from '@/lib/crm/apiTemplates';

export const dynamic = 'force-dynamic';

/** GET list / POST create — CRM API Templates (Settings → API Templates). */
export async function GET(request: NextRequest) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const { data, error } = await auth.db
    .from('crm_api_templates')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, templates: (data || []).map(serializeTemplate) });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const body = await request.json().catch(() => ({}));
  const parsed = templateFromBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const nowIso = new Date().toISOString();
  const { data, error } = await auth.db
    .from('crm_api_templates')
    .insert({
      ...parsed.row,
      created_by_id: auth.userId,
      created_by_name: auth.userName,
      updated_by_id: auth.userId,
      updated_by_name: auth.userName,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();
  if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    success: true,
    template: serializeTemplate(data),
    unknown_variables: unknownVariables(`${parsed.row.url}\n${parsed.row.payload_template}`),
  });
}
