'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Check, CheckCheck, MessageCircle, Mic, Paperclip, Phone, Send, Video, X } from 'lucide-react';
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
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const composerMessage = useMemo(
    () =>
      previewMessage ||
      'Namaste! Hum aapki RSA request me assist karne ke liye available hain.',
    [previewMessage]
  );

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

  const refreshConversation = useCallback(async () => {
    if (!waPhone) return;
    try {
      const res = await fetch(`/api/whatsapp/conversation?phone=${encodeURIComponent(waPhone)}&limit=40`);
      const data = await res.json();
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch {
      // ignore
    }
  }, [waPhone]);

  useEffect(() => {
    if (!isOpen || !waPhone) return;
    let isMounted = true;

    const loadInitialConversation = async () => {
      setHistoryLoading(true);
      await refreshConversation();
      if (isMounted) setHistoryLoading(false);
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
      channel.unsubscribe();
    };
  }, [isOpen, waPhone, refreshConversation]);

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
      <div className="w-[360px] max-w-[94vw] h-[680px] max-h-[92vh] rounded-[2.25rem] bg-[#111b21] p-2 shadow-[0_22px_50px_rgba(0,0,0,0.5)]">
        <div className="h-full rounded-[1.85rem] bg-[#efeae2] overflow-hidden border border-black/30 flex flex-col">
          <div className="h-5 bg-[#111b21] flex items-center justify-center">
            <div className="h-1.5 w-20 rounded-full bg-[#2f3b43]" />
          </div>
          <div className="bg-[#005c4b] text-white px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{title || 'WhatsApp Chat'}</p>
                <p className="text-[11px] text-white/80 truncate">{phoneNumber || '—'}</p>
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

          <div className="flex-1 min-h-0 px-2.5 py-3 space-y-2 overflow-y-auto bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22%3E%3Cg fill=%22%23111b21%22 fill-opacity=%220.04%22%3E%3Ccircle cx=%2210%22 cy=%2210%22 r=%221.5%22/%3E%3Ccircle cx=%2238%22 cy=%2226%22 r=%221.5%22/%3E%3Ccircle cx=%2218%22 cy=%2248%22 r=%221.5%22/%3E%3C/g%3E%3C/svg%3E')]">
            {historyLoading ? <div className="text-[11px] text-gray-600">Loading chat...</div> : null}
            {messages.map((msg) => {
              const direction = String(msg?.direction || '').toUpperCase();
              const isOutbound = direction === 'OUTBOUND';
              const isStatus = direction === 'STATUS';
              const deliveryStatus = normalizeDeliveryStatus(msg?.status);
              const text =
                msg?.text_body ||
                (msg?.template_name ? `Template: ${msg.template_name}` : '') ||
                (msg?.media_url ? `${msg?.media_caption || 'Media'}\n${msg.media_url}` : '') ||
                msg?.status ||
                'Message';
              const timeLabel = formatMessageTime(msg?.status_at || msg?.updated_at || msg?.created_at);
              return (
                <div
                  key={msg.id}
                  className={`relative max-w-[86%] rounded-lg px-2.5 py-2 text-[11px] leading-4 shadow-sm whitespace-pre-wrap ${
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
                  <p>{text}</p>
                  {!isStatus ? (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] leading-none text-[#667781]">
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
          </div>

          <div className="bg-[#f0f2f5] border-t border-black/10 px-2.5 py-2 space-y-2">
            <div className="flex items-center gap-1">
              {(['text', 'media', 'template'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(type)}
                  className={`text-[10px] rounded-full px-2.5 py-1 border ${
                    activeType === type ? 'bg-[#25D366] text-white border-[#25D366]' : 'bg-white text-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {activeType === 'text' ? (
              <div className="flex items-center gap-1.5">
                <button type="button" className="text-[#54656f]">
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  className="flex-1 rounded-full border border-transparent bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="button" className="text-[#54656f]">
                  <Camera className="h-4 w-4" />
                </button>
                <button type="button" className="text-[#54656f]">
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
                <select
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={templatesLoading}
                >
                  <option value="">
                    {templatesLoading ? 'Loading templates...' : 'Select approved template'}
                  </option>
                  {templateOptions.map((row) => (
                    <option key={row.id} value={row.template_name}>
                      {(row.display_name || row.template_name) + ` (${row.language_code.toUpperCase()})`}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Or type template name manually"
                />
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
                className="h-9 w-9 rounded-full inline-flex items-center justify-center text-white bg-[#25D366] hover:bg-[#1ebe5c] disabled:opacity-60"
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
