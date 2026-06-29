'use client';

import { useEffect, useState } from 'react';
import {
  Smartphone,
  Apple,
  Globe,
  ExternalLink,
  CheckCircle2,
  CircleOff,
  Loader2,
  Flame,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';

type ProviderStatus = {
  enabled: boolean;
  label: string;
  detail: string;
};

type PlatformRow = {
  platform: string;
  label: string;
  firebase_analytics: ProviderStatus;
  clarity: ProviderStatus;
  gtag: ProviderStatus;
  meta_pixel: ProviderStatus;
  external_links: { label: string; href: string }[];
};

type OverviewResponse = {
  platforms: PlatformRow[];
  summary: {
    android_active: boolean;
    ios_active: boolean;
    web_active: boolean;
    last_updated: string | null;
  };
  config: {
    firebase: { project_id: string; web_measurement_id: string };
    clarity: { project_id: string };
    mobile_build: { current_version: string; current_build: number; notes: string };
  };
  push_firebase: { project_id: string; measurement_id: string } | null;
  error?: string;
};

const PLATFORM_ICONS = {
  android: Smartphone,
  ios: Apple,
  web: Globe,
} as const;

function StatusPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className={`analytics-badge ${enabled ? 'analytics-badge-live' : 'analytics-badge-off'}`}>
      {enabled ? <CheckCircle2 className="w-3 h-3" /> : <CircleOff className="w-3 h-3" />}
      {label}
    </span>
  );
}

function ProviderCard({ icon: Icon, provider }: { icon: typeof Flame; provider: ProviderStatus }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${provider.enabled ? 'text-violet-600' : 'text-gray-400'}`} />
          <p className="font-semibold text-sm text-gray-900">{provider.label}</p>
        </div>
        <StatusPill enabled={provider.enabled} label={provider.enabled ? 'On' : 'Off'} />
      </div>
      <p className="text-xs text-gray-500 mt-2">{provider.detail}</p>
    </div>
  );
}

export default function OverviewSection() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/super_admin/analytics-hub/overview');
        const json = (await res.json()) as OverviewResponse;
        if (!res.ok) {
          toast.error(json.error || 'Failed to load analytics overview');
          return;
        }
        setData(json);
      } catch {
        toast.error('Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="analytics-card h-96 animate-pulse" />;
  }

  if (!data) {
    return <div className="analytics-card p-6 text-sm text-gray-500">No analytics data available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="analytics-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Firebase Project</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{data.config.firebase.project_id}</p>
          {data.push_firebase?.measurement_id ? (
            <p className="text-xs text-gray-500 mt-1">FCM measurement: {data.push_firebase.measurement_id}</p>
          ) : null}
        </div>
        <div className="analytics-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Clarity Project</p>
          <p className="text-lg font-bold text-gray-900 mt-1 font-mono">{data.config.clarity.project_id}</p>
        </div>
        <div className="analytics-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Mobile App (reference)</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            v{data.config.mobile_build.current_version} · build {data.config.mobile_build.current_build}
          </p>
          {data.summary.last_updated ? (
            <p className="text-xs text-gray-500 mt-1">
              Settings updated {new Date(data.summary.last_updated).toLocaleString('en-IN')}
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">Using default settings (not saved yet)</p>
          )}
        </div>
      </div>

      {data.config.mobile_build.notes ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.config.mobile_build.notes}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-5">
        {data.platforms.map((platform) => {
          const Icon = PLATFORM_ICONS[platform.platform as keyof typeof PLATFORM_ICONS] || Globe;
          const active =
            platform.firebase_analytics.enabled ||
            platform.clarity.enabled ||
            platform.gtag.enabled ||
            platform.meta_pixel.enabled;

          return (
            <div key={platform.platform} className="analytics-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-violet-600" />
                  <h3 className="font-bold text-gray-900">{platform.label}</h3>
                </div>
                <span className={`analytics-badge ${active ? 'analytics-badge-live' : 'analytics-badge-off'}`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <ProviderCard icon={Flame} provider={platform.firebase_analytics} />
                <ProviderCard icon={Eye} provider={platform.clarity} />
                {platform.platform === 'web' ? (
                  <>
                    <ProviderCard icon={BarChartIcon} provider={platform.gtag} />
                    <ProviderCard icon={Eye} provider={platform.meta_pixel} />
                  </>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {platform.external_links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="analytics-btn-secondary text-xs py-1.5 px-3"
                    >
                      {link.label}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarChartIcon(props: React.ComponentProps<typeof Flame>) {
  return <Flame {...props} className={`${props.className || ''} text-orange-500`} />;
}
