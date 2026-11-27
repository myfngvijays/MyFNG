'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPhoneDisplay, isForeignPhone, toLeadPhone } from '@/lib/phoneIntl';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { mergeAdminStatusChoices } from '@/lib/telecaller/leadDisplayStatus';
import { titleCasePersonName } from '@/lib/telecaller/personName';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  Wrench,
  Calendar,
  FileText,
  ArrowLeft,
  Save,
  Brain,
  X,
  AlertCircle,
  Loader2,
  PhoneCall,
  Share2,
  Crown,
} from 'lucide-react';
import { extractInboundCustomerMessage } from '@/lib/telecaller/redactLeadSource';
import { isTransferAuditNoteText } from '@/lib/telecaller/leadRemarkFields';
import {
  emptySecondCar,
  parseSecondCar,
  serializeSecondCar,
  type CrmSecondCar,
} from '@/lib/telecaller/crmSecondCar';
import CrmServicePlanPicker from '@/components/telecaller/crm/CrmServicePlanPicker';
import CrmCarSearch from '@/components/telecaller/crm/CrmCarSearch';
import LeadTagsPanel from '@/components/telecaller/crm/LeadTagsPanel';
import LeadRecordingBrain from '@/components/telecaller/crm/LeadRecordingBrain';
import CrmReferredByField from '@/components/telecaller/crm/CrmReferredByField';
import {
  parseReferredBy,
  serializeReferredBy,
  type CrmReferredBy,
} from '@/lib/telecaller/crmLeadReference';
import CrmPickupVisitStep from '@/components/telecaller/crm/CrmPickupVisitStep';
import CrmWorkshopPicker from '@/components/telecaller/crm/CrmWorkshopPicker';
import CrmFollowUpDateTime, { snapTimeToTenMinutes } from '@/components/telecaller/crm/CrmFollowUpDateTime';
import { isoToIstParts, istDateTimeToIso } from '@/lib/telecaller/crmDateRange';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { formatDateTime } from '@/lib/utils';

const PIPELINE = [
  { id: 'FRESH', label: 'Fresh' },
  { id: 'INTERESTED', label: 'Interested' },
  { id: 'WILL_VISIT', label: 'Will Visit' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'IN_SERVICE', label: 'In Service' },
  { id: 'DONE', label: 'Done' },
] as const;

function pipelineActiveIndex(lead: any, activityResult: string): number {
  const result = String(activityResult || '').toUpperCase();
  if (result === 'LOST' || result === 'OTHER') return -1;
  if (result === 'SERVICE_DONE') return 5;
  if (result === 'IN_SERVICE') return 4;
  if (result === 'BOOKING_CONFIRMED') return 3;
  if (result === 'WILL_VISIT') return 2;
  if (result === 'INTERESTED' || result === 'CALLBACK' || result === 'RINGING') return 1;
  if (result === 'FRESH') return 0;

  const fromMeta = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  if (fromMeta === 'LOST' || fromMeta === 'OTHER') return -1;
  if (fromMeta === 'SERVICE_DONE') return 5;
  if (fromMeta === 'IN_SERVICE') return 4;
  if (fromMeta === 'BOOKING_CONFIRMED') return 3;
  if (fromMeta === 'WILL_VISIT') return 2;
  if (fromMeta === 'INTERESTED' || fromMeta === 'CALLBACK') return 1;

  const status = String(lead?.status || '').toUpperCase();
  if (status === 'REJECTED') return -1;
  if (status === 'COMPLETED') return 5;
  if (status === 'IN_PROGRESS') return 4;
  if (status === 'VALIDATED') return 3;
  return 0;
}

const ACTIVITY_OPTIONS = [
  // Soft CRM stages live in coupon_meta.last_call_result; DB enum has no CONTACTED.
  { id: 'FRESH', label: 'Fresh', lead_status: 'NEW' as string | null },
  { id: 'RINGING', label: 'Ringing', lead_status: 'NEW' as string | null },
  { id: 'INTERESTED', label: 'Interested', lead_status: 'NEW' as string | null },
  { id: 'WILL_VISIT', label: 'He will visit', lead_status: 'NEW' as string | null },
  { id: 'CALLBACK', label: 'Follow-up', lead_status: 'NEW' as string | null },
  { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed', lead_status: 'VALIDATED' as string | null },
  { id: 'IN_SERVICE', label: 'In Service', lead_status: 'IN_PROGRESS' as string | null },
  { id: 'SERVICE_DONE', label: 'Service Done', lead_status: 'COMPLETED' as string | null },
  { id: 'LOST', label: 'Lost', lead_status: 'REJECTED' as string | null },
  { id: 'OTHER', label: 'Other', lead_status: null },
] as const;

function panelStatusTone(activityResult: string): string {
  const a = String(activityResult || 'FRESH').toUpperCase();
  if (a === 'LOST') return 'border-rose-400 bg-rose-50 text-rose-950';
  if (a === 'OTHER') return 'border-violet-400 bg-violet-50 text-violet-950';
  if (a === 'BOOKING_CONFIRMED') return 'border-emerald-400 bg-emerald-50 text-emerald-950';
  if (a === 'IN_SERVICE') return 'border-blue-500 bg-blue-50 text-blue-950';
  if (a === 'SERVICE_DONE') return 'border-teal-500 bg-teal-50 text-teal-950';
  if (a === 'WILL_VISIT') return 'border-violet-400 bg-violet-50 text-violet-950';
  if (a === 'CALLBACK') return 'border-sky-400 bg-sky-50 text-sky-950';
  if (a === 'INTERESTED') return 'border-orange-400 bg-orange-50 text-orange-950';
  if (a === 'RINGING') return 'border-slate-400 bg-slate-100 text-slate-900';
  return 'border-blue-500 bg-blue-50 text-blue-950';
}

function headerCardClass(activityResult: string): string {
  const a = String(activityResult || '').toUpperCase();
  if (a === 'LOST') return 'bg-rose-700';
  if (a === 'OTHER') return 'bg-violet-700';
  if (a === 'BOOKING_CONFIRMED') return 'bg-emerald-700';
  if (a === 'IN_SERVICE') return 'bg-blue-800';
  if (a === 'SERVICE_DONE') return 'bg-teal-800';
  if (a === 'WILL_VISIT') return 'bg-violet-700';
  if (a === 'CALLBACK') return 'bg-sky-700';
  if (a === 'INTERESTED') return 'bg-orange-700';
  if (a === 'RINGING') return 'bg-slate-600';
  if (a === 'FRESH') return 'bg-[#1D4ED8]';
  return 'bg-[#023D95]';
}

const LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
];

function parseAddressParts(
  raw: string,
  meta: Record<string, unknown> | null | undefined,
): { flat_number: string; area: string; landmark: string } {
  if (meta && typeof meta === 'object') {
    const flat = String(meta.flat_number || '').trim();
    const area = String(meta.area || meta.pickup_address || '').trim();
    const landmark = String(meta.landmark || '')
      .replace(/^Near\s+/i, '')
      .trim();
    if (flat || area || landmark) return { flat_number: flat, area, landmark };
  }
  const parts = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { flat_number: '', area: '', landmark: '' };
  if (parts.length === 1) return { flat_number: '', area: parts[0], landmark: '' };
  const landmarkPart = parts.find((p) => /^near\s+/i.test(p));
  const landmark = landmarkPart ? landmarkPart.replace(/^Near\s+/i, '').trim() : '';
  const withoutLandmark = parts.filter((p) => p !== landmarkPart);
  // Drop trailing "City PIN" style chunk if present
  const maybeCityPin = withoutLandmark[withoutLandmark.length - 1] || '';
  const rest =
    /\d{6}/.test(maybeCityPin) && withoutLandmark.length > 1
      ? withoutLandmark.slice(0, -1)
      : withoutLandmark;
  if (rest.length === 1) return { flat_number: '', area: rest[0], landmark };
  return {
    flat_number: rest[0] || '',
    area: rest.slice(1).join(', '),
    landmark,
  };
}

function composeSmartAddress(parts: {
  flat_number: string;
  area: string;
  landmark: string;
  city: string;
  pincode: string;
}) {
  const landmark = parts.landmark.trim();
  return [
    parts.flat_number.trim(),
    parts.area.trim(),
    landmark ? `Near ${landmark}` : '',
    [parts.city.trim(), parts.pincode.trim()].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

function fieldCls(hasError?: boolean, disabled?: boolean, compact?: boolean) {
  return [
    'w-full min-w-0 max-w-full border text-slate-900 shadow-sm transition',
    compact ? 'rounded-lg px-2.5 py-1.5 text-sm' : 'rounded-xl px-3.5 py-2.5 text-sm',
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023D95]/20 focus:border-[#023D95]',
    disabled ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white hover:border-slate-300',
    hasError ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200',
  ].join(' ');
}

function clipActivity(value: string, max = 90) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function prettyActivityDate(ymd: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(date.getTime())) return ymd;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function prettyActivityTime(hm: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(hm);
  if (!match) return hm;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${match[2]} ${suffix}`;
}

function pushRemarkChange(lines: string[], label: string, before: string, after: string) {
  if (before === after) return;
  if (!before && after) lines.push(`${label} added: ${clipActivity(after)}`);
  else if (before && !after) lines.push(`${label} removed`);
  else lines.push(`${label} updated: ${clipActivity(after)}`);
}

async function serviceNameMap(ids: string[]) {
  const unique = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
  const map: Record<string, string> = {};
  if (!unique.length) return map;
  const { data } = await createClient().from('service_types').select('id, name').in('id', unique);
  for (const row of data || []) {
    map[String(row.id)] = String(row.name || '').trim() || 'Package';
  }
  return map;
}

async function describeLeadActivity(
  prev: Record<string, string>,
  next: Record<string, string>,
  statusLabel: string,
  statusLabels?: Record<string, string>,
) {
  const lines: string[] = [];
  pushRemarkChange(lines, 'Workshop remark', prev.remarks || '', next.remarks || '');
  pushRemarkChange(lines, 'Telecaller remark', prev.notes || '', next.notes || '');

  if ((prev.pickupDate || '') !== (next.pickupDate || '')) {
    lines.push(
      next.pickupDate
        ? `Pickup date selected: ${prettyActivityDate(next.pickupDate)}`
        : 'Pickup date removed',
    );
  }
  if ((prev.pickupTime || '') !== (next.pickupTime || '')) {
    lines.push(
      next.pickupTime
        ? `Pickup time selected: ${prettyActivityTime(next.pickupTime)}`
        : 'Pickup time removed',
    );
  }
  if ((prev.pickup || '') !== (next.pickup || '')) {
    lines.push(next.pickup === '1' ? 'Pickup turned on' : 'Pickup turned off');
  }

  let prevIds: string[] = [];
  let nextIds: string[] = [];
  try {
    prevIds = JSON.parse(prev.services || '[]');
  } catch {
    prevIds = [];
  }
  try {
    nextIds = JSON.parse(next.services || '[]');
  } catch {
    nextIds = [];
  }
  const prevSet = new Set(prevIds);
  const nextSet = new Set(nextIds);
  const changedIds = [
    ...nextIds.filter((id) => !prevSet.has(id)),
    ...prevIds.filter((id) => !nextSet.has(id)),
  ];
  if (changedIds.length) {
    const names = await serviceNameMap(changedIds);
    for (const id of nextIds) {
      if (!prevSet.has(id)) lines.push(`Package selected: ${names[id] || 'Package'}`);
    }
    for (const id of prevIds) {
      if (!nextSet.has(id)) lines.push(`Package removed: ${names[id] || 'Package'}`);
    }
  }

  const beforeCoupons = new Set(String(prev.coupons || '').split(', ').filter(Boolean));
  const afterCoupons = new Set(String(next.coupons || '').split(', ').filter(Boolean));
  for (const code of afterCoupons) {
    if (!beforeCoupons.has(code)) lines.push(`Coupon selected: ${code}`);
  }
  for (const code of beforeCoupons) {
    if (!afterCoupons.has(code)) lines.push(`Coupon removed: ${code}`);
  }

  const simple: Array<[string, string]> = [
    ['name', 'Name'],
    ['phone', 'Phone'],
    ['alt', 'Alternate phone'],
    ['email', 'Email'],
    ['pin', 'Pincode'],
    ['city', 'City'],
    ['workshop', 'Workshop'],
    ['flat', 'Flat'],
    ['area', 'Area'],
    ['landmark', 'Landmark'],
    ['reg', 'Car number'],
    ['car', 'Car model'],
    ['year', 'Year'],
    ['fuel', 'Fuel'],
    ['odo', 'Odometer'],
    ['priority', 'Priority'],
    ['pickupAddr', 'Pickup address'],
  ];
  for (const [key, label] of simple) {
    if ((prev[key] || '') === (next[key] || '')) continue;
    const after = String(next[key] || '').trim();
    if (!after) lines.push(`${label} removed`);
    else if (key === 'pickupAddr') lines.push(`${label} updated`);
    else lines.push(`${label} updated to ${clipActivity(after)}`);
  }
  if ((prev.status || '') !== (next.status || '')) {
    const previousLabel =
      statusLabels?.[prev.status] ||
      ACTIVITY_OPTIONS.find((option) => option.id === prev.status)?.label ||
      prev.status ||
      '—';
    lines.unshift(`Status: ${previousLabel} → ${statusLabel}`);
  }
  if ((prev.repeat || '') !== (next.repeat || '')) {
    lines.push(next.repeat === '1' ? 'Marked repeat customer' : 'Repeat customer removed');
  }
  if ((prev.custom || '') !== (next.custom || '')) lines.push('Custom fields updated');
  if ((prev.second || '') !== (next.second || '')) lines.push('Second car updated');
  if ((prev.referred || '') !== (next.referred || '')) lines.push('Referred by updated');
  return lines;
}

function FieldLabel({
  children,
  required,
  compact,
}: {
  children: ReactNode;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <label
      className={`block font-bold uppercase tracking-wide text-slate-500 ${
        compact ? 'mb-0.5 text-[10px]' : 'mb-1.5 text-[11px]'
      }`}
    >
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

function ReasonPicker({
  kind,
  query,
  onQuery,
  reasons,
  selected,
  onBack,
  onPick,
  onCreated,
}: {
  kind: 'lost' | 'other';
  query: string;
  onQuery: (value: string) => void;
  reasons: string[];
  selected: string;
  onBack: () => void;
  onPick: (reason: string) => void;
  onCreated: (reason: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const label = kind === 'lost' ? 'Lost' : 'Other';
  const q = query.trim().toLowerCase();
  const list = [
    ...(selected && !reasons.some((reason) => reason.toLowerCase() === selected.toLowerCase()) ? [selected] : []),
    ...reasons,
  ].filter((reason) => !q || reason.toLowerCase().includes(q));

  const addOther = async () => {
    const name = draft.trim();
    if (!name || busy || kind !== 'other') return;
    setBusy(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_other_reason', name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(json?.error || 'Could not add');
      const saved = String(json?.reason?.name || name);
      onCreated(saved);
      onPick(saved);
      setDraft('');
    } catch (e: any) {
      alert(e?.message || 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${kind === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
          {label}
        </span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search Reason"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <button type="button" onClick={onBack} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
        <span aria-hidden>←</span> Back
      </button>
      <div className="max-h-[280px] overflow-y-auto pb-1">
        {list.length === 0 ? <p className="px-4 py-3 text-sm text-slate-400">No reason</p> : null}
        {list.map((reason) => {
          const active = reason.toLowerCase() === String(selected || '').toLowerCase();
          return (
            <button
              key={reason}
              type="button"
              onClick={() => onPick(reason)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-[#2563eb]' : 'border-slate-300'}`}>
                {active ? <span className="h-2 w-2 rounded-full bg-[#2563eb]" /> : null}
              </span>
              <span className="min-w-0 break-words">{reason}</span>
            </button>
          );
        })}
      </div>
      {kind === 'other' ? (
        <div className="flex gap-2 border-t border-slate-100 p-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Naya other item"
            className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs outline-none"
          />
          <button type="button" disabled={busy || !draft.trim()} onClick={() => void addOther()} className="rounded-lg bg-[#023D95] px-2 text-xs font-bold text-white disabled:opacity-50">
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OtherReasonField({
  value,
  onChange,
  header,
}: {
  value: string;
  onChange: (name: string) => void;
  header?: boolean;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lead-manager/statuses');
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const names = (Array.isArray(json?.other_reasons) ? json.other_reasons : [])
          .map((r: { name?: string }) => String(r?.name || '').trim())
          .filter(Boolean);
        setItems(names);
      } catch {
        /* empty list is fine */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = async () => {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_other_reason', name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(json?.error || 'Could not add');
      const saved = String(json?.reason?.name || name);
      setItems((prev) => (prev.some((n) => n.toLowerCase() === saved.toLowerCase()) ? prev : [...prev, saved]));
      onChange(saved);
      setDraft('');
    } catch (e: any) {
      alert(e?.message || 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  const selectCls = header
    ? 'h-10 min-w-[150px] max-w-[200px] rounded-xl bg-white text-[#023D95] pl-3 pr-8 text-xs font-bold shadow-sm outline-none'
    : ic();
  return (
    <div className={header ? 'flex flex-wrap items-center gap-1.5' : 'sm:col-span-2'}>
      {header ? null : <FieldLabel>Other</FieldLabel>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
        aria-label="Other reason"
      >
        <option value="">Other reason</option>
        {value && !items.some((name) => name.toLowerCase() === value.toLowerCase()) ? (
          <option value={value}>{value}</option>
        ) : null}
        {items.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <div className={header ? 'flex items-center gap-1.5' : 'mt-2 flex gap-2'}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void addItem()}
          placeholder="Naya other item"
          className={header ? 'h-10 w-32 rounded-xl bg-white px-3 text-xs font-semibold text-slate-800 outline-none' : ic()}
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void addItem()}
          className="shrink-0 rounded-xl bg-[#004AAD] px-3 text-xs font-bold text-white disabled:opacity-50 h-10"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  tone = 'slate',
  compact = false,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo';
  /** Bookings drawer — dense admin-style sections */
  compact?: boolean;
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white',
    sky: 'border-sky-200/80 bg-gradient-to-br from-sky-50/70 to-white',
    amber: 'border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white',
    violet: 'border-violet-200/80 bg-gradient-to-br from-violet-50/60 to-white',
    indigo: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 to-white',
  };
  const compactTones: Record<string, string> = {
    slate: 'border-slate-400 bg-white',
    emerald: 'border-emerald-400 bg-emerald-50/80',
    sky: 'border-sky-400 bg-sky-50/70',
    amber: 'border-amber-400 bg-amber-50/75',
    violet: 'border-violet-400 bg-violet-50/60',
    indigo: 'border-indigo-400 bg-indigo-50/70',
  };
  if (compact) {
    return (
      <section
        className={`min-w-0 rounded-xl border-2 p-3 shadow-md ${compactTones[tone] || compactTones.slate}`}
      >
        <p className="mb-2 flex items-center gap-1.5 border-b border-slate-300/80 pb-1.5 text-xs font-bold uppercase tracking-wide text-[#023D95]">
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </p>
        {children}
      </section>
    );
  }
  return (
    <section className={`min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 ${tones[tone]}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#023D95] text-white shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base sm:text-lg font-black text-[#023D95]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export type CrmLeadEditFormProps = {
  leadId: string;
  embedded?: boolean;
  /** Super Admin bookings drawer style — white panel, no blue hero / pipeline. */
  bookingsPanelStyle?: boolean;
  /** Portal target for status + Save in telecaller drawer header (element id). */
  panelHeaderActionsId?: string;
  /** WhatsApp ke side panel: layout column ke andar, save bar screen pe nahi. */
  sidePanel?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  onActivity?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onShare?: () => void;
  onDraftChange?: (draft: { pincode: string; carModel: string }) => void;
  /** Panel / pricing: show inline on field instead of global banner */
  externalFieldErrors?: Partial<Record<'pincode' | 'vehicle_make', string>>;
  calling?: boolean;
  isLeadManagerRole?: boolean;
  seedLead?: Record<string, any> | null;
};

function YearPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (year: string) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1994 }, (_, index) => String(thisYear + 1 - index));
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className={`${className} text-left`}>
        {value || 'Select year'}
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 grid max-h-48 w-full grid-cols-3 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => {
                onChange(year);
                setOpen(false);
              }}
              className={`rounded-lg px-1 py-1.5 text-xs font-bold ${
                value === year ? 'bg-[#004AAD] text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CrmLeadEditForm({
  leadId,
  embedded = false,
  bookingsPanelStyle = false,
  panelHeaderActionsId = 'lead-panel-header-actions',
  sidePanel = false,
  onCancel,
  onSaved,
  onActivity,
  onCall,
  onWhatsApp,
  onShare,
  onDraftChange,
  externalFieldErrors,
  calling = false,
  isLeadManagerRole,
  seedLead = null,
}: CrmLeadEditFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { base, isLeadManager: isLmFromPath } = getCrmDashboardBase(pathname);
  const isLeadManager = isLeadManagerRole ?? isLmFromPath;

  const handleCancel = () => {
    if (onCancel) onCancel();
    else router.push(`${base}/leads`);
  };

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [repeatCustomer, setRepeatCustomer] = useState(false);
  const [repeatRemark, setRepeatRemark] = useState<string | null>(null);
  const [hasMembership, setHasMembership] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Service add-ons (optional; catalog picker handles service types)
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  const SHOW_SERVICE_ADDONS = false;

  // Coupons (multi-select)
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsError, setCouponsError] = useState('');
  const [couponCodes, setCouponCodes] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [manualCoupon, setManualCoupon] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);

  const [cities, setCities] = useState<any[]>([]);
  const [lostReasonOptions, setLostReasonOptions] = useState<string[]>(LOST_REASONS);
  const [activityOptions, setActivityOptions] = useState<
    Array<{ id: string; label: string; lead_status: string | null }>
  >(ACTIVITY_OPTIONS.map((option) => ({ ...option })));
  const [otherReasonOptions, setOtherReasonOptions] = useState<string[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPanel, setStatusPanel] = useState<'list' | 'lost' | 'other'>('list');
  const [reasonQuery, setReasonQuery] = useState('');
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [statusPos, setStatusPos] = useState<{ top: number; right: number } | null>(null);
  const [panelActionsHost, setPanelActionsHost] = useState<HTMLElement | null>(null);
  const [carDisplay, setCarDisplay] = useState('');
  const [showSecondCar, setShowSecondCar] = useState(false);
  const [secondCar, setSecondCar] = useState<CrmSecondCar>(emptySecondCar());
  const [secondCarDisplay, setSecondCarDisplay] = useState('');
  const [referredBy, setReferredBy] = useState<CrmReferredBy | null>(null);
  const [referredTo, setReferredTo] = useState<
    { id: string; lead_number: string; customer_name: string; customer_phone: string }[]
  >([]);
  const [resolvingCity, setResolvingCity] = useState(false);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<Array<{ id: string; name: string }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    flat_number: '',
    area: '',
    landmark: '',
    city_id: '',
    city: '',
    pincode: '',

    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: '',
    odometer_km: '',
    vehicle_class: '',

    service_types: [] as string[],
    service_addons: [] as string[],
    service_type: '',
    problem_description: '',
    description: '',

    pickup_required: false,
    pickup_address: '',
    pickup_flat: '',
    pickup_area: '',
    pickup_landmark: '',
    pickup_date: '',
    pickup_time: '',
    workshop_id: '',
    workshop_name: '',
    address_type: 'home' as 'home' | 'work' | 'other',

    notes: '',
    lead_priority: 'NORMAL',
    activity_result: 'RINGING',
    lost_reason: '',
    other_reason: '',
    activity_notes: '',
    callback_date: '',
    callback_time: '',
    service_done_date: '',
    repeat_customer: false,
  });
  useEffect(() => {
    fetchLeadDetails();
    if (SHOW_SERVICE_ADDONS) fetchServiceAddons();
    fetchCities();
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setRepeatCustomer(false);
    setRepeatRemark(null);
    setHasMembership(false);
    void fetch(`/api/crm/repeat-customer?lead_id=${encodeURIComponent(leadId)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (cancelled) return;
        setRepeatCustomer(Boolean(json?.repeat_customer));
        setRepeatRemark(json?.repeat_remark ? String(json.repeat_remark) : null);
        setHasMembership(Boolean(json?.has_membership));
      })
      .catch(() => {
        /* badge stays off */
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/lead-manager/statuses')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const names = (Array.isArray(json?.lost_reasons) ? json.lost_reasons : [])
          .map((r: { name?: string }) => String(r?.name || '').trim())
          .filter(Boolean);
        if (names.length) setLostReasonOptions(names);
        const otherNames = (Array.isArray(json?.other_reasons) ? json.other_reasons : [])
          .map((r: { name?: string }) => String(r?.name || '').trim())
          .filter(Boolean);
        setOtherReasonOptions(otherNames);
        const rows = Array.isArray(json?.statuses) ? json.statuses : [];
        if (rows.length) {
          const pipeline = new Map(
            rows.map((row: { code?: string; pipeline_status?: string | null }) => [
              String(row?.code || '').trim().toUpperCase(),
              row?.pipeline_status ? String(row.pipeline_status).toUpperCase() : '',
            ]),
          );
          setActivityOptions(
            mergeAdminStatusChoices(rows).map((choice) => {
              const builtin = ACTIVITY_OPTIONS.find((option) => option.id === choice.id);
              return {
                id: choice.id,
                label: choice.label,
                lead_status: builtin
                  ? builtin.lead_status
                  : pipeline.get(choice.id) || 'NEW',
              };
            }),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!bookingsPanelStyle) {
      setPanelActionsHost(null);
      return;
    }
    const pick = () => setPanelActionsHost(document.getElementById(panelHeaderActionsId));
    pick();
    const id = window.requestAnimationFrame(pick);
    return () => window.cancelAnimationFrame(id);
  }, [bookingsPanelStyle, panelHeaderActionsId, leadId]);

  useEffect(() => {
    if (!statusOpen) return;
    const place = () => {
      const rect = statusBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setStatusPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (statusBtnRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-lead-status-menu]')) return;
      setStatusOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatusOpen(false);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [statusOpen]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/lead-manager/fields')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setCustomFieldDefs(Array.isArray(json?.fields) ? json.fields : []);
      })
      .catch(() => {
        if (!cancelled) setCustomFieldDefs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchAvailableCouponsForForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.city_id, formData.service_types.join(',')]);

  async function fetchAvailableCouponsForForm() {
    setCouponsLoading(true);
    setCouponsError('');
    try {
      const params = new URLSearchParams();
      if (formData.city_id) params.set('city_id', formData.city_id);
      if (formData.service_types.length > 0) params.set('service_type_ids', formData.service_types.join(','));
      const res = await fetch(`/api/telecaller/coupons?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load coupons');
      setAvailableCoupons(json?.coupons || []);
    } catch (e: any) {
      setCouponsError(e?.message || 'Failed to load coupons');
      setAvailableCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  }

  const selectedCodes = useMemo(
    () => couponCodes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean),
    [couponCodes]
  );

  const addCouponCode = (codeRaw: string) => {
    touchLead();
    const code = String(codeRaw || '').trim().toUpperCase();
    if (!code) return;
    setCouponCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setAppliedCoupon(code);
  };

  const removeCouponCode = (codeRaw: string) => {
    touchLead();
    const code = String(codeRaw || '').trim().toUpperCase();
    if (!code) return;
    setCouponCodes((prev) => {
      const next = prev.filter((c) => c !== code);
      if (appliedCoupon === code) setAppliedCoupon(next[0] || '');
      return next;
    });
  };

  async function saveCouponsOnly() {
    setCouponSaving(true);
    try {
      const supabase = createClient();
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      const nextApplied = applied && selectedCodes.includes(applied) ? applied : (selectedCodes[0] || '');
      const nextCouponMeta =
        selectedCodes.length > 0
          ? {
              selected_codes: selectedCodes,
              applied_code: nextApplied || null,
            }
          : null;

      const { error } = await supabase
        .from('service_leads')
        .update({
          coupon_code: nextApplied || null,
          discount_amount: 0,
          coupon_meta: nextCouponMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;

      // Keep local lead state in sync without resetting formData edits
      setLead((prev: any) =>
        prev
          ? {
              ...prev,
              coupon_code: nextApplied || null,
              coupon_meta: nextCouponMeta,
              discount_amount: 0,
            }
          : prev
      );
      alert('Coupon saved');
    } catch (e: any) {
      alert(e?.message || 'Failed to save coupon');
    } finally {
      setCouponSaving(false);
    }
  }

  async function fetchCities() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, state, city_pincodes')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  }

  const resolveCityFromPincode = async (pinRaw: string) => {
    const pincode = String(pinRaw || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!/^\d{6}$/.test(pincode)) return;
    setResolvingCity(true);
    try {
      let rows = cities;
      if (!rows.some((c) => c.city_pincodes != null)) {
        const { data } = await createClient()
          .from('cities')
          .select('id, name, state, city_pincodes')
          .eq('is_active', true);
        rows = Array.isArray(data) ? data : [];
        if (rows.length) setCities(rows);
      }
      const hit = (rows || []).find((c: any) => String(c.city_pincodes || '').includes(pincode));
      let cityName = String(hit?.name || '').trim();
      let cityId = String(hit?.id || '').trim();
      if (!cityName) {
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
          const json = await res.json().catch(() => []);
          const office = json?.[0]?.PostOffice?.[0];
          cityName = String(office?.District || office?.Name || '').trim();
        } catch {
          cityName = '';
        }
      }
      if (cityName || cityId) {
        setFormData((prev) => ({
          ...prev,
          pincode,
          city: cityName || prev.city,
          city_id: cityId || prev.city_id,
          area: String(prev.area || '').trim() ? prev.area : cityName || prev.area,
        }));
      } else {
        setFormData((prev) => ({ ...prev, pincode }));
      }
    } catch {
      /* ignore */
    } finally {
      setResolvingCity(false);
    }
  };

  const lookupCustomerByPhone = async (phoneRaw: string) => {
    const phone10 = String(phoneRaw || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (phone10.length !== 10) return;
    setLookingUpPhone(true);
    setLookupHint(null);
    try {
      const res = await fetch(`/api/telecaller/crm/customer-lookup?phone=${phone10}`);
      const json = await res.json();
      if (!res.ok || !json?.found) {
        setLookupHint('No past customer match for this number');
        return;
      }
      const fill = json.fill || {};
      setFormData((prev) => {
        const next = { ...prev };
        const empty = (v: string) => !String(v || '').trim();
        if (empty(next.customer_name) && fill.customer_name) next.customer_name = titleCasePersonName(String(fill.customer_name));
        if (empty(next.customer_email) && fill.customer_email) next.customer_email = String(fill.customer_email);
        if (empty(next.vehicle_number) && fill.vehicle_number) {
          next.vehicle_number = String(fill.vehicle_number);
        }
        if (empty(next.vehicle_make) && fill.vehicle_make) next.vehicle_make = String(fill.vehicle_make);
        if (empty(next.vehicle_model) && fill.vehicle_model) next.vehicle_model = String(fill.vehicle_model);
        if (empty(next.city) && fill.city) next.city = String(fill.city);
        if (empty(next.city_id) && fill.city_id) next.city_id = String(fill.city_id);
        if (empty(next.pincode) && fill.pincode) next.pincode = String(fill.pincode);
        const addr = String(fill.customer_address || fill.pickup_address || '');
        if (empty(next.area) && empty(next.flat_number) && addr) {
          const parsed = parseAddressParts(addr, null);
          next.flat_number = parsed.flat_number;
          next.area = parsed.area || addr;
          next.landmark = parsed.landmark;
          next.customer_address = addr;
        }
        return next;
      });
      if (fill.vehicle_make || fill.vehicle_model) {
        setCarDisplay([fill.vehicle_make, fill.vehicle_model].filter(Boolean).join(' '));
      }
      if (fill.pincode && String(fill.pincode).replace(/\D/g, '').length === 6) {
        void resolveCityFromPincode(String(fill.pincode));
      }
      setLookupHint('Details auto-filled from past records (empty fields only)');
    } catch {
      setLookupHint('Lookup failed — fill manually');
    } finally {
      setLookingUpPhone(false);
    }
  };

  async function fetchServiceAddons() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .eq('is_active', true);
      
      if (error) throw error;
      setServiceAddons(data || []);
    } catch (error) {
      console.error('Error fetching service addons:', error);
    }
  }

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data, error: leadError } = await supabase
        .from('service_leads')
        .select(
          `*, assigned_telecaller:assigned_telecaller_id(id, full_name, phone), workshop:workshops(name)`,
        )
        .eq('id', leadId)
        .single();
      if (leadError) throw leadError;
      const leadData = data;

      setLead(leadData);

      // Parse service_type_ids and subservice_ids
      let serviceTypeIds = [];
      let subserviceIds = [];
      
      if (leadData.service_type_ids) {
        try {
          serviceTypeIds = typeof leadData.service_type_ids === 'string' 
            ? JSON.parse(leadData.service_type_ids) 
            : leadData.service_type_ids;
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
        }
      }
      
      if (leadData.subservice_ids) {
        try {
          subserviceIds = typeof leadData.subservice_ids === 'string' 
            ? JSON.parse(leadData.subservice_ids) 
            : leadData.subservice_ids;
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
        }
      }

      const meta =
        leadData.coupon_meta && typeof leadData.coupon_meta === 'object'
          ? leadData.coupon_meta
          : {};
      const addrParts = parseAddressParts(
        String(leadData.customer_address || leadData.pickup_address || ''),
        meta,
      );
      
      // Populate form with existing data
      setFormData({
        customer_name: titleCasePersonName(leadData.customer_name || ''),
        customer_phone: leadData.customer_phone || '',
        customer_alternate_phone: leadData.customer_alternate_phone || '',
        customer_email: leadData.customer_email || '',
        customer_address: leadData.customer_address || '',
        flat_number: addrParts.flat_number,
        area: addrParts.area || leadData.customer_address || '',
        landmark: addrParts.landmark,
        city_id: leadData.city_id || '',
        city: leadData.city || '',
        pincode: leadData.pincode || '',
        
        vehicle_number: leadData.vehicle_number || '',
        vehicle_make: leadData.vehicle_make || '',
        model_id: leadData.model_id || '',
        vehicle_model: leadData.vehicle_model || '',
        vehicle_variant: leadData.vehicle_variant || '',
        vehicle_year: leadData.vehicle_year?.toString() || '',
        vehicle_fuel_type: leadData.vehicle_fuel_type || '',
        odometer_km: leadData.odometer_km?.toString() || '',
        vehicle_class: leadData.vehicle_class || meta.vehicle_class || '',
        
        service_types: serviceTypeIds || [],
        service_addons: subserviceIds || [],
        service_type: leadData.service_type || '',
        problem_description:
          extractInboundCustomerMessage(leadData.problem_description) ||
          extractInboundCustomerMessage(leadData.description) ||
          '',
        description:
          extractInboundCustomerMessage(leadData.description) ||
          extractInboundCustomerMessage(leadData.problem_description) ||
          '',
        
        pickup_required: leadData.pickup_required || false,
        pickup_address: leadData.pickup_address || '',
        ...(() => {
          const fromMeta = {
            pickup_flat: String(meta.pickup_flat || '').trim(),
            pickup_area: String(meta.pickup_area || '').trim(),
            pickup_landmark: String(meta.pickup_landmark || '')
              .replace(/^Near\s+/i, '')
              .trim(),
          };
          if (fromMeta.pickup_flat || fromMeta.pickup_area || fromMeta.pickup_landmark) {
            return fromMeta;
          }
          const parsed = parseAddressParts(String(leadData.pickup_address || ''), null);
          if (parsed.flat_number || parsed.area || parsed.landmark) {
            return {
              pickup_flat: parsed.flat_number,
              pickup_area: parsed.area,
              pickup_landmark: parsed.landmark,
            };
          }
          return {
            pickup_flat: addrParts.flat_number,
            pickup_area: addrParts.area || String(leadData.customer_address || ''),
            pickup_landmark: addrParts.landmark,
          };
        })(),
        pickup_date: (() => {
          const slot = leadData.preferred_slot_start || leadData.preferred_date;
          if (!slot) return '';
          try {
            const d = new Date(slot);
            if (Number.isNaN(d.getTime())) return String(slot).slice(0, 10);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const ymd = `${yyyy}-${mm}-${dd}`;
            // Past dates trip HTML5 min=today and block Save — clear for soft-lead edits
            const now = new Date();
            const tYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            if (ymd < tYmd) return '';
            return ymd;
          } catch {
            return '';
          }
        })(),
        pickup_time: (() => {
          const slot = leadData.preferred_slot_start;
          if (!slot) return '';
          try {
            const d = new Date(slot);
            if (Number.isNaN(d.getTime())) return '';
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mi}`;
          } catch {
            return '';
          }
        })(),
        workshop_id: String(leadData.workshop_id || ''),
        workshop_name: String(leadData.workshop?.name || leadData.workshop_name || ''),
        address_type: (['home', 'work', 'other'].includes(String(meta.address_type || ''))
          ? String(meta.address_type)
          : 'home') as 'home' | 'work' | 'other',

        notes: (() => {
          const n = String(leadData.notes || '').trim();
          return isTransferAuditNoteText(n) ? '' : n;
        })(),
        lead_priority: leadData.lead_priority || 'NORMAL',
        activity_result: (() => {
          const raw = String(leadData?.coupon_meta?.last_call_result || '').toUpperCase().trim();
          if (raw) return raw;
          const st = String(leadData?.status || '').toUpperCase();
          if (st === 'VALIDATED') return 'BOOKING_CONFIRMED';
          if (st === 'IN_PROGRESS') return 'IN_SERVICE';
          if (st === 'COMPLETED') return 'SERVICE_DONE';
          if (st === 'REJECTED') return 'LOST';
          if (st === 'CONTACTED' || st === 'ASSIGNED' || st === 'ACCEPTED') return 'INTERESTED';
          return 'FRESH';
        })(),
        lost_reason: String(leadData?.coupon_meta?.last_lost_reason || ''),
        other_reason: String(leadData?.coupon_meta?.last_other_reason || ''),
        activity_notes: String(
          leadData?.coupon_meta?.telecaller_remarks ||
            (isTransferAuditNoteText(String(leadData?.notes || '')) ? '' : leadData?.notes) ||
            '',
        ).trim(),
        repeat_customer: (() => {
          const flag = leadData?.coupon_meta?.repeat_customer;
          if (flag === true || flag === 1) return true;
          const text = String(flag || '').trim().toLowerCase();
          if (text === 'yes' || text === 'true' || text === '1' || text === 'checked') return true;
          const imported =
            leadData?.meta?.import_fields && typeof leadData.meta.import_fields === 'object'
              ? leadData.meta.import_fields
              : {};
          const marked = String(imported['Repeat Customer'] || '').trim().toLowerCase();
          return marked === 'yes' || marked === 'true' || marked === '1' || marked === 'checked';
        })(),
        service_done_date: (() => {
          const imported =
            leadData?.meta?.import_fields && typeof leadData.meta.import_fields === 'object'
              ? leadData.meta.import_fields
              : {};
          const raw = String(
            leadData?.coupon_meta?.service_done_at ||
              leadData?.meta?.service_date ||
              imported['Service Date'] ||
              imported['Service Done Date'] ||
              '',
          ).trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
          const d = new Date(raw);
          if (!raw || Number.isNaN(d.getTime())) return '';
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        })(),
        callback_date: (() => {
          const parts = isoToIstParts(leadData.next_follow_up_at);
          return parts?.ymd || '';
        })(),
        callback_time: (() => {
          const parts = isoToIstParts(leadData.next_follow_up_at);
          return parts ? snapTimeToTenMinutes(parts.hm) : '';
        })(),
      });
      const customBag = leadData?.coupon_meta?.custom_fields;
      setCustomFieldValues(
        customBag && typeof customBag === 'object' && !Array.isArray(customBag)
          ? Object.fromEntries(Object.entries(customBag).map(([k, v]) => [k, String(v ?? '')]))
          : {},
      );
      setCarDisplay(
        [leadData.vehicle_make, leadData.vehicle_model].filter(Boolean).join(' '),
      );
      const existingSecond = parseSecondCar(meta);
      if (existingSecond) {
        setShowSecondCar(true);
        setSecondCar(existingSecond);
        setSecondCarDisplay([existingSecond.vehicle_make, existingSecond.vehicle_model].filter(Boolean).join(' '));
      } else {
        setShowSecondCar(false);
        setSecondCar(emptySecondCar());
        setSecondCarDisplay('');
      }
      setReferredBy(parseReferredBy(meta));
      void fetch(`/api/telecaller/crm/lead-reference?lead_id=${encodeURIComponent(leadId)}`)
        .then((refRes) => refRes.json().catch(() => ({})))
        .then((refJson) => {
          if (refJson?.referred_by) setReferredBy(refJson.referred_by);
          setReferredTo(Array.isArray(refJson?.referred_to) ? refJson.referred_to : []);
        })
        .catch(() => setReferredTo([]));

      // Initialize coupons from stored data (best-effort)
      const existingSelected = Array.isArray((leadData as any)?.coupon_meta?.selected_codes)
        ? (leadData as any).coupon_meta.selected_codes.map((c: any) => String(c || '').trim().toUpperCase()).filter(Boolean)
        : [];
      const existingApplied = String((leadData as any)?.coupon_code || '').trim().toUpperCase();
      const init = existingSelected.length > 0 ? existingSelected : (existingApplied ? [existingApplied] : []);
      setCouponCodes(init);
      setAppliedCoupon(existingApplied && init.includes(existingApplied) ? existingApplied : (init[0] || ''));

    } catch (error) {
      console.error('Error fetching lead:', error);
      setError('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    touchLead();
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => {
      const pickupKey =
        name === 'area' ? 'pickup_area' : name === 'flat_number' ? 'pickup_flat' : name === 'landmark' ? 'pickup_landmark' : '';
      const keepPickup =
        pickupKey &&
        (String(prev[pickupKey as 'pickup_area'] || '').trim() === '' ||
          String(prev[pickupKey as 'pickup_area'] || '') === String(prev[name as 'area'] || ''));
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        ...(keepPickup && pickupKey ? { [pickupKey]: value } : {}),
      };
    });

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleMultiSelect = (name: string, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[name as keyof typeof prev] as string[];
      const newArray = checked
        ? [...currentArray, value]
        : currentArray.filter(item => item !== value);
      
      return {
        ...prev,
        [name]: newArray
      };
    });
    
    // Clear error
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  function validateVehicleNumber(vehicleNumber: string): boolean {
    // Indian vehicle number format: AB12CD1234 or AB-12-CD-1234 or AB 12 CD 1234
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    const cleanNumber = vehicleNumber.replace(/[-\s]/g, '').toUpperCase();
    return regex.test(cleanNumber);
  }

  const validateForm = (): boolean => true;

  const handleSubmit = async (e?: React.FormEvent, quiet = false): Promise<boolean> => {
    e?.preventDefault();
    if (!quiet && !validateForm()) return false;
    // One save at a time: a status pick saves at once and the 800ms autosave must not double it.
    if (quiet && saveInFlight.current) return false;
    const openedSnap = currentActivitySnap();
    const savedSnap = activityBase.current;
    const nothingChanged = Boolean(savedSnap && JSON.stringify(savedSnap) === JSON.stringify(openedSnap));
    // Only autosave may skip. A pressed Save always writes: some pickers (pincode, workshop, car)
    // change the form without marking it edited, so the snapshot can look unchanged.
    if (quiet && (nothingChanged || !userEdited.current)) {
      activityBase.current = openedSnap;
      statusToastPending.current = false;
      return true;
    }

    saveInFlight.current = true;
    setSaving(true);
    if (quiet) setAutoSaveState('saving');

    try {
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      const nextApplied = applied && selectedCodes.includes(applied) ? applied : (selectedCodes[0] || '');

      const customerMessage =
        extractInboundCustomerMessage(formData.problem_description) ||
        String(formData.problem_description || '').trim() ||
        null;
      const selectedActivity =
        activityOptions.find((o) => o.id === formData.activity_result) ||
        ACTIVITY_OPTIONS.find((o) => o.id === formData.activity_result) ||
        ACTIVITY_OPTIONS[0];
      const prevMeta =
        lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
      const resolvedLost =
        selectedActivity.id === 'LOST' ? formData.lost_reason.trim() || 'Other Reasons' : '';
      const resolvedOther = selectedActivity.id === 'OTHER' ? formData.other_reason.trim() : '';
      const statusLabel =
        selectedActivity.id === 'LOST'
          ? `Lost · ${resolvedLost}`
          : resolvedOther
            ? `Other · ${resolvedOther}`
            : selectedActivity.label;
      const nextSnap = currentActivitySnap();
      const prevSnap = activityBase.current;
      const statusLabels = Object.fromEntries(activityOptions.map((option) => [option.id, option.label]));
      const lines = prevSnap ? await describeLeadActivity(prevSnap, nextSnap, statusLabel, statusLabels) : [];
      pendingActivitySnap.current = nextSnap;
      const historyEntry = lines.length
        ? {
            at: new Date().toISOString(),
            summary: lines.join('\n'),
            remark: null,
            status: selectedActivity.id,
          }
        : null;
      const prevHistory = Array.isArray((prevMeta as any).profile_history)
        ? (prevMeta as any).profile_history
        : [];
      const composedAddress = composeSmartAddress({
        flat_number: formData.flat_number,
        area: formData.area,
        landmark: formData.landmark,
        city: formData.city,
        pincode: formData.pincode,
      });
      const nextMeta = {
        ...prevMeta,
        last_call_result: selectedActivity.id,
        last_call_label: statusLabel,
        last_call_at: new Date().toISOString(),
        telecaller_remarks: formData.activity_notes.trim() || null,
        last_lost_reason:
          selectedActivity.id === 'LOST' ? resolvedLost : (prevMeta as any).last_lost_reason || null,
        last_other_reason:
          selectedActivity.id === 'OTHER' ? resolvedOther || null : (prevMeta as any).last_other_reason || null,
        custom_fields: customFieldValues,
        service_done_at:
          selectedActivity.id === 'SERVICE_DONE'
            ? formData.service_done_date
            : (prevMeta as any).service_done_at || null,
        profile_history: historyEntry ? [historyEntry, ...prevHistory].slice(0, 50) : prevHistory,
        flat_number: formData.flat_number.trim() || null,
        landmark: formData.landmark.trim() || null,
        area: formData.area.trim() || null,
        vehicle_class: formData.vehicle_class || (prevMeta as any).vehicle_class || null,
        pickup_flat: formData.pickup_flat.trim() || null,
        pickup_area: formData.pickup_area.trim() || null,
        pickup_landmark: formData.pickup_landmark.trim() || null,
        second_car: showSecondCar ? serializeSecondCar(secondCar) : null,
        referred_by: serializeReferredBy(referredBy),
        repeat_customer: Boolean(formData.repeat_customer),
      };

      const payload: any = {
        customer_name: formData.customer_name,
        customer_phone: toLeadPhone(formData.customer_phone),
        customer_alternate_phone: formData.customer_alternate_phone || null,
        customer_email: formData.customer_email || null,
        customer_address: composedAddress || null,
        city_id: formData.city_id || null,
        city: formData.city || null,
        pincode: formData.pincode || null,

        vehicle_number: formData.vehicle_number.trim().toUpperCase() || lead?.vehicle_number || 'PENDING',
        vehicle_make: formData.vehicle_make,
        model_id: formData.model_id || null,
        vehicle_model: formData.vehicle_model,
        vehicle_variant: null,
        vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
        vehicle_fuel_type: formData.vehicle_fuel_type,
        odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,

        service_types: formData.service_types,
        service_addons: formData.service_addons,
        service_type: formData.service_type,
        // Only customer message — never re-save WhatsApp/Trigger wrappers
        problem_description: customerMessage,
        description: customerMessage,

        pickup_required: formData.pickup_required,
        workshop_id: formData.workshop_id || null,
        pickup_address: formData.pickup_required
          ? composeSmartAddress({
              flat_number: formData.pickup_flat,
              area: formData.pickup_area || formData.area,
              landmark: formData.pickup_landmark,
              city: formData.city,
              pincode: formData.pincode,
            }) || composedAddress
          : formData.pickup_address || composedAddress || null,
        preferred_slot_start: formData.pickup_date
          ? (() => {
              const local = new Date(
                `${formData.pickup_date}T${formData.pickup_time || '10:00'}:00`,
              );
              return Number.isNaN(local.getTime()) ? null : local.toISOString();
            })()
          : null,

        notes: formData.notes || null,
        lead_priority: formData.lead_priority,
        ...(selectedActivity.lead_status
          ? { status: selectedActivity.lead_status }
          : { status: 'NEW' }),
        coupon_meta: nextMeta,

        coupon_codes: selectedCodes,
        applied_coupon: nextApplied || null,
        form_hydrated: true,
      };

      if (
        selectedActivity.id === 'CALLBACK' &&
        formData.callback_date &&
        formData.callback_time
      ) {
        const iso = istDateTimeToIso(formData.callback_date, formData.callback_time);
        if (iso) {
          payload.follow_up_required = true;
          payload.next_follow_up_at = iso;
        }
      } else if (
        selectedActivity.id === 'IN_SERVICE' ||
        selectedActivity.id === 'SERVICE_DONE' ||
        selectedActivity.id === 'LOST'
      ) {
        payload.follow_up_required = false;
        payload.next_follow_up_at = null;
      }

      const res = await fetch(`/api/telecaller/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update lead');
      if (pendingActivitySnap.current) activityBase.current = pendingActivitySnap.current;
      setAutoSaveState('saved');
      if (statusToastPending.current) {
        statusToastPending.current = false;
        toast.success(`Status saved: ${statusLabel}`);
      }
      if (historyEntry) onActivity?.();

      if (payload.next_follow_up_at) {
        try {
          await fetch('/api/telecaller/follow-ups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: leadId,
              follow_up_type: 'CALLBACK',
              scheduled_time: payload.next_follow_up_at,
              reason: formData.activity_notes.trim() || 'Follow-up',
              priority: formData.lead_priority || 'NORMAL',
            }),
          });
        } catch {
          // best-effort reminder row
        }
      }

      if (!quiet) {
        if (onSaved) onSaved();
        // WhatsApp side panel: stay on the chat instead of jumping to the lead page.
        else if (sidePanel) toast.success('Lead saved');
        else router.push(`${base}/leads/${leadId}`);
      }

    } catch (error: any) {
      console.error('Error updating lead:', error);
      setAutoSaveState('error');
      statusToastPending.current = false;
      if (!quiet) alert('Failed to update lead: ' + (error?.message || String(error)));
      // Autosave used to fail silently — show why, so a status that "won't change" is visible.
      else toast.error('Auto-save failed: ' + (error?.message || String(error)));
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
    return true;
  };

  const [saveSlot, setSaveSlot] = useState<HTMLElement | null>(null);
  const [brainOpen, setBrainOpen] = useState(false);
  useEffect(() => {
    const openIq = () => setBrainOpen(true);
    window.addEventListener('myfng:open-lead-iq', openIq);
    return () => window.removeEventListener('myfng:open-lead-iq', openIq);
  }, []);
  useEffect(() => {
    if (!embedded) return;
    setSaveSlot(document.getElementById('lead-sidebar-save'));
  }, [embedded, leadId]);

  const saveInFlight = useRef(false);
  // Set when the status dropdown / pipeline is used: save right away instead of waiting.
  const statusSaveRequested = useRef(false);
  const statusToastPending = useRef(false);
  const saveRef = useRef(handleSubmit);
  saveRef.current = handleSubmit;
  const skipAutoSave = useRef(true);
  const userEdited = useRef(false);
  const activityBase = useRef<Record<string, string> | null>(null);
  const touchLead = () => {
    userEdited.current = true;
  };
  const pendingActivitySnap = useRef<Record<string, string> | null>(null);
  const currentActivitySnap = () => {
    const n = (v: unknown) => String(v ?? '').trim();
    return {
      name: n(formData.customer_name),
      phone: toLeadPhone(n(formData.customer_phone)),
      alt: n(formData.customer_alternate_phone),
      email: n(formData.customer_email),
      pin: n(formData.pincode),
      city: n(formData.city),
      workshop: n(formData.workshop_name) || n(formData.workshop_id),
      flat: n(formData.flat_number),
      area: n(formData.area),
      landmark: n(formData.landmark),
      reg: n(formData.vehicle_number).toUpperCase(),
      car: `${n(formData.vehicle_make)} ${n(formData.vehicle_model)}`.trim(),
      year: n(formData.vehicle_year),
      fuel: n(formData.vehicle_fuel_type),
      odo: n(formData.odometer_km),
      priority: n(formData.lead_priority),
      pickup: formData.pickup_required ? '1' : '0',
      pickupDate: n(formData.pickup_date),
      pickupTime: n(formData.pickup_time),
      pickupAddr: `${n(formData.pickup_flat)}|${n(formData.pickup_area)}|${n(formData.pickup_landmark)}`,
      repeat: formData.repeat_customer ? '1' : '0',
      remarks: n(formData.activity_notes),
      notes: n(formData.notes),
      services: JSON.stringify(formData.service_types || []),
      coupons: [...selectedCodes].map((code) => String(code || '').trim().toUpperCase()).filter(Boolean).sort().join(', '),
      status: n(formData.activity_result),
      lost: n(formData.lost_reason),
      other: n(formData.other_reason),
      custom: JSON.stringify(customFieldValues || {}),
      second: showSecondCar ? JSON.stringify(secondCar) : '',
      referred: JSON.stringify(referredBy || null),
    };
  };
  useEffect(() => {
    skipAutoSave.current = true;
    userEdited.current = false;
    activityBase.current = null;
  }, [leadId]);
  // Closing the panel / switching chat within the 800ms autosave delay must not drop the last edit.
  useEffect(
    () => () => {
      if (userEdited.current) void saveRef.current(undefined, true);
    },
    [],
  );
  useEffect(() => {
    onDraftChange?.({
      pincode: String(formData.pincode || '').replace(/\D/g, '').slice(0, 6),
      carModel: `${String(formData.vehicle_make || '').trim()} ${String(formData.vehicle_model || '').trim()}`.trim(),
    });
  }, [formData.pincode, formData.vehicle_make, formData.vehicle_model, onDraftChange]);
  useEffect(() => {
    if (loading || !statusSaveRequested.current) return;
    statusSaveRequested.current = false;
    statusToastPending.current = true;
    void saveRef.current(undefined, true);
  }, [formData.activity_result, formData.lost_reason, formData.other_reason, loading]);
  useEffect(() => {
    if (loading) return;
    if (!userEdited.current) {
      skipAutoSave.current = false;
      activityBase.current = currentActivitySnap();
      return;
    }
    const timer = window.setTimeout(() => {
      void saveRef.current(undefined, true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [formData, secondCar, showSecondCar, referredBy, customFieldValues, couponCodes, appliedCoupon, loading]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-16' : 'min-h-[50vh]'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="card text-center py-8 sm:py-10 md:py-12 px-4 sm:px-6">
        <AlertCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
        <p className="text-gray-700 mb-3 sm:mb-4 text-sm sm:text-base">{error || 'Lead not found'}</p>
        <button type="button" onClick={handleCancel} className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
          Go Back
        </button>
      </div>
    );
  }

  const dockFooter = saveSlot;
  const inDrawer = Boolean(dockFooter);
  const compact = inDrawer || sidePanel || bookingsPanelStyle;
  const showTelecallerHero = !bookingsPanelStyle;
  const ic = (hasError?: boolean, disabled?: boolean) => fieldCls(hasError, disabled, bookingsPanelStyle);
  const grid4 = bookingsPanelStyle
    ? 'grid grid-cols-2 gap-2 lg:grid-cols-4'
    : sidePanel
      ? 'grid grid-cols-1 gap-3'
      : 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4';

  const statusReason =
    formData.activity_result === 'LOST'
      ? String(formData.lost_reason || '').trim()
      : formData.activity_result === 'OTHER'
        ? String(formData.other_reason || '').trim()
        : '';

  const statusTone = panelStatusTone(formData.activity_result);

  const bookingsPanelToolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex min-w-0 max-w-full items-center gap-1.5">
        <button
          ref={statusBtnRef}
          type="button"
          aria-label="Change lead status"
          aria-expanded={statusOpen}
          onClick={() => {
            setStatusPanel('list');
            setReasonQuery('');
            setStatusOpen((open) => !open);
          }}
          className={`inline-flex h-9 min-w-[116px] max-w-[150px] items-center justify-between gap-2 rounded-lg border-2 px-2.5 text-sm font-bold shadow-sm ${statusTone}`}
        >
          <span className="truncate">
            {activityOptions.find((option) => option.id === formData.activity_result)?.label ||
              formData.activity_result ||
              'Fresh'}
          </span>
          <span aria-hidden className="text-[10px] text-slate-400">
            ▾
          </span>
        </button>
        {formData.activity_result === 'LOST' || formData.activity_result === 'OTHER' ? (
          <button
            type="button"
            onClick={() => {
              setStatusPanel(formData.activity_result === 'LOST' ? 'lost' : 'other');
              setReasonQuery('');
              setStatusOpen(true);
            }}
            className="inline-flex h-9 min-w-[120px] max-w-[160px] items-center gap-1 rounded-lg border-2 border-slate-200 bg-white px-2 text-left text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            title={statusReason || 'Pick reason'}
          >
            <span className="shrink-0 text-slate-400" aria-hidden>
              ↳
            </span>
            <span className="min-w-0 flex-1 truncate">{statusReason || 'Reason…'}</span>
            <span className="shrink-0 text-[10px] text-slate-400" aria-hidden>
              ▾
            </span>
          </button>
        ) : null}
      </div>
      {statusOpen && statusPos
        ? createPortal(
            <div
              data-lead-status-menu
              style={{ top: statusPos.top, right: statusPos.right }}
              className="fixed z-[11000] w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl"
            >
              {statusPanel === 'list' ? (
                <div className="max-h-[360px] overflow-y-auto py-1">
                  {(activityOptions.some((option) => option.id === formData.activity_result)
                    ? activityOptions
                    : [
                        ...activityOptions,
                        { id: formData.activity_result, label: formData.activity_result, lead_status: 'NEW' },
                      ]
                  ).map((option) => {
                    const active = option.id === formData.activity_result;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          if (option.id === 'LOST' || option.id === 'OTHER') {
                            setStatusPanel(option.id === 'LOST' ? 'lost' : 'other');
                            setReasonQuery('');
                            return;
                          }
                          touchLead();
                          statusSaveRequested.current = true;
                          setFormData((prev) => ({ ...prev, activity_result: option.id }));
                          setStatusOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${
                          active ? 'bg-[#2563eb] font-semibold text-white' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-4 text-xs">{active ? '✓' : ''}</span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <ReasonPicker
                  kind={statusPanel}
                  query={reasonQuery}
                  onQuery={setReasonQuery}
                  reasons={statusPanel === 'lost' ? lostReasonOptions : otherReasonOptions}
                  selected={statusPanel === 'lost' ? formData.lost_reason : formData.other_reason}
                  onBack={() => {
                    setStatusPanel('list');
                    setReasonQuery('');
                  }}
                  onPick={(reason) => {
                    touchLead();
                    statusSaveRequested.current = true;
                    setFormData((prev) =>
                      statusPanel === 'lost'
                        ? { ...prev, activity_result: 'LOST', lost_reason: reason }
                        : { ...prev, activity_result: 'OTHER', other_reason: reason },
                    );
                    setStatusOpen(false);
                  }}
                  onCreated={(reason) => {
                    setOtherReasonOptions((prev) => (prev.includes(reason) ? prev : [...prev, reason]));
                  }}
                />
              )}
            </div>,
            document.body,
          )
        : null}
      <button
        type="submit"
        form="crm-lead-edit-form"
        disabled={saving}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );

  const saveBar = (
    <div
      className={
        sidePanel
          ? 'sticky bottom-0 z-20 mt-3 border-t border-slate-200 bg-white px-2 py-2'
          : inDrawer
          ? 'flex flex-col gap-2'
          : 'fixed bottom-3 sm:bottom-4 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] sm:px-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]'
      }
    >
      <div className={inDrawer ? 'flex w-full items-center gap-2' : 'mx-auto flex max-w-5xl flex-col sm:flex-row gap-2 sm:gap-3'}>
        {inDrawer ? null : (
          <button type="button" onClick={handleCancel} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <X className="w-4 h-4" /> Back
          </button>
        )}
        {sidePanel ? (
          // WhatsApp side panel autosaves while you type — no Save button, just status.
          <div
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${
              autoSaveState === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
            aria-live="polite"
          >
            {saving || autoSaveState === 'saving' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : autoSaveState === 'error' ? (
              <button type="submit" form="crm-lead-edit-form" className="underline">
                Save failed — retry
              </button>
            ) : autoSaveState === 'saved' ? (
              <><Save className="w-4 h-4" /> All changes saved</>
            ) : (
              <><Save className="w-4 h-4" /> Auto-save on</>
            )}
          </div>
        ) : (
          <button type="submit" form="crm-lead-edit-form" disabled={saving} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#023D95] px-3 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#012f73] disabled:opacity-60">
            {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>) : (<><Save className="w-4 h-4" /> Save Changes</>)}
          </button>
        )}
        <button
          type="button"
          onClick={() => setBrainOpen(true)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
          aria-label="Lead recording analysis"
          title="Lead recording"
        >
          <Brain className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={
        sidePanel
          ? 'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#f4f7fb]'
          : bookingsPanelStyle
            ? 'flex w-full min-w-0 flex-col bg-white'
            : `${embedded ? 'w-full' : 'max-w-5xl mx-auto'} ${inDrawer ? 'space-y-3 pb-2' : 'space-y-4 pb-28'} ${embedded ? '' : 'px-3 sm:px-4'}`
      }
    >
      {showTelecallerHero ? (
      <div
        className={
          sidePanel ? 'shrink-0 px-3 pt-3' : inDrawer ? 'sticky top-0 z-30 space-y-2 bg-[#f4f7fb] pb-2' : ''
        }
      >
      <div
        className={`relative overflow-hidden rounded-2xl text-white shadow-lg transition-colors ${headerCardClass(formData.activity_result)} ${compact ? 'p-3' : 'p-4 sm:p-6'}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_55%)]" />
        <div className={`relative flex flex-col ${compact ? 'gap-2' : 'gap-4'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl bg-white/15 hover:bg-white/25 p-2 shrink-0 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                {compact ? null : (
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  {isLeadManager ? 'Lead Manager · Service Lead Details' : 'Telecaller · Service Lead Details'}
                </p>
                )}
                <h1 className={`flex min-w-0 items-center gap-2 font-black text-white ${compact ? 'text-lg leading-tight' : 'text-xl sm:text-2xl md:text-3xl mt-0.5'}`}>
                  {hasMembership ? <Crown className="h-6 w-6 shrink-0 text-purple-200" aria-label="Membership customer" /> : null}
                  <span className={sidePanel ? 'break-words leading-tight' : 'truncate'}>{titleCasePersonName(formData.customer_name || lead.customer_name) || 'Lead'}</span>
                </h1>
                <p className="text-sm text-white/90 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-mono font-bold text-white">#{lead.lead_number}</span>
                  {formData.customer_phone || lead.customer_phone ? (
                    <span className="text-white/95">{isForeignPhone(formData.customer_phone || lead.customer_phone) ? formatPhoneDisplay(formData.customer_phone || lead.customer_phone) : formData.customer_phone || lead.customer_phone}</span>
                  ) : null}
                  {lead.created_at ? (
                    <span className="text-white/90">Created {formatDateTime(lead.created_at)}</span>
                  ) : null}
                </p>
                {repeatCustomer || formData.repeat_customer ? (
                  <p className="mt-2 inline-flex max-w-full rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">
                    Repeat Customer{repeatRemark ? ` · ${repeatRemark}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {compact ? null : (
              <button
                type="submit"
                form="crm-lead-edit-form"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-3 text-sm font-extrabold text-[#023D95] shadow disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              )}
              {onCall && (formData.customer_phone || lead.customer_phone) ? (
                <button
                  type="button"
                  disabled={calling}
                  title="Click to call"
                  onClick={onCall}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow disabled:opacity-60"
                >
                  <PhoneCall className="w-4 h-4" />
                </button>
              ) : null}
              {onWhatsApp && (formData.customer_phone || lead.customer_phone) ? (
                <button
                  type="button"
                  title="WhatsApp"
                  onClick={onWhatsApp}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white shadow"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                </button>
              ) : null}
              {onShare ? (
                <button
                  type="button"
                  title={isLeadManager ? 'Assign TC' : 'Transfer'}
                  onClick={onShare}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              ) : null}
              <button
                ref={statusBtnRef}
                type="button"
                aria-label="Change lead status"
                aria-expanded={statusOpen}
                onClick={() => {
                  setStatusPanel('list');
                  setReasonQuery('');
                  setStatusOpen((open) => !open);
                }}
                className="inline-flex h-10 min-w-[140px] items-center justify-between gap-2 rounded-xl bg-white px-3 text-xs font-bold text-[#023D95] shadow-sm"
              >
                <span className="truncate">
                  {activityOptions.find((option) => option.id === formData.activity_result)?.label ||
                    formData.activity_result ||
                    'Fresh'}
                </span>
                <span aria-hidden className="text-[10px] text-slate-400">▾</span>
              </button>
              {statusOpen && statusPos
                ? createPortal(
                    <div
                      data-lead-status-menu
                      style={{ top: statusPos.top, right: statusPos.right }}
                      className="fixed z-[11000] w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl"
                    >
                      {statusPanel === 'list' ? (
                        <div className="max-h-[360px] overflow-y-auto py-1">
                          {(activityOptions.some((option) => option.id === formData.activity_result)
                            ? activityOptions
                            : [
                                ...activityOptions,
                                { id: formData.activity_result, label: formData.activity_result, lead_status: 'NEW' },
                              ]
                          ).map((option) => {
                            const active = option.id === formData.activity_result;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  if (option.id === 'LOST' || option.id === 'OTHER') {
                                    setStatusPanel(option.id === 'LOST' ? 'lost' : 'other');
                                    setReasonQuery('');
                                    return;
                                  }
                                  touchLead();
                                  statusSaveRequested.current = true;
                                  setFormData((prev) => ({ ...prev, activity_result: option.id }));
                                  setStatusOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${
                                  active ? 'bg-[#2563eb] font-semibold text-white' : 'hover:bg-slate-50'
                                }`}
                              >
                                <span className="w-4 text-xs">{active ? '✓' : ''}</span>
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <ReasonPicker
                          kind={statusPanel}
                          query={reasonQuery}
                          onQuery={setReasonQuery}
                          reasons={
                            statusPanel === 'lost'
                              ? lostReasonOptions
                              : otherReasonOptions
                          }
                          selected={statusPanel === 'lost' ? formData.lost_reason : formData.other_reason}
                          onBack={() => {
                            setStatusPanel('list');
                            setReasonQuery('');
                          }}
                          onPick={(reason) => {
                            touchLead();
                            statusSaveRequested.current = true;
                            setFormData((prev) =>
                              statusPanel === 'lost'
                                ? { ...prev, activity_result: 'LOST', lost_reason: reason }
                                : { ...prev, activity_result: 'OTHER', other_reason: reason },
                            );
                            setStatusOpen(false);
                          }}
                          onCreated={(reason) => {
                            setOtherReasonOptions((prev) => (prev.includes(reason) ? prev : [...prev, reason]));
                          }}
                        />
                      )}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>

          <div className={`max-w-full rounded-xl bg-white/10 ${sidePanel ? 'overflow-x-auto p-1.5' : compact ? 'overflow-x-auto p-1.5' : 'overflow-x-auto p-3'}`}>
            <div className={`flex items-center gap-1 ${sidePanel ? 'w-max min-w-full' : compact ? 'min-w-0' : 'min-w-[520px]'}`}>
              {PIPELINE.map((step, idx) => {
                const active = pipelineActiveIndex(lead, formData.activity_result);
                const lost = active < 0;
                const done = !lost && idx <= active;
                const current = !lost && idx === active;
                const activityId =
                  step.id === 'CONFIRMED'
                    ? 'BOOKING_CONFIRMED'
                    : step.id === 'DONE'
                      ? 'SERVICE_DONE'
                      : step.id;
                return (
                  <div key={step.id} className={sidePanel ? 'shrink-0' : 'flex items-center flex-1 min-w-0'}>
                    <button
                      type="button"
                      onClick={() => {
                        touchLead();
                        statusSaveRequested.current = true;
                        setFormData((prev) => ({
                          ...prev,
                          activity_result: activityId,
                        }));
                      }}
                      className={`${sidePanel ? 'whitespace-nowrap px-2.5' : 'flex-1 truncate px-2'} rounded-lg py-1.5 text-center text-[11px] font-bold transition ${
                        lost
                          ? 'bg-rose-500/40 text-white'
                          : done
                            ? current
                              ? 'bg-white text-[#023D95]'
                              : 'bg-emerald-400/80 text-emerald-950'
                            : 'bg-white/10 text-blue-100 hover:bg-white/20'
                      }`}
                    >
                      {step.label}
                    </button>
                    {idx < PIPELINE.length - 1 ? (
                      <div
                        className={`w-2 h-0.5 shrink-0 ${done ? 'bg-emerald-300' : 'bg-white/20'}`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            {pipelineActiveIndex(lead, formData.activity_result) < 0 ? (
              <p className="text-[11px] text-rose-100 mt-2 font-semibold">Lead marked Lost / Rejected</p>
            ) : null}
          </div>
        </div>
      </div>
      </div>
      ) : null}
      {bookingsPanelStyle && panelActionsHost ? createPortal(bookingsPanelToolbar, panelActionsHost) : null}

      <form
        id="crm-lead-edit-form"
        onSubmit={handleSubmit}
        onChangeCapture={touchLead}
        // Pickers (pincode, workshop, car, status chips) change data by click, not by an input
        // change event — mark the form edited on any click / key too so autosave picks them up.
        onClickCapture={touchLead}
        onKeyDownCapture={touchLead}
        noValidate
        className={
          sidePanel
            ? 'min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-3'
            : bookingsPanelStyle
              ? 'space-y-2.5'
              : 'space-y-4'
        }
      >
        <SectionCard title="Customer Details" icon={User} tone="emerald" compact={bookingsPanelStyle}>
          <div
            className={
              bookingsPanelStyle
                ? grid4
                : sidePanel
                  ? 'grid grid-cols-1 gap-3'
                  : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4'
            }
          >
            <div>
              <FieldLabel compact={bookingsPanelStyle} required>
                Customer Name
              </FieldLabel>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={(e) => {
                  touchLead();
                  const customer_name = titleCasePersonName(e.target.value);
                  setFormData((prev) => ({ ...prev, customer_name }));
                }}
                className={ic(Boolean(errors.customer_name))}
                required
              />
              {errors.customer_name ? <p className="mt-1 text-xs text-rose-600">{errors.customer_name}</p> : null}
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle} required>
                Phone Number
              </FieldLabel>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {isForeignPhone(formData.customer_phone) ? (
                  // Foreign WhatsApp number (e.g. +966): show it with its country code, keep it as is.
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formatPhoneDisplay(formData.customer_phone)}
                    readOnly
                    title="International number — country code kept"
                    className={`${ic(Boolean(errors.customer_phone))} pl-9 bg-amber-50`}
                  />
                ) : (
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => {
                      touchLead();
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData((prev) => ({ ...prev, customer_phone: v }));
                      setLookupHint(null);
                    }}
                    onBlur={(e) => void lookupCustomerByPhone(e.target.value)}
                    className={`${ic(Boolean(errors.customer_phone))} pl-9`}
                    maxLength={10}
                    required
                  />
                )}
              </div>
              {lookingUpPhone ? (
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking past records…
                </p>
              ) : lookupHint ? (
                <p className="mt-1 text-xs font-semibold text-[#004AAD]">{lookupHint}</p>
              ) : bookingsPanelStyle ? null : (
                <p className="mt-1 text-[10px] text-slate-400">Auto-fills name / car / address if this number exists in DB</p>
              )}
              {errors.customer_phone ? <p className="mt-1 text-xs text-rose-600">{errors.customer_phone}</p> : null}
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Alternate Phone</FieldLabel>
              <input type="tel" name="customer_alternate_phone" value={formData.customer_alternate_phone} onChange={handleChange} className={ic()} maxLength={10} />
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Email</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" name="customer_email" value={formData.customer_email} onChange={handleChange} className={`${ic()} pl-9`} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 flex items-center justify-between gap-1">
                <FieldLabel compact={bookingsPanelStyle}>Pincode</FieldLabel>
                {bookingsPanelStyle && formData.city ? (
                  <span className="truncate text-[10px] font-semibold text-[#004AAD]">{formData.city}</span>
                ) : null}
              </div>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={(e) => {
                    touchLead();
                    const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData((prev) => ({
                      ...prev,
                      pincode: pin,
                      ...(pin.length < 6 ? { city: '', city_id: '' } : {}),
                    }));
                    if (pin.length === 6) void resolveCityFromPincode(pin);
                  }}
                  className={`${ic(Boolean(errors.pincode || externalFieldErrors?.pincode))} pl-9`}
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              {!bookingsPanelStyle && resolvingCity ? (
                <p className="mt-1 text-xs text-slate-500">Finding city…</p>
              ) : !bookingsPanelStyle && formData.city ? (
                <p className="mt-1 text-xs font-semibold text-[#004AAD]">{formData.city}</p>
              ) : !bookingsPanelStyle && formData.pincode.length === 6 ? (
                <p className="mt-1 text-xs text-slate-500">Pincode saved. Area city map mein nahi hai.</p>
              ) : bookingsPanelStyle && resolvingCity ? (
                <p className="mt-0.5 text-[10px] text-slate-500">Finding city…</p>
              ) : null}
              {errors.pincode || externalFieldErrors?.pincode || errors.city_id ? (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.pincode || externalFieldErrors?.pincode || errors.city_id}
                </p>
              ) : null}
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Flat / Building</FieldLabel>
              <input type="text" name="flat_number" value={formData.flat_number} onChange={handleChange} className={ic()} placeholder="Flat / house no." />
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Area / Street</FieldLabel>
              <input type="text" name="area" value={formData.area} onChange={handleChange} className={ic(Boolean(errors.area))} placeholder="Society, road, locality" />
              {errors.area ? <p className="mt-1 text-xs text-rose-600">{errors.area}</p> : null}
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Landmark</FieldLabel>
              <input type="text" name="landmark" value={formData.landmark} onChange={handleChange} className={ic()} placeholder="Near …" />
            </div>
            {!bookingsPanelStyle ? (
              <div
                className={
                  sidePanel ? 'min-w-0' : 'sm:col-span-2 lg:col-span-4'
                }
              >
                <CrmWorkshopPicker
                  pincode={formData.pincode}
                  city={formData.city}
                  cityId={formData.city_id}
                  workshopId={formData.workshop_id}
                  workshopName={formData.workshop_name}
                  onPick={(id, name) =>
                    setFormData((prev) => ({ ...prev, workshop_id: id, workshop_name: name }))
                  }
                />
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Vehicle Details" icon={Car} tone="sky" compact={bookingsPanelStyle}>
          <div
            className={
              bookingsPanelStyle
                ? grid4
                : sidePanel
                  ? 'grid grid-cols-1 gap-3'
                  : 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'
            }
          >
            <div className={bookingsPanelStyle ? 'min-w-0' : sidePanel && !bookingsPanelStyle ? 'min-w-0' : 'col-span-2 lg:col-span-1'}>
              <FieldLabel compact={bookingsPanelStyle}>Vehicle Number</FieldLabel>
              <input
                type="text"
                name="vehicle_number"
                value={formData.vehicle_number}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    vehicle_number: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12),
                  }))
                }
                className={`${ic(Boolean(errors.vehicle_number))} uppercase tracking-wide font-semibold`}
                placeholder="MH12AB1234 or NA"
              />
              {errors.vehicle_number ? <p className="mt-1 text-xs text-rose-600">{errors.vehicle_number}</p> : null}
            </div>
            <div className={bookingsPanelStyle ? 'min-w-0' : sidePanel ? 'min-w-0' : 'col-span-2 lg:col-span-2'}>
              <CrmCarSearch
                label="Car Model"
                placeholder="Type model (e.g. Swift, City, Rapid)"
                displayValue={carDisplay}
                invalid={Boolean(errors.vehicle_make || externalFieldErrors?.vehicle_make)}
                onSelect={(car) => {
                  touchLead();
                  setFormData((prev) => ({
                    ...prev,
                    vehicle_make: car.make,
                    vehicle_model: car.model,
                    model_id: car.id,
                    vehicle_variant: '',
                    vehicle_class: car.vehicleClass || '',
                  }));
                  setCarDisplay([car.make, car.model].filter(Boolean).join(' '));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.vehicle_make;
                    delete next.model_id;
                    return next;
                  });
                }}
                onClear={() => {
                  setFormData((prev) => ({
                    ...prev,
                    vehicle_make: '',
                    vehicle_model: '',
                    model_id: '',
                    vehicle_class: '',
                  }));
                  setCarDisplay('');
                }}
              />
              {errors.vehicle_make || externalFieldErrors?.vehicle_make ? (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.vehicle_make || externalFieldErrors?.vehicle_make}
                </p>
              ) : null}
            </div>
            {bookingsPanelStyle ? (
              <div className="col-span-2 min-w-0">
                <FieldLabel compact>Workshop</FieldLabel>
                <CrmWorkshopPicker
                  compact
                  pincode={formData.pincode}
                  city={formData.city}
                  cityId={formData.city_id}
                  workshopId={formData.workshop_id}
                  workshopName={formData.workshop_name}
                  onPick={(id, name) =>
                    setFormData((prev) => ({ ...prev, workshop_id: id, workshop_name: name }))
                  }
                />
              </div>
            ) : null}
            {!bookingsPanelStyle && !showSecondCar ? (
              <div
                className={
                  sidePanel
                    ? 'min-w-0'
                    : 'col-span-2 flex items-end lg:col-span-1'
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    touchLead();
                    setShowSecondCar(true);
                    setSecondCar(emptySecondCar());
                    setSecondCarDisplay('');
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-800 hover:bg-sky-100"
                >
                  <Car className="h-4 w-4 shrink-0" />
                  Add second car
                </button>
              </div>
            ) : null}
            <div>
              <FieldLabel compact={bookingsPanelStyle}>
                {bookingsPanelStyle ? 'Registration Year' : 'Year'}
              </FieldLabel>
              <YearPicker
                value={formData.vehicle_year}
                className={ic()}
                onChange={(year) => setFormData((prev) => ({ ...prev, vehicle_year: year }))}
              />
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Fuel Type</FieldLabel>
              <select name="vehicle_fuel_type" value={formData.vehicle_fuel_type} onChange={handleChange} className={ic(Boolean(errors.vehicle_fuel_type))}>
                <option value="">Select (optional)</option>
                <option value="PETROL">Petrol</option>
                <option value="DIESEL">Diesel</option>
                <option value="CNG">CNG</option>
                <option value="ELECTRIC">Electric</option>
                <option value="HYBRID">Hybrid</option>
              </select>
              {errors.vehicle_fuel_type ? <p className="mt-1 text-xs text-rose-600">{errors.vehicle_fuel_type}</p> : null}
            </div>
            <div>
              <FieldLabel compact={bookingsPanelStyle}>Odometer (km)</FieldLabel>
              <input type="number" name="odometer_km" value={formData.odometer_km} onChange={handleChange} className={ic()} />
            </div>
            {bookingsPanelStyle && !showSecondCar ? (
              <div className="min-w-0">
                <FieldLabel compact>&nbsp;</FieldLabel>
                <button
                  type="button"
                  onClick={() => {
                    touchLead();
                    setShowSecondCar(true);
                    setSecondCar(emptySecondCar());
                    setSecondCarDisplay('');
                  }}
                  className={`${ic()} inline-flex min-h-0 w-full items-center justify-center gap-1 border-dashed border-sky-300 bg-sky-50/80 text-[11px] font-bold text-sky-900 hover:bg-sky-100`}
                >
                  <Car className="h-3.5 w-3.5 shrink-0" />
                  Add 2nd car
                </button>
              </div>
            ) : null}
            {!bookingsPanelStyle ? (
              <div>
                <FieldLabel>Make / Model</FieldLabel>
                <input
                  type="text"
                  value={[formData.vehicle_make, formData.vehicle_model].filter(Boolean).join(' ') || '—'}
                  disabled
                  className={ic(false, true)}
                />
              </div>
            ) : null}
          </div>

          {showSecondCar ? (
            <div className={`rounded-xl border border-sky-200 bg-sky-50/70 ${bookingsPanelStyle ? 'mt-2 p-2.5' : 'mt-5 p-3 sm:p-4'}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-black text-sky-900">Second car</p>
                <button
                  type="button"
                  onClick={() => {
                    touchLead();
                    setShowSecondCar(false);
                    setSecondCar(emptySecondCar());
                    setSecondCarDisplay('');
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.second_vehicle_number;
                      delete next.second_vehicle_make;
                      return next;
                    });
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-rose-600"
                >
                  Remove
                </button>
              </div>
              <div className={sidePanel ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'}>
                <div className={sidePanel ? 'min-w-0' : 'col-span-2 lg:col-span-1'}>
                  <FieldLabel>Vehicle Number</FieldLabel>
                  <input
                    type="text"
                    value={secondCar.vehicle_number}
                    onChange={(e) =>
                      setSecondCar((prev) => ({
                        ...prev,
                        vehicle_number: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12),
                      }))
                    }
                    className={`${ic(Boolean(errors.second_vehicle_number))} uppercase tracking-wide font-semibold`}
                    placeholder="MH12AB1234 or NA"
                  />
                  {errors.second_vehicle_number ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.second_vehicle_number}</p>
                  ) : null}
                </div>
                <div className={sidePanel ? 'min-w-0' : 'col-span-2 lg:col-span-3'}>
                  <CrmCarSearch
                    label="Car Model"
                    placeholder="Type second car model"
                    displayValue={secondCarDisplay}
                    onSelect={(car) => {
                      touchLead();
                      setSecondCar((prev) => ({
                        ...prev,
                        vehicle_make: car.make,
                        vehicle_model: car.model,
                        model_id: car.id,
                        vehicle_class: car.vehicleClass || '',
                      }));
                      setSecondCarDisplay([car.make, car.model].filter(Boolean).join(' '));
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.second_vehicle_make;
                        return next;
                      });
                    }}
                    onClear={() => {
                      setSecondCar((prev) => ({
                        ...prev,
                        vehicle_make: '',
                        vehicle_model: '',
                        model_id: '',
                        vehicle_class: '',
                      }));
                      setSecondCarDisplay('');
                    }}
                  />
                  {errors.second_vehicle_make ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.second_vehicle_make}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel>Year</FieldLabel>
                  <YearPicker
                    value={secondCar.vehicle_year}
                    className={ic()}
                    onChange={(year) => setSecondCar((prev) => ({ ...prev, vehicle_year: year }))}
                  />
                </div>
                <div>
                  <FieldLabel>Fuel Type</FieldLabel>
                  <select
                    value={secondCar.vehicle_fuel_type}
                    onChange={(e) => setSecondCar((prev) => ({ ...prev, vehicle_fuel_type: e.target.value }))}
                    className={ic()}
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Odometer (km)</FieldLabel>
                  <input
                    type="number"
                    value={secondCar.odometer_km}
                    onChange={(e) => setSecondCar((prev) => ({ ...prev, odometer_km: e.target.value }))}
                    className={ic()}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Lead Overview" icon={FileText} tone="slate" compact={bookingsPanelStyle}>
          <div className={bookingsPanelStyle ? grid4 : sidePanel ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'}>
            <div>
              <FieldLabel>Lead Number</FieldLabel>
              <input type="text" value={lead.lead_number || '—'} disabled className={ic(false, true)} />
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <select name="lead_priority" value={formData.lead_priority} onChange={handleChange} className={ic()}>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <FieldLabel>Created</FieldLabel>
              <input
                type="text"
                value={
                  lead.created_at
                    ? new Date(lead.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'
                }
                disabled
                className={ic(false, true)}
              />
            </div>
            <div>
              <LeadTagsPanel leadId={leadId} canManage={isLeadManager} variant="field" />
            </div>
            {bookingsPanelStyle ? (
              <>
                <div className="min-w-0">
                  <FieldLabel compact>Referred By</FieldLabel>
                  <CrmReferredByField
                    leadId={leadId}
                    value={referredBy}
                    onChange={(next) => {
                      touchLead();
                      setReferredBy(next);
                    }}
                    referredTo={referredTo}
                    leadHref={(id) => `${base}/leads/${id}`}
                    className="space-y-0"
                    hideLabel
                    dense
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel compact>Workshop Remark</FieldLabel>
                  <textarea
                    name="activity_notes"
                    value={formData.activity_notes}
                    onChange={handleChange}
                    rows={2}
                    className={`${ic()} min-h-[2.25rem] max-h-28 resize-y`}
                    placeholder="Workshop remark"
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel compact>Telecaller Remark</FieldLabel>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={2}
                    className={`${ic()} min-h-[2.25rem] max-h-28 resize-y`}
                    placeholder="Telecaller remark"
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel compact>Repeat</FieldLabel>
                  <label className={`${ic()} flex min-h-[2.25rem] cursor-pointer items-center gap-2`}>
                    <input
                      type="checkbox"
                      checked={Boolean(formData.repeat_customer)}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, repeat_customer: e.target.checked }))
                      }
                      className="h-4 w-4 shrink-0 rounded border-slate-400"
                    />
                    <span className="text-xs font-semibold normal-case tracking-normal text-slate-800">
                      Repeat
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <div
                className={
                  sidePanel
                    ? 'grid grid-cols-1 gap-3'
                    : 'col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-4'
                }
              >
                <CrmReferredByField
                  leadId={leadId}
                  value={referredBy}
                  onChange={(next) => {
                    touchLead();
                    setReferredBy(next);
                  }}
                  referredTo={referredTo}
                  leadHref={(id) => `${base}/leads/${id}`}
                  className="space-y-3"
                />
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.repeat_customer)}
                    onChange={(e) => setFormData((prev) => ({ ...prev, repeat_customer: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-900">Repeat Customer</span>
                </label>
              </div>
            )}
            {customFieldDefs.length > 0 ? (
              <div className={sidePanel ? 'grid grid-cols-1 gap-3' : 'sm:col-span-2 lg:col-span-4 grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                {customFieldDefs.map((field) => (
                  <div key={field.id}>
                    <FieldLabel>{field.name}</FieldLabel>
                    <input
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      className={ic()}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {!bookingsPanelStyle ? (
              <div className={sidePanel ? 'grid grid-cols-1 gap-3' : 'col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-4'}>
                <div>
                  <FieldLabel>Workshop Remark</FieldLabel>
                  <textarea name="activity_notes" value={formData.activity_notes} onChange={handleChange} className={ic()} rows={3} placeholder="Workshop remark" />
                </div>
                <div>
                  <FieldLabel>Telecaller Remark</FieldLabel>
                  <textarea name="notes" value={formData.notes} onChange={handleChange} className={ic()} rows={3} placeholder="Telecaller remark" />
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Service Details" icon={Wrench} tone="amber" compact={bookingsPanelStyle}>
          <div className={bookingsPanelStyle ? 'space-y-2.5' : 'space-y-4'}>
            <CrmServicePlanPicker
              compact={bookingsPanelStyle}
              selectedIds={formData.service_types}
              onChange={(ids) => {
                touchLead();
                setFormData((prev) => ({ ...prev, service_types: ids }));
                if (errors.service_types) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.service_types;
                    return next;
                  });
                }
              }}
              title=""
              subtitle=""
              cityId={formData.city_id || null}
              workshopId={formData.pickup_required ? null : formData.workshop_id || null}
              vehicleClass={formData.vehicle_class || null}
              modelId={formData.model_id || null}
              vehicleMake={formData.vehicle_make || null}
              vehicleModel={formData.vehicle_model || null}
              couponCode={
                appliedCoupon && selectedCodes.includes(String(appliedCoupon).toUpperCase())
                  ? appliedCoupon
                  : selectedCodes[0] || ''
              }
            />
            {errors.service_types ? <p className="text-xs text-rose-600">{errors.service_types}</p> : null}

            {SHOW_SERVICE_ADDONS && (
              <div>
                <FieldLabel>Service Add-ons (Optional)</FieldLabel>
                <div className={sidePanel ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
                  {serviceAddons.map((addon) => (
                    <label key={addon.id} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 hover:border-[#023D95]/40 cursor-pointer transition">
                      <input type="checkbox" checked={formData.service_addons.includes(addon.id)} onChange={(e) => handleMultiSelect('service_addons', addon.id, e.target.checked)} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900">{addon.name}</div>
                        {addon.price ? <div className="text-xs font-bold text-[#023D95] mt-0.5">₹{addon.price}</div> : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              {!bookingsPanelStyle ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <FieldLabel>Coupons</FieldLabel>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                  onClick={saveCouponsOnly}
                  disabled={couponSaving}
                >
                  {couponSaving ? 'Saving…' : 'Save coupons'}
                </button>
              </div>
              ) : (
                <div className="mb-1 flex items-center justify-between gap-2">
                  <FieldLabel compact>Coupons · Message</FieldLabel>
                  <button
                    type="button"
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                    onClick={saveCouponsOnly}
                    disabled={couponSaving}
                  >
                    {couponSaving ? 'Saving…' : 'Save coupons'}
                  </button>
                </div>
              )}
              <div
                className={
                  bookingsPanelStyle
                    ? 'grid grid-cols-1 items-stretch gap-2 lg:grid-cols-12'
                    : sidePanel
                      ? 'grid grid-cols-1 gap-2'
                      : 'grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-stretch'
                }
              >
                <div
                  className={`overflow-auto rounded-lg border-2 border-slate-300 bg-white p-1.5 ${
                    bookingsPanelStyle ? 'max-h-20 lg:col-span-4' : 'max-h-24 rounded-xl'
                  }`}
                >
                  {couponsLoading ? (
                    <div className="p-2 text-xs text-slate-500">Loading coupons…</div>
                  ) : availableCoupons.length === 0 ? (
                    <div className="p-2 text-xs text-slate-500">{couponsError ? `Unable to load coupons: ${couponsError}` : 'No active coupons available.'}</div>
                  ) : (
                    <div className="space-y-1">
                      {availableCoupons.map((c) => {
                        const code = String(c.code || '').toUpperCase();
                        const label =
                          c.coupon_kind === 'TOTAL_DISCOUNT'
                            ? `${code} — ${c.discount_mode === 'PERCENT' ? `${c.discount_value}% off` : `₹${c.discount_value} off`}${c.min_order_value ? ` (min ₹${c.min_order_value})` : ''}`
                            : `${code} — Free Service${c.target_custom_label ? ` (${c.target_custom_label})` : ''}`;
                        const checked = selectedCodes.includes(code);
                        return (
                          <label
                            key={c.id}
                            className={`flex cursor-pointer items-center gap-1.5 px-1.5 py-0.5 ${
                              bookingsPanelStyle ? 'rounded-md text-xs' : 'rounded-lg px-2 py-1 text-sm'
                            } ${checked ? 'bg-blue-50 text-[#023D95]' : 'text-slate-800 hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              className={bookingsPanelStyle ? 'h-3 w-3' : undefined}
                              onChange={(e) => {
                                if (e.target.checked) addCouponCode(code);
                                else removeCouponCode(code);
                              }}
                            />
                            <span className="truncate font-medium">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 ${bookingsPanelStyle ? 'lg:col-span-3' : ''}`}>
                  <input
                    className={`${ic()} min-w-0 flex-1`}
                    placeholder="Add coupon code"
                    value={manualCoupon}
                    onChange={(e) => setManualCoupon((e.target.value || '').toUpperCase())}
                  />
                  <button
                    type="button"
                    className={`shrink-0 rounded-lg bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50 ${
                      bookingsPanelStyle ? 'h-8 px-2 text-xs' : 'h-10 rounded-xl px-3 text-sm'
                    }`}
                    onClick={() => {
                      addCouponCode(manualCoupon);
                      setManualCoupon('');
                    }}
                    disabled={!manualCoupon.trim()}
                  >
                    Add
                  </button>
                </div>
                {bookingsPanelStyle ? (
                  <div className="min-w-0 lg:col-span-5">
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      Customer message
                    </p>
                    <textarea
                      readOnly
                      value={formData.problem_description?.trim() || ''}
                      placeholder="Customer message"
                      rows={2}
                      className={`${ic()} min-h-[2.5rem] max-h-40 resize-y overflow-auto whitespace-pre-wrap bg-slate-50 text-sm leading-snug text-slate-800`}
                    />
                  </div>
                ) : null}
              </div>
              {selectedCodes.length > 0 ? (
                <div className={`${bookingsPanelStyle ? 'mt-1 space-y-1' : 'mt-2 space-y-2'}`}>
                  <div className="flex flex-wrap gap-1">
                    {selectedCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        className={`rounded-full bg-[#023D95]/10 font-bold text-[#023D95] hover:bg-[#023D95]/15 ${
                          bookingsPanelStyle ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
                        }`}
                        onClick={() => removeCouponCode(code)}
                      >
                        {code} ×
                      </button>
                    ))}
                  </div>
                  {!bookingsPanelStyle ? (
                    <select className={ic()} value={appliedCoupon} onChange={(e) => setAppliedCoupon(e.target.value)}>
                      <option value="">Applied coupon (optional)</option>
                      {selectedCodes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : appliedCoupon ? (
                    <p className="text-[10px] font-semibold text-slate-600">Applied: {appliedCoupon}</p>
                  ) : null}
                  {!bookingsPanelStyle ? (
                    <button
                      type="button"
                      className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      onClick={() => {
                        touchLead();
                        setCouponCodes([]);
                        setAppliedCoupon('');
                        setManualCoupon('');
                      }}
                    >
                      Clear all coupons
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!bookingsPanelStyle ? (
            <div>
              <FieldLabel>Customer Message</FieldLabel>
              <div className="min-h-[4.5rem] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800">
                {formData.problem_description?.trim() || (
                  <span className="text-slate-400">No customer message</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Read-only — customer enquiry text (WhatsApp number / trigger hidden).
              </p>
            </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Pickup / Visit" icon={MapPin} tone="indigo" compact={bookingsPanelStyle}>
          <CrmPickupVisitStep
            compact={bookingsPanelStyle}
            value={{
              pickup_required: formData.pickup_required,
              vehicle_number: formData.vehicle_number || '',
              pickup_date: formData.pickup_date,
              pickup_time: formData.pickup_time,
              pickup_address: formData.pickup_area || formData.pickup_address || '',
              address_type: formData.address_type || 'home',
              flat_number: formData.pickup_flat,
              landmark: formData.pickup_landmark,
              workshop_id: formData.workshop_id || '',
              workshop_name: formData.workshop_name || '',
            }}
            onChange={(patch) => {
              touchLead();
              setFormData((prev) => ({
                ...prev,
                ...(patch.pickup_required !== undefined
                  ? { pickup_required: patch.pickup_required }
                  : {}),
                ...(patch.pickup_date !== undefined ? { pickup_date: patch.pickup_date } : {}),
                ...(patch.pickup_time !== undefined ? { pickup_time: patch.pickup_time } : {}),
                ...(patch.pickup_address !== undefined
                  ? { pickup_area: patch.pickup_address, pickup_address: patch.pickup_address }
                  : {}),
                ...(patch.flat_number !== undefined ? { pickup_flat: patch.flat_number } : {}),
                ...(patch.landmark !== undefined ? { pickup_landmark: patch.landmark } : {}),
                ...(patch.workshop_id !== undefined ? { workshop_id: patch.workshop_id } : {}),
                ...(patch.workshop_name !== undefined
                  ? { workshop_name: patch.workshop_name || '' }
                  : {}),
                ...(patch.address_type !== undefined ? { address_type: patch.address_type } : {}),
                ...(patch.vehicle_number !== undefined
                  ? { vehicle_number: patch.vehicle_number }
                  : {}),
              }));
            }}
            city={formData.city}
            cityId={formData.city_id}
            pincode={formData.pincode}
            hideVehicleNumber
            hideWorkshops
          />
        </SectionCard>

        {sidePanel || bookingsPanelStyle
          ? null
          : inDrawer && dockFooter
            ? createPortal(saveBar, dockFooter)
            : saveBar}
        <LeadRecordingBrain leadId={leadId} open={brainOpen} onClose={() => setBrainOpen(false)} />
      </form>
      {sidePanel ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCancel} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
              <X className="h-4 w-4" /> Back
            </button>
            <button type="submit" form="crm-lead-edit-form" disabled={saving} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#023D95] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setBrainOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-700"
              aria-label="Lead recording analysis"
            >
              <Brain className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}


