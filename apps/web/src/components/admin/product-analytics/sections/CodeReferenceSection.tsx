'use client';

import { useEffect, useState } from 'react';
import { Copy, FileCode2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Implementation = {
  mobile_firebase_file: string;
  mobile_clarity_file: string;
  mobile_app_entry: string;
  web_ga4_file: string;
  web_gtm_container: string;
  env_clarity_key: string;
};

type ConfigResponse = {
  config: {
    implementation: Implementation;
    firebase: { project_id: string; web_measurement_id: string };
    clarity: { project_id: string };
    web_tracking: { meta_pixel_id: string; gtm_container_id: string };
  };
  error?: string;
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-mono text-gray-900 mt-1 break-all">{value}</p>
      </div>
      <button type="button" onClick={() => void copy()} className="analytics-btn-secondary shrink-0 py-1.5 px-2">
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function CodeReferenceSection() {
  const [impl, setImpl] = useState<Implementation | null>(null);
  const [ids, setIds] = useState<{ firebase: string; clarity: string; ga4: string; metaPixel: string; gtm: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/super_admin/analytics-hub/config');
        const json = (await res.json()) as ConfigResponse;
        if (!res.ok) {
          toast.error(json.error || 'Failed to load code reference');
          return;
        }
        setImpl(json.config.implementation);
        setIds({
          firebase: json.config.firebase.project_id,
          clarity: json.config.clarity.project_id,
          ga4: json.config.firebase.web_measurement_id,
          metaPixel: json.config.web_tracking?.meta_pixel_id || '',
          gtm: json.config.web_tracking?.gtm_container_id || '',
        });
      } catch {
        toast.error('Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="analytics-card h-80 animate-pulse" />;
  }

  if (!impl || !ids) {
    return <div className="analytics-card p-6 text-sm text-gray-500">No reference data.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="analytics-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileCode2 className="w-5 h-5 text-violet-600" />
          <h2 className="text-xl font-bold text-gray-900">Code Reference</h2>
        </div>
        <p className="text-sm text-gray-500">
          Future mein analytics ya Clarity code change karna ho toh yeh files update karein. Admin Settings se IDs
          change karne ke baad mobile par native rebuild zaroori hai.
        </p>
      </div>

      <div className="analytics-card p-6 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Mobile (React Native)</p>
        <CopyRow label="Firebase Analytics module" value={impl.mobile_firebase_file} />
        <CopyRow label="Microsoft Clarity module" value={impl.mobile_clarity_file} />
        <CopyRow label="App entry (initialize both)" value={impl.mobile_app_entry} />
        <CopyRow label="Env key for Clarity project ID" value={impl.env_clarity_key} />
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-xs text-violet-900 space-y-1">
          <p>
            <strong>Firebase:</strong> <code>@react-native-firebase/analytics</code> — lazy load via{' '}
            <code>RNFBAnalyticsModule</code>
          </p>
          <p>
            <strong>Clarity:</strong> <code>@microsoft/react-native-clarity</code> — lazy load via{' '}
            <code>NativeModules.Clarity</code>
          </p>
          <p>
            <strong>Runtime config API:</strong>{' '}
            <code>GET /api/public/analytics-config</code> (mobile can fetch admin-saved flags + IDs)
          </p>
        </div>
      </div>

      <div className="analytics-card p-6 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Website (Next.js)</p>
        <CopyRow label="Public layout (GA4 + Meta Pixel scripts)" value={impl.web_ga4_file} />
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-xs text-violet-900 space-y-1">
          <p>
            <strong>Website Clarity:</strong> live on myfng.in via Google Tag Manager container{' '}
            <code>GTM-N2N59TBR</code> (same project ID <code>{ids.clarity}</code> as mobile).
          </p>
          <p>
            <strong>Website GA4 + Meta Pixel:</strong> direct scripts in{' '}
            <code>{impl.web_ga4_file}</code>
          </p>
        </div>
      </div>

      <div className="analytics-card p-6 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Current IDs (from admin config)</p>
        <CopyRow label="Firebase Project ID" value={ids.firebase} />
        <CopyRow label="Clarity Project ID" value={ids.clarity} />
        <CopyRow label="GA4 Measurement ID" value={ids.ga4} />
        <CopyRow label="Meta Pixel ID" value={ids.metaPixel} />
        <CopyRow label="GTM Container ID" value={ids.gtm} />
      </div>
    </div>
  );
}
