import { classifySitePagePath, listSitePageSitemapEntries, SITE_PAGE_SEO_TABLE, sortSitePageSeoRows, mapSitePageSeoRow } from '@/lib/site-page-seo';
import { listBlogSeoSummaries } from '@/lib/blog/seo';
import { buildLiveFileAdminViews } from '@/lib/site-seo-live-files';
import {
  buildTechnicalSeoOverview,
  getSiteTechnicalSeo,
  SITE_TECHNICAL_SEO_TABLE,
} from '@/lib/site-technical-seo';
import { listPublishedWorkshopSeoSummaries, listWorkshopSitemapEntries, listBlogSitemapEntries } from '@/lib/workshop-page-seo';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type SeoHealthIssue = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  tab?: string;
};

function analyzePageHealth(rows: ReturnType<typeof mapSitePageSeoRow>[]) {
  const issues: SeoHealthIssue[] = [];
  let longTitles = 0;
  let longDescriptions = 0;
  let missingMeta = 0;
  let noindexPages = 0;
  let inactivePages = 0;

  for (const row of rows) {
    if (!row.active) inactivePages += 1;
    if (row.noindex) noindexPages += 1;
    if (!row.title.trim() || !row.description.trim()) missingMeta += 1;
    if (row.title.length > 60) longTitles += 1;
    if (row.description.length > 160) longDescriptions += 1;
  }

  if (missingMeta) {
    issues.push({ severity: 'error', message: `${missingMeta} managed page(s) missing title or description`, tab: 'all' });
  }
  if (longTitles) {
    issues.push({ severity: 'warning', message: `${longTitles} page(s) have meta title over 60 characters`, tab: 'all' });
  }
  if (longDescriptions) {
    issues.push({ severity: 'warning', message: `${longDescriptions} page(s) have meta description over 160 characters`, tab: 'all' });
  }
  if (noindexPages) {
    issues.push({ severity: 'info', message: `${noindexPages} managed page(s) set to noindex`, tab: 'all' });
  }
  if (inactivePages) {
    issues.push({ severity: 'info', message: `${inactivePages} managed page(s) marked inactive`, tab: 'all' });
  }

  const serviceCount = rows.filter((row) => classifySitePagePath(row.page_path) === 'service').length;
  const cityCount = rows.filter((row) => classifySitePagePath(row.page_path) === 'city').length;
  if (serviceCount === 0) {
    issues.push({ severity: 'warning', message: 'No service pages seeded in site_page_seo', tab: 'service' });
  }
  if (cityCount === 0) {
    issues.push({ severity: 'warning', message: 'No city landing pages seeded in site_page_seo', tab: 'city' });
  }

  return { issues, longTitles, longDescriptions, missingMeta, noindexPages, inactivePages, serviceCount, cityCount };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const [
      pagesRes,
      technicalSettings,
      workshops,
      blogs,
      liveFiles,
      siteSitemap,
      workshopSitemap,
      blogSitemap,
      technicalTable,
    ] = await Promise.all([
      supabaseAdmin.from(SITE_PAGE_SEO_TABLE).select('*').order('display_order', { ascending: true }),
      getSiteTechnicalSeo(),
      listPublishedWorkshopSeoSummaries(),
      listBlogSeoSummaries(),
      buildLiveFileAdminViews(),
      listSitePageSitemapEntries(),
      listWorkshopSitemapEntries(),
      listBlogSitemapEntries(),
      supabaseAdmin.from(SITE_TECHNICAL_SEO_TABLE).select('config_key').maybeSingle(),
    ]);

    if (pagesRes.error) {
      return NextResponse.json({ error: 'Failed to load SEO overview', details: pagesRes.error.message }, { status: 500 });
    }

    const rows = sortSitePageSeoRows((pagesRes.data || []).map(mapSitePageSeoRow));
    const health = analyzePageHealth(rows);

    const workshopsNoindex = workshops.filter((row) => row.noindex).length;
    const blogsNoindex = blogs.filter((row) => !row.indexable).length;
    const liveFilesCustom = liveFiles.filter((file) => file.use_custom).length;

    const googleVerified = Boolean(
      technicalSettings.google_verification.trim() || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim(),
    );
    const bingVerified = Boolean(
      technicalSettings.bing_verification.trim() || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim(),
    );

    const issues = [...health.issues];
    if (!googleVerified) {
      issues.unshift({ severity: 'warning', message: 'Google Search Console verification not configured', tab: 'technical' });
    }
    if (workshopsNoindex) {
      issues.push({ severity: 'info', message: `${workshopsNoindex} workshop page(s) set to noindex`, tab: 'workshop' });
    }
    if (blogsNoindex) {
      issues.push({ severity: 'info', message: `${blogsNoindex} blog post(s) excluded from sitemap (noindex)`, tab: 'blog' });
    }
    if (!technicalTable.data) {
      issues.unshift({ severity: 'error', message: 'Technical SEO settings row missing — run migration 273', tab: 'technical' });
    }

    const staticCount = rows.filter((row) => classifySitePagePath(row.page_path) === 'static').length;
    const overviewLinks = buildTechnicalSeoOverview({
      site_pages: siteSitemap.length,
      workshops: workshopSitemap.length,
      blogs: blogSitemap.length,
    });

    const attentionPages = rows
      .filter((row) => row.active && (!row.title.trim() || !row.description.trim() || row.title.length > 60 || row.description.length > 160))
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        page_label: row.page_label,
        page_path: row.page_path,
        title_length: row.title.length,
        description_length: row.description.length,
        noindex: row.noindex,
      }));

    const healthScore = Math.max(
      0,
      100 -
        health.missingMeta * 15 -
        health.longTitles * 4 -
        health.longDescriptions * 3 -
        (googleVerified ? 0 : 10) -
        (health.serviceCount === 0 ? 8 : 0) -
        (health.cityCount === 0 ? 8 : 0),
    );

    return NextResponse.json({
      data: {
        health_score: healthScore,
        issues,
        counts: {
          managed_total: rows.length,
          static_pages: staticCount,
          service_pages: health.serviceCount,
          city_pages: health.cityCount,
          workshops_total: workshops.length,
          workshops_noindex: workshopsNoindex,
          blogs_total: blogs.length,
          blogs_noindex: blogsNoindex,
          sitemap_total: overviewLinks.url_counts.total,
          pages_noindex: health.noindexPages,
          pages_inactive: health.inactivePages,
          live_files_custom: liveFilesCustom,
        },
        verification: {
          google: googleVerified,
          bing: bingVerified,
        },
        links: overviewLinks,
        attention_pages: attentionPages,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
