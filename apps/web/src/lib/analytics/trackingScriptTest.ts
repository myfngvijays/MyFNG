export type TrackingTestCheck = {
  id: string;
  name: string;
  ok: boolean;
  message: string;
  detail?: string;
};

function looksGtm(id: string) {
  return /^GTM-[A-Z0-9]+$/i.test(id.trim());
}

function looksGa4(id: string) {
  return /^G-[A-Z0-9]+$/i.test(id.trim());
}

function looksPixel(id: string) {
  return /^\d{8,20}$/.test(id.trim());
}

async function probe(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; note: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
    return {
      ok: res.ok,
      status: res.status,
      note: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, status: 0, note: e instanceof Error ? e.message : 'Fetch failed' };
  } finally {
    clearTimeout(t);
  }
}

export async function runTrackingScriptTests(input: {
  gtm_container_id?: string;
  web_measurement_id?: string;
  meta_pixel_id?: string;
  openai_ads_pixel_id?: string;
  gtm_enabled?: boolean;
  gtag_enabled?: boolean;
  meta_pixel_enabled?: boolean;
  openai_ads_enabled?: boolean;
  custom?: Array<{ id?: string; name?: string; html?: string; enabled?: boolean }>;
}): Promise<TrackingTestCheck[]> {
  const checks: TrackingTestCheck[] = [];
  const gtm = String(input.gtm_container_id || '').trim();
  const ga4 = String(input.web_measurement_id || '').trim();
  const pixel = String(input.meta_pixel_id || '').trim();
  const oai = String(input.openai_ads_pixel_id || '').trim();

  if (input.gtm_enabled !== false) {
    if (!looksGtm(gtm)) {
      checks.push({
        id: 'gtm',
        name: 'GTM ID',
        ok: false,
        message: 'Format galat — GTM-XXXX hona chahiye',
        detail: gtm || '(empty)',
      });
    } else {
      const probeRes = await probe(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`);
      checks.push({
        id: 'gtm',
        name: 'GTM container',
        ok: probeRes.ok,
        message: probeRes.ok ? `${gtm} Google se load ho raha hai` : `${gtm} load nahi hua`,
        detail: probeRes.note,
      });
    }
  } else {
    checks.push({ id: 'gtm', name: 'GTM', ok: true, message: 'Off — skip' });
  }

  if (input.gtag_enabled !== false) {
    if (!looksGa4(ga4)) {
      checks.push({
        id: 'ga4',
        name: 'GA4 ID',
        ok: false,
        message: 'Format galat — G-XXXX hona chahiye',
        detail: ga4 || '(empty)',
      });
    } else {
      const probeRes = await probe(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`);
      checks.push({
        id: 'ga4',
        name: 'GA4 gtag',
        ok: probeRes.ok,
        message: probeRes.ok ? `${ga4} Google se load ho raha hai` : `${ga4} load nahi hua`,
        detail: probeRes.note,
      });
    }
  } else {
    checks.push({ id: 'ga4', name: 'GA4', ok: true, message: 'Off — skip' });
  }

  if (input.meta_pixel_enabled !== false) {
    if (!looksPixel(pixel)) {
      checks.push({
        id: 'pixel',
        name: 'Meta Pixel ID',
        ok: false,
        message: 'Pixel ID numbers hone chahiye',
        detail: pixel || '(empty)',
      });
    } else {
      const probeRes = await probe('https://connect.facebook.net/en_US/fbevents.js');
      checks.push({
        id: 'pixel',
        name: 'Meta Pixel script',
        ok: probeRes.ok,
        message: probeRes.ok ? `Pixel ${pixel} ke liye Facebook script reachable` : 'Facebook pixel script nahi mila',
        detail: probeRes.note,
      });
    }
  } else {
    checks.push({ id: 'pixel', name: 'Meta Pixel', ok: true, message: 'Off — skip' });
  }

  if (input.openai_ads_enabled !== false) {
    if (!/^[A-Za-z0-9]{10,40}$/.test(oai)) {
      checks.push({
        id: 'openai-ads',
        name: 'OpenAI Ads Pixel ID',
        ok: false,
        message: 'OpenAI Pixel ID format galat',
        detail: oai || '(empty)',
      });
    } else {
      const probeRes = await probe('https://bzrcdn.openai.com/sdk/oaiq.min.js');
      checks.push({
        id: 'openai-ads',
        name: 'OpenAI Ads pixel',
        ok: probeRes.ok,
        message: probeRes.ok
          ? `${oai} — oaiq SDK reachable (head, one setup)`
          : 'OpenAI pixel SDK load nahi hua',
        detail: probeRes.note,
      });
    }
  } else {
    checks.push({ id: 'openai-ads', name: 'OpenAI Ads', ok: true, message: 'Off — skip' });
  }

  for (const row of input.custom || []) {
    const html = String(row.html || '');
    const name = String(row.name || 'Custom snippet');
    if (row.enabled === false) {
      checks.push({ id: `c-${row.id}`, name, ok: true, message: 'Off — skip' });
      continue;
    }
    if (!html.trim()) {
      checks.push({ id: `c-${row.id}`, name, ok: false, message: 'Empty — Head/Body code paste karo' });
      continue;
    }
    const hasTag = /<script|<noscript|<iframe|fbq\(|gtag\(|GTM-|googletagmanager|connect\.facebook/i.test(html);
    const gtmMatch = html.match(/GTM-[A-Z0-9]+/i);
    if (gtmMatch) {
      const probeRes = await probe(`https://www.googletagmanager.com/gtm.js?id=${gtmMatch[0]}`);
      checks.push({
        id: `c-${row.id}`,
        name,
        ok: probeRes.ok,
        message: probeRes.ok ? `Snippet OK · ${gtmMatch[0]} load ho raha` : `Snippet mein ${gtmMatch[0]} load nahi hua`,
        detail: probeRes.note,
      });
      continue;
    }
    checks.push({
      id: `c-${row.id}`,
      name,
      ok: hasTag,
      message: hasTag ? 'Snippet mein script/tag dikh raha hai' : 'Yeh HTML tracking snippet nahi lagta',
    });
  }

  return checks;
}
