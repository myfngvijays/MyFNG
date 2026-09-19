import { getGoogleAdsPlaybook, playbookToPrompt } from './playbook';
import { generateGoogleAdsReport, guessGoogleAdsReportPeriod } from './report';
import { GOOGLE_ADS_TOOLS, listCampaigns, runGoogleAdsTool } from './tools';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function inr(n: number, currency = 'INR') {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

function normalizeName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCampaign(message: string, campaigns: any[]) {
  const q = normalizeName(message);
  if (q.length < 8 || !campaigns.length) return null;
  let best: any = null;
  let bestScore = 0;
  for (const campaign of campaigns) {
    const name = normalizeName(campaign?.name || '');
    if (name.length < 8) continue;
    if (q.includes(name)) return campaign;
    const tokens = name.split(' ').filter((token) => token.length > 3);
    const hits = tokens.filter((token) => q.includes(token)).length;
    const score = hits / Math.max(tokens.length, 1);
    if (hits >= 3 && score > bestScore) {
      best = campaign;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function isLiveRow(row: any) {
  return Number(row?.spend || 0) > 0 || Number(row?.clicks || 0) > 0 || Number(row?.conversions || 0) > 0;
}

function liveToolRows(result: any, name: string) {
  const key =
    name === 'list_campaigns' || name === 'generate_report'
      ? 'campaigns'
      : name === 'list_ad_groups'
        ? 'ad_groups'
        : name === 'list_ads'
          ? 'ads'
          : name === 'list_keywords'
            ? 'keywords'
            : name === 'list_search_terms'
              ? 'search_terms'
              : '';
  const rows = key ? result?.[key] : result?.campaigns || result?.ads;
  if (!Array.isArray(rows)) return [];
  const live = rows.filter(isLiveRow);
  return (live.length ? live : rows.filter((row) => /ENABLED/i.test(String(row.status || '')))).slice(0, name === 'list_ads' ? 4 : 6);
}

function wantsCopy(message: string) {
  return /ad copy|ad copies|kaunsi copy|which (ad|copy)|copy chala|copy suggest|rsa/i.test(message);
}

function wantsHeadlineSuggest(message: string) {
  return /headline|suggest.*copy|naye headline|headline likh|headlines suggest|keyword.*headline/i.test(message);
}

function wantsAudit(message: string) {
  return /active.*pause|pause.*campaign|highest conversion|keyword.*conversion|conversions ka data|check kar/i.test(message);
}

function convScore(row: any) {
  return Number(row?.conversions || 0) || Number(row?.all_conversions || 0);
}

function metricItems(row: any) {
  return [
    { label: 'Spend', value: inr(row.spend) },
    { label: 'Clicks', value: String(row.clicks || 0) },
    { label: 'Results', value: String(row.conversions || 0) },
    { label: 'All conv.', value: String(row.all_conversions || 0) },
    { label: 'CPL', value: row.cpl != null ? inr(row.cpl) : '—' },
  ];
}

function cardItem(row: any, extra?: string) {
  return {
    name: row.name || row.text,
    tags: [row.status, row.match, row.channel, extra].filter(Boolean),
    headline: row.campaign || (Array.isArray(row.headlines) ? row.headlines.slice(0, 2).join(' · ') : ''),
    metrics: metricItems(row),
  };
}

function titleCase(value: string) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function clipHeadline(value: string) {
  const clean = titleCase(String(value || '').replace(/[^\w\s&+-]/g, ' ').replace(/\s+/g, ' ').trim());
  return clean.slice(0, 30).trim();
}

function buildHeadlineSuggestions(keywords: any[], terms: any[]) {
  const pool = [...terms, ...keywords]
    .filter((row) => row?.text && isLiveRow(row))
    .sort(
      (a, b) =>
        Number(b.conversions || 0) - Number(a.conversions || 0) || Number(b.clicks || 0) - Number(a.clicks || 0),
    );
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const row of pool) {
    const text = clipHeadline(row.text);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    phrases.push(text);
    if (phrases.length >= 5) break;
  }
  const extras = [
    'Car Service Near Me',
    'Book Car Service Today',
    'Free Pickup & Drop',
    'Trusted Garage Nearby',
  ].filter((h) => !seen.has(h.toLowerCase()));
  const headlines = [...phrases, ...extras].slice(0, 6);
  const lines = [
    'Keyword + search term se headlines:',
    ...headlines.map((h, i) => `${i + 1}. ${h}`),
    phrases[0] ? `Proof: “${phrases[0]}” live search language hai — isi ko RSA headline banao.` : 'Live terms kam hain, generic service CTAs try karo.',
  ];
  return {
    reply: lines.join('\n'),
    cards: {
      kind: 'headlines',
      title: 'Suggested headlines',
      items: headlines.map((name, i) => ({
        name: `${i + 1}. ${name}`,
        tags: [name.length <= 30 ? `${name.length} chars` : 'trim'],
        headline: pool[i] ? `${pool[i].clicks || 0} clicks · ${pool[i].conversions || 0} conv` : 'CTA',
        metrics: [],
      })),
    },
  };
}

function friendlyChatError(error: unknown) {
  const msg = String((error as any)?.message || error || '');
  if (/unauthor|unauthentic|invalid_grant|invalid_client|401/i.test(msg)) {
    return 'Google Ads login expire ho gaya. Upar Refresh dabao — phir bhi na chale to Connect tab se dubara Connect with Google karo.';
  }
  return msg.slice(0, 240) || 'Ask AI fail ho gaya.';
}

function reportReply(report: any) {
  const m = report?.metrics || {};
  return [
    report?.label || report?.title || 'Google Ads report',
    `Spend ${inr(m.spend || 0)} · ${m.clicks || 0} clicks · ${m.conversions || 0} results · CPL ${m.cpl != null ? inr(m.cpl) : '—'}`,
    ...(report?.insights?.lines || []).slice(0, 4),
  ].join('\n');
}

function guessTool(message: string): { name: string; params: Record<string, unknown> } {
  const q = message.toLowerCase();
  if (/fund|balance|billing|wallet|kitna paisa|budget bacha|fund bacha/.test(q)) {
    return { name: 'get_funds_tracker', params: {} };
  }
  if (/search term|kya search/.test(q)) return { name: 'list_search_terms', params: { status: 'ENABLED' } };
  if (/keyword/.test(q)) return { name: 'list_keywords', params: { status: 'ENABLED', sort: 'conversions' } };
  if (/ad group|adgroup/.test(q)) return { name: 'list_ad_groups', params: { status: 'ENABLED', min_spend: 1 } };
  if (wantsCopy(message) || /which ad|ads compare/.test(q)) {
    return { name: 'list_ads', params: { status: 'ENABLED', min_spend: 1, limit: 8 } };
  }
  if (/campaign/.test(q)) return { name: 'list_campaigns', params: { status: 'ENABLED', min_spend: 1 } };
  return { name: 'get_spend_summary', params: {} };
}

function formatToolText(name: string, result: any): string {
  if (name === 'get_funds_tracker') {
    return [
      `Billing: ${result?.billing_type || result?.funding || '—'}`,
      `Remaining: ${result?.funds_from_api ? inr(result.remaining || 0) : 'Invoice account'}`,
      `Daily budget: ${inr(result?.daily_budget || 0)} · Today ${inr(result?.today_spend || 0)}`,
      `7d burn: ${inr(result?.daily_burn || 0)}/day`,
    ].join('\n');
  }
  if (name === 'get_spend_summary') {
    const currency = result?.currency || 'INR';
    const p = result?.periods || {};
    return [
      `Today: ${inr(p.today?.spend, currency)} · ${p.today?.conversions || 0} conv`,
      `Last 7 days: ${inr(p.last_7d?.spend, currency)} · ${p.last_7d?.conversions || 0} conv`,
      `Last 30 days: ${inr(p.last_30d?.spend, currency)} · ${p.last_30d?.conversions || 0} conv`,
    ].join('\n');
  }
  const rows = result?.campaigns || result?.ad_groups || result?.ads || result?.keywords || result?.search_terms || [];
  if (!Array.isArray(rows) || !rows.length) return 'Is range mein rows nahi mile.';
  return rows
    .slice(0, 8)
    .map((row: any) => `${row.name || row.text} — ${inr(row.spend)} · ${row.conversions || 0} conv · ${row.clicks || 0} clicks`)
    .join('\n');
}

function cardsFromTool(name: string, result: any) {
  const rows = liveToolRows(result, name);
  if (!rows.length) return null;
  return {
    kind: name,
    title: name.replace(/list_/, '').replace(/_/g, ' '),
    items: rows
      .slice()
      .sort((a, b) => convScore(b) - convScore(a) || Number(b.spend || 0) - Number(a.spend || 0))
      .map((row: any) => cardItem(row)),
  };
}

function slimToolPayload(name: string, payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  const rows = liveToolRows(payload, name);
  if (!rows.length) return payload;
  const key =
    name === 'list_ad_groups'
      ? 'ad_groups'
      : name === 'list_search_terms'
        ? 'search_terms'
        : name === 'list_campaigns'
          ? 'campaigns'
          : name === 'list_keywords'
            ? 'keywords'
            : name === 'list_ads'
              ? 'ads'
              : '';
  if (!key) return payload;
  return {
    [key]: rows.map((row: any) => ({
      id: row.id,
      name: row.name || row.text,
      status: row.status,
      spend: row.spend,
      clicks: row.clicks,
      conversions: row.conversions,
      all_conversions: row.all_conversions,
      cpl: row.cpl,
      headlines: Array.isArray(row.headlines) ? row.headlines.slice(0, 3) : undefined,
    })),
  };
}

function keepTestPause(ads: any[]) {
  const pool = ads
    .filter((a) => isLiveRow(a) && /ENABLED/i.test(String(a.status || 'ENABLED')))
    .map((a) => ({
      a,
      spend: Number(a.spend || 0),
      conv: Number(a.conversions || 0),
      ctr: Number(a.ctr || 0),
      cpl: a.cpl == null ? Number.POSITIVE_INFINITY : Number(a.cpl),
    }))
    .sort((x, y) => (x.cpl === y.cpl ? y.conv - x.conv : x.cpl - y.cpl));
  const keep = pool.find((s) => s.conv > 0) || pool[0];
  const pause = pool.find((s) => s !== keep && s.spend > 80 && s.conv === 0);
  const test = pool.find((s) => s !== keep && s !== pause && s.ctr >= 2 && s.conv < (keep?.conv || 1));
  return [
    `Verdict: Last 7d pe ${keep ? keep.a.name || keep.a.text : 'kisi ad'} ko scale karo — conversions/CPL pe.`,
    keep ? `KEEP: ${keep.a.name || keep.a.text} — ${inr(keep.spend)}, ${keep.conv} conv` : null,
    test ? `TEST: ${test.a.name || test.a.text} — CTR ${test.ctr}% lekin conv ${test.conv}. Headline rewrite.` : 'TEST: Weak-conv ads pe city + Book now CTA try karo.',
    pause ? `PAUSE: ${pause.a.name || pause.a.text} — ${inr(pause.spend)} spend, 0 conv.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function openAiTools() {
  return GOOGLE_ADS_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries((t.params || []).map((p) => [p.key, { type: 'string', description: p.label }])),
        required: (t.params || []).filter((p) => p.required).map((p) => p.key),
      },
    },
  }));
}

async function openaiChat(messages: any[], opts?: { tools?: boolean }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  const useTools = opts?.tools !== false;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_META_ADS_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 450,
      ...(useTools ? { tools: openAiTools(), tool_choice: 'auto' } : {}),
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

export async function answerGoogleAdsChat(input: { message: string; history?: ChatTurn[] }) {
  const message = String(input.message || '').trim();
  if (!message) throw new Error('Type a question first.');
  const history = (input.history || []).slice(-8).map((m) => ({
    role: m.role,
    content: String(m.content || '').slice(0, 2000),
  }));

  if (wantsAudit(message) && !wantsHeadlineSuggest(message)) {
    try {
      const [campaigns, keywordPayload] = await Promise.all([
        listCampaigns({ status: 'ALL', during: 'LAST_7_DAYS', limit: 80 }),
        runGoogleAdsTool('list_keywords', { during: 'LAST_7_DAYS', sort: 'conversions', limit: 30 }),
      ]);
      const active = campaigns
        .filter((c) => /ENABLED/i.test(String(c.status || '')))
        .sort((a, b) => convScore(b) - convScore(a) || Number(b.spend || 0) - Number(a.spend || 0));
      const paused = campaigns.filter((c) => /PAUSED/i.test(String(c.status || '')));
      const keywords = (((keywordPayload as any)?.keywords || []) as any[])
        .slice()
        .sort((a, b) => convScore(b) - convScore(a) || Number(b.spend || 0) - Number(a.spend || 0));
      return {
        ok: true,
        reply: 'Last 7 days. Results = primary conversions. All conv. = secondary bhi.',
        used_openai: false,
        tool: 'account_audit',
        blocks: [
          { title: 'Active campaigns', items: active.slice(0, 8).map((row) => cardItem(row)) },
          { title: 'Paused campaigns', items: paused.slice(0, 8).map((row) => cardItem(row, 'PAUSED')) },
          { title: 'Keywords by conversions', items: keywords.slice(0, 8).map((row) => cardItem(row)) },
        ],
      };
    } catch (e) {
      return { ok: true, reply: friendlyChatError(e), used_openai: false, tool: 'account_audit' };
    }
  }

  if (wantsHeadlineSuggest(message)) {
    try {
      const [keywords, terms] = await Promise.all([
        runGoogleAdsTool('list_keywords', { status: 'ENABLED', during: 'LAST_7_DAYS', limit: 20 }),
        runGoogleAdsTool('list_search_terms', { during: 'LAST_7_DAYS', limit: 20 }),
      ]);
      const suggested = buildHeadlineSuggestions(
        (keywords as any)?.keywords || [],
        (terms as any)?.search_terms || [],
      );
      if (process.env.OPENAI_API_KEY) {
        const msg = await openaiChat([
          {
            role: 'system',
            content:
              'Write Google Ads RSA headlines from these live keywords/search terms. Max 30 characters each. 6 headlines only. Format:\nH1: ...\nH2: ...\nNo spend report. No ad list. Hindi+English mix OK.',
          },
          {
            role: 'user',
            content: `${message}\n\nWinners:\n${JSON.stringify(slimToolPayload('list_search_terms', terms)).slice(0, 1800)}\n${JSON.stringify(slimToolPayload('list_keywords', keywords)).slice(0, 1200)}`,
          },
        ], { tools: false });
        const raw = String(msg?.content || '').trim();
        if (raw && !/full briefing|spend ₹|ad copies:/i.test(raw)) {
          return { ok: true, reply: raw, used_openai: true, tool: 'suggest_headlines', cards: suggested.cards };
        }
      }
      return { ok: true, reply: suggested.reply, used_openai: false, tool: 'suggest_headlines', cards: suggested.cards };
    } catch (e) {
      return { ok: true, reply: friendlyChatError(e), used_openai: false, tool: 'suggest_headlines' };
    }
  }

  const reportPeriod = guessGoogleAdsReportPeriod(message);
  if (reportPeriod) {
    try {
      const campaigns = await listCampaigns({ status: 'ENABLED', during: 'LAST_30_DAYS', limit: 80 }).catch(() => []);
      const named = matchCampaign(message, campaigns);
      const report = await generateGoogleAdsReport(reportPeriod, { campaign_id: named?.id });
      return {
        ok: true,
        reply: reportReply(report),
        used_openai: false,
        tool: 'generate_report',
        report,
        cards: named
          ? {
              kind: 'campaigns',
              title: named.name,
              items: [
                {
                  name: named.name,
                  tags: [named.status, named.channel].filter(Boolean),
                  metrics: [
                    { label: 'Spend', value: inr(report.metrics?.spend || 0) },
                    { label: 'Conv', value: String(report.metrics?.conversions || 0) },
                    { label: 'Clicks', value: String(report.metrics?.clicks || 0) },
                    { label: 'CPL', value: report.metrics?.cpl != null ? inr(report.metrics.cpl) : '—' },
                  ],
                },
              ],
            }
          : null,
      };
    } catch (e) {
      return { ok: true, reply: friendlyChatError(e), used_openai: false, tool: 'generate_report' };
    }
  }

  const guessed = guessTool(message);
  const fallback = await runGoogleAdsTool(guessed.name, guessed.params).catch((e) => {
    throw new Error(friendlyChatError(e));
  });
  const copyAsk = wantsCopy(message);
  const attachCards = copyAsk || /campaign|keyword|search term|ad group|fund|billing/i.test(message);
  const cards = attachCards ? cardsFromTool(guessed.name, fallback) : null;
  const heuristic = copyAsk && Array.isArray((fallback as any)?.ads) ? keepTestPause((fallback as any).ads) : formatToolText(guessed.name, fallback);

  if (!process.env.OPENAI_API_KEY) {
    return { ok: true, reply: heuristic, used_openai: false, tool: guessed.name, cards };
  }

  const book = await getGoogleAdsPlaybook();
  const system = {
    role: 'system',
    content: `You are MyFNG Google Ads Advisor. Answer ONLY the current question.
Use tools for numbers. Never invent spend, clicks, or conversions.
Always mention Results + All conv., not only spend/clicks.
No markdown asterisks. No numbered dumps. Use short lines.
Do NOT list every paused campaign. Ignore ₹0 / 0-click rows unless asked.
If they ask which copy to run — call list_ads once, then ONLY this format:
Verdict: one sentence
KEEP: name — ₹ proof
TEST: name — why
PAUSE: name — why (omit if none)
NEXT COPY: one short headline
Never write "Ad copies:" or numbered headline dumps.
If they ask headlines from keywords — 6 RSA headlines (max 30 chars), no spend briefing.
If they name a campaign + report — generate_report with campaign_id.
Read-only: you cannot pause ads or change budget.
Playbook:
${playbookToPrompt(book)}
Hindi + English mix. Max 8 lines.`,
  };

  const messages: any[] = [system, ...history, { role: 'user', content: message }];
  let lastCards = cards;
  let lastTool = guessed.name;

  for (let i = 0; i < 4; i += 1) {
    let msg: any;
    try {
      msg = await openaiChat(messages);
    } catch (e) {
      return { ok: true, reply: `${heuristic}\n\n${friendlyChatError(e)}`, used_openai: false, tool: lastTool, cards: lastCards };
    }
    if (!msg) break;
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      const raw = String(msg.content || '').trim();
      const dumped = /ad copies:|^\s*\d+\.\s*Ad Name|Headlines:/i.test(raw);
      return {
        ok: true,
        reply: dumped ? heuristic : (raw || heuristic).replace(/\*\*/g, '').replace(/^#+\s*/gm, ''),
        used_openai: true,
        tool: lastTool,
        cards: dumped || copyAsk ? lastCards : attachCards ? lastCards : null,
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
      let payload: unknown;
      try {
        payload = await runGoogleAdsTool(name, params);
      } catch (e: any) {
        payload = { error: e?.message || 'Tool failed' };
      }
      const built = attachCards || name === 'list_ads' && copyAsk ? cardsFromTool(name, payload) : null;
      if (built) {
        lastCards = built;
        lastTool = name;
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(slimToolPayload(name, payload)).slice(0, 3500),
      });
    }
  }

  return { ok: true, reply: heuristic, used_openai: true, tool: lastTool, cards: lastCards };
}
