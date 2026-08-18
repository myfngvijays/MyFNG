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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';

const WA = {
  header: '#008069',
  chatBg: '#EFEAE2',
  bubbleIn: '#FFFFFF',
  bubbleOut: '#D9FDD3',
  send: '#008069',
  composerBg: '#F0F2F5',
  meta: '#667781',
  text: '#111B21',
  divider: '#E9EDEF',
};

type Msg = {
  id: string;
  direction?: string | null;
  text_body?: string | null;
  message_type?: string | null;
  media_caption?: string | null;
  template_name?: string | null;
  created_at?: string | null;
  status?: string | null;
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

function messageText(m: Msg): string {
  const body = String(m.text_body || m.media_caption || '').trim();
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        return String(parsed.text || parsed.payload || body);
      }
    } catch {
      /* plain text */
    }
    return body;
  }
  if (m.template_name) return `Template: ${m.template_name}`;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const normalized = normalizePhone(phone);
  const composerPad = Math.max(insets.bottom, 10) + 10;

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
      if (!row || row.is_active === false) return false;
      const cat = String(row.category || '').toLowerCase();
      const name = String(row.template_name || '').toLowerCase();
      if (cat.includes('auth') || name.includes('otp') || name.startsWith('auth_')) return false;
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
  }, [templates, templateSearch]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await apiFetch<{ templates?: WaTemplate[] }>('/api/whatsapp/templates');
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (e) {
      console.warn('WA templates failed', e);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!normalized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ phone: normalized, limit: '80' });
      const data = await apiFetch<{ messages?: Msg[] }>(
        `/api/whatsapp/conversation?${params.toString()}`,
      );
      const rows = Array.isArray(data.messages) ? data.messages : [];
      setMessages([...rows].reverse());
    } catch (e) {
      console.error('WA conversation failed', e);
      setMessages([]);
      Alert.alert('WhatsApp', String((e as Error)?.message || 'Failed to load chat'));
    } finally {
      setLoading(false);
    }
  }, [normalized]);

  useEffect(() => {
    load();
    loadTemplates();
  }, [load, loadTemplates]);

  useEffect(() => {
    if (isTemplateOnlyMode) setTemplateMode(true);
  }, [isTemplateOnlyMode]);

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
      Alert.alert(
        '24h window closed',
        'Customer ne 24 hours me reply nahi kiya. Pehle Template (Hello) bhejo.',
      );
      openTemplatePicker();
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
        <TouchableOpacity style={styles.iconHit} onPress={load}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {isTemplateOnlyMode ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Messaging window closed · only templates can be sent</Text>
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
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
            return (
              <View style={[styles.bubbleRow, outbound ? styles.bubbleRowOut : styles.bubbleRowIn]}>
                {!outbound ? <View style={styles.tailIn} /> : null}
                <View style={[styles.bubble, outbound ? styles.bubbleOut : styles.bubbleIn]}>
                  {item.template_name ? (
                    <Text style={styles.templateTag}>{item.template_name}</Text>
                  ) : null}
                  <Text style={styles.bubbleText}>{messageText(item)}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.bubbleTime}>{formatBubbleTime(item.created_at)}</Text>
                    {outbound ? (
                      <Ionicons
                        name="checkmark-done"
                        size={14}
                        color={String(item.status || '').toUpperCase() === 'READ' ? '#53BDEB' : WA.meta}
                        style={{ marginLeft: 2 }}
                      />
                    ) : null}
                  </View>
                </View>
                {outbound ? <View style={styles.tailOut} /> : null}
              </View>
            );
          }}
        />
      )}

      {templateMode && selectedTemplate ? (
        <View style={[styles.templatePanel, { paddingBottom: composerPad }]}>
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
            ) : null}
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
        <View style={[styles.composer, { paddingBottom: composerPad }]}>
          <View style={styles.inputShell}>
            <TouchableOpacity style={styles.plusBtn} onPress={openTemplatePicker}>
              <Ionicons name="add" size={26} color={WA.meta} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={isTemplateOnlyMode ? 'Only templates allowed…' : 'Message'}
              placeholderTextColor={WA.meta}
              multiline
              editable={!isTemplateOnlyMode}
            />
            <TouchableOpacity onPress={openTemplatePicker} hitSlop={8}>
              <Ionicons name="document-text-outline" size={22} color={WA.meta} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (isTemplateOnlyMode || !draft.trim() || sending) && { opacity: 0.45 },
            ]}
            onPress={sendText}
            disabled={isTemplateOnlyMode || !draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Templates</Text>
            <Text style={styles.modalSub}>CRM Hello / session open templates</Text>
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
  list: { paddingHorizontal: 10, paddingVertical: 10, flexGrow: 1 },
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
    maxWidth: '88%',
    marginBottom: 4,
    position: 'relative',
  },
  bubbleRowIn: { alignSelf: 'flex-start', marginLeft: 4 },
  bubbleRowOut: { alignSelf: 'flex-end', marginRight: 4 },
  bubble: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    minWidth: 80,
  },
  bubbleIn: {
    backgroundColor: WA.bubbleIn,
    borderTopLeftRadius: 0,
  },
  bubbleOut: {
    backgroundColor: WA.bubbleOut,
    borderTopRightRadius: 0,
  },
  tailIn: {
    position: 'absolute',
    left: -6,
    top: 0,
    width: 0,
    height: 0,
    borderTopWidth: 0,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 0,
    borderRightColor: WA.bubbleIn,
    borderBottomColor: 'transparent',
    zIndex: 1,
  },
  tailOut: {
    position: 'absolute',
    right: -6,
    top: 0,
    width: 0,
    height: 0,
    borderTopWidth: 0,
    borderLeftWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 0,
    borderLeftColor: WA.bubbleOut,
    borderBottomColor: 'transparent',
    zIndex: 1,
  },
  templateTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#06CF9C',
    marginBottom: 2,
  },
  bubbleText: { fontSize: 15, color: WA.text, lineHeight: 21 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 2,
  },
  bubbleTime: { fontSize: 11, color: WA.meta },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 8,
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
