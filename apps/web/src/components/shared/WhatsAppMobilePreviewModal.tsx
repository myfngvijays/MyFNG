'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  PlayCircle,
  Send,
  Video,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

interface WhatsAppMobilePreviewModalProps {
  isOpen: boolean;
  phoneNumber: string;
  title?: string;
  previewMessage?: string;
  leadId?: string | null;
  onClose: () => void;
}

type TemplateOption = {
  id: string;
  template_name: string;
  display_name: string | null;
  language_code: string;
  category?: string | null;
  body_text?: string | null;
  example_values?: string[];
  meta?: Record<string, any> | null;
  variable_keys: string[];
  is_active: boolean;
};

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function formatMessageTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function normalizeDeliveryStatus(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}

function sortMessagesAsc(rows: any[]): any[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a?.created_at || a?.status_at || 0).getTime();
    const tb = new Date(b?.created_at || b?.status_at || 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

function mergeMessages(existing: any[], incoming: any[]): any[] {
  const merged = new Map<string, any>();
  [...existing, ...incoming].forEach((row) => {
    const key = String(row?.id || row?.provider_message_id || Math.random());
    merged.set(key, row);
  });
  return sortMessagesAsc(Array.from(merged.values()));
}

function resolveTemplateImageUrl(template?: TemplateOption | null): string | null {
  if (!template?.meta || typeof template.meta !== 'object') return null;
  const meta = template.meta as Record<string, any>;
  const direct =
    meta.preview_image_url ||
    meta.image_url ||
    meta.header_image_url ||
    meta?.raw?.preview_image_url ||
    meta?.raw?.image_url ||
    meta?.raw?.header_image_url;
  if (typeof direct === 'string' && /^https?:\/\//i.test(direct)) return direct;

  const components = Array.isArray(meta?.raw?.components) ? meta.raw.components : [];
  const header = components.find((c: any) => String(c?.type || '').toUpperCase() === 'HEADER');
  const headerExample =
    header?.example?.header_url?.[0] ||
    header?.example?.header_urls?.[0] ||
    header?.example?.image_url?.[0] ||
    header?.example?.image_urls?.[0];
  if (typeof headerExample === 'string' && /^https?:\/\//i.test(headerExample)) return headerExample;
  return null;
}

function fillTemplateBody(template?: TemplateOption | null, paramsRaw?: string): string {
  const body = String(template?.body_text || '').trim();
  if (!body) return 'Template body preview not available.';
  const params = String(paramsRaw || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const fallbackExamples = Array.isArray(template?.example_values) ? template!.example_values : [];
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, indexRaw: string) => {
    const idx = Math.max(0, Number(indexRaw) - 1);
    return params[idx] || fallbackExamples[idx] || `{{${indexRaw}}}`;
  });
}

function fillTemplateBodyFromArray(template?: TemplateOption | null, paramsInput?: unknown): string {
  const params = Array.isArray(paramsInput)
    ? paramsInput.map((v) => String(v ?? '').trim()).filter(Boolean)
    : [];
  return fillTemplateBody(template, params.join(','));
}

function extractTemplateButtons(template?: TemplateOption | null): Array<{ text: string; type: string }> {
  if (!template?.meta || typeof template.meta !== 'object') return [];
  const components = Array.isArray((template.meta as any)?.raw?.components)
    ? (template.meta as any).raw.components
    : [];
  const buttonsComponent = components.find(
    (component: any) => String(component?.type || '').toUpperCase() === 'BUTTONS'
  );
  const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : [];
  return buttons
    .map((button: any) => ({
      text: String(button?.text || '').trim(),
      type: String(button?.type || '').trim().toUpperCase(),
    }))
    .filter((button: { text: string; type: string }) => Boolean(button.text));
}

function normalizeInboundText(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!(raw.startsWith('{') && raw.endsWith('}'))) return raw;
  try {
    const parsed = JSON.parse(raw);
    const candidate =
      parsed?.text ||
      parsed?.title ||
      parsed?.button?.text ||
      parsed?.interactive?.button_reply?.title ||
      parsed?.interactive?.list_reply?.title ||
      parsed?.payload;
    return String(candidate || raw).trim();
  } catch {
    return raw;
  }
}

function parseInboundStructuredText(value: unknown): { text: string; isStructuredReply: boolean } {
  const raw = String(value || '').trim();
  if (!raw) return { text: '', isStructuredReply: false };
  if (!(raw.startsWith('{') && raw.endsWith('}'))) {
    return { text: raw, isStructuredReply: false };
  }
  try {
    const parsed = JSON.parse(raw);
    const candidate =
      parsed?.text ||
      parsed?.title ||
      parsed?.button?.text ||
      parsed?.interactive?.button_reply?.title ||
      parsed?.interactive?.list_reply?.title ||
      parsed?.payload;
    return {
      text: String(candidate || raw).trim(),
      isStructuredReply: true,
    };
  } catch {
    return { text: raw, isStructuredReply: false };
  }
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?.*)?$/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|3gp|avi|mkv)(\?.*)?$/i.test(url);
}

function isLikelyMapLink(url: string): boolean {
  return /(google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|openstreetmap\.org)/i.test(url);
}

function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function getLocationDetailsFromPayload(payload: any): {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const loc = payload.location;
  if (!loc || typeof loc !== 'object') return null;
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!hasCoords && !loc.name && !loc.address) return null;
  return {
    latitude: hasCoords ? latitude : undefined,
    longitude: hasCoords ? longitude : undefined,
    name: typeof loc.name === 'string' ? loc.name : undefined,
    address: typeof loc.address === 'string' ? loc.address : undefined,
  };
}

function getMediaIdFromPayload(payload: any, messageType: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const key = String(messageType || '').toLowerCase();
  const mediaObj = payload?.[key];
  const mediaId = mediaObj && typeof mediaObj === 'object' ? String(mediaObj.id || '').trim() : '';
  return mediaId;
}

export default function WhatsAppMobilePreviewModal({
  isOpen,
  phoneNumber,
  title,
  previewMessage,
  leadId,
  onClose,
}: WhatsAppMobilePreviewModalProps) {
  const waPhone = normalizePhone(phoneNumber);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeType, setActiveType] = useState<'text' | 'media' | 'template'>('text');
  const [textMessage, setTextMessage] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'document'>('document');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateParams, setTemplateParams] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [nextBeforeCreatedAt, setNextBeforeCreatedAt] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const isAtBottomRef = useRef(true);
  const pendingPrependHeightRef = useRef<number | null>(null);
  const previousLastMessageKeyRef = useRef<string>('');

  const composerMessage = useMemo(
    () =>
      previewMessage ||
      'Namaste! Hum aapki RSA request me assist karne ke liye available hain.',
    [previewMessage]
  );
  const selectedTemplate = useMemo(
    () =>
      templateOptions.find(
        (row) => row.template_name.trim().toLowerCase() === templateName.trim().toLowerCase()
      ) || null,
    [templateOptions, templateName]
  );
  const filteredTemplateOptions = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templateOptions;
    return templateOptions.filter((row) => {
      const name = String(row.template_name || '').toLowerCase();
      const display = String(row.display_name || '').toLowerCase();
      const body = String(row.body_text || '').toLowerCase();
      return name.includes(q) || display.includes(q) || body.includes(q);
    });
  }, [templateOptions, templateSearch]);
  const templatePreviewBody = useMemo(
    () => fillTemplateBody(selectedTemplate, templateParams),
    [selectedTemplate, templateParams]
  );
  const templatePreviewImage = useMemo(
    () => resolveTemplateImageUrl(selectedTemplate),
    [selectedTemplate]
  );
  const templateMap = useMemo(() => {
    const map = new Map<string, TemplateOption>();
    templateOptions.forEach((row) => {
      map.set(String(row.template_name || '').trim().toLowerCase(), row);
    });
    return map;
  }, [templateOptions]);

  useEffect(() => {
    if (!isOpen) return;
    setTemplatesLoading(true);
    fetch('/api/whatsapp/templates')
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.templates) ? data.templates : [];
        setTemplateOptions(rows.filter((row: any) => Boolean(row?.is_active)));
      })
      .catch(() => setTemplateOptions([]))
      .finally(() => setTemplatesLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!showAttachMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (attachMenuRef.current?.contains(target)) return;
      if (attachButtonRef.current?.contains(target)) return;
      setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showAttachMenu]);

  const fetchConversationPage = useCallback(
    async (beforeCreatedAt?: string | null) => {
      if (!waPhone) {
        return { messages: [], hasMore: false, nextBeforeCreatedAt: null as string | null };
      }
      const params = new URLSearchParams({
        phone: waPhone,
        limit: '40',
      });
      if (beforeCreatedAt) params.set('before_created_at', beforeCreatedAt);

      const res = await fetch(`/api/whatsapp/conversation?${params.toString()}`);
      const data = await res.json();
      return {
        messages: Array.isArray(data?.messages) ? data.messages : [],
        hasMore: Boolean(data?.has_more),
        nextBeforeCreatedAt: data?.next_before_created_at ? String(data.next_before_created_at) : null,
      };
    },
    [waPhone]
  );

  const refreshConversation = useCallback(async () => {
    try {
      const page = await fetchConversationPage(null);
      setMessages((prev) => mergeMessages(prev, page.messages));
      setHasMoreHistory(page.hasMore);
      setNextBeforeCreatedAt(page.nextBeforeCreatedAt);
    } catch {
      // ignore
    }
  }, [fetchConversationPage]);

  const loadOlderMessages = useCallback(async () => {
    if (!hasMoreHistory || loadingOlder) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    setLoadingOlder(true);
    pendingPrependHeightRef.current = container.scrollHeight;
    try {
      const page = await fetchConversationPage(nextBeforeCreatedAt);
      setMessages((prev) => mergeMessages(page.messages, prev));
      setHasMoreHistory(page.hasMore);
      setNextBeforeCreatedAt(page.nextBeforeCreatedAt);
    } catch {
      // ignore
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchConversationPage, hasMoreHistory, loadingOlder, nextBeforeCreatedAt]);

  useEffect(() => {
    if (!isOpen || !waPhone) return;
    let isMounted = true;

    const loadInitialConversation = async () => {
      setHistoryLoading(true);
      try {
        const page = await fetchConversationPage(null);
        if (!isMounted) return;
        setMessages(page.messages);
        setHasMoreHistory(page.hasMore);
        setNextBeforeCreatedAt(page.nextBeforeCreatedAt);
        setUnreadCount(0);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };
    void loadInitialConversation();

    const supabase = createClient();
    const channel = supabase
      .channel(`wa-chat-${waPhone}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const row: any = payload.new || payload.old || {};
          const sender = normalizePhone(String(row?.sender_phone || ''));
          const recipient = normalizePhone(String(row?.recipient_phone || ''));
          if (sender === waPhone || recipient === waPhone) {
            void refreshConversation();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      isAtBottomRef.current = true;
      pendingPrependHeightRef.current = null;
      previousLastMessageKeyRef.current = '';
      setUnreadCount(0);
      channel.unsubscribe();
    };
  }, [isOpen, waPhone, fetchConversationPage, refreshConversation]);

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    if (pendingPrependHeightRef.current !== null) {
      const previousHeight = pendingPrependHeightRef.current;
      pendingPrependHeightRef.current = null;
      requestAnimationFrame(() => {
        const nextHeight = container.scrollHeight;
        container.scrollTop += nextHeight - previousHeight;
      });
      return;
    }

    const last = messages[messages.length - 1];
    const lastKey = last ? String(last.id || last.provider_message_id || '') : '';
    const hadLastMessage = Boolean(previousLastMessageKeyRef.current);
    const hasNewTailMessage = hadLastMessage && lastKey && lastKey !== previousLastMessageKeyRef.current;

    if (!hadLastMessage) {
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      });
    } else if (hasNewTailMessage) {
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        });
      } else {
        setUnreadCount((c) => c + 1);
      }
    }

    previousLastMessageKeyRef.current = lastKey;
  }, [messages, isOpen]);

  const handleConversationScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < 80;
    isAtBottomRef.current = nearBottom;
    if (nearBottom && unreadCount > 0) {
      setUnreadCount(0);
    }

    if (container.scrollTop < 80 && hasMoreHistory && !loadingOlder) {
      void loadOlderMessages();
    }
  }, [hasMoreHistory, loadOlderMessages, loadingOlder, unreadCount]);

  const jumpToLatest = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    isAtBottomRef.current = true;
    setUnreadCount(0);
  }, []);

  const handleSend = async () => {
    if (!waPhone) {
      toast.error('Valid customer number required');
      return;
    }
    let payload: Record<string, unknown> = {
      recipient_phone: waPhone,
      lead_id: leadId || undefined,
      message_type: activeType,
    };

    if (activeType === 'text') {
      const text = textMessage.trim() || composerMessage;
      if (!text) {
        toast.error('Type a message first');
        return;
      }
      payload = { ...payload, text };
    } else if (activeType === 'media') {
      if (!mediaUrl.trim()) {
        toast.error('Media URL required');
        return;
      }
      payload = {
        ...payload,
        media_type: mediaType,
        media_url: mediaUrl.trim(),
        caption: caption.trim() || undefined,
      };
    } else {
      if (!templateName.trim()) {
        toast.error('Template name required');
        return;
      }
      payload = {
        ...payload,
        template_name: templateName.trim(),
        language: 'en',
        template_params: templateParams
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      };
    }

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Send failed');
        return;
      }
      toast.success('Message sent to WhatsApp API');
      setTextMessage('');
      setCaption('');
      setShowAttachMenu(false);
      if (activeType === 'template') {
        setActiveType('text');
      }
      await refreshConversation();
    } catch {
      toast.error('Send failed');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-[372px] max-w-[95vw] h-[720px] max-h-[94vh] rounded-[2.6rem] bg-[#0f1f2e] p-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.55)]">
        <div className="h-full rounded-[2.1rem] bg-[#efeae2] overflow-hidden border border-black/25 flex flex-col">
          <div className="h-6 bg-[#0f1f2e] flex items-center justify-center">
            <div className="h-1.5 w-24 rounded-full bg-[#2f3b43]" />
          </div>
          <div className="bg-[#005c4b] text-white px-3.5 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold truncate">{title || 'WhatsApp Chat'}</p>
                <p className="text-[11px] text-white/85 truncate">{phoneNumber || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-md p-1 hover:bg-white/10" aria-label="Voice call">
                <Phone className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded-md p-1 hover:bg-white/10" aria-label="Video call">
                <Video className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded-md p-1 hover:bg-white/10" onClick={onClose} aria-label="Close WhatsApp preview">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={handleConversationScroll}
            className="flex-1 min-h-0 px-2 py-3 space-y-1.5 overflow-y-auto bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22%3E%3Cg fill=%22%23111b21%22 fill-opacity=%220.035%22%3E%3Ccircle cx=%2210%22 cy=%2210%22 r=%221.5%22/%3E%3Ccircle cx=%2238%22 cy=%2226%22 r=%221.5%22/%3E%3Ccircle cx=%2218%22 cy=%2248%22 r=%221.5%22/%3E%3C/g%3E%3C/svg%3E')]"
          >
            {loadingOlder ? (
              <div className="mx-auto w-fit rounded-full bg-[#d9dfe3] px-2.5 py-1 text-[10px] text-[#54656f]">
                Loading older messages...
              </div>
            ) : null}
            {historyLoading ? <div className="text-[11px] text-gray-600">Loading chat...</div> : null}
            {messages.map((msg) => {
              const direction = String(msg?.direction || '').toUpperCase();
              const isOutbound = direction === 'OUTBOUND';
              const isStatus = direction === 'STATUS';
              const deliveryStatus = normalizeDeliveryStatus(msg?.status);
              const isTemplateMessage = Boolean(msg?.template_name);
              const messageType = String(msg?.message_type || '').trim().toUpperCase();
              const parsedInbound = parseInboundStructuredText(msg?.text_body);
              const inboundText = normalizeInboundText(msg?.text_body);
              const isInboundStructuredReply = !isOutbound && !isStatus && parsedInbound.isStructuredReply;
              const mediaUrl = String(msg?.media_url || '').trim();
              const mediaMime = String(msg?.media_mime_type || '').trim().toLowerCase();
              const payloadObj = msg?.payload && typeof msg.payload === 'object' ? msg.payload : null;
              const payloadMediaId = getMediaIdFromPayload(payloadObj, messageType);
              const resolvedMediaUrl =
                mediaUrl || (payloadMediaId ? `/api/whatsapp/media/${encodeURIComponent(payloadMediaId)}` : '');
              const payloadLocation = getLocationDetailsFromPayload(payloadObj);
              const firstUrlFromText = extractFirstHttpUrl(inboundText);
              const locationLinkFromText =
                firstUrlFromText && isLikelyMapLink(firstUrlFromText) ? firstUrlFromText : null;
              const locationLink =
                payloadLocation?.latitude && payloadLocation?.longitude
                  ? `https://www.google.com/maps?q=${payloadLocation.latitude},${payloadLocation.longitude}`
                  : locationLinkFromText;
              const isLocationMessage = messageType === 'LOCATION' || Boolean(payloadLocation) || Boolean(locationLink);
              const isImageMessage =
                messageType === 'IMAGE' ||
                mediaMime.startsWith('image/') ||
                (resolvedMediaUrl ? isImageUrl(resolvedMediaUrl) : false);
              const isAudioMessage =
                messageType === 'AUDIO' ||
                mediaMime.startsWith('audio/') ||
                (resolvedMediaUrl ? isAudioUrl(resolvedMediaUrl) : false);
              const isVideoMessage =
                messageType === 'VIDEO' ||
                mediaMime.startsWith('video/') ||
                (resolvedMediaUrl ? isVideoUrl(resolvedMediaUrl) : false);
              const isDocumentMessage =
                messageType === 'DOCUMENT' ||
                messageType === 'MEDIA' ||
                mediaMime.includes('pdf') ||
                mediaMime.startsWith('application/') ||
                (Boolean(resolvedMediaUrl) && !isImageMessage && !isAudioMessage && !isVideoMessage);
              const currentTemplate = msg?.template_name
                ? templateMap.get(String(msg.template_name || '').trim().toLowerCase()) || null
                : null;
              const templateText = currentTemplate
                ? fillTemplateBodyFromArray(currentTemplate, msg?.payload?.request?.template_params)
                : '';
              const templateButtons = isTemplateMessage ? extractTemplateButtons(currentTemplate) : [];
              const templateDisplayName =
                currentTemplate?.display_name || currentTemplate?.template_name || msg?.template_name || '';
              const text =
                inboundText ||
                (msg?.template_name
                  ? templateText || `Template sent: ${msg.template_name}`
                  : '') ||
                (msg?.media_url ? `${msg?.media_caption || 'Media'}\n${msg.media_url}` : '') ||
                msg?.status ||
                'Message';
              const timeLabel = formatMessageTime(msg?.status_at || msg?.updated_at || msg?.created_at);
              return (
                <div
                  key={msg.id}
                  className={`relative max-w-[84%] rounded-[10px] px-2.5 py-2 text-[13px] leading-[1.3] shadow-[0_1px_1px_rgba(0,0,0,0.08)] whitespace-pre-wrap ${
                    isStatus
                      ? 'mx-auto bg-[#d9dfe3] text-[#54656f] text-center'
                      : isOutbound
                      ? 'ml-auto bg-[#d9fdd3] text-[#111b21]'
                      : 'bg-white text-[#111b21]'
                  }`}
                >
                  {!isStatus ? (
                    <span
                      aria-hidden
                      className={`absolute top-0 h-0 w-0 border-[6px] border-transparent ${
                        isOutbound
                          ? 'right-[-6px] border-l-[#d9fdd3] border-t-[#d9fdd3]'
                          : 'left-[-6px] border-r-white border-t-white'
                      }`}
                    />
                  ) : null}
                  {isTemplateMessage && !isStatus ? (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#0f5132]">
                      Template: {templateDisplayName}
                    </p>
                  ) : null}
                  {isLocationMessage ? (
                    <div className="space-y-1.5">
                      <div className="rounded-md border border-[#d8dee3] bg-[#f8fbff] px-2.5 py-2 text-[12px] text-[#1f2937]">
                        <p className="flex items-center gap-1 font-semibold">
                          <MapPin className="h-3.5 w-3.5 text-[#128c7e]" />
                          Location
                        </p>
                        {payloadLocation?.name ? <p>{payloadLocation.name}</p> : null}
                        {payloadLocation?.address ? (
                          <p className="text-[11px] text-[#4b5563]">{payloadLocation.address}</p>
                        ) : null}
                      </div>
                      {locationLink ? (
                        <a
                          href={locationLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[#c7d0d8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#128c7e]"
                        >
                          Open in Maps
                        </a>
                      ) : null}
                    </div>
                  ) : isImageMessage ? (
                    <div className="space-y-1.5">
                      {resolvedMediaUrl ? (
                        <img
                          src={resolvedMediaUrl}
                          alt="Shared media"
                          className="max-h-48 w-full rounded-md object-cover"
                        />
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full border border-[#d7dde3] bg-[#f7fafc] px-2.5 py-1 text-[11px] font-medium text-[#1f2937]">
                          <ImageIcon className="h-3.5 w-3.5 text-[#128c7e]" />
                          Photo
                        </div>
                      )}
                      {inboundText ? <p>{inboundText}</p> : null}
                    </div>
                  ) : isVideoMessage ? (
                    <div className="space-y-1.5">
                      {resolvedMediaUrl ? (
                        <video
                          controls
                          preload="metadata"
                          className="max-h-52 w-full rounded-md bg-black object-contain"
                        >
                          <source src={resolvedMediaUrl} type={mediaMime || 'video/mp4'} />
                        </video>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full border border-[#d7dde3] bg-[#f7fafc] px-2.5 py-1 text-[11px] font-medium text-[#1f2937]">
                          <PlayCircle className="h-3.5 w-3.5 text-[#128c7e]" />
                          Video
                        </div>
                      )}
                      {inboundText ? <p>{inboundText}</p> : null}
                    </div>
                  ) : isAudioMessage ? (
                    <div className="space-y-1.5">
                      {resolvedMediaUrl ? (
                        <audio controls preload="metadata" className="w-full h-9">
                          <source src={resolvedMediaUrl} type={mediaMime || 'audio/mpeg'} />
                        </audio>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full border border-[#d7dde3] bg-[#f7fafc] px-2.5 py-1 text-[11px] font-medium text-[#1f2937]">
                          <Mic className="h-3.5 w-3.5 text-[#128c7e]" />
                          Audio
                        </div>
                      )}
                      {inboundText ? <p>{inboundText}</p> : null}
                    </div>
                  ) : isDocumentMessage ? (
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1 rounded-full border border-[#d7dde3] bg-[#f7fafc] px-2.5 py-1 text-[11px] font-medium text-[#1f2937]">
                        <FileText className="h-3.5 w-3.5 text-[#128c7e]" />
                        Document
                      </div>
                      {resolvedMediaUrl ? (
                        <a
                          href={resolvedMediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[#c7d0d8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#128c7e]"
                        >
                          Open attachment
                        </a>
                      ) : null}
                      {inboundText ? <p>{inboundText}</p> : null}
                    </div>
                  ) : isInboundStructuredReply ? (
                    <div className="inline-flex max-w-full items-center rounded-full border border-[#d5dce2] bg-[#f8fafc] px-3 py-1 text-[12px] font-medium text-[#1f2937]">
                      {parsedInbound.text}
                    </div>
                  ) : (
                    <p>{text}</p>
                  )}
                  {isTemplateMessage && templateButtons.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {templateButtons.map((button, index) => (
                        <div
                          key={`${button.type}-${button.text}-${index}`}
                          className="rounded-md border border-black/15 bg-white/60 px-2 py-1 text-[10px] font-medium text-[#111b21]"
                        >
                          {button.text}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!isStatus ? (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[11px] leading-none text-[#667781]">
                      <span>{timeLabel}</span>
                      {isOutbound && deliveryStatus === 'SENT' ? <Check className="h-3 w-3" /> : null}
                      {isOutbound && deliveryStatus === 'DELIVERED' ? <CheckCheck className="h-3 w-3" /> : null}
                      {isOutbound && deliveryStatus === 'VIEWED' ? (
                        <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                      ) : null}
                      {isOutbound && deliveryStatus === 'FAILED' ? (
                        <span className="font-semibold text-[#d93025]">!</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!historyLoading && messages.length === 0 ? (
              <div className="mx-auto mt-3 w-fit rounded-md bg-white/70 px-2 py-1 text-[10px] text-[#54656f]">
                No messages yet
              </div>
            ) : null}
          </div>

          {unreadCount > 0 ? (
            <div className="pointer-events-none -mt-10 mb-1 flex justify-center">
              <button
                type="button"
                onClick={jumpToLatest}
                className="pointer-events-auto rounded-full bg-[#25D366] px-3 py-1 text-[10px] font-semibold text-white shadow"
              >
                {unreadCount} new message{unreadCount > 1 ? 's' : ''}
              </button>
            </div>
          ) : null}

          <div className="bg-[#f0f2f5] border-t border-black/10 px-2.5 py-2 space-y-2">
            {activeType !== 'text' ? (
              <div className="flex items-center justify-between rounded-md bg-white px-2 py-1 text-[10px] text-[#54656f]">
                <span>
                  Compose mode: <span className="font-semibold uppercase">{activeType}</span>
                </span>
                <button
                  type="button"
                  className="text-[#128c7e] font-semibold"
                  onClick={() => {
                    setActiveType('text');
                    setShowAttachMenu(false);
                  }}
                >
                  Back to text
                </button>
              </div>
            ) : null}

            {activeType === 'text' ? (
              <div className="relative flex items-center gap-1.5">
                <button
                  ref={attachButtonRef}
                  type="button"
                  className="text-[#54656f]"
                  onClick={() => setShowAttachMenu((prev) => !prev)}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {showAttachMenu ? (
                  <div
                    ref={attachMenuRef}
                    className="absolute bottom-12 left-0 z-20 w-[260px] rounded-xl border border-black/10 bg-white p-2 shadow-xl"
                  >
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        className="rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                        onClick={() => {
                          setActiveType('media');
                          setMediaType('image');
                          setShowAttachMenu(false);
                        }}
                      >
                        Image/Video
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                        onClick={() => {
                          setActiveType('media');
                          setMediaType('document');
                          setShowAttachMenu(false);
                        }}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                        onClick={() => {
                          setActiveType('template');
                          setShowAttachMenu(false);
                        }}
                      >
                        Template
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                        onClick={() => {
                          setActiveType('media');
                          setMediaType('document');
                          setShowAttachMenu(false);
                        }}
                      >
                        Document
                      </button>
                    </div>
                  </div>
                ) : null}
                <input
                  className="flex-1 rounded-full border border-transparent bg-white px-4 py-2 text-[12px] shadow-[inset_0_0_0_1px_rgba(17,27,33,0.06)] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!sending) void handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                />
                <button type="button" className="text-[#54656f] hover:text-[#2a3942]">
                  <Camera className="h-4 w-4" />
                </button>
                <button type="button" className="text-[#54656f] hover:text-[#2a3942]">
                  <Mic className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {activeType === 'media' ? (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <select
                    className="w-24 rounded-md border bg-white px-2 py-1 text-[11px]"
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as 'image' | 'document')}
                  >
                    <option value="document">Document</option>
                    <option value="image">Image</option>
                  </select>
                  <input
                    className="flex-1 rounded-md border bg-white px-2 py-1 text-[11px]"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://media-url"
                  />
                </div>
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption (optional)"
                />
              </div>
            ) : null}

            {activeType === 'template' ? (
              <div className="space-y-1.5">
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search template..."
                />
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-black/10 bg-white p-1.5">
                  {templatesLoading ? (
                    <div className="px-2 py-3 text-[11px] text-[#667781]">Loading templates...</div>
                  ) : null}
                  {!templatesLoading && filteredTemplateOptions.length === 0 ? (
                    <div className="px-2 py-3 text-[11px] text-[#667781]">No templates found</div>
                  ) : null}
                  {filteredTemplateOptions.map((row) => {
                    const isSelected =
                      row.template_name.trim().toLowerCase() === templateName.trim().toLowerCase();
                    const previewBody = fillTemplateBody(row, templateParams);
                    const previewImage = resolveTemplateImageUrl(row);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setTemplateName(row.template_name)}
                        className={`w-full overflow-hidden rounded-xl border text-left ${
                          isSelected ? 'border-[#25D366] ring-1 ring-[#25D366]/40' : 'border-black/10'
                        }`}
                      >
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt={row.display_name || row.template_name}
                            className="w-full h-auto max-h-28 object-cover"
                          />
                        ) : null}
                        <div className="p-2">
                          <p className="text-[11px] font-semibold text-[#111b21]">
                            {row.display_name || row.template_name}
                          </p>
                          <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[11px] leading-4 text-[#111b21]">
                            {previewBody}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-[#667781]">
                            <span>
                              {row.language_code.toUpperCase()} • {String(row.category || 'TEMPLATE').toUpperCase()}
                            </span>
                            {isSelected ? <span className="font-semibold text-[#128c7e]">Selected</span> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {templateName.trim() ? (
                  <div className="rounded-md bg-[#eafaf1] px-2 py-1 text-[10px] text-[#128c7e]">
                    Selected template: {selectedTemplate?.display_name || templateName}
                  </div>
                ) : null}
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={templateParams}
                  onChange={(e) => setTemplateParams(e.target.value)}
                  placeholder="Params comma separated"
                />
                <p className="text-[10px] text-gray-500">
                  Delivery depends on approved template and WhatsApp policy checks.
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="h-10 w-10 rounded-full inline-flex items-center justify-center text-white bg-[#25D366] hover:bg-[#1ebe5c] shadow-md disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
