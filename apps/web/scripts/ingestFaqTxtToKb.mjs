import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function envOr(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return '';
}

function nowIso() {
  return new Date().toISOString();
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}

function toVectorLiteral(vec) {
  if (!Array.isArray(vec)) return null;
  // pgvector accepts: '[1,2,3]' string literal
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;
}

function normalizeText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapAsJsonArray(raw) {
  const t = String(raw || '').trim();
  if (!t) throw new Error('faq.txt is empty');
  if (t.startsWith('[')) return t;
  // Your file is a sequence of JSON objects separated by commas, just missing the surrounding [].
  const cleaned = t.replace(/,\s*$/, '');
  return `[\n${cleaned}\n]`;
}

function prefixCategory(category, question) {
  const c = normalizeText(category);
  const q = normalizeText(question);
  if (!q) return '';
  if (!c) return q;
  const lower = q.toLowerCase();
  if (lower.startsWith(`${c.toLowerCase()}:`)) return q;
  return `${c}: ${q}`;
}

async function upsertKbDocument(supabase, { title, docType, source, language, sourceHash }) {
  const { data, error } = await supabase
    .from('kb_documents')
    .upsert(
      {
        title,
        doc_type: docType,
        source,
        language,
        source_hash: sourceHash,
        is_active: true,
        updated_at: nowIso(),
      },
      { onConflict: 'source' }
    )
    .select('id')
    .single();

  if (error) throw new Error(`kb_documents upsert failed: ${error.message}`);
  return data;
}

async function replaceKbChunks(supabase, documentId, chunkRows) {
  // clear old
  const { error: delErr } = await supabase.from('kb_chunks').delete().eq('document_id', documentId);
  if (delErr) throw new Error(`kb_chunks delete failed: ${delErr.message}`);

  // insert new (in batches)
  const batchSize = 200;
  for (let i = 0; i < chunkRows.length; i += batchSize) {
    const slice = chunkRows.slice(i, i + batchSize);
    const { error } = await supabase.from('kb_chunks').insert(slice);
    if (error) throw new Error(`kb_chunks insert failed: ${error.message}`);
  }
}

async function main() {
  const SUPABASE_URL = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');

  const SUPABASE_SERVICE_ROLE_KEY = envOr('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

  const OPENAI_API_KEY = mustEnv('OPENAI_API_KEY');
  const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  const UPSERT_MANUAL_FAQS = String(process.env.UPSERT_MANUAL_FAQS || 'true').toLowerCase() !== 'false';
  const KB_SOURCE = normalizeText(process.env.KB_SOURCE || 'manual:faq_txt_v1') || 'manual:faq_txt_v1';
  const KB_TITLE = normalizeText(process.env.KB_TITLE || 'Manual FAQs (faq.txt)') || 'Manual FAQs (faq.txt)';
  const KB_LANGUAGE = normalizeText(process.env.KB_LANGUAGE || 'mixed') || 'mixed';

  // Prefer CWD (script is intended to be run from apps/web). Fallback to script-relative.
  const faqPathCwd = path.resolve(process.cwd(), 'faq.txt');
  const faqPathRel = path.resolve(__dirname, '..', 'faq.txt');
  let raw = '';
  try {
    raw = await fs.readFile(faqPathCwd, 'utf8');
  } catch {
    raw = await fs.readFile(faqPathRel, 'utf8');
  }
  const jsonText = wrapAsJsonArray(raw);

  let rows;
  try {
    rows = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`faq.txt is not parseable JSON. Expected objects separated by commas. Details: ${e?.message || e}`);
  }
  if (!Array.isArray(rows)) throw new Error('faq.txt must be a list/array');

  const faqs = rows
    .map((r) => {
      const category = normalizeText(r?.category || '');
      const questionRaw = normalizeText(r?.question || '');
      const answer = normalizeText(r?.answer || '');
      const question = prefixCategory(category, questionRaw);
      if (!question || !answer) return null;
      return { category: category || null, question, answer };
    })
    .filter(Boolean);

  if (faqs.length === 0) throw new Error('No valid FAQs found in faq.txt');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (UPSERT_MANUAL_FAQS) {
    const upserts = faqs.map((f) => ({
      question: f.question,
      answer: f.answer,
      is_active: true,
      updated_at: nowIso(),
    }));

    const { error } = await supabase.from('kb_manual_faqs').upsert(upserts, { onConflict: 'question' });
    if (error) throw new Error(`kb_manual_faqs upsert failed: ${error.message}`);
  }

  // Build one KB document containing all FAQs (simple + fast for retrieval).
  // Each Q/A will become one or more chunks depending on size.
  const combinedText = faqs.map((f) => `### ${f.question}\n${f.answer}`).join('\n\n');
  const sourceHash = sha256Hex(combinedText);

  const docRow = await upsertKbDocument(supabase, {
    title: KB_TITLE,
    docType: 'faq',
    source: KB_SOURCE,
    language: KB_LANGUAGE,
    sourceHash,
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.KB_CHUNK_SIZE || 1200),
    chunkOverlap: Number(process.env.KB_CHUNK_OVERLAP || 150),
  });

  const docs = await splitter.createDocuments([combinedText], [
    { source: KB_SOURCE, title: KB_TITLE, doc_type: 'faq', language: KB_LANGUAGE },
  ]);

  const chunkTexts = docs.map((d) => normalizeText(d.pageContent)).filter(Boolean);
  if (chunkTexts.length === 0) throw new Error('Chunking produced 0 chunks');

  const embeddings = new OpenAIEmbeddings({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_EMBEDDING_MODEL,
  });

  const vectors = await embeddings.embedDocuments(chunkTexts);
  if (!Array.isArray(vectors) || vectors.length !== chunkTexts.length) {
    throw new Error(`Embedding count mismatch: got ${vectors?.length || 0}, expected ${chunkTexts.length}`);
  }

  const rowsToInsert = chunkTexts.map((text, idx) => ({
    document_id: docRow.id,
    chunk_index: idx,
    chunk_text: text,
    embedding: toVectorLiteral(vectors[idx]),
    metadata: {
      source: KB_SOURCE,
      title: KB_TITLE,
      doc_type: 'faq',
      language: KB_LANGUAGE,
      chunk: idx,
      faqs: faqs.length,
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  }));

  await replaceKbChunks(supabase, docRow.id, rowsToInsert);

  console.log(
    JSON.stringify(
      {
        ok: true,
        faqCount: faqs.length,
        documentId: docRow.id,
        chunks: rowsToInsert.length,
        source: KB_SOURCE,
        upsertedIntoKbManualFaqs: UPSERT_MANUAL_FAQS,
        embeddingModel: OPENAI_EMBEDDING_MODEL,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error('[kb ingest] failed:', e?.message || e);
  process.exit(1);
});


