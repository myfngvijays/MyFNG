'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CircleDollarSign,
  ExternalLink,
  Gift,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react';

type Tier = 'free' | 'paid' | 'platform';

type ServiceRow = {
  id: string;
  name: string;
  tier: Tier;
  category: string;
  description: string;
  billingModel: string;
  adminMenus: string[];
  configured: boolean;
  hasCostDashboard?: boolean;
  dashboardHref?: string;
  docsUrl?: string;
};

type ApiData = {
  tierLabels: Record<Tier, string>;
  counts: Record<Tier, number>;
  configuredPaid: number;
  services: ServiceRow[];
  adminMenus: Array<{ menu: string; href: string; tier: Tier; services: string[] }>;
  notes: string[];
  lastChecked: string;
};

const TIER_META: Record<
  Tier,
  { badge: string; card: string; iconBg: string; icon: typeof Gift; ring: string }
> = {
  free: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    card: 'border-emerald-100 bg-emerald-50/40',
    iconBg: 'bg-emerald-100 text-emerald-700',
    icon: Gift,
    ring: 'border-l-emerald-500',
  },
  paid: {
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    card: 'border-amber-100 bg-amber-50/30',
    iconBg: 'bg-amber-100 text-amber-700',
    icon: CircleDollarSign,
    ring: 'border-l-amber-500',
  },
  platform: {
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    card: 'border-blue-100 bg-blue-50/30',
    iconBg: 'bg-blue-100 text-blue-700',
    icon: Server,
    ring: 'border-l-blue-500',
  },
};

function MenuPill({ label, href }: { label: string; href?: string }) {
  const className =
    'inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:border-blue-300 hover:text-blue-700 transition-colors';
  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return <span className={`${className} cursor-default hover:border-gray-200 hover:text-gray-700`}>{label}</span>;
}

export default function ApiServicesApp() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Tier>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/api-services');
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const menuHrefMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.adminMenus || []) {
      map.set(row.menu.toLowerCase(), row.href);
    }
    const aliases: Record<string, string> = {
      'whatsapp dashboard': '/dashboard/super_admin/whatsapp-dashboard',
      'whatsapp settings': '/dashboard/super_admin/whatsapp-settings',
      'message logs': '/dashboard/super_admin/whatsapp-messages',
      'whatsapp chat': '/dashboard/super_admin/whatsapp-chat',
      'templates': '/dashboard/super_admin/whatsapp-templates',
      'automation': '/dashboard/super_admin/whatsapp-automation',
      'whatsapp cron': '/dashboard/super_admin/whatsapp-cron',
      'bot flow': '/dashboard/super_admin/bot-flow',
      'push dashboard': '/dashboard/super_admin/advance-notifications',
      'send push': '/dashboard/super_admin/advance-notifications?section=send',
      'campaigns': '/dashboard/super_admin/advance-notifications?section=campaigns',
      'firebase settings': '/dashboard/super_admin/advance-notifications?section=firebase',
      'customer reviews (gmb sync)': '/dashboard/super_admin/website-images/customer-reviews',
      'kb manager': '/dashboard/super_admin/kb-manager',
      'link manager': '/dashboard/super_admin/link-manager',
      'universal link': '/dashboard/super_admin/universal-link',
      'dashboard': '/dashboard/super_admin',
      'workshops': '/dashboard/super_admin/workshops',
      'bookings': '/dashboard/super_admin/bookings',
      'finance': '/dashboard/super_admin/finance',
    };
    for (const [key, href] of Object.entries(aliases)) {
      if (!map.has(key)) map.set(key, href);
    }
    return map;
  }, [data?.adminMenus]);

  const resolveMenuHref = useCallback(
    (label: string) => {
      const key = label.trim().toLowerCase();
      if (menuHrefMap.has(key)) return menuHrefMap.get(key);
      for (const [menuKey, href] of menuHrefMap.entries()) {
        if (key.includes(menuKey) || menuKey.includes(key)) return href;
      }
      return undefined;
    },
    [menuHrefMap],
  );

  const filteredServices = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.services;
    return data.services.filter((s) => s.tier === filter);
  }, [data, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const service of filteredServices) {
      const list = map.get(service.category) || [];
      list.push(service);
      map.set(service.category, list);
    }
    return Array.from(map.entries());
  }, [filteredServices]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-700 font-medium">Loading API services map…</p>
        </div>
      </div>
    );
  }

  const counts = data?.counts || { free: 0, paid: 0, platform: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-100 rounded-xl shrink-0">
                <Layers className="w-6 h-6 text-indigo-700" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">API Services Map</h1>
                <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                  Free vs paid third-party APIs used by your admin panel — not customer invoice billing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {([
            { key: 'free', label: 'Free / Self-hosted', value: counts.free, Icon: Gift, iconBg: TIER_META.free.iconBg, ring: TIER_META.free.ring },
            { key: 'paid', label: 'Paid / Metered', value: counts.paid, Icon: CircleDollarSign, iconBg: TIER_META.paid.iconBg, ring: TIER_META.paid.ring },
            { key: 'platform', label: 'Platform plans', value: counts.platform, Icon: Server, iconBg: TIER_META.platform.iconBg, ring: TIER_META.platform.ring },
            {
              key: 'configured',
              label: 'Paid configured',
              value: data?.configuredPaid || 0,
              Icon: BadgeCheck,
              iconBg: 'bg-purple-100 text-purple-700',
              ring: 'border-l-purple-500',
            },
          ] as const).map(({ key, label, value, Icon, iconBg, ring }) => {
            return (
              <div
                key={key}
                className={`rounded-2xl border bg-white p-5 shadow-sm border-l-4 ${ring}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {(['all', 'free', 'paid', 'platform'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setFilter(tier)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  filter === tier
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tier === 'all' ? 'All services' : data?.tierLabels?.[tier] || tier}
              </button>
            ))}
          </div>
        </div>

        {data?.notes?.length ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-indigo-950 leading-relaxed">
                {data.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-5">
          {grouped.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500">
              No services in this filter.
            </div>
          ) : (
            grouped.map(([category, services]) => (
              <section key={category} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-600" />
                  <h2 className="font-bold text-gray-900">{category}</h2>
                  <span className="ml-auto text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full">
                    {services.length} service{services.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="p-4 sm:p-5 grid gap-4">
                  {services.map((service) => {
                    const meta = TIER_META[service.tier];
                    const TierIcon = meta.icon;
                    return (
                      <article
                        key={service.id}
                        className={`rounded-xl border p-4 sm:p-5 border-l-4 ${meta.ring} ${meta.card}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl h-fit shrink-0 ${meta.iconBg}`}>
                              <TierIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold text-gray-900">{service.name}</h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.badge}`}>
                                  {data?.tierLabels?.[service.tier]}
                                </span>
                                {service.tier === 'paid' ? (
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                      service.configured
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : 'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}
                                  >
                                    {service.configured ? 'Configured' : 'Not configured'}
                                  </span>
                                ) : null}
                                {service.hasCostDashboard ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                    <Sparkles className="w-3 h-3" />
                                    Cost dashboard
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{service.description}</p>
                              <p className="text-sm text-gray-600 mt-2">
                                <span className="font-semibold text-gray-800">Billing:</span> {service.billingModel}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
                            {service.dashboardHref ? (
                              <Link
                                href={service.dashboardHref}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                              >
                                Open dashboard
                              </Link>
                            ) : null}
                            {service.docsUrl ? (
                              <a
                                href={service.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Provider docs
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200/80">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Admin menus
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {service.adminMenus.map((menu) => (
                              <MenuPill key={menu} label={menu} href={resolveMenuHref(menu)} />
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
            <h2 className="font-bold text-gray-900">Admin menu → API dependency</h2>
            <p className="text-sm text-gray-600 mt-1">Which sidebar sections touch paid or external APIs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 font-semibold">Menu</th>
                  <th className="px-5 py-3 font-semibold">Tier</th>
                  <th className="px-5 py-3 font-semibold">Services used</th>
                </tr>
              </thead>
              <tbody>
                {(data?.adminMenus || []).map((row) => (
                  <tr key={row.menu} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="px-5 py-3.5">
                      <Link href={row.href} className="font-semibold text-blue-700 hover:text-blue-800 hover:underline">
                        {row.menu}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${TIER_META[row.tier].badge}`}>
                        {data?.tierLabels?.[row.tier]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{row.services.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {data?.lastChecked ? (
          <p className="text-xs text-gray-500 text-right pb-2">
            Last checked {new Date(data.lastChecked).toLocaleString('en-IN')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
