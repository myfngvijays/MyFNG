'use client';

import { useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function cardHeading(nodeType: string) {
  if (nodeType === 'template') return 'Template';
  if (nodeType === 'ask') return 'Question';
  if (nodeType === 'update_lead') return 'Update lead status';
  if (nodeType === 'apply_tags') return 'Lead tag';
  if (nodeType === 'api_request') return 'Call API';
  if (nodeType === 'end') return 'End';
  if (nodeType === 'delay') return 'Wait';
  if (nodeType === 'condition') return 'If / Else';
  if (nodeType === 'handoff' || nodeType === 'assign_telecaller') return 'Assign';
  if (nodeType === 'media') return 'Media';
  return 'Message';
}

function cardBody(nodeType: string, data: Record<string, unknown>) {
  const message = String(data.messageBody || '').trim();
  if (nodeType === 'message' || nodeType === 'ask' || nodeType === 'template' || nodeType === 'buttons') {
    return message || (nodeType === 'template' ? 'Select a template' : 'Message likho');
  }
  if (nodeType === 'update_lead') {
    const disposition = String(data.crmDisposition || 'FRESH').trim() || 'FRESH';
    const pipeline = String(data.leadStatus || '').trim();
    const fresh = disposition.toUpperCase() === 'FRESH';
    return fresh
      ? `Lead Fresh${pipeline ? ` · ${pipeline}` : ''}\nNaya number → new lead\nPurana number → fresh`
      : `Lead ${disposition}${pipeline ? ` · ${pipeline}` : ''}`;
  }
  if (nodeType === 'apply_tags') {
    const tags = Array.isArray(data.tagNames)
      ? data.tagNames.map((item) => String(item || '').trim()).filter(Boolean)
      : String(data.tagNamesCsv || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    const mode = String(data.tagMode || 'add').toLowerCase() === 'replace' ? 'Replace' : 'Add';
    return tags.length ? `${mode}: ${tags.join(', ')}` : `${mode}: tag select karo`;
  }
  if (nodeType === 'api_request') {
    const preset = String(data.apiPreset || 'telecrm');
    if (preset === 'telecrm') {
      const match = String(data.apiBody || '').match(/"LEADTAG"\s*:\s*"([^"]*)"/);
      return match?.[1] ? `TeleCRM\nLEADTAG: ${match[1]}` : 'TeleCRM\nLEADTAG + remark';
    }
    return String(data.apiUrl || 'API URL daalo');
  }
  if (nodeType === 'end') return 'Flow yahin khatam';
  if (nodeType === 'delay') return `Wait ${Number(data.delaySeconds || 0)} sec`;
  if (nodeType === 'media') return `${String(data.mediaType || 'image')} message${message ? `\n${message}` : ''}`;
  if (nodeType === 'condition') return String(data.condition || 'yes / no');
  if (nodeType === 'assign_telecaller') return String(data.assignMode || 'auto') === 'fixed' ? 'Fixed telecaller' : 'Auto assign';
  if (nodeType === 'handoff') return 'Human agent';
  return message || String(data.label || '');
}

export default function FlowCardNode({ id, data }: NodeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nodeData = (data || {}) as Record<string, unknown>;
  const nodeType = String(nodeData.nodeType || 'message');
  const buttons = Array.isArray(nodeData.buttons)
    ? nodeData.buttons.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const title = String(nodeData.templateName || nodeData.label || cardHeading(nodeType));
  const body = cardBody(nodeType, nodeData);
  const showSource = nodeType !== 'end';

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div className="w-[260px] overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400" />
      <div className="relative bg-[#075e54] px-3 py-2 pr-8 text-white">
        <p className="text-[10px] uppercase tracking-wide text-white/70">{cardHeading(nodeType)}</p>
        <p className="truncate text-xs font-semibold">{title}</p>
        <button
          type="button"
          title="Node options"
          className="nodrag nopan absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <span className="text-base leading-none">⋮</span>
        </button>
        {menuOpen ? (
          <div
            className="nodrag nopan absolute right-1 top-8 z-20 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-800 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[12px] font-medium hover:bg-slate-50"
              onClick={() => {
                setMenuOpen(false);
                window.dispatchEvent(new CustomEvent('bot-flow-clone-node', { detail: { id } }));
              }}
            >
              Clone
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[12px] font-medium text-rose-600 hover:bg-rose-50"
              onClick={() => {
                setMenuOpen(false);
                window.dispatchEvent(new CustomEvent('bot-flow-delete-node', { detail: { id } }));
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
      <div className="bg-[#efeae2] px-2 py-2">
        <div className="rounded-lg rounded-tl-none bg-white px-2 py-1.5">
          <p className="line-clamp-5 whitespace-pre-wrap text-[11px] leading-4 text-[#111b21]">{body}</p>
        </div>
        {buttons.map((button) => (
          <div key={button} className="relative mt-1 rounded-md bg-white px-2 py-1.5 text-center text-[12px] font-semibold text-[#027eb5]">
            {button}
            <Handle
              type="source"
              id={button}
              position={Position.Right}
              className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#027eb5]"
              style={{ top: '50%', right: 0, left: 'auto', bottom: 'auto', transform: 'translate(50%, -50%)' }}
            />
          </div>
        ))}
      </div>
      {showSource && !buttons.length ? (
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400" />
      ) : null}
    </div>
  );
}
