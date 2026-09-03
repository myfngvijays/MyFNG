import { getFundsTracker, getSpendSummary, listCampaigns } from './tools';

export type ReportPeriod = 'today' | 'last_7d' | 'last_30d' | 'briefing';

const PERIOD_LABEL: Record<Exclude<ReportPeriod, 'briefing'>, string> = {
  today: 'Today',
  last_7d: 'Last 7 days',
  last_30d: 'Last 30 days',
};

function inr(n: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  } catch {
    return `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  }
}

function num(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('en-IN');
}

function periodBlock(label: string, row: any, currency: string) {
  if (!row) return `${label}: data nahi mili`;
  const wa = Number(row.messaging || 0);
  const leads = Number(row.leads || 0);
  const results = Number(row.results || leads + wa);
  const cpr = row.cpr || row.cpl || 0;
  return [
    `${label}`,
    `  Spend: ${inr(row.spend, currency)}`,
    `  Results: ${num(results)}${wa ? ` (${num(wa)} WA chats)` : leads ? ` (${num(leads)} leads)` : ''}`,
    `  CPR: ${inr(cpr, currency)}`,
    `  Clicks: ${num(row.clicks)} · Impr: ${num(row.impressions)} · CTR: ${Number(row.ctr || 0).toFixed(2)}%`,
  ].join('\n');
}

export function guessReportPeriod(message: string): ReportPeriod | null {
  const q = String(message || '').toLowerCase();
  const wantsReport = /report|briefing|\bpdf\b|report nikal|report banao|poori report|ads report|summary bhej|summary nikal/.test(
    q,
  );
  if (!wantsReport) return null;
  if (/\b(aaj|today|aj)\b/.test(q)) return 'today';
  if (/\b30\b|mahina|month/.test(q)) return 'last_30d';
  if (/\b7\b|hafta|week/.test(q)) return 'last_7d';
  return 'briefing';
}

export async function generateMetaAdsReport(period: ReportPeriod = 'briefing') {
  const spend = await getSpendSummary();
  const currency = spend?.currency || spend?.account?.currency || 'INR';
  const campaigns = await listCampaigns({ status: 'ACTIVE', limit: 20 });
  const funds = period === 'briefing' ? await getFundsTracker(spend?.account?.id) : null;

  const accountName = spend?.account?.name || 'My FNG Car Service';
  const accountId = spend?.account?.id || '';
  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const title =
    period === 'briefing'
      ? `${accountName} — Ads briefing`
      : `${accountName} — ${PERIOD_LABEL[period]} report`;

  const focusKeys: Array<'today' | 'last_7d' | 'last_30d'> =
    period === 'today' ? ['today'] : period === 'last_7d' ? ['last_7d'] : period === 'last_30d' ? ['last_30d'] : ['today', 'last_7d', 'last_30d'];

  const lines: string[] = [
    title,
    `Generated ${stamp} IST`,
    accountId ? `Account ${accountId}` : '',
    '',
    'SPEND',
    ...focusKeys.map((key) => periodBlock(PERIOD_LABEL[key], spend?.periods?.[key], currency)),
  ].filter((line, i, arr) => line !== '' || arr[i - 1] !== '');

  const campRows = Array.isArray(campaigns?.campaigns) ? campaigns.campaigns : [];
  lines.push('', 'ACTIVE CAMPAIGNS (7d)');
  if (!campRows.length) {
    lines.push('Koi active campaign nahi mili.');
  } else {
    for (const c of campRows.slice(0, 12)) {
      const p = c.last_7d || {};
      const wa = p.messaging || p.leads || 0;
      lines.push(
        `• ${c.name} — ${c.effective_status || c.status || '—'} — ${inr(p.spend || 0, currency)} — ${num(wa)} results`,
      );
    }
  }

  if (funds) {
    lines.push(
      '',
      'BILLING',
      `Current due: ${inr(funds.amount_due || funds.balance || 0, currency)}`,
      `Spend cap: ${funds.spend_cap ? inr(funds.spend_cap, currency) : 'No cap'}`,
      `Pay method: ${funds.account?.funding || '—'}`,
      `Prepaid Funds: ${funds.funds_from_api ? inr(funds.funds, currency) : 'Ads Manager (API nahi deta)'}`,
    );
  }

  lines.push('', 'MyFNG Meta Ads — read-only live numbers.');
  const markdown = lines.join('\n');
  const slug = period === 'briefing' ? 'briefing' : period.replace(/_/g, '-');
  const filename = `myfng-ads-${slug}-${new Date().toISOString().slice(0, 10)}.html`;

  return {
    ok: true,
    period,
    title,
    markdown,
    filename,
    generated_at: new Date().toISOString(),
    account: { name: accountName, id: accountId, currency },
    periods: spend?.periods || {},
    campaigns: campRows,
    funds: funds || null,
    rate_limited: Boolean(spend?.rate_limited),
  };
}

export function reportToHtml(report: { title: string; markdown: string; generated_at?: string }) {
  const body = String(report.markdown || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${String(report.title || 'MyFNG Ads Report').replace(/</g, '')}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 760px; margin: 40px auto; color: #0f172a; padding: 0 20px; }
    h1 { color: #004AAD; font-size: 22px; margin-bottom: 8px; }
    pre { white-space: pre-wrap; font-family: inherit; line-height: 1.55; font-size: 14px; }
    .foot { margin-top: 32px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <h1>MyFNG · Meta Ads</h1>
  <pre>${body}</pre>
  <p class="foot">Live Marketing API · read-only</p>
</body>
</html>`;
}
