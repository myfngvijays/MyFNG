import { META_ADS_TOOLS, runMetaAdsTool } from './tools';
import { generateMetaAdsReport, guessReportPeriod } from './report';
import { getMetaAdsPlaybook, playbookToPrompt } from './playbook';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

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
    return rows.length ? `Active campaigns:\n${rows.join('\n')}` : 'Koi campaign nahi mili.';
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

function guessTool(message: string): { name: string; params: Record<string, unknown> } {
  const q = message.toLowerCase();
  if (/fund|due|balance|wallet|kitna bacha|payment|cap/.test(q)) {
    return { name: 'get_funds_tracker', params: {} };
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

  if (!process.env.OPENAI_API_KEY) {
    const guessed = guessTool(message);
    const result = await runMetaAdsTool(guessed.name, guessed.params);
    return {
      ok: true,
      reply: formatToolText(guessed.name, result),
      used_openai: false,
      tool: guessed.name,
    };
  }

  const book = await getMetaAdsPlaybook();
  const system = {
    role: 'system',
    content: `You are MyFNG Ads Advisor — Claude-style: recommend, then prove with live Meta numbers.
Never dump creatives without a Keep / Test / Pause call.
Use tools for every number. Never invent spend, chats, or CTR.
Saved ad account is already connected — leave account_id blank unless user gives another act_ id.
If they name a campaign, list_campaigns then get_ad_performance with that campaign_id.
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
Then at most 4 ads:
1) Ad name
Spend: ₹x
Clicks: n
CTR: n%
Results: n
Headline: ...
Hindi + English mix. Short.`,
  };

  const messages: any[] = [system, ...history, { role: 'user', content: message }];

  for (let i = 0; i < 4; i += 1) {
    const msg = await openaiChat(messages);
    if (!msg) break;
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      return {
        ok: true,
        reply: String(msg.content || '').trim() || 'Meta se data nahi mila.',
        used_openai: true,
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
        payload = await runMetaAdsTool(name, params);
      } catch (e: any) {
        payload = { error: e?.message || 'Tool failed' };
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(payload).slice(0, 8000),
      });
    }
  }

  const guessed = guessTool(message);
  const result = await runMetaAdsTool(guessed.name, guessed.params);
  return {
    ok: true,
    reply: formatToolText(guessed.name, result),
    used_openai: true,
    tool: guessed.name,
  };
}
