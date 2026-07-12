/**
 * WhatsApp does not render **markdown** bold. Convert/strip for outbound + admin preview.
 */

export function formatWhatsAppReply(text: string): string {
  let out = String(text || '').trim();
  if (!out) return out;

  // **bold** → *bold* (WhatsApp native bold)
  out = out.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // Long decorative separators → short break
  out = out.replace(/[━─]{4,}/g, '────────');

  // Collapse excessive blank lines
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

export function splitWhatsAppPreviewParts(text: string): Array<{ type: 'text' | 'bold'; value: string }> {
  const parts: Array<{ type: 'text' | 'bold'; value: string }> = [];
  const raw = String(text || '');
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: raw.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'bold', value: match[1] || match[2] || '' });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    parts.push({ type: 'text', value: raw.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: raw }];
}
