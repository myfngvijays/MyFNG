import type { UserLang } from '../types';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

const FAQ_STOPWORDS = new Set([
  'what',
  'why',
  'how',
  'which',
  'where',
  'when',
  'is',
  'are',
  'do',
  'does',
  'can',
  'you',
  'we',
  'i',
  'my',
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'please',
  'tell',
  'me',
  'and',
  'or',
  'so',
  'exactly',
  'work',
  'works',
  'hai',
  'kya',
  'ka',
  'ki',
  'ke',
  'mein',
  'me',
  'service',
]);

function normalizeForMatch(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/\bmyfng\b/g, 'my fng')
    .replace(/\bmy\s*fng\b/g, 'my fng')
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9\u0900-\u097F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(s: string) {
  return String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function extractBestAnswerFromChunk(userText: string, chunkText: string): string | null {
  const text = clean(chunkText);
  if (!text) return null;

  const sections: Array<{ q: string; a: string }> = [];
  const re = /###\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+|$)/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(text))) {
    const q = clean(m[1] || '');
    const a = clean(m[2] || '');
    if (q && a) sections.push({ q, a });
  }
  if (sections.length === 0) return null;

  const qNorm = normalizeForMatch(userText);
  const tokens = Array.from(
    new Set(
      qNorm
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !FAQ_STOPWORDS.has(t))
        .slice(0, 10)
    )
  );

  let best: { score: number; a: string } | null = null;
  for (const s of sections) {
    const qq = normalizeForMatch(s.q);
    if (!qq) continue;
    let score = 0;
    for (const t of tokens) if (qq.includes(t)) score += 1;
    if (qq.includes(qNorm) || qNorm.includes(qq)) score += 4;
    if (!best || score > best.score) best = { score, a: s.a };
  }
  if (!best) return null;
  if (best.score < 1 && tokens.length >= 2) return null;
  return best.a;
}

function getAdminDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Small in-memory caches (server process)
const manualCache = new Map<string, string>();
const vectorCache = new Map<string, string>();

export async function answerFromFaqOrKb(params: { userText: string; lang: UserLang }): Promise<string | null> {
  const q = String(params.userText || '').trim();
  if (!q) return null;

  const cacheKey = `${params.lang}:${normalizeForMatch(q)}`;
  if (manualCache.has(cacheKey)) return manualCache.get(cacheKey) || null;
  if (vectorCache.has(cacheKey)) return vectorCache.get(cacheKey) || null;

  const db = getAdminDb();
  if (!db) return null;

  // 1) manual FAQs: token overlap AND
  const qNorm = normalizeForMatch(q);
  const tokens = Array.from(
    new Set(
      qNorm
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !FAQ_STOPWORDS.has(t))
        .slice(0, 6)
    )
  );

  if (tokens.length > 0) {
    try {
      // Strong match: AND on up to 2-3 tokens (after stopwords)
      let qb = db.from('kb_manual_faqs_active').select('question, answer');
      for (const t of tokens.slice(0, 2)) qb = qb.ilike('question', `%${t}%`);
      const { data: andData } = await qb.limit(10);
      const andRows = (andData as any[]) || [];
      if (andRows.length === 1 && andRows[0]?.answer) {
        const ans = String(andRows[0].answer);
        if (manualCache.size > 300) manualCache.clear();
        manualCache.set(cacheKey, ans);
        return ans;
      }

      // Fuzzy: OR candidates + scoring (handles paraphrases like "how do you work?")
      const or = tokens.map((t) => `question.ilike.%${t}%`).join(',');
      const { data: orData } = await db.from('kb_manual_faqs_active').select('question, answer').or(or).limit(30);
      const rows = (orData as any[]) || [];
      if (rows.length > 0) {
        let best: { score: number; ans: string } | null = null;
        for (const r of rows) {
          const qq = normalizeForMatch(String(r?.question || ''));
          const ans = String(r?.answer || '');
          if (!qq || !ans) continue;
          let score = 0;
          for (const t of tokens) if (qq.includes(t)) score += 1;
          if (qq.includes(qNorm) || qNorm.includes(qq)) score += 4;
          if (qNorm.includes('my fng') && qq.includes('my fng')) score += 2;
          if (!best || score > best.score) best = { score, ans };
        }
        if (best && best.score >= 1) {
          if (manualCache.size > 300) manualCache.clear();
          manualCache.set(cacheKey, best.ans);
          return best.ans;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2) vector KB (semantic)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const embModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const embeddings = new OpenAIEmbeddings({ apiKey, model: embModel });

  try {
    const queryEmbedding = await embeddings.embedQuery(q);
    const { data } = await db.rpc('kb_search', { query_embedding: queryEmbedding, match_count: 10 });
    const rows = (data as any[]) || [];
    const chunks = rows
      .map((r) => ({ text: String(r?.chunk_text || ''), similarity: Number(r?.similarity || 0) }))
      .filter((c) => c.text && c.text.length >= 20)
      .slice(0, 5);
    const strong = chunks.filter((c) => c.similarity >= 0.72).slice(0, 3);
    for (const c of strong) {
      const ans = extractBestAnswerFromChunk(q, c.text);
      if (ans) {
        if (vectorCache.size > 300) vectorCache.clear();
        vectorCache.set(cacheKey, ans);
        return ans;
      }
    }
  } catch {
    return null;
  }

  return null;
}


