import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import { getSupabaseAccessToken } from '../../lib/supabase';
import { ENV } from '../../config/environment';

const WA = {
  header: '#004AAD',
  chatBg: '#F0F7FF',
  bubbleIn: '#FFFFFF',
  bubbleOut: '#D6E8FF',
  send: '#004AAD',
  composerBg: '#EEF4FF',
  meta: '#667781',
  text: '#111B21',
  divider: '#E9EDEF',
};

type Msg = {
  id: string;
  direction?: string | null;
  text_body?: string | null;
  message_type?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_caption?: string | null;
  template_name?: string | null;
  created_at?: string | null;
  status?: string | null;
  payload?: Record<string, any> | null;
};

type WaTemplate = {
  id: string;
  template_name: string;
  display_name?: string | null;
  language_code?: string | null;
  category?: string | null;
  body_text?: string | null;
  variable_keys?: string[] | null;
  example_values?: string[] | null;
  is_active?: boolean;
  meta?: Record<string, unknown> | null;
};

type Props = {
  phone: string;
  customerName?: string | null;
  onBack: () => void;
};

function formatPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone || '—';
}

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
}

function resolveMediaUrl(m: Msg): string | null {
  const payload = m.payload && typeof m.payload === 'object' ? m.payload : {};
  const mediaId =
    String(
      (payload as any)?.image?.id ||
        (payload as any)?.sticker?.id ||
        (payload as any)?.video?.id ||
        (payload as any)?.messages?.[0]?.image?.id ||
        '',
    ).trim() || '';
  const raw = String(m.media_url || '').trim();
  const path = raw || (mediaId ? `/api/whatsapp/media/${encodeURIComponent(mediaId)}` : '');
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(ENV.API_URL || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function isImageMessage(m: Msg): boolean {
  const type = String(m.message_type || '').toUpperCase();
  const mime = String(m.media_mime_type || '').toLowerCase();
  return type === 'IMAGE' || type === 'STICKER' || mime.startsWith('image/');
}

function messageText(m: Msg): string {
  const rawBody = String(m.text_body || '').trim();
  const caption = String(m.media_caption || '').trim();
  const body = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(rawBody.toUpperCase())
    ? ''
    : rawBody;
  if (isImageMessage(m)) return caption || body;
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        const fromJson = String(parsed.text || parsed.payload || parsed.body || '').trim();
        if (fromJson) return fromJson;
      }
    } catch {
      /* plain text */
    }
    // Avoid dumping internal template keys as the visible message
    if (/^template:\s*/i.test(body)) {
      const rest = body.replace(/^template:\s*/i, '').trim();
      if (rest && !/^[a-z0-9_]+$/i.test(rest.split(/\s|\(/)[0] || '')) return rest;
      return 'Template message';
    }
    return body;
  }
  if (m.template_name) return humanizeTemplateKey(String(m.template_name));
  const type = String(m.message_type || '').toUpperCase();
  if (type && type !== 'TEXT') return type;
  return '—';
}

function formatBubbleTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function humanizeTemplateKey(name: string): string {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function templateTitle(row: WaTemplate): string {
  return String(row.display_name || '').trim() || humanizeTemplateKey(row.template_name);
}

function getTemplateVariableCount(template?: WaTemplate | null): number {
  const body = String(template?.body_text || '');
  const matches = body.match(/\{\{\s*\d+\s*\}\}/g) || [];
  const fromBody = matches.length
    ? Math.max(...matches.map((m) => Number(String(m).replace(/\D/g, '') || 0)))
    : 0;
  const fromKeys = Array.isArray(template?.variable_keys) ? template!.variable_keys.length : 0;
  const fromExamples = Array.isArray(template?.example_values) ? template!.example_values.length : 0;
  return Math.max(fromBody, fromKeys, fromExamples);
}

function fillTemplateBody(template?: WaTemplate | null, params: string[] = []): string {
  const body = String(template?.body_text || '').trim();
  if (!body) return 'Template body preview not available.';
  const examples = Array.isArray(template?.example_values) ? template!.example_values : [];
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, indexRaw: string) => {
    const idx = Math.max(0, Number(indexRaw) - 1);
    return params[idx] || examples[idx] || `{{${indexRaw}}}`;
  });
}

function isExplicitTelecallerTemplate(row: WaTemplate): boolean {
  if (!row || row.is_active === false) return false;
  const meta = row.meta && typeof row.meta === 'object' ? (row.meta as any) : {};
  return meta.crm_telecaller === true || meta.crm_telecaller === '1' || meta.crm_telecaller === 1;
}

function resolveFrictionlessTemplate(rows: WaTemplate[]): WaTemplate | null {
  const active = rows.filter((row) => isExplicitTelecallerTemplate(row));
  const byName = (name: string) =>
    active.find((row) => String(row.template_name || '').trim().toLowerCase() === name) || null;
  const metaStatus = (row: WaTemplate) =>
    String((row?.meta as any)?.status || '')
      .trim()
      .toUpperCase();
  const preferredNames = ['myfng_quick_note'];
  for (const name of preferredNames) {
    const row = byName(name);
    if (row && metaStatus(row) === 'APPROVED') return row;
  }
  for (const name of preferredNames) {
    const row = byName(name);
    if (row) return row;
  }
  return (
    active.find((row) => Boolean(row?.meta && (row.meta as any).frictionless) && metaStatus(row) === 'APPROVED') ||
    active.find((row) => Boolean(row?.meta && (row.meta as any).frictionless)) ||
    null
  );
}

function defaultParamsForTemplate(template: WaTemplate | null, customerName?: string | null): string[] {
  const count = getTemplateVariableCount(template);
  const examples = Array.isArray(template?.example_values) ? template!.example_values : [];
  const keys = Array.isArray(template?.variable_keys) ? template!.variable_keys : [];
  const name = String(customerName || '').trim() || 'Customer';
  return Array.from({ length: count }, (_, i) => {
    const key = String(keys[i] || '').toLowerCase();
    if (key.includes('name') || key.includes('customer') || i === 0) return name;
    return String(examples[i] || '').trim();
  });
}

function avatarLetter(name?: string | null, phone?: string): string {
  const n = String(name || '').trim();
  if (n) return n.charAt(0).toUpperCase();
  const d = String(phone || '').replace(/\D/g, '');
  return d.slice(-1) || '?';
}

export default function TelecallerWhatsAppChat({ phone, customerName, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [telecallerScopedTemplates, setTelecallerScopedTemplates] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [mediaAuth, setMediaAuth] = useState<string | undefined>();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const normalized = normalizePhone(phone);
  // Modal often reports insets.bottom=0 — force home-indicator room on iOS.
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 12);

  const isTemplateOnlyMode = useMemo(() => {
    const lastInbound = messages.find(
      (row) => String(row?.direction || '').trim().toUpperCase() === 'INBOUND',
    );
    if (!lastInbound) return true;
    const lastInboundMs = new Date(lastInbound?.created_at || '').getTime();
    if (!Number.isFinite(lastInboundMs)) return true;
    return Date.now() - lastInboundMs > 24 * 60 * 60 * 1000;
  }, [messages]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((row) => {
      // Match API telecaller scope: Active + Telecaller ON only
      if (!isExplicitTelecallerTemplate(row)) return false;
      const cat = String(row.category || '').toLowerCase();
      const name = String(row.template_name || '').toLowerCase();
      if (cat.includes('auth') || name.includes('otp') || name.startsWith('auth_')) return false;
      // Telecaller API only returns Quick note — keep client in sync
      if (telecallerScopedTemplates && name !== 'myfng_quick_note') return false;
      if (!q) return true;
      return (
        name.includes(q) ||
        String(row.display_name || '')
          .toLowerCase()
          .includes(q) ||
        String(row.body_text || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [templates, templateSearch, telecallerScopedTemplates]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await apiFetch<{
        templates?: WaTemplate[];
        telecaller_scoped?: boolean;
      }>('/api/whatsapp/templates');
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setTelecallerScopedTemplates(Boolean(data.telecaller_scoped));
    } catch (e) {
      console.warn('WA templates failed', e);
      setTemplates([]);
      setTelecallerScopedTemplates(false);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!normalized) return;
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ phone: normalized, limit: '80' });
      const data = await apiFetch<{ messages?: Msg[] }>(
        `/api/whatsapp/conversation?${params.toString()}`,
      );
      const rows = Array.isArray(data.messages) ? data.messages : [];
      setMessages([...rows].reverse());
    } catch (e) {
      console.error('WA conversation failed', e);
      if (!silent) {
        setMessages([]);
        Alert.alert('WhatsApp', String((e as Error)?.message || 'Failed to load chat'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [normalized]);

  useEffect(() => {
    load();
    loadTemplates();
  }, [load, loadTemplates]);

  useEffect(() => {
    void getSupabaseAccessToken()
      .then((token) => setMediaAuth(token))
      .catch(() => undefined);
  }, []);

  // Auto-refresh open chat so inbound/AI replies appear without tapping refresh.
  useEffect(() => {
    if (!normalized) return;
    const id = setInterval(() => {
      void load({ silent: true });
    }, 2500);
    return () => clearInterval(id);
  }, [normalized, load]);

  useEffect(() => {
    // Closed window: keep free-text composer (frictionless). Don't force template panel.
    if (!isTemplateOnlyMode && templateMode && !selectedTemplate) {
      setTemplateMode(false);
    }
  }, [isTemplateOnlyMode, templateMode, selectedTemplate]);

  const frictionlessTemplate = useMemo(() => resolveFrictionlessTemplate(templates), [templates]);

  const openTemplatePicker = () => {
    setTemplateMode(true);
    setPickerOpen(true);
    if (!templates.length) void loadTemplates();
  };

  const selectTemplate = (row: WaTemplate) => {
    setSelectedTemplate(row);
    setTemplateParams(defaultParamsForTemplate(row, customerName));
    setPickerOpen(false);
    setTemplateMode(true);
  };

  const sendText = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (isTemplateOnlyMode) {
      const fr = frictionlessTemplate;
      if (!fr?.template_name) {
        Alert.alert(
          'Frictionless template missing',
          'Run SQL 332 and Push myfng_closed_window_note (UTILITY), then Sync templates.',
        );
        openTemplatePicker();
        return;
      }
      setSending(true);
      try {
        const safeText = text.replace(/\r\n/g, ' ').replace(/[\r\n]+/g, ' ').trim();
        await apiFetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_phone: normalized,
            message_type: 'template',
            template_name: fr.template_name,
            language: fr.language_code || 'en',
            template_params: [safeText],
          }),
        });
        setDraft('');
        await load();
      } catch (e: any) {
        Alert.alert('Send failed', String(e?.message || 'Could not send message'));
      } finally {
        setSending(false);
      }
      return;
    }
    setSending(true);
    try {
      await apiFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone: normalized,
          message_type: 'text',
          text,
        }),
      });
      setDraft('');
      await load();
    } catch (e: any) {
      Alert.alert('Send failed', String(e?.message || 'Could not send message'));
    } finally {
      setSending(false);
    }
  };

  const sendTemplate = async () => {
    if (!selectedTemplate || sending) return;
    const count = getTemplateVariableCount(selectedTemplate);
    const cleaned = templateParams.map((v) => String(v || '').trim());
    const emptyIdx = cleaned.findIndex((v, i) => i < count && !v);
    if (emptyIdx !== -1) {
      Alert.alert('Template', `Please fill variable {{${emptyIdx + 1}}}`);
      return;
    }
    setSending(true);
    try {
      await apiFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone: normalized,
          message_type: 'template',
          template_name: selectedTemplate.template_name,
          language: selectedTemplate.language_code || 'en',
          template_params: cleaned.slice(0, count),
        }),
      });
      setDraft('');
      if (!isTemplateOnlyMode) setTemplateMode(false);
      await load();
    } catch (e: any) {
      Alert.alert('Template failed', String(e?.message || 'Could not send template'));
    } finally {
      setSending(false);
    }
  };

  const varCount = getTemplateVariableCount(selectedTemplate);
  const displayName = String(customerName || '').trim() || formatPhone(phone);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" backgroundColor={WA.header} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <TouchableOpacity style={styles.iconHit} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{avatarLetter(customerName, phone)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {customerName ? formatPhone(phone) : 'tap here for contact info'}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconHit} onPress={openTemplatePicker} accessibilityLabel="Templates">
          <Ionicons name="document-text-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconHit} onPress={() => load()}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {isTemplateOnlyMode ? (
        <View style={styles.bannerClosed}>
          <Text style={styles.bannerClosedTitle}>
            Send a message to customer in closed window using Frictionless messaging
          </Text>
          <Text style={styles.bannerClosedSub}>
            Type below · or Send a template
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={WA.header} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item, idx) => item.id || `${idx}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptyHint}>Send a template to start the chat</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const outbound = String(item.direction || '').toUpperCase() === 'OUTBOUND';
            const body = messageText(item);
            const tpl = String(item.template_name || '').trim();
            const showImage = isImageMessage(item);
            const mediaUrl = showImage ? resolveMediaUrl(item) : null;
            return (
              <View style={[styles.bubbleRow, outbound ? styles.bubbleRowOut : styles.bubbleRowIn]}>
                <View style={[styles.bubble, outbound ? styles.bubbleOut : styles.bubbleIn]}>
                  {tpl ? (
                    <Text style={styles.templateTag} numberOfLines={1}>
                      {humanizeTemplateKey(tpl)}
                    </Text>
                  ) : null}
                  {mediaUrl ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setPreviewImage(mediaUrl)}
                    >
                      <Image
                        source={{
                          uri: mediaUrl,
                          headers: mediaAuth ? { Authorization: `Bearer ${mediaAuth}` } : undefined,
                        }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : showImage ? (
                    <Text style={styles.bubbleText}>📷 Photo</Text>
                  ) : null}
                  {body ? (
                    <Text style={styles.bubbleText} selectable>
                      {body}
                    </Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    <Text style={styles.bubbleTime}>{formatBubbleTime(item.created_at)}</Text>
                    {outbound ? (
                      <Ionicons
                        name="checkmark-done"
                        size={14}
                        color={String(item.status || '').toUpperCase() === 'READ' ? '#004AAD' : WA.meta}
                        style={{ marginLeft: 2 }}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {templateMode && selectedTemplate ? (
        <View style={[styles.templatePanel, { paddingBottom: bottomSafe + 12 }]}>
          <View style={styles.templatePanelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.templatePanelTitle}>Template</Text>
              <Text style={styles.templatePanelName}>{templateTitle(selectedTemplate)}</Text>
            </View>
            <TouchableOpacity onPress={() => setPickerOpen(true)}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
            {!isTemplateOnlyMode ? (
              <TouchableOpacity
                onPress={() => {
                  setTemplateMode(false);
                  setSelectedTemplate(null);
                }}
                style={{ marginLeft: 12 }}
              >
                <Text style={styles.changeLink}>Close</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setTemplateMode(false);
                  setSelectedTemplate(null);
                }}
                style={{ marginLeft: 12 }}
              >
                <Text style={styles.changeLink}>Type msg</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.previewBody}>{fillTemplateBody(selectedTemplate, templateParams)}</Text>
          {varCount > 0
            ? Array.from({ length: varCount }, (_, idx) => (
                <View key={`var-${idx}`} style={styles.varRow}>
                  <Text style={styles.varLabel}>
                    {`{{${idx + 1}}}`}{' '}
                    {selectedTemplate.variable_keys?.[idx]
                      ? `(${selectedTemplate.variable_keys[idx]})`
                      : ''}
                  </Text>
                  <TextInput
                    style={styles.varInput}
                    value={templateParams[idx] || ''}
                    onChangeText={(v) => {
                      setTemplateParams((prev) => {
                        const next = [...prev];
                        next[idx] = v;
                        return next;
                      });
                    }}
                    placeholder={selectedTemplate.example_values?.[idx] || `Value ${idx + 1}`}
                    placeholderTextColor={WA.meta}
                  />
                </View>
              ))
            : null}
          <TouchableOpacity
            style={[styles.sendTemplateBtn, sending && { opacity: 0.6 }]}
            onPress={sendTemplate}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendTemplateText}>Send template</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.composerWrap, { paddingBottom: bottomSafe + (isTemplateOnlyMode ? 12 : 8) }]}>
          <View style={styles.composer}>
            <View style={styles.inputShell}>
              <TouchableOpacity style={styles.plusBtn} onPress={openTemplatePicker}>
                <Ionicons name="add" size={26} color={WA.meta} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={isTemplateOnlyMode ? 'Type message' : 'Message'}
                placeholderTextColor={WA.meta}
                multiline
              />
              <TouchableOpacity onPress={openTemplatePicker} hitSlop={8}>
                <Ionicons name="document-text-outline" size={22} color={WA.meta} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.45 }]}
              onPress={sendText}
              disabled={!draft.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          {isTemplateOnlyMode ? (
            <TouchableOpacity onPress={openTemplatePicker} style={styles.orTemplateLink} activeOpacity={0.7}>
              <Text style={styles.orTemplateText}>or Send a template</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={[styles.imagePreviewClose, { top: Math.max(insets.top, 12) + 8 }]}
            onPress={() => setPreviewImage(null)}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {previewImage ? (
            <Image
              source={{
                uri: previewImage,
                headers: mediaAuth ? { Authorization: `Bearer ${mediaAuth}` } : undefined,
              }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: bottomSafe + 12 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Templates</Text>
            <Text style={styles.modalSub}>
              Templates enabled for telecallers (Telecaller ON in admin)
            </Text>
            <TextInput
              style={styles.searchInput}
              value={templateSearch}
              onChangeText={setTemplateSearch}
              placeholder="Search"
              placeholderTextColor={WA.meta}
              autoCapitalize="none"
            />
            {templatesLoading ? (
              <ActivityIndicator color={WA.header} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
                {filteredTemplates.length === 0 ? (
                  <Text style={styles.emptyText}>No templates available</Text>
                ) : (
                  filteredTemplates.map((row) => (
                    <TouchableOpacity
                      key={row.id || row.template_name}
                      style={[
                        styles.templateCard,
                        selectedTemplate?.template_name === row.template_name && styles.templateCardActive,
                      ]}
                      onPress={() => selectTemplate(row)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateCardTitle}>{templateTitle(row)}</Text>
                        <Text style={styles.templateCardMeta} numberOfLines={2}>
                          {String(row.body_text || '').slice(0, 120) || row.template_name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={WA.meta} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WA.chatBg },
  header: {
    backgroundColor: WA.header,
    paddingBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DFE5E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  headerAvatarText: { fontSize: 17, fontWeight: '700', color: '#54656F' },
  title: { fontSize: 16, fontWeight: '600', color: '#fff' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  banner: {
    backgroundColor: '#FFEAA7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
  },
  bannerText: { fontSize: 12, fontWeight: '600', color: '#5C4B1F', textAlign: 'center' },
  bannerClosed: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerClosedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
    textAlign: 'center',
  },
  bannerClosedSub: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
    textAlign: 'center',
  },
  composerWrap: {
    backgroundColor: WA.composerBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WA.divider,
    paddingTop: 8,
  },
  orTemplateLink: {
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E7F8F1',
  },
  orTemplateText: {
    fontSize: 14,
    fontWeight: '700',
    color: WA.send,
  },
  list: { paddingHorizontal: 10, paddingVertical: 12, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: 40, transform: [{ scaleY: -1 }] },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyText: { color: WA.meta, fontWeight: '600', textAlign: 'center' },
  emptyHint: { color: WA.meta, fontSize: 12, marginTop: 4, textAlign: 'center' },
  bubbleRow: {
    maxWidth: '82%',
    marginBottom: 6,
    position: 'relative',
  },
  bubbleRowIn: { alignSelf: 'flex-start', marginLeft: 8 },
  bubbleRowOut: { alignSelf: 'flex-end', marginRight: 8 },
  bubble: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 5,
    minWidth: 88,
    maxWidth: '100%',
  },
  bubbleIn: {
    backgroundColor: WA.bubbleIn,
    borderTopLeftRadius: 2,
  },
  bubbleOut: {
    backgroundColor: WA.bubbleOut,
    borderTopRightRadius: 2,
  },
  templateTag: {
    fontSize: 10,
    fontWeight: '700',
    color: WA.send,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  bubbleText: { fontSize: 15, color: WA.text, lineHeight: 21 },
  bubbleImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
    backgroundColor: '#D1D7DB',
    marginBottom: 4,
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imagePreviewClose: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 2,
  },
  bubbleTime: { fontSize: 11, color: WA.meta },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 8,
    backgroundColor: WA.composerBg,
  },
  inputShell: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    gap: 2,
  },
  plusBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    fontSize: 16,
    color: WA.text,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WA.send,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templatePanel: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WA.divider,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  templatePanelHeader: { flexDirection: 'row', alignItems: 'center' },
  templatePanelTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: WA.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  templatePanelName: { fontSize: 14, fontWeight: '700', color: WA.header, marginTop: 2 },
  changeLink: { fontSize: 13, fontWeight: '700', color: WA.header },
  previewBody: {
    fontSize: 13,
    lineHeight: 19,
    color: WA.text,
    backgroundColor: WA.chatBg,
    borderRadius: 10,
    padding: 10,
  },
  varRow: { gap: 4 },
  varLabel: { fontSize: 11, fontWeight: '700', color: WA.meta },
  varInput: {
    borderWidth: 1,
    borderColor: WA.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: WA.text,
    backgroundColor: '#fff',
  },
  sendTemplateBtn: {
    marginTop: 4,
    backgroundColor: WA.send,
    borderRadius: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendTemplateText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,20,26,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '88%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D7DB',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: WA.text },
  modalSub: { fontSize: 13, color: WA.meta, marginTop: 2, marginBottom: 10 },
  searchInput: {
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
    color: WA.text,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WA.divider,
  },
  templateCardActive: { backgroundColor: '#F0FDF4' },
  templateCardTitle: { fontSize: 15, fontWeight: '700', color: WA.text },
  templateCardMeta: { fontSize: 13, color: WA.meta, marginTop: 3 },
  modalClose: { marginTop: 8, alignItems: 'center', paddingVertical: 12 },
  modalCloseText: { fontWeight: '700', color: WA.meta },
});
