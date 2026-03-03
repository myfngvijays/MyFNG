'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCheck,
  FileText,
  Info,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  PauseCircle,
  Paperclip,
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  PlayCircle,
  Send,
  Video,
  Volume2,
  VolumeX,
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

type CallRecording = {
  id: string;
  provider_recording_id?: string | null;
  duration_seconds?: number | null;
};

type CallLog = {
  id: string;
  direction: string;
  call_status: string;
  customer_phone: string;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  duration_seconds?: number | null;
  error_message?: string | null;
  recordings?: CallRecording[];
  sessions?: Array<{
    id: string;
    provider_session_id?: string | null;
    session_state?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
};

type BrowserCallOffer = {
  sdp: string;
  sdp_type: 'offer';
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

function formatMessageDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function normalizeDeliveryStatus(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}

function normalizeCallStatus(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}

function formatDuration(seconds?: number | null): string {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '—';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function resolveCallingPermissionTemplateName(rows: TemplateOption[]): string | null {
  const exact = rows.find((row) => {
    const name = String(row.template_name || '').trim().toLowerCase();
    return name === 'calling_permission' || name === 'call_permission';
  });
  if (exact) return String(exact.template_name || '').trim() || null;
  const fuzzy = rows.find((row) => {
    const name = String(row.template_name || '').trim().toLowerCase();
    return name.includes('calling_permission') || name.includes('call_permission');
  });
  return fuzzy ? String(fuzzy.template_name || '').trim() || null : null;
}

async function buildBrowserCallOffer(): Promise<BrowserCallOffer> {
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    throw new Error('Browser does not support WebRTC call offer generation');
  }
  const peer = new RTCPeerConnection();
  try {
    peer.addTransceiver('audio', { direction: 'sendrecv' });
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    await new Promise<void>((resolve) => {
      if (peer.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timeout = window.setTimeout(() => resolve(), 1500);
      const onStateChange = () => {
        if (peer.iceGatheringState === 'complete') {
          window.clearTimeout(timeout);
          peer.removeEventListener('icegatheringstatechange', onStateChange);
          resolve();
        }
      };
      peer.addEventListener('icegatheringstatechange', onStateChange);
    });
    const local = peer.localDescription;
    if (!local?.sdp) {
      throw new Error('Unable to build SDP offer for call initiation');
    }
    return { sdp: local.sdp, sdp_type: 'offer' };
  } finally {
    peer.close();
  }
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

type CallPermissionState = 'REQUESTED' | 'ACKNOWLEDGED' | 'APPROVED' | 'REJECTED' | 'PENDING' | null;

function detectCallPermissionState(input: {
  templateName?: unknown;
  isOutbound: boolean;
  text: string;
}): CallPermissionState {
  const templateName = String(input.templateName || '').trim().toLowerCase();
  const normalizedText = String(input.text || '').trim().toLowerCase();

  if (templateName.includes('calling_permission') || templateName.includes('call_permission')) {
    return 'REQUESTED';
  }

  if (input.isOutbound || !normalizedText) return null;

  if (
    /\b(approve|approved|allow|allowed|yes|haan|ok|okay|sure|consent)\b/i.test(normalizedText) &&
    /\b(call|calling|permission)\b/i.test(normalizedText)
  ) {
    return 'APPROVED';
  }
  if (/\b(reject|rejected|deny|denied|decline|declined|no)\b/i.test(normalizedText)) {
    return 'REJECTED';
  }
  if (['received'].includes(normalizedText)) {
    // "RECEIVED" is only a customer acknowledgement message, not provider-approved call permission.
    return 'ACKNOWLEDGED';
  }
  if (['delivered', 'sent', 'pending'].includes(normalizedText)) {
    return 'PENDING';
  }
  return null;
}

function callPermissionBadgeMeta(
  state: CallPermissionState
): { label: string; className: string } | null {
  if (state === 'REQUESTED') {
    return {
      label: 'Call Permission Request Sent',
      className: 'border-[#cdd5db] bg-white/80 text-[#1f2937]',
    };
  }
  if (state === 'APPROVED') {
    return {
      label: 'Call Permission Approved',
      className: 'border-[#86efac] bg-[#dcfce7] text-[#166534]',
    };
  }
  if (state === 'ACKNOWLEDGED') {
    return {
      label: 'Customer Acknowledged (Provider approval pending)',
      className: 'border-[#93c5fd] bg-[#dbeafe] text-[#1e3a8a]',
    };
  }
  if (state === 'REJECTED') {
    return {
      label: 'Call Permission Rejected',
      className: 'border-[#fecaca] bg-[#fee2e2] text-[#991b1b]',
    };
  }
  if (state === 'PENDING') {
    return {
      label: 'Call Permission Pending',
      className: 'border-[#fde68a] bg-[#fef3c7] text-[#92400e]',
    };
  }
  return null;
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

function inferMediaTypeFromFile(file: File): 'image' | 'video' | 'audio' | 'document' {
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
    const maxWidth = 1400;
    const scale = image.width > maxWidth ? maxWidth / image.width : 1;
    const targetWidth = Math.round(image.width * scale);
    const targetHeight = Math.round(image.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.78)
    );
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
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
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | 'audio'>('document');
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateParams, setTemplateParams] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [messageInfoOpen, setMessageInfoOpen] = useState<{
    id: string;
    sentAt: string | null;
    deliveredAt: string | null;
    viewedAt: string | null;
    failedReason: string | null;
  } | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [nextBeforeCreatedAt, setNextBeforeCreatedAt] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callLoading, setCallLoading] = useState(false);
  const [callActionLoading, setCallActionLoading] = useState<
    'call' | 'callback' | 'permission' | null
  >(null);
  const [callControlLoading, setCallControlLoading] = useState<string | null>(null);
  const [callInfoOpen, setCallInfoOpen] = useState<CallLog | null>(null);
  const [callPermissionCooldownUntil, setCallPermissionCooldownUntil] = useState(0);
  const [callPermissionTick, setCallPermissionTick] = useState(Date.now());
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const isAtBottomRef = useRef(true);
  const pendingPrependHeightRef = useRef<number | null>(null);
  const previousLastMessageKeyRef = useRef<string>('');
  const previousTemplateOnlyModeRef = useRef<boolean>(true);

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
  const isTemplateOnlyMode = useMemo(() => {
    const lastInbound = [...messages]
      .reverse()
      .find((row) => String(row?.direction || '').trim().toUpperCase() === 'INBOUND');
    if (!lastInbound) return true;
    const lastInboundMs = new Date(lastInbound?.created_at || lastInbound?.status_at || '').getTime();
    if (!Number.isFinite(lastInboundMs)) return true;
    return Date.now() - lastInboundMs > 24 * 60 * 60 * 1000;
  }, [messages]);
  const activeCall = useMemo(() => {
    const sorted = [...callLogs].sort((a, b) => {
      const ta = new Date(a.started_at || a.created_at || 0).getTime();
      const tb = new Date(b.started_at || b.created_at || 0).getTime();
      return tb - ta;
    });
    return (
      sorted.find((row) => {
        const status = normalizeCallStatus(row.call_status);
        return !['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(status);
      }) || sorted[0] || null
    );
  }, [callLogs]);
  const activeCallState = useMemo(() => {
    if (!activeCall) return 'IDLE';
    const sessionState = String(activeCall?.sessions?.[0]?.session_state || '').trim().toUpperCase();
    if (sessionState) return sessionState;
    return normalizeCallStatus(activeCall.call_status) || 'IDLE';
  }, [activeCall]);
  const callPermissionTemplateName = useMemo(
    () => resolveCallingPermissionTemplateName(templateOptions),
    [templateOptions]
  );
  const callPermissionCooldownLeft = Math.max(
    0,
    Math.ceil((callPermissionCooldownUntil - callPermissionTick) / 1000)
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

  useEffect(() => {
    const wasTemplateOnly = previousTemplateOnlyModeRef.current;
    previousTemplateOnlyModeRef.current = isTemplateOnlyMode;

    if (isTemplateOnlyMode) {
      setShowAttachMenu(false);
      if (activeType !== 'template') {
        setActiveType('template');
      }
      return;
    }

    // Auto-restore text mode when 24h customer care window re-opens.
    if (wasTemplateOnly && activeType === 'template') {
      setActiveType('text');
    }
  }, [isTemplateOnlyMode, activeType]);

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

  const loadCalls = useCallback(async () => {
    if (!waPhone) {
      setCallLogs([]);
      return;
    }
    setCallLoading(true);
    try {
      const params = new URLSearchParams({
        phone: waPhone,
        limit: '40',
      });
      const res = await fetch(`/api/whatsapp/calls?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load call logs');
      setCallLogs(Array.isArray(data?.calls) ? data.calls : []);
    } catch {
      setCallLogs([]);
    } finally {
      setCallLoading(false);
    }
  }, [waPhone]);

  const handleCallAction = useCallback(
    async (action: 'initiate' | 'callback_request') => {
      if (!waPhone || callActionLoading) return;
      let sessionPayload: BrowserCallOffer | null = null;
      if (action === 'initiate') {
        const proceed = window.confirm(
          'Confirm customer opt-in for WhatsApp call before placing the call.'
        );
        if (!proceed) return;
        try {
          sessionPayload = await buildBrowserCallOffer();
        } catch (error: any) {
          toast.error(error?.message || 'Failed to prepare call session');
          return;
        }
      }
      setCallActionLoading(action === 'initiate' ? 'call' : 'callback');
      try {
        const res = await fetch('/api/whatsapp/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            recipient_phone: waPhone,
            customer_call_opt_in: action === 'initiate',
            ...(action === 'initiate' ? { consent_granted_at: new Date().toISOString() } : {}),
            ...(action === 'initiate' && sessionPayload ? { session: sessionPayload } : {}),
            reason:
              action === 'initiate'
                ? 'Call initiated from WhatsApp preview'
                : 'Callback requested from WhatsApp preview',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          const errorMessage = String(data?.error || 'Call action failed');
          const details = String(data?.provider_error_details || '').trim();
          const traceId = String(data?.provider_trace_id || '').trim();
          const canSendPermission =
            data?.can_send_permission_request == null
              ? null
              : Boolean(data.can_send_permission_request);
          const permissionLimits = Array.isArray(data?.permission_actions)
            ? data.permission_actions
                .flatMap((item: any) => (Array.isArray(item?.limits) ? item.limits : []))
                .map((limit: any) => {
                  const period = String(limit?.time_period || '').trim();
                  const current = Number(limit?.current_usage ?? NaN);
                  const maxAllowed = Number(limit?.max_allowed ?? NaN);
                  if (!period || !Number.isFinite(current) || !Number.isFinite(maxAllowed)) return '';
                  return `${period}: ${current}/${maxAllowed}`;
                })
                .filter(Boolean)
            : [];
          const steps = Array.isArray(data?.next_steps)
            ? data.next_steps.map((v: any) => String(v).trim()).filter(Boolean)
            : [];
          const uiMessage = [
            errorMessage,
            details,
            traceId ? `Trace ID: ${traceId}` : '',
            canSendPermission === false
              ? 'Permission request quota reached for now. Please wait for reset window.'
              : '',
            permissionLimits.length > 0 ? `Permission limits: ${permissionLimits.join(', ')}` : '',
            ...steps,
          ]
            .filter(Boolean)
            .join('\n');
          toast.error(uiMessage || 'Call action failed');
          return;
        }
        toast.success(action === 'initiate' ? 'Call request submitted' : 'Callback request submitted');
        await loadCalls();
      } catch {
        toast.error('Call action failed');
      } finally {
        setCallActionLoading(null);
      }
    },
    [callActionLoading, loadCalls, waPhone]
  );

  const handleSendFreshPermissionRequest = useCallback(async () => {
    if (!waPhone || callActionLoading) return;
    if (callPermissionCooldownLeft > 0) {
      toast.error(`Please wait ${callPermissionCooldownLeft}s before sending another permission request.`);
      return;
    }
    if (!callPermissionTemplateName) {
      toast.error('No active calling-permission template found. Please sync templates first.');
      return;
    }
    setCallActionLoading('permission');
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone: waPhone,
          message_type: 'template',
          template_name: callPermissionTemplateName,
          template_params: [],
          language: 'en',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(String(data?.error || 'Failed to send call permission request'));
        return;
      }
      setCallPermissionCooldownUntil(Date.now() + 60 * 1000);
      setCallPermissionTick(Date.now());
      toast.success('Fresh call permission request sent. Ask customer to approve in WhatsApp.');
      await refreshConversation();
    } catch {
      toast.error('Failed to send call permission request');
    } finally {
      setCallActionLoading(null);
    }
  }, [
    callActionLoading,
    callPermissionCooldownLeft,
    callPermissionTemplateName,
    refreshConversation,
    waPhone,
  ]);

  const handleCallControl = useCallback(
    async (action: 'hangup' | 'hold' | 'resume' | 'mute' | 'unmute') => {
      if (!activeCall?.id || callControlLoading) return;
      setCallControlLoading(action);
      try {
        const res = await fetch(`/api/whatsapp/calls/${encodeURIComponent(activeCall.id)}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          toast.error(data?.error || 'Call control failed');
          return;
        }
        await loadCalls();
      } catch {
        toast.error('Call control failed');
      } finally {
        setCallControlLoading(null);
      }
    },
    [activeCall?.id, callControlLoading, loadCalls]
  );

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
    void loadCalls();

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_call_logs' },
        (payload) => {
          const row: any = payload.new || payload.old || {};
          const phone = normalizePhone(String(row?.customer_phone || ''));
          if (phone === waPhone) {
            void loadCalls();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_call_sessions' },
        () => {
          void loadCalls();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_call_control_audit' },
        () => {
          void loadCalls();
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
  }, [isOpen, waPhone, fetchConversationPage, loadCalls, refreshConversation]);

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

  useEffect(() => {
    if (callPermissionCooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => {
      setCallPermissionTick(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callPermissionCooldownUntil]);

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
      if (!selectedMediaFile) {
        toast.error('Please choose media file');
        return;
      }
      payload = {
        ...payload,
        media_type: mediaType,
        caption: caption.trim() || undefined,
        filename: selectedMediaFile?.name || undefined,
        media_mime_type: selectedMediaFile?.type || undefined,
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
      const isMediaWithFile = activeType === 'media' && selectedMediaFile;
      const uploadFile =
        isMediaWithFile && selectedMediaFile
          ? await compressImageIfNeeded(selectedMediaFile)
          : selectedMediaFile;
      const reqBody = (() => {
        if (!isMediaWithFile) {
          return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
        }
        const form = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (Array.isArray(value)) {
            form.append(key, value.join(','));
            return;
          }
          form.append(key, String(value));
        });
        form.append('file', uploadFile as File);
        return { headers: undefined as any, body: form };
      })();

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: reqBody.headers,
        body: reqBody.body,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        await refreshConversation();
        toast.error(data?.error || 'Send failed');
        return;
      }
      setTextMessage('');
      setCaption('');
      setSelectedMediaFile(null);
      setShowAttachMenu(false);
      setActiveType('text');
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
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/80">
                  Call state: {activeCallState}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Voice call"
                disabled={callActionLoading !== null}
                onClick={() => void handleCallAction('initiate')}
                title="Start WhatsApp call (opt-in required)"
              >
                {callActionLoading === 'call' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Phone className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Request callback"
                disabled={callActionLoading !== null}
                onClick={() => void handleCallAction('callback_request')}
                title="Request callback"
              >
                {callActionLoading === 'callback' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Video className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Send fresh call permission request"
                disabled={callActionLoading !== null || callPermissionCooldownLeft > 0}
                onClick={() => void handleSendFreshPermissionRequest()}
                title={
                  callPermissionCooldownLeft > 0
                    ? `Retry permission request in ${callPermissionCooldownLeft}s`
                    : 'Send fresh call permission request'
                }
              >
                {callActionLoading === 'permission' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Hangup call"
                disabled={!activeCall || callControlLoading !== null}
                onClick={() => void handleCallControl('hangup')}
                title="Hangup"
              >
                {callControlLoading === 'hangup' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PhoneOff className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Hold call"
                disabled={!activeCall || callControlLoading !== null}
                onClick={() => void handleCallControl('hold')}
                title="Hold"
              >
                {callControlLoading === 'hold' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PauseCircle className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Resume call"
                disabled={!activeCall || callControlLoading !== null}
                onClick={() => void handleCallControl('resume')}
                title="Resume"
              >
                {callControlLoading === 'resume' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Mute call"
                disabled={!activeCall || callControlLoading !== null}
                onClick={() => void handleCallControl('mute')}
                title="Mute"
              >
                {callControlLoading === 'mute' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10 disabled:opacity-60"
                aria-label="Unmute call"
                disabled={!activeCall || callControlLoading !== null}
                onClick={() => void handleCallControl('unmute')}
                title="Unmute"
              >
                {callControlLoading === 'unmute' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
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
            {callLoading ? (
              <div className="mx-auto w-fit rounded-full bg-[#d9dfe3] px-2.5 py-1 text-[10px] text-[#54656f]">
                Loading call logs...
              </div>
            ) : null}
            {callLogs
              .slice()
              .sort((a, b) => {
                const ta = new Date(a.started_at || a.created_at || 0).getTime();
                const tb = new Date(b.started_at || b.created_at || 0).getTime();
                return ta - tb;
              })
              .map((call) => {
                const inbound = String(call.direction || '').toUpperCase() === 'INBOUND';
                const isCallback = String(call.direction || '').toUpperCase().includes('CALLBACK');
                return (
                  <button
                    key={`call-${call.id}`}
                    type="button"
                    onClick={() => setCallInfoOpen(call)}
                    className="mx-auto mb-1 block rounded-full border border-[#d8dee3] bg-white/90 px-2.5 py-1 text-[10px] text-[#54656f] hover:bg-white"
                  >
                    <span className="inline-flex items-center gap-1">
                      {inbound ? (
                        <PhoneIncoming className="h-3 w-3 text-[#1d4ed8]" />
                      ) : (
                        <PhoneOutgoing className="h-3 w-3 text-[#0f766e]" />
                      )}
                      <span>
                        {isCallback ? 'Callback' : 'Call'} {normalizeCallStatus(call.call_status)} ·{' '}
                        {formatMessageTime(call.started_at || call.created_at || null)}
                      </span>
                    </span>
                  </button>
                );
              })}
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
              const messageKey = String(msg?.id || msg?.provider_message_id || '');
              const currentTemplate = msg?.template_name
                ? templateMap.get(String(msg.template_name || '').trim().toLowerCase()) || null
                : null;
              const templateText = currentTemplate
                ? fillTemplateBodyFromArray(currentTemplate, msg?.payload?.request?.template_params)
                : '';
              const templateButtons = isTemplateMessage ? extractTemplateButtons(currentTemplate) : [];
              const templateDisplayName =
                currentTemplate?.display_name || currentTemplate?.template_name || msg?.template_name || '';
              const actorName = String(msg?.meta?.actor_name || '').trim();
              const statusTimestamps =
                msg?.meta?.status_timestamps && typeof msg.meta.status_timestamps === 'object'
                  ? msg.meta.status_timestamps
                  : {};
              const sentAtRaw = String(
                statusTimestamps?.sent_at || msg?.created_at || msg?.status_at || ''
              ).trim();
              const deliveredAtRaw = String(
                statusTimestamps?.delivered_at ||
                  ((deliveryStatus === 'DELIVERED' || deliveryStatus === 'VIEWED') ? msg?.status_at : '') ||
                  ''
              ).trim();
              const viewedAtRaw = String(
                statusTimestamps?.viewed_at || (deliveryStatus === 'VIEWED' ? msg?.status_at : '') || ''
              ).trim();
              const failedReason =
                deliveryStatus === 'FAILED'
                  ? String(
                      msg?.error_message ||
                        msg?.payload?.response?.error?.error_user_msg ||
                        msg?.payload?.response?.error?.message ||
                        ''
                    ).trim()
                  : '';
              const text =
                inboundText ||
                (msg?.template_name
                  ? templateText || `Template sent: ${msg.template_name}`
                  : '') ||
                (msg?.media_url ? `${msg?.media_caption || 'Media'}\n${msg.media_url}` : '') ||
                msg?.status ||
                'Message';
              const callPermissionState = detectCallPermissionState({
                templateName: msg?.template_name,
                isOutbound,
                text,
              });
              const callPermissionBadge = callPermissionBadgeMeta(callPermissionState);
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
                  {isOutbound && actorName ? (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#667781]">
                      Sent by: {actorName}
                    </p>
                  ) : null}
                  {callPermissionBadge && !isStatus ? (
                    <div
                      className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${callPermissionBadge.className}`}
                    >
                      {callPermissionBadge.label}
                    </div>
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
                          className="max-h-48 w-full cursor-zoom-in rounded-md object-cover"
                          onClick={() => setImagePreviewUrl(resolvedMediaUrl)}
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
                  {isOutbound && failedReason ? (
                    <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700">
                      Failed reason: {failedReason}
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
                      {isOutbound ? (
                        <button
                          type="button"
                          className="ml-1 inline-flex items-center text-[#667781] hover:text-[#2a3942]"
                          onClick={() =>
                            setMessageInfoOpen({
                              id: messageKey,
                              sentAt: sentAtRaw || null,
                              deliveredAt: deliveredAtRaw || null,
                              viewedAt: viewedAtRaw || null,
                              failedReason: failedReason || null,
                            })
                          }
                          aria-label="Open message info"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
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
            {isTemplateOnlyMode ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                Normal chat window closed. Only template messages can be sent.
              </div>
            ) : null}
            {activeType !== 'text' ? (
              <div className="flex items-center justify-between rounded-md bg-white px-2 py-1 text-[10px] text-[#54656f]">
                <span>
                  Compose mode: <span className="font-semibold uppercase">{activeType}</span>
                </span>
                {!isTemplateOnlyMode ? (
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
                ) : null}
              </div>
            ) : null}

            {activeType === 'text' && !isTemplateOnlyMode ? (
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
                          requestAnimationFrame(() => mediaFileInputRef.current?.click());
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
                          requestAnimationFrame(() => mediaFileInputRef.current?.click());
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
                          requestAnimationFrame(() => mediaFileInputRef.current?.click());
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
                <button
                  type="button"
                  className="w-full rounded-md border bg-white px-2 py-2 text-left text-[11px] text-[#54656f]"
                  onClick={() => mediaFileInputRef.current?.click()}
                >
                  {selectedMediaFile
                    ? `${selectedMediaFile.name} (${(selectedMediaFile.size / 1024 / 1024).toFixed(2)} MB)`
                    : 'Choose media from device'}
                </button>
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption (optional)"
                />
                <p className="text-[10px] text-gray-500">
                  Image files are auto-compressed before upload for faster delivery.
                </p>
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

            <input
              ref={mediaFileInputRef}
              type="file"
              className="hidden"
              accept={
                mediaType === 'image'
                  ? 'image/*,video/*'
                  : mediaType === 'audio'
                  ? 'audio/*'
                  : mediaType === 'video'
                  ? 'video/*'
                  : '.pdf,.doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx,application/*'
              }
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (!file) return;
                const inferred = inferMediaTypeFromFile(file);
                setSelectedMediaFile(file);
                setMediaType(inferred);
                setActiveType('media');
                e.currentTarget.value = '';
              }}
            />

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
      {imagePreviewUrl ? (
        <div
          className="fixed inset-0 z-[7100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setImagePreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            onClick={() => setImagePreviewUrl(null)}
            aria-label="Close image preview"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={imagePreviewUrl}
            alt="Image preview"
            className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
      {callInfoOpen ? (
        <div
          className="fixed inset-0 z-[7140] flex items-end justify-center bg-black/45 p-3"
          onClick={() => setCallInfoOpen(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#111b21]">Call info</p>
              <button
                type="button"
                className="text-xs font-semibold text-[#128c7e]"
                onClick={() => setCallInfoOpen(null)}
              >
                Close
              </button>
            </div>
            <div className="space-y-2 rounded-xl bg-[#f7f8fa] p-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Direction</span>
                <span className="text-[#111b21]">{callInfoOpen.direction || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Status</span>
                <span className="text-[#111b21]">{callInfoOpen.call_status || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Session state</span>
                <span className="text-[#111b21]">
                  {String(callInfoOpen?.sessions?.[0]?.session_state || '—').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Session id</span>
                <span className="text-[#111b21]">
                  {callInfoOpen?.sessions?.[0]?.provider_session_id || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Started</span>
                <span className="text-[#111b21]">
                  {formatMessageDateTime(callInfoOpen.started_at || callInfoOpen.created_at || null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Ended</span>
                <span className="text-[#111b21]">
                  {formatMessageDateTime(callInfoOpen.ended_at || null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#3b4a54]">Duration</span>
                <span className="text-[#111b21]">{formatDuration(callInfoOpen.duration_seconds)}</span>
              </div>
              {callInfoOpen.error_message ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                  Error: {callInfoOpen.error_message}
                </div>
              ) : null}
              {(callInfoOpen.recordings || []).length > 0 ? (
                <div className="rounded-md border border-black/10 bg-white px-2 py-1.5">
                  <p className="mb-1 text-[11px] font-semibold text-[#111b21]">Recordings</p>
                  <div className="space-y-1">
                    {(callInfoOpen.recordings || []).map((rec) => (
                      <a
                        key={rec.id}
                        href={`/api/whatsapp/calls/recordings/${rec.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[11px] font-medium text-[#128c7e] underline"
                      >
                        Recording {rec.provider_recording_id || rec.id} ({formatDuration(rec.duration_seconds)})
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {messageInfoOpen ? (
        <div
          className="fixed inset-0 z-[7150] flex items-end justify-center bg-black/45 p-3"
          onClick={() => setMessageInfoOpen(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#111b21]">Message info</p>
              <button
                type="button"
                className="text-xs font-semibold text-[#128c7e]"
                onClick={() => setMessageInfoOpen(null)}
              >
                Close
              </button>
            </div>
            <div className="space-y-2 rounded-xl bg-[#f7f8fa] p-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[#3b4a54]">
                  <Check className="h-3.5 w-3.5" /> Sent
                </span>
                <span className="text-[#111b21]">
                  {formatMessageDateTime(messageInfoOpen.sentAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[#3b4a54]">
                  <CheckCheck className="h-3.5 w-3.5" /> Delivered
                </span>
                <span className="text-[#111b21]">
                  {formatMessageDateTime(messageInfoOpen.deliveredAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[#3b4a54]">
                  <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" /> Read
                </span>
                <span className="text-[#111b21]">
                  {formatMessageDateTime(messageInfoOpen.viewedAt)}
                </span>
              </div>
              {messageInfoOpen.failedReason ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                  Failed: {messageInfoOpen.failedReason}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
