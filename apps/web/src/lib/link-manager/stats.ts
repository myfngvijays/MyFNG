import type { SupabaseClient } from '@supabase/supabase-js';
import { detectLinkPlatform, linkEventSourceLabel } from '@/lib/link-manager/utils';

export type LinkManagerClickEvent = {
  id: string;
  created_at: string;
  event_type: string;
  platform: string;
  source: string;
  referrer: string | null;
  short_code: string | null;
  link_title: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
};

type RawClickRow = {
  id: string;
  created_at: string;
  event_type: string;
  referrer: string | null;
  user_agent?: string | null;
  meta: Record<string, unknown> | null;
  link: {
    short_code?: string | null;
    title?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
  } | null;
};

function pickUtm(
  meta: Record<string, unknown> | null | undefined,
  link: RawClickRow['link'],
  field: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content',
): string | null {
  const fromMeta = meta?.[field];
  if (fromMeta) return String(fromMeta);
  const fromLink = link?.[field];
  return fromLink ? String(fromLink) : null;
}

function normalizeClick(row: RawClickRow): LinkManagerClickEvent {
  const meta = row.meta || {};
  const link = row.link || null;
  const platform = meta.platform
    ? String(meta.platform)
    : detectLinkPlatform(row.user_agent);

  return {
    id: row.id,
    created_at: row.created_at,
    event_type: row.event_type,
    platform,
    source: meta.source ? String(meta.source).replace(/_/g, ' ') : linkEventSourceLabel(row.event_type),
    referrer: row.referrer,
    short_code: link?.short_code ? String(link.short_code) : null,
    link_title: link?.title ? String(link.title) : null,
    utm_source: pickUtm(meta, link, 'utm_source'),
    utm_medium: pickUtm(meta, link, 'utm_medium'),
    utm_campaign: pickUtm(meta, link, 'utm_campaign'),
    utm_term: pickUtm(meta, link, 'utm_term'),
    utm_content: pickUtm(meta, link, 'utm_content'),
  };
}

function aggregateUtmField(
  events: LinkManagerClickEvent[],
  field: 'utm_source' | 'utm_medium' | 'utm_campaign',
) {
  const map = new Map<string, number>();
  for (const event of events) {
    const value = event[field];
    if (!value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getLinkManagerStats(
  client: SupabaseClient,
  range: { start: string; end: string; preset: string; label: string },
) {
  const [links, clicksInRange, topLinks, recentClicks, qrInRange, utmLinks] = await Promise.all([
    client.from('managed_short_links').select('id,clicks,unique_clicks,qr_scans,is_active', { count: 'exact' }),
    client
      .from('managed_short_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'click')
      .gte('created_at', range.start)
      .lte('created_at', range.end),
    client
      .from('managed_short_links')
      .select('id,short_code,title,clicks,unique_clicks,qr_scans,long_url,utm_source,utm_medium,utm_campaign')
      .order('clicks', { ascending: false })
      .limit(5),
    client
      .from('managed_short_link_clicks')
      .select(
        'id,event_type,created_at,referrer,user_agent,meta,link:managed_short_links(short_code,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content)',
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(20),
    client
      .from('managed_short_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'qr_scan')
      .gte('created_at', range.start)
      .lte('created_at', range.end),
    client
      .from('managed_short_links')
      .select('id,short_code,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content,created_at')
      .or('utm_source.not.is.null,utm_medium.not.is.null,utm_campaign.not.is.null')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const rows = links.data || [];
  const totalClicks = rows.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
  const totalUnique = rows.reduce((sum, r) => sum + Number(r.unique_clicks || 0), 0);
  const totalQr = rows.reduce((sum, r) => sum + Number(r.qr_scans || 0), 0);
  const activeLinks = rows.filter((r) => r.is_active).length;

  const clickEvents = (recentClicks.data || []).map((row) => normalizeClick(row as RawClickRow));
  const clickOnlyEvents = clickEvents.filter((ev) => ev.event_type === 'click');

  return {
    range,
    kpis: {
      total_links: links.count || 0,
      active_links: activeLinks,
      total_clicks: totalClicks,
      unique_clicks: totalUnique,
      qr_scans: totalQr,
      clicks_in_range: clicksInRange.count || 0,
      qr_scans_in_range: qrInRange.count || 0,
    },
    top_links: topLinks.data || [],
    utm_sources: aggregateUtmField(clickOnlyEvents, 'utm_source'),
    utm_mediums: aggregateUtmField(clickOnlyEvents, 'utm_medium'),
    utm_campaigns: aggregateUtmField(clickOnlyEvents, 'utm_campaign'),
    configured_links: utmLinks.data || [],
    recent_clicks: clickEvents,
  };
}

export async function listLinkManagerEvents(
  client: SupabaseClient,
  opts: {
    start: string;
    end: string;
    page?: number;
    pageSize?: number;
    eventType?: string;
    platform?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    q?: string;
  },
) {
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(opts.pageSize) || 25));
  const fromIdx = (page - 1) * pageSize;

  const platform = String(opts.platform || '').trim().toLowerCase();
  const utmSource = String(opts.utmSource || '').trim().toLowerCase();
  const utmMedium = String(opts.utmMedium || '').trim().toLowerCase();
  const utmCampaign = String(opts.utmCampaign || '').trim().toLowerCase();
  const q = String(opts.q || '').trim().toLowerCase();
  const needsPostFilter = Boolean(platform || utmSource || utmMedium || utmCampaign || q);

  let query = client
    .from('managed_short_link_clicks')
    .select(
      'id,event_type,created_at,referrer,user_agent,meta,link:managed_short_links(short_code,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content)',
      { count: 'exact' },
    )
    .gte('created_at', opts.start)
    .lte('created_at', opts.end)
    .order('created_at', { ascending: false });

  const eventType = String(opts.eventType || '').trim();
  if (eventType === 'click' || eventType === 'qr_scan') {
    query = query.eq('event_type', eventType);
  }

  // Extra filters live on joined/meta fields → pull a window then filter/paginate in memory
  const fetchQuery = needsPostFilter ? query.limit(1500) : query.range(fromIdx, fromIdx + pageSize - 1);
  const { data, error, count } = await fetchQuery;
  if (error) throw new Error(error.message);

  let events = (data || []).map((row) => normalizeClick(row as RawClickRow));

  if (platform) {
    events = events.filter((ev) => (ev.platform || '').toLowerCase().includes(platform));
  }
  if (utmSource) {
    events = events.filter((ev) => (ev.utm_source || '').toLowerCase().includes(utmSource));
  }
  if (utmMedium) {
    events = events.filter((ev) => (ev.utm_medium || '').toLowerCase().includes(utmMedium));
  }
  if (utmCampaign) {
    events = events.filter((ev) => (ev.utm_campaign || '').toLowerCase().includes(utmCampaign));
  }
  if (q) {
    events = events.filter(
      (ev) =>
        (ev.short_code || '').toLowerCase().includes(q) ||
        (ev.link_title || '').toLowerCase().includes(q) ||
        (ev.source || '').toLowerCase().includes(q),
    );
  }

  if (needsPostFilter) {
    const total = events.length;
    return {
      events: events.slice(fromIdx, fromIdx + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  return {
    events,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
  };
}

export async function listUtmConfiguredLinks(
  client: SupabaseClient,
  opts: {
    page?: number;
    pageSize?: number;
    q?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  },
) {
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(opts.pageSize) || 25));
  const fromIdx = (page - 1) * pageSize;

  let query = client
    .from('managed_short_links')
    .select(
      'id,short_code,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content,clicks,qr_scans,created_at,is_active',
      { count: 'exact' },
    )
    .or('utm_source.not.is.null,utm_medium.not.is.null,utm_campaign.not.is.null')
    .order('created_at', { ascending: false });

  const utmSource = String(opts.utmSource || '').trim();
  const utmMedium = String(opts.utmMedium || '').trim();
  const utmCampaign = String(opts.utmCampaign || '').trim();
  const q = String(opts.q || '').trim();

  if (utmSource) query = query.ilike('utm_source', `%${utmSource}%`);
  if (utmMedium) query = query.ilike('utm_medium', `%${utmMedium}%`);
  if (utmCampaign) query = query.ilike('utm_campaign', `%${utmCampaign}%`);
  if (q) {
    query = query.or(`title.ilike.%${q}%,short_code.ilike.%${q}%`);
  }

  const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
  if (error) throw new Error(error.message);

  return {
    links: data || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
  };
}
