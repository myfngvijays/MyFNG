import type { SupabaseClient } from '@supabase/supabase-js';
import { MYFNG_APP_DOWNLOAD_URL } from '@/shared/constants/appDownload';
import { getAppStoreUrls } from '@/lib/app-download-link';

export type UniversalLinkPlatform = 'ios' | 'android' | 'desktop';

export type UniversalLinkEvent = {
  id: string;
  created_at: string;
  slug: string;
  platform: UniversalLinkPlatform;
  source: string;
  referer: string | null;
  redirect_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
};

type RawEventRow = {
  id: string;
  created_at: string;
  properties: Record<string, unknown> | null;
};

function asPlatform(value: unknown): UniversalLinkPlatform {
  const v = String(value || '').toLowerCase();
  if (v === 'ios' || v === 'android') return v;
  return 'desktop';
}

function normalizeEvent(row: RawEventRow): UniversalLinkEvent {
  const props = row.properties || {};
  return {
    id: row.id,
    created_at: row.created_at,
    slug: String(props.slug || 'myfngapp'),
    platform: asPlatform(props.platform),
    source: String(props.source || 'go_redirect'),
    referer: props.referer ? String(props.referer) : null,
    redirect_url: props.redirect_url ? String(props.redirect_url) : null,
    utm_source: props.utm_source ? String(props.utm_source) : null,
    utm_medium: props.utm_medium ? String(props.utm_medium) : null,
    utm_campaign: props.utm_campaign ? String(props.utm_campaign) : null,
    utm_term: props.utm_term ? String(props.utm_term) : null,
    utm_content: props.utm_content ? String(props.utm_content) : null,
  };
}

function dedupeEvents(events: UniversalLinkEvent[]): UniversalLinkEvent[] {
  const kept: UniversalLinkEvent[] = [];

  for (const event of events) {
    const ts = new Date(event.created_at).getTime();
    const isDuplicate = kept.some((existing) => {
      const existingTs = new Date(existing.created_at).getTime();
      if (Math.abs(ts - existingTs) > 3000) return false;
      return (
        existing.platform === event.platform &&
        existing.source === event.source &&
        existing.utm_source === event.utm_source &&
        existing.utm_medium === event.utm_medium &&
        existing.utm_campaign === event.utm_campaign &&
        existing.referer === event.referer
      );
    });
    if (!isDuplicate) kept.push(event);
  }

  return kept;
}

function countEventsByPlatform(events: UniversalLinkEvent[], platform: UniversalLinkPlatform): number {
  return events.filter((event) => event.platform === platform).length;
}

async function countPlatformClicks(
  client: SupabaseClient,
  platform: UniversalLinkPlatform,
  start?: string,
  end?: string,
): Promise<number> {
  let query = client
    .from('customer_analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'app_download_link_click')
    .filter('properties->>platform', 'eq', platform);

  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

function aggregateDaily(events: UniversalLinkEvent[]) {
  const map = new Map<string, { date: string; ios: number; android: number; desktop: number; total: number }>();

  for (const event of events) {
    const date = event.created_at.slice(0, 10);
    const row = map.get(date) || { date, ios: 0, android: 0, desktop: 0, total: 0 };
    row[event.platform] += 1;
    row.total += 1;
    map.set(date, row);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateUtmField(events: UniversalLinkEvent[], field: keyof Pick<UniversalLinkEvent, 'utm_source' | 'utm_medium' | 'utm_campaign'>) {
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

async function fetchEventsInRange(
  client: SupabaseClient,
  range: { start: string; end: string },
): Promise<RawEventRow[]> {
  const all: RawEventRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('customer_analytics_events')
      .select('id,created_at,properties')
      .eq('event_name', 'app_download_link_click')
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as RawEventRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

export async function getUniversalLinkStats(
  client: SupabaseClient,
  range: { start: string; end: string; preset: string; label: string },
) {
  const stores = await getAppStoreUrls();

  const [iosAllTime, androidAllTime, desktopAllTime, rawEvents] = await Promise.all([
    countPlatformClicks(client, 'ios'),
    countPlatformClicks(client, 'android'),
    countPlatformClicks(client, 'desktop'),
    fetchEventsInRange(client, range),
  ]);

  const events = dedupeEvents(rawEvents.map((row) => normalizeEvent(row)));
  const iosInRange = countEventsByPlatform(events, 'ios');
  const androidInRange = countEventsByPlatform(events, 'android');
  const desktopInRange = countEventsByPlatform(events, 'desktop');
  const clicksInRange = events.length;
  const totalAllTime = iosAllTime + androidAllTime + desktopAllTime;

  return {
    range,
    universal_url: MYFNG_APP_DOWNLOAD_URL,
    store_urls: stores,
    kpis: {
      clicks_in_range: clicksInRange,
      ios_in_range: iosInRange,
      android_in_range: androidInRange,
      desktop_in_range: desktopInRange,
      total_all_time: totalAllTime,
      ios_all_time: iosAllTime,
      android_all_time: androidAllTime,
      desktop_all_time: desktopAllTime,
    },
    platform_breakdown: [
      { platform: 'ios' as const, label: 'iOS / App Store', count: iosInRange, all_time: iosAllTime },
      { platform: 'android' as const, label: 'Android / Play Store', count: androidInRange, all_time: androidAllTime },
      { platform: 'desktop' as const, label: 'Desktop fallback', count: desktopInRange, all_time: desktopAllTime },
    ],
    daily: aggregateDaily(events.slice().reverse()),
    utm_sources: aggregateUtmField(events, 'utm_source'),
    utm_mediums: aggregateUtmField(events, 'utm_medium'),
    utm_campaigns: aggregateUtmField(events, 'utm_campaign'),
    recent_events: events.slice(0, 100),
  };
}
