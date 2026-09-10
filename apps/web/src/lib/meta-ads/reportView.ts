export const META_DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7d', label: 'Last 7 days' },
  { id: 'last_14d', label: 'Last 14 days' },
  { id: 'last_28d', label: 'Last 28 days' },
  { id: 'last_30d', label: 'Last 30 days' },
  { id: 'this_week_mon_today', label: 'This week' },
  { id: 'last_week_mon_sun', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'maximum', label: 'Maximum' },
] as const;

export type ReportMetric = {
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  leads?: number;
  messaging?: number;
  results?: number;
  cpr?: number;
  cpl?: number;
  date_start?: string | null;
  date_stop?: string | null;
};

export type ReportSheetCol = { key: string; label: string };
export type ReportSheet = { name: string; columns: ReportSheetCol[]; rows: Record<string, unknown>[] };

const MONEY_KEYS = new Set(['spend', 'cpr', 'cpl', 'cpc', 'cpm']);
const PCT_KEYS = new Set(['ctr']);

export function money(n: unknown, currency = 'INR') {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
}

export function num(n: unknown) {
  return Math.round(Number(n) || 0).toLocaleString('en-IN');
}

export function pct(n: unknown) {
  return `${Number(n || 0).toFixed(2)}%`;
}

export function metricCols(prefix: ReportSheetCol[] = []): ReportSheetCol[] {
  return [
    ...prefix,
    { key: 'spend', label: 'Spend' },
    { key: 'results', label: 'Results' },
    { key: 'leads', label: 'Leads' },
    { key: 'messaging', label: 'WA chats' },
    { key: 'cpr', label: 'CPR' },
    { key: 'cpl', label: 'CPL' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'impressions', label: 'Impressions' },
    { key: 'ctr', label: 'CTR %' },
    { key: 'cpc', label: 'CPC' },
    { key: 'cpm', label: 'CPM' },
    { key: 'reach', label: 'Reach' },
  ];
}

function pickMetrics(row: ReportMetric | null | undefined) {
  const results = Number(row?.results || 0) || Number(row?.leads || 0) + Number(row?.messaging || 0);
  return {
    spend: Number(row?.spend || 0),
    results,
    leads: Number(row?.leads || 0),
    messaging: Number(row?.messaging || 0),
    cpr: Number(row?.cpr || row?.cpl || 0),
    cpl: Number(row?.cpl || 0),
    clicks: Number(row?.clicks || 0),
    impressions: Number(row?.impressions || 0),
    ctr: Number(row?.ctr || 0),
    cpc: Number(row?.cpc || 0),
    cpm: Number(row?.cpm || 0),
    reach: Number(row?.reach || 0),
  };
}

export function flattenReportSheets(report: any): ReportSheet[] {
  const currency = report?.account?.currency || 'INR';
  const summarySrc: any[] = Array.isArray(report?.summary) && report.summary.length
    ? report.summary
    : Object.entries(report?.periods || {}).map(([period, row]) => ({ period, ...(row as object) }));
  const campaigns: any[] = Array.isArray(report?.campaigns) ? report.campaigns : [];
  const adsets: any[] = Array.isArray(report?.adsets) ? report.adsets : [];
  const ads: any[] = Array.isArray(report?.ads) ? report.ads : [];
  const placements: any[] = Array.isArray(report?.placements) ? report.placements : [];
  const platforms: any[] = Array.isArray(report?.platforms) ? report.platforms : [];
  const ages: any[] = Array.isArray(report?.ages) ? report.ages : [];
  const genders: any[] = Array.isArray(report?.genders) ? report.genders : [];
  const demographics: any[] = Array.isArray(report?.demographics) ? report.demographics : [];
  const countries: any[] = Array.isArray(report?.countries) ? report.countries : [];
  const devices: any[] = Array.isArray(report?.devices) ? report.devices : [];
  const hours: any[] = Array.isArray(report?.hours) ? report.hours : [];
  const devicePlatforms: any[] = Array.isArray(report?.device_platforms) ? report.device_platforms : [];
  const funds = report?.funds;

  const summaryRows = summarySrc.map((row) => ({
    period: row.period || row.label || '',
    ...pickMetrics(row),
  }));

  const campaignRows = campaigns.map((c) => {
    const m = c.metrics || c.last_7d || c.last_30d || {};
    return {
      id: c.id,
      campaign_id: c.id,
      name: c.name,
      status: statusLabel(c.effective_status || c.status),
      objective: c.objective || '',
      ...pickMetrics(m),
    };
  });

  const adsetRows = adsets.map((row) => {
    const m = row.metrics || row;
    return {
      id: row.id,
      campaign_id: row.campaign_id || '',
      campaign: row.campaign_name || '',
      name: row.name || row.adset_name || '',
      status: statusLabel(row.effective_status || row.status),
      ...pickMetrics(m),
    };
  });

  const adRows = ads.map((row) => {
    const m = row.metrics || row;
    return {
      id: row.id,
      campaign_id: row.campaign_id || '',
      campaign: row.campaign_name || '',
      adset: row.adset_name || '',
      adset_id: row.adset_id || '',
      name: row.name || row.ad_name || '',
      status: statusLabel(row.effective_status || row.status),
      ...pickMetrics(m),
    };
  });

  const placementRows = placements.map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    platform: prettyPlatform(row.publisher_platform || row.platform),
    position: prettyPosition(row.platform_position || row.position),
    ...pickMetrics(row),
  }));

  const platformRows = platforms.map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    platform: prettyPlatform(row.publisher_platform || row.platform),
    ...pickMetrics(row),
  }));

  const ageRows = (ages.length ? ages : demographics.filter((row) => row.age)).map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    age: row.age || '',
    ...pickMetrics(row),
  }));

  const genderRows = (genders.length ? genders : demographics.filter((row) => row.gender && !row.age)).map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    gender: prettyGender(row.gender),
    ...pickMetrics(row),
  }));

  const countryRows = countries.map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    country: row.country || '',
    ...pickMetrics(row),
  }));

  const deviceRows = devices.map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    device: prettyDevice(row.impression_device || row.device),
    ...pickMetrics(row),
  }));

  const hourRows = hours.map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    hour: prettyHour(row.hour),
    ...pickMetrics(row),
  }));

  const devicePlatRows = devicePlatforms.map((row) => ({
    campaign: row.campaign_name || '',
    campaign_id: row.campaign_id || '',
    device_platform: prettyDevice(row.device_platform || row.impression_device),
    ...pickMetrics(row),
  }));

  const billingRows = funds
    ? [
        { item: 'Current due', value: Number(funds.amount_due || funds.balance || 0) },
        { item: 'Spend cap', value: funds.spend_cap ? Number(funds.spend_cap) : 'No cap' },
        { item: 'Pay method', value: funds.account?.funding || '—' },
        {
          item: 'Prepaid funds',
          value: funds.funds_from_api ? Number(funds.funds || 0) : 'Ads Manager (API nahi deta)',
        },
      ]
    : [];

  return [
    { name: 'Summary', columns: metricCols([{ key: 'period', label: 'Period' }]), rows: summaryRows },
    {
      name: 'Campaigns',
      columns: metricCols([
        { key: 'name', label: 'Campaign' },
        { key: 'status', label: 'Status' },
        { key: 'objective', label: 'Objective' },
        { key: 'id', label: 'Campaign ID' },
      ]),
      rows: campaignRows,
    },
    {
      name: 'Ad sets',
      columns: metricCols([
        { key: 'name', label: 'Ad set' },
        { key: 'campaign', label: 'Campaign' },
        { key: 'status', label: 'Status' },
      ]),
      rows: adsetRows,
    },
    {
      name: 'Ads',
      columns: metricCols([
        { key: 'name', label: 'Ad' },
        { key: 'adset', label: 'Ad set' },
        { key: 'campaign', label: 'Campaign' },
        { key: 'status', label: 'Status' },
      ]),
      rows: adRows,
    },
    {
      name: 'Placement',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'platform', label: 'Platform' },
        { key: 'position', label: 'Placement' },
      ]),
      rows: placementRows,
    },
    {
      name: 'Platform',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'platform', label: 'Platform' },
      ]),
      rows: platformRows,
    },
    {
      name: 'Age',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'age', label: 'Age' },
      ]),
      rows: ageRows,
    },
    {
      name: 'Gender',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'gender', label: 'Gender' },
      ]),
      rows: genderRows,
    },
    {
      name: 'Country',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'country', label: 'Country' },
      ]),
      rows: countryRows,
    },
    {
      name: 'Device',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'device', label: 'Device' },
      ]),
      rows: deviceRows,
    },
    {
      name: 'Time of day',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'hour', label: 'Hour' },
      ]),
      rows: hourRows,
    },
    {
      name: 'Platform + device',
      columns: metricCols([
        { key: 'campaign', label: 'Campaign' },
        { key: 'device_platform', label: 'Platform / device' },
      ]),
      rows: devicePlatRows,
    },
    ...(billingRows.length
      ? [{ name: 'Billing', columns: [{ key: 'item', label: 'Item' }, { key: 'value', label: 'Value' }], rows: billingRows }]
      : []),
    {
      name: '_meta',
      columns: [
        { key: 'k', label: 'Field' },
        { key: 'v', label: 'Value' },
      ],
      rows: [
        { k: 'Account', v: report?.account?.name || '' },
        { k: 'Account ID', v: report?.account?.id || '' },
        { k: 'Currency', v: currency },
        { k: 'Period', v: report?.period || '' },
        { k: 'Date preset', v: report?.date_preset || '' },
        { k: 'Generated', v: report?.generated_at || '' },
      ],
    },
  ].filter((sheet) => sheet.name === '_meta' || sheet.name === 'Billing' || sheet.rows.length > 0 || sheet.name === 'Summary' || sheet.name === 'Campaigns');
}

export function prettyPlatform(value: unknown) {
  const v = String(value || '').toLowerCase();
  if (v === 'facebook') return 'Facebook';
  if (v === 'instagram') return 'Instagram';
  if (v === 'audience_network') return 'Audience Network';
  if (v === 'messenger') return 'Messenger';
  if (v === 'threads') return 'Threads';
  return String(value || '—') || '—';
}

export function prettyPosition(value: unknown) {
  const raw = String(value || '').replace(/_/g, ' ').trim();
  if (!raw) return '—';
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function prettyGender(value: unknown) {
  const v = String(value || '').toLowerCase();
  if (v === 'male') return 'Male';
  if (v === 'female') return 'Female';
  if (v === 'unknown') return 'Unknown';
  return String(value || '—') || '—';
}

export function prettyDevice(value: unknown) {
  return prettyPosition(value);
}

function formatClock12(part: string) {
  const m = part.trim().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
  if (!m) return '';
  const hour24 = Number(m[1]);
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return '';
  const minutes = m[2] || '00';
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutes} ${suffix}`;
}

export function prettyHour(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (/\b(am|pm)\b/i.test(raw)) return raw.replace(/\s*[-–—]\s*/g, ' – ');
  const parts = raw.split(/\s*[-–—]\s*/).map(formatClock12).filter(Boolean);
  return parts.length ? parts.join(' – ') : raw;
}

export const BREAKDOWN_API: Record<string, string> = {
  Placement: 'publisher_platform,platform_position',
  Platform: 'publisher_platform',
  Age: 'age',
  Gender: 'gender',
  Country: 'country',
  Device: 'impression_device',
  'Time of day': 'hourly_stats_aggregated_by_advertiser_time_zone',
  'Platform + device': 'device_platform',
};

export function mapBreakdownRows(tab: string, raw: any[]): Record<string, unknown>[] {
  return (raw || []).map((row) => {
    const base = {
      campaign: row.campaign_name || '',
      campaign_id: row.campaign_id || '',
      adset: row.adset_name || '',
      adset_id: row.adset_id || '',
      ad: row.ad_name || '',
      ad_id: row.ad_id || '',
      ...pickMetrics(row),
    };
    if (tab === 'Placement') {
      return { ...base, platform: prettyPlatform(row.publisher_platform), position: prettyPosition(row.platform_position) };
    }
    if (tab === 'Platform') return { ...base, platform: prettyPlatform(row.publisher_platform) };
    if (tab === 'Age') return { ...base, age: row.age || '' };
    if (tab === 'Gender') return { ...base, gender: prettyGender(row.gender) };
    if (tab === 'Country') return { ...base, country: row.country || '' };
    if (tab === 'Device') return { ...base, device: prettyDevice(row.impression_device) };
    if (tab === 'Time of day') return { ...base, hour: prettyHour(row.hour) };
    if (tab === 'Platform + device') return { ...base, device_platform: prettyDevice(row.device_platform) };
    return base;
  });
}

export function totalsFromRows(rows: Record<string, unknown>[]) {
  const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
  const results = rows.reduce((s, r) => s + Number(r.results || 0), 0);
  const leads = rows.reduce((s, r) => s + Number(r.leads || 0), 0);
  const messaging = rows.reduce((s, r) => s + Number(r.messaging || 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions || 0), 0);
  const reach = rows.reduce((s, r) => s + Number(r.reach || 0), 0);
  return {
    spend,
    results,
    leads,
    messaging,
    clicks,
    impressions,
    reach,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpr: results > 0 ? spend / results : 0,
    cpl: leads > 0 ? spend / leads : 0,
  };
}

export function statusLabel(value: unknown) {
  const s = String(value || '').toUpperCase();
  if (s === 'ACTIVE') return 'Active';
  if (s.includes('PAUSE')) return 'Paused';
  if (s === 'WITH_SPEND') return 'Inactive';
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function campaignStatusBucket(value: unknown): 'active' | 'paused' | 'inactive' {
  const s = String(value || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s.includes('PAUSE')) return 'paused';
  return 'inactive';
}

export function filterReport(
  report: any,
  opts: { campaignId?: string; status?: 'active' | 'paused' | 'inactive' | 'all' } = {},
) {
  const campaignId = String(opts.campaignId || 'all');
  const status = opts.status || 'all';
  let campaigns: any[] = Array.isArray(report?.campaigns) ? [...report.campaigns] : [];
  if (campaignId !== 'all') {
    campaigns = campaigns.filter((c) => String(c.id) === campaignId);
  } else if (status !== 'all') {
    campaigns = campaigns.filter((c) => campaignStatusBucket(c.effective_status || c.status) === status);
  }
  const ids = new Set(campaigns.map((c) => String(c.id)));
  const inCampaign = (row: any) => {
    if (!ids.size && campaignId === 'all' && status === 'all') return true;
    const id = String(row?.campaign_id || row?.id || '');
    return ids.has(id);
  };
  const pick = (key: string) => (Array.isArray(report?.[key]) ? report[key].filter(inCampaign) : []);
  const name = campaigns[0]?.name;
  return {
    ...report,
    title:
      campaignId !== 'all' && name
        ? `${String(report?.title || 'Report').replace(/ — .+$/, '')} — ${name}`
        : report?.title,
    filename:
      campaignId !== 'all'
        ? String(report?.filename || 'myfng-ads.xlsx').replace(/\.xlsx$/i, `-${campaignId.slice(-6)}.xlsx`)
        : report?.filename,
    campaigns,
    adsets: pick('adsets'),
    ads: pick('ads'),
    placements: pick('placements'),
    platforms: pick('platforms'),
    ages: pick('ages'),
    genders: pick('genders'),
    demographics: pick('demographics'),
    countries: pick('countries'),
    devices: pick('devices'),
    hours: pick('hours'),
    device_platforms: pick('device_platforms'),
  };
}

function escapeCsv(value: unknown) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function cellForExport(key: string, value: unknown) {
  if (value == null || value === '') return '';
  if (PCT_KEYS.has(key)) return Number(Number(value).toFixed(2));
  if (MONEY_KEYS.has(key) || ['spend', 'results', 'leads', 'messaging', 'clicks', 'impressions', 'reach', 'cpc', 'cpm', 'cpr', 'cpl'].includes(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

export function reportToCsv(report: any): string {
  const sheets = flattenReportSheets(report).filter((s) => s.name !== '_meta');
  const chunks: string[] = [
    `MyFNG Meta Ads — ${report?.title || 'Report'}`,
    `Generated ${report?.generated_at || ''}`,
    `Account ${report?.account?.name || ''} ${report?.account?.id || ''}`,
    '',
  ];
  for (const sheet of sheets) {
    chunks.push(sheet.name.toUpperCase());
    chunks.push(sheet.columns.map((c) => escapeCsv(c.label)).join(','));
    for (const row of sheet.rows) {
      chunks.push(sheet.columns.map((c) => escapeCsv(cellForExport(c.key, row[c.key]))).join(','));
    }
    chunks.push('');
  }
  return `\uFEFF${chunks.join('\n')}`;
}

export function reportFileSlug(report: any, ext: string) {
  const raw = String(report?.filename || `myfng-ads-${report?.period || 'report'}`).replace(/\.(html|xlsx|csv|pdf)$/i, '');
  return `${raw}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export async function downloadReportExcel(report: any) {
  const res = await fetch('/api/super_admin/meta-ads-mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'export_report', format: 'xlsx', report, period: report?.period }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.base64) throw new Error(json?.error || 'Excel export failed');
  const bin = atob(String(json.base64));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  downloadBlob(
    new Blob([bytes], { type: json.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    json.filename || reportFileSlug(report, 'xlsx'),
  );
}

export function downloadReportCsv(report: any) {
  downloadBlob(new Blob([reportToCsv(report)], { type: 'text/csv;charset=utf-8' }), reportFileSlug(report, 'csv'));
}

function td(value: unknown, key?: string, currency = 'INR') {
  if (key && MONEY_KEYS.has(key)) return money(value, currency);
  if (key && PCT_KEYS.has(key)) return pct(value);
  if (key && ['results', 'leads', 'messaging', 'clicks', 'impressions', 'reach'].includes(key)) return num(value);
  return String(value ?? '—');
}

export function reportToPrintHtml(report: any) {
  const currency = report?.account?.currency || 'INR';
  const sheets = flattenReportSheets(report).filter((s) => s.name !== '_meta');
  const title = String(report?.title || 'MyFNG Ads Report').replace(/</g, '');
  const tables = sheets
    .map((sheet) => {
      const head = sheet.columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
      const body = sheet.rows
        .map(
          (row, i) =>
            `<tr class="${i % 2 ? 'alt' : ''}">${sheet.columns
              .map((c) => `<td>${esc(td(row[c.key], c.key, currency))}</td>`)
              .join('')}</tr>`,
        )
        .join('');
      return `<h2>${esc(sheet.name)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${sheet.columns.length}">No rows</td></tr>`}</tbody></table>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 16px 20px 32px; }
    h1 { color: #004AAD; font-size: 20px; margin: 0 0 4px; }
    .sub { color: #64748b; font-size: 12px; margin: 0 0 18px; }
    h2 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: #334155; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
    th { background: #004AAD; color: #fff; text-align: left; padding: 6px 7px; font-weight: 700; white-space: nowrap; }
    td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    tr.alt td { background: #f8fafc; }
    .foot { margin-top: 24px; font-size: 10px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
      h2 { break-after: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>MyFNG · Meta Ads</h1>
  <p class="sub">${esc(title)} · ${esc(report?.account?.name || '')} · ${esc(report?.account?.id || '')} · Generated ${esc(new Date(report?.generated_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST</p>
  ${tables}
  <p class="foot">Live Marketing API · read-only · Print dialog se Save as PDF choose karo.</p>
</body>
</html>`;
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printReportHtml(report: any): boolean {
  const html = reportToPrintHtml(report);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 2000);
    }
  };
  setTimeout(run, 400);
  return true;
}
