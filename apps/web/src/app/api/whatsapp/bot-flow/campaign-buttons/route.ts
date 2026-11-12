import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getDbWithAdmin } from '../utils';

function componentList(row: any) {
  const meta = row?.meta || {};
  const components = meta?.raw?.components || meta?.components || meta?.meta_components || [];
  return Array.isArray(components) ? components : [];
}

function collectButtons(components: any[], into: Array<{ type: string; text: string; reply: boolean }>) {
  for (const component of components || []) {
    const type = String(component?.type || '').toUpperCase();
    if (type === 'BUTTONS') {
      for (const button of component?.buttons || []) {
        const buttonType = String(button?.type || 'QUICK_REPLY').toUpperCase();
        const text = String(button?.text || '').trim();
        if (!text) continue;
        const reply = !/URL|PHONE|OTP|COPY/.test(buttonType);
        into.push({ type: buttonType, text, reply });
      }
    }
    if (Array.isArray(component?.cards)) {
      for (const card of component.cards) collectButtons(card?.components || [], into);
    }
  }
}

function previewOf(row: any) {
  const components = componentList(row);
  const header = components.find((item) => String(item?.type || '').toUpperCase() === 'HEADER' && String(item?.format || 'TEXT').toUpperCase() === 'TEXT');
  const footer = components.find((item) => String(item?.type || '').toUpperCase() === 'FOOTER');
  const body = components.find((item) => String(item?.type || '').toUpperCase() === 'BODY');
  const buttons: Array<{ type: string; text: string; reply: boolean }> = [];
  collectButtons(components, buttons);
  const seen = new Set<string>();
  return {
    header: String(header?.text || ''),
    footer: String(footer?.text || ''),
    body_text: String(row?.body_text || body?.text || ''),
    example_values: Array.isArray(row?.example_values) ? row.example_values.map((value: unknown) => String(value || '')) : [],
    buttons: buttons.filter((button) => {
      const key = `${button.type}:${button.text}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

export async function GET() {
  const auth = await getDbWithAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = getSupabaseAdmin();
  const db = supabaseAdmin || auth.db;

  const [templates, flows, maps] = await Promise.all([
    db.from('whatsapp_templates').select('template_name, display_name, body_text, example_values, meta, is_active').order('updated_at', { ascending: false }),
    db.from('bot_flows').select('id, name, status').order('updated_at', { ascending: false }),
    db.from('wa_bulk_button_flows').select('template_name, button_text, bot_flow_id'),
  ]);

  if (templates.error) return NextResponse.json({ error: templates.error.message }, { status: 500 });
  if (flows.error) return NextResponse.json({ error: flows.error.message }, { status: 500 });

  const withButtons = (templates.data || [])
    .map((row: any) => {
      const preview = previewOf(row);
      return {
        template_name: row.template_name,
        display_name: row.display_name,
        status: String(row.meta?.status || (row.is_active === false ? 'INACTIVE' : 'APPROVED')).toUpperCase(),
        ...preview,
      };
    })
    .sort((a: { status: string; buttons: Array<{ reply: boolean }> }, b: { status: string; buttons: Array<{ reply: boolean }> }) => {
      const score = (row: { status: string; buttons: Array<{ reply: boolean }> }) =>
        (row.buttons.some((button) => button.reply) ? 2 : 0) + (row.status === 'APPROVED' ? 1 : 0);
      return score(b) - score(a);
    });

  return NextResponse.json({
    success: true,
    templates: withButtons,
    flows: flows.data || [],
    mappings: maps.error ? [] : maps.data || [],
    table_ready: !maps.error,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getDbWithAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database admin unavailable' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const templateName = String(body?.template_name || '').trim();
  const buttonText = String(body?.button_text || '').trim();
  const flowId = String(body?.bot_flow_id || '').trim();
  if (!templateName || !buttonText) {
    return NextResponse.json({ error: 'Template and button are required' }, { status: 400 });
  }

  if (!flowId) {
    const removed = await supabaseAdmin
      .from('wa_bulk_button_flows')
      .delete()
      .eq('template_name', templateName)
      .eq('button_text', buttonText);
    if (removed.error) {
      return NextResponse.json({ error: removed.error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  const saved = await supabaseAdmin.from('wa_bulk_button_flows').upsert(
    {
      template_name: templateName,
      button_text: buttonText,
      bot_flow_id: flowId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'template_name,button_text' },
  );
  if (saved.error) {
    const missing = /does not exist|42P01|PGRST205/i.test(saved.error.message || '');
    return NextResponse.json(
      {
        error: missing
          ? 'Run database/391_whatsapp_bulk_fields_and_button_flows.sql in Supabase.'
          : saved.error.message,
      },
      { status: missing ? 503 : 500 },
    );
  }
  return NextResponse.json({ success: true });
}
