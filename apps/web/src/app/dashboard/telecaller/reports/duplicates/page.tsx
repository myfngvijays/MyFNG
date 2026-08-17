'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CrmReportsNav } from '@/components/telecaller/crm/CrmReportsNav';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';
import { ChevronRight, Loader2, Phone } from 'lucide-react';

type DupGroup = {
  key: string;
  phone: string;
  count: number;
  leads: Array<{
    id: string;
    lead_number: string;
    customer_name: string;
    customer_phone: string;
    status: string;
    city: string | null;
    created_at: string;
    is_incomplete?: boolean;
    telecaller_name?: string | null;
  }>;
};

export default function CrmReportsDuplicatesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const { permissions, loading: permLoading } = useCrmPermissions();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [stats, setStats] = useState({ total_groups: 0, total_extra_leads: 0 });

  const allowed = Boolean(isLeadManager || permissions.reports_duplicates);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telecaller/crm/reports/duplicates?channel=phone');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      const list: DupGroup[] = Array.isArray(json.groups) ? json.groups : [];
      setGroups(list);
      setStats({
        total_groups: Number(json.total_groups) || list.length,
        total_extra_leads: Number(json.total_extra_leads) || 0,
      });
      setSelectedKey((prev) => prev || (list[0]?.key ?? null));
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permLoading) return;
    if (!allowed) {
      router.replace(`${base}/reports`);
      return;
    }
    void load();
  }, [permLoading, allowed, router, base, load]);

  if (permLoading || !allowed) {
    return (
      <DashboardLayout role={layoutRole}>
        <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </DashboardLayout>
    );
  }

  const selected = groups.find((g) => g.key === selectedKey) || null;

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
        <CrmReportsNav
          title="Duplicate phones"
          subtitle={`${stats.total_groups} groups · ${stats.total_extra_leads} extra lead rows`}
          onRefresh={load}
          refreshing={loading}
        />

        <div className="flex gap-2 border-b border-slate-200">
          <span className="border-b-2 border-[#004AAD] px-3 py-2 text-sm font-bold text-[#023D95] inline-flex items-center gap-1.5">
            <Phone className="h-4 w-4" /> Phone
          </span>
          <span className="px-3 py-2 text-sm font-semibold text-slate-400">Email (soon)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Scanning leads…
          </div>
        ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
            <div className="max-h-[45vh] lg:max-h-[75vh] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-2 order-1">
              {groups.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-slate-500">
                  No duplicate phones found in your scope
                </p>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setSelectedKey(g.key)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      selectedKey === g.key
                        ? 'border-[#004AAD] bg-white shadow-sm'
                        : 'border-transparent bg-white/80 hover:border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{g.phone}</p>
                      <p className="text-xs font-semibold text-slate-500">{g.count} leads</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-h-[320px]">
              {!selected ? (
                <p className="py-16 text-center text-sm text-slate-500">
                  Select a phone group to review matching leads
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Phone group
                      </p>
                      <h2 className="text-xl font-extrabold text-[#023D95]">{selected.phone}</h2>
                    </div>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                      {selected.count} leads
                    </span>
                  </div>
                  <ul className="mt-5 divide-y divide-slate-100">
                    {selected.leads.map((lead) => (
                      <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">
                            {lead.customer_name || 'Unknown'}{' '}
                            <span className="font-mono text-xs text-slate-500">
                              {lead.lead_number}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {[lead.status, lead.city, lead.telecaller_name]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                            {' · '}
                            {new Date(lead.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <Link
                          href={`${base}/leads/${lead.id}`}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#004AAD] hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
