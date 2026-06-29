'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Apple, Globe, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type PlatformRow = {
  platform: string;
  label: string;
  firebase_analytics: { enabled: boolean; label: string; detail: string };
  clarity: { enabled: boolean; label: string; detail: string };
  gtag: { enabled: boolean; label: string; detail: string };
  meta_pixel: { enabled: boolean; label: string; detail: string };
  identifiers: { label: string; value: string }[];
  external_links: { label: string; href: string }[];
};

type Tab = 'android' | 'ios' | 'web';

const TABS: { id: Tab; label: string; icon: typeof Smartphone }[] = [
  { id: 'android', label: 'Android', icon: Smartphone },
  { id: 'ios', label: 'iOS', icon: Apple },
  { id: 'web', label: 'Website', icon: Globe },
];

function ToggleRow({
  label,
  detail,
  enabled,
}: {
  label: string;
  detail: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div>
        <p className="font-semibold text-sm text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
      </div>
      <span className={`analytics-badge shrink-0 ${enabled ? 'analytics-badge-live' : 'analytics-badge-off'}`}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

export default function PlatformsSection() {
  const [tab, setTab] = useState<Tab>('android');
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/super_admin/analytics-hub/overview');
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || 'Failed to load platforms');
          return;
        }
        setPlatforms(json.platforms || []);
      } catch {
        toast.error('Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = platforms.find((p) => p.platform === tab);

  if (loading) {
    return <div className="analytics-card h-96 animate-pulse" />;
  }

  return (
    <div className="analytics-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Platform Details</h2>
        <p className="text-sm text-gray-500 mt-1">
          Har platform par kaun sa tracker chal raha hai — Settings tab se on/off aur IDs change kar sakte ho.
        </p>
      </div>

      <div className="flex border-b border-gray-200 px-4">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`analytics-tab inline-flex items-center gap-2 ${tab === item.id ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {current ? (
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <ToggleRow
              label={current.firebase_analytics.label}
              detail={current.firebase_analytics.detail}
              enabled={current.firebase_analytics.enabled}
            />
            <ToggleRow
              label={current.clarity.label}
              detail={current.clarity.detail}
              enabled={current.clarity.enabled}
            />
            {tab === 'web' ? (
              <>
                <ToggleRow label={current.gtag.label} detail={current.gtag.detail} enabled={current.gtag.enabled} />
                <ToggleRow
                  label={current.meta_pixel.label}
                  detail={current.meta_pixel.detail}
                  enabled={current.meta_pixel.enabled}
                />
              </>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Identifiers</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {current.identifiers.map((row) => (
                <div key={row.label} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-500">{row.label}</p>
                  <p className="text-sm font-mono text-gray-900 mt-1 break-all">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {current.external_links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="analytics-btn-secondary text-sm"
              >
                {link.label}
                <ExternalLink className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading platform…
        </div>
      )}
    </div>
  );
}
