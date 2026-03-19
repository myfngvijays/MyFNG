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
  Minus,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  PlayCircle,
  Send,
  Volume2,
  Video,
  Share2,
  UserPlus,
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
  recording_url?: string | null;
  recording_proxy_path?: string | null;
};

type CallLog = {
  id: string;
  direction: string;
  call_status: string;
  customer_phone: string;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  duration_seconds?: number | null;
  error_message?: string | null;
  meta?: Record<string, unknown> | null;
  recordings?: CallRecording[];
  sessions?: Array<{
    id: string;
    provider_session_id?: string | null;
    session_state?: string | null;
    offer_sdp?: string | null;
    meta?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
};

type ChatAssigneeOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role_code: string;
};

type ChatAssignment = {
  phone: string;
  assigned_to_ids: string[];
  assigned_to_names: string[];
  assigned_by: string | null;
  assigned_by_name: string | null;
  assigned_note: string | null;
  assigned_at: string | null;
  updated_at: string | null;
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

function formatPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone || '—';
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

function isInboundCallDirection(direction: unknown): boolean {
  const dir = String(direction || '').trim().toUpperCase();
  return ['INBOUND', 'USER_INITIATED', 'CUSTOMER_INITIATED'].includes(dir);
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

function normalizeSdpForBrowser(sdp: string): string {
  const normalized = String(sdp || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map((line) => line.trimEnd());
  const compact = lines.filter((line) => line.length > 0).join('\r\n');
  return compact ? `${compact}\r\n` : '';
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

function renderLinkedText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
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
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<ChatAssigneeOption[]>([]);
  const [selectedAssignee1Id, setSelectedAssignee1Id] = useState('');
  const [selectedAssignee2Id, setSelectedAssignee2Id] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [chatAssignment, setChatAssignment] = useState<ChatAssignment | null>(null);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
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
  const [activeCallElapsed, setActiveCallElapsed] = useState(0);
  const [isRtcConnected, setIsRtcConnected] = useState(false);
  // Stores the call ID that was explicitly "answered" in the preview (agent clicked Accept).
  // Using an ID instead of a boolean ensures that a new call always shows Accept/Decline
  // regardless of component state — a new call ID will never match an old one.
  const [answeredPreviewCallId, setAnsweredPreviewCallId] = useState<string | null>(null);
  // Tracks the call ID that was locally ended (cleanup ran) but call log may not have updated yet.
  const [locallyEndedCallId, setLocallyEndedCallId] = useState<string | null>(null);
  // True when the user clicked Call from this preview — any active call should be treated as outbound.
  const [locallyInitiatedOutbound, setLocallyInitiatedOutbound] = useState(false);
  const [callOverlayMinimized, setCallOverlayMinimized] = useState(false);
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
  const activePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const activeAudioStreamRef = useRef<MediaStream | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeCallRef = useRef<string | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  // Multi-select forward state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [forwardPhone, setForwardPhone] = useState('');
  const [forwardSending, setForwardSending] = useState(false);
  const [forwardRecentChats, setForwardRecentChats] = useState<{ phone: string; preview: string; last_message_at: string }[]>([]);

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
    const now = Date.now();
    const STALE_PRE_CONNECT_MS = 2 * 60 * 1000; // 2 min
    const STALE_CONNECTED_MS = 4 * 60 * 60 * 1000; // 4 hours
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
        if (['CONNECTED'].includes(status) && age > STALE_CONNECTED_MS) return false;
        return true;
      }) || null
    );
  }, [callLogs]);
  const activeCallState = useMemo(() => {
    if (!activeCall) return 'IDLE';
    const callStatus = normalizeCallStatus(activeCall.call_status);
    if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus)) return callStatus;
    // For the shared modal, always prefer call_status from the DB log over session_state.
    // session_state can become 'CONNECTED' from backend SDP exchange even before THIS client
    // has accepted the call, which causes the UI to skip Accept/Decline.
    if (callStatus && callStatus !== 'IDLE') return callStatus;
    const sessionState = String(activeCall?.sessions?.[0]?.session_state || '').trim().toUpperCase();
    if (sessionState) return sessionState;
    return 'IDLE';
  }, [activeCall]);
  const hasInboundOfferOnActiveCall = useMemo(() => {
    if (!activeCall || !Array.isArray(activeCall.sessions)) return false;
    return activeCall.sessions.some((row: any) => {
      const offer = String(row?.offer_sdp || '').trim();
      if (!offer) return false;
      const source = String((row?.meta as any)?.source || '').trim().toLowerCase();
      return !source || source.includes('webhook') || source.includes('incoming');
    });
  }, [activeCall]);
  const isInboundLikeCall = useMemo(() => {
    if (!activeCall) return false;
    if (locallyInitiatedOutbound) return false;
    if (isInboundCallDirection(activeCall.direction)) return true;
    if (hasInboundOfferOnActiveCall) return true;
    const dir = String(activeCall.direction || '').trim().toUpperCase();
    if (dir === 'OUTBOUND') return false;
    if (!dir || dir === 'UNKNOWN') return true;
    return false;
  }, [activeCall, hasInboundOfferOnActiveCall, locallyInitiatedOutbound]);
  const isIncomingCall = useMemo(() => {
    if (!activeCall) return false;
    return isInboundLikeCall;
  }, [activeCall, isInboundLikeCall]);
  const isOutboundActiveCall = useMemo(() => {
    if (!activeCall) return false;
    if (isInboundLikeCall) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    return !['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state);
  }, [activeCall, activeCallState, isInboundLikeCall]);
  const isIncomingRingingCall = useMemo(() => {
    if (!isIncomingCall) return false;
    if (isRtcConnected) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    if (['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state)) return false;
    // Any inbound-like active call that hasn't been locally accepted shows as ringing.
    return true;
  }, [isIncomingCall, activeCallState, isRtcConnected]);
  const outboundAnsweredInPreview = answeredPreviewCallId != null && activeCall?.id === answeredPreviewCallId;
  const hasLiveConnectedCall = useMemo(() => {
    if (!activeCall) return false;
    if (locallyEndedCallId === activeCall.id) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    if (['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state)) return false;
    if (!isInboundLikeCall) {
      return outboundAnsweredInPreview || isRtcConnected || ['ANSWERED', 'ACCEPTED', 'CONNECTED'].includes(state);
    }
    return isRtcConnected;
  }, [activeCall, activeCallState, outboundAnsweredInPreview, isRtcConnected, isInboundLikeCall, locallyEndedCallId]);
  const hasOngoingCall = useMemo(() => {
    if (locallyEndedCallId && activeCall?.id && locallyEndedCallId === activeCall.id) return false;
    const state = String(activeCallState || '').trim().toUpperCase();
    return !['ENDED', 'FAILED', 'MISSED', 'REJECTED', 'IDLE'].includes(state);
  }, [activeCallState, locallyEndedCallId, activeCall?.id]);
  const callScreenStatus = useMemo(() => {
    if (hasLiveConnectedCall) return 'Connected';
    if (isIncomingRingingCall) return 'Incoming call...';
    if (isOutboundActiveCall && !outboundAnsweredInPreview) return 'Ringing...';
    const state = String(activeCallState || '').toUpperCase();
    if (state === 'RINGING' || state === 'INITIATED') return 'Ringing...';
    return 'Calling...';
  }, [hasLiveConnectedCall, activeCallState, isIncomingRingingCall, isOutboundActiveCall, outboundAnsweredInPreview]);

  useEffect(() => {
    if (hasOngoingCall) return;
    connectedAtRef.current = null;
    recordingStartedAtRef.current = null;
    setIsRtcConnected(false);
    setAnsweredPreviewCallId(null);
    setLocallyInitiatedOutbound(false);
  }, [hasOngoingCall]);

  useEffect(() => {
    if (!activeCall) return;
    if (isInboundLikeCall) return;
    const state = String(activeCallState || '').trim().toUpperCase();
    if (!['ANSWERED', 'ACCEPTED', 'CONNECTED'].includes(state)) return;
    if (connectedAtRef.current == null) connectedAtRef.current = Date.now();
    if (answeredPreviewCallId !== activeCall.id) setAnsweredPreviewCallId(activeCall.id);
  }, [activeCall, activeCallState, answeredPreviewCallId, isInboundLikeCall]);

  useEffect(() => {
    activeCallRef.current = activeCall?.id || null;
    if (activeCall?.id && locallyEndedCallId && activeCall.id !== locallyEndedCallId) {
      setLocallyEndedCallId(null);
    }
  }, [activeCall?.id, locallyEndedCallId]);

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
      // ignore
    }
  }, []);

  const cleanupCallMedia = useCallback(() => {
    const endingCallId = activeCallRef.current;
    if (endingCallId) setLocallyEndedCallId(endingCallId);
    if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
      activeRecorderRef.current.stop();
    }
    activeRecorderRef.current = null;
    recordedChunksRef.current = [];
    recordingStartedAtRef.current = null;
    connectedAtRef.current = null;
    setIsRtcConnected(false);
    setAnsweredPreviewCallId(null);
    if (activePeerConnectionRef.current) {
      activePeerConnectionRef.current.close();
      activePeerConnectionRef.current = null;
    }
    if (activeAudioStreamRef.current) {
      activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      activeAudioStreamRef.current = null;
    }
    document.getElementById('wa-mobile-call-audio')?.remove();
  }, []);

  const loadCallsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const patchCallStatusLocal = useCallback(
    async (
      callId: string,
      status: 'ACCEPTED' | 'CONNECTED' | 'ENDED',
      extra?: { duration_seconds?: number; ended_at?: string }
    ) => {
      if (!callId) return;
      try {
        await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call_status: status,
            ...(extra || {}),
          }),
        });
      } catch {
        // best-effort patch; live UI should continue even if this fails
      }
    },
    []
  );

  const buildLiveCallOffer = useCallback(async (): Promise<BrowserCallOffer> => {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      throw new Error('Browser does not support WebRTC call offer generation');
    }

    cleanupCallMedia();

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
      const endedAtIso = new Date().toISOString();
      const elapsedSeconds =
        connectedAtRef.current != null ? Math.max(1, Math.floor((Date.now() - connectedAtRef.current) / 1000)) : undefined;
      if (cid) {
        void patchCallStatusLocal(cid, 'ENDED', {
          ended_at: endedAtIso,
          ...(elapsedSeconds ? { duration_seconds: elapsedSeconds } : {}),
        });
      }
      if (cid) {
        fetch(`/api/whatsapp/calls/${encodeURIComponent(cid)}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hangup' }),
        }).catch(() => {});
      }
      cleanupCallMedia();
      setActiveCallElapsed(0);
      void loadCallsRef.current();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const cid = activeCallRef.current;
        if (!connectedAtRef.current) connectedAtRef.current = Date.now();
        setIsRtcConnected(true);
        if (cid) {
          setAnsweredPreviewCallId(cid);
          void patchCallStatusLocal(cid, 'CONNECTED');
        }
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        if (!pc.remoteDescription) {
          // Outbound call: Meta never sent SDP answer so ICE timed out.
          // Release local resources but keep the call alive — status polling
          // will detect the real state from Meta's side.
          if (activePeerConnectionRef.current === pc) {
            pc.close();
            activePeerConnectionRef.current = null;
          }
          if (activeAudioStreamRef.current) {
            activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
            activeAudioStreamRef.current = null;
          }
          return;
        }
        finalizeOngoingCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
        if (!pc.remoteDescription) {
          if (activePeerConnectionRef.current === pc) {
            pc.close();
            activePeerConnectionRef.current = null;
          }
          if (activeAudioStreamRef.current) {
            activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
            activeAudioStreamRef.current = null;
          }
          return;
        }
        finalizeOngoingCall();
      }
    };

    pc.ontrack = (ev) => {
      const cid = activeCallRef.current;
      if (!connectedAtRef.current) connectedAtRef.current = Date.now();
      setIsRtcConnected(true);
      if (cid) {
        setAnsweredPreviewCallId(cid);
        void patchCallStatusLocal(cid, 'CONNECTED');
      }
      ev.track.onended = () => finalizeOngoingCall();

      const remoteStream = ev.streams[0] || new MediaStream([ev.track]);
      const existing = document.getElementById('wa-mobile-call-audio') as HTMLAudioElement | null;
      if (existing) {
        existing.srcObject = remoteStream;
        existing.play().catch(() => {});
      } else {
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = 'wa-mobile-call-audio';
        remoteAudio.autoplay = true;
        remoteAudio.setAttribute('playsinline', 'true');
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
          if (currentCallId) void saveCallRecording(currentCallId, recordedChunksRef.current, elapsedSec);
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
  }, [cleanupCallMedia, saveCallRecording, patchCallStatusLocal]);
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
    if (!hasOngoingCall) {
      setCallOverlayMinimized(false);
    }
  }, [hasOngoingCall, isOpen]);

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

  const loadChatAssignment = useCallback(async () => {
    if (!waPhone) {
      setAssigneeOptions([]);
      setSelectedAssignee1Id('');
      setSelectedAssignee2Id('');
      setChatAssignment(null);
      setAssignmentNote('');
      return;
    }
    setAssignmentLoading(true);
    try {
      const params = new URLSearchParams({ phone: waPhone });
      const res = await fetch(`/api/whatsapp/chats/assignment?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load assignment');
      }
      const options = Array.isArray(data?.employees) ? data.employees : [];
      const assignment = data?.assignment || null;
      const assignedToIds = Array.isArray(assignment?.assigned_to_ids)
        ? assignment.assigned_to_ids.map((value: any) => String(value || '').trim()).filter(Boolean)
        : [];
      setAssigneeOptions(options);
      setChatAssignment(assignment);
      setSelectedAssignee1Id(String(assignedToIds[0] || '').trim());
      setSelectedAssignee2Id(String(assignedToIds[1] || '').trim());
      setAssignmentNote(String(assignment?.assigned_note || '').trim());
    } catch (error: any) {
      setAssigneeOptions([]);
      setChatAssignment(null);
      setSelectedAssignee1Id('');
      setSelectedAssignee2Id('');
      setAssignmentNote('');
      toast.error(error?.message || 'Failed to load chat assignment');
    } finally {
      setAssignmentLoading(false);
    }
  }, [waPhone]);

  const handleSaveAssignment = useCallback(async () => {
    if (!waPhone) {
      toast.error('Customer phone not available');
      return;
    }
    const assignedToIds = Array.from(
      new Set([selectedAssignee1Id, selectedAssignee2Id].map((value) => String(value || '').trim()).filter(Boolean))
    );
    if (assignedToIds.length > 2) {
      toast.error('You can assign this chat to at most 2 employees');
      return;
    }
    setAssignmentSaving(true);
    try {
      const res = await fetch('/api/whatsapp/chats/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: waPhone,
          assigned_to_ids: assignedToIds,
          assigned_note: assignmentNote || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save assignment');
      }
      toast.success(assignedToIds.length > 0 ? 'Chat assigned successfully' : 'Chat assignment cleared');
      await loadChatAssignment();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save assignment');
    } finally {
      setAssignmentSaving(false);
    }
  }, [waPhone, selectedAssignee1Id, selectedAssignee2Id, assignmentNote, loadChatAssignment]);

  useEffect(() => {
    if (!isOpen) return;
    void loadChatAssignment();
  }, [isOpen, loadChatAssignment]);

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
  loadCallsRef.current = loadCalls;

  const handleCallAction = useCallback(
    async (action: 'initiate' | 'callback_request') => {
      if (!waPhone || callActionLoading) return;
      let sessionPayload: BrowserCallOffer | null = null;
      if (action === 'initiate') {
        const proceed = window.confirm(
          'Confirm customer opt-in for WhatsApp call before placing the call.'
        );
        if (!proceed) return;
        setCallOverlayMinimized(false);
        connectedAtRef.current = null;
        setIsRtcConnected(false);
        setAnsweredPreviewCallId(null);
        setLocallyInitiatedOutbound(true);
        try {
          sessionPayload = await buildLiveCallOffer();
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
        const initAnswerSdp = String(data?.answer_sdp || '').trim();
        if (initAnswerSdp) {
          const pc = activePeerConnectionRef.current;
          if (pc && pc.signalingState !== 'closed' && !pc.remoteDescription) {
            try {
              const normalized = normalizeSdpForBrowser(initAnswerSdp);
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: normalized })
              );
            } catch {
              // retried by polling
            }
          }
        }
        toast.success(action === 'initiate' ? 'Call request submitted' : 'Callback request submitted');
        await loadCalls();
      } catch {
        toast.error('Call action failed');
      } finally {
        setCallActionLoading(null);
      }
    },
    [buildLiveCallOffer, callActionLoading, loadCalls, waPhone]
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

  const handleAcceptIncomingCall = useCallback(async () => {
    const callId = activeCall?.id;
    if (!callId || callControlLoading) return;
    setCallControlLoading('resume');

    // Clean up any previous session
    if (activePeerConnectionRef.current) {
      activePeerConnectionRef.current.close();
      activePeerConnectionRef.current = null;
    }
    if (activeAudioStreamRef.current) {
      activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      activeAudioStreamRef.current = null;
    }

    try {
      // Get microphone
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeAudioStreamRef.current = audioStream;
      } catch {
        // receive-only mode
      }

      // Fetch SDP offer from session
      let metaOfferSdp: string | null = null;
      try {
        const sessRes = await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/session`, { cache: 'no-store' });
        const sessData = await sessRes.json().catch(() => ({}));
        const sessions = Array.isArray(sessData?.sessions) ? sessData.sessions : [];
        const offerRow = sessions.find((r: any) => String(r?.offer_sdp || '').trim());
        metaOfferSdp = offerRow?.offer_sdp ? String(offerRow.offer_sdp).trim() : null;
      } catch { /* no saved offer */ }

      if (!metaOfferSdp || typeof RTCPeerConnection === 'undefined') {
        toast.error('Cannot accept: no SDP offer received yet.');
        return;
      }

      // Normalize Meta's SDP for browser
      const sanitizedOffer = metaOfferSdp
        .replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .split('\n').map((l) => l.trim()).filter(Boolean).join('\r\n') + '\r\n';

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
        iceTransportPolicy: 'all',
      });
      activePeerConnectionRef.current = pc;

      if (audioStream) {
        audioStream.getAudioTracks().forEach((track) => pc.addTrack(track, audioStream!));
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      // Play remote audio + start recording on track
      pc.ontrack = (ev) => {
        void patchCallStatusLocal(callId, 'CONNECTED');
        const remoteStream = ev.streams[0] || new MediaStream([ev.track]);
        const existing = document.getElementById('wa-mobile-call-audio') as HTMLAudioElement | null;
        if (existing) { existing.srcObject = remoteStream; existing.play().catch(() => {}); }
        else {
          const remoteAudio = document.createElement('audio');
          remoteAudio.id = 'wa-mobile-call-audio';
          remoteAudio.autoplay = true;
          remoteAudio.setAttribute('playsinline', 'true');
          remoteAudio.srcObject = remoteStream;
          document.body.appendChild(remoteAudio);
          remoteAudio.play().catch(() => {});
        }
        try {
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          if (audioStream) ctx.createMediaStreamSource(audioStream).connect(dest);
          ctx.createMediaStreamSource(remoteStream).connect(dest);
          const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
          recordedChunksRef.current = [];
          const startedAtMs = Date.now();
          recordingStartedAtRef.current = startedAtMs;
          recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
          recorder.onstop = () => {
            const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000));
            recordingStartedAtRef.current = null;
            if (callId) void saveCallRecording(callId, recordedChunksRef.current, elapsedSec);
          };
          recorder.start(1000);
          activeRecorderRef.current = recorder;
        } catch { /* recording unavailable */ }
      };

      // Disconnect handlers
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          void patchCallStatusLocal(callId, 'CONNECTED');
        }
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          const endedAtIso = new Date().toISOString();
          const elapsedSeconds =
            connectedAtRef.current != null ? Math.max(1, Math.floor((Date.now() - connectedAtRef.current) / 1000)) : undefined;
          void patchCallStatusLocal(callId, 'ENDED', {
            ended_at: endedAtIso,
            ...(elapsedSeconds ? { duration_seconds: elapsedSeconds } : {}),
          });
          cleanupCallMedia();
          setActiveCallElapsed(0);
          void loadCallsRef.current();
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
          const endedAtIso = new Date().toISOString();
          const elapsedSeconds =
            connectedAtRef.current != null ? Math.max(1, Math.floor((Date.now() - connectedAtRef.current) / 1000)) : undefined;
          void patchCallStatusLocal(callId, 'ENDED', {
            ended_at: endedAtIso,
            ...(elapsedSeconds ? { duration_seconds: elapsedSeconds } : {}),
          });
          cleanupCallMedia();
          setActiveCallElapsed(0);
          void loadCallsRef.current();
        }
      };

      // Set remote offer and create answer
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sanitizedOffer }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering (max 5s)
      if (pc.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve) => {
          const t = window.setTimeout(resolve, 5000);
          pc.addEventListener('icegatheringstatechange', function onState() {
            if (pc.iceGatheringState === 'complete') { window.clearTimeout(t); pc.removeEventListener('icegatheringstatechange', onState); resolve(); }
          });
        });
      }

      const answerSdp = pc.localDescription?.sdp || answer.sdp || null;
      if (!answerSdp) { toast.error('Failed to generate SDP answer'); return; }

      const sendToBackend = async (metaAction: string, sdp: string) => {
        const r = await fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'answer', phone: waPhone || undefined, sdp, sdp_type: 'answer', provider_session_id: null, meta_action: metaAction }),
        });
        return { r, d: await r.json().catch(() => ({})) };
      };

      const { r: preR, d: preD } = await sendToBackend('pre_accept', answerSdp);
      if (!preR.ok || !preD?.success) { toast.error(preD?.error || 'pre_accept failed'); return; }

      // Wait for WebRTC connected (max 10s) — use addEventListener to NOT overwrite the disconnect handler above.
      await new Promise<void>((resolve) => {
        if (pc.connectionState === 'connected') { resolve(); return; }
        const t = window.setTimeout(resolve, 10000);
        const onStateChange = () => {
          if (pc.connectionState === 'connected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            window.clearTimeout(t);
            pc.removeEventListener('connectionstatechange', onStateChange);
            resolve();
          }
        };
        pc.addEventListener('connectionstatechange', onStateChange);
      });

      if (!connectedAtRef.current) connectedAtRef.current = Date.now();
      setIsRtcConnected(true);
      void patchCallStatusLocal(callId, 'ACCEPTED');

      const { r: accR, d: accD } = await sendToBackend('accept', answerSdp);
      if (!accR.ok || !accD?.success) toast.error(accD?.error || 'Call accept failed');

      await loadCallsRef.current();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to accept call');
    } finally {
      setCallControlLoading(null);
    }
  }, [activeCall?.id, callControlLoading, cleanupCallMedia, saveCallRecording, waPhone, patchCallStatusLocal]);

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
        if (action === 'hangup') {
          cleanupCallMedia();
          setActiveCallElapsed(0);
        }
        setCallControlLoading(null);
      }
    },
    [activeCall?.id, callControlLoading, cleanupCallMedia, loadCalls]
  );

  // Super-admin parity: if outbound call stays pre-connect for too long, auto-hangup stale session.
  useEffect(() => {
    if (!isOutboundActiveCall || !activeCall?.id) return;
    const state = String(activeCallState || '').trim().toUpperCase();
    if (!['INITIATED', 'RINGING', 'NEGOTIATING'].includes(state)) return;

    const timeout = window.setTimeout(() => {
      const callId = activeCall.id;
      fetch(`/api/whatsapp/calls/${encodeURIComponent(callId)}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hangup' }),
      }).catch(() => {});
      cleanupCallMedia();
      setActiveCallElapsed(0);
      void loadCalls();
    }, 60_000);

    return () => window.clearTimeout(timeout);
  }, [isOutboundActiveCall, activeCall?.id, activeCallState, cleanupCallMedia, loadCalls]);

  // Outbound call status + SDP polling. Continues even when PeerConnection is null
  // (Meta may close local ICE before sending answer SDP).
  useEffect(() => {
    if (!isOutboundActiveCall || !activeCall?.id) return;

    let cancelled = false;
    const appliedCandidateKeys = new Set<string>();

    const poll = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/whatsapp/calls/${encodeURIComponent(activeCall.id)}/session`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        const callStatus = String(json?.call_status || '').trim().toUpperCase();

        if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus)) {
          cleanupCallMedia();
          setActiveCallElapsed(0);
          await loadCalls();
          return;
        }

        if (['ANSWERED', 'ACCEPTED', 'CONNECTED'].includes(callStatus)) {
          if (!connectedAtRef.current) connectedAtRef.current = Date.now();
          if (activeCall?.id) setAnsweredPreviewCallId(activeCall.id);
        }

        const sessions = Array.isArray(json?.sessions) ? json.sessions : [];
        const candidates = Array.isArray(json?.ice_candidates) ? json.ice_candidates : [];

        const currentPc = activePeerConnectionRef.current;
        if (currentPc && (currentPc.signalingState as string) !== 'closed') {
          if (!currentPc.remoteDescription) {
            let remoteSdp: string | null = null;
            const answerRow = sessions.find((row: any) => String(row?.answer_sdp || '').trim());
            if (answerRow) remoteSdp = String(answerRow.answer_sdp).trim();

            if (!remoteSdp) {
              const webhookRow = sessions.find((row: any) => {
                const sdp = String(row?.offer_sdp || '').trim();
                const source = String((row?.meta as any)?.source || '').trim().toLowerCase();
                return sdp && source.includes('webhook');
              });
              if (webhookRow) remoteSdp = String(webhookRow.offer_sdp).trim();
            }

            if (remoteSdp && (currentPc.signalingState as string) !== 'closed') {
              try {
                const normalized = normalizeSdpForBrowser(remoteSdp);
                await currentPc.setRemoteDescription(
                  new RTCSessionDescription({ type: 'answer', sdp: normalized })
                );
              } catch {
                // retry next poll
              }
            }
          }

          if (currentPc.remoteDescription && candidates.length > 0) {
            for (const cand of candidates) {
              const candidateStr = String(cand?.candidate || '').trim();
              if (!candidateStr) continue;
              const key = `${candidateStr}:${cand?.sdp_mid || ''}:${cand?.sdp_mline_index ?? ''}`;
              if (appliedCandidateKeys.has(key)) continue;
              try {
                await currentPc.addIceCandidate(new RTCIceCandidate({
                  candidate: candidateStr,
                  sdpMid: cand?.sdp_mid ?? undefined,
                  sdpMLineIndex: cand?.sdp_mline_index ?? undefined,
                }));
                appliedCandidateKeys.add(key);
              } catch {
                // ignore invalid/duplicate candidate
              }
            }
          }
        }

        await loadCalls();
      } catch {
        // retry
      }
      if (!cancelled) {
        const currentPc2 = activePeerConnectionRef.current;
        const isConnected = currentPc2?.connectionState === 'connected' && !!currentPc2?.remoteDescription;
        window.setTimeout(poll, isConnected ? 3000 : 2500);
      }
    };

    const timer = window.setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOutboundActiveCall, activeCall?.id, activeCallState, cleanupCallMedia, loadCalls]);

  // Safety-net: poll call status while RTC is connected to detect remote hangup.
  // Also check WebRTC peer connection state directly in case events were missed.
  useEffect(() => {
    if (!isRtcConnected || !activeCall?.id) return;

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;

      const pc = activePeerConnectionRef.current;
      if (pc && ['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanupCallMedia();
        setActiveCallElapsed(0);
        void loadCalls();
        return;
      }

      try {
        const res = await fetch(`/api/whatsapp/calls/${encodeURIComponent(activeCall.id)}/session`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        const callStatus = String(json?.call_status || '').trim().toUpperCase();

        if (['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(callStatus)) {
          cleanupCallMedia();
          setActiveCallElapsed(0);
          await loadCalls();
          return;
        }
      } catch {
        // retry
      }
      if (!cancelled) window.setTimeout(poll, 2000);
    };

    const timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isRtcConnected, activeCall?.id, cleanupCallMedia, loadCalls]);

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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_call_recordings' },
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
    if (isOpen) return;
    cleanupCallMedia();
    setActiveCallElapsed(0);
    setAssignmentPanelOpen(false);
  }, [isOpen, cleanupCallMedia]);

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

  const callLoadScrolledRef = useRef(false);
  useEffect(() => { callLoadScrolledRef.current = false; }, [waPhone]);
  useEffect(() => {
    if (!isOpen || callLoading || callLoadScrolledRef.current) return;
    callLoadScrolledRef.current = true;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      });
    });
  }, [isOpen, callLoading]);

  useEffect(() => {
    if (callPermissionCooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => {
      setCallPermissionTick(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callPermissionCooldownUntil]);

  useEffect(() => {
    if (!isOpen) return;
    if (!hasLiveConnectedCall || !activeCall) {
      setActiveCallElapsed(0);
      return;
    }
    let startMs: number = Date.now();
    if (connectedAtRef.current) {
      // Use actual RTC/accept timestamp for both inbound and outbound
      startMs = connectedAtRef.current;
    } else {
      const sourceTs = String(
        activeCall.started_at || activeCall.updated_at || activeCall.created_at || ''
      ).trim();
      const parsed = sourceTs ? new Date(sourceTs).getTime() : Number.NaN;
      startMs = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
    }
    setActiveCallElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    const id = window.setInterval(() => {
      setActiveCallElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    isOpen,
    hasLiveConnectedCall,
    activeCall?.id,
    activeCall?.started_at,
    activeCall?.updated_at,
    activeCall?.created_at,
  ]);

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

      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id && waPhone) {
          const currentIds = Array.isArray(chatAssignment?.assigned_to_ids) ? chatAssignment.assigned_to_ids : [];
          const alreadyAssigned = currentIds.some((id) => id === authUser.id);
          if (!alreadyAssigned) {
            const newIds = currentIds.length === 0
              ? [authUser.id]
              : currentIds.length === 1
              ? [currentIds[0], authUser.id]
              : currentIds;
            if (!alreadyAssigned && newIds !== currentIds) {
              await fetch('/api/whatsapp/chats/assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: waPhone,
                  assigned_to_ids: newIds,
                  assigned_note: chatAssignment?.assigned_note || '',
                }),
              });
              loadChatAssignment();
            }
          }
        }
      } catch { /* auto-assign is best-effort */ }
    } catch {
      toast.error('Send failed');
    } finally {
      setSending(false);
    }
  };

  const toggleMsgSelect = useCallback((msgId: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMsgIds(new Set());
  }, []);

  useEffect(() => {
    if (!forwardPickerOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/whatsapp/chats?limit=30&scan=5000', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data?.success) return;
        const chats = (Array.isArray(data.chats) ? data.chats : []).map((c: any) => ({
          phone: String(c.phone || ''),
          preview: String(c.last_message_preview || '').slice(0, 60),
          last_message_at: String(c.last_message_at || ''),
        }));
        setForwardRecentChats(chats);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [forwardPickerOpen]);

  const buildForwardPayload = (msg: any, targetPhone: string): Record<string, unknown> | null => {
    const msgType = String(msg.message_type || '').toUpperCase();
    const textBody = String(msg.text_body || '').trim();
    const mediaCaption = String(msg.media_caption || '').trim();
    const mediaUrl = msg.media_url || msg.payload?.image?.link || msg.payload?.video?.link || msg.payload?.audio?.link || msg.payload?.document?.link || null;
    const loc = msg.payload?.location || msg.payload?.messages?.[0]?.location || null;
    const hasLoc = loc && (loc.latitude || loc.longitude);

    if (hasLoc) {
      return { recipient_phone: targetPhone, message_type: 'text', text: `📍 Location: https://www.google.com/maps?q=${loc.latitude},${loc.longitude}` };
    }
    if (mediaUrl && ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(msgType)) {
      const mediaTypeMap: Record<string, string> = { IMAGE: 'image', VIDEO: 'video', AUDIO: 'audio', DOCUMENT: 'document' };
      return {
        recipient_phone: targetPhone,
        message_type: 'media',
        media_type: mediaTypeMap[msgType] || 'document',
        media_url: mediaUrl.startsWith('/') ? `${window.location.origin}${mediaUrl}` : mediaUrl,
        caption: mediaCaption || undefined,
        filename: msg.payload?.document?.filename || undefined,
      };
    }
    const fwdText = textBody || mediaCaption;
    if (!fwdText) return null;
    return { recipient_phone: targetPhone, message_type: 'text', text: fwdText };
  };

  const handleForwardSelected = async () => {
    const targetPhone = normalizePhone(forwardPhone.trim());
    if (!targetPhone || targetPhone.length < 10) {
      toast.error('Valid phone number daalo');
      return;
    }
    const selectedMsgs = messages
      .filter((m) => selectedMsgIds.has(String(m.id || m.provider_message_id || '')))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (selectedMsgs.length === 0) {
      toast.error('Koi message select karo pehle');
      return;
    }

    setForwardSending(true);
    let successCount = 0;
    try {
      for (const msg of selectedMsgs) {
        const payload = buildForwardPayload(msg, targetPhone);
        if (!payload) continue;
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) successCount++;
      }
      if (successCount > 0) {
        toast.success(`${successCount} message${successCount > 1 ? 's' : ''} forwarded to ${targetPhone}`);
      } else {
        toast.error('Forward failed');
      }
      setForwardPickerOpen(false);
      setForwardPhone('');
      exitSelectMode();
    } catch {
      toast.error('Forward failed');
    } finally {
      setForwardSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-[372px] max-w-[95vw] h-[720px] max-h-[94vh] rounded-[2.6rem] bg-[#0f1f2e] p-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.55)]">
        <div className="relative h-full rounded-[2.1rem] bg-[#efeae2] overflow-hidden border border-black/25 flex flex-col">
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
              <button type="button" className="rounded-md p-1 hover:bg-white/10" onClick={onClose} aria-label="Close WhatsApp preview">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-black/10 bg-[#f7f8fa] px-2.5 py-1.5">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-[#d5dbe1] bg-white px-2.5 py-1.5"
              onClick={() => setAssignmentPanelOpen((prev) => !prev)}
            >
              <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#54656f]">
                <UserPlus className="h-3.5 w-3.5" />
                Assign Chat
              </div>
              <div className="flex items-center gap-2">
                {Array.isArray(chatAssignment?.assigned_to_names) && chatAssignment.assigned_to_names.length > 0 ? (
                  <span className="max-w-[140px] truncate text-[10px] font-medium text-[#128c7e]">
                    {chatAssignment.assigned_to_names.join(', ')}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#667781]">Unassigned</span>
                )}
                <span className="text-[10px] font-semibold text-[#128c7e]">{assignmentPanelOpen ? 'Hide' : 'Open'}</span>
              </div>
            </button>
            {assignmentPanelOpen ? (
              <div className="mt-1.5 rounded-lg border border-[#d5dbe1] bg-white p-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    className="rounded-md border border-[#d9dee3] bg-[#f8fafb] px-2 py-1 text-[10px] text-[#111b21] focus:border-[#25D366] focus:bg-white focus:outline-none"
                    value={selectedAssignee1Id}
                    disabled={assignmentLoading || assignmentSaving}
                    onChange={(e) => setSelectedAssignee1Id(e.target.value)}
                  >
                    <option value="">Assignee 1</option>
                    {assigneeOptions.map((row) => (
                      <option key={row.id} value={row.id} disabled={selectedAssignee2Id === row.id}>
                        {(row.full_name || row.email || row.phone || row.id) + ` (${row.role_code})`}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-[#d9dee3] bg-[#f8fafb] px-2 py-1 text-[10px] text-[#111b21] focus:border-[#25D366] focus:bg-white focus:outline-none"
                    value={selectedAssignee2Id}
                    disabled={assignmentLoading || assignmentSaving}
                    onChange={(e) => setSelectedAssignee2Id(e.target.value)}
                  >
                    <option value="">Assignee 2</option>
                    {assigneeOptions.map((row) => (
                      <option key={row.id} value={row.id} disabled={selectedAssignee1Id === row.id}>
                        {(row.full_name || row.email || row.phone || row.id) + ` (${row.role_code})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    className="w-full rounded-md border border-[#d9dee3] bg-[#f8fafb] px-2 py-1 text-[10px] text-[#111b21] placeholder:text-[#7b8994] focus:border-[#25D366] focus:bg-white focus:outline-none"
                    value={assignmentNote}
                    disabled={assignmentLoading || assignmentSaving}
                    onChange={(e) => setAssignmentNote(e.target.value)}
                    placeholder="Note (optional)"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-[#25D366] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
                    disabled={assignmentLoading || assignmentSaving}
                    onClick={() => void handleSaveAssignment()}
                  >
                    {assignmentSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {hasOngoingCall && activeCall ? (
            callOverlayMinimized ? (
              <button
                type="button"
                onClick={() => setCallOverlayMinimized(false)}
                className="mx-2 mt-2 inline-flex items-center gap-2 self-start rounded-full bg-[#1f2937] px-3 py-1.5 text-[11px] text-white shadow-lg"
              >
                <PhoneOutgoing className="h-3.5 w-3.5 text-green-400" />
                <span className="font-medium">
                  {hasLiveConnectedCall
                    ? `${String(Math.floor(activeCallElapsed / 60)).padStart(2, '0')}:${String(activeCallElapsed % 60).padStart(2, '0')}`
                    : callScreenStatus}
                </span>
              </button>
            ) : (
              <div
                className={`absolute inset-x-0 bottom-0 z-30 overflow-hidden text-white ${
                  assignmentPanelOpen ? 'top-[168px]' : 'top-[98px]'
                }`}
              >
                {hasLiveConnectedCall ? (
                  /* ── CONNECTED — matches image 1 ─────────────────── */
                  <div className="flex h-full flex-col items-center justify-between bg-[#0f1113] px-6 py-6">
                    <div className="w-full">
                      <button
                        type="button"
                        onClick={() => setCallOverlayMinimized(true)}
                        className="rounded-full bg-white/10 p-2 text-white/90 hover:bg-white/20"
                        aria-label="Minimize"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[26px] font-semibold leading-none tracking-tight">
                        {formatPhone(activeCall.customer_phone || waPhone)}
                      </p>
                      <p className="text-[15px] text-white/70">Connected</p>
                      <p className="font-mono text-[22px] font-bold text-green-400">
                        {String(Math.floor(activeCallElapsed / 60)).padStart(2, '0')}:
                        {String(activeCallElapsed % 60).padStart(2, '0')}
                      </p>
                    </div>

                    <div className="flex h-44 w-44 items-center justify-center rounded-full bg-white shadow-2xl">
                      <div className="text-center">
                        <p className="text-xl font-black text-[#1d4ed8]">MY FNG</p>
                        <p className="text-[9px] tracking-widest text-[#0f766e]">YOUR FRIENDLY<br />NEIGHBORHOOD GARAGE</p>
                      </div>
                    </div>

                    <div className="mb-2 flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCallControl('hangup')}
                        disabled={!activeCall || callControlLoading !== null}
                        className="rounded-full bg-red-600 p-5 text-white hover:bg-red-700 disabled:opacity-60 shadow-xl"
                        title="End call"
                      >
                        {callControlLoading === 'hangup' ? (
                          <Loader2 className="h-7 w-7 animate-spin" />
                        ) : (
                          <PhoneOff className="h-7 w-7" />
                        )}
                      </button>
                      <span className="text-[12px] text-white/50">End</span>
                    </div>
                  </div>
                ) : (
                  /* ── RINGING / CALLING ───────────────────────────── */
                  <div
                    className="flex h-full flex-col"
                    style={{
                      background: isIncomingRingingCall
                        ? 'linear-gradient(160deg,#3a3228 0%,#4a3c30 30%,#5a4636 55%,#3e3428 80%,#2a2620 100%)'
                        : 'linear-gradient(160deg,#1a2a1a 0%,#1e3420 30%,#1a3a28 55%,#162a1e 80%,#102018 100%)',
                    }}
                  >
                    {/* Top caller info */}
                    <div className="flex flex-col items-center px-6 pt-10">
                      <div className="mb-2 flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25d366]">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span className="text-[13px] text-white/80">
                          {isIncomingRingingCall ? 'WhatsApp Audio...' : callScreenStatus}
                        </span>
                      </div>
                      <p className="text-[28px] font-semibold tracking-tight text-white">
                        {formatPhone(activeCall.customer_phone || waPhone)}
                      </p>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Bottom actions */}
                    <div className="px-6 pb-8">
                      {isIncomingRingingCall ? (
                      <div className="flex items-end justify-around">
                        {/* Decline */}
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCallControl('hangup')}
                            disabled={!activeCall || callControlLoading !== null}
                            className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-red-500 text-white shadow-xl hover:bg-red-600 disabled:opacity-60 active:scale-95 transition-transform"
                            title="Decline"
                          >
                            {callControlLoading === 'hangup' ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <X className="h-8 w-8" />
                            )}
                          </button>
                          <span className="text-[13px] text-white/80">Decline</span>
                        </div>

                        {/* Accept */}
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleAcceptIncomingCall();
                            }}
                            disabled={!activeCall || callControlLoading !== null}
                            className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#3478f6] text-white shadow-xl hover:bg-[#2567e5] disabled:opacity-60 active:scale-95 transition-transform"
                            title="Accept"
                          >
                            {callControlLoading === 'resume' ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <Check className="h-8 w-8 stroke-[3]" />
                            )}
                          </button>
                          <span className="text-[13px] text-white/80">Accept</span>
                        </div>
                      </div>
                      ) : (
                      <div className="flex items-end justify-around">
                        {/* Cancel */}
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              cleanupCallMedia();
                              setActiveCallElapsed(0);
                              void loadCalls();
                            }}
                            disabled={!activeCall || callControlLoading !== null}
                            className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-red-500 text-white shadow-xl hover:bg-red-600 disabled:opacity-60 active:scale-95 transition-transform"
                            title="Cancel"
                          >
                            <PhoneOff className="h-6 w-6" />
                          </button>
                          <span className="text-[12px] text-white/70">Cancel</span>
                        </div>

                        {/* Mark Connected — manual fallback when Meta doesn't send status */}
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!activeCall?.id) return;
                              connectedAtRef.current = Date.now();
                              setAnsweredPreviewCallId(activeCall.id);
                              setIsRtcConnected(true);
                              void patchCallStatusLocal(activeCall.id, 'CONNECTED');
                            }}
                            disabled={!activeCall}
                            className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-green-500 text-white shadow-xl hover:bg-green-600 disabled:opacity-60 active:scale-95 transition-transform"
                            title="Customer answered — mark connected"
                          >
                            <Check className="h-7 w-7 stroke-[3]" />
                          </button>
                          <span className="text-[12px] text-white/70">Connected</span>
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : null}

          <div
            ref={messagesContainerRef}
            onScroll={handleConversationScroll}
            className="flex-1 min-h-0 px-3 py-4 space-y-2 overflow-y-auto bg-[#efeae2]"
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
            {(() => {
              const callItems = callLogs.map((call) => ({
                type: 'call' as const,
                ts: new Date(call.started_at || call.created_at || 0).getTime(),
                call,
              }));
              const msgItems = messages
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

              if (!historyLoading && timeline.length === 0) {
                return (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    No messages yet
                  </div>
                );
              }

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
                    ? `/api/whatsapp/calls/recordings/${call.recordings![0].id}`
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
                        if (endMs > startMs) callDuration = Math.floor((endMs - startMs) / 1000);
                      }
                    }
                  }
                  const iconColor = isMissed ? 'text-red-500' : isAccepted ? 'text-green-600' : isRinging ? 'text-orange-500' : inbound ? 'text-blue-600' : 'text-[#0f766e]';
                  const bgColor = isMissed ? 'bg-red-50 border-red-200' : isRinging ? 'bg-orange-50 border-orange-200' : 'bg-white border-[#d8dee3]';
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
                      <div className={`flex w-[280px] flex-col rounded-xl border ${bgColor} px-4 py-2.5 text-[12px] shadow-sm`}>
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
                        {isAccepted ? (
                          hasRecording && recordingUrl ? (
                            <div className="mt-2 rounded-lg bg-[#f0f2f5] p-1.5">
                              <audio controls preload="none" src={recordingUrl} className="h-8 w-full" />
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                              <Volume2 className="h-3 w-3" />
                              <span>Recording not available</span>
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                }

                const msg = item.msg;
                const outbound = String(msg.direction || '').toUpperCase() === 'OUTBOUND';
                const isStatus = String(msg.direction || '').toUpperCase() === 'STATUS';
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
                const messageType = String(msg.message_type || '').trim().toUpperCase();

                const extractInteractiveText = (): string => {
                  const p = msg?.payload || {};
                  const interactive = p?.interactive || p?.request?.interactive || p?.messages?.[0]?.interactive;
                  if (interactive) {
                    const itype = String(interactive.type || '').trim().toLowerCase();
                    if (itype === 'button_reply') return String(interactive.button_reply?.title || interactive.button_reply?.id || '').trim();
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
                    if (itype === 'call_permission_request' || itype === 'calling_permission') return 'Call permission request';
                    const headerText = String(interactive?.header?.text || '').trim();
                    const bodyText = String(interactive?.body?.text || '').trim();
                    const footerText = String(interactive?.footer?.text || '').trim();
                    const combined = [headerText, bodyText, footerText].filter(Boolean).join('\n');
                    if (combined) return combined;
                  }
                  const deepText =
                    String(p?.text?.body || p?.body?.text || p?.text || '').trim() ||
                    String(p?.request?.text?.body || p?.request?.body || '').trim() ||
                    String(p?.messages?.[0]?.text?.body || p?.messages?.[0]?.body || '').trim();
                  if (deepText && deepText !== '[object Object]') return deepText;
                  if (p?.calls || p?.call_id || p?.request?.call_id) return 'Voice call event';
                  return '';
                };

                const interactiveText = messageType === 'INTERACTIVE' ? extractInteractiveText() : '';
                const isCallRelated =
                  messageType === 'INTERACTIVE' &&
                  !interactiveText &&
                  (String(msg?.template_name || '').toLowerCase().includes('call') ||
                    String(JSON.stringify(msg?.payload || '')).toLowerCase().includes('call_permission') ||
                    String(JSON.stringify(msg?.payload || '')).toLowerCase().includes('calling'));
                const callEventText = isCallRelated ? 'Call permission' : '';

                const mediaLabel =
                  messageType === 'IMAGE' ? '📷 Photo'
                  : messageType === 'VIDEO' ? '🎥 Video'
                  : messageType === 'AUDIO' ? '🎤 Audio'
                  : messageType === 'DOCUMENT' ? '📄 Document'
                  : messageType === 'LOCATION' ? '📍 Location'
                  : messageType === 'STICKER' ? '🗂️ Sticker'
                  : '';

                const bubbleText =
                  String(msg.text_body || '').trim() ||
                  (isTemplateMessage ? templateText || `Template: ${msg.template_name}` : '') ||
                  interactiveText ||
                  callEventText ||
                  String(msg.media_caption || '').trim() ||
                  mediaLabel ||
                  (messageType && messageType !== 'TEXT' && messageType !== 'INTERACTIVE' ? messageType : '—');
                const callPermissionState = detectCallPermissionState({
                  templateName: msg?.template_name,
                  isOutbound: outbound,
                  text: bubbleText,
                });
                const callPermissionBadge = callPermissionBadgeMeta(callPermissionState);
                const timeLabel = formatMessageTime(msg?.status_at || msg?.updated_at || msg?.created_at);
                const messageKey = String(msg?.id || msg?.provider_message_id || '');

                const rawAudioId = msg.payload?.audio?.id || msg.payload?.messages?.[0]?.audio?.id || null;
                const rawImageId = msg.payload?.messages?.[0]?.image?.id || msg.payload?.image?.id || null;
                const rawVideoId = msg.payload?.messages?.[0]?.video?.id || msg.payload?.video?.id || null;
                const rawDocId = msg.payload?.messages?.[0]?.document?.id || msg.payload?.document?.id || null;
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

                const loc = msg.payload?.location || msg.payload?.messages?.[0]?.location || msg.payload?.request?.location || null;
                const hasLocation = loc && (loc.latitude || loc.longitude);
                const locLat = Number(loc?.latitude || 0);
                const locLng = Number(loc?.longitude || 0);
                const locName = String(loc?.name || '').trim();
                const locAddr = String(loc?.address || '').trim();
                const locUrl = hasLocation ? loc?.url || `https://www.google.com/maps?q=${locLat},${locLng}` : null;

                const msgId = String(msg.id || msg.provider_message_id || '');
                const isSelected = selectMode && selectedMsgIds.has(msgId);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-center gap-1.5 ${isStatus ? 'justify-center' : outbound ? 'justify-end' : 'justify-start'} ${isSelected ? 'bg-[#25D366]/10 -mx-2 px-2 rounded-lg' : ''}`}
                    onContextMenu={(e) => {
                      if (isStatus) return;
                      e.preventDefault();
                      if (!selectMode) {
                        setSelectMode(true);
                        setSelectedMsgIds(new Set([msgId]));
                      }
                    }}
                  >
                    {selectMode && !isStatus ? (
                      <button
                        type="button"
                        className="flex-shrink-0"
                        onClick={() => toggleMsgSelect(msgId)}
                      >
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#25D366] border-[#25D366]' : 'border-gray-400 bg-white'}`}>
                          {isSelected ? <Check className="h-3 w-3 text-white" /> : null}
                        </div>
                      </button>
                    ) : null}
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                        isStatus
                          ? 'bg-[#d9dfe3] text-[#54656f] text-center'
                          : outbound
                          ? 'bg-[#d9fdd3] text-gray-900'
                          : 'bg-white text-gray-900'
                      } ${selectMode && !isStatus ? 'cursor-pointer' : ''}`}
                      onClick={selectMode && !isStatus ? () => toggleMsgSelect(msgId) : undefined}
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
                        <div className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${callPermissionBadge.className}`}>
                          {callPermissionBadge.label}
                        </div>
                      ) : null}
                      {(() => {
                        return (
                          <>
                            {hasLocation ? (
                              <a href={locUrl!} target="_blank" rel="noopener noreferrer" className="mb-1 block overflow-hidden rounded-lg">
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

                            {mediaUrl && (messageType === 'IMAGE' || mediaMime.startsWith('image/')) ? (
                              <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                                <img src={mediaUrl} alt="Photo" className="max-h-[240px] w-full rounded-lg object-cover" loading="lazy" />
                              </a>
                            ) : null}

                            {mediaUrl && (messageType === 'VIDEO' || mediaMime.startsWith('video/')) ? (
                              <div className="mb-1">
                                <video controls preload="metadata" src={mediaUrl} className="max-h-[240px] w-full rounded-lg" />
                              </div>
                            ) : null}

                            {(messageType === 'AUDIO' || mediaMime.startsWith('audio/')) ? (
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

                            {mediaUrl && (messageType === 'DOCUMENT' || mediaMime.startsWith('application/')) && !mediaMime.startsWith('audio/') && !mediaMime.startsWith('image/') && !mediaMime.startsWith('video/') ? (
                              <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[12px] text-blue-600 hover:underline">
                                <span className="text-lg">📄</span>
                                <span className="truncate">{msg.payload?.document?.filename || msg.payload?.request?.filename || 'Document'}</span>
                              </a>
                            ) : null}

                            {mediaUrl && messageType === 'STICKER' ? (
                              <img src={mediaUrl} alt="Sticker" className="mb-1 h-[120px] w-[120px] object-contain" loading="lazy" />
                            ) : null}

                            {isCallRelated || callPermissionState ? (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Phone className="h-4 w-4 flex-shrink-0" />
                                <span className="whitespace-pre-wrap break-words">{typeof bubbleText === 'string' ? renderLinkedText(bubbleText) : bubbleText}</span>
                              </div>
                            ) : !hasLocation && messageType !== 'AUDIO' && !mediaMime.startsWith('audio/') && !(mediaUrl && (messageType === 'IMAGE' || messageType === 'STICKER') && !String(msg.media_caption || msg.text_body || '').trim()) ? (
                              <div className="whitespace-pre-wrap break-words">{typeof bubbleText === 'string' ? renderLinkedText(bubbleText) : bubbleText}</div>
                            ) : String(msg.media_caption || '').trim() ? (
                              <div className="whitespace-pre-wrap break-words">{renderLinkedText(String(msg.media_caption || '').trim())}</div>
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
                        <span>{timeLabel || msg.created_at}</span>
                        {outbound && deliveryStatus === 'SENT' ? <Check className="h-3.5 w-3.5" /> : null}
                        {outbound && deliveryStatus === 'DELIVERED' ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                        {outbound && deliveryStatus === 'VIEWED' ? (
                          <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                        ) : null}
                        {outbound && deliveryStatus === 'FAILED' ? (
                          <span className="font-semibold text-[#d93025]">!</span>
                        ) : null}
                        {!isStatus && !selectMode ? (
                          <button
                            type="button"
                            className="ml-1 inline-flex items-center text-[#667781] hover:text-[#25D366]"
                            onClick={() => { setSelectMode(true); setSelectedMsgIds(new Set([msgId])); }}
                            aria-label="Forward message"
                            title="Forward"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
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

          {selectMode ? (
            <div className="border-t border-gray-200 bg-white px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelectMode}
                  className="rounded-full p-1.5 hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-800">
                  {selectedMsgIds.size} selected
                </span>
              </div>
              <button
                type="button"
                disabled={selectedMsgIds.size === 0}
                onClick={() => setForwardPickerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#1ebe5c] disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" />
                Forward
              </button>
            </div>
          ) : null}

          {forwardPickerOpen ? (
            <div className="absolute inset-0 z-50 flex flex-col bg-white rounded-[2.1rem] overflow-hidden">
              <div className="bg-[#005c4b] text-white px-4 py-3 flex items-center gap-3">
                <button type="button" onClick={() => setForwardPickerOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold">Forward to...</span>
              </div>
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                  <input
                    type="tel"
                    placeholder="Search or type phone number"
                    value={forwardPhone}
                    onChange={(e) => setForwardPhone(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    autoFocus
                  />
                  {forwardPhone.trim() ? (
                    <button
                      type="button"
                      disabled={forwardSending}
                      onClick={handleForwardSelected}
                      className="flex-shrink-0 rounded-full bg-[#25D366] p-1.5 text-white hover:bg-[#1ebe5c] disabled:opacity-50"
                    >
                      {forwardSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-1">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Recent chats</p>
                {forwardRecentChats
                  .filter((c) => {
                    if (!forwardPhone.trim()) return true;
                    const q = forwardPhone.replace(/\D/g, '');
                    return q ? c.phone.includes(q) : true;
                  })
                  .map((chat) => {
                    const display = chat.phone.length > 10
                      ? `+${chat.phone.slice(0, 2)} ${chat.phone.slice(2, 7)} ${chat.phone.slice(7)}`
                      : chat.phone;
                    return (
                      <button
                        key={chat.phone}
                        type="button"
                        disabled={forwardSending}
                        onClick={() => { setForwardPhone(chat.phone); }}
                        onDoubleClick={() => { setForwardPhone(chat.phone); setTimeout(() => handleForwardSelected(), 50); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50"
                      >
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{display}</p>
                          <p className="truncate text-xs text-gray-500">{chat.preview}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className={`border-t border-gray-200 bg-white flex flex-col max-h-[62%] ${selectMode ? 'hidden' : ''}`}>
            <div className="overflow-y-auto min-h-0 flex-1 px-3 pt-3 space-y-2">
            {isTemplateOnlyMode ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                Normal chat window closed. Only template messages can be sent.
              </div>
            ) : null}
            {activeType === 'template' ? (
              <div className="mb-2 rounded-xl border border-[#d8dee3] bg-[#f8fafc] p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#475467]">Template mode</p>
                    <p className="text-[10px] text-[#667781]">Select approved template and add params</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveType('text'); setShowAttachMenu(false); }}
                    className="text-[11px] font-semibold text-[#128c7e]"
                  >
                    Back to text
                  </button>
                </div>

                <div className="rounded-xl border border-[#d5dbe1] bg-white p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#54656f]">Template library</p>
                    <span className="rounded-full bg-[#e7f7ef] px-2 py-0.5 text-[10px] font-semibold text-[#128c7e]">
                      {filteredTemplateOptions.length}/{templateOptions.length}
                    </span>
                  </div>
                  <input
                    className="w-full rounded-lg border border-[#d9dee3] bg-[#f8fafb] px-2.5 py-1.5 text-[11px] text-[#111b21] placeholder:text-[#7b8994] focus:border-[#25D366] focus:bg-white focus:outline-none"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search by template name..."
                  />
                  <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-[#e5e9ee] bg-[#fbfcfd] p-1.5">
                    {templatesLoading ? (
                      <div className="px-2 py-3 text-[11px] text-[#667781]">Loading templates...</div>
                    ) : null}
                    {!templatesLoading && filteredTemplateOptions.length === 0 ? (
                      <div className="px-2 py-3 text-[11px] text-[#667781]">No templates found</div>
                    ) : null}
                    {filteredTemplateOptions.map((row) => {
                      const isSelected =
                        row.template_name.trim().toLowerCase() === templateName.trim().toLowerCase();
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setTemplateName(row.template_name)}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                            isSelected
                              ? 'border-[#25D366] bg-[#f2fcf6] ring-1 ring-[#25D366]/40'
                              : 'border-black/10 bg-white hover:border-[#b6c2cd] hover:bg-[#f7f9fb]'
                          }`}
                        >
                          <p className="text-[11px] font-semibold text-[#111b21]">
                            {row.display_name || row.template_name}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-[#667781]">
                            {row.language_code.toUpperCase()} • {String(row.category || 'TEMPLATE').toUpperCase()}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {templateName.trim() ? (
                  <div className="mt-2 rounded-xl border border-[#bdebd2] bg-[#eafaf1] px-2.5 py-2 text-[10px] text-[#128c7e]">
                    <p className="font-semibold">Selected: {selectedTemplate?.display_name || templateName}</p>
                    <p className="mt-1 text-[#1b6f5f] line-clamp-2 whitespace-pre-wrap">
                      {selectedTemplate ? fillTemplateBody(selectedTemplate, templateParams) : 'Template selected'}
                    </p>
                  </div>
                ) : null}

                <div className="mt-2 rounded-xl border border-[#d5dbe1] bg-white p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#54656f]">
                    Template params
                  </label>
                  <input
                    className="w-full rounded-lg border border-[#d9dee3] bg-[#f8fafb] px-2.5 py-1.5 text-[11px] text-[#111b21] placeholder:text-[#7b8994] focus:border-[#25D366] focus:bg-white focus:outline-none"
                    value={templateParams}
                    onChange={(e) => setTemplateParams(e.target.value)}
                    placeholder="Comma separated values (e.g. Rahul, 20 min)"
                  />
                  <p className="mt-1 text-[10px] text-[#667781]">
                    Tip: params order should match approved template variables.
                  </p>
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
                    setActiveType('text');
                    if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
                  }}
                  className="ml-2 rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                  title="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {activeType === 'media' && !selectedMediaFile ? (
              <div className="mb-2 space-y-1.5">
                <button
                  type="button"
                  className="w-full rounded-md border bg-gray-50 px-2 py-2 text-left text-[11px] text-[#54656f] hover:bg-gray-100"
                  onClick={() => mediaFileInputRef.current?.click()}
                >
                  Choose media from device
                </button>
                <input
                  className="w-full rounded-md border bg-white px-2 py-1 text-[11px]"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption (optional)"
                />
              </div>
            ) : null}
            </div>
            <div className="shrink-0 px-3 pb-3 pt-2 flex items-center gap-2">
              <div className="relative">
                <button
                  ref={attachButtonRef}
                  type="button"
                  onClick={() => setShowAttachMenu((prev) => !prev)}
                  disabled={sending}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {showAttachMenu ? (
                  <div
                    ref={attachMenuRef}
                    className="absolute bottom-12 left-0 z-[100] min-w-[170px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveType('media');
                        setMediaType('image');
                        setShowAttachMenu(false);
                        requestAnimationFrame(() => mediaFileInputRef.current?.click());
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveType('media');
                        setMediaType('image');
                        setShowAttachMenu(false);
                        requestAnimationFrame(() => mediaFileInputRef.current?.click());
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveType('media');
                        setMediaType('image');
                        setShowAttachMenu(false);
                        requestAnimationFrame(() => mediaFileInputRef.current?.click());
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Audio
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveType('media');
                        setMediaType('document');
                        setShowAttachMenu(false);
                        requestAnimationFrame(() => mediaFileInputRef.current?.click());
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveType('template');
                        setShowAttachMenu(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Template
                    </button>
                  </div>
                ) : null}
              </div>
              <input
                value={activeType === 'template' ? '' : textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) void handleSend();
                  }
                }}
                disabled={sending || activeType === 'template'}
                placeholder={
                  activeType === 'template'
                    ? 'Template mode enabled'
                    : isTemplateOnlyMode
                    ? 'Only templates can be sent'
                    : 'Type a message'
                }
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm outline-none ring-green-200 focus:border-green-500 focus:ring disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                title="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
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
