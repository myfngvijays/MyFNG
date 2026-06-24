'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import type { SmartToolCustomerActivity } from '@/lib/smart-tools-customer-activity';

type Props = {
  customerId?: string | null;
  customerPhone?: string | null;
  excludeType?: 'health' | 'resale';
  excludeId?: string;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
}

export default function SmartToolsCustomerActivityPanel({
  customerId,
  customerPhone,
  excludeType,
  excludeId,
}: Props) {
  const [data, setData] = useState<SmartToolCustomerActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId && !customerPhone) {
      setData(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (customerId) params.set('customer_id', customerId);
    if (customerPhone) params.set('phone', customerPhone);
    if (excludeType) params.set('exclude_type', excludeType);
    if (excludeId) params.set('exclude_id', excludeId);

    fetch(`/api/admin/smart-tools/customer-activity?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.error) {
          setData(null);
          return;
        }
        setData(json);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customerId, customerPhone, excludeType, excludeId]);

  if (!customerId && !customerPhone) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Guest submission — no phone or logged-in customer linked. Same-user matching is not available for this record.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking other Smart Tools from this customer...
      </div>
    );
  }

  if (!data) return null;

  const usesBoth = data.health_count > 0 && data.resale_count > 0;
  const totalOther = data.items.length;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-violet-900">Same customer — Smart Tools activity</p>
          <p className="text-xs text-violet-700 mt-1 leading-relaxed">
            Matched by {data.customer_id ? 'customer account' : 'phone'}
            {data.customer_phone ? ` · ${data.customer_phone}` : ''}.
            {usesBoth
              ? ' This user has used both Health Check and Resale Value.'
              : totalOther > 0
                ? ' Other tool usage from this customer is listed below.'
                : ' No other Smart Tools found for this customer yet.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-violet-200 text-[10px] font-bold text-violet-800">
              <Activity className="w-3 h-3" />
              Health: {data.health_count}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-violet-200 text-[10px] font-bold text-violet-800">
              <TrendingUp className="w-3 h-3" />
              Resale: {data.resale_count}
            </span>
          </div>
        </div>
      </div>

      {totalOther > 0 ? (
        <div className="space-y-2">
          {data.items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={`${item.adminPath}?open=${item.id}`}
              className="flex items-center gap-3 rounded-lg border border-violet-200 bg-white px-3 py-2.5 hover:bg-violet-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                {item.type === 'health' ? (
                  <Activity className="w-4 h-4 text-violet-700" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-violet-700" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-600 truncate">{item.subtitle}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{fmt(item.created_at)}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-violet-500 shrink-0" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
