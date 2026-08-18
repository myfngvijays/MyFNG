'use client';

import type { Node } from '@xyflow/react';

type TemplateOption = {
  id: string;
  template_name: string;
  display_name: string | null;
  language_code: string;
  variable_keys?: string[];
};

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
                onPatchNodeData({
                  templateName: name,
                  templateVariableCount: Array.isArray(found?.variable_keys) ? found!.variable_keys!.length : 0,
                });
              }}
            >
              <option value="">Select template</option>
              {templateOptions.map((item) => (
                <option key={item.id} value={item.template_name}>
                  {(item.display_name || item.template_name) + ` (${item.language_code.toUpperCase()})`}
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
            <option value="whatsapp_incoming">Incoming WhatsApp</option>
            <option value="template_replied">On Template Replied</option>
            <option value="interactive_replied">On Interactive Replied</option>
            <option value="lead_assigned">On Lead Assignment</option>
            <option value="lead_status_change">On Lead Status Change</option>
            <option value="payment_completed">Payment Completed</option>
          </select>
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Lead status to set</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
            value={String(data.leadStatus || '')}
            onChange={(e) => onPatchNodeData({ leadStatus: e.target.value })}
            placeholder="e.g. CONTACTED / FOLLOW_UP"
          />
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
