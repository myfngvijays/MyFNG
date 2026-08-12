'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  HOME_SMART_TOOL_PLACEMENT_OPTIONS,
  RSA_SMART_TOOL_PLACEMENT_OPTIONS,
  SEARCH_SMART_TOOL_PLACEMENT_OPTIONS,
  SERVICES_SMART_TOOL_PLACEMENT_OPTIONS,
  SETTINGS_SMART_TOOL_PLACEMENT_OPTIONS,
  normalizeAllowedPhones,
  toggleSmartToolPlacement,
  type SmartToolPlacements,
  type SmartToolScreen,
} from '@/lib/smart-tools-placements';
import type { SmartToolRow } from '@/lib/smart-tools-config';
import { LEGACY_MEMBERSHIP_CODES } from '@/lib/membership-plans-db';

type MembershipPlanOption = {
  id: string;
  name: string;
  code: string;
  membership_type: string;
  active: boolean;
};

type PhoneInputMode = 'paste' | 'csv' | 'sheet';

type Props = {
  tool: SmartToolRow;
  plans: MembershipPlanOption[];
  onChange: (patch: Partial<SmartToolRow>) => void;
};

function PlacementCheckboxGroup({
  title,
  screen,
  options,
  placements,
  onChangePlacements,
}: {
  title: string;
  screen: SmartToolScreen;
  options: Array<{ key: string; label: string }>;
  placements: SmartToolPlacements;
  onChangePlacements: (next: SmartToolPlacements) => void;
}) {
  const section = (placements[screen] || {}) as Record<string, boolean>;
  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{title}</div>
      {options.map((opt) => (
        <label key={opt.key} className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(section[opt.key])}
            onChange={(e) =>
              onChangePlacements(toggleSmartToolPlacement(placements, screen, opt.key, e.target.checked))
            }
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function SmartToolAdvancedFields({ tool, plans, onChange }: Props) {
  const visiblePlans = plans.filter(
    (plan) => !LEGACY_MEMBERSHIP_CODES.has(String(plan.code || '').toUpperCase()),
  );
  const servicePlans = visiblePlans.filter(
    (plan) => String(plan.membership_type || '').toUpperCase() === 'SERVICE',
  );
  const rsaPlans = visiblePlans.filter(
    (plan) => String(plan.membership_type || '').toUpperCase() === 'RSA',
  );
  const visiblePlanIds = new Set(visiblePlans.map((p) => p.id));
  const selectedPlanIds = (tool.allowed_membership_plan_ids || []).filter((id) =>
    visiblePlanIds.has(id),
  );
  const hasPlanRestriction = selectedPlanIds.length > 0;
  const anyMembership = tool.membership_only && !hasPlanRestriction;
  const [phonesDraft, setPhonesDraft] = useState(() => (tool.allowed_phones || []).join('\n'));
  const [phoneMode, setPhoneMode] = useState<PhoneInputMode>('paste');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);

  useEffect(() => {
    setPhonesDraft((tool.allowed_phones || []).join('\n'));
    setSheetUrl('');
    setPhoneMode('paste');
    // Only resync when switching tools — avoid fighting live typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.tool_id]);

  const commitPhones = (raw: string | string[], mode: 'replace' | 'merge' = 'replace') => {
    const incoming = normalizeAllowedPhones(raw);
    const next =
      mode === 'merge'
        ? [...new Set([...(tool.allowed_phones || []), ...incoming])]
        : incoming;
    setPhonesDraft(next.join('\n'));
    onChange({ allowed_phones: next });
    return { incoming, next };
  };

  const togglePlan = (planId: string, checked: boolean) => {
    const base = selectedPlanIds;
    const next = checked
      ? [...new Set([...base, planId])]
      : base.filter((id) => id !== planId);
    onChange({
      allowed_membership_plan_ids: next,
      membership_only: next.length > 0 ? true : tool.membership_only,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target?.result || '');
        const { incoming } = commitPhones(text, 'merge');
        toast.success(
          `${incoming.length} phone number${incoming.length === 1 ? '' : 's'} loaded from ${file.name}`,
        );
      };
      reader.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(ev.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const chunks: string[] = [];
          for (const row of rows) {
            for (const cell of row || []) chunks.push(String(cell || ''));
          }
          const { incoming } = commitPhones(chunks, 'merge');
          toast.success(
            `${incoming.length} phone number${incoming.length === 1 ? '' : 's'} loaded from ${file.name}`,
          );
        } catch {
          toast.error('Could not read Excel file. Try CSV instead.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Unsupported file type. Use .csv, .xlsx, .xls or .txt');
    }
    e.target.value = '';
  };

  const handleSheetFetch = async () => {
    const url = sheetUrl.trim();
    if (!url) return;
    setSheetLoading(true);
    try {
      const res = await fetch('/api/super_admin/notifications/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch sheet');
        return;
      }
      const phones: string[] = Array.isArray(data.phones) ? data.phones : [];
      if (phones.length === 0) {
        toast.error('No phone numbers found in sheet');
        return;
      }
      const { incoming } = commitPhones(phones, 'merge');
      toast.success(
        `${incoming.length} phone number${incoming.length === 1 ? '' : 's'} imported from Google Sheet`,
      );
      setSheetUrl('');
    } catch {
      toast.error('Failed to fetch Google Sheet');
    } finally {
      setSheetLoading(false);
    }
  };

  const renderPlanGroup = (title: string, groupPlans: MembershipPlanOption[]) => {
    if (!groupPlans.length) return null;
    return (
      <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {groupPlans.map((plan) => {
            const selected = selectedPlanIds.includes(plan.id);
            return (
              <button
                key={plan.id}
                type="button"
                title={plan.code}
                disabled={anyMembership}
                onClick={() => togglePlan(plan.id, !selected)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700'
                } ${anyMembership ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {plan.name}
                {!plan.active ? <span className="text-[10px] opacity-80">· Off</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const phoneModes: Array<{ id: PhoneInputMode; label: string }> = [
    { id: 'paste', label: 'Paste numbers' },
    { id: 'csv', label: 'Upload CSV' },
    { id: 'sheet', label: 'Google Sheet' },
  ];

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-gray-500">Membership visibility</div>
        <p className="mt-1 text-xs text-gray-500">
          Leave all unchecked for everyone. Pick specific plans, or use &quot;Any active membership&quot; for all members.
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={anyMembership}
              onChange={(e) =>
                onChange({
                  membership_only: e.target.checked,
                  allowed_membership_plan_ids: e.target.checked ? [] : selectedPlanIds,
                })
              }
            />
            <span className="font-semibold text-amber-900">Any active membership (Prime / RSA / all plans)</span>
          </label>

          {anyMembership ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2 text-xs text-amber-900">
              All active members can see this tool. Uncheck above if you want only specific plans.
            </p>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                {renderPlanGroup('MyFNG Prime / Service', servicePlans)}
                {renderPlanGroup('RSA plans', rsaPlans)}
              </div>
              {hasPlanRestriction ? (
                <p className="text-xs font-semibold text-blue-700">
                  Showing only to users on {selectedPlanIds.length} selected plan
                  {selectedPlanIds.length === 1 ? '' : 's'}.
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  No plan selected = everyone can see this tool (unless phone unlock / other rules apply).
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-black uppercase tracking-wide text-gray-500">Manual phone unlock</div>
        <p className="mt-1 text-xs text-gray-500">
          These logged-in users can open the tool even without membership (members OR these numbers).
        </p>

        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {phoneModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setPhoneMode(mode.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                phoneMode === mode.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {phoneMode === 'paste' ? (
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
              rows={4}
              placeholder={'9876543210\n9123456789'}
              value={phonesDraft}
              onChange={(e) => {
                const value = e.target.value;
                setPhonesDraft(value);
                onChange({ allowed_phones: normalizeAllowedPhones(value) });
              }}
              onBlur={() => commitPhones(phonesDraft, 'replace')}
            />
          ) : null}

          {phoneMode === 'csv' ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-700">
                <Upload className="h-4 w-4" />
                Choose CSV / Excel
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">
                One phone column is enough. Numbers are merged into the unlock list.
              </p>
            </div>
          ) : null}

          {phoneMode === 'sheet' ? (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/... (public sheet URL)"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-24 text-sm"
                />
                <button
                  type="button"
                  disabled={!sheetUrl.trim() || sheetLoading}
                  onClick={() => void handleSheetFetch()}
                  className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {sheetLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  Fetch
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Sheet must be shared as Anyone with the link → Viewer. Phones merge into the unlock list.
              </p>
            </div>
          ) : null}

          {(tool.allowed_phones || []).length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {(tool.allowed_phones || []).length} number
                {(tool.allowed_phones || []).length === 1 ? '' : 's'} unlocked
              </span>
              <button
                type="button"
                onClick={() => commitPhones('', 'replace')}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
              {phoneMode !== 'paste' ? (
                <button
                  type="button"
                  onClick={() => setPhoneMode('paste')}
                  className="text-xs font-semibold text-indigo-700 hover:underline"
                >
                  View / edit list
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <div className="text-xs font-black uppercase tracking-wide text-gray-500">Placements (multi-select)</div>
        <p className="mt-1 text-xs text-gray-500">Choose where this tool appears — same screens as membership cards.</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <PlacementCheckboxGroup
            title="Home screen"
            screen="home"
            options={HOME_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="Search overlay"
            screen="search"
            options={SEARCH_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="Services screen"
            screen="services"
            options={SERVICES_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="RSA screen"
            screen="rsa"
            options={RSA_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="Settings screen"
            screen="settings"
            options={SETTINGS_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
        </div>
      </div>
    </div>
  );
}
