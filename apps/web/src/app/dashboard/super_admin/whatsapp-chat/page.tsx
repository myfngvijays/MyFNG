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
  Mic,
  MicOff,
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
  media_url?: string | null;
  media_mime_type?: string | null;
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
  updated_at?: string | null;
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

function normalizeSdpForBrowser(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line))
    .join('\r\n')
    .concat('\r\n');
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
  const [sendError, setSendError] = useState('');
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
    /** 'ringing' | 'active' */
    phase: 'ringing' | 'active';
    acceptedAt?: number;
  } | null>(null);
  const [activeCallElapsed, setActiveCallElapsed] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const dismissedCallIdsRef = useRef<Set<string>>(new Set());
  const activePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const outboundConnectedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [isOutboundRtcConnected, setIsOutboundRtcConnected] = useState(false);
  const activeAudioStreamRef = useRef<MediaStream | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeCallRef = useRef<string | null>(null);
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [conversation, selectedPhone]);

  const buildLiveOutboundCallOffer = useCallback(async (): Promise<{ sdp: string; sdp_type: 'offer' }> => {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      throw new Error('Browser does not support WebRTC call offer generation');
    }

    if (activePeerConnectionRef.current) {
      activePeerConnectionRef.current.close();
      activePeerConnectionRef.current = null;
    }
    if (activeAudioStreamRef.current) {
      activeAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      activeAudioStreamRef.current = null;
    }

    let audioStream: MediaStream | null = null;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeAudioStreamRef.current = audioStream;
    } catch {
      audioStream = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceTransportPolicy: 'all',
    });
    activePeerConnectionRef.current = pc;

    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => pc.addTrack(track, audioStream!));
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    let finalized = false;
    const finalizeOngoingCall = () => {
      if (finalized) return;
      finalized = true;
      const cid = activeCallRef.current;
      if (cid) {
        fetch(`/api/whatsapp/calls/${encodeURIComponent(cid)}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hangup' }),
        }).catch(() => {});
      }
      if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
        activeRecorderRef.current.stop();
      }
      activeRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      outboundConnectedAtRef.current = null;
      setIsOutboundRtcConnected(false);
      if (activePeerConnectionRef.current) {
        activePeerConnectionRef.current.close();
        activePeerConnectionRef.current = null;
      }
      if (activeAudioStreamRef.current) {
        activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        activeAudioStreamRef.current = null;
      }
      document.getElementById('whatsapp-call-audio')?.remove();
      setActiveCallElapsed(0);
      setCallMuted(false);
      if (selectedPhoneRef.current) void loadCalls(selectedPhoneRef.current);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (!outboundConnectedAtRef.current) outboundConnectedAtRef.current = Date.now();
        setIsOutboundRtcConnected(true);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        finalizeOngoingCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        finalizeOngoingCall();
      }
    };

    pc.ontrack = (ev) => {
      if (!outboundConnectedAtRef.current) outboundConnectedAtRef.current = Date.now();
      setIsOutboundRtcConnected(true);
      ev.track.onended = () => finalizeOngoingCall();
      const remoteStream = ev.streams[0] || new MediaStream([ev.track]);
      const existing = document.getElementById('whatsapp-call-audio') as HTMLAudioElement | null;
      if (existing) {
        existing.srcObject = remoteStream;
        existing.play().catch(() => {});
      } else {
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = 'whatsapp-call-audio';
        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
        remoteAudio.srcObject = remoteStream;
        document.body.appendChild(remoteAudio);
        remoteAudio.play().catch(() => {});
      }

      try {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        if (audioStream) {
          const localSrc = ctx.createMediaStreamSource(audioStream);
          localSrc.connect(dest);
        }
        const remoteSrc = ctx.createMediaStreamSource(remoteStream);
        remoteSrc.connect(dest);
        const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
        recordedChunksRef.current = [];
        const startedAtMs = Date.now();
        recordingStartedAtRef.current = startedAtMs;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const currentCallId = activeCallRef.current;
          const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000));
          recordingStartedAtRef.current = null;
          if (currentCallId) saveCallRecording(currentCallId, recordedChunksRef.current, elapsedSec);
        };
        recorder.start(1000);
        activeRecorderRef.current = recorder;
      } catch {
        // Recording not available
      }
    };

    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    if (pc.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 4000);
        const onStateChange = () => {
          if (pc.iceGatheringState === 'complete') {
            window.clearTimeout(timeout);
            pc.removeEventListener('icegatheringstatechange', onStateChange);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', onStateChange);
      });
    }
    const localSdp = pc.localDescription?.sdp || offer.sdp || '';
    if (!localSdp) {
      throw new Error('Unable to build SDP offer for call initiation');
    }
    return { sdp: localSdp, sdp_type: 'offer' };
  }, []);

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
    const now = Date.now();
    const STALE_PRE_CONNECT_MS = 2 * 60 * 1000; // 2 min for INITIATED/RINGING/NEGOTIATING
    const STALE_CONNECTED_MS = 4 * 60 * 60 * 1000; // 4 hours for CONNECTED/ACCEPTED
    const sorted = [...callLogs].sort((a, b) => {
      const ta = new Date(a.started_at || a.created_at || 0).getTime();
      const tb = new Date(b.started_at || b.created_at || 0).getTime();
      return tb - ta;
    });
    return (
      sorted.find((row) => {
        const status = normalizeCallStatus(row.call_status);
        if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(status)) return false;
        const updatedAt = new Date(row.updated_at || row.created_at || 0).getTime();
        const age = now - updatedAt;
        if (['INITIATED', 'RINGING', 'NEGOTIATING'].includes(status) && age > STALE_PRE_CONNECT_MS) return false;
        if (['CONNECTED', 'ACCEPTED'].includes(status) && age > STALE_CONNECTED_MS) return false;
        return true;
      }) || null
    );
  }, [callLogs]);
  const activeCallState = useMemo(() => {
    if (!activeCall) return 'IDLE';
    const callStatus = normalizeCallStatus(activeCall.call_status);
    if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus)) return callStatus;
    const sessionState = String(activeCall?.sessions?.[0]?.session_state || '').trim().toUpperCase();
    if (sessionState) return sessionState;
    return callStatus || 'IDLE';
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
  const hasLiveConnectedCall = useMemo(() => {
    if (!activeCall) return false;
    const isOutbound = !isInboundCallDirection(activeCall.direction);
    if (isOutbound) return isOutboundRtcConnected;
    const state = String(activeCallState || '').trim().toUpperCase();
    if (['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state)) return false;
    return ['ACCEPTED', 'CONNECTED'].includes(state);
  }, [activeCall, activeCallState, isOutboundRtcConnected]);
  const isOutboundActiveCall = useMemo(() => {
    if (!activeCall) return false;
    if (isInboundCallDirection(activeCall.direction)) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    return !['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state);
  }, [activeCall, activeCallState]);
  const callPermissionTemplateName = useMemo(
    () => resolveCallingPermissionTemplateName(templateOptions),
    [templateOptions]
  );
  const callPermissionCooldownLeft = Math.max(
    0,
    Math.ceil((callPermissionCooldownUntil - callPermissionTick) / 1000)
  );

  const staleCleanedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const STALE_MS = 2 * 60 * 1000;
    const now = Date.now();
    const staleCalls = callLogs.filter((row) => {
      if (staleCleanedIdsRef.current.has(row.id)) return false;
      const status = normalizeCallStatus(row.call_status);
      if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(status)) return false;
      const updatedAt = new Date(row.updated_at || row.created_at || 0).getTime();
      return ['INITIATED', 'RINGING', 'NEGOTIATING', 'CONNECTED', 'ACCEPTED'].includes(status) && now - updatedAt > STALE_MS;
    });
    if (staleCalls.length === 0) return;
    for (const call of staleCalls) {
      staleCleanedIdsRef.current.add(call.id);
      fetch(`/api/whatsapp/calls/${encodeURIComponent(call.id)}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hangup' }),
      }).catch(() => {});
    }
    setTimeout(() => {
      if (selectedPhoneRef.current) void loadCalls(selectedPhoneRef.current);
    }, 3000);
  }, [callLogs, loadCalls]);

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
    setSendError('');
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

  // Poll DB for active incoming calls — only show if very recent and not dismissed
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const cutoff = new Date(Date.now() - 30_000).toISOString();
        const { data } = await supabase
          .from('whatsapp_call_logs')
          .select('id, customer_phone, call_status, direction')
          .eq('direction', 'INBOUND')
          .in('call_status', ['RINGING', 'INITIATED'])
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (data?.id && !dismissedCallIdsRef.current.has(data.id)) {
          const phone = normalizePhone(String(data.customer_phone || ''));
          const callId = String(data.id);
          const callStatus = String(data.call_status || 'RINGING').toUpperCase();
          setIncomingPopup((prev) => {
            if (prev?.callId === callId && prev?.phase === 'active') return prev;
            if (prev?.callId === callId && prev?.status === callStatus) return prev;
            return { callId, phone, status: callStatus, phase: 'ringing' };
          });
        }
      } catch {
        // silently ignore poll errors
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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

          if (inboundActive && rowId && !dismissedCallIdsRef.current.has(rowId)) {
            setIncomingPopup((prev) => {
              if (prev && prev.callId === rowId && prev.status === callStatus && prev.phone === phone) {
                return prev;
              }
              const phase = callStatus === 'ACCEPTED' ? 'active' : 'ringing';
              return {
                callId: rowId,
                phone,
                status: callStatus,
                phase,
                acceptedAt: phase === 'active' ? (prev?.acceptedAt || Date.now()) : undefined,
              };
            });
          } else if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus)) {
            setIncomingPopup((prev) => {
              if (!prev) return prev;
              if ((rowId && prev.callId === rowId) || prev.phone === phone) return null;
              return prev;
            });
            setActiveCallElapsed(0);
            setCallMuted(false);
            // Stop recording and cleanup WebRTC media on call end
            if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
              activeRecorderRef.current.stop();
            }
            activeRecorderRef.current = null;
            recordingStartedAtRef.current = null;
            outboundConnectedAtRef.current = null;
            setIsOutboundRtcConnected(false);
            if (activePeerConnectionRef.current) {
              activePeerConnectionRef.current.close();
              activePeerConnectionRef.current = null;
            }
            if (activeAudioStreamRef.current) {
              activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
              activeAudioStreamRef.current = null;
            }
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

  const isOutboundConnected = useMemo(() => {
    if (!isOutboundActiveCall) return false;
    // Outbound timer/status must follow actual RTC connection only.
    return isOutboundRtcConnected;
  }, [isOutboundActiveCall, isOutboundRtcConnected]);

  useEffect(() => {
    activeCallRef.current = activeCall?.id || null;
  }, [activeCall?.id]);

  useEffect(() => {
    if (!isOutboundActiveCall) {
      outboundConnectedAtRef.current = null;
      recordingStartedAtRef.current = null;
      setIsOutboundRtcConnected(false);
    }
  }, [isOutboundActiveCall]);

  useEffect(() => {
    let startMs: number | null = null;
    if (incomingPopup?.phase === 'active') {
      startMs = incomingPopup.acceptedAt || Date.now();
    } else if (isOutboundConnected) {
      startMs = outboundConnectedAtRef.current || Date.now();
    } else if (hasLiveConnectedCall && activeCall && isInboundCallDirection(activeCall.direction)) {
      const sourceTs = String(
        activeCall.started_at || activeCall.updated_at || activeCall.created_at || ''
      ).trim();
      const parsed = sourceTs ? new Date(sourceTs).getTime() : Number.NaN;
      startMs = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
    }
    if (!startMs) {
      setActiveCallElapsed(0);
      return;
    }
    setActiveCallElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    const id = setInterval(() => {
      setActiveCallElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [
    incomingPopup?.phase,
    incomingPopup?.acceptedAt,
    hasLiveConnectedCall,
    isOutboundConnected,
    activeCall?.started_at,
    activeCall?.updated_at,
    activeCall?.created_at,
    activeCall?.id,
  ]);

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
      let sessionPayload: { sdp: string; sdp_type: 'offer' } | null = null;
      if (action === 'initiate') {
        const ok = window.confirm(
          'Confirm customer opt-in for WhatsApp call before proceeding. Continue?'
        );
        if (!ok) return;
        setIsOutboundRtcConnected(false);
        outboundConnectedAtRef.current = null;
        recordingStartedAtRef.current = null;
        try {
          sessionPayload = await buildLiveOutboundCallOffer();
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
        const initAnswerSdp = String(data?.answer_sdp || '').trim();
        if (initAnswerSdp) {
          const pc = activePeerConnectionRef.current;
          if (pc && pc.signalingState !== 'closed' && !pc.remoteDescription) {
            try {
              const normalizedAnswer = normalizeSdpForBrowser(initAnswerSdp);
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: normalizedAnswer })
              );
            } catch {
              // Will be retried via polling
            }
          }
        }
        await loadCalls(selectedPhone);
      } catch {
        setConversationError('Call action failed');
      } finally {
        setCallActionLoading(null);
      }
    },
    [buildLiveOutboundCallOffer, callActionLoading, loadCalls, selectedPhone]
  );

  useEffect(() => {
    if (!isOutboundActiveCall || !activeCall?.id) return;
    const pc = activePeerConnectionRef.current;
    if (!pc || pc.signalingState === 'closed') return;
    const alreadyConnected = pc.connectionState === 'connected' && !!pc.remoteDescription;

    let cancelled = false;
    const appliedCandidateKeys = new Set<string>();

    const poll = async () => {
      if (cancelled) return;
      const currentPc = activePeerConnectionRef.current;
      if (!currentPc || currentPc.signalingState === 'closed') return;

      try {
        const res = await fetch(
          `/api/whatsapp/calls/${encodeURIComponent(activeCall!.id)}/session`,
          { cache: 'no-store' }
        );
        const json = await res.json().catch(() => ({}));
        const sessions = Array.isArray(json?.sessions) ? json.sessions : [];
        const candidates = Array.isArray(json?.ice_candidates) ? json.ice_candidates : [];
        const callStatus = String(json?.call_status || '').trim().toUpperCase();

        if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus) && !cancelled) {
          if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
            activeRecorderRef.current.stop();
          }
          activeRecorderRef.current = null;
          recordingStartedAtRef.current = null;
          outboundConnectedAtRef.current = null;
          setIsOutboundRtcConnected(false);
          if (activePeerConnectionRef.current) {
            activePeerConnectionRef.current.close();
            activePeerConnectionRef.current = null;
          }
          if (activeAudioStreamRef.current) {
            activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
            activeAudioStreamRef.current = null;
          }
          document.getElementById('whatsapp-call-audio')?.remove();
          setActiveCallElapsed(0);
          setCallMuted(false);
          if (selectedPhoneRef.current) void loadCalls(selectedPhoneRef.current);
          return;
        }

        if (!currentPc.remoteDescription && !cancelled) {
          let remoteSdp: string | null = null;

          const answerRow = sessions.find((row: any) => String(row?.answer_sdp || '').trim());
          if (answerRow) {
            remoteSdp = String(answerRow.answer_sdp).trim();
          }

          if (!remoteSdp) {
            const webhookRow = sessions.find((row: any) => {
              const sdp = String(row?.offer_sdp || '').trim();
              const source = String((row?.meta as any)?.source || '').trim();
              return sdp && source === 'webhook';
            });
            if (webhookRow) remoteSdp = String(webhookRow.offer_sdp).trim();
          }

          if (remoteSdp && !cancelled && currentPc.signalingState !== 'closed') {
            try {
              const normalizedSdp = normalizeSdpForBrowser(remoteSdp);
              await currentPc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: normalizedSdp })
              );
            } catch {
              // Will retry on next poll
            }
          }
        }

        if (currentPc.remoteDescription && candidates.length > 0) {
          for (const cand of candidates) {
            const candStr = String(cand?.candidate || '').trim();
            if (!candStr) continue;
            const key = `${candStr}:${cand?.sdp_mid || ''}:${cand?.sdp_mline_index ?? ''}`;
            if (appliedCandidateKeys.has(key)) continue;
            try {
              await currentPc.addIceCandidate(new RTCIceCandidate({
                candidate: candStr,
                sdpMid: cand?.sdp_mid || undefined,
                sdpMLineIndex: cand?.sdp_mline_index ?? undefined,
              }));
              appliedCandidateKeys.add(key);
            } catch {
              // Skip invalid candidate
            }
          }
        }
      } catch {
        // Will retry
      }

      if (!cancelled) {
        const currentPc2 = activePeerConnectionRef.current;
        if (!currentPc2 || currentPc2.signalingState === 'closed') return;
        const isConnected = currentPc2.connectionState === 'connected' && !!currentPc2.remoteDescription;
        setTimeout(poll, isConnected ? 1500 : 2500);
      }
    };
    const timer = setTimeout(poll, alreadyConnected ? 1500 : 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOutboundActiveCall, activeCall?.id, activeCallState, loadCalls]);

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

  const cleanupCallMedia = useCallback(() => {
    if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
      activeRecorderRef.current.stop();
    }
    activeRecorderRef.current = null;
    recordingStartedAtRef.current = null;
    outboundConnectedAtRef.current = null;
    setIsOutboundRtcConnected(false);
    if (activePeerConnectionRef.current) {
      activePeerConnectionRef.current.close();
      activePeerConnectionRef.current = null;
    }
    if (activeAudioStreamRef.current) {
      activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      activeAudioStreamRef.current = null;
    }
    document.getElementById('whatsapp-call-audio')?.remove();
  }, []);

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
        }
        if (selectedPhone) await loadCalls(selectedPhone);
      } catch {
        setConversationError('Call control failed');
      } finally {
        if (action === 'hangup') {
          cleanupCallMedia();
          setActiveCallElapsed(0);
          setCallMuted(false);
        }
        setCallControlLoading(null);
      }
    },
    [activeCall?.id, callControlLoading, cleanupCallMedia, loadCalls, selectedPhone]
  );

  const saveCallRecording = useCallback(async (callId: string, chunks: Blob[], durationSeconds: number) => {
    if (chunks.length === 0) return;
    try {
      const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
      if (blob.size < 100) return;
      const form = new FormData();
      form.append('file', blob, `call-recording-${callId}.webm`);
      form.append('call_id', callId);
      form.append('duration_seconds', String(Math.max(1, Math.floor(durationSeconds || 0))));
      await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/recording`, {
        method: 'POST',
        body: form,
      }).catch(() => {});
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!isOutboundActiveCall || !activeCall?.id) return;
    const state = String(activeCallState || '').trim().toUpperCase();
    if (!['INITIATED', 'RINGING', 'NEGOTIATING'].includes(state)) return;

    const timeout = setTimeout(() => {
      const callId = activeCall.id;
      fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hangup' }),
      }).catch(() => {});
      if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
        activeRecorderRef.current.stop();
      }
      activeRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      outboundConnectedAtRef.current = null;
      setIsOutboundRtcConnected(false);
      if (activePeerConnectionRef.current) {
        activePeerConnectionRef.current.close();
        activePeerConnectionRef.current = null;
      }
      if (activeAudioStreamRef.current) {
        activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        activeAudioStreamRef.current = null;
      }
      document.getElementById('whatsapp-call-audio')?.remove();
      setActiveCallElapsed(0);
      setCallMuted(false);
      if (selectedPhoneRef.current) void loadCalls(selectedPhoneRef.current);
    }, 60_000);

    return () => clearTimeout(timeout);
  }, [isOutboundActiveCall, activeCall?.id, activeCallState, loadCalls]);

  const handleIncomingPopupAction = useCallback(
    async (action: 'hangup') => {
      if (!incomingPopup?.callId || callControlLoading) return;
      dismissedCallIdsRef.current.add(incomingPopup.callId);
      cleanupCallMedia();
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

      const phone = normalizePhone(
        String(targetPhone || selectedPhoneRef.current || activeCall?.customer_phone || '')
      );
      const switchToActive = () => {
        setActiveCallElapsed(0);
        setCallMuted(false);
        setIncomingPopup((prev) =>
          prev ? { ...prev, phase: 'active', acceptedAt: Date.now() } : prev
        );
      };

      if (callId) dismissedCallIdsRef.current.add(callId);

      // Clean up any previous call
      if (activePeerConnectionRef.current) {
        activePeerConnectionRef.current.close();
        activePeerConnectionRef.current = null;
      }
      if (activeAudioStreamRef.current) {
        activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        activeAudioStreamRef.current = null;
      }

      try {
        // Step 1: Request microphone access
        let audioStream: MediaStream | null = null;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          activeAudioStreamRef.current = audioStream;
        } catch {
          // Microphone access denied — receive-only mode
        }

        // Step 2: Get Meta's SDP offer from saved sessions
        let metaOfferSdp: string | null = null;
        try {
          const sessRes = await fetch(
            `/api/whatsapp/calls/${encodeURIComponent(callId)}/session`,
            { cache: 'no-store' }
          );
          const sessData = await sessRes.json().catch(() => ({}));
          const sessions = Array.isArray(sessData?.sessions) ? sessData.sessions : [];
          const offerRow = sessions.find((r: any) => String(r?.offer_sdp || '').trim());
          metaOfferSdp = offerRow?.offer_sdp ? String(offerRow.offer_sdp).trim() : null;
        } catch {
          // No saved offer
        }

        if (!metaOfferSdp) {
          setConversationError('No SDP available — Meta offer not received yet');
          return;
        }

        if (typeof RTCPeerConnection === 'undefined') {
          setConversationError('WebRTC not supported in this browser');
          return;
        }

        // Sanitize Meta's SDP offer for browser parsing
        const sanitizedOffer = metaOfferSdp
          .replace(/\\r\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => Boolean(line))
          .join('\r\n')
          .concat('\r\n');

        // Step 3: Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
          iceTransportPolicy: 'all',
        });
        activePeerConnectionRef.current = pc;

        // Add microphone tracks BEFORE creating answer (Meta requires media flow)
        if (audioStream) {
          audioStream.getAudioTracks().forEach((track) => pc.addTrack(track, audioStream!));
        } else {
          pc.addTransceiver('audio', { direction: 'recvonly' });
        }

        // Play incoming audio and start recording
        pc.ontrack = (ev) => {
          const remoteStream = ev.streams[0] || new MediaStream([ev.track]);
          const remoteAudio = document.createElement('audio');
          remoteAudio.id = 'whatsapp-call-audio';
          remoteAudio.autoplay = true;
          remoteAudio.playsInline = true;
          remoteAudio.srcObject = remoteStream;
          document.getElementById('whatsapp-call-audio')?.remove();
          document.body.appendChild(remoteAudio);
          remoteAudio.play().catch(() => {});

          // Start recording: mix local + remote audio
          try {
            const ctx = new AudioContext();
            const dest = ctx.createMediaStreamDestination();
            if (audioStream) {
              const localSrc = ctx.createMediaStreamSource(audioStream);
              localSrc.connect(dest);
            }
            const remoteSrc = ctx.createMediaStreamSource(remoteStream);
            remoteSrc.connect(dest);
            const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
            recordedChunksRef.current = [];
            const startedAtMs = Date.now();
            recordingStartedAtRef.current = startedAtMs;
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
              const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000));
              recordingStartedAtRef.current = null;
              if (callId) saveCallRecording(callId, recordedChunksRef.current, elapsedSec);
            };
            recorder.start(1000);
            activeRecorderRef.current = recorder;
          } catch {
            // Recording not available
          }
        };

        // Set Meta's offer as remote description (using sanitized SDP)
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: sanitizedOffer })
        );

        // Create SDP answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Wait for ICE gathering (max 5s)
        if (pc.iceGatheringState !== 'complete') {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 5000);
            pc.onicegatheringstatechange = () => {
              if (pc.iceGatheringState === 'complete') {
                clearTimeout(timeout);
                resolve();
              }
            };
          });
        }

        const answerSdp = pc.localDescription?.sdp || answer.sdp || null;
        if (!answerSdp) {
          setConversationError('Failed to generate SDP answer');
          return;
        }

        // Step 4: Send pre_accept to Meta (tells Meta we are preparing)
        const sendToBackend = async (metaAction: string, sdpToSend: string) => {
          const res = await fetch(
            `/api/whatsapp/calls/${encodeURIComponent(callId)}/session`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'answer',
                phone: phone || undefined,
                sdp: sdpToSend,
                sdp_type: 'answer',
                provider_session_id: null,
                meta_action: metaAction,
              }),
            }
          );
          return { res, data: await res.json().catch(() => ({})) };
        };

        const { res: preRes, data: preData } = await sendToBackend('pre_accept', answerSdp);
        if (!preRes.ok || !preData?.success) {
          const errMsg = String(preData?.error || 'Meta rejected pre_accept');
          setConversationError(`Call pre-accept failed: ${errMsg}`);
          return;
        }
        // Step 5: Wait for WebRTC connection to establish (max 10s)
        const connected = await new Promise<boolean>((resolve) => {
          if (pc.connectionState === 'connected') {
            resolve(true);
            return;
          }
          const timeout = setTimeout(() => {
            resolve(true);
          }, 10000);
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              clearTimeout(timeout);
              resolve(true);
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              clearTimeout(timeout);
              resolve(false);
            }
          };
        });

        if (!connected) {
          setConversationError('WebRTC connection failed — audio path not established');
          return;
        }

        // Step 6: Send final accept to Meta
        const { res: acceptRes, data: acceptData } = await sendToBackend('accept', answerSdp);
        if (!acceptRes.ok || !acceptData?.success) {
          const errMsg = String(acceptData?.error || 'Meta rejected call accept');
          setConversationError(`Call accept failed: ${errMsg}`);
        }

        if (phone) await loadCalls(phone);
        else if (selectedPhoneRef.current) await loadCalls(selectedPhoneRef.current);
        switchToActive();
      } catch (e: any) {
        setConversationError(e?.message || 'Failed to accept incoming call');
      } finally {
        setCallControlLoading(null);
      }
    },
    [activeCall?.customer_phone, activeCall?.id, callControlLoading, loadCalls]
  );

  const handleSendText = useCallback(async () => {
    const text = draftMessage.trim();
    if (!selectedPhone) {
      setSendError('Select a chat first');
      return;
    }
    if (sendingMessage) return;
    if (composerMode === 'template') {
      if (!selectedTemplateName) {
        setSendError('Select a template first (or switch Back to text)');
        return;
      }
    } else if (!text && !selectedMediaFile) {
      setSendError('Type a message or attach a file');
      return;
    }
    setSendingMessage(true);
    setSendError('');
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
        setSendError(data?.error || `Send failed (HTTP ${res.status})`);
        return;
      }
      setDraftMessage('');
      setSelectedMediaFile(null);
      if (composerMode === 'template') {
        setTemplateParamsDraft('');
        setComposerMode('text');
      }
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      // Reload conversation first so bubble appears immediately
      await loadConversation(selectedPhone);
      await loadChats(true);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Send failed');
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
                    {isOutboundActiveCall && !isOutboundConnected ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 animate-pulse">
                        {activeCallState === 'RINGING' ? 'Ringing' : 'Calling'}
                      </span>
                    ) : (hasLiveConnectedCall || isOutboundConnected) ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-sky-700">
                        {String(Math.floor(activeCallElapsed / 60)).padStart(2, '0')}:
                        {String(activeCallElapsed % 60).padStart(2, '0')}
                      </span>
                    ) : null}
                  </div>
                </div>
                {selectedPhone ? (
                  <button
                    type="button"
                    onClick={() => {
                      void Promise.all([loadConversation(selectedPhone), loadChats(true)]);
                    }}
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
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] p-4">
              {!selectedPhone ? (
                <div className="flex h-full items-center justify-center text-gray-600">
                  Select a chat from the center column.
                </div>
              ) : conversationLoading && conversation.length === 0 ? (
                <div className="flex h-full items-center justify-center gap-2 text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading conversation...
                </div>
              ) : conversation.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
                  <span>No messages yet.</span>
                  {conversationError ? (
                    <span className="text-sm text-red-600">{conversationError}</span>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  {conversationError ? (
                    <div className="mx-auto w-fit rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                      {conversationError}
                    </div>
                  ) : null}
                  {callLoading ? (
                    <div className="mx-auto w-fit rounded-full bg-white/80 px-3 py-1 text-[11px] text-gray-600">
                      Loading calls...
                    </div>
                  ) : null}
                  {(() => {
                    // Merge calls and messages into one timeline
                    const callItems = callLogs.map((call) => ({
                      type: 'call' as const,
                      ts: new Date(call.started_at || call.created_at || 0).getTime(),
                      call,
                    }));
                    const msgItems = conversation
                      .filter((msg) => {
                        const mt = String(msg.message_type || '').trim().toUpperCase();
                        if (mt !== 'INTERACTIVE') return true;
                        const payloadStr = JSON.stringify(msg?.payload || '').toLowerCase();
                        if (payloadStr.includes('call_permission') || payloadStr.includes('calling_permission') || payloadStr.includes('calling')) return false;
                        const tpl = String(msg?.template_name || '').toLowerCase();
                        if (tpl.includes('call') || tpl.includes('calling')) return false;
                        return true;
                      })
                      .map((msg) => ({
                        type: 'message' as const,
                        ts: new Date(msg.status_at || msg.created_at || 0).getTime(),
                        msg,
                      }));
                    const timeline = [...callItems, ...msgItems].sort((a, b) => a.ts - b.ts);

                    return timeline.map((item) => {
                      if (item.type === 'call') {
                        const call = item.call;
                        const status = normalizeCallStatus(call.call_status);
                        const inbound = isInboundCallDirection(call.direction);
                        const isCallback = String(call.direction || '').toUpperCase().includes('CALLBACK');
                        const isMissed = ['MISSED', 'REJECTED', 'FAILED'].includes(status);
                        const isRinging = ['RINGING', 'INITIATED', 'NEGOTIATING'].includes(status);
                        const isAccepted = ['ACCEPTED', 'CONNECTED', 'ENDED'].includes(status);
                        const hasRecording = Array.isArray(call.recordings) && call.recordings.length > 0;
                        const recordingUrl = hasRecording
                          ? call.recordings![0].recording_proxy_path || call.recordings![0].recording_url || null
                          : null;
                        let callDuration = call.duration_seconds;
                        if ((callDuration == null || callDuration <= 0) && isAccepted) {
                          const answeredAt = (call.meta as any)?.answered_at;
                          const connectTime = answeredAt || call.started_at;
                          if (connectTime) {
                            const startMs = new Date(connectTime).getTime();
                            const endRef = call.ended_at || call.updated_at || call.created_at;
                            if (endRef) {
                              const endMs = new Date(endRef).getTime();
                              if (endMs > startMs) {
                                callDuration = Math.floor((endMs - startMs) / 1000);
                              }
                            }
                          }
                        }
                        const iconColor = isMissed
                          ? 'text-red-500'
                          : isAccepted
                          ? 'text-green-600'
                          : isRinging
                          ? 'text-orange-500'
                          : inbound
                          ? 'text-blue-600'
                          : 'text-[#0f766e]';
                        const bgColor = isMissed
                          ? 'bg-red-50 border-red-200'
                          : isRinging
                          ? 'bg-orange-50 border-orange-200'
                          : isAccepted
                          ? 'bg-white border-[#d8dee3]'
                          : 'bg-white border-[#d8dee3]';
                        const label = isCallback
                          ? 'Callback request'
                          : isMissed
                          ? `${inbound ? 'Missed call' : 'Not answered'}`
                          : isRinging
                          ? `${inbound ? 'Incoming' : 'Outgoing'} call · Ringing`
                          : isAccepted
                          ? `${inbound ? 'Incoming' : 'Outgoing'} call`
                          : `${inbound ? 'Incoming' : 'Outgoing'} call · ${status}`;
                        return (
                          <div key={`call-${call.id}`} className="flex justify-center">
                            <div
                              className={`flex w-[280px] flex-col rounded-xl border ${bgColor} px-4 py-2.5 text-[12px] shadow-sm`}
                            >
                              <button
                                type="button"
                                onClick={() => setCallInfoOpen(call)}
                                className="flex w-full items-center gap-2.5 hover:opacity-80"
                              >
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isMissed ? 'bg-red-100' : isRinging ? 'bg-orange-100' : 'bg-green-100'}`}>
                                  {isMissed ? (
                                    <PhoneOff className={`h-4 w-4 ${iconColor}`} />
                                  ) : inbound ? (
                                    <PhoneIncoming className={`h-4 w-4 ${iconColor}`} />
                                  ) : (
                                    <PhoneOutgoing className={`h-4 w-4 ${iconColor}`} />
                                  )}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                                  <span className={`text-[13px] font-semibold ${isMissed ? 'text-red-700' : 'text-[#334155]'}`}>{label}</span>
                                  <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                    <span>{formatMessageTime(call.started_at || call.created_at || null)}</span>
                                    {isAccepted && callDuration != null && callDuration > 0 ? (
                                      <>
                                        <span className="text-gray-400">·</span>
                                        <span className="font-semibold text-green-700">{formatDuration(callDuration)}</span>
                                      </>
                                    ) : isAccepted ? (
                                      <>
                                        <span className="text-gray-400">·</span>
                                        <span className="font-medium text-gray-500">Connected</span>
                                      </>
                                    ) : null}
                                  </span>
                                </span>
                              </button>
                              {isAccepted && hasRecording && recordingUrl ? (
                                <div className="mt-2 rounded-lg bg-[#f0f2f5] p-1.5">
                                  <audio
                                    controls
                                    preload="none"
                                    src={recordingUrl}
                                    className="h-8 w-full"
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      const msg = item.msg;
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

                    // Extract interactive message text from payload
                    const extractInteractiveText = (): string => {
                      const p = msg?.payload || {};
                      const interactive =
                        p?.interactive ||
                        p?.request?.interactive ||
                        p?.messages?.[0]?.interactive;
                      if (interactive) {
                        const itype = String(interactive.type || '').trim().toLowerCase();
                        if (itype === 'button_reply') {
                          return String(interactive.button_reply?.title || interactive.button_reply?.id || '').trim();
                        }
                        if (itype === 'list_reply') {
                          const title = String(interactive.list_reply?.title || '').trim();
                          const desc = String(interactive.list_reply?.description || '').trim();
                          return desc ? `${title}\n${desc}` : title;
                        }
                        if (itype === 'nfm_reply') {
                          const body = String(interactive.nfm_reply?.body || interactive.nfm_reply?.name || '').trim();
                          const responseJson = interactive.nfm_reply?.response_json;
                          if (responseJson) {
                            try {
                              const parsed = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
                              if (parsed?.flow_token?.includes('call_permission') || parsed?.screen === 'calling_permission') {
                                return parsed?.submitted === true || parsed?.status === 'approved'
                                  ? 'Call permission approved'
                                  : 'Call permission response received';
                              }
                            } catch { /* ignore */ }
                          }
                          return body || 'Form reply';
                        }
                        if (itype === 'call_permission_request' || itype === 'calling_permission') {
                          return 'Call permission request';
                        }
                        const headerText = String(interactive?.header?.text || '').trim();
                        const bodyText = String(interactive?.body?.text || '').trim();
                        const footerText = String(interactive?.footer?.text || '').trim();
                        const combined = [headerText, bodyText, footerText].filter(Boolean).join('\n');
                        if (combined) return combined;
                      }
                      // Deeper payload search for any readable text
                      const deepText =
                        String(p?.text?.body || p?.body?.text || p?.text || '').trim() ||
                        String(p?.request?.text?.body || p?.request?.body || '').trim() ||
                        String(p?.messages?.[0]?.text?.body || p?.messages?.[0]?.body || '').trim();
                      if (deepText && deepText !== '[object Object]') return deepText;
                      // Check if it's a call-related event
                      if (p?.calls || p?.call_id || p?.request?.call_id) return 'Voice call event';
                      return '';
                    };

                    const interactiveText = msgType === 'INTERACTIVE' ? extractInteractiveText() : '';
                    // Detect call-related messages
                    const isCallRelated =
                      msgType === 'INTERACTIVE' &&
                      !interactiveText &&
                      (String(msg?.template_name || '').toLowerCase().includes('call') ||
                        String(JSON.stringify(msg?.payload || '')).toLowerCase().includes('call_permission') ||
                        String(JSON.stringify(msg?.payload || '')).toLowerCase().includes('calling'));
                    const callEventText = isCallRelated ? 'Call permission' : '';

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
                      interactiveText ||
                      callEventText ||
                      String(msg.media_caption || '').trim() ||
                      mediaLabel ||
                      (msgType && msgType !== 'TEXT' && msgType !== 'INTERACTIVE' ? msgType : '—');
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
                          {(() => {
                            // Extract media URL from message or payload
                            const rawAudioId =
                              msg.payload?.audio?.id ||
                              msg.payload?.messages?.[0]?.audio?.id ||
                              null;
                            const rawImageId =
                              msg.payload?.messages?.[0]?.image?.id ||
                              msg.payload?.image?.id ||
                              null;
                            const rawVideoId =
                              msg.payload?.messages?.[0]?.video?.id ||
                              msg.payload?.video?.id ||
                              null;
                            const rawDocId =
                              msg.payload?.messages?.[0]?.document?.id ||
                              msg.payload?.document?.id ||
                              null;
                            const mediaUrl =
                              msg.media_url ||
                              msg.payload?.media_url ||
                              msg.payload?.request?.media_url ||
                              msg.payload?.image?.link ||
                              msg.payload?.video?.link ||
                              msg.payload?.audio?.link ||
                              msg.payload?.document?.link ||
                              msg.payload?.sticker?.link ||
                              (rawAudioId ? `/api/whatsapp/media/${encodeURIComponent(rawAudioId)}` : null) ||
                              (rawImageId ? `/api/whatsapp/media/${encodeURIComponent(rawImageId)}` : null) ||
                              (rawVideoId ? `/api/whatsapp/media/${encodeURIComponent(rawVideoId)}` : null) ||
                              (rawDocId ? `/api/whatsapp/media/${encodeURIComponent(rawDocId)}` : null) ||
                              null;
                            const mediaMime = String(msg.media_mime_type || msg.payload?.media_mime_type || '').toLowerCase();

                            // Extract location
                            const loc =
                              msg.payload?.location ||
                              msg.payload?.messages?.[0]?.location ||
                              msg.payload?.request?.location ||
                              null;
                            const hasLocation = loc && (loc.latitude || loc.longitude);
                            const locLat = Number(loc?.latitude || 0);
                            const locLng = Number(loc?.longitude || 0);
                            const locName = String(loc?.name || '').trim();
                            const locAddr = String(loc?.address || '').trim();
                            const locUrl = hasLocation
                              ? loc?.url || `https://www.google.com/maps?q=${locLat},${locLng}`
                              : null;

                            return (
                              <>
                                {/* Location */}
                                {hasLocation ? (
                                  <a
                                    href={locUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mb-1 block overflow-hidden rounded-lg"
                                  >
                                    <img
                                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${locLat},${locLng}&zoom=15&size=280x150&markers=color:red%7C${locLat},${locLng}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`}
                                      alt="Location"
                                      className="h-[120px] w-full rounded-lg object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    <div className="mt-1 text-[12px]">
                                      {locName ? <div className="font-semibold text-[#111b21]">{locName}</div> : null}
                                      {locAddr ? <div className="text-gray-500">{locAddr}</div> : (
                                        <div className="text-gray-500">{locLat.toFixed(5)}, {locLng.toFixed(5)}</div>
                                      )}
                                    </div>
                                  </a>
                                ) : null}

                                {/* Image */}
                                {mediaUrl && (msgType === 'IMAGE' || mediaMime.startsWith('image/')) ? (
                                  <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                                    <img
                                      src={mediaUrl}
                                      alt="Photo"
                                      className="max-h-[240px] w-full rounded-lg object-cover"
                                      loading="lazy"
                                    />
                                  </a>
                                ) : null}

                                {/* Video */}
                                {mediaUrl && (msgType === 'VIDEO' || mediaMime.startsWith('video/')) ? (
                                  <div className="mb-1">
                                    <video
                                      controls
                                      preload="metadata"
                                      src={mediaUrl}
                                      className="max-h-[240px] w-full rounded-lg"
                                    />
                                  </div>
                                ) : null}

                                {/* Audio */}
                                {(msgType === 'AUDIO' || mediaMime.startsWith('audio/')) ? (
                                  <div className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: outbound ? 'rgba(0,0,0,0.06)' : '#f0f2f5' }}>
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884]">
                                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
                                    </span>
                                    {mediaUrl ? (
                                      <audio controls preload="none" src={mediaUrl} className="h-8 min-w-0 flex-1" style={{ maxWidth: '220px' }} />
                                    ) : (
                                      <span className="text-xs text-gray-500">Audio not available</span>
                                    )}
                                  </div>
                                ) : null}

                                {/* Document */}
                                {mediaUrl && (msgType === 'DOCUMENT' || mediaMime.startsWith('application/')) && !mediaMime.startsWith('audio/') && !mediaMime.startsWith('image/') && !mediaMime.startsWith('video/') ? (
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mb-1 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[12px] text-blue-600 hover:underline"
                                  >
                                    <span className="text-lg">📄</span>
                                    <span className="truncate">{msg.payload?.document?.filename || msg.payload?.request?.filename || 'Document'}</span>
                                  </a>
                                ) : null}

                                {/* Sticker */}
                                {mediaUrl && msgType === 'STICKER' ? (
                                  <img
                                    src={mediaUrl}
                                    alt="Sticker"
                                    className="mb-1 h-[120px] w-[120px] object-contain"
                                    loading="lazy"
                                  />
                                ) : null}

                                {/* Call-related message */}
                                {isCallRelated || callPermissionState ? (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <PhoneCall className="h-4 w-4 flex-shrink-0" />
                                    <span className="whitespace-pre-wrap break-words">{bubbleText}</span>
                                  </div>
                                ) : !hasLocation && msgType !== 'AUDIO' && !mediaMime.startsWith('audio/') && !(mediaUrl && (msgType === 'IMAGE' || msgType === 'STICKER') && !String(msg.media_caption || msg.text_body || '').trim()) ? (
                                  <div className="whitespace-pre-wrap break-words">{bubbleText}</div>
                                ) : String(msg.media_caption || '').trim() ? (
                                  <div className="whitespace-pre-wrap break-words">{String(msg.media_caption || '').trim()}</div>
                                ) : null}
                              </>
                            );
                          })()}
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
                    });
                  })()}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white p-3">
              {sendError ? (
                <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {sendError}
                </div>
              ) : null}
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
        incomingPopup.phase === 'ringing' ? (
          /* ── Ringing popup ──────────────────────────────────── */
          <div className="fixed right-4 top-20 z-[6400] w-72 overflow-hidden rounded-2xl border border-green-200 bg-white shadow-2xl">
            {/* green header */}
            <div className="flex items-center gap-2 bg-green-600 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <PhoneIncoming className="h-4 w-4 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-green-100">
                  Incoming call
                </p>
                <p className="truncate text-sm font-bold text-white">
                  {formatPhone(incomingPopup.phone)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (incomingPopup?.callId) dismissedCallIdsRef.current.add(incomingPopup.callId);
                  setIncomingPopup(null);
                }}
                className="rounded p-1 text-white/70 hover:text-white"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* action row */}
            <div className="flex gap-2 p-3">
              <button
                type="button"
                onClick={() => void handleAcceptIncomingCall(incomingPopup.callId, incomingPopup.phone)}
                disabled={callControlLoading !== null}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {callControlLoading === 'resume' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneIncoming className="h-4 w-4" />
                )}
                Accept
              </button>
              <button
                type="button"
                onClick={() => void handleIncomingPopupAction('hangup')}
                disabled={callControlLoading !== null}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {callControlLoading === 'hangup' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneOff className="h-4 w-4" />
                )}
                Reject
              </button>
            </div>
          </div>
        ) : (
          /* ── Active call panel (after accept) ───────────────── */
          <div className="fixed right-4 top-20 z-[6400] w-64 overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
            {/* call info */}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500">
                <PhoneIncoming className="h-4 w-4 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {formatPhone(incomingPopup.phone)}
                </p>
                <p className="text-[12px] font-mono text-green-400">
                  {String(Math.floor(activeCallElapsed / 60)).padStart(2, '0')}:
                  {String(activeCallElapsed % 60).padStart(2, '0')}
                </p>
              </div>
            </div>
            {/* controls */}
            <div className="flex items-center justify-around border-t border-white/10 px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCallMuted((prev) => {
                    const next = !prev;
                    // Actually mute/unmute the microphone track
                    activeAudioStreamRef.current?.getAudioTracks().forEach((t) => {
                      t.enabled = !next;
                    });
                    return next;
                  });
                }}
                className={`flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-full transition-colors ${callMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={callMuted ? 'Unmute' : 'Mute'}
              >
                {callMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span className="text-[10px] font-medium">{callMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleIncomingPopupAction('hangup')}
                disabled={callControlLoading !== null}
                className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                title="Hang up"
              >
                {callControlLoading !== null ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <PhoneOff className="h-6 w-6" />
                )}
                <span className="text-[10px] font-medium">End</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhone(incomingPopup.phone)}
                className="flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-full bg-white/10 text-white hover:bg-white/20"
                title="Open chat"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="text-[10px] font-medium">Chat</span>
              </button>
            </div>
          </div>
        )
      ) : null}
      {isOutboundActiveCall && !incomingPopup ? (
        <div className="fixed right-4 top-20 z-[6400] w-64 overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500">
              <PhoneOutgoing className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                {isOutboundConnected
                  ? 'Connected'
                  : activeCallState === 'RINGING'
                    ? 'Ringing…'
                    : 'Calling…'}
              </p>
              <p className="truncate text-sm font-bold text-white">
                {formatPhone(activeCall?.customer_phone || selectedPhone)}
              </p>
              {isOutboundConnected ? (
                <p className="text-[12px] font-mono text-green-400">
                  {String(Math.floor(activeCallElapsed / 60)).padStart(2, '0')}:
                  {String(activeCallElapsed % 60).padStart(2, '0')}
                </p>
              ) : (
                <p className="text-[12px] text-blue-400 animate-pulse">
                  {activeCallState === 'RINGING' ? 'Waiting for answer…' : 'Connecting…'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-around border-t border-white/10 px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={() => {
                setCallMuted((prev) => {
                  const next = !prev;
                  activeAudioStreamRef.current?.getAudioTracks().forEach((t) => {
                    t.enabled = !next;
                  });
                  return next;
                });
              }}
              className={`flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-full transition-colors ${callMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={callMuted ? 'Unmute' : 'Mute'}
            >
              {callMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              <span className="text-[10px] font-medium">{callMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCallControl('hangup')}
              disabled={callControlLoading !== null}
              className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              title="Hang up"
            >
              {callControlLoading !== null ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <PhoneOff className="h-6 w-6" />
              )}
              <span className="text-[10px] font-medium">End</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeCall?.customer_phone)
                  setSelectedPhone(normalizePhone(activeCall.customer_phone));
              }}
              className="flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-full bg-white/10 text-white hover:bg-white/20"
              title="Open chat"
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-[10px] font-medium">Chat</span>
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
