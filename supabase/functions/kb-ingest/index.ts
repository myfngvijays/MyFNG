// Supabase Edge Function: kb-ingest
// - Reads KB sources from public.kb_sources (table + url)
// - Upserts into public.kb_documents
// - Chunks into public.kb_chunks
// - Generates embeddings via OpenAI text-embedding-3-small
//
// Env required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - OPENAI_API_KEY
// Optional:
// - OPENAI_EMBEDDING_MODEL (default: text-embedding-3-small)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.49/deno-dom-wasm.ts';

type KbSourceRow = {
  id: string;
  source_type: 'table' | 'url';
  source_key: string;
  title: string;
  config: any;
  is_active: boolean;
};

function mustEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeText(s: string) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) return normalizeText(html.replace(/<[^>]*>/g, ' '));
    // Remove script/style
    doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
    const text = doc.body?.textContent || doc.textContent || '';
    return normalizeText(text);
  } catch {
    return normalizeText(html.replace(/<[^>]*>/g, ' '));
  }
}

function chunkText(text: string, maxChars = 2200, overlapChars = 250) {
  const t = normalizeText(text);
  if (!t) return [];
  const parts = t.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = '';

  const pushBuf = () => {
    const out = buf.trim();
    if (out) chunks.push(out);
    buf = '';
  };

  for (const p of parts) {
    if (!buf) {
      buf = p;
      continue;
    }
    if ((buf.length + 2 + p.length) <= maxChars) {
      buf = `${buf}\n\n${p}`;
    } else {
      pushBuf();
      // overlap: carry last overlapChars from previous chunk into next
      const carry = chunks.length ? chunks[chunks.length - 1].slice(-overlapChars) : '';
      buf = carry ? `${carry}\n\n${p}` : p;
    }
  }
  pushBuf();

  // Cap tiny chunks by merging
  const merged: string[] = [];
  for (const c of chunks) {
    if (merged.length === 0) merged.push(c);
    else if (c.length < 200) merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${c}`.trim();
    else merged.push(c);
  }
  return merged;
}

async function openAiEmbed(apiKey: string, inputs: string[], model: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings failed: ${res.status} ${res.statusText} ${txt}`);
  }
  const json = await res.json();
  const data = json?.data || [];
  // preserve order by index
  const vectors = data.sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0)).map((d: any) => d.embedding);
  return vectors as number[][];
}

async function fetchSourceDocument(db: any, src: KbSourceRow): Promise<{ docType: string; language: string; text: string; meta: any }> {
  if (src.source_type === 'url') {
    const url = String(src.config?.url || src.source_key);
    const extraHeaders = (src.config?.headers && typeof src.config.headers === 'object') ? src.config.headers : {};
    // Some sites block non-browser user agents. Use browser-like headers by default.
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyFNG-KB-Ingest/1.0; +https://myfng.in)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...extraHeaders,
      },
    });
    if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
    const html = await res.text();
    const text = htmlToText(html);
    return {
      docType: String(src.config?.doc_type || 'web'),
      language: String(src.config?.language || 'mixed'),
      text,
      meta: { url, source_type: 'url' },
    };
  }

  // table source
  const table = String(src.config?.table || '');
  const idCol = String(src.config?.id_column || 'id');
  const titleCol = String(src.config?.title_column || 'title');
  const contentCol = String(src.config?.content_column || 'content');
  const limit = Number(src.config?.limit || 500);

  if (!table) throw new Error(`kb_sources(${src.source_key}) missing config.table`);

  const { data, error } = await db.from(table).select(`${idCol}, ${titleCol}, ${contentCol}`).limit(limit);
  if (error) throw new Error(`Table fetch failed: ${table} ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  const lines: string[] = [];
  for (const r of rows) {
    const rid = r?.[idCol];
    const ttl = r?.[titleCol];
    const body = r?.[contentCol];
    const piece = normalizeText(`${ttl || ''}\n\n${body || ''}`);
    if (!piece) continue;
    lines.push(`### ${String(ttl || rid || 'Item')}\n${piece}`);
  }

  return {
    docType: String(src.config?.doc_type || 'table'),
    language: String(src.config?.language || 'mixed'),
    text: lines.join('\n\n'),
    meta: { table, source_type: 'table' },
  };
}

async function upsertDocument(db: any, params: { title: string; docType: string; source: string; language: string; hash: string }) {
  const { data, error } = await db
    .from('kb_documents')
    .upsert({
      title: params.title,
      doc_type: params.docType,
      source: params.source,
      language: params.language,
      source_hash: params.hash,
      is_active: true,
      updated_at: nowIso(),
    }, { onConflict: 'source' })
    .select('id, source_hash')
    .single();
  if (error) throw new Error(`Upsert kb_documents failed: ${error.message}`);
  return data as { id: string; source_hash: string | null };
}

async function replaceChunks(db: any, params: { documentId: string; chunks: Array<{ text: string; embedding: number[]; metadata: any }> }) {
  // Delete old chunks
  await db.from('kb_chunks').delete().eq('document_id', params.documentId);

  const rows = params.chunks.map((c, i) => ({
    document_id: params.documentId,
    chunk_index: i,
    chunk_text: c.text,
    embedding: c.embedding,
    metadata: c.metadata || {},
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
  const { error } = await db.from('kb_chunks').insert(rows);
  if (error) throw new Error(`Insert kb_chunks failed: ${error.message}`);
}

async function hasAnyEmbeddedChunks(db: any, documentId: string): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('kb_chunks')
      .select('id')
      .eq('document_id', documentId)
      // treat as "complete" only if at least one embedding exists
      .not('embedding', 'is', null)
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function setSourceRun(db: any, srcId: string, patch: { status: string; error?: string | null }) {
  await db
    .from('kb_sources')
    .update({
      last_run_at: nowIso(),
      last_run_status: patch.status,
      last_run_error: patch.error || null,
      updated_at: nowIso(),
    })
    .eq('id', srcId);
}

async function ingestOne(db: any, openAiKey: string, embedModel: string, src: KbSourceRow) {
  const fetched = await fetchSourceDocument(db, src);
  const text = normalizeText(fetched.text);
  const hash = await sha256Hex(text);

  // Check if unchanged
  const { data: existing } = await db
    .from('kb_documents')
    .select('id, source_hash')
    .eq('source', src.source_key)
    .maybeSingle();

  // Only skip when content is unchanged AND we already have embedded chunks.
  // This prevents a "stuck skipped" state if a previous run failed after saving source_hash
  // but before embeddings/chunks were stored (e.g., OpenAI quota error).
  if (existing?.id && existing?.source_hash && String(existing.source_hash) === hash) {
    const ok = await hasAnyEmbeddedChunks(db, existing.id);
    if (ok) {
    await setSourceRun(db, src.id, { status: 'skipped_unchanged' });
    return { status: 'skipped', source: src.source_key };
    }
  }

  const doc = await upsertDocument(db, {
    title: src.title,
    docType: fetched.docType,
    source: src.source_key,
    language: fetched.language,
    hash,
  });

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await setSourceRun(db, src.id, { status: 'no_content' });
    return { status: 'no_content', source: src.source_key };
  }

  // Embed in batches (OpenAI supports array input)
  const embedded: Array<{ text: string; embedding: number[]; metadata: any }> = [];
  const batchSize = 64;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);
    const vectors = await openAiEmbed(openAiKey, slice, embedModel);
    for (let j = 0; j < slice.length; j++) {
      embedded.push({
        text: slice[j],
        embedding: vectors[j],
        metadata: {
          ...fetched.meta,
          doc_type: fetched.docType,
          language: fetched.language,
          source_key: src.source_key,
          chunk: i + j,
        },
      });
    }
  }

  await replaceChunks(db, { documentId: doc.id, chunks: embedded });
  await setSourceRun(db, src.id, { status: 'ok' });
  return { status: 'ok', source: src.source_key, chunks: embedded.length };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    const supabaseUrl = mustEnv('SUPABASE_URL');
    const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = mustEnv('OPENAI_API_KEY');
    const embedModel = Deno.env.get('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: sources, error } = await db
      .from('kb_sources')
      .select('id, source_type, source_key, title, config, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Read kb_sources failed: ${error.message}`);

    const results: any[] = [];
    for (const src of (sources as any as KbSourceRow[]) || []) {
      try {
        const r = await ingestOne(db, openAiKey, embedModel, src);
        results.push({ ...r });
      } catch (e: any) {
        await setSourceRun(db, src.id, { status: 'error', error: e?.message || 'unknown' });
        results.push({ status: 'error', source: src.source_key, error: e?.message || 'unknown' });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});


