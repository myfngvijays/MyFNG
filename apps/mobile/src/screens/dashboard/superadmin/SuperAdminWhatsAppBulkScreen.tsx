import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, apiUpload } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type Contact = { id: string; phone: string; name: string | null };
type Segment = { id: string; name: string; contact_count: number; description?: string | null };
type Upload = { id: string; label: string; added: number };
type Campaign = { id: string; name?: string | null; template_name: string; status: string; sent: number; failed: number; skipped: number; total: number };
type Template = {
  template_name: string;
  display_name?: string | null;
  language_code?: string | null;
  category?: string | null;
  body_text?: string | null;
  example_values?: string[] | null;
  is_active?: boolean;
  meta?: { status?: string; header_image_url?: string; raw?: { parameter_format?: string; components?: Array<{ type?: string; format?: string; text?: string; buttons?: Array<{ type?: string; text?: string }> }> } } | null;
};

function needsHeaderImage(template: Template | null) {
  const header = template?.meta?.raw?.components?.find((item) => String(item.type || '').toUpperCase() === 'HEADER');
  return String(header?.format || '').toUpperCase() === 'IMAGE' || Boolean(String(template?.meta?.header_image_url || '').trim());
}

function hasReplyButtons(template: Template) {
  const buttons = template.meta?.raw?.components?.find((item) => String(item.type || '').toUpperCase() === 'BUTTONS')?.buttons || [];
  return buttons.some((button) => button.text && !/URL|PHONE|OTP|COPY/.test(String(button.type || 'QUICK_REPLY').toUpperCase()));
}

function audienceOf(name: string) {
  const value = String(name || '').trim().toLowerCase();
  if (value === 'service_button_test' || value.startsWith('myfng_service_enquiry') || value.startsWith('myfng_previous_enquiry')) return 'Promotion';
  if (/google_ads|openai_balance|system_health|admin_daily|telecaller_lead|shift_report|funds_alert/.test(value)) return 'Admin';
  return 'Customer';
}

function statusOf(template: Template) {
  return String(template.meta?.status || (template.is_active === false ? 'DISABLED' : 'APPROVED')).toUpperCase();
}

function languageLabel(code?: string | null) {
  const value = String(code || 'en').toLowerCase();
  if (value.startsWith('en')) return 'English';
  if (value.startsWith('hi')) return 'Hindi';
  return (code || 'en').toUpperCase();
}

function variableFormat(template: Template) {
  const fromMeta = String(template.meta?.raw?.parameter_format || '').toUpperCase();
  if (fromMeta === 'NAMED' || fromMeta === 'POSITIONAL') return fromMeta;
  return /\{\{\s*[a-zA-Z_]/.test(template.body_text || '') ? 'NAMED' : 'POSITIONAL';
}

function previewBody(template: Template) {
  let output = template.body_text || '';
  (template.example_values || []).forEach((value, index) => {
    output = output.replaceAll(`{{${index + 1}}}`, value || `{{${index + 1}}}`);
  });
  const buttons = (template.meta?.raw?.components || [])
    .find((item) => String(item.type || '').toUpperCase() === 'BUTTONS')
    ?.buttons?.map((button) => button.text)
    .filter(Boolean) || [];
  return { output, buttons };
}

function variableCount(body: string) {
  const matches = String(body || '').match(/\{\{\s*\d+\s*\}\}/g) || [];
  return new Set(matches.map((item) => item.replace(/\D/g, ''))).size;
}

export default function SuperAdminWhatsAppBulkScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'dashboard' | 'contacts' | 'fields' | 'segments' | 'templates' | 'send' | 'results'>('dashboard');
  const [fields, setFields] = useState<Array<{ id: string; title: string; field_key: string; field_type: string }>>([]);
  const [fieldTitle, setFieldTitle] = useState('');
  const [report, setReport] = useState<any>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [paste, setPaste] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploadId, setUploadId] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [sendSegment, setSendSegment] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState<string[]>([]);
  const [buttonMap, setButtonMap] = useState<Array<{ text: string; action: 'create_lead' | 'ignore'; tag: string }>>([]);
  const [testPhone, setTestPhone] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [progress, setProgress] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const search = new URLSearchParams({ section: 'contacts', page: '1', limit: '40' });
      if (from) search.set('from', from);
      if (to) search.set('to', to);
      if (uploadId) search.set('upload_id', uploadId);
      const [bulk, templateJson, contactJson] = await Promise.all([
        apiFetch<any>('/api/super_admin/whatsapp-bulk'),
        apiFetch<any>('/api/whatsapp/templates'),
        apiFetch<any>(`/api/super_admin/whatsapp-bulk?${search.toString()}`),
      ]);
      setContacts(contactJson.contacts || []);
      setSegments(bulk.segments || []);
      setUploads(bulk.uploads || []);
      setCampaigns(bulk.campaigns || []);
      setFields(bulk.custom_fields || []);
      setTemplates(Array.isArray(templateJson.templates) ? templateJson.templates : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [from, to, uploadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chosen = templates.find((row) => row.template_name === templateName) || null;
  const slots = variableCount(chosen?.body_text || '');
  useEffect(() => {
    setParams((current) => Array.from({ length: slots }, (_, index) => current[index] || (index === 0 ? '{{name}}' : '')));
  }, [slots, templateName]);

  useEffect(() => {
    const components = chosen?.meta?.raw?.components || [];
    const buttons = components.find((item) => String(item.type || '').toUpperCase() === 'BUTTONS');
    const replies = (buttons?.buttons || []).filter((button) => /QUICK/i.test(String(button.type || 'QUICK_REPLY')));
    setButtonMap(replies.map((button) => ({
      text: String(button.text || ''),
      action: /interest|yes|book/i.test(String(button.text || '')) ? 'create_lead' : 'ignore',
      tag: String(button.text || ''),
    })));
  }, [templateName, chosen]);

  useEffect(() => {
    setHeaderImageUrl(String(chosen?.meta?.header_image_url || ''));
  }, [templateName]);

  async function uploadHeader() {
    if (!templateName) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('template_name', templateName);
      form.append('file', { uri: asset.uri, name: 'header.jpg', type: asset.mimeType || 'image/jpeg' } as any);
      const result = await apiUpload<any>('/api/super_admin/whatsapp-bulk', form);
      const url = String(result.url || '');
      setHeaderImageUrl(url);
      setNotice('Header image saved.');
    } catch (err: any) {
      setError(err?.message || 'Could not upload image');
    } finally {
      setBusy(false);
    }
  }

  async function post(payload: Record<string, unknown>) {
    return apiFetch<any>('/api/super_admin/whatsapp-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 60000,
    });
  }

  async function addContacts() {
    setBusy(true);
    setError('');
    try {
      const lines = paste.split(/\r?\n/).filter((line) => line.trim());
      const header = lines[0] || '';
      const hasHeader = /phone|mobile|whatsapp|name/i.test(header);
      const bodyLines = hasHeader ? lines.slice(1) : lines;
      if (!bodyLines.length) throw new Error('No rows found');
      let uploadId = '';
      let added = 0;
      for (let index = 0; index < bodyLines.length; index += 2000) {
        const piece = bodyLines.slice(index, index + 2000);
        const text = hasHeader ? [header, ...piece].join('\n') : piece.join('\n');
        const result = await post({ action: 'add_contacts', text, upload_label: uploadLabel, ...(uploadId ? { upload_id: uploadId } : {}) });
        uploadId = result.upload_id || uploadId;
        added += Number(result.added || 0);
      }
      setPaste('');
      setNotice(`${added} numbers saved`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add contacts');
    } finally {
      setBusy(false);
    }
  }

  async function sendBulk(existingId?: string) {
    setBusy(true);
    setError('');
    setProgress('Starting…');
    try {
      if (needsHeaderImage(chosen) && !headerImageUrl) throw new Error('Upload the header image first.');
      let campaignId = existingId || '';
      if (!campaignId) {
        const started = await post({
          action: 'send_start',
          segment_id: sendSegment,
          template_name: templateName,
          params,
          button_map: buttonMap,
        });
        campaignId = started.campaign.id;
        if (!started.pending) {
          setNotice('Nothing to send. This segment is on DND.');
          await load();
          return;
        }
      }
      let guard = 0;
      while (guard < 400) {
        guard += 1;
        if (needsHeaderImage(chosen) && !headerImageUrl) throw new Error('Upload the header image first.');
        const batch = await post({ action: 'send_batch', campaign_id: campaignId, header_image_url: headerImageUrl });
        setProgress(`Sent ${batch.sent} · failed ${batch.failed} · left ${batch.pending}`);
        if (batch.rate_limited) {
          setNotice('Rate limit hit. Use Continue in a minute.');
          break;
        }
        if (batch.done || batch.pending === 0) {
          setNotice(`Done. Sent ${batch.sent}, failed ${batch.failed}.`);
          break;
        }
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bulk WhatsApp</Text>
          <Text style={styles.sub}>+91 95949 96161</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.tabs}>
        {(['dashboard', 'contacts', 'fields', 'segments', 'templates', 'send', 'results'] as const).map((item) => (
          <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabOn]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextOn]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 12 }}>
          {tab === 'dashboard' ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Contacts</Text>
                <Text style={styles.hint}>{`${contacts.length} on this page`}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Campaigns</Text>
                <Text style={styles.hint}>{`${campaigns.length} campaigns`}</Text>
              </View>
            </>
          ) : null}
          {tab === 'contacts' ? (
            <>
              <Text style={styles.hint}>CSV or one number per line. Extra columns such as car number and address are saved as {'{{car_number}}'} and {'{{address}}'}.</Text>
              <TextInput value={uploadLabel} onChangeText={setUploadLabel} placeholder="Batch name, e.g. 12 Nov" style={styles.input} />
              <TextInput value={paste} onChangeText={setPaste} multiline placeholder="Name,Phone,Car number,Address" style={styles.box} />
              <TextInput value={from} onChangeText={setFrom} placeholder="From date YYYY-MM-DD" style={styles.input} />
              <TextInput value={to} onChangeText={setTo} placeholder="To date YYYY-MM-DD" style={styles.input} />
              {uploads.map((upload) => (
                <TouchableOpacity key={upload.id} style={[styles.choice, uploadId === upload.id && styles.choiceOn]} onPress={() => setUploadId(uploadId === upload.id ? '' : upload.id)}>
                  <Text style={styles.rowTitle}>{upload.label} ({upload.added})</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.primary} disabled={busy || !paste.trim()} onPress={() => void addContacts()}>
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Import batch'}</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>Admin leads → segment. Dates are YYYY-MM-DDTHH:mm</Text>
              <TextInput value={from} onChangeText={setFrom} placeholder="Leads from" style={styles.input} />
              <TextInput value={to} onChangeText={setTo} placeholder="Leads until" style={styles.input} />
              <TextInput value={segmentName} onChangeText={setSegmentName} placeholder="Segment name from leads" style={styles.input} />
              <TouchableOpacity
                style={styles.primary}
                disabled={busy || !segmentName.trim()}
                onPress={() => void post({ action: 'segment_from_leads', name: segmentName, from, to }).then((result) => {
                  setNotice(`Segment ${result.segment.name} · ${result.contact_count} leads`);
                  setSegmentName('');
                  return load();
                }).catch((err) => setError(err?.message || 'Could not create segment'))}
              >
                <Text style={styles.primaryText}>Create segment from leads</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primary}
                disabled={busy || !segmentName.trim()}
                onPress={() => void post({ action: 'segment_from_filter', name: segmentName, from, to, upload_id: uploadId }).then(() => { setSegmentName(''); return load(); }).catch((err) => setError(err?.message || 'Could not create segment'))}
              >
                <Text style={styles.primaryText}>Create segment from filter</Text>
              </TouchableOpacity>
              {contacts.map((contact, index) => (
                <View key={contact.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{index + 1}. {contact.name || contact.phone}</Text>
                  <Text style={styles.hint}>{contact.phone}</Text>
                </View>
              ))}
            </>
          ) : null}
          {tab === 'fields' ? (
            <>
              <Text style={styles.hint}>Columns from a CSV are created here. Add one by title.</Text>
              <TextInput value={fieldTitle} onChangeText={setFieldTitle} placeholder="Field title, e.g. Car number" style={styles.input} />
              <TouchableOpacity
                style={styles.primary}
                disabled={busy || !fieldTitle.trim()}
                onPress={() => void post({ action: 'save_field', title: fieldTitle, field_type: 'STRING' }).then(() => { setFieldTitle(''); return load(); }).catch((err) => setError(err?.message || 'Could not save field'))}
              >
                <Text style={styles.primaryText}>Add custom field</Text>
              </TouchableOpacity>
              {fields.map((field) => (
                <View key={field.id} style={styles.row}>
                  <Text style={styles.badge}>{field.field_type}</Text>
                  <Text style={styles.rowTitle}>{field.title}</Text>
                  <Text style={styles.hint}>{field.field_key}</Text>
                </View>
              ))}
              {!fields.length ? <Text style={styles.hint}>No fields yet.</Text> : null}
            </>
          ) : null}
          {tab === 'segments' ? (
            <>
              <TextInput value={segmentName} onChangeText={setSegmentName} placeholder="Segment name" style={styles.input} />
              <TouchableOpacity
                style={styles.primary}
                disabled={busy || !segmentName.trim()}
                onPress={() => void post({ action: 'save_segment', name: segmentName }).then(() => { setSegmentName(''); return load(); }).catch((err) => setError(err?.message || 'Could not save'))}
              >
                <Text style={styles.primaryText}>Create segment</Text>
              </TouchableOpacity>
              {segments.map((segment) => (
                <View key={segment.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{segment.name}</Text>
                  <Text style={styles.hint}>{segment.description || segment.name}</Text>
                  <Text style={{ color: '#f43f5e', fontWeight: '600' }}>{segment.contact_count} contacts</Text>
                  <TouchableOpacity onPress={() => { setSendSegment(segment.id); setTab('send'); }}>
                    <Text style={styles.link}>Use</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}
          {tab === 'templates' ? (
            <>
              {templates.filter(hasReplyButtons).map((template, index) => (
                <TouchableOpacity key={`${template.template_name}-${template.language_code}`} style={styles.row} onPress={() => setPreview(template)}>
                  <Text style={styles.badge}>{statusOf(template)}</Text>
                  <Text style={styles.rowTitle}>{index + 1}. {template.display_name || template.template_name}</Text>
                  <Text style={styles.hint}>{audienceOf(template.template_name)} · {String(template.category || 'UTILITY').toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
              {!templates.filter(hasReplyButtons).length ? <Text style={styles.hint}>No button templates yet. Bulk send uses only templates with reply buttons.</Text> : null}
            </>
          ) : null}
          {tab === 'send' ? (
            <>
              <Text style={styles.hint}>Segment</Text>
              {segments.map((segment) => (
                <TouchableOpacity key={segment.id} style={[styles.choice, sendSegment === segment.id && styles.choiceOn]} onPress={() => setSendSegment(segment.id)}>
                  <Text style={styles.rowTitle}>{segment.name} ({segment.contact_count})</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.hint}>Template</Text>
              {templates.filter(hasReplyButtons).slice(0, 40).map((template, index) => (
                <TouchableOpacity key={template.template_name} style={[styles.choice, templateName === template.template_name && styles.choiceOn]} onPress={() => setTemplateName(template.template_name)}>
                  <Text style={styles.rowTitle}>{index + 1}. {template.display_name || template.template_name}</Text>
                </TouchableOpacity>
              ))}
              {needsHeaderImage(chosen) ? (
                <>
                  <Text style={styles.hint}>Header image</Text>
                  <TouchableOpacity style={styles.choice} onPress={() => void uploadHeader()}>
                    <Text style={styles.rowTitle}>{headerImageUrl ? 'Change header image' : 'Upload header image'}</Text>
                  </TouchableOpacity>
                  {headerImageUrl ? <Image source={{ uri: headerImageUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }} resizeMode="contain" /> : null}
                </>
              ) : null}
              {chosen?.body_text ? <Text style={styles.hint}>{chosen.body_text}</Text> : null}
              {buttonMap.map((item, index) => (
                <TouchableOpacity
                  key={item.text}
                  style={[styles.choice, item.action === 'create_lead' && styles.choiceOn]}
                  onPress={() => setButtonMap((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, action: row.action === 'create_lead' ? 'ignore' : 'create_lead' } : row))}
                >
                  <Text style={styles.rowTitle}>{item.text}</Text>
                  <Text style={styles.hint}>{item.action === 'create_lead' ? 'Creates a TeleCRM lead' : 'Does nothing'}</Text>
                </TouchableOpacity>
              ))}
              <TextInput value={testPhone} onChangeText={setTestPhone} placeholder="Test number" style={styles.input} />
              <TouchableOpacity
                style={styles.primary}
                disabled={busy || !templateName || !testPhone.trim()}
                onPress={() => void post({ action: 'test_send', phone: testPhone, template_name: templateName, params, name: 'Test', header_image_url: headerImageUrl }).then(() => setNotice(`Test sent to ${testPhone}`)).catch((err) => setError(err?.message || 'Test failed'))}
              >
                <Text style={styles.primaryText}>Send test</Text>
              </TouchableOpacity>
              {params.map((value, index) => (
                <TextInput
                  key={index}
                  value={value}
                  onChangeText={(text) => setParams((current) => current.map((item, itemIndex) => (itemIndex === index ? text : item)))}
                  placeholder={`{{${index + 1}}}  use {{name}} or {{car_number}}`}
                  style={styles.input}
                />
              ))}
              <TouchableOpacity style={styles.primary} disabled={busy || !sendSegment || !templateName} onPress={() => void sendBulk()}>
                <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send bulk'}</Text>
              </TouchableOpacity>
              {progress ? <Text style={styles.hint}>{progress}</Text> : null}
              {campaigns.map((campaign) => (
                <View key={campaign.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{campaign.name || campaign.template_name}</Text>
                  <Text style={styles.hint}>{campaign.status} · sent {campaign.sent} · failed {campaign.failed} / {campaign.total}</Text>
                  <TouchableOpacity onPress={() => void apiFetch<any>(`/api/super_admin/whatsapp-bulk?section=campaign&id=${encodeURIComponent(campaign.id)}`).then((json) => {
                    const report = json.report;
                    setNotice(`${report.campaign?.template_name || 'Campaign'}: sent ${report.rates?.sent}% · delivered ${report.rates?.delivered}% · read ${report.rates?.read}% · replied ${report.rates?.replied}% (${report.replied})`);
                  }).catch((err) => setError(err?.message || 'Could not load campaign'))}>
                    <Text style={styles.link}>Details</Text>
                  </TouchableOpacity>
                  {campaign.status !== 'completed' ? (
                    <TouchableOpacity disabled={busy} onPress={() => void sendBulk(campaign.id)}>
                      <Text style={styles.link}>Continue</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
          {tab === 'results' ? (
            <>
              {!report ? campaigns.map((campaign) => (
                <TouchableOpacity
                  key={campaign.id}
                  style={styles.row}
                  onPress={() => void apiFetch<any>(`/api/super_admin/whatsapp-bulk?section=campaign&id=${encodeURIComponent(campaign.id)}`).then((json) => setReport(json.report)).catch((err) => setError(err?.message || 'Could not load campaign'))}
                >
                  <Text style={styles.rowTitle}>{campaign.name || campaign.template_name}</Text>
                  <Text style={styles.hint}>{campaign.status} · sent {campaign.sent} / {campaign.total}</Text>
                </TouchableOpacity>
              )) : (
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => setReport(null)}><Text style={styles.link}>All campaigns</Text></TouchableOpacity>
                  <Text style={styles.rowTitle}>{report.campaign?.name || report.campaign?.template_name}</Text>
                  <Text style={styles.hint}>Template {report.campaign?.template_name}</Text>
                  <Text style={styles.hint}>Audience {report.audience}</Text>
                  <Text style={styles.hint}>Sent {report.sent} ({report.rates?.sent}%)</Text>
                  <Text style={styles.hint}>Delivered {report.delivered} ({report.rates?.delivered}%)</Text>
                  <Text style={styles.hint}>Read {report.read} ({report.rates?.read}%)</Text>
                  <Text style={styles.hint}>Replied {report.replied} ({report.rates?.replied}%)</Text>
                  <Text style={styles.hint}>Auto replied {report.auto || 0} ({report.rates?.auto || 0}%)</Text>
                  <Text style={styles.hint}>Failed {report.failed} ({report.rates?.failed}%)</Text>
                  {(report.replies || []).map((row: { button: string; count: number; percent: number }) => (
                    <Text key={row.button} style={styles.hint}>{row.button}: {row.count} · {row.percent}%</Text>
                  ))}
                </View>
              )}
              {!campaigns.length && !report ? <Text style={styles.hint}>No campaigns yet.</Text> : null}
            </>
          ) : null}
        </ScrollView>
      )}
      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPreview(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {preview ? (
              <>
                <Text style={styles.hint}>{statusOf(preview)} · {String(preview.category || 'UTILITY').toUpperCase()} · {languageLabel(preview.language_code)}</Text>
                <Text style={styles.rowTitle}>{preview.display_name || preview.template_name}</Text>
                <View style={styles.bubble}>
                  {preview.meta?.header_image_url ? (
                    <Image source={{ uri: preview.meta.header_image_url }} style={{ width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 }} resizeMode="contain" />
                  ) : null}
                  <Text style={styles.bubbleText}>{previewBody(preview).output || 'No body'}</Text>
                  {previewBody(preview).buttons.map((label) => (
                    <Text key={label} style={styles.bubbleButton}>{label}</Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.primary}
                  disabled={statusOf(preview) !== 'APPROVED'}
                  onPress={() => { setTemplateName(preview.template_name); setPreview(null); setTab('send'); }}
                >
                  <Text style={styles.primaryText}>Use in campaign</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPreview(null)}>
                  <Text style={styles.link}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  sub: { color: '#64748B', marginTop: 2 },
  error: { color: '#B91C1C', marginHorizontal: SPACING.md },
  notice: { color: '#047857', marginHorizontal: SPACING.md },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { textTransform: 'capitalize', fontWeight: '700', color: '#334155' },
  tabTextOn: { color: '#fff' },
  hint: { color: '#64748B', fontSize: 13 },
  box: { minHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#fff', padding: 12, textAlignVertical: 'top' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#fff', padding: 12 },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  row: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  rowTitle: { fontWeight: '600', color: COLORS.text },
  link: { color: COLORS.primary, fontWeight: '700', marginTop: 4 },
  choice: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  choiceOn: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#D1FAE5', color: '#047857', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 },
  bubble: { backgroundColor: '#EFEAE2', borderRadius: 12, padding: 12, gap: 8 },
  bubbleText: { backgroundColor: '#fff', borderRadius: 8, padding: 10, color: '#111B21' },
  bubbleButton: { backgroundColor: '#fff', borderRadius: 8, padding: 8, textAlign: 'center', color: '#027EB5', fontWeight: '600' },
});
