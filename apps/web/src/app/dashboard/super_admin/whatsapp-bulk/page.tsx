'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Contact = { id: string; phone: string; name: string | null; created_at: string; upload_id?: string | null; fields?: Record<string, string> | null };
type Segment = { id: string; name: string; created_at: string; contact_count: number; description?: string | null; condition_count?: number | null };
type Upload = { id: string; label: string; added: number; created_at: string };
type Campaign = {
  id: string;
  name: string | null;
  template_name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  created_at: string;
};
type WaButton = { type: string; text: string; url?: string; phone_number?: string };
type Template = {
  template_name: string;
  display_name?: string | null;
  language_code?: string | null;
  category?: string | null;
  body_text?: string | null;
  example_values?: string[] | null;
  is_active?: boolean;
  variable_keys?: string[] | null;
  meta?: { status?: string; header_image_url?: string; raw?: { parameter_format?: string; components?: Array<{ type?: string; format?: string; text?: string; buttons?: WaButton[] }> } } | null;
};
type ButtonAction = { text: string; action: 'create_lead' | 'ignore'; tag: string };
type Tab = 'dashboard' | 'contacts' | 'fields' | 'segments' | 'templates' | 'campaign' | 'results';
type AudienceRow = { id: string; name: string | null; phone: string; status: string; reply_button: string | null; reply_kind?: string | null; delivery_status?: string | null; sent_at: string | null; replied_at: string | null };
type CustomField = { id: string; field_key: string; title: string; description: string; field_type: string; created_at: string };

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
  const body = `${template.body_text || ''} ${(template.variable_keys || []).join(' ')}`;
  return /\{\{\s*[a-zA-Z_]/.test(body) ? 'NAMED' : 'POSITIONAL';
}

function statusTone(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'REJECTED' || status === 'DISABLED' || status === 'PAUSED') return 'bg-orange-100 text-orange-700';
  return 'bg-amber-100 text-amber-800';
}

const SAMPLE_CAMPAIGN_ID = 'sample-10k-whatsapp';

const SAMPLE_REPORT = {
  sample: true,
  campaign: {
    id: SAMPLE_CAMPAIGN_ID,
    name: '10k WhatsApp blast (sample)',
    template_name: 'service_button_test',
    status: 'COMPLETED',
  },
  audience: 10000,
  sent: 862,
  delivered: 806,
  read: 444,
  replied: 30,
  auto: 86,
  failed: 9138,
  skipped: 0,
  pending: 0,
  rates: { sent: 8.6, delivered: 8.1, read: 4.4, replied: 0.3, auto: 0.9, failed: 91.4, skipped: 0 },
  replies: [
    { button: 'Book service', count: 17, percent: 56.7 },
    { button: 'Not interested', count: 10, percent: 33.3 },
    { button: 'Interested', count: 3, percent: 10 },
  ],
};

const SAMPLE_NAMES = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rohit', 'Pooja', 'Karan', 'Neha', 'Arjun', 'Kavita', 'Suresh', 'Meera', 'Imran', 'Divya'];
const SAMPLE_REPLIES = ['Book service', 'Not interested', 'Interested'] as const;

function sampleCount(view: string) {
  if (view === 'sent') return SAMPLE_REPORT.sent;
  if (view === 'delivered') return SAMPLE_REPORT.delivered;
  if (view === 'read') return SAMPLE_REPORT.read;
  if (view === 'replied') return SAMPLE_REPORT.replied;
  if (view === 'auto') return SAMPLE_REPORT.auto;
  if (view === 'failed') return SAMPLE_REPORT.failed;
  return SAMPLE_REPORT.audience;
}

function sampleAudience(view: string): AudienceRow[] {
  const sentAt = '2026-11-12T11:00:00.000Z';
  const rows: AudienceRow[] = [];
  const total = view === 'replied' ? 16 : 24;
  for (let index = 0; index < total; index += 1) {
    const auto = view === 'auto' || (view === 'all' && index >= 2 && index <= 3);
    const reply = auto ? 'Thanks, I will reply when I am free.' : view === 'replied' ? SAMPLE_REPLIES[index % SAMPLE_REPLIES.length] : null;
    const failed = !auto && (view === 'failed' || (view === 'all' && index > 3));
    const read = view === 'read' || view === 'replied' || (view === 'delivered' && index % 2 === 0);
    const delivered = !failed && (view === 'delivered' || view === 'read' || view === 'replied' || view === 'sent');
    rows.push({
      id: `sample-${view}-${index}`,
      name: SAMPLE_NAMES[index % SAMPLE_NAMES.length],
      phone: `91${String(9800001000 + index)}`,
      status: failed ? 'failed' : 'sent',
      reply_button: reply,
      reply_kind: auto ? 'auto' : null,
      delivery_status: auto ? 'AUTO' : failed ? 'FAILED' : read ? 'READ' : delivered ? 'DELIVERED' : 'SENT',
      sent_at: failed ? null : sentAt,
      replied_at: reply ? '2026-11-12T11:20:00.000Z' : null,
    });
  }
  return rows;
}

function hasReplyButtons(template: Template) {
  const buttons = template.meta?.raw?.components?.find((item) => String(item.type || '').toUpperCase() === 'BUTTONS')?.buttons || [];
  return buttons.some((button) => button.text && !/URL|PHONE|OTP|COPY/.test(String(button.type || 'QUICK_REPLY').toUpperCase()));
}

function templateNeedsImage(template: Template | null) {
  const header = template?.meta?.raw?.components?.find((item) => String(item.type || '').toUpperCase() === 'HEADER');
  return String(header?.format || '').toUpperCase() === 'IMAGE' || Boolean(String(template?.meta?.header_image_url || '').trim());
}

function partsOf(template: Template | null) {
  const components = template?.meta?.raw?.components || [];
  const header = components.find((item) => String(item.type || '').toUpperCase() === 'HEADER');
  const footer = components.find((item) => String(item.type || '').toUpperCase() === 'FOOTER');
  const buttons = components.find((item) => String(item.type || '').toUpperCase() === 'BUTTONS');
  return {
    header: String(header?.text || ''),
    headerImage: String(template?.meta?.header_image_url || ''),
    footer: String(footer?.text || ''),
    buttons: (buttons?.buttons || []).map((button) => ({
      type: String(button.type || 'QUICK_REPLY').toUpperCase(),
      text: String(button.text || ''),
      url: button.url,
      phone: button.phone_number,
    })),
  };
}

function variableCount(body: string) {
  const matches = String(body || '').match(/\{\{\s*\d+\s*\}\}/g) || [];
  return new Set(matches.map((item) => item.replace(/\D/g, ''))).size;
}

function fillBody(body: string, params: string[]) {
  let output = body;
  params.forEach((value, index) => {
    output = output.replaceAll(`{{${index + 1}}}`, value.replace(/\{\{\s*name\s*\}\}/gi, 'Rahul') || `{{${index + 1}}}`);
  });
  return output;
}

const PIE_COLORS = ['#0f766e', '#f97316', '#1d4ed8', '#7c3aed', '#e11d48', '#0891b2'];

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
}

function ResultCharts({ report }: { report: { sent: number; delivered: number; read: number; replied: number; auto?: number; failed: number; replies?: Array<{ button: string; count: number; percent: number }> } }) {
  const bars = [
    { name: 'Sent', value: report.sent, fill: '#2563eb' },
    { name: 'Delivered', value: report.delivered, fill: '#0891b2' },
    { name: 'Read', value: report.read, fill: '#059669' },
    { name: 'Replied', value: report.replied, fill: '#4f46e5' },
    { name: 'Auto', value: report.auto || 0, fill: '#7c3aed' },
    { name: 'Failed', value: report.failed, fill: '#d97706' },
  ];
  const slices = (report.replies || []).filter((row) => row.count > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
        <p className="text-sm font-semibold text-slate-800">Delivery</p>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} barSize={28}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {bars.map((bar) => <Cell key={bar.name} fill={bar.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
        <p className="text-sm font-semibold text-slate-800">Button replies</p>
        <div className="mt-2 h-64">
          {slices.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="count" nameKey="button" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  {slices.map((slice, index) => <Cell key={slice.button} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="pt-16 text-center text-sm text-slate-400">No button replies yet.</p>}
        </div>
      </div>
    </div>
  );
}

function PhonePreview({
  template,
  params,
  headerImage,
}: {
  template: Template;
  params: string[];
  headerImage?: string;
}) {
  const parts = partsOf(template);
  const image = headerImage || parts.headerImage;
  const body = fillBody(template.body_text || '', params);
  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.6rem] border-[8px] border-[#111b21] bg-[#efeae2] shadow-lg">
      <div className="bg-[#075e54] px-3 py-2 text-white">
        <p className="text-[11px] text-white/70">My FNG Autocare</p>
        <p className="text-sm font-semibold">+91 95949 96161</p>
      </div>
      <div className="min-h-[220px] px-3 py-3">
        <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
          {image ? <img src={image} alt="" className="-mx-3 -mt-2 mb-2 aspect-square w-[calc(100%+1.5rem)] object-contain" /> : null}
          {parts.header ? <p className="mb-1 text-sm font-semibold text-[#111b21]">{parts.header}</p> : null}
          <p className="whitespace-pre-wrap text-[13px] leading-5 text-[#111b21]">{body || 'No body'}</p>
          {parts.footer ? <p className="mt-2 text-[11px] text-[#667781]">{parts.footer}</p> : null}
          <p className="mt-1 text-right text-[10px] text-[#667781]">now</p>
        </div>
        {parts.buttons.length ? (
          <div className="mt-1 overflow-hidden rounded-lg bg-white shadow-sm">
            {parts.buttons.map((button) => (
              <div key={button.text} className="border-t border-[#f0f2f5] px-2 py-2 text-center text-[13px] font-medium text-[#027eb5]">
                {button.text || 'Button'}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BulkWhatsAppPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldDescription, setFieldDescription] = useState('');
  const [fieldType, setFieldType] = useState('STRING');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tablesMissing, setTablesMissing] = useState(false);

  const [paste, setPaste] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [parsedCount, setParsedCount] = useState(0);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [segmentQuery, setSegmentQuery] = useState('');
  const [segmentEditor, setSegmentEditor] = useState<{ id: string; name: string; description: string; condition_count: number } | null>(null);

  const [report, setReport] = useState<any>(null);
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [audienceTotal, setAudienceTotal] = useState(0);
  const [audienceView, setAudienceView] = useState('all');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [leadFrom, setLeadFrom] = useState('');
  const [leadTo, setLeadTo] = useState('');
  const [leadStatus, setLeadStatus] = useState('ALL');
  const [leadCrm, setLeadCrm] = useState('ALL');
  const [leadCity, setLeadCity] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadTotal, setLeadTotal] = useState<number | null>(null);
  const [leadName, setLeadName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [savedCampaignId, setSavedCampaignId] = useState('');
  const [campaignReady, setCampaignReady] = useState(false);
  const [sendSegment, setSendSegment] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [buttonMap, setButtonMap] = useState<ButtonAction[]>([]);
  const [testPhone, setTestPhone] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [progress, setProgress] = useState('');

  const loadHome = useCallback(async () => {
    const [bulkRes, templateRes] = await Promise.all([
      fetch('/api/super_admin/whatsapp-bulk'),
      fetch('/api/whatsapp/templates'),
    ]);
    const bulk = await bulkRes.json();
    const templateJson = await templateRes.json().catch(() => ({}));
    if (!bulkRes.ok) {
      setTablesMissing(Boolean(bulk.tables_missing));
      throw new Error(bulk.error || 'Could not load bulk WhatsApp');
    }
    setTablesMissing(false);
    setSegments(bulk.segments || []);
    setUploads(bulk.uploads || []);
    setCampaigns(bulk.campaigns || []);
    setContactTotal(bulk.contact_total || 0);
    setTemplates(Array.isArray(templateJson.templates) ? templateJson.templates : []);
    setCustomFields(Array.isArray(bulk.custom_fields) ? bulk.custom_fields : []);
  }, []);

  const loadContacts = useCallback(async (nextPage = page) => {
    const search = new URLSearchParams({
      section: 'contacts',
      page: String(nextPage),
      limit: '40',
    });
    if (query.trim()) search.set('q', query.trim());
    if (from) search.set('from', from);
    if (to) search.set('to', to);
    if (uploadId) search.set('upload_id', uploadId);
    const response = await fetch(`/api/super_admin/whatsapp-bulk?${search.toString()}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Could not load contacts');
    setContacts(json.contacts || []);
    setFilteredTotal(json.total || 0);
  }, [from, page, query, to, uploadId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadHome()
      .catch((err) => setError(err?.message || 'Could not load'))
      .finally(() => setLoading(false));
  }, [loadHome]);

  useEffect(() => {
    if (tab !== 'contacts') return;
    const timer = setTimeout(() => {
      void loadContacts(page).catch((err) => setError(err?.message || 'Could not load contacts'));
    }, 250);
    return () => clearTimeout(timer);
  }, [tab, loadContacts, page]);

  const chosen = templates.find((row) => row.template_name === templateName) || null;
  const needsImage = templateNeedsImage(chosen);
  const chosenParts = partsOf(chosen);
  const slots = variableCount(chosen?.body_text || '');
  const quickReplies = chosenParts.buttons.filter((button) => button.type === 'QUICK_REPLY' || button.type === 'QUICKREPLY');

  useEffect(() => {
    setParams((current) => Array.from({ length: slots }, (_, index) => current[index] || (index === 0 ? '{{name}}' : '')));
  }, [slots, templateName]);

  useEffect(() => {
    setButtonMap(
      quickReplies.map((button) => ({
        text: button.text,
        action: /interest|yes|book|call/i.test(button.text) ? 'create_lead' : 'ignore',
        tag: button.text,
      })),
    );
    // Only reset when the chosen template's buttons change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  useEffect(() => {
    setHeaderImageUrl(String(chosen?.meta?.header_image_url || ''));
  }, [templateName]);

  const fieldColumns = useMemo(() => {
    if (customFields.length) {
      return customFields.map((field) => ({ key: field.field_key, label: field.title }));
    }
    const keys = new Set<string>();
    contacts.forEach((contact) => Object.keys(contact.fields || {}).forEach((key) => keys.add(key)));
    return Array.from(keys).map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  }, [contacts, customFields]);

  const visibleTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (!hasReplyButtons(template)) return false;
      if (!q) return true;
      return `${template.display_name || ''} ${template.template_name} ${template.body_text || ''}`.toLowerCase().includes(q);
    });
  }, [templateQuery, templates]);

  function openSampleReport() {
    setReport(SAMPLE_REPORT);
    setAudienceOpen(false);
    setAudience([]);
    setTab('results');
  }

  async function openReport(id: string) {
    if (id === SAMPLE_CAMPAIGN_ID) {
      openSampleReport();
      return;
    }
    const response = await fetch(`/api/super_admin/whatsapp-bulk?section=campaign&id=${encodeURIComponent(id)}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Could not load campaign');
    setReport(json.report);
    setAudienceOpen(false);
    setTab('results');
  }

  async function openAudience(view = audienceView) {
    if (!report?.campaign?.id) return;
    if (report.campaign.id === SAMPLE_CAMPAIGN_ID) {
      setAudienceView(view);
      setAudienceOpen(true);
      setAudience(sampleAudience(view));
      setAudienceTotal(sampleCount(view));
      return;
    }
    setAudienceView(view);
    setAudienceOpen(true);
    const response = await fetch(`/api/super_admin/whatsapp-bulk?section=audience&id=${encodeURIComponent(report.campaign.id)}&view=${encodeURIComponent(view)}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Could not load audience');
    setAudience(json.rows || []);
    setAudienceTotal(json.total || 0);
  }

  async function post(payload: Record<string, unknown>) {
    const response = await fetch('/api/super_admin/whatsapp-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    if (!uploadLabel) setUploadLabel(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setPaste(text);
      setParsedCount(text.split(/\r?\n/).filter((line) => line.trim()).length);
    };
    reader.readAsText(file);
  }

  async function importContacts() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const lines = paste.split(/\r?\n/).filter((line) => line.trim());
      const header = lines[0] || '';
      const hasHeader = /phone|mobile|whatsapp|name/i.test(header);
      const bodyLines = hasHeader ? lines.slice(1) : lines;
      if (!bodyLines.length) throw new Error('No rows found in this file');
      const chunkSize = 2000;
      let uploadId = '';
      let added = 0;
      let label = uploadLabel;
      let last: any = null;
      const chunks = Math.max(1, Math.ceil(bodyLines.length / chunkSize));
      for (let index = 0; index < bodyLines.length; index += chunkSize) {
        const piece = bodyLines.slice(index, index + chunkSize);
        const text = hasHeader ? [header, ...piece].join('\n') : piece.join('\n');
        setProgress(`Saving ${Math.min(index + piece.length, bodyLines.length).toLocaleString('en-IN')} of ${bodyLines.length.toLocaleString('en-IN')}`);
        last = await post({
          action: 'add_contacts',
          text,
          upload_label: label,
          ...(uploadId ? { upload_id: uploadId } : {}),
        });
        uploadId = last.upload_id || uploadId;
        label = last.upload_label || label;
        added += Number(last.added || 0);
        if (chunks > 1) setNotice(`${added.toLocaleString('en-IN')} saved so far…`);
      }
      const result = last || { added: 0, upload_label: label, field_titles: [] };
      result.added = added;
      setNotice(
        result.fields_saved === false
          ? `${added.toLocaleString('en-IN')} numbers saved in “${result.upload_label}”. Extra columns were not stored yet. Run database/391_whatsapp_bulk_fields_and_button_flows.sql, then upload again.`
          : result.custom_fields_ready === false
            ? `${added.toLocaleString('en-IN')} numbers saved. Run database/392_whatsapp_bulk_custom_fields.sql so the columns become custom fields.`
            : `${added.toLocaleString('en-IN')} numbers saved in “${result.upload_label}”.${result.field_titles?.length ? ` Fields: ${result.field_titles.join(', ')}.` : ''}`,
      );
      setPaste('');
      setFileName('');
      setParsedCount(0);
      setPage(1);
      await loadHome();
      await loadContacts(1);
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function createSegmentFromFilter() {
    setBusy(true);
    setError('');
    try {
      const result = await post({
        action: 'segment_from_filter',
        name: segmentName,
        q: query,
        from,
        to,
        upload_id: uploadId,
      });
      setNotice(`Segment “${result.segment.name}” created with ${result.contact_count} contacts.`);
      setSegmentName('');
      await loadHome();
      setTab('segments');
    } catch (err: any) {
      setError(err?.message || 'Could not create segment');
    } finally {
      setBusy(false);
    }
  }

  async function uploadHeader(file: File | null) {
    if (!file || !templateName) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('template_name', templateName);
      const response = await fetch('/api/super_admin/whatsapp-bulk', { method: 'POST', body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not upload image');
      const url = String(json.url || '');
      setHeaderImageUrl(url);
      setTemplates((current) => current.map((template) => (
        template.template_name === templateName
          ? { ...template, meta: { ...(template.meta || {}), header_image_url: url } }
          : template
      )));
      setNotice('Header image saved. Test send and the campaign will use this photo.');
    } catch (err: any) {
      setError(err?.message || 'Could not upload image');
    } finally {
      setBusy(false);
    }
  }

  async function testSend() {
    setBusy(true);
    setError('');
    try {
      if (needsImage && !headerImageUrl) throw new Error('Upload the header image first.');
      await post({ action: 'test_send', phone: testPhone, template_name: templateName, params, name: 'Test', header_image_url: headerImageUrl });
      setNotice(`Test sent to ${testPhone}.`);
    } catch (err: any) {
      setError(err?.message || 'Test failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveCampaignDraft() {
    setBusy(true);
    setError('');
    try {
      const saved = await post({
        action: 'save_campaign',
        campaign_id: savedCampaignId || undefined,
        name: campaignName || undefined,
        segment_id: sendSegment,
        template_name: templateName,
        params,
        button_map: buttonMap,
      });
      setSavedCampaignId(saved.campaign.id);
      setCampaignReady(true);
      setNotice(`Campaign saved. ${saved.campaign.total || 0} contacts. Launch it below when you are ready.`);
      await loadHome();
    } catch (err: any) {
      setCampaignReady(false);
      setError(err?.message || 'Could not save campaign');
    } finally {
      setBusy(false);
    }
  }

  async function launch(existingId?: string) {
    setBusy(true);
    setError('');
    setProgress('Preparing campaign…');
    let startedSending = false;
    try {
      if (needsImage && !headerImageUrl) throw new Error('Upload the header image first.');
      let campaignId = existingId || savedCampaignId || '';
      if (!existingId) {
        const started = await post({
          action: 'send_start',
          campaign_id: savedCampaignId || undefined,
          name: campaignName || undefined,
          segment_id: sendSegment,
          template_name: templateName,
          params,
          button_map: buttonMap,
        });
        campaignId = started.campaign.id;
        startedSending = true;
        if (!started.pending) {
          setNotice('Nothing to send. This segment is on DND.');
          await loadHome();
          return;
        }
      }
      let guard = 0;
      while (guard < 500) {
        guard += 1;
        if (needsImage && !headerImageUrl) throw new Error('Upload the header image first.');
        const batch = await post({ action: 'send_batch', campaign_id: campaignId, header_image_url: headerImageUrl });
        setProgress(`Sent ${batch.sent} · failed ${batch.failed} · left ${batch.pending}`);
        if (batch.rate_limited) {
          setNotice('WhatsApp slowed the send. Use Continue in a minute.');
          break;
        }
        if (batch.stopped) {
          setNotice(`Sending stopped. ${batch.sent || 0} had already gone out.`);
          break;
        }
        if (batch.done || batch.pending === 0) {
          setNotice(`Campaign finished. Sent ${batch.sent}, failed ${batch.failed}, skipped ${batch.skipped}.`);
          await openReport(campaignId);
          break;
        }
      }
      await loadHome();
    } catch (err: any) {
      setError(err?.message || 'Campaign failed');
    } finally {
      if (startedSending) {
        setSavedCampaignId('');
        setCampaignReady(false);
      }
      setBusy(false);
      setProgress('');
    }
  }

  const approved = chosen ? statusOf(chosen) === 'APPROVED' : false;
  const pages = Math.max(1, Math.ceil(filteredTotal / 40));
  const contactSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    uploads.forEach((upload) => {
      const day = dayLabel(upload.created_at);
      byDay.set(day, (byDay.get(day) || 0) + Number(upload.added || 0));
    });
    return Array.from(byDay.entries()).map(([day, contacts]) => ({ day, contacts }));
  }, [uploads]);
  const campaignSeries = useMemo(() => {
    const byDay = new Map<string, { campaigns: number; receivers: number }>();
    campaigns.forEach((campaign) => {
      const day = dayLabel(campaign.created_at);
      const current = byDay.get(day) || { campaigns: 0, receivers: 0 };
      current.campaigns += 1;
      current.receivers += Number(campaign.total || campaign.sent || 0);
      byDay.set(day, current);
    });
    return Array.from(byDay.entries()).map(([day, row]) => ({ day, ...row }));
  }, [campaigns]);
  const dashboardContacts = contactTotal;
  const dashboardReceivers = campaigns.reduce((sum, campaign) => sum + Number(campaign.total || 0), 0);
  const dashboardCampaigns = campaigns.length;

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#004AAD]">WhatsApp · +91 95949 96161</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Bulk campaigns</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Contacts, fields, segments, and campaign results for +91 95949 96161.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Contacts', contactTotal],
                ['Segments', segments.length],
                ['Templates', templates.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-[72px] rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                  <p className="text-sm font-semibold text-slate-800">{loading ? '–' : value}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {([
            ['dashboard', 'Dashboard'],
            ['contacts', 'Contacts'],
            ['fields', 'Fields'],
            ['segments', 'Segments'],
            ['templates', 'Templates'],
            ['campaign', 'Create campaign'],
            ['results', 'Campaign results'],
          ] as Array<[Tab, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === id ? 'border-[#004AAD] text-[#004AAD]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
          <Link href="/dashboard/super_admin/whatsapp-templates" className="ml-auto self-center text-sm font-semibold text-[#004AAD]">
            Template studio
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        {tablesMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Run <code className="font-mono">database/388_whatsapp_bulk_send.sql</code> and <code className="font-mono">database/389_whatsapp_bulk_filters.sql</code> in Supabase, then refresh.
          </div>
        ) : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}

        {tab === 'dashboard' ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Contacts overview</p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Total contacts</p>
                    <p className="text-xl font-semibold tracking-tight text-slate-950">{loading ? '–' : dashboardContacts.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={contactSeries}>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="contacts" name="New contacts" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Campaign overview</p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Total campaigns</p>
                    <p className="text-xl font-semibold tracking-tight text-slate-950">{dashboardCampaigns.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 sm:mt-7">Total receivers</p>
                    <p className="text-xl font-semibold tracking-tight text-slate-950">{dashboardReceivers.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={campaignSeries}>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                      <Line type="monotone" dataKey="campaigns" name="Campaigns" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="receivers" name="Receivers" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Last send</p>
                  <div className="mt-3 space-y-2">
                    {[
                      ['Sent', campaigns[0]?.sent || 0],
                      ['Failed', campaigns[0]?.failed || 0],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{label}</span>
                          <span>{Number(value).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-[#004AAD]" style={{ width: `${Math.min(100, Math.max(campaigns[0] ? 2 : 0, (Number(value) / Math.max(campaigns[0]?.total || 1, 1)) * 100))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {!campaigns.length ? <p className="mt-3 text-xs text-slate-400">Launch a campaign to see sent and failed here.</p> : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Button replies</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-400">Open a campaign in Campaign results to see button replies.</p>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-800">Recent uploads</p>
                  <div className="mt-2 space-y-1">
                    {uploads.slice(0, 4).map((upload) => (
                      <p key={upload.id} className="text-xs text-slate-600">{upload.label} · {upload.added}</p>
                    ))}
                    {!uploads.length ? <p className="text-xs text-slate-400">No uploads yet.</p> : null}
                  </div>
                </div>
              </section>
            </div>
            <aside className="space-y-3">
              <section className="rounded-2xl bg-[#0b3f91] p-4 text-white shadow-sm">
                <p className="text-xs uppercase tracking-wide text-blue-100">Connected number</p>
                <p className="mt-1 text-lg font-semibold">+91 95949 96161</p>
                <p className="mt-2 text-sm text-blue-100">{segments.length} segments · {customFields.length} fields · {templates.filter(hasReplyButtons).length} button templates</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">Quick links</p>
                <div className="mt-3 space-y-2">
                  {([
                    ['contacts', 'Contacts', 'Upload numbers and extra columns'],
                    ['fields', 'Fields', 'Columns from the CSV'],
                    ['segments', 'Segments', 'Groups for a campaign'],
                    ['templates', 'Templates', 'Button templates only'],
                    ['campaign', 'Campaigns', 'Test send, then launch'],
                    ['results', 'Results', 'Sent, read, replies, charts'],
                  ] as Array<[Tab, string, string]>).map(([id, label, hint]) => (
                    <button key={id} type="button" onClick={() => setTab(id)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:border-[#004AAD]/30">
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{label}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                      <span className="text-xs font-semibold text-[#004AAD]">Open</span>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        {tab === 'contacts' ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex min-w-[220px] cursor-pointer flex-col justify-center rounded-xl border border-dashed border-[#004AAD]/40 bg-[#f8fbff] px-4 py-3">
                  <span className="text-sm font-semibold text-[#004AAD]">{fileName || 'Choose CSV or TXT'}</span>
                  <span className="text-xs text-slate-500">{parsedCount ? `${parsedCount.toLocaleString('en-IN')} rows in this file` : 'The whole file is imported. No 25,000 cap.'}</span>
                  <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(event) => onFile(event.target.files?.[0] || null)} />
                </label>
                <label className="min-w-[200px] flex-1 text-xs font-semibold text-slate-500">
                  Batch name
                  <input value={uploadLabel} onChange={(event) => setUploadLabel(event.target.value)} placeholder="MH04-COMBINED-AUG26" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-slate-900" />
                </label>
                <button type="button" disabled={busy || !paste.trim()} onClick={() => void importContacts()} className="rounded-lg bg-[#004AAD] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? (progress || 'Importing…') : 'Import this batch'}
                </button>
              </div>
              <textarea value={paste} onChange={(event) => { setPaste(event.target.value); setParsedCount(event.target.value.split(/\r?\n/).filter((line) => line.trim()).length); }} rows={2} placeholder={'Name,Phone,Car number,Address'} className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-xs text-slate-600" />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h2 className="font-semibold text-gray-900">Uploads on the same day</h2>
                <p className="mt-1 text-sm text-gray-500">Each import is its own batch. Pick one, or set the clock times above, to separate the morning 5,000 from the later upload.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setUploadId(''); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${uploadId ? 'text-gray-600' : 'border-[#004AAD] bg-[#f8fbff] text-[#004AAD]'}`}>
                    All uploads
                  </button>
                  {uploads.map((upload) => (
                    <button
                      key={upload.id}
                      type="button"
                      onClick={() => { setUploadId(upload.id); setPage(1); }}
                      className={`rounded-full border px-3 py-1.5 text-left text-sm ${uploadId === upload.id ? 'border-[#004AAD] bg-[#f8fbff] text-[#004AAD]' : 'text-gray-700'}`}
                    >
                      <span className="font-semibold">{upload.label}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {new Date(upload.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {upload.added}
                      </span>
                      <span
                        className="ml-2 text-xs font-semibold text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!window.confirm(`Delete “${upload.label}” and its ${upload.added} contacts?`)) return;
                          void post({ action: 'delete_upload', id: upload.id }).then(async () => {
                            if (uploadId === upload.id) setUploadId('');
                            await loadHome();
                            await loadContacts(1);
                          }).catch((err) => setError(err?.message || 'Could not delete upload'));
                        }}
                      >
                        Delete
                      </span>
                    </button>
                  ))}
                  {!uploads.length ? <span className="text-sm text-gray-500">No named batches yet. The next import will appear here with its time.</span> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="block text-xs font-semibold text-slate-500">
                  Search
                  <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name or number" className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Added from
                  <input type="datetime-local" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal" />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Added until
                  <input type="datetime-local" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal" />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Batch
                  <select value={uploadId} onChange={(event) => { setUploadId(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                    <option value="">All uploads</option>
                    {uploads.map((upload, index) => (
                      <option key={upload.id} value={upload.id}>{index + 1}. {upload.label} ({upload.added})</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
                <p className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{filteredTotal}</span> match this filter · {contactTotal} total</p>
                <div className="flex flex-1 gap-2 sm:justify-end">
                  <input value={segmentName} onChange={(event) => setSegmentName(event.target.value)} placeholder="Segment name for this filter" className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-xs" />
                  <button type="button" disabled={busy || !segmentName.trim() || filteredTotal === 0} onClick={() => void createSegmentFromFilter()} className="shrink-0 rounded-lg border border-[#004AAD] px-3 py-2 text-sm font-semibold text-[#004AAD] disabled:opacity-50">
                    Create segment
                  </button>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="whitespace-nowrap border-b border-slate-100 px-3 py-2">Sr</th>
                      <th className="whitespace-nowrap border-b border-slate-100 px-3 py-2">Name</th>
                      <th className="whitespace-nowrap border-b border-slate-100 px-3 py-2">Phone</th>
                      {fieldColumns.map((column) => <th key={column.key} className="whitespace-nowrap border-b border-slate-100 px-3 py-2">{column.label}</th>)}
                      <th className="whitespace-nowrap border-b border-slate-100 px-3 py-2">Added</th>
                      <th className="border-b border-slate-100 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact, index) => (
                      <tr key={contact.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap border-b border-slate-50 px-3 py-2.5 text-slate-400">{(page - 1) * 40 + index + 1}</td>
                        <td className="whitespace-nowrap border-b border-slate-50 px-3 py-2.5 font-medium text-slate-800">{contact.name || '—'}</td>
                        <td className="whitespace-nowrap border-b border-slate-50 px-3 py-2.5 font-mono text-xs text-slate-600">{contact.phone}</td>
                        {fieldColumns.map((column) => <td key={column.key} className="whitespace-nowrap border-b border-slate-50 px-3 py-2.5 text-slate-700">{contact.fields?.[column.key] || '—'}</td>)}
                        <td className="whitespace-nowrap border-b border-slate-50 px-3 py-2.5 text-xs text-slate-500">{new Date(contact.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="border-b border-slate-50 px-3 py-2.5 text-right">
                          <button type="button" className="text-xs font-semibold text-red-600" onClick={() => void post({ action: 'delete_contact', id: contact.id }).then(() => { void loadContacts(page); void loadHome(); })}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!contacts.length ? <p className="py-8 text-center text-sm text-gray-500">No contacts in this filter. Upload a CSV above.</p> : null}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
                <span className="text-gray-500">Page {page} of {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900">Segment from admin leads</h2>
            <p className="mt-1 text-sm text-gray-500">Use the leads already in the admin panel. Filter them, then save that set as a WhatsApp segment.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="text-xs font-semibold text-gray-500">From
                <input type="datetime-local" value={leadFrom} onChange={(event) => setLeadFrom(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-500">Until
                <input type="datetime-local" value={leadTo} onChange={(event) => setLeadTo(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-500">Job status
                <select value={leadStatus} onChange={(event) => setLeadStatus(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                  <option value="ALL">All</option>
                  {['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].map((status) => (
                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-500">CRM status
                <select value={leadCrm} onChange={(event) => setLeadCrm(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                  <option value="ALL">All</option>
                  {['FRESH', 'INTERESTED', 'WILL_VISIT', 'CALLBACK', 'BOOKING_CONFIRMED', 'IN_SERVICE', 'SERVICE_DONE', 'LOST', 'RINGING'].map((status) => (
                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-500">City
                <input value={leadCity} onChange={(event) => setLeadCity(event.target.value)} placeholder="Delhi" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-500">Source
                <input value={leadSource} onChange={(event) => setLeadSource(event.target.value)} placeholder="WhatsApp" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)} placeholder="Search name, phone, or lead number" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const search = new URLSearchParams({ section: 'leads', status: leadStatus, crm: leadCrm, city: leadCity, source: leadSource, q: leadQuery });
                  if (leadFrom) search.set('from', leadFrom);
                  if (leadTo) search.set('to', leadTo);
                  setBusy(true);
                  fetch(`/api/super_admin/whatsapp-bulk?${search.toString()}`)
                    .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
                    .then(({ ok, json }) => {
                      if (!ok) throw new Error(json.error || 'Could not count leads');
                      setLeadTotal(json.total || 0);
                    })
                    .catch((err) => setError(err?.message || 'Could not count leads'))
                    .finally(() => setBusy(false));
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Count matches
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-sm text-gray-600">{leadTotal === null ? 'Count the filter before saving.' : `${leadTotal} unique mobiles match.`}</p>
              <input value={leadName} onChange={(event) => setLeadName(event.target.value)} placeholder="Segment name" className="rounded-lg border px-3 py-2 text-sm sm:ml-auto sm:w-64" />
              <button
                type="button"
                disabled={busy || !leadName.trim()}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  post({
                    action: 'segment_from_leads',
                    name: leadName,
                    from: leadFrom,
                    to: leadTo,
                    status: leadStatus,
                    crm: leadCrm,
                    city: leadCity,
                    source: leadSource,
                    q: leadQuery,
                  })
                    .then(async (result) => {
                      setNotice(`Segment “${result.segment.name}” created from ${result.contact_count} leads.`);
                      setLeadName('');
                      await loadHome();
                      setTab('segments');
                    })
                    .catch((err) => setError(err?.message || 'Could not create segment'))
                    .finally(() => setBusy(false));
                }}
                className="rounded-lg bg-[#004AAD] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create segment from leads
              </button>
            </div>
          </section>
          </div>
        ) : null}

        {tab === 'fields' ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-950">Custom fields</h2>
                <p className="text-sm text-gray-500">Columns in the first upload are created here. Add more by hand.</p>
              </div>
              <button type="button" onClick={() => setFieldOpen(true)} className="rounded-lg bg-[#004AAD] px-4 py-2 text-sm font-semibold text-white">Add custom field</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Type</th>
                    <th className="py-3">Title</th>
                    <th className="py-3">Field ID</th>
                    <th className="py-3">Created on</th>
                    <th className="py-3">Description</th>
                    <th className="py-3 pr-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customFields.map((field) => (
                    <tr key={field.id} className="border-t border-slate-100">
                      <td className="px-5 py-3"><span className="rounded bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700">{field.field_type}</span></td>
                      <td className="py-3 font-medium text-gray-900">{field.title}</td>
                      <td className="py-3 font-mono text-xs text-gray-600">{field.field_key}</td>
                      <td className="py-3 text-gray-600">{new Date(field.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="py-3 text-gray-600">{field.description || '—'}</td>
                      <td className="py-3 pr-5 text-right">
                        <button type="button" className="text-xs font-semibold text-red-600" onClick={() => void post({ action: 'delete_field', id: field.id }).then(loadHome).catch((err) => setError(err?.message || 'Could not delete field'))}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!customFields.length ? <p className="px-5 py-10 text-center text-sm text-gray-500">No fields yet. Upload a CSV with extra columns, or add one.</p> : null}
            </div>
          </section>
        ) : null}

        {tab === 'segments' ? (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <input
                value={segmentQuery}
                onChange={(event) => setSegmentQuery(event.target.value)}
                placeholder="Search Segments With Title ..."
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
              />
              <div className="flex gap-2 sm:ml-auto">
                <button type="button" onClick={() => void loadHome()} className="rounded-md bg-[#2f6bff] px-3 py-2 text-sm font-semibold text-white">Refresh</button>
                <button type="button" onClick={() => setSegmentEditor({ id: '', name: '', description: '', condition_count: 1 })} className="rounded-md bg-[#2f6bff] px-3 py-2 text-sm font-semibold text-white">+ Add New Segment</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Title</th>
                    <th className="py-3 text-center font-semibold">Conditions</th>
                    <th className="py-3 text-right font-semibold">Contacts</th>
                    <th className="px-6 py-3 font-semibold">Created on</th>
                    <th className="py-3 font-semibold">Description</th>
                    <th className="py-3 pr-5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.filter((segment) => segment.name.toLowerCase().includes(segmentQuery.trim().toLowerCase())).map((segment, index) => {
                    const when = new Date(segment.created_at);
                    return (
                      <tr key={segment.id} className={index % 2 ? 'bg-[#f7f9fc]' : 'bg-white'}>
                        <td className="px-5 py-4 text-slate-700">{segment.name}</td>
                        <td className="py-4 text-center">
                          <span className="inline-flex min-w-6 items-center justify-center rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{segment.condition_count ?? 1}</span>
                        </td>
                        <td className="py-4 text-right font-medium text-rose-500">{(segment.contact_count || 0).toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-slate-500">
                          <span className="block">{when.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span className="block text-xs">{when.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="py-4 text-slate-500">{segment.description || segment.name}</td>
                        <td className="py-4 pr-5 text-right">
                          <button type="button" aria-label="Edit segment" className="mr-2 text-[#2f6bff]" onClick={() => setSegmentEditor({ id: segment.id, name: segment.name, description: segment.description || segment.name, condition_count: segment.condition_count ?? 1 })}>
                            <svg viewBox="0 0 24 24" className="inline h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          </button>
                          <button type="button" aria-label="Delete segment" className="text-rose-400" onClick={() => void post({ action: 'delete_segment', id: segment.id }).then(loadHome)}>
                            <svg viewBox="0 0 24 24" className="inline h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!segments.length ? <p className="px-5 py-10 text-center text-sm text-slate-400">No segments yet. Add one, or save a contact filter as a segment.</p> : null}
            </div>
          </section>
        ) : null}

        {tab === 'templates' ? (
          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Search with template name" className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm" />
              <Link href="/dashboard/super_admin/whatsapp-templates" className="text-sm font-semibold text-[#004AAD]">Template studio</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Sr</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Name</th>
                    <th className="py-3">Variable format</th>
                    <th className="py-3">Category</th>
                    <th className="py-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTemplates.map((template, index) => {
                    const status = statusOf(template);
                    return (
                      <tr
                        key={`${template.template_name}-${template.language_code}`}
                        className="cursor-pointer border-t hover:bg-slate-50"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                        <td className="py-3">
                          <span className={`rounded px-2 py-1 text-[11px] font-bold ${statusTone(status)}`}>{status}</span>
                        </td>
                        <td className="py-3 font-medium text-gray-900">{template.display_name || template.template_name}</td>
                        <td className="py-3 text-gray-600">{variableFormat(template)}</td>
                        <td className="py-3">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${String(template.category || '').toUpperCase() === 'MARKETING' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                            {String(template.category || 'UTILITY').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <button type="button" className="rounded-lg border px-2 py-1 text-xs font-semibold text-gray-700" onClick={(event) => { event.stopPropagation(); setPreviewTemplate(template); }}>
                            Preview
                          </button>
                          <button
                            type="button"
                            disabled={status !== 'APPROVED'}
                            className="ml-2 rounded-lg border border-[#004AAD] px-2 py-1 text-xs font-semibold text-[#004AAD] disabled:opacity-40"
                            onClick={(event) => { event.stopPropagation(); setTemplateName(template.template_name); setCampaignReady(false); setTab('campaign'); }}
                          >
                            Use
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visibleTemplates.length ? <p className="px-4 py-8 text-center text-sm text-gray-500">No button templates yet. Bulk send uses only templates that have reply buttons.</p> : null}
          </section>
        ) : null}

        {tab === 'campaign' ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create campaign</h2>
                <p className="text-sm text-gray-500">Save the campaign first. Launch shows up underneath after it is saved.</p>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                Campaign name
                <input value={campaignName} onChange={(event) => { setCampaignName(event.target.value); setCampaignReady(false); }} placeholder="12 Nov interested blast" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Segment
                <select value={sendSegment} onChange={(event) => { setSendSegment(event.target.value); setCampaignReady(false); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                  <option value="">Choose a segment</option>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>{segment.name} · {segment.contact_count}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Template
                <select value={templateName} onChange={(event) => { setTemplateName(event.target.value); setCampaignReady(false); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                  <option value="">Choose an approved template</option>
                  {templates.filter(hasReplyButtons).map((template, index) => (
                    <option key={template.template_name} value={template.template_name} disabled={statusOf(template) !== 'APPROVED'}>
                      {index + 1}. {template.display_name || template.template_name} · {statusOf(template)}
                    </option>
                  ))}
                </select>
              </label>
              {needsImage ? (
                <label className="block text-xs font-semibold text-gray-500">
                  Header image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      void uploadHeader(file);
                    }}
                    className="mt-1 block w-full text-sm font-normal text-gray-900 file:mr-3 file:rounded-lg file:border-0 file:bg-[#004AAD] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <span className="mt-1 block font-normal text-gray-500">JPG, PNG, or WEBP under 5 MB. This photo goes above the message.</span>
                  {headerImageUrl ? <img src={headerImageUrl} alt="" className="mt-2 aspect-square w-full max-w-[240px] rounded-lg object-contain" /> : <span className="mt-2 block font-normal text-amber-700">Upload a photo before test send or launch.</span>}
                </label>
              ) : null}
              {slots > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Use {'{{name}}'}, {'{{car_number}}'}, {'{{address}}'}, or any extra column from the file.</p>
                  {params.map((value, index) => (
                    <input key={index} value={value} onChange={(event) => { setCampaignReady(false); setParams((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))); }} placeholder={`{{${index + 1}}}`} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  ))}
                </div>
              ) : null}
              {quickReplies.length ? (
                <div className="rounded-xl border bg-[#f8fbff] p-3">
                  <h3 className="text-sm font-semibold text-gray-900">Button → TeleCRM</h3>
                  <p className="mt-1 text-xs text-gray-500">A tap creates or updates the telecaller lead with this tag. The bot that replies after the tap is set on Bot Flow → Campaign button bot.</p>
                  <div className="mt-3 space-y-2">
                    {buttonMap.map((item, index) => (
                      <div key={item.text} className="grid gap-2 sm:grid-cols-[1fr_160px_1fr]">
                        <div className="rounded-lg border bg-white px-3 py-2 text-sm font-medium">{item.text}</div>
                        <select
                          value={item.action}
                          onChange={(event) => { setCampaignReady(false); setButtonMap((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, action: event.target.value as ButtonAction['action'] } : row)); }}
                          className="rounded-lg border bg-white px-2 py-2 text-sm"
                        >
                          <option value="create_lead">Create TeleCRM lead</option>
                          <option value="ignore">Do nothing</option>
                        </select>
                        <input
                          value={item.tag}
                          onChange={(event) => { setCampaignReady(false); setButtonMap((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, tag: event.target.value } : row)); }}
                          placeholder="Lead tag"
                          className="rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : chosen ? <p className="text-sm text-gray-500">This template has no quick-reply buttons. URL and call buttons stay as they are on WhatsApp.</p> : null}
              <div className="rounded-xl border p-3">
                <h3 className="text-sm font-semibold text-gray-900">Test send</h3>
                <p className="mt-1 text-xs text-gray-500">Send this exact template to one number before the campaign.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="Test mobile, 9876543210" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
                  <button type="button" disabled={busy || !approved || !testPhone.trim()} onClick={() => void testSend()} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40">
                    Send test
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <button type="button" disabled={busy || !sendSegment || !templateName} onClick={() => void saveCampaignDraft()} className="rounded-lg bg-[#004AAD] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy && !progress ? 'Saving…' : 'Save campaign'}
                </button>
                {campaignReady && savedCampaignId ? (
                  <div>
                    <button type="button" disabled={busy || !approved} onClick={() => void launch()} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      {progress ? 'Working…' : 'Launch campaign'}
                    </button>
                  </div>
                ) : null}
                {progress ? (
                  <button
                    type="button"
                    onClick={() => void post({ action: 'stop_campaign' }).then(() => setNotice('Stopping the send…')).catch((err) => setError(err?.message || 'Could not stop'))}
                    className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Stop sending
                  </button>
                ) : null}
              </div>
              {progress ? <p className="text-sm text-gray-600">{progress}</p> : null}
            </section>
            <aside className="space-y-4">
              {chosen ? <PhonePreview template={chosen} params={params} headerImage={headerImageUrl} /> : <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">Pick a template to see the WhatsApp preview, including buttons.</div>}
              <button type="button" onClick={() => setTab('results')} className="w-full rounded-2xl border bg-white p-4 text-left shadow-sm">
                <h3 className="font-semibold text-gray-900">Campaign results</h3>
                <p className="mt-1 text-sm text-gray-500">Open sent, delivered, read, failed, and button replies.</p>
              </button>
            </aside>
          </div>
        ) : null}

        {tab === 'results' ? (
          <div className="space-y-4">
            {!report ? (
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3">
                  <h2 className="font-semibold text-gray-900">Campaign results</h2>
                  <p className="text-sm text-gray-500">Open a campaign to see sent, delivered, read, replies, and failed numbers.</p>
                </div>
                <div className="divide-y">
                  {campaigns.map((campaign) => (
                    <button key={campaign.id} type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => void openReport(campaign.id).catch((err) => setError(err?.message || 'Could not load campaign'))}>
                      <span>
                        <span className="block font-medium text-gray-900">{campaign.name || campaign.template_name}</span>
                        <span className="block text-sm text-gray-500">{campaign.template_name} · {campaign.status}</span>
                      </span>
                      <span className="text-sm text-gray-600">sent {campaign.sent} / {campaign.total}</span>
                    </button>
                  ))}
                  {!campaigns.length ? <p className="px-4 py-6 text-sm text-gray-500">No campaigns yet. Launch one from Create campaign.</p> : null}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button type="button" className="text-sm font-semibold text-[#004AAD]" onClick={() => { setReport(null); setAudienceOpen(false); }}>All campaigns</button>
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">{report.campaign?.status || 'Campaign'}</p>
                      <h2 className="text-lg font-semibold text-gray-900">{report.campaign?.name || report.campaign?.template_name}</h2>
                      <button type="button" className="mt-1 text-sm font-semibold text-[#004AAD]" onClick={() => void openAudience('all').catch((err) => setError(err?.message || 'Could not load audience'))}>
                        Template: {report.campaign?.template_name}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">Audience {report.audience}{report.sample ? ' · sample, no messages sent' : ''}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                    {[
                      ['all', 'All', report.audience, 100, 'border-t-slate-400'],
                      ['sent', 'Sent', report.sent, report.rates?.sent, 'border-t-blue-500'],
                      ['delivered', 'Delivered', report.delivered, report.rates?.delivered, 'border-t-cyan-500'],
                      ['read', 'Read', report.read, report.rates?.read, 'border-t-emerald-500'],
                      ['replied', 'Replied', report.replied, report.rates?.replied, 'border-t-indigo-500'],
                      ['auto', 'Auto replied', report.auto || 0, report.rates?.auto || 0, 'border-t-violet-500'],
                      ['failed', 'Failed', report.failed, report.rates?.failed, 'border-t-amber-500'],
                    ].map(([view, label, value, rate, accent]) => (
                      <button key={String(view)} type="button" onClick={() => void openAudience(String(view)).catch((err) => setError(err?.message || 'Could not load audience'))} className={`rounded-2xl border border-t-4 px-3 py-3 text-left shadow-sm ${accent} ${audienceOpen && audienceView === view ? 'border-[#004AAD] bg-[#f8fbff]' : 'border-slate-200 bg-white'}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                        <p className="mt-1 text-lg font-semibold tracking-tight text-gray-950">{Number(value).toLocaleString('en-IN')}</p>
                        <p className="text-xs font-medium text-[#004AAD]">{rate}%</p>
                      </button>
                    ))}
                  </div>
                </div>
                <ResultCharts report={report} />
                {audienceOpen ? (
                  <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{report.campaign?.template_name}</h3>
                        <p className="text-sm text-gray-500">{audienceTotal.toLocaleString('en-IN')} in this view{report.sample ? ' · sample rows, counts are for all 10,000' : ''}</p>
                      </div>
                      <button type="button" className="text-sm text-gray-500" onClick={() => setAudienceOpen(false)}>Close</button>
                    </div>
                    {report.replies?.length && audienceView === 'replied' ? (
                      <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-3">
                        {report.replies.map((row: { button: string; count: number; percent: number }) => (
                          <div key={row.button} className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-sm font-medium text-gray-900">{row.button}</p>
                            <p className="text-xs text-gray-500">{row.count} · {row.percent}%</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-[11px] uppercase text-gray-500">
                          <tr>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">WhatsApp number</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Sent</th>
                            <th className="px-4 py-2">Reply</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audience.map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="px-4 py-2">{row.name || '—'}</td>
                              <td className="px-4 py-2">{row.phone}</td>
                              <td className="px-4 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.reply_kind === 'auto' ? 'bg-violet-100 text-violet-800' : row.reply_button ? 'bg-indigo-100 text-indigo-800' : row.delivery_status === 'FAILED' || row.status === 'failed' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                                  {row.reply_kind === 'auto' ? 'AUTO REPLIED' : row.reply_button ? 'REPLIED' : row.delivery_status || row.status}
                                </span>
                              </td>
                              <td className="px-4 py-2">{row.sent_at ? new Date(row.sent_at).toLocaleString('en-IN') : '—'}</td>
                              <td className="px-4 py-2">{row.reply_button || '—'}</td>
                            </tr>
                          ))}
                          {!audience.length ? <tr><td className="px-4 py-6 text-gray-500" colSpan={5}>No rows in this view.</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
      {segmentEditor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setSegmentEditor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-950">{segmentEditor.id ? 'Edit segment' : 'Add new segment'}</h3>
            <label className="mt-4 block text-xs font-semibold text-gray-500">Title
              <input value={segmentEditor.name} onChange={(event) => setSegmentEditor({ ...segmentEditor, name: event.target.value })} placeholder="MH-04 combined" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
            </label>
            <label className="mt-3 block text-xs font-semibold text-gray-500">Description
              <input value={segmentEditor.description} onChange={(event) => setSegmentEditor({ ...segmentEditor, description: event.target.value })} placeholder="Delhi batch" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setSegmentEditor(null)}>Cancel</button>
              <button
                type="button"
                disabled={!segmentEditor.name.trim()}
                className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => {
                  void post({
                    action: 'save_segment',
                    id: segmentEditor.id,
                    name: segmentEditor.name,
                    description: segmentEditor.description,
                    condition_count: segmentEditor.condition_count,
                  }).then(async () => {
                    setSegmentEditor(null);
                    await loadHome();
                  }).catch((err) => setError(err?.message || 'Could not save segment'));
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {fieldOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setFieldOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-950">Add custom field</h3>
            <label className="mt-4 block text-xs font-semibold text-gray-500">Title
              <input value={fieldTitle} onChange={(event) => setFieldTitle(event.target.value)} placeholder="Car number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
            </label>
            <label className="mt-3 block text-xs font-semibold text-gray-500">Description
              <input value={fieldDescription} onChange={(event) => setFieldDescription(event.target.value)} placeholder="Vehicle registration" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
            </label>
            <label className="mt-3 block text-xs font-semibold text-gray-500">Field type
              <select value={fieldType} onChange={(event) => setFieldType(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                <option value="STRING">String</option>
                <option value="NUMBER">Number</option>
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setFieldOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={!fieldTitle.trim()}
                className="rounded-lg bg-[#004AAD] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => {
                  void post({ action: 'save_field', title: fieldTitle, description: fieldDescription, field_type: fieldType })
                    .then(async () => {
                      setFieldOpen(false);
                      setFieldTitle('');
                      setFieldDescription('');
                      setFieldType('STRING');
                      await loadHome();
                    })
                    .catch((err) => setError(err?.message || 'Could not save field'));
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewTemplate ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {statusOf(previewTemplate)} · {String(previewTemplate.category || 'UTILITY').toUpperCase()} · {languageLabel(previewTemplate.language_code)} · {variableFormat(previewTemplate)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">{previewTemplate.display_name || previewTemplate.template_name}</h3>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100" onClick={() => setPreviewTemplate(null)}>
                Close
              </button>
            </div>
            <PhonePreview template={previewTemplate} params={previewTemplate.example_values || []} />
            <button
              type="button"
              disabled={statusOf(previewTemplate) !== 'APPROVED'}
              onClick={() => { setTemplateName(previewTemplate.template_name); setCampaignReady(false); setPreviewTemplate(null); setTab('campaign'); }}
              className="mt-4 w-full rounded-lg bg-[#004AAD] py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Use in campaign
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
