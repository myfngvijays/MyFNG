'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, MessageSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';

type MessageType = 'text' | 'media' | 'template';

interface SendWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNumber?: string;
  defaultPhone?: string;
  defaultCustomerName?: string;
  invoiceId?: string;
  onSuccess?: () => void;
}

export default function SendWhatsAppModal({
  isOpen,
  onClose,
  leadId,
  leadNumber,
  defaultPhone,
  defaultCustomerName,
  invoiceId,
  onSuccess,
}: SendWhatsAppModalProps) {
  const [recipientPhone, setRecipientPhone] = useState(defaultPhone || '');
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [textMessage, setTextMessage] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'document'>('document');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [filename, setFilename] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [templateParamsRaw, setTemplateParamsRaw] = useState('');
  const [sending, setSending] = useState(false);

  const templateParams = useMemo(
    () =>
      templateParamsRaw
        .split('\n')
        .flatMap((line) => line.split(','))
        .map((v) => v.trim())
        .filter(Boolean),
    [templateParamsRaw]
  );

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!recipientPhone.trim()) {
      toast.error('Recipient phone is required');
      return;
    }

    if (messageType === 'text' && !textMessage.trim()) {
      toast.error('Text message is required');
      return;
    }
    if (messageType === 'media' && !mediaUrl.trim()) {
      toast.error('Media URL is required');
      return;
    }
    if (messageType === 'template' && !templateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    const payload: Record<string, unknown> = {
      lead_id: leadId,
      recipient_phone: recipientPhone.trim(),
      message_type: messageType,
      invoice_id: invoiceId || undefined,
    };

    if (messageType === 'text') {
      payload.text = textMessage.trim();
    } else if (messageType === 'media') {
      payload.media_type = mediaType;
      payload.media_url = mediaUrl.trim();
      payload.caption = caption.trim() || undefined;
      payload.filename = filename.trim() || undefined;
    } else {
      payload.template_name = templateName.trim();
      payload.language = templateLanguage.trim() || 'en';
      payload.template_params = templateParams;
    }

    setSending(true);
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        toast.error(data?.error || 'Failed to send WhatsApp message');
        return;
      }

      toast.success('WhatsApp message sent successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to send WhatsApp message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl">
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Send WhatsApp Message</h2>
            <p className="text-gray-600 mt-1">
              {leadNumber ? `Lead ${leadNumber}` : 'Lead communication'}{defaultCustomerName ? ` • ${defaultCustomerName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={sending}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Phone</label>
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="10-digit mobile or country code format"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['text', 'media', 'template'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMessageType(type)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                    messageType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {messageType === 'text' && (
            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <textarea
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg h-28"
                placeholder="Type normal WhatsApp message..."
              />
            </div>
          )}

          {messageType === 'media' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Media Type</label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as 'image' | 'document')}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="document">Document</option>
                  <option value="image">Image</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Media URL</label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://example.com/file.pdf"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Caption (optional)</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-24"
                />
              </div>

              {mediaType === 'document' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Filename (optional)</label>
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Invoice-123.pdf"
                  />
                </div>
              )}
            </div>
          )}

          {messageType === 'template' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="approved_template_name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Language Code</label>
                <input
                  type="text"
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="en"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Template Params</label>
                <textarea
                  value={templateParamsRaw}
                  onChange={(e) => setTemplateParamsRaw(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-24"
                  placeholder="Param1, Param2 or one per line"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Send WhatsApp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
