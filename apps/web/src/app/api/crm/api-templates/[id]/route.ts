import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiTemplates, serializeTemplate, tableMissingResponse, templateFromBody } from '@/lib/crm/apiTemplateAdmin';
import { unknownVariables } from '@/lib/crm/apiTemplates';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function loadRow(db: any, id: string) {
  return db.from('crm_api_templates').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const { data, error } = await loadRow(auth.db, id);
  if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json({ success: true, template: serializeTemplate(data) });
}

/** Update. Blank / masked secret fields keep the saved value. `{ is_active }` alone just toggles. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const { data: existing, error: readErr } = await loadRow(auth.db, id);
  if (readErr) return tableMissingResponse(readErr) || NextResponse.json({ error: readErr.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = templateFromBody(body, existing);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await auth.db
    .from('crm_api_templates')
    .update({
      ...parsed.row,
      updated_by_id: auth.userId,
      updated_by_name: auth.userName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    success: true,
    template: serializeTemplate(data),
    unknown_variables: unknownVariables(`${parsed.row.url}\n${parsed.row.payload_template}`),
  });
}

/** Soft delete (stops firing; run history kept). */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const { error } = await auth.db
    .from('crm_api_templates')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by_id: auth.userId,
      updated_by_name: auth.userName,
    })
    .eq('id', id);
  if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
