'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Gauge, Shield, Wrench } from 'lucide-react';

type Band = 'GREEN' | 'AMBER' | 'RED';

type HealthReportJson = {
  composite: number;
  band: { label: string; color: string; summary: string };
  dimensions: Array<{ name: string; label: string; score: number; band: Band }>;
  categories: Array<{ category: string; score: number; band: Band; reason: string }>;
  predictive: Array<{ item: string; status: 'overdue' | 'due_soon'; deduction: number; cta: string }>;
  recommendations: Array<{
    title: string;
    severity: 'RED' | 'AMBER' | 'INFO';
    category: string;
    reason: string;
    ctaType: string;
  }>;
  accuracy: 'BASIC' | 'GOOD' | 'DETAILED';
  generatedAt: number;
  odometer: number;
};

type VehicleMeta = {
  reg_number: string;
  make: string | null;
  model: string | null;
  fuel: string | null;
  registration_year: number | null;
  created_at: string;
  customer_phone?: string | null;
  customer_name?: string | null;
  platform?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  ENGINE: 'Engine',
  TRANSMISSION: 'Transmission / Clutch',
  COOLING_AC: 'Cooling & AC',
  ELECTRICAL: 'Battery & Electrical',
  BRAKES: 'Brakes',
  TYRES: 'Tyres',
  SUSPENSION: 'Suspension & Steering',
  COMPLIANCE: 'Compliance',
  MAINTENANCE: 'Maintenance',
};

const CTA_LABELS: Record<string, string> = {
  BOOK_INSPECTION: 'Book Free Inspection',
  BOOK_SERVICE: 'Book Service',
  INSURANCE_HELP: 'Get Insurance Help',
  ADD_TO_CART: 'Add to Cart',
};

const BAND_STYLES: Record<Band, { bg: string; text: string; bar: string; ring: string }> = {
  GREEN: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', ring: 'ring-emerald-200' },
  AMBER: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', ring: 'ring-amber-200' },
  RED: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', ring: 'ring-red-200' },
};

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

function BandBadge({ band }: { band: Band }) {
  const s = BAND_STYLES[band];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {band}
    </span>
  );
}

function ScoreBar({ score, band }: { score: number; band: Band }) {
  const s = BAND_STYLES[band];
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

export function HealthReportDetailView({
  report,
  vehicle,
}: {
  report: HealthReportJson;
  vehicle: VehicleMeta;
}) {
  const priority = report.recommendations.filter((r) => r.severity !== 'INFO' || r.category !== 'PREDICTIVE');
  const preventive = report.predictive.filter((p) => p.status === 'due_soon');

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Hero score */}
      <div
        className="rounded-2xl p-6 text-center text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, #0B1F44 0%, #1e3a6e 100%)`, borderColor: report.band.color, borderWidth: 2 }}
      >
        <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-1">Vehicle Risk Score</p>
        <p className="text-6xl font-black leading-none" style={{ color: report.band.color }}>
          {report.composite}
        </p>
        <p className="text-lg font-bold mt-1" style={{ color: report.band.color }}>
          {report.band.label}
        </p>
        <p className="text-sm text-slate-300 mt-3 max-w-md mx-auto leading-relaxed">{report.band.summary}</p>
      </div>

      {/* Vehicle meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Registration', value: vehicle.reg_number },
          { label: 'Customer', value: vehicle.customer_name || 'Guest user' },
          { label: 'Phone', value: vehicle.customer_phone || '-' },
          { label: 'Vehicle', value: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '-' },
          { label: 'Fuel / Year', value: `${vehicle.fuel || '-'} · ${vehicle.registration_year || '-'}` },
          { label: 'Odometer', value: `${report.odometer.toLocaleString('en-IN')} km` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{item.value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 text-center">
        Generated {fmtDate(vehicle.created_at)}
        {vehicle.platform ? ` · ${String(vehicle.platform).toUpperCase()}` : ''}
      </p>

      {/* Dimensions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={Gauge} title="Risk Dimensions" />
        <div className="space-y-3">
          {report.dimensions.map((d) => (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-slate-700">{d.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{d.score}</span>
                  <BandBadge band={d.band} />
                </div>
              </div>
              <ScoreBar score={d.score} band={d.band} />
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={Wrench} title="Category Breakdown" />
        <div className="divide-y divide-slate-100">
          {report.categories.map((c) => (
            <div key={c.category} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${BAND_STYLES[c.band].bar}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{CATEGORY_LABELS[c.category] || c.category}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-slate-900">{c.score}</span>
                  <BandBadge band={c.band} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority actions */}
      {priority.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionTitle icon={AlertTriangle} title="Priority Actions" />
          <div className="space-y-3">
            {priority.map((r, i) => (
              <div key={`${r.title}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      r.severity === 'RED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {r.severity}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{r.title}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{r.reason}</p>
                <p className="text-[11px] font-semibold text-blue-600 mt-2">{CTA_LABELS[r.ctaType] || r.ctaType}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Preventive */}
      {preventive.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionTitle icon={Clock} title="Coming Up - Preventive" />
          <p className="text-xs text-slate-500 mb-3">Likely due based on age & km, not a detected fault.</p>
          <div className="space-y-2">
            {preventive.map((p, i) => (
              <div key={`${p.item}-${i}`} className="flex items-start gap-2.5 rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2.5">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.item}</p>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">{p.status === 'overdue' ? 'Overdue' : 'Due soon'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Accuracy */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={Shield} title="Report Accuracy" />
        <div className="flex gap-2 mb-2">
          {(['BASIC', 'GOOD', 'DETAILED'] as const).map((lvl) => (
            <span
              key={lvl}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                report.accuracy === lvl
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              {lvl}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
          {report.accuracy === 'DETAILED'
            ? 'Detailed report - great job sharing car details.'
            : report.accuracy === 'GOOD'
              ? 'Answer 2-3 more sections for a more detailed report.'
              : 'Answer 3 more sections to improve accuracy.'}
        </p>
      </div>
    </div>
  );
}

export function buildPrintableReportHtml(report: HealthReportJson, vehicle: VehicleMeta) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const badge = (band: Band) => (band === 'GREEN' ? 'green' : band === 'AMBER' ? 'amber' : 'red');
  const priority = report.recommendations.filter((r) => r.severity !== 'INFO' || r.category !== 'PREDICTIVE');
  const preventive = report.predictive.filter((p) => p.status === 'due_soon');
  const accuracyHint =
    report.accuracy === 'DETAILED'
      ? 'Detailed report - great job sharing car details.'
      : report.accuracy === 'GOOD'
        ? 'Answer 2-3 more sections for a more detailed report.'
        : 'Answer 3 more sections to improve accuracy.';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Health Report ${esc(vehicle.reg_number)}</title>
<style>
@page{margin:16mm}
body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#0f172a;max-width:720px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hero{text-align:center;padding:28px;border-radius:16px;background:linear-gradient(135deg,#0b1f44,#1e3a6e);color:#fff;margin-bottom:16px;border:2px solid ${report.band.color}}
.score{font-size:56px;font-weight:900;color:${report.band.color};margin:8px 0;line-height:1}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.meta div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px}
.meta label{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;display:block}
.meta span{display:block;font-size:13px;font-weight:600;margin-top:2px}
.generated{text-align:center;font-size:11px;color:#64748b;margin-bottom:16px}
section{margin-bottom:16px;border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fff;page-break-inside:avoid}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;color:#0f172a}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.row:last-child{border-bottom:none}
.bar{height:6px;border-radius:999px;background:#e2e8f0;margin-top:6px;overflow:hidden}
.bar span{display:block;height:100%;border-radius:999px}
.badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px}
.green{background:#ecfdf5;color:#047857}.amber{background:#fffbeb;color:#b45309}.red{background:#fef2f2;color:#b91c1c}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:8px}
.card:last-child{margin-bottom:0}
.card-title{font-size:13px;font-weight:700;margin-bottom:4px}
.card-reason{font-size:12px;color:#64748b;line-height:1.5}
.card-cta{font-size:11px;font-weight:700;color:#2563eb;margin-top:6px}
.sev{font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;margin-right:6px}
.sev-red{background:#fee2e2;color:#b91c1c}.sev-amber{background:#fef3c7;color:#b45309}
.pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid #e2e8f0;margin-right:6px;color:#94a3b8}
.pill-on{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
.prevent{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px;margin-bottom:6px;font-size:13px}
.footer{margin-top:8px;font-size:11px;color:#64748b;text-align:center}
</style></head><body>
<div class="hero"><div style="font-size:11px;opacity:.85;text-transform:uppercase;letter-spacing:.08em">Vehicle Risk Score</div>
<div class="score">${report.composite}</div><div style="font-size:18px;font-weight:800;color:${report.band.color}">${esc(report.band.label)}</div>
<p style="font-size:13px;opacity:.9;margin-top:10px;line-height:1.5">${esc(report.band.summary)}</p></div>
<div class="meta">
<div><label>Registration</label><span>${esc(vehicle.reg_number)}</span></div>
<div><label>Vehicle</label><span>${esc([vehicle.make, vehicle.model].filter(Boolean).join(' '))}</span></div>
<div><label>Fuel / Year</label><span>${esc(String(vehicle.fuel || '-'))} · ${vehicle.registration_year || '-'}</span></div>
<div><label>Odometer</label><span>${report.odometer.toLocaleString('en-IN')} km</span></div>
</div>
<p class="generated">Generated ${esc(fmtDate(vehicle.created_at))}</p>
<section><h2>Risk Dimensions</h2>
${report.dimensions
  .map((d) => {
    const color = d.band === 'GREEN' ? '#10b981' : d.band === 'AMBER' ? '#f59e0b' : '#ef4444';
    return `<div style="margin-bottom:10px"><div class="row" style="border:none;padding:0"><span>${esc(d.label)}</span><span><strong>${d.score}</strong><span class="badge ${badge(d.band)}">${d.band}</span></span></div><div class="bar"><span style="width:${d.score}%;background:${color}"></span></div></div>`;
  })
  .join('')}
</section>
<section><h2>Category Breakdown</h2>
${report.categories
  .map(
    (c) => `<div class="row" style="flex-direction:column;align-items:flex-start;border-bottom:1px solid #f1f5f9;padding:10px 0">
<div style="display:flex;width:100%;justify-content:space-between;align-items:center"><strong>${esc(CATEGORY_LABELS[c.category] || c.category)}</strong><span><strong>${c.score}</strong><span class="badge ${badge(c.band)}">${c.band}</span></span></div>
<div class="card-reason" style="margin-top:4px">${esc(c.reason)}</div></div>`,
  )
  .join('')}
</section>
${
  priority.length
    ? `<section><h2>Priority Actions</h2>${priority
        .map(
          (r) => `<div class="card"><div class="card-title"><span class="sev ${r.severity === 'RED' ? 'sev-red' : 'sev-amber'}">${r.severity}</span>${esc(r.title)}</div><div class="card-reason">${esc(r.reason)}</div><div class="card-cta">${esc(CTA_LABELS[r.ctaType] || r.ctaType)}</div></div>`,
        )
        .join('')}</section>`
    : ''
}
${
  preventive.length
    ? `<section><h2>Coming Up - Preventive</h2><p class="card-reason" style="margin:0 0 10px">Likely due based on age & km, not a detected fault.</p>${preventive
        .map((p) => `<div class="prevent"><strong>${esc(p.item)}</strong><div style="font-size:11px;color:#2563eb;font-weight:700;margin-top:2px">${p.status === 'overdue' ? 'Overdue' : 'Due soon'}</div></div>`)
        .join('')}</section>`
    : ''
}
<section><h2>Report Accuracy</h2>
<div style="margin-bottom:8px">${(['BASIC', 'GOOD', 'DETAILED'] as const)
  .map((lvl) => `<span class="pill ${report.accuracy === lvl ? 'pill-on' : ''}">${lvl}</span>`)
  .join('')}</div>
<p class="card-reason">${esc(accuracyHint)}</p></section>
<p class="footer">MyFNG Smart Health Checkup · Book via app for free pickup & drop</p>
</body></html>`;
}
