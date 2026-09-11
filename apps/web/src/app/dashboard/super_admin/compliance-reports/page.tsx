'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileCheck, Download, Loader2, FileText, Shield, Scale } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DataRightsInboxApp from '@/components/admin/data-rights/DataRightsInboxApp';

type SectionId = 'rights' | 'reports';

function sectionFromParam(value: string | null): SectionId {
  return value === 'reports' ? 'reports' : 'rights';
}

function ComplianceReportsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));
  const [reportType, setReportType] = useState<string>('general');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [generating, setGenerating] = useState(false);

  const setSection = (next: SectionId) => {
    router.replace(`/dashboard/super_admin/compliance-reports?section=${next}`);
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date must be before or equal to end date');
      return;
    }

    setGenerating(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        start_date: startDate,
        end_date: endDate,
        format,
      });

      const response = await fetch(`/api/audit/compliance-report?${params.toString()}`);

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const msg = err.details
          ? `${err.error ?? 'Failed to generate report'}: ${err.details}`
          : err.error ?? 'Failed to generate report';
        toast.error(msg);
        return;
      }

      const blob =
        format === 'csv'
          ? await response.blob()
          : new Blob([JSON.stringify(await response.json(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${reportType}-${startDate}-to-${endDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('An error occurred while generating the report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 p-3 sm:p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900">
            <FileCheck className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Compliance</h1>
            <p className="mt-1 text-sm text-slate-600">
              DPDP data-rights inbox and downloadable audit reports — one place for privacy requests and compliance
              exports.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: 'rights' as const, label: 'Data Rights', icon: Scale },
              { id: 'reports' as const, label: 'Reports', icon: FileText },
            ]
          ).map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {section === 'rights' ? (
        <DataRightsInboxApp hideHeader />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Generate audit report</h2>
            <p className="mt-1 text-sm text-slate-500">
              Export activity for the selected window. Use GDPR for DPDP / privacy reviews.
            </p>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Report type</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      { id: 'general', label: 'General Audit', hint: 'Summary statistics', icon: FileText },
                      { id: 'gdpr', label: 'DPDP / GDPR', hint: 'Data privacy requests', icon: Shield },
                      { id: 'soc2', label: 'SOC2', hint: 'Access & change controls', icon: FileCheck },
                      { id: 'iso27001', label: 'ISO27001', hint: 'Security & integrity', icon: Shield },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setReportType(item.id)}
                      className={`rounded-xl border-2 p-3 text-left transition sm:p-4 ${
                        reportType === item.id
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <item.icon className="mb-2 h-5 w-5 text-slate-700" />
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Start date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">End date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Export format</label>
                <div className="flex gap-4">
                  {(['json', 'csv'] as const).map((value) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="format"
                        value={value}
                        checked={format === value}
                        onChange={() => setFormat(value)}
                      />
                      {value.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleGenerateReport()}
                  disabled={generating || !startDate || !endDate}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Generate & download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplianceReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading compliance…</div>}>
      <ComplianceReportsInner />
    </Suspense>
  );
}
