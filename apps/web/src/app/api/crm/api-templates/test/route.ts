import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiTemplates, tableMissingResponse, templateFromBody } from '@/lib/crm/apiTemplateAdmin';
import {
  buildLeadVariables,
  executeTemplate,
  loadLeadForTemplate,
  maskHeaders,
  renderTemplate,
  unknownVariables,
} from '@/lib/crm/apiTemplates';

export const dynamic = 'force-dynamic';

/**
 * Test a template (saved or the unsaved draft in the editor) against one lead.
 * POST { id?, template, lead_number, send }
 *   send=false → only shows the filled request (nothing leaves the server)
 *   send=true  → really calls the endpoint and logs it (trigger TEST)
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiTemplates(request);
  if (!auth.ok) return auth.res;
  const body = await request.json().catch(() => ({}));

  let existing: any = null;
  const id = String(body?.id || '').trim();
  if (id) {
    const { data, error } = await auth.db.from('crm_api_templates').select('*').eq('id', id).maybeSingle();
    if (error) return tableMissingResponse(error) || NextResponse.json({ error: error.message }, { status: 400 });
    existing = data;
  }
  const parsed = templateFromBody(body?.template || {}, existing || undefined);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const leadNumber = String(body?.lead_number || '').trim();
  if (!leadNumber) return NextResponse.json({ error: 'Enter a lead number (L-…) to test with' }, { status: 400 });
  const lead = await loadLeadForTemplate(auth.db, { lead_number: leadNumber });
  if (!lead) return NextResponse.json({ error: `Lead ${leadNumber} not found` }, { status: 404 });

  const tpl = parsed.merged;
  const unknown = unknownVariables(`${tpl.url}\n${tpl.payload_template}`);
  let preview;
  try {
    preview = renderTemplate(tpl, buildLeadVariables(lead, { actorName: auth.userName }));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not build request' }, { status: 400 });
  }
  const shown = {
    url: preview.url,
    method: preview.method,
    headers: maskHeaders(preview.headers),
    payload: preview.preview,
  };

  if (!body?.send) {
    return NextResponse.json({ success: true, sent: false, request: shown, unknown_variables: unknown });
  }

  if (!existing) {
    // Logging needs a saved template row.
    return NextResponse.json({ error: 'Save the template first, then use Send test' }, { status: 400 });
  }
  const result = await executeTemplate(auth.db, { ...tpl, id: existing.id }, lead, {
    trigger: 'TEST',
    actorName: auth.userName,
    actorId: auth.userId,
  });
  return NextResponse.json({
    success: true,
    sent: true,
    ok: result.ok,
    status: result.status ?? null,
    error: result.error || null,
    response: result.response || null,
    duration_ms: result.durationMs ?? null,
    request: shown,
    unknown_variables: unknown,
  });
}
