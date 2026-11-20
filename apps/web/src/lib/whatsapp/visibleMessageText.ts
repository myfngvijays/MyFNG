/** Text a person actually sent or received, not the archive label "Template: key". */

type WaRow = {
  text_body?: string | null;
  media_caption?: string | null;
  template_name?: string | null;
  payload?: unknown;
  meta?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function paramList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

export function whatsAppTemplateParams(row: WaRow): string[] {
  const meta = asRecord(row.meta);
  const payload = asRecord(row.payload);
  const request = asRecord(payload.request);
  return paramList(meta.template_params).length
    ? paramList(meta.template_params)
    : paramList(request.template_params).length
      ? paramList(request.template_params)
      : paramList(payload.template_params);
}

export function visibleWhatsAppText(row: WaRow): string {
  const params = whatsAppTemplateParams(row);
  const body = String(row.text_body || '').trim();
  const caption = String(row.media_caption || '').trim();
  const placeholder = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(body.toUpperCase());
  const archiveLabel = /^template:\s*/i.test(body);

  if (params.length && (!body || archiveLabel || placeholder)) return params.join('\n');
  if (archiveLabel) {
    const paren = body.match(/\(([\s\S]+)\)\s*$/);
    const inside = String(paren?.[1] || '').trim();
    if (inside) return inside;
  }
  if (body && !placeholder) return body;
  if (caption) return caption;
  return '';
}
