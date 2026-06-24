'use client';

import React from 'react';
import { Car, Gauge, Shield, User, Wallet } from 'lucide-react';

export type ResaleValuationRecord = {
  id: string;
  make: string | null;
  model: string | null;
  vehicle_number: string | null;
  vehicle_class?: string | null;
  registration_year: number | null;
  fuel: string | null;
  transmission: string | null;
  odometer: number | null;
  owners: number | null;
  condition: string | null;
  had_accident: boolean | null;
  insurance_valid: boolean | null;
  service_records: string | null;
  city_name: string | null;
  city_tier: string | null;
  estimate_low: number;
  estimate_mid: number;
  estimate_high: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id?: string | null;
  platform: string | null;
  created_at: string;
  valuation_json?: any;
  valuation_text?: string;
};

function fmtInr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function fmtDate(dt: string) {
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

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cap(s?: string | null) {
  if (!s) return '-';
  return String(s).replace(/_/g, ' ');
}

function labelMonthlyRunning(v?: string) {
  if (v === '<500') return 'Under 500 km';
  if (v === '500-1000') return '500 - 1000 km';
  if (v === '1000-2000') return '1000 - 2000 km';
  if (v === '2000+') return '2000+ km';
  return cap(v);
}

function labelLastService(v?: string) {
  if (v === '<3') return 'Under 3 months';
  if (v === '3-6') return '3 - 6 months';
  if (v === '6-12') return '6 - 12 months';
  if (v === '12+') return '12+ months';
  if (v === 'dont_remember') return "Don't remember";
  return cap(v);
}

function detailRows(item: ResaleValuationRecord) {
  const input = item.valuation_json?.input || {};
  return [
    { label: 'Make / Model', value: [item.make, item.model].filter(Boolean).join(' ') || '-' },
    { label: 'Variant', value: input.variant || '-' },
    { label: 'Registration', value: item.vehicle_number || '-' },
    { label: 'Class', value: item.vehicle_class || input.vehicleClass || '-' },
    { label: 'Year', value: item.registration_year ? String(item.registration_year) : '-' },
    { label: 'Fuel', value: cap(item.fuel) },
    { label: 'Transmission', value: cap(item.transmission) },
    { label: 'Odometer', value: item.odometer ? `${item.odometer.toLocaleString('en-IN')} km` : '-' },
    { label: 'Monthly running', value: labelMonthlyRunning(input.monthlyRunning) },
    { label: 'Owners', value: item.owners != null ? String(item.owners) : '-' },
    { label: 'Condition', value: cap(item.condition) },
    { label: 'Tyres', value: cap(input.tyreCondition) },
    { label: 'Body & paint', value: cap(input.bodyPaint) },
    { label: 'Major accident', value: item.had_accident ? 'Yes' : 'No' },
    { label: 'Insurance valid', value: item.insurance_valid == null ? '-' : item.insurance_valid ? 'Yes' : 'No' },
    { label: 'Service records', value: cap(item.service_records) },
    { label: 'Last service', value: labelLastService(input.lastService) },
    { label: 'Loan / hypothecation', value: input.hypothecation ? 'Active' : 'Clear' },
    { label: 'Duplicate key', value: input.duplicateKey ? 'Yes' : 'No' },
    { label: 'City', value: item.city_name ? `${item.city_name}${item.city_tier ? ` (${item.city_tier})` : ''}` : '-' },
  ];
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-violet-600" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function MetaGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{row.label}</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ResaleValuationDetailView({ item }: { item: ResaleValuationRecord }) {
  const rows = detailRows(item);
  const customerRows = [
    { label: 'Customer', value: item.customer_name || 'Guest user' },
    { label: 'Phone', value: item.customer_phone || '-' },
    { label: 'Platform', value: item.platform || 'Unknown' },
    { label: 'Generated', value: fmtDate(item.created_at) },
  ];

  return (
    <div className="space-y-5 print:space-y-4">
      <div className="rounded-2xl p-6 text-center text-white shadow-lg bg-gradient-to-br from-[#0B1F44] to-[#1e3a6e] border-2 border-emerald-400/40">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">Estimated Resale Value</p>
        <p className="text-3xl sm:text-4xl font-black text-emerald-300 mt-2">
          {fmtInr(item.estimate_low)} - {fmtInr(item.estimate_high)}
        </p>
        <p className="text-sm font-semibold text-emerald-100 mt-2">Mid estimate: {fmtInr(item.estimate_mid)}</p>
        <p className="text-xs text-slate-300 mt-3">
          {[item.make, item.model].filter(Boolean).join(' ')}
          {item.registration_year ? ` · ${item.registration_year}` : ''}
          {item.odometer ? ` · ${item.odometer.toLocaleString('en-IN')} km` : ''}
        </p>
        {item.city_name ? <p className="text-xs font-semibold text-blue-200 mt-1">{item.city_name}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={User} title="Customer details" />
        <MetaGrid rows={customerRows} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={Car} title="Vehicle & usage" />
        <MetaGrid rows={rows.slice(0, 10)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={Shield} title="Condition & history" />
        <MetaGrid rows={rows.slice(10)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={Gauge} title="Estimate note" />
        <p className="text-sm text-slate-600 leading-relaxed">
          Indicative range based on brand demand, age depreciation, mileage, condition, tyres, body work, ownership,
          accident history, insurance, service records, loan status and city market tier. Final price may change after
          physical inspection.
        </p>
      </div>

      {item.valuation_text ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <SectionTitle icon={Wallet} title="Plain text report" />
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 font-mono bg-white border border-slate-200 rounded-xl p-4">
            {item.valuation_text}
          </pre>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-slate-500 print:block">
        MyFNG Car Resale Value · Generated {fmtDate(item.created_at)}
      </p>
    </div>
  );
}

export function buildPrintableValuationHtml(item: ResaleValuationRecord) {
  const rows = detailRows(item);
  const title = [item.make, item.model].filter(Boolean).join(' ') || 'Car Valuation';
  const fileRef = item.vehicle_number || item.id.slice(0, 8);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resale Valuation ${esc(fileRef)}</title>
<style>
@page{margin:16mm}
body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#0f172a;max-width:720px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hero{text-align:center;padding:28px;border-radius:16px;background:linear-gradient(135deg,#0b1f44,#1e3a6e);color:#fff;margin-bottom:16px;border:2px solid #34d399}
.range{font-size:32px;font-weight:900;color:#6ee7b7;margin:10px 0;line-height:1.2}
.mid{font-size:14px;color:#a7f3d0;font-weight:700}
.meta{font-size:12px;color:#cbd5e1;margin-top:10px}
.generated{text-align:center;font-size:11px;color:#64748b;margin-bottom:16px}
section{margin-bottom:16px;border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fff;page-break-inside:avoid}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;color:#0f172a}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px}
.cell label{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;display:block}
.cell span{display:block;font-size:13px;font-weight:600;margin-top:2px;text-transform:capitalize}
.note{font-size:12px;color:#64748b;line-height:1.6;margin:0}
.pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:11px;line-height:1.6;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:0}
.footer{margin-top:8px;font-size:11px;color:#64748b;text-align:center}
</style></head><body>
<div class="hero">
  <div style="font-size:11px;opacity:.85;text-transform:uppercase;letter-spacing:.08em">Estimated Resale Value</div>
  <div class="range">${esc(fmtInr(item.estimate_low))} - ${esc(fmtInr(item.estimate_high))}</div>
  <div class="mid">Mid estimate: ${esc(fmtInr(item.estimate_mid))}</div>
  <div class="meta">${esc(title)}${item.registration_year ? ` · ${item.registration_year}` : ''}${item.odometer ? ` · ${item.odometer.toLocaleString('en-IN')} km` : ''}</div>
  ${item.city_name ? `<div class="meta" style="color:#93c5fd;margin-top:4px">${esc(item.city_name)}</div>` : ''}
</div>
<p class="generated">Generated ${esc(fmtDate(item.created_at))}${item.platform ? ` · ${esc(item.platform)}` : ''}</p>
<section><h2>Customer</h2><div class="grid">
<div class="cell"><label>Customer</label><span>${esc(item.customer_name || 'Guest user')}</span></div>
<div class="cell"><label>Phone</label><span>${esc(item.customer_phone || '-')}</span></div>
</div></section>
<section><h2>Vehicle & valuation inputs</h2><div class="grid">
${rows.map((r) => `<div class="cell"><label>${esc(r.label)}</label><span>${esc(r.value)}</span></div>`).join('')}
</div></section>
<section><h2>Estimate note</h2><p class="note">Indicative range based on brand demand, age depreciation, mileage, condition, tyres, body work, ownership, accident history, insurance, service records, loan status and city market tier. Final price may change after physical inspection.</p></section>
${item.valuation_text ? `<section><h2>Plain text report</h2><pre class="pre">${esc(item.valuation_text)}</pre></section>` : ''}
<p class="footer">MyFNG Car Resale Value · Book via app for free pickup & drop</p>
</body></html>`;
}

export function valuationDownloadBaseName(item: ResaleValuationRecord) {
  const slug = [item.make, item.model].filter(Boolean).join('-').replace(/\s+/g, '-').toLowerCase() || 'valuation';
  return `resale-valuation-${slug}-${item.id.slice(0, 8)}`;
}
