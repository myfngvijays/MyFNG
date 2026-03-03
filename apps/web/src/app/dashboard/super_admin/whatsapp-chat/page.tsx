'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  MessageSquare,
  PauseCircle,
  PhoneOff,
  RefreshCw,
  Search,
  Check,
  CheckCheck,
  PlayCircle,
  Send,
  Paperclip,
  X,
  Info,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type ChatItem = {
  phone: string;
  last_message_preview: string;
  last_message_type: string | null;
  last_direction: string | null;
  last_status: string | null;
  last_message_at: string | null;
};

type ChatSection = 'all' | 'open' | 'closed' | 'unread';

type TemplateOption = {
  template_name: string;
  display_name: string | null;
  body_text?: string | null;
  example_values?: string[];
  meta?: Record<string, any> | null;
};

type ConversationMessage = {
  id: string;
  provider_message_id?: string | null;
  direction: string | null;
  message_type: string | null;
  text_body: string | null;
  media_caption: string | null;
  template_name: string | null;
  payload?: Record<string, any> | null;
  meta?: Record<string, any> | null;
  status_at?: string | null;
  updated_at?: string | null;
  error_message?: string | null;
  created_at: string | null;
  status: string | null;
};

type CallRecording = {
  id: string;
  provider_recording_id?: string | null;
  duration_seconds?: number | null;
  recording_proxy_path?: string | null;
  recording_url?: string | null;
};

type CallLog = {
  id: string;
  provider_call_id?: string | null;
  direction: string;
  call_status: string;
  customer_phone: string;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  duration_seconds?: number | null;
  callback_requested?: boolean;
  error_message?: string | null;
  meta?: Record<string, any> | null;
  recordings?: CallRecording[];
  sessions?: Array<{
    id: string;
    provider_session_id?: string | null;
    session_state?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
};

type AttachmentKind = 'image' | 'video' | 'audio' | 'document';
type ComposerMode = 'text' | 'template';
type BrowserCallOffer = {
  sdp: string;
  sdp_type: 'offer';
};
type BrowserCallAnswer = {
  sdp: string;
  sdp_type: 'answer';
};

function formatPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function fillTemplateBodyFromArray(template?: TemplateOption | null, paramsInput?: unknown): string {
  const body = String(template?.body_text || '').trim();
  if (!body) return '';
  const params = Array.isArray(paramsInput) ? paramsInput.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
  const fallback = Array.isArray(template?.example_values) ? template!.example_values : [];
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, idxRaw: string) => {
    const idx = Math.max(0, Number(idxRaw) - 1);
    return params[idx] || fallback[idx] || `{{${idxRaw}}}`;
  });
}

function extractTemplateButtons(template?: TemplateOption | null): Array<{ text: string; type: string }> {
  if (!template?.meta || typeof template.meta !== 'object') return [];
  const components = Array.isArray((template.meta as any)?.raw?.components)
    ? (template.meta as any).raw.components
    : [];
  const buttonsComponent = components.find((component: any) => String(component?.type || '').toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : [];
  return buttons
    .map((button: any) => ({
      text: String(button?.text || '').trim(),
      type: String(button?.type || '').trim().toUpperCase(),
    }))
    .filter((button: { text: string; type: string }) => Boolean(button.text));
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

function normalizeCallStatus(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}

function isInboundCallDirection(direction: unknown): boolean {
  const dir = String(direction || '').trim().toUpperCase();
  return ['INBOUND', 'USER_INITIATED', 'CUSTOMER_INITIATED'].includes(dir);
}

function isIncomingRingingState(direction: unknown, status: unknown): boolean {
  const state = String(status || '').trim().toUpperCase();
  if (!isInboundCallDirection(direction)) return false;
  return ['INITIATED', 'RINGING', 'NEGOTIATING', 'ACCEPTED', 'CONNECTED'].includes(state);
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

async function buildBrowserCallAnswer(remoteOfferSdp: string): Promise<BrowserCallAnswer> {
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    throw new Error('Browser does not support WebRTC call answer generation');
  }
  const rawOffer = String(remoteOfferSdp || '').trim();
  const offerSdp = rawOffer
    // Provider can return escaped newlines; normalize to RFC-compliant CRLF lines.
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line))
    // Some provider payloads include malformed ssrc attributes that browsers reject.
    .filter((line) => !/^a=ssrc:[^\s]+\s+cname:/i.test(line))
    .join('\r\n')
    .concat('\r\n');
  if (!offerSdp) {
    throw new Error('Incoming call offer SDP is missing');
  }

  const peer = new RTCPeerConnection();
  try {
    await peer.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
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
      throw new Error('Unable to build SDP answer for incoming call');
    }
    return { sdp: local.sdp, sdp_type: 'answer' };
  } finally {
    peer.close();
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
    // "RECEIVED" means customer acknowledged the message, not call approval at provider level.
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
      className: 'border-[#cdd5db] bg-white/70 text-[#1f2937]',
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

function inferMediaTypeFromFile(file: File): 'image' | 'video' | 'audio' | 'document' {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';

  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|heic|heif)$/i.test(name)) return 'image';
  if (/\.(mp4|mov|avi|mkv|webm|3gp)$/i.test(name)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(name)) return 'audio';
  return 'document';
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });

  try {
    const src = await readAsDataUrl();
    const img = await loadImage(src);
    const maxWidth = 1400;
    const needsResize = img.width > maxWidth;
    const targetWidth = needsResize ? maxWidth : img.width;
    const targetHeight = Math.max(1, Math.round((img.height / img.width) * targetWidth));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function SuperAdminWhatsAppChatPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callLoading, setCallLoading] = useState(false);
  const [callActionLoading, setCallActionLoading] = useState<
    'call' | 'callback' | 'permission' | null
  >(null);
  const [callControlLoading, setCallControlLoading] = useState<string | null>(null);
  const [callInfoOpen, setCallInfoOpen] = useState<CallLog | null>(null);
  const [incomingPopup, setIncomingPopup] = useState<{
    callId: string;
    phone: string;
    status: string;
  } | null>(null);
  const [callPermissionCooldownUntil, setCallPermissionCooldownUntil] = useState(0);
  const [callPermissionTick, setCallPermissionTick] = useState(Date.now());
  const [draftMessage, setDraftMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachmentAccept, setAttachmentAccept] = useState<string>('*/*');
  const [composerMode, setComposerMode] = useState<ComposerMode>('text');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateParamsDraft, setTemplateParamsDraft] = useState('');
  const [activeSection, setActiveSection] = useState<ChatSection>('all');
  const [unreadByPhone, setUnreadByPhone] = useState<Record<string, number>>({});
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [messageInfoOpen, setMessageInfoOpen] = useState<{
    id: string;
    sentAt: string | null;
    deliveredAt: string | null;
    viewedAt: string | null;
    failedReason: string | null;
  } | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedPhoneRef = useRef('');

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  const loadChats = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        params.set('limit', '500');
        params.set('scan', '10000');
        if (search.trim()) params.set('search', search.trim());

        const res = await fetch(`/api/whatsapp/chats?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load chats');

        const list = Array.isArray(data?.chats) ? data.chats : [];
        setChats(list);
        setSelectedPhone((prev) => {
          if (prev && list.some((chat: ChatItem) => chat.phone === prev)) return prev;
          return list[0]?.phone || '';
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to load chats');
        setChats([]);
        setSelectedPhone('');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search]
  );

  const loadConversation = useCallback(async (phone: string) => {
    if (!phone) {
      setConversation([]);
      return;
    }
    setConversationLoading(true);
    setConversationError('');
    try {
      const params = new URLSearchParams();
      params.set('phone', phone);
      params.set('limit', '80');
      const res = await fetch(`/api/whatsapp/conversation?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load conversation');
      setConversation(Array.isArray(data?.messages) ? data.messages : []);
    } catch (e: any) {
      setConversationError(e?.message || 'Failed to load conversation');
      setConversation([]);
    } finally {
      setConversationLoading(false);
    }
  }, []);

  const loadCalls = useCallback(async (phone: string) => {
    if (!phone) {
      setCallLogs([]);
      return;
    }
    setCallLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('phone', phone);
      params.set('limit', '50');
      const res = await fetch(`/api/whatsapp/calls?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load call logs');
      setCallLogs(Array.isArray(data?.calls) ? data.calls : []);
    } catch {
      setCallLogs([]);
    } finally {
      setCallLoading(false);
    }
  }, []);

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
  const isIncomingActiveCall = useMemo(() => {
    if (!activeCall) return false;
    if (!isInboundCallDirection(activeCall.direction)) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    return !['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state);
  }, [activeCall, activeCallState]);
  const canAnswerIncomingCall = useMemo(() => {
    if (!isIncomingActiveCall) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    return ['RINGING', 'INITIATED', 'NEGOTIATING'].includes(state);
  }, [activeCallState, isIncomingActiveCall]);
  const callPermissionTemplateName = useMemo(
    () => resolveCallingPermissionTemplateName(templateOptions),
    [templateOptions]
  );
  const callPermissionCooldownLeft = Math.max(
    0,
    Math.ceil((callPermissionCooldownUntil - callPermissionTick) / 1000)
  );

  useEffect(() => {
    loadChats(false);
  }, [loadChats]);

  useEffect(() => {
    fetch('/api/whatsapp/templates')
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.templates) ? data.templates : [];
        setTemplateOptions(rows);
      })
      .catch(() => setTemplateOptions([]));
  }, []);

  useEffect(() => {
    if (!selectedPhone) return;
    setUnreadByPhone((prev) => ({ ...prev, [selectedPhone]: 0 }));
    loadConversation(selectedPhone);
    loadCalls(selectedPhone);
  }, [selectedPhone, loadConversation, loadCalls]);

  useEffect(() => {
    if (callPermissionCooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => {
      setCallPermissionTick(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callPermissionCooldownUntil]);

  useEffect(() => {
    const channel = supabase
      .channel('super-admin-whatsapp-chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const row = payload.new as any;
          const direction = String(row?.direction || '').toUpperCase();
          const sender = String(row?.sender_phone || '');
          const recipient = String(row?.recipient_phone || '');
          const phone = direction === 'INBOUND' ? sender : recipient;
          if (!phone) return;

          const nextItem: ChatItem = {
            phone,
            last_message_preview:
              String(row?.text_body || '').trim() ||
              String(row?.media_caption || '').trim() ||
              (row?.template_name ? `Template: ${String(row.template_name)}` : 'Message'),
            last_message_type: row?.message_type || null,
            last_direction: row?.direction || null,
            last_status: row?.status || null,
            last_message_at: row?.created_at || null,
          };

          setChats((prev) => {
            const without = prev.filter((c) => c.phone !== phone);
            return [nextItem, ...without];
          });

          const selected = selectedPhoneRef.current;
          if (selected === phone) {
            void loadConversation(phone);
            void loadCalls(phone);
            setUnreadByPhone((prev) => ({ ...prev, [phone]: 0 }));
          } else if (direction === 'INBOUND') {
            setUnreadByPhone((prev) => ({ ...prev, [phone]: (prev[phone] || 0) + 1 }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_call_logs' },
        (payload) => {
          const row = payload.new as any;
          const phone = normalizePhone(String(row?.customer_phone || ''));
          if (!phone) return;
          const rowId = String(row?.id || '').trim();
          const callStatus = normalizeCallStatus(String(row?.call_status || ''));
          const inboundActive = isIncomingRingingState(row?.direction, callStatus);

          const nextCallChatItem: ChatItem = {
            phone,
            last_message_preview:
              inboundActive
                ? `Incoming call: ${callStatus}`
                : `Call ${String(callStatus || 'UPDATED').toLowerCase()}`,
            last_message_type: 'CALL',
            last_direction: String(row?.direction || '').toUpperCase() || null,
            last_status: callStatus || null,
            last_message_at: String(row?.started_at || row?.created_at || '').trim() || null,
          };

          setChats((prev) => {
            const without = prev.filter((c) => c.phone !== phone);
            return [nextCallChatItem, ...without];
          });

          if (selectedPhoneRef.current === phone) {
            void loadCalls(phone);
            if (inboundActive) {
              setUnreadByPhone((prev) => ({ ...prev, [phone]: (prev[phone] || 0) + 1 }));
            }
          } else if (inboundActive) {
            setUnreadByPhone((prev) => ({ ...prev, [phone]: (prev[phone] || 0) + 1 }));
            setSelectedPhone(phone);
          }

          if (inboundActive && rowId) {
            setIncomingPopup((prev) => {
              if (prev && prev.callId === rowId && prev.status === callStatus && prev.phone === phone) {
                return prev;
              }
              return { callId: rowId, phone, status: callStatus };
            });
          } else if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus)) {
            setIncomingPopup((prev) => {
              if (!prev) return prev;
              if ((rowId && prev.callId === rowId) || prev.phone === phone) return null;
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_call_sessions' },
        () => {
          const phone = selectedPhoneRef.current;
          if (phone) void loadCalls(phone);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_call_control_audit' },
        () => {
          const phone = selectedPhoneRef.current;
          if (phone) void loadCalls(phone);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCalls, loadConversation, supabase]);

  useEffect(() => {
    if (!showAttachMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (attachMenuRef.current?.contains(target)) return;
      if (attachButtonRef.current?.contains(target)) return;
      setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [showAttachMenu]);

  const openAttachmentPicker = useCallback(
    (kind: AttachmentKind) => {
      if (!selectedPhone || sendingMessage) return;
      const acceptByType: Record<AttachmentKind, string> = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/*',
      };
      setComposerMode('text');
      setAttachmentAccept(acceptByType[kind]);
      setShowAttachMenu(false);
      requestAnimationFrame(() => mediaInputRef.current?.click());
    },
    [selectedPhone, sendingMessage]
  );

  const openTemplateComposer = useCallback(() => {
    if (!selectedPhone || sendingMessage) return;
    setShowAttachMenu(false);
    setComposerMode('template');
    setSelectedMediaFile(null);
    if (!selectedTemplateName && templateOptions.length > 0) {
      setSelectedTemplateName(String(templateOptions[0]?.template_name || '').trim());
    }
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  }, [selectedPhone, selectedTemplateName, sendingMessage, templateOptions]);

  const handleCallAction = useCallback(
    async (action: 'initiate' | 'callback_request') => {
      if (!selectedPhone || callActionLoading) return;
      let sessionPayload: BrowserCallOffer | null = null;
      if (action === 'initiate') {
        const ok = window.confirm(
          'Confirm customer opt-in for WhatsApp call before proceeding. Continue?'
        );
        if (!ok) return;
        try {
          sessionPayload = await buildBrowserCallOffer();
        } catch (error: any) {
          setConversationError(error?.message || 'Failed to prepare call session');
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
            recipient_phone: selectedPhone,
            customer_call_opt_in: action === 'initiate',
            ...(action === 'initiate' ? { consent_granted_at: new Date().toISOString() } : {}),
            ...(action === 'initiate' && sessionPayload ? { session: sessionPayload } : {}),
            reason:
              action === 'initiate'
                ? 'Conversation escalation from dashboard chat'
                : 'Customer requested callback from dashboard chat',
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
          setConversationError(
            [
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
              .join(' ')
          );
          return;
        }
        await loadCalls(selectedPhone);
      } catch {
        setConversationError('Call action failed');
      } finally {
        setCallActionLoading(null);
      }
    },
    [callActionLoading, loadCalls, selectedPhone]
  );

  const handleSendFreshPermissionRequest = useCallback(async () => {
    if (!selectedPhone || callActionLoading) return;
    if (callPermissionCooldownLeft > 0) {
      setConversationError(
        `Please wait ${callPermissionCooldownLeft}s before sending another permission request.`
      );
      return;
    }
    if (!callPermissionTemplateName) {
      setConversationError('No active calling-permission template found. Sync templates first.');
      return;
    }
    setCallActionLoading('permission');
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone: selectedPhone,
          message_type: 'template',
          template_name: callPermissionTemplateName,
          template_params: [],
          language: 'en',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setConversationError(String(data?.error || 'Failed to send call permission request'));
        return;
      }
      setCallPermissionCooldownUntil(Date.now() + 60 * 1000);
      setCallPermissionTick(Date.now());
      setConversationError(
        'Fresh call permission request sent. Ask the customer to approve in WhatsApp, then retry call after ~60s.'
      );
      await loadConversation(selectedPhone);
    } catch {
      setConversationError('Failed to send call permission request');
    } finally {
      setCallActionLoading(null);
    }
  }, [
    callActionLoading,
    callPermissionCooldownLeft,
    callPermissionTemplateName,
    loadConversation,
    selectedPhone,
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
          setConversationError(data?.error || 'Call control failed');
          return;
        }
        if (selectedPhone) await loadCalls(selectedPhone);
      } catch {
        setConversationError('Call control failed');
      } finally {
        setCallControlLoading(null);
      }
    },
    [activeCall?.id, callControlLoading, loadCalls, selectedPhone]
  );

  const handleIncomingPopupAction = useCallback(
    async (action: 'hangup') => {
      if (!incomingPopup?.callId || callControlLoading) return;
      setCallControlLoading(action);
      try {
        const popupPhone = incomingPopup.phone;
        if (popupPhone && selectedPhoneRef.current !== popupPhone) {
          setSelectedPhone(popupPhone);
        }

        const res = await fetch(
          `/api/whatsapp/calls/${encodeURIComponent(incomingPopup.callId)}/control`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          setConversationError(data?.error || 'Incoming call control failed');
          return;
        }
        if (popupPhone) {
          await loadCalls(popupPhone);
        } else if (selectedPhoneRef.current) {
          await loadCalls(selectedPhoneRef.current);
        }
        setIncomingPopup(null);
      } catch {
        setConversationError('Incoming call control failed');
      } finally {
        setCallControlLoading(null);
      }
    },
    [callControlLoading, incomingPopup, loadCalls]
  );

  const handleAcceptIncomingCall = useCallback(
    async (targetCallId?: string | null, targetPhone?: string | null) => {
      const callId = String(targetCallId || activeCall?.id || '').trim();
      if (!callId || callControlLoading) return;
      setCallControlLoading('resume');
      setConversationError('');

      try {
        const attemptControlResume = async (): Promise<{ ok: boolean; error?: string }> => {
          const controlRes = await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resume' }),
          });
          const controlData = await controlRes.json().catch(() => ({}));
          if (!controlRes.ok || !controlData?.success) {
            return { ok: false, error: String(controlData?.error || 'Control resume failed') };
          }
          return { ok: true };
        };

        const sessionRes = await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/session`, {
          cache: 'no-store',
        });
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok || !sessionData?.success) {
          const fallback = await attemptControlResume();
          if (!fallback.ok) {
            setConversationError(
              String(sessionData?.error || 'Failed to fetch incoming call session') +
                ` | Fallback: ${String(fallback.error || 'resume failed')}`
            );
            return;
          }
          if (selectedPhoneRef.current) await loadCalls(selectedPhoneRef.current);
          setIncomingPopup(null);
          return;
        }

        const sessions = Array.isArray(sessionData?.sessions) ? sessionData.sessions : [];
        const offerSession = sessions.find((row: any) => String(row?.offer_sdp || '').trim());
        const phone = normalizePhone(
          String(targetPhone || selectedPhoneRef.current || activeCall?.customer_phone || '')
        );
        if (!offerSession) {
          const fallback = await attemptControlResume();
          if (!fallback.ok) {
            setConversationError(
              'Incoming offer is not available yet and fallback resume also failed: ' +
                String(fallback.error || 'resume failed')
            );
            return;
          }
          if (selectedPhoneRef.current) await loadCalls(selectedPhoneRef.current);
          setIncomingPopup(null);
          return;
        }

        try {
          const answer = await buildBrowserCallAnswer(String(offerSession?.offer_sdp || ''));

          const answerRes = await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'answer',
              phone: phone || undefined,
              sdp: answer.sdp,
              sdp_type: answer.sdp_type,
              provider_session_id: offerSession?.provider_session_id || null,
            }),
          });
          const answerData = await answerRes.json().catch(() => ({}));
          if (!answerRes.ok || !answerData?.success) {
            const fallback = await attemptControlResume();
            if (!fallback.ok) {
              setConversationError(
                String(answerData?.error || 'Failed to accept incoming call') +
                  ` | Fallback: ${String(fallback.error || 'resume failed')}`
              );
              return;
            }
          }
        } catch (error: any) {
          const fallback = await attemptControlResume();
          if (!fallback.ok) {
            setConversationError(
              String(error?.message || 'Failed to build WebRTC answer') +
                ` | Fallback: ${String(fallback.error || 'resume failed')}`
            );
            return;
          }
        }

        if (phone) {
          await loadCalls(phone);
        } else if (selectedPhoneRef.current) {
          await loadCalls(selectedPhoneRef.current);
        }
        setIncomingPopup(null);
      } catch {
        setConversationError('Failed to accept incoming call');
      } finally {
        setCallControlLoading(null);
      }
    },
    [activeCall?.customer_phone, activeCall?.id, callControlLoading, loadCalls]
  );

  const handleSendText = useCallback(async () => {
    const text = draftMessage.trim();
    if (!selectedPhone || sendingMessage) return;
    if (composerMode === 'template') {
      if (!selectedTemplateName) return;
    } else if (!text && !selectedMediaFile) {
      return;
    }
    setSendingMessage(true);
    setConversationError('');
    try {
      let res: Response;
      if (composerMode === 'template') {
        const templateParams = templateParamsDraft
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_phone: selectedPhone,
            message_type: 'template',
            template_name: selectedTemplateName,
            template_params: templateParams,
            language: 'en',
          }),
        });
      } else if (selectedMediaFile) {
        const mediaType = inferMediaTypeFromFile(selectedMediaFile);
        const uploadFile = await compressImageIfNeeded(selectedMediaFile);
        const form = new FormData();
        form.append('recipient_phone', selectedPhone);
        form.append('message_type', 'media');
        form.append('media_type', mediaType);
        form.append('filename', uploadFile.name || selectedMediaFile.name);
        form.append('media_mime_type', uploadFile.type || selectedMediaFile.type || 'application/octet-stream');
        if (text) form.append('caption', text);
        form.append('file', uploadFile);
        res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          body: form,
        });
      } else {
        res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_phone: selectedPhone,
            message_type: 'text',
            text,
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setConversationError(data?.error || 'Send failed');
        return;
      }
      setDraftMessage('');
      setSelectedMediaFile(null);
      if (composerMode === 'template') {
        setTemplateParamsDraft('');
        setComposerMode('text');
      }
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      await Promise.all([loadConversation(selectedPhone), loadChats(true)]);
    } catch {
      setConversationError('Send failed');
    } finally {
      setSendingMessage(false);
    }
  }, [
    composerMode,
    draftMessage,
    loadChats,
    loadConversation,
    selectedMediaFile,
    selectedPhone,
    selectedTemplateName,
    sendingMessage,
    templateParamsDraft,
  ]);

  const titleText = useMemo(() => {
    if (loading) return 'Loading chats...';
    return `${chats.length} chat${chats.length === 1 ? '' : 's'} found`;
  }, [loading, chats.length]);

  const filteredChats = useMemo(() => {
    const now = Date.now();
    const isOpenChat = (chat: ChatItem) => {
      if (!chat.last_message_at) return false;
      const t = new Date(chat.last_message_at).getTime();
      if (Number.isNaN(t)) return false;
      return now - t <= 24 * 60 * 60 * 1000;
    };

    if (activeSection === 'open') return chats.filter(isOpenChat);
    if (activeSection === 'closed') return chats.filter((c) => !isOpenChat(c));
    if (activeSection === 'unread') return chats.filter((c) => (unreadByPhone[c.phone] || 0) > 0);
    return chats;
  }, [activeSection, chats, unreadByPhone]);

  const sectionCounts = useMemo(() => {
    const now = Date.now();
    let open = 0;
    let closed = 0;
    let unread = 0;
    for (const chat of chats) {
      const t = chat.last_message_at ? new Date(chat.last_message_at).getTime() : NaN;
      const isOpen = Number.isFinite(t) && now - t <= 24 * 60 * 60 * 1000;
      if (isOpen) open += 1;
      else closed += 1;
      if ((unreadByPhone[chat.phone] || 0) > 0) unread += 1;
    }
    return { all: chats.length, open, closed, unread };
  }, [chats, unreadByPhone]);

  const templateMap = useMemo(() => {
    const map = new Map<string, TemplateOption>();
    templateOptions.forEach((row) => {
      map.set(String(row.template_name || '').trim().toLowerCase(), row);
    });
    return map;
  }, [templateOptions]);

  return (
    <div className="h-[calc(100vh-64px)] bg-gray-100 p-4">
      <div className="h-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid h-full grid-cols-12">
          <aside className="col-span-12 border-b border-gray-200 bg-gray-50 p-3 lg:col-span-1 lg:border-b-0 lg:border-r">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Inbox</h2>
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={() => setActiveSection('all')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                  activeSection === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                <span>All chats</span>
                <span>{sectionCounts.all}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('open')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                  activeSection === 'open' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                <span>Open</span>
                <span>{sectionCounts.open}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('closed')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                  activeSection === 'closed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                <span>Closed</span>
                <span>{sectionCounts.closed}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('unread')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                  activeSection === 'unread' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                <span>Unread</span>
                <span>{sectionCounts.unread}</span>
              </button>
            </div>
          </aside>

          <section className="col-span-12 flex h-full min-h-0 flex-col border-b border-gray-200 lg:col-span-4 lg:border-b-0 lg:border-r">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">All chats</h1>
                  <p className="text-xs text-gray-500">
                    {activeSection === 'all'
                      ? titleText
                      : `${filteredChats.length} in ${activeSection}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadChats(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
              </div>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadChats(true);
                  }}
                  placeholder="Search by mobile number"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none ring-blue-200 focus:border-blue-500 focus:ring"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading WhatsApp chats...</span>
                </div>
              ) : error ? (
                <div className="p-6 text-sm text-red-600">{error}</div>
              ) : filteredChats.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <MessageSquare className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                  <p>No chats found.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredChats.map((chat) => {
                    const active = selectedPhone === chat.phone;
                    return (
                      <button
                        key={chat.phone}
                        type="button"
                        onClick={() => {
                          setSelectedPhone(chat.phone);
                          setUnreadByPhone((prev) => ({ ...prev, [chat.phone]: 0 }));
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          active ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900">{formatPhone(chat.phone)}</div>
                              {(unreadByPhone[chat.phone] || 0) > 0 ? (
                                <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {unreadByPhone[chat.phone]}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 truncate text-sm text-gray-600">{chat.last_message_preview}</div>
                            <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                              {chat.last_direction || '—'} - {chat.last_status || '—'}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-gray-500">{formatDateTime(chat.last_message_at)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="col-span-12 flex h-full min-h-0 flex-col lg:col-span-6">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="text-base font-semibold text-gray-900 truncate whitespace-nowrap"
                    title={selectedPhone ? formatPhone(selectedPhone) : 'Select a chat'}
                  >
                    {selectedPhone ? formatPhone(selectedPhone) : 'Select a chat'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Conversation</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#128c7e]">
                      Call state: {activeCallState}
                    </span>
                    {isIncomingActiveCall ? (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c05621]">
                        Incoming call
                      </span>
                    ) : null}
                  </div>
                </div>
                {selectedPhone ? (
                  <button
                    type="button"
                    onClick={() => loadConversation(selectedPhone)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reload
                  </button>
                ) : null}
              </div>
              {selectedPhone ? (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex min-w-max items-center gap-2 pb-1">
                    <button
                      type="button"
                      onClick={() => void handleCallAction('initiate')}
                      disabled={callActionLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#128c7e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f756b] disabled:cursor-not-allowed disabled:opacity-60"
                      title="Start WhatsApp call (requires customer opt-in)"
                    >
                      {callActionLoading === 'call' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PhoneCall className="h-3.5 w-3.5" />
                      )}
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCallAction('callback_request')}
                      disabled={callActionLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#128c7e] bg-white px-3 py-1.5 text-xs font-semibold text-[#128c7e] hover:bg-[#e8f5f2] disabled:cursor-not-allowed disabled:opacity-60"
                      title="Request callback"
                    >
                      {callActionLoading === 'callback' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PhoneIncoming className="h-3.5 w-3.5" />
                      )}
                      Callback
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendFreshPermissionRequest()}
                      disabled={callActionLoading !== null || callPermissionCooldownLeft > 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      title={
                        callPermissionCooldownLeft > 0
                          ? `Retry permission request in ${callPermissionCooldownLeft}s`
                          : 'Send fresh call permission request'
                      }
                    >
                      {callActionLoading === 'permission' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                      {callPermissionCooldownLeft > 0
                        ? `Permission (${callPermissionCooldownLeft}s)`
                        : 'Permission'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCallControl('hangup')}
                      disabled={!activeCall || callControlLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Hangup"
                    >
                      {callControlLoading === 'hangup' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PhoneOff className="h-3.5 w-3.5" />
                      )}
                      Hangup
                    </button>
                    {isIncomingActiveCall ? (
                      <button
                        type="button"
                        onClick={() => void handleAcceptIncomingCall(activeCall?.id, selectedPhone)}
                        disabled={!canAnswerIncomingCall || callControlLoading !== null}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Accept incoming call"
                      >
                        {callControlLoading === 'resume' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PhoneIncoming className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleCallControl('hold')}
                      disabled={!activeCall || callControlLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Hold"
                    >
                      {callControlLoading === 'hold' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PauseCircle className="h-3.5 w-3.5" />
                      )}
                      Hold
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCallControl('resume')}
                      disabled={!activeCall || callControlLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Resume"
                    >
                      {callControlLoading === 'resume' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )}
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCallControl('mute')}
                      disabled={!activeCall || callControlLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Mute"
                    >
                      {callControlLoading === 'mute' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5" />
                      )}
                      Mute
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCallControl('unmute')}
                      disabled={!activeCall || callControlLoading !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Unmute"
                    >
                      {callControlLoading === 'unmute' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                      Unmute
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] p-4">
              {!selectedPhone ? (
                <div className="flex h-full items-center justify-center text-gray-600">
                  Select a chat from the center column.
                </div>
              ) : conversationLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading conversation...
                </div>
              ) : conversationError ? (
                <div className="p-6 text-sm text-red-600">{conversationError}</div>
              ) : conversation.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-600">No messages yet.</div>
              ) : (
                <div className="space-y-2">
                  {callLoading ? (
                    <div className="mx-auto w-fit rounded-full bg-white/80 px-3 py-1 text-[11px] text-gray-600">
                      Loading calls...
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
                      const status = normalizeCallStatus(call.call_status);
                      const inbound = isInboundCallDirection(call.direction);
                      const isCallback = String(call.direction || '').toUpperCase().includes('CALLBACK');
                      const isMissed = ['MISSED', 'REJECTED', 'FAILED'].includes(status);
                      const isAccepted = ['ACCEPTED', 'CONNECTED', 'ENDED'].includes(status);
                      const iconColor = isMissed
                        ? 'text-red-500'
                        : isAccepted
                        ? 'text-green-600'
                        : inbound
                        ? 'text-blue-600'
                        : 'text-[#0f766e]';
                      const label = isCallback
                        ? 'Callback request'
                        : isMissed
                        ? `${inbound ? 'Missed call' : 'Not answered'}`
                        : isAccepted
                        ? `${inbound ? 'Incoming' : 'Outgoing'} call`
                        : `${inbound ? 'Incoming' : 'Outgoing'} call · ${status}`;
                      return (
                        <button
                          key={`call-${call.id}`}
                          type="button"
                          onClick={() => setCallInfoOpen(call)}
                          className="mx-auto flex w-fit items-center gap-2 rounded-xl border border-[#d8dee3] bg-white/90 px-4 py-2 text-[12px] text-[#334155] shadow-sm hover:bg-white"
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isMissed ? 'bg-red-50' : 'bg-green-50'}`}>
                            {inbound ? (
                              <PhoneIncoming className={`h-3.5 w-3.5 ${iconColor}`} />
                            ) : (
                              <PhoneOutgoing className={`h-3.5 w-3.5 ${iconColor}`} />
                            )}
                          </span>
                          <span className="flex flex-col items-start leading-tight">
                            <span className="font-semibold">{label}</span>
                            <span className="text-[10px] text-gray-500">
                              {formatMessageTime(call.started_at || call.created_at || null)}
                              {call.duration_seconds ? ` · ${formatDuration(call.duration_seconds)}` : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  {conversation.map((msg) => {
                    const outbound = String(msg.direction || '').toUpperCase() === 'OUTBOUND';
                    const actorName = String(msg?.meta?.actor_name || '').trim();
                    const deliveryStatus = normalizeDeliveryStatus(msg?.status);
                    const statusTimestamps =
                      msg?.meta?.status_timestamps && typeof msg.meta.status_timestamps === 'object'
                        ? msg.meta.status_timestamps
                        : {};
                    const sentAtRaw = String(statusTimestamps?.sent_at || msg?.created_at || msg?.status_at || '').trim();
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
                    const isTemplateMessage = Boolean(msg?.template_name);
                    const currentTemplate = msg?.template_name
                      ? templateMap.get(String(msg.template_name || '').trim().toLowerCase()) || null
                      : null;
                    const templateText = currentTemplate
                      ? fillTemplateBodyFromArray(currentTemplate, msg?.payload?.request?.template_params)
                      : '';
                    const templateButtons = isTemplateMessage ? extractTemplateButtons(currentTemplate) : [];
                    const templateDisplayName =
                      currentTemplate?.display_name || currentTemplate?.template_name || msg?.template_name || '';
                    const msgType = String(msg.message_type || '').trim().toUpperCase();
                    const mediaLabel =
                      msgType === 'IMAGE'
                        ? '📷 Photo'
                        : msgType === 'VIDEO'
                        ? '🎥 Video'
                        : msgType === 'AUDIO'
                        ? '🎤 Audio'
                        : msgType === 'DOCUMENT'
                        ? '📄 Document'
                        : msgType === 'LOCATION'
                        ? '📍 Location'
                        : msgType === 'STICKER'
                        ? '🗂️ Sticker'
                        : '';
                    const bubbleText =
                      String(msg.text_body || '').trim() ||
                      (isTemplateMessage ? templateText || `Template: ${msg.template_name}` : '') ||
                      String(msg.media_caption || '').trim() ||
                      mediaLabel ||
                      (msgType && msgType !== 'TEXT' ? msgType : '—');
                    const callPermissionState = detectCallPermissionState({
                      templateName: msg?.template_name,
                      isOutbound: outbound,
                      text: bubbleText,
                    });
                    const callPermissionBadge = callPermissionBadgeMeta(callPermissionState);
                    const timeLabel = formatMessageTime(msg?.status_at || msg?.updated_at || msg?.created_at);
                    const messageKey = String(msg?.id || msg?.provider_message_id || '');
                    return (
                      <div key={msg.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                            outbound ? 'bg-[#d9fdd3] text-gray-900' : 'bg-white text-gray-900'
                          }`}
                        >
                          {outbound && actorName ? (
                            <div className="mb-1 text-[11px] font-semibold text-[#0f4c3a]">Sent by: {actorName}</div>
                          ) : null}
                          {isTemplateMessage ? (
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#0f5132]">
                              Template: {templateDisplayName}
                            </div>
                          ) : null}
                          {callPermissionBadge ? (
                            <div
                              className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${callPermissionBadge.className}`}
                            >
                              {callPermissionBadge.label}
                            </div>
                          ) : null}
                          <div className="whitespace-pre-wrap break-words">{bubbleText}</div>
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
                          {outbound && failedReason ? (
                            <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700">
                              Failed reason: {failedReason}
                            </div>
                          ) : null}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-gray-500">
                            <span>{timeLabel || formatDateTime(msg.created_at)}</span>
                            {outbound && deliveryStatus === 'SENT' ? <Check className="h-3.5 w-3.5" /> : null}
                            {outbound && deliveryStatus === 'DELIVERED' ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                            {outbound && deliveryStatus === 'VIEWED' ? (
                              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                            ) : null}
                            {outbound && deliveryStatus === 'FAILED' ? (
                              <span className="font-semibold text-[#d93025]">!</span>
                            ) : null}
                            {outbound ? (
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white p-3">
              {composerMode === 'template' ? (
                <div className="mb-2 rounded-lg border border-[#d8dee3] bg-[#f8fafc] px-3 py-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#475467]">
                      Template mode
                    </span>
                    <button
                      type="button"
                      onClick={() => setComposerMode('text')}
                      className="text-[11px] font-semibold text-[#128c7e]"
                    >
                      Back to text
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={selectedTemplateName}
                      onChange={(e) => setSelectedTemplateName(e.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 outline-none focus:border-[#128c7e]"
                    >
                      <option value="">Select template</option>
                      {templateOptions.map((tpl) => (
                        <option key={tpl.template_name} value={tpl.template_name}>
                          {tpl.display_name || tpl.template_name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={templateParamsDraft}
                      onChange={(e) => setTemplateParamsDraft(e.target.value)}
                      placeholder="Params (comma separated)"
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-[#128c7e]"
                    />
                  </div>
                </div>
              ) : null}
              {selectedMediaFile ? (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="truncate text-xs text-gray-700">{selectedMediaFile.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMediaFile(null);
                      if (mediaInputRef.current) mediaInputRef.current.value = '';
                    }}
                    className="ml-2 rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept={attachmentAccept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSelectedMediaFile(file);
                      setShowAttachMenu(false);
                    }}
                  />
                  <button
                    ref={attachButtonRef}
                    type="button"
                    onClick={() => setShowAttachMenu((prev) => !prev)}
                    disabled={!selectedPhone || sendingMessage}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  {showAttachMenu ? (
                    <div
                      ref={attachMenuRef}
                      className="absolute bottom-12 left-0 z-20 min-w-[170px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={() => openAttachmentPicker('image')}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Image
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachmentPicker('video')}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Video
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachmentPicker('audio')}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Audio
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachmentPicker('document')}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Document
                      </button>
                      <button
                        type="button"
                        onClick={openTemplateComposer}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Template
                      </button>
                    </div>
                  ) : null}
                </div>
                <input
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendText();
                    }
                  }}
                  disabled={!selectedPhone || sendingMessage || composerMode === 'template'}
                  placeholder={
                    !selectedPhone
                      ? 'Select a chat to send message'
                      : composerMode === 'template'
                      ? 'Template mode enabled'
                      : 'Type a message'
                  }
                  className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm outline-none ring-green-200 focus:border-green-500 focus:ring disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => void handleSendText()}
                  disabled={
                    !selectedPhone ||
                    sendingMessage ||
                    (composerMode === 'template'
                      ? !selectedTemplateName
                      : !draftMessage.trim() && !selectedMediaFile)
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  title="Send message"
                >
                  {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      {incomingPopup ? (
        <div className="fixed right-4 top-20 z-[6400] w-[320px] rounded-2xl border border-green-200 bg-white p-3 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedPhone(incomingPopup.phone)}
              className="min-w-0 text-left"
              title="Open incoming chat"
            >
              <div className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-700">
                <PhoneIncoming className="h-3.5 w-3.5" />
                Incoming call
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                {formatPhone(incomingPopup.phone)}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                State: {incomingPopup.status}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setIncomingPopup(null)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAcceptIncomingCall(incomingPopup.callId, incomingPopup.phone)}
              disabled={callControlLoading !== null}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {callControlLoading === 'resume' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PhoneIncoming className="h-3.5 w-3.5" />
              )}
              Accept
            </button>
            <button
              type="button"
              onClick={() => void handleIncomingPopupAction('hangup')}
              disabled={callControlLoading !== null}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {callControlLoading === 'hangup' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PhoneOff className="h-3.5 w-3.5" />
              )}
              Reject
            </button>
          </div>
        </div>
      ) : null}
      {messageInfoOpen ? (
        <div
          className="fixed inset-0 z-[6500] bg-black/35"
          onClick={() => setMessageInfoOpen(null)}
        >
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300" />
            <h3 className="text-sm font-semibold text-gray-900">Message info</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Sent</span>
                <span className="font-medium text-gray-900">{formatMessageDateTime(messageInfoOpen.sentAt)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Delivered</span>
                <span className="font-medium text-gray-900">{formatMessageDateTime(messageInfoOpen.deliveredAt)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Read</span>
                <span className="font-medium text-gray-900">{formatMessageDateTime(messageInfoOpen.viewedAt)}</span>
              </div>
              {messageInfoOpen.failedReason ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Failed: {messageInfoOpen.failedReason}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {callInfoOpen ? (
        <div className="fixed inset-0 z-[6500] bg-black/35" onClick={() => setCallInfoOpen(null)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300" />
            <h3 className="text-sm font-semibold text-gray-900">Call info</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Direction</span>
                <span className="font-medium text-gray-900">{callInfoOpen.direction || '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Status</span>
                <span className="font-medium text-gray-900">{callInfoOpen.call_status || '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Session state</span>
                <span className="font-medium text-gray-900">
                  {String(callInfoOpen?.sessions?.[0]?.session_state || '—').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Session id</span>
                <span className="font-medium text-gray-900">
                  {callInfoOpen?.sessions?.[0]?.provider_session_id || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Started</span>
                <span className="font-medium text-gray-900">
                  {formatMessageDateTime(callInfoOpen.started_at || callInfoOpen.created_at || null)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Ended</span>
                <span className="font-medium text-gray-900">
                  {formatMessageDateTime(callInfoOpen.ended_at || null)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium text-gray-900">{formatDuration(callInfoOpen.duration_seconds)}</span>
              </div>
              {callInfoOpen.error_message ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Error: {callInfoOpen.error_message}
                </div>
              ) : null}
              {(callInfoOpen.recordings || []).length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="mb-1 text-xs font-semibold text-gray-700">Recordings</p>
                  <div className="space-y-1">
                    {(callInfoOpen.recordings || []).map((rec) => (
                      <a
                        key={rec.id}
                        href={`/api/whatsapp/calls/recordings/${rec.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs font-medium text-[#128c7e] hover:underline"
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
    </div>
  );
}
