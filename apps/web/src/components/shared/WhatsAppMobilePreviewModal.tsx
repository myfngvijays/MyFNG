'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, MessageCircle, Mic, Paperclip, Phone, Send, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppMobilePreviewModalProps {
  isOpen: boolean;
  phoneNumber: string;
  title?: string;
  previewMessage?: string;
  leadId?: string | null;
  onClose: () => void;
}

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
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
  const openUrl = waPhone ? `https://wa.me/${waPhone}` : '#';

  const [historyLoading, setHistoryLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeType, setActiveType] = useState<'text' | 'media' | 'template'>('text');
  const [textMessage, setTextMessage] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'document'>('document');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateParams, setTemplateParams] = useState('');
  const [sending, setSending] = useState(false);

  const composerMessage = useMemo(
    () =>
      previewMessage ||
      'Namaste! Hum aapki RSA request me assist karne ke liye available hain.',
    [previewMessage]
  );

  useEffect(() => {
    if (!isOpen || !waPhone) return;
    setHistoryLoading(true);
    fetch(`/api/whatsapp/conversation?phone=${encodeURIComponent(waPhone)}&limit=40`)
      .then((res) => res.json())
      .then((data) => setMessages(Array.isArray(data?.messages) ? data.messages : []))
      .catch(() => setMessages([]))
      .finally(() => setHistoryLoading(false));
  }, [isOpen, waPhone]);

  const refreshConversation = async () => {
    if (!waPhone) return;
    try {
      const res = await fetch(`/api/whatsapp/conversation?phone=${encodeURIComponent(waPhone)}&limit=40`);
      const data = await res.json();
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch {
      // ignore
    }
  };

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
      toast.success('WhatsApp message sent');
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
      <div className="w-full max-w-[340px] rounded-3xl bg-gray-900 p-1.5 shadow-2xl">
        <div className="rounded-[1.25rem] bg-[#efeae2] overflow-hidden border border-black/20">
          <div className="bg-[#075e54] text-white px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{title || 'Customer Chat'}</p>
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

          <div className="px-2.5 py-3 space-y-2 max-h-[46vh] overflow-y-auto bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cg fill=%22%23000000%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M20 20c0-5.5 4.5-10 10-10v20c-5.5 0-10-4.5-10-10z%22/%3E%3C/g%3E%3C/svg%3E')]">
            <div className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-xs text-gray-700 shadow">
              Hello, aap MyFNG support se connected hain.
            </div>
            {historyLoading ? <div className="text-[11px] text-gray-600">Loading chat…</div> : null}
            {messages.map((msg) => {
              const direction = String(msg?.direction || '').toUpperCase();
              const isOutbound = direction === 'OUTBOUND';
              const isStatus = direction === 'STATUS';
              const text =
                msg?.text_body ||
                (msg?.template_name ? `Template: ${msg.template_name}` : '') ||
                (msg?.media_url ? `${msg?.media_caption || 'Media'}\n${msg.media_url}` : '') ||
                msg?.status ||
                'Message';
              return (
                <div
                  key={msg.id}
                  className={`max-w-[86%] rounded-lg px-2.5 py-2 text-[11px] leading-4 shadow whitespace-pre-wrap ${
                    isStatus
                      ? 'mx-auto bg-gray-100 text-gray-600 text-center'
                      : isOutbound
                      ? 'ml-auto bg-[#dcf8c6] text-gray-800'
                      : 'bg-white text-gray-700'
                  }`}
                >
                  {text}
                </div>
              );
            })}
            {messages.length === 0 && !historyLoading ? (
              <div className="ml-auto max-w-[85%] rounded-lg bg-[#dcf8c6] px-3 py-2 text-xs text-gray-800 shadow">
                {composerMessage}
              </div>
            ) : null}
          </div>

          <div className="bg-[#f0f2f5] border-t px-2.5 py-2 space-y-2">
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
                <button type="button" className="text-gray-500">
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  className="flex-1 rounded-full border bg-white px-3 py-2 text-xs"
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="button" className="text-gray-500">
                  <Camera className="h-4 w-4" />
                </button>
                <button type="button" className="text-gray-500">
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
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                />
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={templateParams}
                  onChange={(e) => setTemplateParams(e.target.value)}
                  placeholder="Params comma separated"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white bg-[#128C7E] hover:bg-[#0f7a6e]"
              >
                Open Web
              </a>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white bg-[#25D366] hover:bg-[#1ebe5c] disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  {sending ? 'Sending...' : 'Send'}
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
