'use client';

import { useEffect, useState } from 'react';

type Button = { type: string; text: string; reply: boolean };
type Template = {
  template_name: string;
  display_name?: string | null;
  status: string;
  header?: string;
  footer?: string;
  body_text?: string;
  example_values?: string[];
  buttons: Button[];
};
type Flow = { id: string; name: string; status: string };

function fillBody(body: string, params: string[]) {
  let output = body || '';
  params.forEach((value, index) => {
    output = output.replaceAll(`{{${index + 1}}}`, value || `{{${index + 1}}}`);
  });
  return output;
}

function TemplatePhone({ template }: { template: Template }) {
  const body = fillBody(template.body_text || '', template.example_values || []);
  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.6rem] border-[8px] border-[#111b21] bg-[#efeae2] shadow-lg">
      <div className="bg-[#075e54] px-3 py-2 text-white">
        <p className="text-[11px] text-white/70">My FNG Autocare</p>
        <p className="text-sm font-semibold">+91 95949 96161</p>
      </div>
      <div className="min-h-[240px] px-3 py-3">
        <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
          {template.header ? <p className="mb-1 text-sm font-semibold text-[#111b21]">{template.header}</p> : null}
          <p className="whitespace-pre-wrap text-[13px] leading-5 text-[#111b21]">{body || 'No message body'}</p>
          {template.footer ? <p className="mt-2 text-[11px] text-[#667781]">{template.footer}</p> : null}
          <p className="mt-1 text-right text-[10px] text-[#667781]">now</p>
        </div>
        {template.buttons.length ? (
          <div className="mt-1 overflow-hidden rounded-lg bg-white shadow-sm">
            {template.buttons.map((button) => (
              <div key={`${button.type}-${button.text}`} className="border-t border-[#f0f2f5] px-2 py-2 text-center text-[13px] font-medium text-[#027eb5]">
                {button.text}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CampaignButtonBots() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(true);

  useEffect(() => {
    void fetch('/api/whatsapp/bot-flow/campaign-buttons')
      .then((response) => response.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setTemplates(json.templates || []);
        setFlows(json.flows || []);
        setReady(json.table_ready !== false);
        const next: Record<string, string> = {};
        for (const row of json.mappings || []) next[`${row.template_name}::${row.button_text}`] = row.bot_flow_id;
        setMaps(next);
      })
      .catch((err) => setError(err?.message || 'Could not load button bots'));
  }, []);

  const chosen = templates.find((row) => row.template_name === templateName) || null;
  const replyButtons = (chosen?.buttons || []).filter((button) => button.reply);

  async function save(buttonText: string, flowId: string) {
    setError('');
    setNotice('');
    const key = `${templateName}::${buttonText}`;
    setMaps((current) => ({ ...current, [key]: flowId }));
    const response = await fetch('/api/whatsapp/bot-flow/campaign-buttons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name: templateName, button_text: buttonText, bot_flow_id: flowId }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || 'Could not save');
      return;
    }
    setNotice(flowId ? `${buttonText} will start that flow.` : `${buttonText} has no bot.`);
  }

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Campaign button bot</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose a template. The WhatsApp message opens with its buttons, then each reply button maps to a published bot flow.
      </p>
      {!ready ? (
        <p className="mt-3 text-sm text-amber-800">Run database/391_whatsapp_bulk_fields_and_button_flows.sql, then refresh.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Template
        <select value={templateName} onChange={(event) => setTemplateName(event.target.value)} className="mt-1 w-full max-w-md rounded-lg border px-3 py-2 text-sm font-normal text-slate-900">
          <option value="">Choose a template</option>
          {templates.map((template) => (
            <option key={template.template_name} value={template.template_name}>
              {template.display_name || template.template_name} · {template.status}
              {template.buttons.length ? ` · ${template.buttons.length} button${template.buttons.length === 1 ? '' : 's'}` : ''}
            </option>
          ))}
        </select>
      </label>

      {chosen ? (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          <TemplatePhone template={chosen} />
          <div className="rounded-xl border bg-[#f8fbff] p-3">
            <h3 className="text-sm font-semibold text-slate-900">Button mapping</h3>
            <p className="mt-1 text-xs text-slate-500">These are the buttons on this template. A tap starts the flow you pick.</p>
            <div className="mt-3 space-y-2">
              {replyButtons.map((button) => {
                const key = `${templateName}::${button.text}`;
                return (
                  <div key={button.text} className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div className="rounded-lg border bg-white px-3 py-2 text-center text-sm font-medium text-[#027eb5]">{button.text}</div>
                    <select
                      value={maps[key] || ''}
                      onChange={(event) => void save(button.text, event.target.value)}
                      className="rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <option value="">No bot</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id} disabled={String(flow.status).toUpperCase() !== 'PUBLISHED'}>
                          {flow.name} · {flow.status}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {!replyButtons.length ? (
                <p className="text-sm text-slate-500">
                  This template has no reply buttons. Link and call buttons stay on the preview, and they do not start a bot.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {!templates.length ? <p className="mt-3 text-sm text-slate-500">No templates loaded. Sync them from Template studio, then refresh.</p> : null}
    </section>
  );
}
