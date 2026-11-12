'use client';

import { useEffect, useState } from 'react';
import type { Node } from '@xyflow/react';
import {
  DEFAULT_API_HEADERS,
  DEFAULT_TELECRM_FLOW_BODY,
  TELECRM_API_BEARER,
  TELECRM_API_URL,
} from '@/lib/whatsappBotFlow/telecrmApiBody';

type TemplateOption = {
  id: string;
  template_name: string;
  display_name: string | null;
  language_code: string;
  body_text?: string | null;
  variable_keys?: string[];
  meta?: { status?: string; raw?: { components?: Array<{ type?: string; text?: string; buttons?: Array<{ type?: string; text?: string }> }> } } | null;
};

function replyButtons(template?: TemplateOption | null) {
  const components = template?.meta?.raw?.components || [];
  const titles: string[] = [];
  for (const component of components) {
    if (String(component?.type || '').toUpperCase() !== 'BUTTONS') continue;
    for (const button of component.buttons || []) {
      const text = String(button?.text || '').trim();
      const type = String(button?.type || '').toUpperCase();
      if (text && !/URL|PHONE|OTP|COPY/.test(type)) titles.push(text);
    }
  }
  return titles;
}

type LeadTagOption = { id: string; name: string; color?: string | null };

function TagPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [tags, setTags] = useState<LeadTagOption[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTags = async () => {
    const res = await fetch('/api/lead-manager/tags');
    const json = await res.json().catch(() => ({}));
    setTags(Array.isArray(json?.tags) ? json.tags : []);
  };

  useEffect(() => {
    void loadTags();
  }, []);

  const toggle = (name: string) => {
    const exists = selected.some((item) => item.toLowerCase() === name.toLowerCase());
    onChange(exists ? selected.filter((item) => item.toLowerCase() !== name.toLowerCase()) : [...selected, name]);
  };

  const createTag = async () => {
    const name = draft.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_tag', name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not create tag');
      setDraft('');
      await loadTags();
      if (!selected.some((item) => item.toLowerCase() === name.toLowerCase())) onChange([...selected, name]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-600">Lead tags</label>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {tags.length ? (
          tags.map((tag) => {
            const checked = selected.some((item) => item.toLowerCase() === tag.name.toLowerCase());
            return (
              <label key={tag.id} className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={checked} onChange={() => toggle(tag.name)} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: tag.color || '#cbd5e1' }} />
                {tag.name}
              </label>
            );
          })
        ) : (
          <p className="text-[11px] text-slate-500">Koi tag nahi mila.</p>
        )}
      </div>
      <div className="flex gap-1">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Naya tag"
        />
        <button
          type="button"
          onClick={() => void createTag()}
          disabled={saving || !draft.trim()}
          className="rounded-lg bg-slate-900 px-2 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {selected.length ? <p className="text-[11px] text-slate-500">{selected.length} selected. Ek se zyada lag sakte hain.</p> : null}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}

type ApiParam = { key: string; value: string };

function paramRows(value: unknown, fallback: ApiParam[] = []): ApiParam[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => ({
    key: String((item as ApiParam)?.key || ''),
    value: String((item as ApiParam)?.value || ''),
  }));
}

function ParamEditor({
  label,
  addLabel,
  rows,
  onChange,
}: {
  label: string;
  addLabel: string;
  rows: ApiParam[];
  onChange: (rows: ApiParam[]) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {rows.map((row, index) => (
        <div key={`${label}-${index}`} className="flex gap-1">
          <input
            className="w-[38%] rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-violet-400"
            value={row.key}
            placeholder="Key"
            onChange={(event) => onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item)))}
          />
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-violet-400"
            value={row.value}
            placeholder="Value"
            onChange={(event) => onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2 text-xs text-slate-500 hover:text-rose-600"
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-blue-300 px-2 py-1.5 text-[11px] font-semibold text-blue-600"
        onClick={() => onChange([...rows, { key: '', value: '' }])}
      >
        + {addLabel}
      </button>
    </div>
  );
}

function parseCurl(raw: string) {
  const method = raw.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i)?.[1]?.toUpperCase() || 'POST';
  const url = raw.match(/https?:\/\/[^\s'"]+/)?.[0] || '';
  const headers: ApiParam[] = [];
  let bearer = '';
  const headerRe = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(raw))) {
    const splitAt = match[1].indexOf(':');
    if (splitAt < 0) continue;
    const key = match[1].slice(0, splitAt).trim();
    const value = match[1].slice(splitAt + 1).trim();
    if (/^authorization$/i.test(key) && /^bearer\s+/i.test(value)) bearer = value.replace(/^bearer\s+/i, '').trim();
    else headers.push({ key, value });
  }
  const bodyMatch = raw.match(/(?:--data(?:-raw|-binary)?|-d)\s+(['"])([\s\S]*?)\1/);
  return { method, url, bearer, headers, body: bodyMatch?.[2] || '' };
}

function ApiRequestFields({
  data,
  onPatchNodeData,
}: {
  data: Record<string, unknown>;
  onPatchNodeData: (patch: Record<string, unknown>) => void;
}) {
  const [curl, setCurl] = useState('');
  const [showCurl, setShowCurl] = useState(false);
  const [testNote, setTestNote] = useState('');
  const [testing, setTesting] = useState(false);
  const headers = paramRows(data.apiHeaders, DEFAULT_API_HEADERS);
  const query = paramRows(data.apiQuery);

  const runTest = async () => {
    setTesting(true);
    setTestNote('');
    try {
      const res = await fetch('/api/whatsapp/bot-flow/test-api-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, uid: String(data.apiTestUid || '') }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Test call failed');
      setTestNote(`HTTP ${json.status || 200}`);
    } catch (err) {
      setTestNote(err instanceof Error ? err.message : 'Test call failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">UID for testing</label>
        <button type="button" className="text-[11px] font-semibold text-blue-600" onClick={() => setShowCurl((open) => !open)}>
          Import cURL
        </button>
      </div>
      <input
        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
        value={String(data.apiTestUid || '')}
        placeholder="UID"
        onChange={(event) => onPatchNodeData({ apiTestUid: event.target.value })}
      />
      {showCurl ? (
        <div className="space-y-1">
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-[11px] outline-none focus:border-violet-400"
            value={curl}
            placeholder="curl -X POST ..."
            onChange={(event) => setCurl(event.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white"
            onClick={() => {
              const parsed = parseCurl(curl);
              onPatchNodeData({
                apiMethod: parsed.method,
                apiUrl: parsed.url || String(data.apiUrl || ''),
                apiBearer: parsed.bearer || String(data.apiBearer || ''),
                apiAuthType: parsed.bearer ? 'bearer' : String(data.apiAuthType || 'bearer'),
                apiHeaders: parsed.headers.length ? parsed.headers : headers,
                apiBody: parsed.body || String(data.apiBody || ''),
              });
              setShowCurl(false);
            }}
          >
            Apply cURL
          </button>
        </div>
      ) : null}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Select method</label>
        <select
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
          value={String(data.apiMethod || 'POST')}
          onChange={(event) => onPatchNodeData({ apiMethod: event.target.value })}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Request URL</label>
        <input
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-violet-400"
          value={String(data.apiUrl || TELECRM_API_URL)}
          onChange={(event) => onPatchNodeData({ apiUrl: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Select auth type</label>
        <select
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
          value={String(data.apiAuthType || 'bearer')}
          onChange={(event) => onPatchNodeData({ apiAuthType: event.target.value })}
        >
          <option value="bearer">Bearer Auth</option>
          <option value="none">No auth</option>
        </select>
      </div>
      {String(data.apiAuthType || 'bearer') === 'bearer' ? (
        <input
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-violet-400"
          value={data.apiBearer == null ? TELECRM_API_BEARER : String(data.apiBearer)}
          onChange={(event) => onPatchNodeData({ apiBearer: event.target.value, apiAuthType: 'bearer' })}
        />
      ) : null}
      <ParamEditor label="Header parameters" addLabel="Add header parameters" rows={headers} onChange={(rows) => onPatchNodeData({ apiHeaders: rows })} />
      <ParamEditor label="Query parameters" addLabel="Add query parameters" rows={query} onChange={(rows) => onPatchNodeData({ apiQuery: rows })} />
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Select body type</label>
        <select
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
          value={String(data.apiBodyType || 'json')}
          onChange={(event) => onPatchNodeData({ apiBodyType: event.target.value })}
        >
          <option value="json">JSON</option>
          <option value="text">Text</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Body</label>
        <textarea
          className="min-h-[180px] w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-[11px] outline-none focus:border-violet-400"
          value={String(data.apiBody || DEFAULT_TELECRM_FLOW_BODY)}
          onChange={(event) => onPatchNodeData({ apiBody: event.target.value })}
        />
      </div>
      <button
        type="button"
        disabled={testing}
        onClick={() => void runTest()}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {testing ? 'Testing…' : 'Test this call'}
      </button>
      {testNote ? <p className="text-[11px] text-slate-500">{testNote}</p> : null}
    </div>
  );
}

type PropertiesPanelProps = {
  selectedNode: Node | null;
  templateOptions: TemplateOption[];
  onPatchNodeData: (patch: Record<string, unknown>) => void;
};

export default function PropertiesPanel({ selectedNode, templateOptions, onPatchNodeData }: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <h3 className="text-sm font-semibold text-slate-800">No node selected</h3>
        <p className="mt-1 text-xs text-slate-500">
          Canvas pe <span className="font-semibold">Send Message</span> block pe click karo — yahan message text likhne ka box aayega.
        </p>
      </div>
    );
  }

  const nodeType = String((selectedNode.data as any)?.nodeType || selectedNode.type || 'message');
  const data: any = selectedNode.data || {};

  const selectedTemplate = templateOptions.find((item) => item.template_name === String(data.templateName || ''));
  const templateVarCount = Array.isArray(selectedTemplate?.variable_keys) ? selectedTemplate!.variable_keys!.length : 0;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{nodeType}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{String(data.label || selectedNode.id)}</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Label</label>
        <input
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
          value={String(data.label || '')}
          onChange={(e) => onPatchNodeData({ label: e.target.value })}
        />
      </div>

      {nodeType === 'message' || nodeType === 'end' ? (
        <div className="space-y-1 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <label className="text-xs font-bold text-violet-800">Message Body (WhatsApp pe yeh text jayega)</label>
          <textarea
            className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            rows={5}
            value={String(data.messageBody || data.text || '')}
            onChange={(e) => onPatchNodeData({ messageBody: e.target.value })}
            placeholder="Hi {{profile_name}}, thanks for messaging MyFNG…"
            autoFocus={nodeType === 'message'}
          />
          <p className="text-[10px] text-violet-700/80">Tip: {'{{profile_name}}'} use kar sakte ho</p>
        </div>
      ) : null}

      {nodeType === 'handoff' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Handoff Note (internal)</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={String(data.handoffNote || '')}
            onChange={(e) => onPatchNodeData({ handoffNote: e.target.value })}
            placeholder="Shown to agents in chat assignment"
          />
        </div>
      ) : null}

      {nodeType === 'template' ? (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Template</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={String(data.templateName || '')}
              onChange={(e) => {
                const name = e.target.value;
                const found = templateOptions.find((item) => item.template_name === name);
                const buttons = replyButtons(found);
                onPatchNodeData({
                  templateName: name,
                  label: found?.display_name || name,
                  messageBody: found?.body_text || '',
                  buttons,
                  templateVariableCount: Array.isArray(found?.variable_keys) ? found!.variable_keys!.length : 0,
                  templateParamsMapping: (found?.variable_keys || []).map((_, index) => `{{${index + 1}}}`),
                });
              }}
            >
              <option value="">Select template</option>
              {templateOptions.map((item) => (
                <option key={item.id} value={item.template_name}>
                  {(item.display_name || item.template_name) + ` (${item.language_code.toUpperCase()}${item.meta?.status ? ` · ${item.meta.status}` : ''})`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Template Param Mapping (comma separated)</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={Array.isArray(data.templateParamsMapping) ? data.templateParamsMapping.join(', ') : ''}
              onChange={(e) =>
                onPatchNodeData({
                  templateParamsMapping: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
            <p className="text-[11px] text-slate-500">Expected variables: {templateVarCount}</p>
          </div>
        </>
      ) : null}

      {nodeType === 'condition' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Condition Expression</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            rows={3}
            value={String(data.condition || '')}
            onChange={(e) => onPatchNodeData({ condition: e.target.value })}
            placeholder='Example: intent == "RSA" or contains:price'
          />
        </div>
      ) : null}

      {nodeType === 'trigger' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Trigger event</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={String(data.triggerEvent || 'whatsapp_incoming')}
            onChange={(e) =>
              onPatchNodeData({
                triggerEvent: e.target.value,
                label: e.target.selectedOptions[0]?.text || data.label,
              })
            }
          >
            <option value="whatsapp_incoming">New message received</option>
            <option value="hot_keyword">Hot keyword</option>
            <option value="template_replied">Template button reply</option>
            <option value="interactive_replied">On Interactive Replied</option>
            <option value="lead_assigned">On Lead Assignment</option>
            <option value="lead_status_change">On Lead Status Change</option>
            <option value="payment_completed">Payment Completed</option>
          </select>
          {String(data.triggerEvent || '') === 'hot_keyword' ? (
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={String(data.keyword || '')}
              onChange={(e) => onPatchNodeData({ keyword: e.target.value })}
              placeholder="Exact keyword, e.g. INTERESTED"
            />
          ) : null}
          {String(data.triggerEvent || '') === 'template_replied' ? (
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={String(data.buttonText || '')}
              onChange={(e) => onPatchNodeData({ buttonText: e.target.value })}
              placeholder="Button text, e.g. Interested"
            />
          ) : null}
        </div>
      ) : null}

      {nodeType === 'buttons' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Message</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            rows={4}
            value={String(data.messageBody || '')}
            onChange={(e) => onPatchNodeData({ messageBody: e.target.value })}
            placeholder="Thanks {{name}}. Which service for {{car_number}}?"
          />
          <label className="text-xs font-medium text-slate-600">Buttons, one per line, max 3</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            rows={3}
            value={Array.isArray(data.buttons) ? data.buttons.join('\n') : ''}
            onChange={(e) => onPatchNodeData({
              buttons: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3),
            })}
            placeholder={'General service\nAC service\nTalk to team'}
          />
          <p className="text-[11px] text-slate-500">Connect each button to the next message. The line label must match the button.</p>
        </div>
      ) : null}

      {nodeType === 'ask' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Question</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            rows={3}
            value={String(data.messageBody || '')}
            onChange={(e) => onPatchNodeData({ messageBody: e.target.value })}
          />
          <p className="text-[11px] text-slate-500">The flow waits for the next reply, then continues.</p>
        </div>
      ) : null}

      {nodeType === 'media' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">File type</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={String(data.mediaType || 'image')}
            onChange={(e) => onPatchNodeData({ mediaType: e.target.value })}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
            <option value="audio">Audio</option>
          </select>
          <input
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={String(data.mediaUrl || '')}
            onChange={(e) => onPatchNodeData({ mediaUrl: e.target.value })}
            placeholder="https:// file link"
          />
          <input
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={String(data.messageBody || '')}
            onChange={(e) => onPatchNodeData({ messageBody: e.target.value })}
            placeholder="Caption"
          />
        </div>
      ) : null}

      {nodeType === 'delay' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Delay (seconds)</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={Number(data.delaySeconds || 0)}
            onChange={(e) => onPatchNodeData({ delaySeconds: Number(e.target.value || 0) })}
          />
          <p className="text-[11px] text-slate-500">Logged in sync path; scheduled wait can use cron later.</p>
        </div>
      ) : null}

      {nodeType === 'update_lead' ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">CRM disposition (TeleCRM status)</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={String(data.crmDisposition || '')}
              onChange={(e) => onPatchNodeData({ crmDisposition: e.target.value })}
            >
              <option value="">— none —</option>
              <option value="FRESH">Fresh (default / reopen)</option>
              <option value="INTERESTED">Interested</option>
              <option value="CALLBACK">Follow-up</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Pipeline status (optional)</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={String(data.leadStatus || '')}
              onChange={(e) => onPatchNodeData({ leadStatus: e.target.value })}
              placeholder="e.g. NEW / CONTACTED (optional)"
            />
          </div>
        </div>
      ) : null}

      {nodeType === 'apply_tags' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onPatchNodeData({ tagMode: 'add' })}
              className={`rounded-md px-2 py-1.5 text-[11px] font-semibold ${String(data.tagMode || 'add') !== 'replace' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => onPatchNodeData({ tagMode: 'replace' })}
              className={`rounded-md px-2 py-1.5 text-[11px] font-semibold ${String(data.tagMode || 'add') === 'replace' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Replace
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {String(data.tagMode || 'add') === 'replace'
              ? 'Purane tags hat jayenge. Sirf yahan select kiye hue tags rahenge.'
              : 'Purane tags rahenge. Ye naya tag unke saath add hoga.'}
          </p>
          <TagPicker
            selected={
              Array.isArray(data.tagNames)
                ? (data.tagNames as unknown[]).map((item) => String(item || '').trim()).filter(Boolean)
                : String(data.tagNamesCsv || '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
            }
            onChange={(names) => onPatchNodeData({ tagNames: names, tagNamesCsv: names.join(', ') })}
          />
        </div>
      ) : null}

      {nodeType === 'api_request' ? <ApiRequestFields data={data as Record<string, unknown>} onPatchNodeData={onPatchNodeData} /> : null}

      {nodeType === 'assign_telecaller' ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Assign mode</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              value={String(data.assignMode || 'auto')}
              onChange={(e) => onPatchNodeData({ assignMode: e.target.value })}
            >
              <option value="auto">Auto (distribution RR)</option>
              <option value="fixed">Fixed telecaller id</option>
            </select>
          </div>
          {String(data.assignMode || 'auto') === 'fixed' ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Telecaller user id</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
                value={String(data.telecallerId || '')}
                onChange={(e) => onPatchNodeData({ telecallerId: e.target.value })}
                placeholder="UUID"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {nodeType === 'template' && selectedTemplate ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Preview</p>
          <p className="mt-1 text-[11px] text-emerald-900">
            Template <span className="font-mono">{selectedTemplate.template_name}</span> — vars:{' '}
            {templateVarCount}
          </p>
        </div>
      ) : null}

      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(data.mustTerminate)}
          onChange={(e) => onPatchNodeData({ mustTerminate: e.target.checked })}
        />
        Must terminate from this node
      </label>
    </div>
  );
}
