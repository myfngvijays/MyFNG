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
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
        <p className="mt-2 text-xs text-gray-500">Select a node to configure properties.</p>
      </div>
    );
  }

  const nodeType = String((selectedNode.data as any)?.nodeType || selectedNode.type || 'message');
  const data: any = selectedNode.data || {};

  const selectedTemplate = templateOptions.find((item) => item.template_name === String(data.templateName || ''));
  const templateVarCount = Array.isArray(selectedTemplate?.variable_keys) ? selectedTemplate!.variable_keys!.length : 0;

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
        <p className="text-xs text-gray-500 mt-1">
          Node: <span className="font-medium text-gray-700">{String(data.label || selectedNode.id)}</span> ({nodeType})
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Label</label>
        <input
          className="w-full rounded-lg border px-2 py-1.5 text-xs"
          value={String(data.label || '')}
          onChange={(e) => onPatchNodeData({ label: e.target.value })}
        />
      </div>

      {nodeType === 'message' || nodeType === 'end' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Message Body</label>
          <textarea
            className="w-full rounded-lg border px-2 py-1.5 text-xs"
            rows={4}
            value={String(data.messageBody || data.text || '')}
            onChange={(e) => onPatchNodeData({ messageBody: e.target.value })}
            placeholder="Text sent to the customer on WhatsApp"
          />
        </div>
      ) : null}

      {nodeType === 'handoff' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Handoff Note (internal)</label>
          <input
            className="w-full rounded-lg border px-2 py-1.5 text-xs"
            value={String(data.handoffNote || '')}
            onChange={(e) => onPatchNodeData({ handoffNote: e.target.value })}
            placeholder="Shown to agents in chat assignment"
          />
        </div>
      ) : null}

      {nodeType === 'template' ? (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Template</label>
            <select
              className="w-full rounded-lg border px-2 py-1.5 text-xs"
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
            <label className="text-xs font-medium text-gray-600">Template Param Mapping (comma separated)</label>
            <input
              className="w-full rounded-lg border px-2 py-1.5 text-xs"
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
            <p className="text-[11px] text-gray-500">
              Expected variables: {templateVarCount}
            </p>
          </div>
        </>
      ) : null}

      {nodeType === 'condition' ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Condition Expression</label>
          <textarea
            className="w-full rounded-lg border px-2 py-1.5 text-xs"
            rows={3}
            value={String(data.condition || '')}
            onChange={(e) => onPatchNodeData({ condition: e.target.value })}
            placeholder='Example: intent == "RSA"'
          />
        </div>
      ) : null}

      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
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
