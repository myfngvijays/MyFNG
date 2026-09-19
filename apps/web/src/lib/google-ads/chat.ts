import { getGoogleAdsPlaybook, playbookToPrompt } from './playbook';
import { generateGoogleAdsReport, guessGoogleAdsReportPeriod } from './report';
import { GOOGLE_ADS_TOOLS, runGoogleAdsTool } from './tools';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function inr(n: number, currency = 'INR') {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

function guessTool(message: string): { name: string; params: Record<string, unknown> } {
  const q = message.toLowerCase();
  if (/search term|query|search term/.test(q) || /kya search/.test(q)) return { name: 'list_search_terms', params: {} };
  if (/keyword/.test(q)) return { name: 'list_keywords', params: {} };
  if (/ad group|adgroup/.test(q)) return { name: 'list_ad_groups', params: {} };
  if (/copy|headline|kaunsi ad|which ad|ads compare/.test(q)) return { name: 'list_ads', params: { status: 'ENABLED' } };
  if (/campaign/.test(q)) return { name: 'list_campaigns', params: {} };
  return { name: 'get_spend_summary', params: {} };
}

function formatToolText(name: string, result: any): string {
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
  const rows = result?.campaigns || result?.ad_groups || result?.ads || result?.keywords || result?.search_terms;
  if (!Array.isArray(rows) || !rows.length) return null;
  return {
    kind: name,
    title: name.replace(/list_/, '').replace(/_/g, ' '),
    items: rows.slice(0, 8).map((row: any) => ({
      name: row.name || row.text,
      tags: [row.status, row.match, row.channel].filter(Boolean),
      headline: Array.isArray(row.headlines) ? row.headlines[0] : row.campaign,
      metrics: [
        { label: 'Spend', value: inr(row.spend) },
        { label: 'Conv', value: String(row.conversions || 0) },
        { label: 'CPL', value: row.cpl != null ? inr(row.cpl) : '—' },
        { label: 'Clicks', value: String(row.clicks || 0) },
      ],
    })),
  };
}

function keepTestPause(ads: any[]) {
  const pool = ads
    .filter((a) => /ENABLED/i.test(String(a.status || 'ENABLED')))
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
      model: process.env.OPENAI_META_ADS_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

export async function answerGoogleAdsChat(input: { message: string; history?: ChatTurn[] }) {
  const message = String(input.message || '').trim();
  if (!message) throw new Error('Type a question first.');
  const history = (input.history || []).slice(-8).map((m) => ({
    role: m.role,
    content: String(m.content || '').slice(0, 2000),
  }));

  const reportPeriod = guessGoogleAdsReportPeriod(message);
  if (reportPeriod) {
    const report = await generateGoogleAdsReport(reportPeriod);
    return { ok: true, reply: report.markdown, used_openai: false, tool: 'generate_report', report };
  }

  const guessed = guessTool(message);
  const fallback = await runGoogleAdsTool(guessed.name, guessed.params);
  const cards = cardsFromTool(guessed.name, fallback);
  const copyAsk = /copy|headline|kaunsi|which ad|compare|pause|scale/.test(message.toLowerCase());
  const heuristic = copyAsk && Array.isArray((fallback as any)?.ads) ? keepTestPause((fallback as any).ads) : formatToolText(guessed.name, fallback);

  if (!process.env.OPENAI_API_KEY) {
    return { ok: true, reply: heuristic, used_openai: false, tool: guessed.name, cards };
  }

  const book = await getGoogleAdsPlaybook();
  const system = {
    role: 'system',
    content: `You are MyFNG Google Ads Advisor. Recommend, then prove with live Google Ads numbers.
Use tools for every number. Never invent spend, conversions, or CTR.
If they ask which copy/ad to run — ALWAYS call list_ads.
Read-only: you cannot pause ads or change budget. Tell them to change Google Ads UI.
Playbook:
${playbookToPrompt(book)}

Never write a paragraph. One fact per line. No markdown asterisks.
Copy / which ad format:
Verdict: one sentence
KEEP: name — ₹ proof
TEST: name — why
PAUSE: name — why (omit if none)
NEXT COPY: short headline
Hindi + English mix. Short.`,
  };

  const messages: any[] = [system, ...history, { role: 'user', content: message }];
  let lastCards = cards;
  let lastTool = guessed.name;

  for (let i = 0; i < 4; i += 1) {
    const msg = await openaiChat(messages);
    if (!msg) break;
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      return {
        ok: true,
        reply: String(msg.content || '').trim() || heuristic,
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
      let payload: unknown;
      try {
        payload = await runGoogleAdsTool(name, params);
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

  return { ok: true, reply: heuristic, used_openai: true, tool: lastTool, cards: lastCards };
}
