'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { readTrackerConsent, type TrackerConsent } from '@/lib/dpdp/trackerConsent';

const isProd = process.env.NODE_ENV === 'production';

export default function GatedPublicTrackers() {
  const [consent, setConsent] = useState<TrackerConsent>({
    analytics: false,
    advertising: false,
    decidedAt: null,
  });

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

  if (!isProd) return null;

  return (
    <>
      {consent.advertising ? (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '845395791020784');
fbq('track', 'PageView');`,
          }}
        />
      ) : null}

      {consent.analytics ? (
        <>
          <Script id="gtag-js" strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-S493ENTH9Z" />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-S493ENTH9Z');`,
            }}
          />
          <Script
            id="google-tag-manager"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-N2N59TBR');`,
            }}
          />
        </>
      ) : null}
    </>
  );
}
