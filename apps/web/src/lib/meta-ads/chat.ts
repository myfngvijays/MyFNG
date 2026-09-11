import { META_ADS_TOOLS, getAdPerformance, listCampaigns, runMetaAdsTool } from './tools';
import { generateMetaAdsReport, guessReportPeriod } from './report';
import { getMetaAdsPlaybook, playbookToPrompt } from './playbook';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ChatCardMetric = { label: string; value: string };
export type ChatCardItem = {
  name: string;
  tags: string[];
  headline?: string;
  metrics: ChatCardMetric[];
};
export type ChatCards = {
  kind: 'ads' | 'campaigns';
  title?: string;
  summary: ChatCardMetric[];
  items: ChatCardItem[];
};

export function splitAdName(name: string): { title: string; tags: string[] } {
  const parts = String(name || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+AD$/i, '').trim());
  if (parts.length < 2) return { title: String(name || 'Ad').trim() || 'Ad', tags: [] };
  const [first, ...rest] = parts;
  if (/^[A-Z0-9]$/i.test(first)) return { title: `Ad ${first.toUpperCase()}`, tags: rest };
  return { title: first, tags: rest };
}

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

function periodLine(label: string, row: any, currency: string) {
  if (!row) return `${label}: data nahi mili`;
  return `${label}: ${inr(row.spend, currency)} · ${row.leads || 0} leads · ${row.messaging || 0} WA chats · ${row.clicks || 0} clicks · CTR ${Number(row.ctr || 0).toFixed(2)}%`;
}

function adLabel(ad: any) {
  return String(ad.headline || ad.name || 'Ad').slice(0, 80);
}

function metric(label: string, value: string): ChatCardMetric {
  return { label, value };
}

function cardsFromCampaigns(result: any, currency: string): ChatCards | null {
  const rows = Array.isArray(result?.campaigns) ? result.campaigns : [];
  if (!rows.length) return null;
  const items = rows.slice(0, 8).map((c: any) => {
    const p = c.last_7d || c.metrics || {};
    const parsed = splitAdName(c.name);
    return {
      name: parsed.title,
      tags: parsed.tags,
      metrics: [
        metric('Spend', inr(p.spend || 0, currency)),
        metric('Clicks', String(p.clicks || 0)),
        metric('CTR', `${Number(p.ctr || 0).toFixed(2)}%`),
        metric('Results', String(p.messaging || p.leads || p.results || 0)),
      ],
    };
  });
  const spend = rows.reduce((n: number, c: any) => n + Number(c.last_7d?.spend || c.metrics?.spend || 0), 0);
  const clicks = rows.reduce((n: number, c: any) => n + Number(c.last_7d?.clicks || c.metrics?.clicks || 0), 0);
  const results = rows.reduce(
    (n: number, c: any) => n + Number(c.last_7d?.messaging || c.last_7d?.leads || c.metrics?.messaging || c.metrics?.leads || 0),
    0,
  );
  return {
    kind: 'campaigns',
    title: rows.length === 1 ? rows[0].name : `${rows.length} campaigns`,
    summary: [
      metric('Spend (7d)', inr(spend, currency)),
      metric('Clicks', String(clicks)),
      metric('Results', String(results)),
    ],
    items,
  };
}

function cardsFromAds(result: any, currency: string): ChatCards | null {
  const ads = Array.isArray(result?.ads) ? result.ads : [];
  if (!ads.length) return null;
  const items = ads.slice(0, 8).map((a: any) => {
    const p = a.last_7d || {};
    const parsed = splitAdName(a.name || a.headline);
    return {
      name: parsed.title,
      tags: parsed.tags,
      headline: String(a.headline || '').trim() || undefined,
      metrics: [
        metric('Spend', inr(p.spend || 0, currency)),
        metric('Clicks', String(p.clicks || 0)),
        metric('CTR', `${Number(p.ctr || 0).toFixed(2)}%`),
        metric('Results', String(p.messaging || p.leads || p.results || 0)),
      ],
    };
  });
  const spend = ads.reduce((n: number, a: any) => n + Number(a.last_7d?.spend || 0), 0);
  const clicks = ads.reduce((n: number, a: any) => n + Number(a.last_7d?.clicks || 0), 0);
  const results = ads.reduce(
    (n: number, a: any) => n + Number(a.last_7d?.messaging || a.last_7d?.leads || a.last_7d?.results || 0),
    0,
  );
  const title =
    String(result?.campaign_name || ads.find((a: any) => a.campaign_name)?.campaign_name || '').trim() ||
    'Ads (last 7d)';
  return {
    kind: 'ads',
    title,
    summary: [
      metric('Spend (7d)', inr(spend, currency)),
      metric('Clicks', String(clicks)),
      metric('Results', String(results)),
    ],
    items,
  };
}

function cardsFromTool(name: string, result: any): ChatCards | null {
  const currency = result?.currency || result?.account?.currency || 'INR';
  if (name === 'get_ad_performance') return cardsFromAds(result, currency);
  if (name === 'list_campaigns') return cardsFromCampaigns(result, currency);
  return null;
}

function formatAdAdvice(result: any, currency: string) {
  const ads = Array.isArray(result?.ads) ? result.ads : [];
  if (!ads.length) return 'Koi ad nahi mili.';
  const scored = ads
    .map((a: any) => {
      const p = a.last_7d || {};
      const spend = Number(p.spend || 0);
      const chats = Number(p.messaging || p.leads || 0);
      const ctr = Number(p.ctr || 0);
      const clicks = Number(p.clicks || 0);
      const cpr = chats > 0 ? spend / chats : spend > 20 ? Number.POSITIVE_INFINITY : 0;
      return { a, spend, chats, ctr, clicks, cpr, active: /ACTIVE/i.test(String(a.status || '')) };
    })
    .sort((x: any, y: any) => {
      if (y.chats !== x.chats) return y.chats - x.chats;
      if (x.cpr !== y.cpr) return x.cpr - y.cpr;
      return y.ctr - x.ctr;
    });
  const live = scored.filter((s: any) => s.active);
  const pool = live.length ? live : scored;
  const keep = pool.find((s: any) => s.chats > 0) || pool[0];
  const pause = pool.find((s: any) => s !== keep && s.spend > 80 && s.chats === 0);
  const test = pool.find((s: any) => s !== keep && s !== pause && s.ctr >= 0.8 && s.chats < (keep?.chats || 1));
  const lines = [
    `Verdict: Last 7d pe ${keep ? adLabel(keep.a) : 'kisi ad'} ko scale karo — chats/CPR pe, CTR pe nahi.`,
    keep
      ? `KEEP: ${adLabel(keep.a)} — ${inr(keep.spend, currency)}, ${keep.chats} chats, CTR ${keep.ctr.toFixed(2)}%`
      : null,
    test
      ? `TEST: ${adLabel(test.a)} — CTR ${test.ctr.toFixed(2)}% hai lekin chats ${test.chats}. CTA/headline rewrite.`
      : `TEST: Weak-chat ads pe city + WhatsApp CTA try karo — same offer, tighter headline.`,
    pause
      ? `PAUSE: ${adLabel(pause.a)} — ${inr(pause.spend, currency)} spend, 0 chats vs siblings.`
      : null,
    `NEXT COPY: ${keep?.a?.headline ? String(keep.a.headline).slice(0, 40) : 'Free pickup + WhatsApp'} | Problem → MyFNG proof → WhatsApp / Book now`,
    '',
    `Ads + copy (${result.date_preset || 'last_7d'}):`,
    ...scored.slice(0, 8).map((s: any, i: number) => {
      const n = s.a.name || adLabel(s.a);
      return [
        `${i + 1}) ${n}`,
        `Spend: ${inr(s.spend, currency)}`,
        `Clicks: ${s.clicks}`,
        `CTR: ${s.ctr.toFixed(2)}%`,
        `Results: ${s.chats}`,
        `Headline: ${s.a.headline || '—'}`,
      ].join('\n');
    }),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatToolText(name: string, result: any): string {
  const currency = result?.currency || result?.account?.currency || 'INR';
  if (name === 'get_spend_summary' && result?.periods) {
    const p = result.periods;
    const acc = result.account?.name || 'Ad account';
    return [
      `${acc} (${currency})`,
      periodLine('Aaj', p.today, currency),
      periodLine('Last 7 days', p.last_7d, currency),
      periodLine('Last 30 days', p.last_30d, currency),
    ].join('\n');
  }
  if (name === 'list_campaigns' && Array.isArray(result?.campaigns)) {
    const rows = result.campaigns.slice(0, 8).map((c: any) => {
      const spend = inr(c.last_7d?.spend || 0, currency);
      const wa = c.last_7d?.messaging || c.last_7d?.leads || 0;
      return `• ${c.name} — ${c.effective_status || c.status} — 7d ${spend} — ${wa} results`;
    });
    const heading = result.q ? `Campaigns matching “${result.q}”:` : 'Active campaigns:';
    return rows.length ? `${heading}\n${rows.join('\n')}` : result.q ? `“${result.q}” se matching campaign nahi mili.` : 'Koi campaign nahi mili.';
  }
  if (name === 'get_funds_tracker') {
    const due = inr(result?.amount_due || result?.balance || 0, currency);
    const cap = result?.spend_cap ? inr(result.spend_cap, currency) : 'no cap';
    const pay = result?.account?.funding || '—';
    const funds = result?.funds_from_api ? inr(result.funds, currency) : 'Ads Manager mein dekho (Graph API nahi deta)';
    return `Due: ${due}\nSpend cap: ${cap}\nPay method: ${pay}\nFunds: ${funds}\nHint: Ads Manager → Billing & payments`;
  }
  if (name === 'get_ad_performance' && Array.isArray(result?.ads)) {
    return formatAdAdvice(result, currency);
  }
  if (Array.isArray(result?.pages)) {
    return result.pages.map((p: any) => `• ${p.name} (${p.fan_count || p.followers_count || 0} fans)`).join('\n') || 'No pages';
  }
  return JSON.stringify(result, null, 2).slice(0, 1200);
}

const ASK_STOPWORDS = new Set([
  'aaj',
  'kal',
  'kitna',
  'kitne',
  'kitni',
  'kya',
  'hai',
  'hua',
  'hue',
  'ka',
  'ki',
  'ke',
  'ko',
  'se',
  'mein',
  'me',
  'pe',
  'par',
  'wala',
  'wali',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'last',
  'days',
  'day',
  'spend',
  'spent',
  'due',
  'funds',
  'wallet',
  'balance',
  'payment',
  'cap',
  'campaign',
  'campaigns',
  'ad',
  'ads',
  'copy',
  'headline',
  'creative',
  'active',
  'paused',
  'compare',
  'report',
  'chats',
  'whatsapp',
  'wa',
  'today',
  'week',
  'month',
  'page',
  'pages',
  'pixel',
  'account',
  'kaunsi',
  'kaunsa',
  'chalaun',
  'better',
  'suggestion',
  'advise',
  'dikhao',
  'batao',
  'show',
  'tell',
  'about',
  'meta',
  'myfng',
  'facebook',
  'instagram',
  'poocho',
  'pucha',
  'data',
  'numbers',
  'din',
  'aur',
  'karo',
  'compare',
  'is',
  'us',
  'ye',
  'vo',
  'ab',
  'now',
]);

function extractNamedQuery(message: string): string | null {
  const raw = String(message || '').trim();
  if (!raw) return null;
  const quoted = raw.match(/["“]([^"”]{2,40})["”]|'([^']{2,40})'/);
  if (quoted) return String(quoted[1] || quoted[2] || '').trim() || null;

  const labeled = raw.match(/(?:campaign|ad)\s+(?:named\s+)?["']?([a-z0-9][\w-]{2,30})["']?/i);
  if (labeled) {
    const q = labeled[1].trim().replace(/[?.!,]+$/, '');
    if (q && !ASK_STOPWORDS.has(q.toLowerCase())) return q;
  }

  const beforeCampaign = raw.match(/\b([a-z][\w-]{2,30})\s+campaign\b/i);
  if (beforeCampaign && !ASK_STOPWORDS.has(beforeCampaign[1].toLowerCase())) return beforeCampaign[1];

  const hindi = raw.match(/\b([a-z][\w-]{2,30})\s+(?:ka|ki|ke|wala|wali)\b/i);
  if (hindi && !ASK_STOPWORDS.has(hindi[1].toLowerCase())) return hindi[1];

  const tokens = raw
    .replace(/[?!,.]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !ASK_STOPWORDS.has(t.toLowerCase()) && !/^\d+$/.test(t));
  if (tokens.length === 1) return tokens[0];
  return null;
}

async function resolveNamedAds(message: string): Promise<{
  q: string;
  tool: string;
  result: any;
  cards: ChatCards | null;
  campaignId?: string;
} | null> {
  const q = extractNamedQuery(message);
  if (!q) return null;
  const listed = await listCampaigns({ q, status: 'ALL', limit: 100 });
  const campaigns = Array.isArray(listed.campaigns) ? listed.campaigns : [];
  if (campaigns.length > 1) {
    return {
      q,
      tool: 'list_campaigns',
      result: listed,
      cards: cardsFromCampaigns(listed, listed.currency || 'INR'),
    };
  }
  if (campaigns.length === 1) {
    const campaign = campaigns[0];
    const ads = await getAdPerformance({ campaign_id: campaign.id, limit: 50 });
    const result = { ...ads, campaign_name: ads.campaign_name || campaign.name };
    return {
      q,
      tool: 'get_ad_performance',
      result,
      cards: cardsFromAds(result, 'INR'),
      campaignId: String(campaign.id),
    };
  }
  const ads = await getAdPerformance({ q, limit: 50 });
  if (Array.isArray(ads.ads) && ads.ads.length) {
    return { q, tool: 'get_ad_performance', result: ads, cards: cardsFromAds(ads, 'INR') };
  }
  return { q, tool: 'list_campaigns', result: listed, cards: null };
}

function guessTool(message: string): { name: string; params: Record<string, unknown> } {
  const q = message.toLowerCase();
  const named = extractNamedQuery(message);
  if (/fund|due|balance|wallet|kitna bacha|payment|cap/.test(q)) {
    return { name: 'get_funds_tracker', params: {} };
  }
  if (named) {
    return { name: 'get_ad_performance', params: { q: named, date_preset: 'last_7d', limit: 50 } };
  }
  if (/copy|headline|creative|kaunsi|better|chalaun|suggestion|advise|compare ads|ad copy/.test(q)) {
    return { name: 'get_ad_performance', params: { date_preset: 'last_7d', limit: 20 } };
  }
  if (/campaign/.test(q)) {
    return { name: 'list_campaigns', params: { status: 'ACTIVE', limit: 20 } };
  }
  if (/page|fan/.test(q)) {
    return { name: 'list_pages', params: { limit: 20 } };
  }
  if (/pixel/.test(q)) {
    return { name: 'list_pixels', params: {} };
  }
  return { name: 'get_spend_summary', params: {} };
}

function openAiTools() {
  return META_ADS_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          t.params.map((p) => [p.key, { type: 'string', description: p.label + (p.placeholder ? ` (${p.placeholder})` : '') }]),
        ),
        required: t.params.filter((p) => p.required).map((p) => p.key),
      },
    },
  }));
}

async function openaiChat(messages: any[]) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_META_ADS_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 450,
      tools: openAiTools(),
      tool_choice: 'auto',
      messages,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message;
}

export async function answerMetaAdsChat(input: {
  message: string;
  history?: ChatTurn[];
}) {
  const message = String(input.message || '').trim();
  if (!message) throw new Error('Type a question first.');

  const history = (input.history || []).slice(-8).map((m) => ({
    role: m.role,
    content: String(m.content || '').slice(0, 2000),
  }));

  const reportPeriod = guessReportPeriod(message);
  if (reportPeriod) {
    const report = await generateMetaAdsReport(reportPeriod);
    return {
      ok: true,
      reply: report.markdown,
      used_openai: false,
      tool: 'generate_report',
      report,
    };
  }

  const named = await resolveNamedAds(message).catch(() => null);

  if (!process.env.OPENAI_API_KEY) {
    if (named?.result) {
      return {
        ok: true,
        reply: named.cards
          ? formatToolText(named.tool, named.result)
          : `${named.q} se matching campaign nahi mili.`,
        used_openai: false,
        tool: named.tool,
        cards: named.cards,
      };
    }
    const guessed = guessTool(message);
    const result = await runMetaAdsTool(guessed.name, guessed.params);
    return {
      ok: true,
      reply: formatToolText(guessed.name, result),
      used_openai: false,
      tool: guessed.name,
      cards: cardsFromTool(guessed.name, result),
    };
  }

  const book = await getMetaAdsPlaybook();
  const system = {
    role: 'system',
    content: `You are MyFNG Ads Advisor — Claude-style: recommend, then prove with live Meta numbers.
Never dump creatives without a Keep / Test / Pause call.
Use tools for every number. Never invent spend, chats, or CTR.
Saved ad account is already connected — leave account_id blank unless user gives another act_ id.
If they name a campaign (Sanket, Thane, etc.), list_campaigns with q then get_ad_performance with that campaign_id or q. Do not return unrelated account ads.
If they ask which copy/ad to run, compare, or improve — ALWAYS call get_ad_performance.
If they ask prepaid Funds / wallet ₹, Graph API often cannot see card prepaid — show due + spend cap, point to Ads Manager Billing.
Read-only: you cannot pause ads or change budget. Tell them the Ads Manager click.
Playbook (follow this):
${playbookToPrompt(book)}

Never write a paragraph. One fact per line. No markdown asterisks, no self-intro.

Billing / due / funds (this format only):
Due: ₹amount
Spend cap: ₹amount
Pay method: ...
Hint: Ads Manager → Billing & payments

Spend / today / 7d:
Today: ₹x
Last 7 days: ₹x
Last 30 days: ₹x
Chats: n

Copy / which ad (this format only):
Verdict: one sentence
KEEP: ad or headline — ₹ proof
TEST: ad or headline — why
PAUSE: ad or headline — why (omit if none)
NEXT COPY: short headline | primary text
Do NOT list ads as 1) 2) 3) — the UI already shows metric cards. Only Verdict / KEEP / TEST / PAUSE / NEXT COPY.
Hindi + English mix. Short.`,
  };

  if (named?.q) {
    system.content += named.campaignId
      ? `\nUser asked about "${named.q}". Use campaign_id ${named.campaignId} (or q=${named.q}) on get_ad_performance.`
      : `\nUser asked about "${named.q}". Pass q=${named.q} on list_campaigns / get_ad_performance.`;
  }

  const messages: any[] = [system, ...history, { role: 'user', content: message }];
  let lastCards: ChatCards | null = named?.cards || null;
  let lastTool = named?.tool || null;

  for (let i = 0; i < 4; i += 1) {
    const msg = await openaiChat(messages);
    if (!msg) break;
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      return {
        ok: true,
        reply: String(msg.content || '').trim() || 'Meta se data nahi mila.',
        used_openai: true,
        tool: lastTool,
        cards: lastCards,
      };
    }
    messages.push(msg);
    for (const call of calls) {
      const name = String(call.function?.name || '');
      let params: Record<string, unknown> = {};
      try {
        params = JSON.parse(call.function?.arguments || '{}');
      } catch {
        params = {};
      }
      if (named?.campaignId && name === 'get_ad_performance' && !params.campaign_id) {
        params.campaign_id = named.campaignId;
      } else if (named?.q && (name === 'get_ad_performance' || name === 'list_campaigns') && !params.q && !params.campaign_id) {
        params.q = named.q;
      }
      let payload: unknown;
      try {
        payload = await runMetaAdsTool(name, params);
      } catch (e: any) {
        payload = { error: e?.message || 'Tool failed' };
      }
      const built = cardsFromTool(name, payload);
      if (built) {
        lastCards = built;
        lastTool = name;
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(payload).slice(0, 8000),
      });
    }
  }

  if (named?.result) {
    return {
      ok: true,
      reply: named.cards ? formatToolText(named.tool, named.result) : `${named.q} se matching campaign nahi mili.`,
      used_openai: true,
      tool: named.tool,
      cards: named.cards,
    };
  }

  const guessed = guessTool(message);
  const result = await runMetaAdsTool(guessed.name, guessed.params);
  return {
    ok: true,
    reply: formatToolText(guessed.name, result),
    used_openai: true,
    tool: guessed.name,
    cards: lastCards || cardsFromTool(guessed.name, result),
  };
}
