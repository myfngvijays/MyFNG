import type { ReactNode } from 'react';
import { splitWhatsAppPreviewParts } from '@/lib/whatsappBotFlow/formatReply';

export function renderInlineChatText(text: string, isUser: boolean): ReactNode[] {
  const parts = splitWhatsAppPreviewParts(text);
  return parts.map((part, index) =>
    part.type === 'bold' ? (
      <strong
        key={index}
        className={isUser ? 'font-semibold text-white' : 'font-semibold text-gray-900'}
      >
        {part.value}
      </strong>
    ) : (
      <span key={index}>{part.value}</span>
    ),
  );
}

export function renderChatMessageLine(line: string, isUser: boolean, lineKey: number): ReactNode {
  const mdLinkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
  if (mdLinkMatch?.[1] && mdLinkMatch?.[2]) {
    const full = mdLinkMatch[0];
    const label = mdLinkMatch[1];
    const url = mdLinkMatch[2];
    const start = line.indexOf(full);
    const before = start >= 0 ? line.slice(0, start) : '';
    const after = start >= 0 ? line.slice(start + full.length) : '';

    return (
      <span key={lineKey}>
        {renderInlineChatText(before, isUser)}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={isUser ? 'underline text-white/90' : 'underline text-brand-primary'}
        >
          {label}
        </a>
        {renderInlineChatText(after, isUser)}
        <br />
      </span>
    );
  }

  const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch?.[1]) {
    const rawUrl = urlMatch[1];
    const cleanUrl = rawUrl.replace(/[)\],.]+$/g, '');
    const trailingJunk = rawUrl.slice(cleanUrl.length);
    const before = line.slice(0, urlMatch.index || 0);
    const after = (trailingJunk + line.slice((urlMatch.index || 0) + rawUrl.length)).replace(/^\)/, '');

    return (
      <span key={lineKey}>
        {renderInlineChatText(before, isUser)}
        <a
          href={cleanUrl}
          target="_blank"
          rel="noreferrer"
          className={isUser ? 'underline text-white/90' : 'underline text-brand-primary'}
        >
          {cleanUrl}
        </a>
        {renderInlineChatText(after, isUser)}
        <br />
      </span>
    );
  }

  return (
    <span key={lineKey}>
      {renderInlineChatText(line, isUser)}
      <br />
    </span>
  );
}
