'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { readTrackerConsent, type TrackerConsent } from '@/lib/dpdp/trackerConsent';
import {
  DEFAULT_META_PIXEL_ID,
  DEFAULT_OPENAI_ADS_PIXEL_ID,
  DEFAULT_WEB_GA4_MEASUREMENT_ID,
  DEFAULT_WEB_GTM_CONTAINER_ID,
} from '@/lib/analytics/productAnalyticsConfig';
import { scriptMatchesPath, type CustomTrackingScript } from '@/lib/analytics/websiteTrackingScripts';

const isProd = process.env.NODE_ENV === 'production';
const TEST_PATH = '/tracking-test';

type PublicTrackingPayload = {
  builtIn: {
    gtm_container_id: string;
    web_measurement_id: string;
    meta_pixel_id: string;
    gtm_enabled: boolean;
    gtag_enabled: boolean;
    meta_pixel_enabled: boolean;
    openai_ads_pixel_id: string;
    openai_ads_enabled: boolean;
  };
  custom: CustomTrackingScript[];
};

const FALLBACK: PublicTrackingPayload = {
  builtIn: {
    gtm_container_id: DEFAULT_WEB_GTM_CONTAINER_ID,
    web_measurement_id: DEFAULT_WEB_GA4_MEASUREMENT_ID,
    meta_pixel_id: DEFAULT_META_PIXEL_ID,
    gtm_enabled: true,
    gtag_enabled: true,
    meta_pixel_enabled: true,
    openai_ads_pixel_id: DEFAULT_OPENAI_ADS_PIXEL_ID,
    openai_ads_enabled: true,
  },
  custom: [],
};

function injectHtml(html: string, placement: 'head' | 'body', key: string, prepend = false) {
  if (typeof document === 'undefined' || !html.trim()) return;
  const marker = `data-myfng-track="${key}"`;
  if (document.querySelector(`[${marker}]`)) return;

  const holder = document.createElement('div');
  holder.innerHTML = html;
  const dest = placement === 'head' ? document.head : document.body;

  Array.from(holder.childNodes).forEach((node, idx) => {
    if (node.nodeName === 'SCRIPT') {
      const srcEl = node as HTMLScriptElement;
      const script = document.createElement('script');
      for (const attr of Array.from(srcEl.attributes)) {
        script.setAttribute(attr.name, attr.value);
      }
      if (srcEl.src) script.src = srcEl.src;
      else script.text = srcEl.text || srcEl.textContent || '';
      if (idx === 0) script.setAttribute('data-myfng-track', key);
      if (prepend && dest.firstChild) dest.insertBefore(script, dest.firstChild);
      else dest.appendChild(script);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (idx === 0) el.setAttribute('data-myfng-track', key);
      if (prepend && dest.firstChild) dest.insertBefore(el, dest.firstChild);
      else dest.appendChild(el);
    }
  });
}

export default function GatedPublicTrackers() {
  const pathname = usePathname() || '/';
  const [consent, setConsent] = useState<TrackerConsent>({
    analytics: false,
    advertising: false,
    decidedAt: null,
  });
  const [payload, setPayload] = useState<PublicTrackingPayload>(FALLBACK);

  useEffect(() => {
    setConsent(readTrackerConsent());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<TrackerConsent>).detail;
      if (detail) setConsent(detail);
      else setConsent(readTrackerConsent());
    };
    window.addEventListener('myfng:dpdp-tracker-consent', onChange);
    return () => window.removeEventListener('myfng:dpdp-tracker-consent', onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/tracking-scripts')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.builtIn) return;
        setPayload({
          builtIn: { ...FALLBACK.builtIn, ...json.builtIn },
          custom: Array.isArray(json.custom) ? json.custom : [],
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const forceTest = pathname === TEST_PATH;
  const activeConsent = forceTest
    ? { analytics: true, advertising: true, decidedAt: 'test' }
    : consent;
  const allowInject = isProd || forceTest;

  useEffect(() => {
    if (!allowInject) return;
    if (activeConsent.analytics && payload.builtIn.gtm_enabled) {
      const gtmId = payload.builtIn.gtm_container_id || DEFAULT_WEB_GTM_CONTAINER_ID;
      injectHtml(
        `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
        'body',
        'gtm-noscript',
      );
    }
    for (const row of payload.custom) {
      if (!forceTest && !scriptMatchesPath(row, pathname)) continue;
      if (!forceTest && row.consent === 'analytics' && !activeConsent.analytics) continue;
      if (!forceTest && row.consent === 'advertising' && !activeConsent.advertising) continue;
      injectHtml(row.html, row.placement, row.id);
    }
  }, [payload, pathname, activeConsent, allowInject, forceTest]);

  if (!allowInject) return null;

  const gtmId = payload.builtIn.gtm_container_id || DEFAULT_WEB_GTM_CONTAINER_ID;
  const ga4Id = payload.builtIn.web_measurement_id || DEFAULT_WEB_GA4_MEASUREMENT_ID;
  const pixelId = payload.builtIn.meta_pixel_id || DEFAULT_META_PIXEL_ID;

  return (
    <>
      {activeConsent.advertising && payload.builtIn.meta_pixel_enabled ? (
        <Script
          id="meta-pixel"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`,
          }}
        />
      ) : null}

      {activeConsent.analytics ? (
        <>
          {payload.builtIn.gtag_enabled ? (
            <>
              <Script id="gtag-js" strategy="lazyOnload" src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} />
              <Script
                id="google-analytics"
                strategy="lazyOnload"
                dangerouslySetInnerHTML={{
                  __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`,
                }}
              />
            </>
          ) : null}
          {payload.builtIn.gtm_enabled ? (
            <Script
              id="google-tag-manager"
              strategy="lazyOnload"
              dangerouslySetInnerHTML={{
                __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
              }}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
