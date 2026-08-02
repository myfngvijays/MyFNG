'use client';

import { X } from 'lucide-react';

export type WhatsAppTemplatePreviewData = {
  template_name: string;
  display_name?: string | null;
  body_text: string;
  example_values?: string[];
  variable_keys?: string[];
  category?: string;
  language_code?: string;
  meta?: { status?: string } | null;
};

function renderTemplateBody(body: string, exampleValues: string[] = []) {
  let output = body;
  exampleValues.forEach((value, index) => {
    output = output.replaceAll(`{{${index + 1}}}`, value || `[${index + 1}]`);
  });
  output = output.replace(/\{\{(\d+)\}\}/g, (_, index) => `[var ${index}]`);
  return output;
}

export function WhatsAppTemplateBubble({
  template,
  compact = false,
}: {
  template: WhatsAppTemplatePreviewData;
  compact?: boolean;
}) {
  const message = renderTemplateBody(template.body_text, template.example_values || []);
  const timeLabel = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#d1d7db] bg-[#efeae2] ${
        compact ? 'p-2' : 'p-4'
      }`}
      style={{
        backgroundImage:
          'radial-gradient(#d9d2cb 0.8px, transparent 0.8px), radial-gradient(#d9d2cb 0.8px, transparent 0.8px)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }}
    >
      <div className={`${compact ? 'max-w-[220px]' : 'max-w-[280px]'} mx-auto`}>
        <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
          <p className={`whitespace-pre-wrap text-[#111b21] ${compact ? 'text-[11px] leading-4' : 'text-sm leading-5'}`}>
            {message}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
            <span>{timeLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppPhonePreview({ template }: { template: WhatsAppTemplatePreviewData }) {
  const message = renderTemplateBody(template.body_text, template.example_values || []);
  const timeLabel = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto w-[300px] rounded-[2rem] border-[10px] border-gray-900 bg-gray-900 p-1 shadow-2xl">
      <div className="overflow-hidden rounded-[1.4rem] bg-white">
        {/* Status bar */}
        <div className="flex items-center justify-between bg-[#008069] px-4 pb-1 pt-2 text-[10px] text-white/90">
          <span>{timeLabel}</span>
          <div className="mx-auto h-5 w-24 rounded-full bg-black/25" aria-hidden />
          <span className="flex gap-1">
            <span>●●●</span>
          </span>
        </div>

        {/* WhatsApp header */}
        <div className="flex items-center gap-3 bg-[#008069] px-3 pb-3 pt-1 text-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            M
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">My FNG Car Service</p>
            <p className="text-[11px] text-white/75">Business account</p>
          </div>
        </div>

        {/* Chat area */}
        <div
          className="min-h-[360px] px-3 py-4"
          style={{
            backgroundColor: '#efeae2',
            backgroundImage:
              'radial-gradient(#d9d2cb 0.8px, transparent 0.8px), radial-gradient(#d9d2cb 0.8px, transparent 0.8px)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 8px 8px',
          }}
        >
          <div className="mb-3 flex justify-center">
            <span className="rounded-md bg-[#ffffffb3] px-2 py-1 text-[10px] font-medium text-[#54656f] shadow-sm">
              Today
            </span>
          </div>
          <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
            <p className="whitespace-pre-wrap text-[13px] leading-[1.35] text-[#111b21]">{message}</p>
            <div className="mt-1 flex items-center justify-end text-[10px] text-[#667781]">
              <span>{timeLabel}</span>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t bg-[#f0f2f5] px-3 py-2">
          <div className="h-8 flex-1 rounded-full bg-white px-3 text-[11px] leading-8 text-gray-400">
            Type a message
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#008069] text-xs text-white">
            ➤
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppTemplatePreviewModal({
  template,
  onClose,
}: {
  template: WhatsAppTemplatePreviewData | null;
  onClose: () => void;
}) {
  if (!template) return null;

  const title = template.display_name || template.template_name;
  const metaStatus = String(template.meta?.status || 'NOT_SYNCED').toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">WhatsApp preview · {template.template_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-6">
          <WhatsAppPhonePreview template={template} />
        </div>

        <div className="border-t bg-gray-50 px-4 py-3 text-xs text-gray-600">
          <div className="flex flex-wrap gap-2">
            {template.category ? (
              <span className="rounded bg-white px-2 py-0.5 font-semibold text-gray-700">{template.category}</span>
            ) : null}
            {template.language_code ? (
              <span className="rounded bg-white px-2 py-0.5 text-gray-700">
                {template.language_code.toUpperCase()}
              </span>
            ) : null}
            <span
              className={`rounded px-2 py-0.5 font-semibold ${
                metaStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              Meta: {metaStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
