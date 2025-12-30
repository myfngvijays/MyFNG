import type { ChatbotV2Context, UserLang } from '../types';
import crypto from 'node:crypto';

type ReplyLanguageHint = 'en' | 'hi_latn' | 'hi_deva' | 'mixed' | 'unknown';

function normalize(text: string) {
  return String(text || '').toLowerCase().trim();
}

function detectReplyLanguageHint(text: string): ReplyLanguageHint {
  const t = String(text || '');

  // Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(t)) return 'hi_deva';

  const low = t.toLowerCase();
  const hasEnglish = /[a-z]/.test(low);
  const hasHinglish = /\b(kya|kyu|kyun|kaise|kitna|karna|karao|chahiye|batao|pickup|workshop|gaadi|gadi|price|cost)\b/.test(low);

  if (hasEnglish && hasHinglish) return 'mixed';
  if (hasHinglish) return 'hi_latn';
  if (hasEnglish) return 'en';
  return 'unknown';
}

export function pickUserLang(context: ChatbotV2Context, userText: string): UserLang {
  const pref = (context?.preferredLanguage || 'auto') as string;
  if (pref === 'en' || pref === 'hi' || pref === 'hinglish') return pref;

  const hint = detectReplyLanguageHint(userText);
  if (hint === 'hi_deva') return 'hi';
  if (hint === 'en') return 'en';
  return 'hinglish';
}

export function clampLines(text: string, maxLines = 5) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(0, maxLines).join('\n');
}

export async function rewritePreservingFacts(params: { userText: string; answerFacts: string; lang: UserLang }) {
  const base = String(params.answerFacts || '').trim();
  if (!base) return base;

  const cacheKey = `${params.lang}:${crypto.createHash('sha1').update(base, 'utf8').digest('hex')}`;
  (globalThis as any).__myfng_rewrite_cache = (globalThis as any).__myfng_rewrite_cache || new Map<string, string>();
  const cache = (globalThis as any).__myfng_rewrite_cache as Map<string, string>;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return base;

  // If user asked in Devanagari, force Hindi script; for hinglish keep Roman.
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const sys = `You are MY FNG AI Assistant.

Rewrite the answer into the user's language and a friendly human tone.
Rules:
- Preserve ALL facts from "Answer Facts". Do NOT add new info.
- Keep it short (max 3-5 short lines).
- No corporate tone. No robotic phrasing.
- Do NOT mention sources, databases, or chunks.
- Output ONLY the rewritten answer.`;

  const user = `target_language: ${params.lang}

User message:
${params.userText}

Answer Facts (must preserve):
${base}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return base;
    const json = (await res.json().catch(() => null)) as any;
    const out = json?.choices?.[0]?.message?.content;
    if (!out || typeof out !== 'string') return base;
    const finalText = clampLines(out.trim(), 5);
    cache.set(cacheKey, finalText);
    return finalText;
  } catch {
    return base;
  }
}


