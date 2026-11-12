'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Contact = { id: string; phone: string; name: string | null; created_at: string; upload_id?: string | null; fields?: Record<string, string> | null };
type Segment = { id: string; name: string; created_at: string; contact_count: number };
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
  meta?: { status?: string; raw?: { parameter_format?: string; components?: Array<{ type?: string; text?: string; buttons?: WaButton[] }> } } | null;
};
type ButtonAction = { text: string; action: 'create_lead' | 'ignore'; tag: string };
type Tab = 'contacts' | 'segments' | 'templates' | 'campaign';

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

function partsOf(template: Template | null) {
  const components = template?.meta?.raw?.components || [];
  const header = components.find((item) => String(item.type || '').toUpperCase() === 'HEADER');
  const footer = components.find((item) => String(item.type || '').toUpperCase() === 'FOOTER');
  const buttons = components.find((item) => String(item.type || '').toUpperCase() === 'BUTTONS');
  return {
    header: String(header?.text || ''),
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

function PhonePreview({
  template,
  params,
}: {
  template: Template;
  params: string[];
}) {
  const parts = partsOf(template);
  const body = fillBody(template.body_text || '', params);
  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.6rem] border-[8px] border-[#111b21] bg-[#efeae2] shadow-lg">
      <div className="bg-[#075e54] px-3 py-2 text-white">
        <p className="text-[11px] text-white/70">My FNG Autocare</p>
        <p className="text-sm font-semibold">+91 95949 96161</p>
      </div>
      <div className="min-h-[220px] px-3 py-3">
        <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
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
  const [tab, setTab] = useState<Tab>('contacts');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
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

  const [report, setReport] = useState<any>(null);
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
  const [sendSegment, setSendSegment] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [buttonMap, setButtonMap] = useState<ButtonAction[]>([]);
  const [testPhone, setTestPhone] = useState('');
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

  const fieldKeys = useMemo(() => {
    const keys = new Set<string>();
    contacts.forEach((contact) => Object.keys(contact.fields || {}).forEach((key) => keys.add(key)));
    return Array.from(keys).slice(0, 4);
  }, [contacts]);

  const visibleTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (!q) return true;
      return `${template.display_name || ''} ${template.template_name} ${template.body_text || ''}`.toLowerCase().includes(q);
    });
  }, [templateQuery, templates]);

  async function openReport(id: string) {
    const response = await fetch(`/api/super_admin/whatsapp-bulk?section=campaign&id=${encodeURIComponent(id)}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Could not load campaign');
    setReport(json.report);
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
      const result = await post({ action: 'add_contacts', text: paste, upload_label: uploadLabel });
      setNotice(
        result.fields_saved === false
          ? `${result.added} numbers saved in “${result.upload_label}”. Car number and address were not stored yet. Run database/391_whatsapp_bulk_fields_and_button_flows.sql, then upload again.`
          : `${result.added} numbers saved in “${result.upload_label}”.`,
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

  async function testSend() {
    setBusy(true);
    setError('');
    try {
      await post({ action: 'test_send', phone: testPhone, template_name: templateName, params, name: 'Test' });
      setNotice(`Test sent to ${testPhone}.`);
    } catch (err: any) {
      setError(err?.message || 'Test failed');
    } finally {
      setBusy(false);
    }
  }

  async function launch(existingId?: string) {
    setBusy(true);
    setError('');
    setProgress('Preparing campaign…');
    try {
      let campaignId = existingId || '';
      if (!campaignId) {
        const started = await post({
          action: 'send_start',
          name: campaignName || undefined,
          segment_id: sendSegment,
          template_name: templateName,
          params,
          button_map: buttonMap,
        });
        campaignId = started.campaign.id;
        if (!started.pending) {
          setNotice('Nothing to send. This segment is on DND.');
          await loadHome();
          return;
        }
      }
      let guard = 0;
      while (guard < 500) {
        guard += 1;
        const batch = await post({ action: 'send_batch', campaign_id: campaignId });
        setProgress(`Sent ${batch.sent} · failed ${batch.failed} · left ${batch.pending}`);
        if (batch.rate_limited) {
          setNotice('WhatsApp slowed the send. Use Continue in a minute.');
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
      setBusy(false);
      setProgress('');
    }
  }

  const approved = chosen ? statusOf(chosen) === 'APPROVED' : false;
  const pages = Math.max(1, Math.ceil(filteredTotal / 40));

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#004AAD]">WhatsApp · +91 95949 96161</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Bulk campaigns</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Upload a batch, filter it into a segment, preview the template, send a test, then map reply buttons into TeleCRM leads.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Contacts', contactTotal],
              ['Segments', segments.length],
              ['Templates', templates.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border bg-[#f8fbff] px-4 py-2">
                <p className="text-lg font-bold text-gray-900">{loading ? '–' : value}</p>
                <p className="text-[11px] font-medium uppercase text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {([
            ['contacts', 'Contacts'],
            ['segments', 'Segments'],
            ['templates', 'Templates'],
            ['campaign', 'Create campaign'],
          ] as Array<[Tab, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === id ? 'border-[#004AAD] text-[#004AAD]' : 'border-transparent text-gray-500'}`}
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

        {tab === 'contacts' ? (
          <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">Upload contacts</h2>
              <p className="mt-1 text-sm text-gray-500">CSV or one number per line. Extra columns such as car number and address are saved and can be used as {'{{car_number}}'} and {'{{address}}'}.</p>
              <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#004AAD]/40 bg-[#f8fbff] px-4 py-8 text-center">
                <span className="text-sm font-semibold text-[#004AAD]">{fileName || 'Choose CSV or TXT'}</span>
                <span className="mt-1 text-xs text-gray-500">{parsedCount ? `${parsedCount} lines read` : 'Up to 25,000 numbers'}</span>
                <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(event) => onFile(event.target.files?.[0] || null)} />
              </label>
              <input value={uploadLabel} onChange={(event) => setUploadLabel(event.target.value)} placeholder="Batch name, e.g. 12 Nov Delhi" className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
              <textarea value={paste} onChange={(event) => { setPaste(event.target.value); setParsedCount(event.target.value.split(/\r?\n/).filter((line) => line.trim()).length); }} rows={8} placeholder={'Name,Phone,Car number,Address\nRahul,9876543210,DL01AB1234,Saket'} className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-xs" />
              <button type="button" disabled={busy || !paste.trim()} onClick={() => void importContacts()} className="mt-3 w-full rounded-lg bg-[#004AAD] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Importing…' : 'Import this batch'}
              </button>
            </section>

            <section className="rounded-2xl border bg-white p-4 shadow-sm">
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
                    </button>
                  ))}
                  {!uploads.length ? <span className="text-sm text-gray-500">No named batches yet. The next import will appear here with its time.</span> : null}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-end">
                <label className="flex-1 text-xs font-semibold text-gray-500">
                  Search
                  <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name or number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
                </label>
                <label className="text-xs font-semibold text-gray-500">
                  Added from
                  <input type="datetime-local" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-1 rounded-lg border px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-gray-500">
                  Added until
                  <input type="datetime-local" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-1 rounded-lg border px-3 py-2 text-sm font-normal" />
                </label>
                <label className="min-w-[180px] text-xs font-semibold text-gray-500">
                  Batch
                  <select value={uploadId} onChange={(event) => { setUploadId(event.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                    <option value="">All uploads</option>
                    {uploads.map((upload) => (
                      <option key={upload.id} value={upload.id}>{upload.label} ({upload.added})</option>
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
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                  <th className="py-2">Name</th>
                  <th>Phone</th>
                  {fieldKeys.map((key) => <th key={key}>{key}</th>)}
                  <th>Added</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-t">
                        <td className="py-2 font-medium text-gray-900">{contact.name || '—'}</td>
                        <td className="font-mono text-xs text-gray-700">{contact.phone}</td>
                        {fieldKeys.map((key) => <td key={key} className="text-xs text-gray-700">{contact.fields?.[key] || '—'}</td>)}
                        <td className="text-gray-500">{new Date(contact.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="text-right">
                          <button type="button" className="text-xs font-semibold text-red-600" onClick={() => void post({ action: 'delete_contact', id: contact.id }).then(() => { void loadContacts(page); void loadHome(); })}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!contacts.length ? <p className="py-8 text-center text-sm text-gray-500">No contacts in this filter. Upload a CSV on the left.</p> : null}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
                <span className="text-gray-500">Page {page} of {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </section>
          </div>

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

        {tab === 'segments' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {segments.map((segment) => (
              <article key={segment.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900">{segment.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{segment.contact_count} contacts · {new Date(segment.created_at).toLocaleDateString('en-IN')}</p>
                <div className="mt-4 flex gap-3 text-sm font-semibold">
                  <button type="button" className="text-[#004AAD]" onClick={() => { setSendSegment(segment.id); setTab('campaign'); }}>Use in campaign</button>
                  <button type="button" className="text-red-600" onClick={() => void post({ action: 'delete_segment', id: segment.id }).then(loadHome)}>Delete</button>
                </div>
              </article>
            ))}
            {!segments.length ? <p className="text-sm text-gray-500">Filter contacts and create a segment from that set.</p> : null}
          </div>
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
                    <th className="px-4 py-3">Status</th>
                    <th className="py-3">Name</th>
                    <th className="py-3">Variable format</th>
                    <th className="py-3">Category</th>
                    <th className="py-3">Language</th>
                    <th className="py-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTemplates.map((template) => {
                    const status = statusOf(template);
                    return (
                      <tr
                        key={`${template.template_name}-${template.language_code}`}
                        className="cursor-pointer border-t hover:bg-slate-50"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-1 text-[11px] font-bold ${statusTone(status)}`}>{status}</span>
                        </td>
                        <td className="py-3 font-medium text-gray-900">{template.display_name || template.template_name}</td>
                        <td className="py-3 text-gray-600">{variableFormat(template)}</td>
                        <td className="py-3 text-gray-600">{String(template.category || 'UTILITY').toUpperCase()}</td>
                        <td className="py-3 text-gray-600">{languageLabel(template.language_code)}</td>
                        <td className="py-3 pr-4 text-right">
                          <button type="button" className="rounded-lg border px-2 py-1 text-xs font-semibold text-gray-700" onClick={(event) => { event.stopPropagation(); setPreviewTemplate(template); }}>
                            Preview
                          </button>
                          <button
                            type="button"
                            disabled={status !== 'APPROVED'}
                            className="ml-2 rounded-lg border border-[#004AAD] px-2 py-1 text-xs font-semibold text-[#004AAD] disabled:opacity-40"
                            onClick={(event) => { event.stopPropagation(); setTemplateName(template.template_name); setTab('campaign'); }}
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
            {!visibleTemplates.length ? <p className="px-4 py-8 text-center text-sm text-gray-500">No templates yet. Sync them from the template studio.</p> : null}
          </section>
        ) : null}

        {tab === 'campaign' ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create campaign</h2>
                <p className="text-sm text-gray-500">Segment, template, test number, then the real send.</p>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                Campaign name
                <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="12 Nov interested blast" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Segment
                <select value={sendSegment} onChange={(event) => setSendSegment(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                  <option value="">Choose a segment</option>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>{segment.name} · {segment.contact_count}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Template
                <select value={templateName} onChange={(event) => setTemplateName(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-900">
                  <option value="">Choose an approved template</option>
                  {templates.map((template) => (
                    <option key={template.template_name} value={template.template_name} disabled={statusOf(template) !== 'APPROVED'}>
                      {template.display_name || template.template_name} · {statusOf(template)}
                    </option>
                  ))}
                </select>
              </label>
              {slots > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Use {'{{name}}'}, {'{{car_number}}'}, {'{{address}}'}, or any extra column from the file.</p>
                  {params.map((value, index) => (
                    <input key={index} value={value} onChange={(event) => setParams((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} placeholder={`{{${index + 1}}}`} className="w-full rounded-lg border px-3 py-2 text-sm" />
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
                          onChange={(event) => setButtonMap((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, action: event.target.value as ButtonAction['action'] } : row))}
                          className="rounded-lg border bg-white px-2 py-2 text-sm"
                        >
                          <option value="create_lead">Create TeleCRM lead</option>
                          <option value="ignore">Do nothing</option>
                        </select>
                        <input
                          value={item.tag}
                          onChange={(event) => setButtonMap((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, tag: event.target.value } : row))}
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
              <button type="button" disabled={busy || !sendSegment || !approved} onClick={() => void launch()} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Working…' : 'Launch campaign'}
              </button>
              {progress ? <p className="text-sm text-gray-600">{progress}</p> : null}
            </section>
            <aside className="space-y-4">
              {chosen ? <PhonePreview template={chosen} params={params} /> : <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">Pick a template to see the WhatsApp preview, including buttons.</div>}
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900">Campaign results</h3>
                <div className="mt-2 divide-y">
                  {campaigns.map((campaign) => (
                    <button key={campaign.id} type="button" className="block w-full py-3 text-left text-sm" onClick={() => void openReport(campaign.id).catch((err) => setError(err?.message || 'Could not load campaign'))}>
                      <p className="font-medium text-gray-900">{campaign.name || campaign.template_name}</p>
                      <p className="text-gray-500">{campaign.status} · sent {campaign.sent} · failed {campaign.failed} · skipped {campaign.skipped} / {campaign.total}</p>
                      {campaign.status !== 'completed' ? (
                        <span className="mt-1 inline-block text-sm font-semibold text-[#004AAD]" onClick={(event) => { event.stopPropagation(); void launch(campaign.id); }}>Continue</span>
                      ) : null}
                    </button>
                  ))}
                  {!campaigns.length ? <p className="py-3 text-sm text-gray-500">No campaigns yet.</p> : null}
                </div>
                {report ? (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-sm font-semibold text-gray-900">{report.campaign?.name || report.campaign?.template_name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[
                        ['Sent', report.sent, report.rates?.sent],
                        ['Delivered', report.delivered, report.rates?.delivered],
                        ['Read', report.read, report.rates?.read],
                        ['Replied', report.replied, report.rates?.replied],
                        ['Failed', report.failed, report.rates?.failed],
                        ['Skipped', report.skipped, report.rates?.skipped],
                      ].map(([label, value, rate]) => (
                        <div key={String(label)} className="rounded-lg bg-[#f8fbff] px-2 py-2">
                          <p className="text-[11px] uppercase text-gray-500">{label}</p>
                          <p className="text-lg font-bold text-gray-900">{value}</p>
                          <p className="text-xs text-[#004AAD]">{rate}% of {report.audience}</p>
                        </div>
                      ))}
                    </div>
                    {report.replies?.length ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold uppercase text-gray-500">Replies by button</p>
                        {report.replies.map((row: { button: string; count: number; percent: number }) => (
                          <div key={row.button} className="flex items-center justify-between text-sm">
                            <span>{row.button}</span>
                            <span className="font-semibold">{row.count} · {row.percent}%</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-3 text-xs text-gray-500">No button replies yet. Delivered and read update as WhatsApp reports them.</p>}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
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
              onClick={() => { setTemplateName(previewTemplate.template_name); setPreviewTemplate(null); setTab('campaign'); }}
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
