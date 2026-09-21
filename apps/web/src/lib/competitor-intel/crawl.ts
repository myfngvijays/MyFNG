import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { buildAioGapsFromClaims } from '@/lib/competitor-intel/aioGaps';
import {
  fetchPublicHtml,
  isDisallowedPath,
  normalizeCompetitorUrl,
  parseCompetitorHtml,
  parseRobotsDisallow,
  parseSitemapLocs,
  sleep,
} from '@/lib/competitor-intel/extract';
import {
  COMPETITOR_TABLES as T,
  isMissingTableError,
  type AioClaim,
  type CompetitorRow,
} from '@/lib/competitor-intel/types';

const MAX_PAGES = 28;
const DELAY_MS = 450;
const SNAPSHOT_KEEP_DAYS = 30;

type CrawlResult = {
  success: boolean;
  missing?: boolean;
  stopped?: boolean;
  competitor_id?: string;
  run_id?: string;
  checked_url?: string;
  page?: Record<string, any> | null;
  pages_scanned: number;
  new_pages: number;
  changed_pages: number;
  keywords_upserted: number;
  error?: string;
};

export type CrawlOptions = {
  onlyUrl?: string;
};

async function isCrawlStopRequested(client: any, runId: string) {
  const { data } = await client.from(T.runs).select('status').eq('id', runId).maybeSingle();
  return data?.status === 'cancelling' || data?.status === 'cancelled';
}

export async function requestStopCrawl(competitorId: string) {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, error: adminError || 'Database not configured' };
  }
  const { data, error } = await supabaseAdmin
    .from(T.runs)
    .update({ status: 'cancelling', error: 'Stop requested' })
    .eq('competitor_id', competitorId)
    .in('status', ['running', 'cancelling'])
    .select('id, status');
  if (isMissingTableError(error)) {
    return { ok: false, missing: true, error: 'Run database/371_competitor_intel.sql' };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true, stopping: (data || []).length > 0, run_ids: (data || []).map((row: { id: string }) => row.id) };
}

function resolveOnlyUrl(raw: string, origin: string) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { error: 'Enter a public URL or path to check.' };
  const candidate = trimmed.startsWith('/')
    ? `${origin}${trimmed}`
    : trimmed.includes('://')
      ? trimmed
      : `https://${trimmed}`;
  const normalized = normalizeCompetitorUrl(candidate, origin);
  if (!normalized) {
    return { error: 'URL must be a public page on this competitor’s domain. Login /ops /api paths are blocked.' };
  }
  if (isDisallowedPath(new URL(normalized).pathname)) {
    return { error: 'That path is blocked (private / ops / API).' };
  }
  return { url: normalized };
}

function clip(value: string | null | undefined, max = 800) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function loadQueue(row: CompetitorRow) {
  const origin = row.website_url.replace(/\/+$/, '');
  const extraDisallow: RegExp[] = [];
  const queue: string[] = [];
  const push = (raw: string) => {
    const url = normalizeCompetitorUrl(raw, origin);
    if (!url) return;
    const path = new URL(url).pathname;
    if (isDisallowedPath(path, extraDisallow)) return;
    if (!queue.includes(url)) queue.push(url);
  };

  for (const path of row.seed_paths?.length ? row.seed_paths : ['/']) {
    push(`${origin}${path.startsWith('/') ? path : `/${path}`}`);
  }

  try {
    const robots = await fetchPublicHtml(`${origin}/robots.txt`, 8000);
    if (robots.ok) extraDisallow.push(...parseRobotsDisallow(robots.body));
  } catch {
    // public robots is optional
  }

  try {
    const sitemap = await fetchPublicHtml(`${origin}/sitemap.xml`, 8000);
    if (sitemap.ok && /<urlset|<sitemapindex/i.test(sitemap.body)) {
      parseSitemapLocs(sitemap.body, origin, 40).forEach(push);
    }
  } catch {
    // CarYaar sitemap currently 500 — homepage discovery still works
  }

  return { origin, queue, extraDisallow };
}

export async function crawlCompetitor(competitorId: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, pages_scanned: 0, new_pages: 0, changed_pages: 0, keywords_upserted: 0, error: adminError || 'Database not configured' };
  }

  const { data: competitor, error: loadError } = await supabaseAdmin
    .from(T.competitors)
    .select('*')
    .eq('id', competitorId)
    .maybeSingle();

  if (isMissingTableError(loadError)) {
    return { success: false, missing: true, pages_scanned: 0, new_pages: 0, changed_pages: 0, keywords_upserted: 0, error: 'Run database/371_competitor_intel.sql' };
  }
  if (loadError || !competitor) {
    return { success: false, pages_scanned: 0, new_pages: 0, changed_pages: 0, keywords_upserted: 0, error: loadError?.message || 'Competitor not found' };
  }

  const row = competitor as CompetitorRow;
  const { data: runInsert, error: runError } = await supabaseAdmin
    .from(T.runs)
    .insert({ competitor_id: row.id, status: 'running' })
    .select('id')
    .single();
  if (runError || !runInsert) {
    return { success: false, pages_scanned: 0, new_pages: 0, changed_pages: 0, keywords_upserted: 0, error: runError?.message || 'Could not start crawl' };
  }

  let pagesScanned = 0;
  let newPages = 0;
  let changedPages = 0;
  let keywordsUpserted = 0;
  let savedPage: Record<string, any> | null = null;
  const allClaims: AioClaim[] = [];

  try {
    const origin = row.website_url.replace(/\/+$/, '');
    let queue: string[] = [];
    let checkedUrl: string | undefined;

    if (options.onlyUrl) {
      const target = resolveOnlyUrl(options.onlyUrl, origin);
      if (target.error || !target.url) {
        await supabaseAdmin
          .from(T.runs)
          .update({
            finished_at: new Date().toISOString(),
            status: 'failed',
            error: target.error,
          })
          .eq('id', runInsert.id);
        return { success: false, competitor_id: row.id, run_id: runInsert.id, pages_scanned: 0, new_pages: 0, changed_pages: 0, keywords_upserted: 0, error: target.error };
      }
      checkedUrl = target.url;
      queue = [target.url];
    } else {
      const loaded = await loadQueue(row);
      queue = loaded.queue;
    }

    const seen = new Set<string>();

    while (queue.length && pagesScanned < MAX_PAGES) {
      if (await isCrawlStopRequested(supabaseAdmin, runInsert.id)) {
        await supabaseAdmin
          .from(T.runs)
          .update({
            finished_at: new Date().toISOString(),
            status: 'cancelled',
            pages_scanned: pagesScanned,
            new_pages: newPages,
            changed_pages: changedPages,
            keywords_upserted: keywordsUpserted,
            error: `Stopped after ${pagesScanned} page${pagesScanned === 1 ? '' : 's'}`,
          })
          .eq('id', runInsert.id);
        return {
          success: true,
          stopped: true,
          competitor_id: row.id,
          run_id: runInsert.id,
          checked_url: checkedUrl,
          pages_scanned: pagesScanned,
          new_pages: newPages,
          changed_pages: changedPages,
          keywords_upserted: keywordsUpserted,
          error: 'Scan stopped',
        };
      }

      const url = queue.shift() as string;
      if (seen.has(url)) continue;
      seen.add(url);

      if (pagesScanned > 0) await sleep(DELAY_MS);

      let fetched: Awaited<ReturnType<typeof fetchPublicHtml>>;
      try {
        fetched = await fetchPublicHtml(url);
      } catch (error: any) {
        if (options.onlyUrl) {
          const message = error?.message || `Could not fetch ${url}`;
          await supabaseAdmin
            .from(T.runs)
            .update({
              finished_at: new Date().toISOString(),
              status: 'failed',
              error: clip(message, 500),
            })
            .eq('id', runInsert.id);
          return {
            success: false,
            competitor_id: row.id,
            run_id: runInsert.id,
            checked_url: url,
            pages_scanned: 0,
            new_pages: 0,
            changed_pages: 0,
            keywords_upserted: 0,
            error: message,
          };
        }
        continue;
      }

      const parsed = parseCompetitorHtml(fetched.body || '', fetched.finalUrl || url, origin);
      if (options.onlyUrl) checkedUrl = parsed.url || fetched.finalUrl || url;
      pagesScanned += 1;
      allClaims.push(...parsed.aioClaims);

      if (!options.onlyUrl) {
        for (const link of parsed.links) {
          if (!seen.has(link) && !queue.includes(link) && seen.size + queue.length < MAX_PAGES + 8) {
            queue.push(link);
          }
        }
      }

      const now = new Date().toISOString();
      const { data: existing } = await supabaseAdmin
        .from(T.pages)
        .select('id, title, h1, meta_description, content_hash')
        .eq('competitor_id', row.id)
        .eq('url', parsed.url)
        .maybeSingle();

      const pagePayload = {
        competitor_id: row.id,
        url: parsed.url,
        path: parsed.path,
        title: clip(parsed.title, 240),
        h1: clip(parsed.h1, 240),
        meta_description: clip(parsed.metaDescription, 320),
        keywords: parsed.keywords,
        aio_claims: parsed.aioClaims,
        content_hash: parsed.contentHash,
        word_count: parsed.wordCount,
        http_status: fetched.status,
        last_seen_at: now,
        updated_at: now,
      };

      let pageId = existing?.id as string | undefined;
      if (!existing) {
        const { data: inserted, error: insertPageError } = await supabaseAdmin
          .from(T.pages)
          .insert({ ...pagePayload, first_seen_at: now, last_changed_at: now })
          .select('id')
          .single();
        if (insertPageError || !inserted) {
          if (options.onlyUrl) {
            await supabaseAdmin
              .from(T.runs)
              .update({ finished_at: new Date().toISOString(), status: 'failed', error: clip(insertPageError?.message || 'Could not save page', 500) })
              .eq('id', runInsert.id);
            return {
              success: false,
              competitor_id: row.id,
              run_id: runInsert.id,
              checked_url: parsed.url,
              pages_scanned: pagesScanned,
              new_pages: 0,
              changed_pages: 0,
              keywords_upserted: 0,
              error: insertPageError?.message || 'Could not save page',
            };
          }
          continue;
        }
        pageId = inserted.id;
        newPages += 1;
        await supabaseAdmin.from(T.changes).insert({
          competitor_id: row.id,
          page_id: pageId,
          change_type: 'new_page',
          field_name: 'url',
          after_value: parsed.url,
          url: parsed.url,
        });
      } else {
        const diffs: Array<{ field: string; before: string; after: string; type: string }> = [];
        if (String(existing.title || '') !== pagePayload.title) {
          diffs.push({ field: 'title', before: String(existing.title || ''), after: pagePayload.title, type: 'title' });
        }
        if (String(existing.h1 || '') !== pagePayload.h1) {
          diffs.push({ field: 'h1', before: String(existing.h1 || ''), after: pagePayload.h1, type: 'h1' });
        }
        if (String(existing.meta_description || '') !== pagePayload.meta_description) {
          diffs.push({ field: 'meta_description', before: String(existing.meta_description || ''), after: pagePayload.meta_description, type: 'meta' });
        }
        if (String(existing.content_hash || '') !== pagePayload.content_hash) {
          diffs.push({ field: 'content_hash', before: String(existing.content_hash || ''), after: pagePayload.content_hash, type: 'content' });
        }

        await supabaseAdmin
          .from(T.pages)
          .update(diffs.length ? { ...pagePayload, last_changed_at: now } : pagePayload)
          .eq('id', existing.id);

        if (diffs.length) {
          changedPages += 1;
          await supabaseAdmin.from(T.changes).insert(
            diffs.map((diff) => ({
              competitor_id: row.id,
              page_id: existing.id,
              change_type: diff.type,
              field_name: diff.field,
              before_value: clip(diff.before, 400),
              after_value: clip(diff.after, 400),
              url: parsed.url,
            })),
          );
        }
      }

      if (pageId && (!existing || existing.content_hash !== pagePayload.content_hash)) {
        await supabaseAdmin.from(T.snapshots).insert({
          page_id: pageId,
          competitor_id: row.id,
          title: pagePayload.title,
          h1: pagePayload.h1,
          meta_description: pagePayload.meta_description,
          keywords: parsed.keywords,
          aio_claims: parsed.aioClaims,
          content_hash: parsed.contentHash,
          word_count: parsed.wordCount,
        });
      }

      for (const keyword of parsed.keywords) {
        const { data: current } = await supabaseAdmin
          .from(T.keywords)
          .select('id, hit_count')
          .eq('competitor_id', row.id)
          .eq('keyword', keyword)
          .maybeSingle();
        if (current) {
          await supabaseAdmin
            .from(T.keywords)
            .update({ hit_count: Number(current.hit_count || 0) + 1, last_seen_at: now, source_url: parsed.url })
            .eq('id', current.id);
        } else {
          await supabaseAdmin.from(T.keywords).insert({
            competitor_id: row.id,
            keyword,
            source_url: parsed.url,
            hit_count: 1,
          });
        }
        keywordsUpserted += 1;
      }

      if (pageId) {
        const { data: stored } = await supabaseAdmin.from(T.pages).select('*').eq('id', pageId).maybeSingle();
        savedPage = stored || { id: pageId, ...pagePayload, headings: parsed.headings };
      }
    }

    for (const gap of buildAioGapsFromClaims(allClaims)) {
      const { data: existingGap } = await supabaseAdmin
        .from(T.aioGaps)
        .select('id, status, competitor_claim')
        .eq('competitor_id', row.id)
        .eq('dimension', gap.dimension)
        .maybeSingle();
      if (!existingGap) {
        await supabaseAdmin.from(T.aioGaps).insert({
          competitor_id: row.id,
          ...gap,
          status: 'open',
        });
        continue;
      }
      const claimChanged = String(existingGap.competitor_claim || '') !== gap.competitor_claim;
      await supabaseAdmin
        .from(T.aioGaps)
        .update({
          competitor_claim: gap.competitor_claim,
          myfng_counter: gap.myfng_counter,
          suggested_action: gap.suggested_action,
          status: claimChanged ? 'open' : existingGap.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingGap.id);
    }

    const cutoff = new Date(Date.now() - SNAPSHOT_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from(T.snapshots).delete().eq('competitor_id', row.id).lt('fetched_at', cutoff);

    await supabaseAdmin
      .from(T.runs)
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        pages_scanned: pagesScanned,
        new_pages: newPages,
        changed_pages: changedPages,
        keywords_upserted: keywordsUpserted,
      })
      .eq('id', runInsert.id);

    await supabaseAdmin.from(T.competitors).update({ updated_at: new Date().toISOString() }).eq('id', row.id);

    return {
      success: true,
      competitor_id: row.id,
      run_id: runInsert.id,
      checked_url: savedPage?.url || checkedUrl,
      page: savedPage,
      pages_scanned: pagesScanned,
      new_pages: newPages,
      changed_pages: changedPages,
      keywords_upserted: keywordsUpserted,
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    await supabaseAdmin
      .from(T.runs)
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        pages_scanned: pagesScanned,
        new_pages: newPages,
        changed_pages: changedPages,
        keywords_upserted: keywordsUpserted,
        error: clip(message, 500),
      })
      .eq('id', runInsert.id);
    return {
      success: false,
      competitor_id: row.id,
      run_id: runInsert.id,
      pages_scanned: pagesScanned,
      new_pages: newPages,
      changed_pages: changedPages,
      keywords_upserted: keywordsUpserted,
      error: message,
    };
  }
}

export async function crawlActiveCompetitors() {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, missing: false, results: [], error: adminError || 'Database not configured' };
  }

  const { data, error } = await supabaseAdmin
    .from(T.competitors)
    .select('id')
    .eq('active', true)
    .order('name');

  if (isMissingTableError(error)) {
    return { success: false, missing: true, results: [], error: 'Run database/371_competitor_intel.sql' };
  }
  if (error) {
    return { success: false, missing: false, results: [], error: error.message };
  }

  const results = [];
  for (const item of data || []) {
    results.push(await crawlCompetitor(item.id));
  }
  return {
    success: results.every((item) => item.success),
    missing: false,
    results,
  };
}
