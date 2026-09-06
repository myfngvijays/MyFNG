'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bot, Car, ClipboardList, Loader2, Search, UserRound, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Smartphone, Globe, Ticket, Pencil, Trash2, CheckSquare, Square, MinusSquare, Download, MessageCircle, Wrench, IndianRupee, Hash, Megaphone, Gift, ChevronLeft, ChevronRight, UserPlus, Columns3, ChevronDown, ChevronUp, List, LineChart, MapPin, Phone, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import ReportDateRangeFilter from '@/components/admin/ReportDateRangeFilter';
import BookingsLeadsChartPanel, {
  chartDimensionLabel,
  leadMatchesChartBucket,
  type ChartDimension,
} from '@/components/admin/BookingsLeadsChartPanel';
import {
  FUEL_OPTIONS,
  InlineBooleanField,
  InlineCarField,
  InlineCityField,
  InlineDateField,
  InlineEmailField,
  InlineSelectField,
  InlineTextField,
  InlineTimeField,
  InlineYearField,
  parseAddressParts,
  useServiceCities,
} from '@/components/admin/bookings/ServiceLeadInlineFields';
import {
  filterBookingLeads,
  enrichBookingLead,
  getLeadServiceLabel,
  getLeadDisplayAmount,
  getLeadInboundWhatsAppMessage,
  isWhatsAppEnquiryLead,
  getLeadUtmParams,
  resolveLeadMessageTrigger,
  getLeadStoredMessageTrigger,
  NO_MESSAGE_TRIGGER,
  resolveLeadSourceBadgeTheme,
  computeServiceLeadOverview,
  type LeadSourceBadgeKind,
} from '@/lib/booking-lead-utils';
import { formatPreferredSlotLabel } from '@/lib/preferred-slot';
import LeadTimelinePanel from '@/components/telecaller/crm/LeadTimelinePanel';
import AppActivityTimeline from '@/components/admin/AppActivityTimeline';
import {
  buildCheckoutLeadIndex,
  checkoutSiblingsFor,
  checkoutServiceLines,
  collapseCheckoutChildLeads,
  resolveCheckoutPrimary,
} from '@/lib/admin-checkout-lead-group';
import { hideOtpStubsWhenNamedBookingExists } from '@/lib/otp-stub-lead';
import { parseCustomRepairItems } from '@/lib/custom-repair-items';
import { UTM_DISPLAY_LABELS, UTM_KEYS } from '@/lib/utm';
import { LEAD_SOURCES } from '@/lib/enquiry/createLead';
import { resolveReportDateRange, REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';
import { leadStatusCardColors, leadDisplayStatus, ADMIN_CRM_STATUS_OPTIONS, resolveAdminCrmStatusId, LOST_REASON_FILTERS } from '@/lib/telecaller/leadDisplayStatus';
import LeadTagsPanel from '@/components/telecaller/crm/LeadTagsPanel';
import BookingsSavedViews from '@/components/admin/bookings/BookingsSavedViews';
import {
  EMPTY_BOOKINGS_VIEW,
  normalizeBookingsViewFilters,
  type BookingsViewSnapshot,
} from '@/lib/bookings/savedViewFilters';
import {
  getMisaOtpVerifiedLabel,
  inferMisaOtpChannel,
} from '@/lib/chatbot_v2/misaLeadSource';
import type { MessageTrigger } from '@/lib/enquiry/messageTriggers';
import {
  ENQUIRY_CSV_COLUMNS,
  enrichEnquiryMakes,
  enrichEnquiryTags,
  formatEnquiryTimestamp,
  isValidEnquiryPhone,
  mapEnquiryCsvRows,
} from '@/lib/crm/normalizeEnquiryCsv';
import { getBrowserClient } from '@/lib/supabase/browserClient';

type ServiceLead = Record<string, any>;
type CsvRow = Record<string, string>;

const STATUS_OPTIONS = ['ALL', 'NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'] as const;
const LEAD_STATUS_ENUM = ['NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'] as const;
const RECORDING_OPTIONS = ['ALL', 'YES', 'NO'] as const;
const SOURCE_OPTIONS = [
  'ALL',
  'APP',
  'WEBSITE',
  'MISA',
  'SARV',
  'WHATSAPP',
  'GOOGLE',
  'META',
  'PARTNER',
  'REFERENCE',
  'BANNER',
  'OTHER',
] as const;
const COUPON_OPTIONS = ['ALL', 'YES', 'PROMO', 'REFERRAL', 'NO'] as const;
const PAGE_SIZE_OPTIONS = [25, 50, 75, 100] as const;
const EDIT_LEAD_SOURCES = [
  ...LEAD_SOURCES,
  'MISA AI (Website)',
  'MISA AI (App)',
  'WhatsApp MISA AI',
  'AI Chatbot',
  'Incoming Sarv Call',
] as const;

/** Core list cols default on; detail-only fields default off — toggle via Columns menu. */
const BOOKINGS_TABLE_COLUMNS = [
  // Default visible (order = table order)
  { key: 'leadStatus', label: 'Lead Status', group: 'Core', onByDefault: true, width: 130 },
  { key: 'leadNumber', label: 'Lead #', group: 'Core', onByDefault: false, width: 120 },
  { key: 'customer', label: 'Customer', group: 'Core', onByDefault: true, width: 180 },
  { key: 'message', label: 'Message', group: 'Core', onByDefault: true, width: 140 },
  { key: 'leadsCount', label: 'Leads #', group: 'Core', onByDefault: true, width: 100 },
  { key: 'vehicle', label: 'Vehicle', group: 'Core', onByDefault: false, width: 120 },
  { key: 'city', label: 'City', group: 'Core', onByDefault: false, width: 120 },
  { key: 'service', label: 'Service', group: 'Core', onByDefault: true, width: 180 },
  { key: 'discount', label: 'Discount', group: 'Core', onByDefault: true, width: 100 },
  { key: 'amount', label: 'Amount', group: 'Core', onByDefault: true, width: 100 },
  { key: 'date', label: 'Date', group: 'Core', onByDefault: true, width: 110 },
  { key: 'time', label: 'Time', group: 'Core', onByDefault: true, width: 90 },
  { key: 'status', label: 'Status', group: 'Core', onByDefault: true, width: 150 },
  // Optional (columns menu)
  { key: 'source', label: 'Source', group: 'Core', onByDefault: false, width: 120 },
  { key: 'assignee', label: 'Assignee', group: 'Core', onByDefault: false, width: 120 },
  { key: 'phone', label: 'Phone', group: 'Core', onByDefault: false, width: 120 },
  { key: 'utmCampaign', label: 'UTM Campaign', group: 'Core', onByDefault: false, width: 120 },
  // Detail-panel fields (optional)
  { key: 'leadType', label: 'Lead Type', group: 'Lead', onByDefault: false, width: 120 },
  { key: 'priority', label: 'Priority', group: 'Lead', onByDefault: false, width: 120 },
  { key: 'createdFrom', label: 'Created From', group: 'Lead', onByDefault: false, width: 120 },
  { key: 'email', label: 'Email', group: 'Customer', onByDefault: false, width: 120 },
  { key: 'address', label: 'Address', group: 'Customer', onByDefault: false, width: 120 },
  { key: 'pickupRequired', label: 'Pickup Required', group: 'Customer', onByDefault: false, width: 120 },
  { key: 'make', label: 'Make', group: 'Vehicle', onByDefault: false, width: 120 },
  { key: 'model', label: 'Model', group: 'Vehicle', onByDefault: false, width: 120 },
  { key: 'variant', label: 'Variant', group: 'Vehicle', onByDefault: false, width: 120 },
  { key: 'year', label: 'Year', group: 'Vehicle', onByDefault: false, width: 120 },
  { key: 'fuelType', label: 'Fuel Type', group: 'Vehicle', onByDefault: false, width: 120 },
  { key: 'odometer', label: 'Odometer', group: 'Vehicle', onByDefault: false, width: 120 },
  { key: 'serviceType', label: 'Service Type', group: 'Service', onByDefault: false, width: 120 },
  { key: 'preferredDate', label: 'Preferred Date', group: 'Service', onByDefault: false, width: 120 },
  { key: 'preferredTime', label: 'Preferred Time', group: 'Service', onByDefault: false, width: 120 },
  { key: 'preferredSlot', label: 'Preferred Slot', group: 'Service', onByDefault: false, width: 120 },
  { key: 'problemDescription', label: 'Problem', group: 'Service', onByDefault: false, width: 120 },
  { key: 'notes', label: 'Notes', group: 'Service', onByDefault: false, width: 120 },
  { key: 'utmSource', label: 'UTM Source', group: 'Campaign', onByDefault: false, width: 120 },
  { key: 'utmMedium', label: 'UTM Medium', group: 'Campaign', onByDefault: false, width: 120 },
  { key: 'utmTerm', label: 'UTM Term', group: 'Campaign', onByDefault: false, width: 120 },
  { key: 'utmContent', label: 'UTM Content', group: 'Campaign', onByDefault: false, width: 120 },
  { key: 'estimatedAmount', label: 'Estimated Amt', group: 'Payment', onByDefault: false, width: 120 },
  { key: 'actualAmount', label: 'Actual Amt', group: 'Payment', onByDefault: false, width: 120 },
  { key: 'paymentMode', label: 'Payment Mode', group: 'Payment', onByDefault: false, width: 120 },
  { key: 'paymentStatus', label: 'Payment Status', group: 'Payment', onByDefault: false, width: 120 },
] as const;

type BookingsTableColumnKey = (typeof BOOKINGS_TABLE_COLUMNS)[number]['key'];
type BookingsColumnVisibility = Record<BookingsTableColumnKey, boolean>;

const BOOKINGS_COLUMN_GROUPS = ['Core', 'Lead', 'Customer', 'Vehicle', 'Service', 'Campaign', 'Payment'] as const;

const DEFAULT_BOOKINGS_COLUMNS: BookingsColumnVisibility = BOOKINGS_TABLE_COLUMNS.reduce((acc, col) => {
  acc[col.key] = col.onByDefault;
  return acc;
}, {} as BookingsColumnVisibility);

const BOOKINGS_COLUMNS_STORAGE_KEY = 'super_admin_bookings_visible_columns_v4';

function loadBookingsColumnVisibility(): BookingsColumnVisibility {
  if (typeof window === 'undefined') return { ...DEFAULT_BOOKINGS_COLUMNS };
  try {
    const raw = window.localStorage.getItem(BOOKINGS_COLUMNS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BOOKINGS_COLUMNS };
    const parsed = JSON.parse(raw) as Partial<BookingsColumnVisibility> & { tcUpdate?: boolean };
    const next = { ...DEFAULT_BOOKINGS_COLUMNS };
    for (const col of BOOKINGS_TABLE_COLUMNS) {
      if (typeof parsed[col.key] === 'boolean') next[col.key] = parsed[col.key]!;
    }
    // Migrate old key name if present in a pasted prefs object
    if (typeof parsed.tcUpdate === 'boolean' && parsed.leadStatus === undefined) {
      next.leadStatus = parsed.tcUpdate;
    }
    if (!BOOKINGS_TABLE_COLUMNS.some((c) => next[c.key])) {
      next.leadNumber = true;
    }
    return next;
  } catch {
    return { ...DEFAULT_BOOKINGS_COLUMNS };
  }
}

function leadAddressText(lead: Record<string, any>) {
  return String(lead.customer_address || lead.address || lead.pickup_address || '').trim();
}

function leadUtmValue(lead: Record<string, any>, key: (typeof UTM_KEYS)[number]) {
  return String(getLeadUtmParams(lead)[key] || '').trim();
}

function leadStatusSelectClass(status?: string | null) {
  const s = String(status || 'NEW').toUpperCase();
  if (s === 'COMPLETED' || s === 'READY_FOR_DELIVERY') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'CANCELLED' || s === 'REJECTED') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (s === 'IN_PROGRESS' || s === 'ACCEPTED') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (s === 'ASSIGNED' || s === 'HOLD') return 'bg-violet-100 text-violet-800 border-violet-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
}

function LeadStatusSelect({
  value,
  updating,
  onChange,
}: {
  value: string;
  updating: boolean;
  onChange: (status: string, e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" /> : null}
      <select
        value={value || 'NEW'}
        disabled={updating}
        onChange={(e) => onChange(e.target.value, e)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`min-w-[132px] text-[11px] font-semibold rounded-full pl-2 pr-6 py-1 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${leadStatusSelectClass(value)}`}
        aria-label="Change lead status"
      >
        {LEAD_STATUS_ENUM.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeOnly(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `Rs ${num.toLocaleString('en-IN')}`;
}

function SourceBadgeIcon({ kind }: { kind: LeadSourceBadgeKind }) {
  if (kind === 'google') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    );
  }

  if (kind === 'meta') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden>
        <path d="M12 2C6.48 2 2 6.15 2 11.25c0 2.61 1.19 4.97 3.08 6.63L4.5 21.5l4.02-2.01c1.12.31 2.31.48 3.48.48 5.52 0 10-4.15 10-9.25S17.52 2 12 2zm0 15.5c-1.01 0-1.98-.16-2.89-.45l-.61-.22-2.05 1.02.39-2.24-.4-.39C5.56 14.3 5 12.82 5 11.25 5 7.69 8.13 5 12 5s7 2.69 7 6.25-3.13 6.25-7 6.25z" />
      </svg>
    );
  }

  if (kind === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden>
        <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
      </svg>
    );
  }

  if (kind === 'whatsapp') return <MessageCircle className="h-3.5 w-3.5 shrink-0" />;
  if (kind === 'app') return <Smartphone className="h-3.5 w-3.5 shrink-0" />;
  if (kind === 'website') return <Globe className="h-3.5 w-3.5 shrink-0" />;
  if (kind === 'misa') return <Bot className="h-3.5 w-3.5 shrink-0" />;
  if (kind === 'sarv') return <Phone className="h-3.5 w-3.5 shrink-0" />;
  return <UserRound className="h-3.5 w-3.5 shrink-0" />;
}

/** Always-readable fallback colors (inline) if Tailwind classes fail to load. */
const SOURCE_KIND_INLINE: Partial<Record<LeadSourceBadgeKind, React.CSSProperties>> = {
  google: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  meta: { backgroundColor: '#E0F2FE', color: '#0C4A6E' },
  instagram: { backgroundColor: '#FCE7F3', color: '#9D174D' },
  whatsapp: { backgroundColor: '#D1FAE5', color: '#065F46' },
  app: { backgroundColor: '#D1FAE5', color: '#065F46' },
  website: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  misa: { backgroundColor: '#EDE9FE', color: '#5B21B6' },
  sarv: { backgroundColor: '#FFEDD5', color: '#9A3412' },
  other: { backgroundColor: '#F3F4F6', color: '#374151' },
};

function SourceBadge({ lead }: { lead: Record<string, any> }) {
  // Always recompute from lead fields so stale enriched white-text classes are ignored.
  const theme = resolveLeadSourceBadgeTheme(lead);

  const kind = theme.source_badge_kind;
  const label = theme.source_badge_label || lead.lead_source || lead.booking_source_label || 'Other';
  const title = theme.source_badge_title || label;
  const styles = theme.source_badge_class || 'bg-gray-100 text-gray-700';
  const inline = theme.source_badge_style || SOURCE_KIND_INLINE[kind] || SOURCE_KIND_INLINE.other;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${styles}`}
      style={inline}
      title={title}
    >
      <SourceBadgeIcon kind={kind} />
      {label}
    </span>
  );
}

function normalizeLeadPhone(phone?: string | null): string {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);
}

/** Web / Mob / MISA OTP (WhatsApp · Website · App) — shown in Source column. */
function resolveOtpVerifiedTag(lead: Record<string, any>): {
  label: string;
  className: string;
  kind: 'website' | 'app' | 'misa' | 'whatsapp';
} | null {
  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? (lead.coupon_meta as Record<string, unknown>) : {};
  const result = String(meta.last_call_result || lead.otp_result || '').toUpperCase();
  const labelRaw = String(meta.last_call_label || lead.otp_label || '').toLowerCase();
  const desc = String(lead.description || lead.problem_description || '').toLowerCase();
  const leadSource = String(lead.lead_source || '').toLowerCase();
  const isOtp =
    Boolean(lead.otp_verified) ||
    Boolean(meta.otp_verified_at) ||
    Boolean(meta.website_otp_verified) ||
    Boolean(meta.website_booking_abandoned) ||
    Boolean(meta.misa_otp_verified) ||
    result === 'OTP_VERIFIED' ||
    labelRaw.includes('otp verified') ||
    labelRaw.includes('misa otp') ||
    desc.includes('otp verified');
  if (!isOtp) return null;

  const misaChannel = inferMisaOtpChannel({
    misaChannel: meta.misa_channel != null ? String(meta.misa_channel) : null,
    lastCallLabel: String(meta.last_call_label || lead.otp_label || ''),
    leadSource: String(lead.lead_source || ''),
    createdFrom: String(lead.created_from || ''),
    description: String(lead.description || lead.problem_description || ''),
  });

  if (misaChannel || Boolean(meta.misa_otp_verified) || labelRaw.includes('misa otp') || leadSource.includes('misa')) {
    const channel = misaChannel || 'WEBSITE';
    const label = getMisaOtpVerifiedLabel(channel);
    if (channel === 'WHATSAPP') {
      return { label, className: 'bg-emerald-100 text-emerald-800', kind: 'whatsapp' };
    }
    if (channel === 'APP') {
      return { label, className: 'bg-violet-100 text-violet-800', kind: 'app' };
    }
    return { label, className: 'bg-indigo-100 text-indigo-800', kind: 'misa' };
  }

  const channel = String(meta.otp_channel || lead.otp_channel || '').toUpperCase();
  const createdFrom = String(lead.created_from || '').toUpperCase();
  const isMobile =
    channel === 'MOBILE' ||
    channel === 'MOBILE_APP' ||
    channel === 'APP' ||
    labelRaw.includes('mob otp') ||
    createdFrom === 'MOBILE_APP' ||
    createdFrom === 'MOBILE' ||
    createdFrom === 'MOBILE_PUBLIC';

  if (isMobile) {
    return {
      label: 'Mob OTP Verified',
      className: 'bg-emerald-100 text-emerald-800',
      kind: 'app',
    };
  }
  return {
    label: 'Web OTP Verified',
    className: 'bg-amber-100 text-amber-800',
    kind: 'website',
  };
}

function withOtpFlags(lead: Record<string, any>): Record<string, any> {
  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? (lead.coupon_meta as Record<string, unknown>) : {};
  const tag = resolveOtpVerifiedTag(lead);
  return {
    ...lead,
    otp_verified: Boolean(tag),
    otp_channel: String(meta.otp_channel || (tag?.kind === 'app' ? 'MOBILE' : tag ? 'WEB' : '') || ''),
    otp_result: String(meta.last_call_result || ''),
    otp_label: String(meta.last_call_label || tag?.label || ''),
  };
}

function SourceCell({ lead }: { lead: Record<string, any> }) {
  const otp = resolveOtpVerifiedTag(lead);
  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};
  const status = String(lead.status || '').toUpperCase();
  const showOtpAsSource =
    Boolean(otp) &&
    (lead.is_incomplete === true ||
      Boolean(meta.website_booking_abandoned) ||
      (status === 'NEW' && String(meta.last_call_result || '').toUpperCase() === 'OTP_VERIFIED'));

  // Incomplete OTP leads: Source column shows Web/Mob OTP Verified
  if (otp && showOtpAsSource) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${otp.className}`}
        >
          <SourceBadgeIcon kind={otp.kind} />
          {otp.label}
        </span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 flex-nowrap">
      <SourceBadge lead={lead} />
      {isWhatsAppEnquiryLead(lead) ? (
        <span
          className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200"
          title="WhatsApp enquiry only — not a confirmed booking"
        >
          Enquiry
        </span>
      ) : null}
    </div>
  );
}

function getLeadUtmCampaign(lead: Record<string, any>) {
  return String(getLeadUtmParams(lead).utm_campaign || '').trim();
}

function UtmCampaignCell({ lead }: { lead: Record<string, any> }) {
  const campaign = getLeadUtmCampaign(lead);
  if (!campaign) return <span className="text-gray-300">—</span>;
  return (
    <span
      className="inline-block max-w-[140px] truncate rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700"
      title={campaign}
    >
      {campaign}
    </span>
  );
}

/** Hex palette so Tailwind purge cannot drop assignee badge backgrounds. */
const ASSIGNEE_BADGE_COLORS = [
  { bg: '#BAE6FD', ring: '#0EA5E9' }, // sky
  { bg: '#DDD6FE', ring: '#8B5CF6' }, // violet
  { bg: '#A7F3D0', ring: '#10B981' }, // emerald
  { bg: '#FDE68A', ring: '#F59E0B' }, // amber
  { bg: '#FECDD3', ring: '#F43F5E' }, // rose
  { bg: '#A5F3FC', ring: '#06B6D4' }, // cyan
  { bg: '#F5D0FE', ring: '#D946EF' }, // fuchsia
  { bg: '#D9F99D', ring: '#84CC16' }, // lime
  { bg: '#FED7AA', ring: '#F97316' }, // orange
  { bg: '#99F6E4', ring: '#14B8A6' }, // teal — Ajit Mali lands here
  { bg: '#C7D2FE', ring: '#6366F1' }, // indigo
  { bg: '#FBCFE8', ring: '#EC4899' }, // pink
  { bg: '#FEF08A', ring: '#EAB308' }, // yellow
  { bg: '#BFDBFE', ring: '#3B82F6' }, // blue
];

function assigneeBadgeColors(name: string) {
  const key = String(name || '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return ASSIGNEE_BADGE_COLORS[hash % ASSIGNEE_BADGE_COLORS.length];
}

function AssigneeBadge({
  name,
  onClick,
  title,
}: {
  name?: string | null;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}) {
  const label = String(name || '').trim();
  if (!label) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex max-w-[160px] items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-300"
          title={title || 'Click to assign'}
        >
          Unassigned
        </button>
      );
    }
    return <span className="text-gray-300">Unassigned</span>;
  }
  const colors = assigneeBadgeColors(label);
  const className =
    'inline-flex max-w-[160px] truncate rounded-full px-2.5 py-1 text-xs font-semibold text-gray-900 ring-1';
  const style = { backgroundColor: colors.bg, boxShadow: `inset 0 0 0 1px ${colors.ring}` };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} hover:brightness-95 cursor-pointer`}
        style={style}
        title={title || `${label} — click to reassign`}
      >
        {label}
      </button>
    );
  }
  return (
    <span className={className} style={style} title={title || label}>
      {label}
    </span>
  );
}

function LeadDiscountBadge({ lead }: { lead: Record<string, any> }) {
  const referralApplied = Boolean(lead.referral_reward_applied);
  const referralLabel = lead.referral_reward_label as string | null;
  const referralDiscount = Number(lead.referral_reward_discount || 0);
  const couponCode = lead.coupon_display_code || lead.coupon_code;
  const couponDiscount = Number(lead.coupon_only_discount || 0);
  const fallbackDiscount = Number(lead.coupon_display_discount || lead.discount_amount || 0);

  if (!referralApplied && !couponCode && !fallbackDiscount) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  return (
    <span className="inline-flex flex-col gap-1 text-xs max-w-[220px]">
      {referralApplied ? (
        <span className="inline-flex flex-wrap items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-900 ring-1 ring-amber-200">
          <Gift className="w-3 h-3 shrink-0 text-amber-700" />
          <span className="font-semibold">Refer & Rise</span>
          {referralLabel ? <span className="text-amber-800/90">{referralLabel}</span> : null}
          {referralDiscount > 0 ? (
            <span className="font-medium text-emerald-700">-Rs {referralDiscount.toLocaleString('en-IN')}</span>
          ) : null}
        </span>
      ) : null}
      {couponCode ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 font-semibold text-orange-700">
            <Ticket className="w-3 h-3 shrink-0" />
            {couponCode}
          </span>
          {couponDiscount > 0 ? (
            <span className="text-emerald-700 font-medium">-Rs {couponDiscount.toLocaleString('en-IN')}</span>
          ) : null}
        </span>
      ) : !referralApplied && fallbackDiscount > 0 ? (
        <span className="text-emerald-700 font-medium">-Rs {fallbackDiscount.toLocaleString('en-IN')}</span>
      ) : null}
    </span>
  );
}

/** Backward-compatible wrapper — some call sites may still use code/discount props. */
function CouponBadge({
  code,
  discount,
  lead,
}: {
  code?: string | null;
  discount?: number | null;
  lead?: Record<string, any>;
}) {
  if (lead) return <LeadDiscountBadge lead={lead} />;
  return (
    <LeadDiscountBadge
      lead={{
        coupon_display_code: code,
        coupon_only_discount: discount,
        coupon_display_discount: discount,
      }}
    />
  );
}


/** Read MISA multi-service rows from lead.meta (page-local; do not import by old name). */
function extractMisaServices(lead: Record<string, any>): Array<{ name: string; price: number }> {
  const meta = lead?.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  const rows = Array.isArray(meta.misa_services) ? meta.misa_services : [];
  return rows
    .map((service: any) => ({
      name: String(service?.name || '').trim(),
      price: Number(service?.price || 0),
    }))
    .filter((service) => service.name);
}

function getServiceLabel(lead: ServiceLead) {
  const misa = extractMisaServices(lead);
  if (misa.length > 0) return misa.map((s) => s.name).join(', ');
  try {
    return getLeadServiceLabel(lead);
  } catch {
    return String(lead.service_display || lead.service_type || 'Service');
  }
}

function prettifyKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function DetailFieldCard({
  label,
  value,
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 leading-tight">{label}</p>
      <div className="relative mt-0.5 text-[13px] leading-snug text-gray-900 break-words">{value ?? '-'}</div>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  className,
  cols = 2,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const gridCols =
    cols === 4
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      : cols === 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';
  return (
    <section className={`rounded-xl border p-3 ${className}`}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {title}
      </p>
      <div className={`grid gap-2 ${gridCols}`}>{children}</div>
    </section>
  );
}

function formatDetailScalar(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

type ProfileHistoryItem = {
  at?: string;
  summary?: string;
  remark?: string | null;
  status?: string | null;
  event?: string | null;
  previous_status?: string | null;
  previous_label?: string | null;
  workshop_name?: string | null;
  city?: string | null;
  pincode?: string | null;
  lost_reason?: string | null;
};

function getLeadCouponMeta(lead: Record<string, any>) {
  return lead?.coupon_meta && typeof lead.coupon_meta === 'object' && !Array.isArray(lead.coupon_meta)
    ? (lead.coupon_meta as Record<string, unknown>)
    : {};
}

function getProfileHistory(lead: Record<string, any>): ProfileHistoryItem[] {
  const meta = getLeadCouponMeta(lead);
  return Array.isArray(meta.profile_history) ? (meta.profile_history as ProfileHistoryItem[]) : [];
}

function prettifyDisposition(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.replace(/_/g, ' ');
}

/** Disposition chip colors — same palette as telecaller CRM (Lost red, Will visit violet, …). */
function dispositionBadgeStyle(statusLabel?: string | null) {
  const c = leadStatusCardColors(String(statusLabel || ''));
  return {
    backgroundColor: c.badgeBg,
    color: c.badgeText,
    boxShadow: `inset 0 0 0 1px ${c.border}`,
  } as React.CSSProperties;
}

function getLatestTelecallerUpdate(lead: Record<string, any>) {
  const meta = getLeadCouponMeta(lead);
  const history = getProfileHistory(lead);
  const latest = history[0];
  // Prefer live CRM disposition — list badge shows primary status only (no Lost · reason)
  const status = leadDisplayStatus(lead) || null;
  const remark = String(latest?.remark || meta.telecaller_remarks || '').trim() || null;
  const at = String(meta.last_call_at || latest?.at || '').trim() || null;
  const summary = String(latest?.summary || '').trim() || null;
  const fullLabel = prettifyDisposition(
    (meta.last_call_label as string) || (meta.last_call_result as string) || null,
  );
  return { status, remark, at, summary, count: history.length, fullLabel };
}

function TelecallerUpdateCell({
  lead,
  updating,
  onChange,
}: {
  lead: Record<string, any>;
  updating?: boolean;
  onChange?: (statusId: string, lostReason?: string) => void;
}) {
  const [selectKey, setSelectKey] = useState(0);
  const latest = getLatestTelecallerUpdate(lead);
  const value = resolveAdminCrmStatusId(lead);
  if (!onChange) {
    if (!latest.status) {
      return <span className="text-gray-300">—</span>;
    }
    return (
      <span
        className="inline-flex max-w-[140px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={dispositionBadgeStyle(latest.status)}
        title={[latest.fullLabel || latest.status, latest.remark, latest.at ? formatDateTime(latest.at) : '']
          .filter(Boolean)
          .join(' · ')}
      >
        {latest.status}
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" /> : null}
      <select
        key={selectKey}
        value={value}
        disabled={updating}
        aria-label="Change lead status"
        title={latest.fullLabel || latest.status || 'Change lead status'}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          const next = e.target.value;
          if (next === value) return;
          let lostReason: string | undefined;
          if (next === 'LOST') {
            const reason = window.prompt(
              `Lost reason (required)\n${LOST_REASON_FILTERS.filter((r) => r.id).map((r) => r.label).join('\n')}`,
              'Not Interested',
            );
            if (!reason?.trim()) {
              setSelectKey((k) => k + 1);
              return;
            }
            lostReason = reason.trim();
          }
          onChange(next, lostReason);
        }}
        className="max-w-[150px] text-[11px] font-semibold rounded-full pl-2 pr-6 py-1 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
        style={dispositionBadgeStyle(latest.status || value)}
      >
        {ADMIN_CRM_STATUS_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ServiceLeadDetailContent({
  item,
  allLeads,
  onPatch,
}: {
  item: Record<string, any>;
  allLeads: Record<string, any>[];
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const meta = item.meta && typeof item.meta === 'object' ? (item.meta as Record<string, unknown>) : {};
  const serviceLabel = getServiceLabel(item);
  const misaServices = extractMisaServices(item);
  const checkoutIndex = useMemo(() => buildCheckoutLeadIndex(allLeads), [allLeads]);
  const checkoutSiblings = checkoutSiblingsFor(item, checkoutIndex);
  const checkoutLines = useMemo(() => {
    const lines = checkoutServiceLines(item, checkoutSiblings);
    return lines.map((line) => {
      const crmId = resolveAdminCrmStatusId(line.lead);
      const crmLabel = ADMIN_CRM_STATUS_OPTIONS.find((opt) => opt.id === crmId)?.label || crmId;
      const tint = leadStatusCardColors(crmId);
      const misaOnLead = extractMisaServices(line.lead);
      const price =
        misaOnLead.length > 0 ? line.price : getLeadDisplayAmount(line.lead) || line.price;
      const repairItems = parseCustomRepairItems(line.lead);
      return { ...line, price, crmId, crmLabel, tint, repairItems };
    });
  }, [item, checkoutSiblings]);
  const payable = getLeadDisplayAmount(item);
  const checkoutTotal =
    checkoutSiblings.length > 0
      ? payable + checkoutSiblings.reduce((sum, row) => sum + getLeadDisplayAmount(row), 0)
      : payable;
  const [showMore, setShowMore] = useState(false);
  const [expandedRepairIds, setExpandedRepairIds] = useState<Record<string, boolean>>({});
  const cities = useServiceCities();

  const addrParts = parseAddressParts(
    String(item.customer_address || item.pickup_address || item.address || ''),
    meta,
  );
  const pincode = String(item.pincode || '').replace(/\D/g, '').slice(0, 6);

  const saveAddressPart = async (key: 'flat_number' | 'area' | 'landmark' | 'pincode', next: string) => {
    const nextParts = {
      flat_number: key === 'flat_number' ? next : addrParts.flat_number,
      area: key === 'area' ? next : addrParts.area,
      landmark: key === 'landmark' ? next : addrParts.landmark,
      city: String(item.city || ''),
      city_id: item.city_id || undefined,
      pincode: key === 'pincode' ? next.replace(/\D/g, '').slice(0, 6) : pincode,
    };
    await onPatch({
      address_parts: nextParts,
      pincode: nextParts.pincode || null,
      city: nextParts.city || null,
      city_id: nextParts.city_id || null,
    });
  };

  const paymentExtras: Array<{ label: string; value: React.ReactNode }> = [];
  if (meta.service_subtotal) {
    paymentExtras.push({ label: 'Service Subtotal', value: formatCurrency(Number(meta.service_subtotal)) });
  }
  if (meta.wallet_applied && Number(meta.wallet_deduction || 0) > 0) {
    paymentExtras.push({ label: 'Wallet Used', value: formatCurrency(Number(meta.wallet_deduction)) });
  }
  if (item.referral_reward_applied) {
    paymentExtras.push({
      label: 'Referral Reward',
      value: (
        <div className="space-y-0.5">
          <p className="font-semibold text-amber-900">Refer & Rise · {item.referral_reward_family || 'Reward'}</p>
          {item.referral_reward_text ? <p className="text-xs text-gray-700">{item.referral_reward_text}</p> : null}
          {Number(item.referral_reward_discount || 0) > 0 ? (
            <p className="text-xs font-medium text-emerald-700">
              Discount: {formatCurrency(Number(item.referral_reward_discount))}
            </p>
          ) : null}
        </div>
      ),
    });
  }
  if (item.coupon_display_code || item.coupon_code) {
    paymentExtras.push({
      label: 'Coupon',
      value: (
        <LeadDiscountBadge
          lead={{
            ...item,
            referral_reward_applied: false,
            coupon_display_code: item.coupon_display_code || item.coupon_code,
            coupon_only_discount: item.coupon_only_discount ?? item.coupon_display_discount ?? item.discount_amount,
          }}
        />
      ),
    });
  }

  const metaEntries = Object.entries(meta).filter(
    ([key]) =>
      ![
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'tracking',
        'customer_id',
        'referral_reward',
        'flat_number',
        'area',
        'landmark',
      ].includes(key),
  );

  const statusOptions = LEAD_STATUS_ENUM.map((s) => ({ value: s, label: s }));
  const fuelValue = item.vehicle_fuel_type || item.fuel_type || '';

  return (
    <div className="space-y-3">
      <DetailSection title="Customer Details" icon={UserRound} cols={4} className="border-emerald-200 bg-emerald-50/50">
        <InlineTextField label="Customer Name" field="customer_name" value={item.customer_name} onPatch={onPatch} />
        <InlineTextField label="Phone" field="customer_phone" value={item.customer_phone} onPatch={onPatch} />
        <InlineEmailField label="Email" value={item.customer_email} onPatch={onPatch} />
        <InlineBooleanField
          label="Pickup Required"
          field="pickup_required"
          value={item.pickup_required}
          onPatch={onPatch}
        />
        <InlineTextField
          label="Flat / Building"
          field="flat_number"
          value={addrParts.flat_number}
          onPatch={async (p) => saveAddressPart('flat_number', String(p.flat_number ?? ''))}
        />
        <InlineTextField
          label="Area / Street"
          field="area"
          value={addrParts.area}
          onPatch={async (p) => saveAddressPart('area', String(p.area ?? ''))}
        />
        <InlineTextField
          label="Landmark"
          field="landmark"
          value={addrParts.landmark}
          onPatch={async (p) => saveAddressPart('landmark', String(p.landmark ?? ''))}
        />
        <InlineTextField
          label="Pincode"
          field="pincode"
          value={pincode}
          onPatch={async (p) => saveAddressPart('pincode', String(p.pincode ?? ''))}
          placeholder="6-digit PIN"
        />
      </DetailSection>

      <DetailSection title="Vehicle & Location" icon={MapPin} cols={4} className="border-blue-200 bg-blue-50/50">
        <InlineTextField label="Reg. No" field="vehicle_number" value={item.vehicle_number} onPatch={onPatch} />
        <InlineCarField
          label="Make / Model"
          make={item.vehicle_make}
          model={item.vehicle_model}
          onPatch={onPatch}
          className="sm:col-span-2"
        />
        <InlineTextField label="Variant" field="vehicle_variant" value={item.vehicle_variant} onPatch={onPatch} />
        <InlineYearField label="Year" value={item.vehicle_year} onPatch={onPatch} />
        <InlineSelectField
          label="Fuel"
          field="vehicle_fuel_type"
          value={fuelValue}
          options={FUEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onPatch={onPatch}
        />
        <InlineCityField
          label="City"
          value={item.city}
          cityId={item.city_id}
          cities={cities}
          onPatch={onPatch}
        />
        <InlineTextField
          label="Odometer"
          field="odometer_reading"
          value={item.odometer_reading}
          onPatch={onPatch}
        />
      </DetailSection>

      <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-white/95 backdrop-blur-sm border-y border-gray-100">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="mx-auto flex w-full max-w-xs items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {showMore ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {showMore ? (
        <div className="space-y-3">
          <DetailSection title="Lead Overview" icon={Hash} cols={4} className="border-slate-200 bg-slate-50/80">
            <DetailFieldCard label="Lead Number" value={item.lead_number} />
            <InlineSelectField
              label="Status"
              field="status"
              value={item.status}
              options={statusOptions}
              onPatch={onPatch}
            />
            <InlineTextField label="Lead Type" field="lead_type" value={item.lead_type} onPatch={onPatch} />
            <InlineTextField
              label="Priority"
              field="lead_priority"
              value={item.lead_priority || item.priority}
              onPatch={onPatch}
            />
            <DetailFieldCard label="Created At" value={formatDateTime(item.created_at)} />
            <InlineTextField label="Created From" field="created_from" value={item.created_from} onPatch={onPatch} />
            <DetailFieldCard
              label="Source"
              className="relative z-10 overflow-visible"
              value={
                <LeadTagsPanel
                  leadId={String(item.id || '')}
                  canManage
                  fieldTrigger={<SourceCell lead={item} />}
                />
              }
            />
            <DetailFieldCard
              label="Assignee"
              value={
                item.assigned_telecaller_name ? (
                  <AssigneeBadge name={item.assigned_telecaller_name} />
                ) : item.assigned_telecaller_id ? (
                  'Assigned'
                ) : (
                  'Unassigned'
                )
              }
            />
            <DetailFieldCard label="Internal ID" value={item.id} className="sm:col-span-2 lg:col-span-2" />
          </DetailSection>

          <DetailSection title="Service & Schedule" icon={Wrench} cols={3} className="border-violet-200 bg-violet-50/50">
            {checkoutLines.length > 1 ? (
              <div className="col-span-full rounded-md border border-violet-200 bg-white px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Services on this checkout
                </p>
                <ul className="mt-1.5 space-y-2">
                  {checkoutLines.map((line, index) => {
                    const repairKey = String(line.lead.id || `${line.name}-${index}`);
                    const repairOpen = Boolean(expandedRepairIds[repairKey]);
                    return (
                    <li key={repairKey} className="text-[13px]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {line.repairItems.length > 0 ? (
                            <button
                              type="button"
                              title={repairOpen ? 'Hide repair items' : 'Show repair items'}
                              aria-expanded={repairOpen}
                              onClick={() =>
                                setExpandedRepairIds((prev) => ({ ...prev, [repairKey]: !prev[repairKey] }))
                              }
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
                            >
                              {repairOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </button>
                          ) : null}
                          <span className="text-gray-900 font-medium">{line.name}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {line.price > 0 ? (
                            <span className="font-semibold text-gray-900">{formatCurrency(line.price)}</span>
                          ) : null}
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: line.tint.badgeBg, color: line.tint.badgeText }}
                          >
                            {line.crmLabel}
                          </span>
                        </div>
                      </div>
                      {repairOpen && line.repairItems.length > 0 ? (
                        <ul className="mt-1.5 ml-7 space-y-0.5 text-[12px] text-gray-600">
                          {line.repairItems.map((row, itemIndex) => (
                            <li key={`${row.name}-${itemIndex}`}>
                              {row.name}
                              {row.qty > 1 ? ` × ${row.qty}` : ''}
                              {row.amount > 0 ? ` · ${formatCurrency(row.amount)}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              </div>
            ) : misaServices.length > 0 ? (
              <div className="col-span-full rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Services</p>
                <ul className="mt-1 space-y-1">
                  {misaServices.map((service, index) => (
                    <li key={`${service.name}-${index}`} className="flex items-start justify-between gap-3 text-[13px]">
                      <span className="text-gray-900">{service.name}</span>
                      {service.price > 0 ? (
                        <span className="shrink-0 font-semibold text-gray-900">{formatCurrency(service.price)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <InlineTextField label="Service" field="service_type" value={serviceLabel} onPatch={onPatch} />
            )}
            <InlineTextField label="Service Type" field="service_type" value={item.service_type} onPatch={onPatch} />
            <DetailFieldCard
              label="Preferred Slot"
              value={formatPreferredSlotLabel(item) || formatDateTime(item.preferred_slot_start)}
            />
            <InlineDateField
              label="Preferred Date"
              field="preferred_date"
              value={item.preferred_date || String(item.preferred_slot_start || '').slice(0, 10)}
              onPatch={onPatch}
            />
            <InlineTimeField
              label="Preferred Time"
              field="preferred_time_slot"
              value={
                item.preferred_time_slot ||
                item.preferred_service_slot ||
                (item.preferred_slot_start ? String(item.preferred_slot_start).slice(11, 16) : '')
              }
              onPatch={onPatch}
            />
            <DetailFieldCard
              label="WhatsApp Message"
              value={getLeadInboundWhatsAppMessage(item)}
              className="sm:col-span-2 lg:col-span-3"
            />
            <InlineTextField
              label="Problem"
              field="problem_description"
              value={item.problem_description}
              multiline
              onPatch={onPatch}
              className="sm:col-span-2"
            />
            <InlineTextField
              label="Notes"
              field="description"
              value={item.description}
              multiline
              onPatch={onPatch}
              className="sm:col-span-2"
            />
          </DetailSection>

          <DetailSection title="Payment & Pricing" icon={IndianRupee} cols={4} className="border-amber-200 bg-amber-50/50">
            <DetailFieldCard label="Payable Amount" value={formatCurrency(payable)} />
            {checkoutSiblings.length > 0 ? (
              <DetailFieldCard label="Checkout Total" value={formatCurrency(checkoutTotal)} />
            ) : null}
            <InlineTextField
              label="Estimated Amount"
              field="estimated_amount"
              value={item.estimated_amount}
              onPatch={onPatch}
            />
            <InlineTextField
              label="Actual Amount"
              field="actual_amount"
              value={item.actual_amount}
              onPatch={onPatch}
            />
            <InlineTextField label="Payment Mode" field="payment_mode" value={item.payment_mode} onPatch={onPatch} />
            <InlineTextField
              label="Payment Status"
              field="payment_status"
              value={item.payment_status}
              onPatch={onPatch}
            />
            <InlineTextField
              label="Discount"
              field="discount_amount"
              value={item.discount_amount}
              onPatch={onPatch}
            />
            <InlineTextField
              label="Coupon Code"
              field="coupon_code"
              value={item.coupon_code || item.coupon_display_code}
              onPatch={onPatch}
            />
            {item.referral_reward_applied ? (
              <DetailFieldCard
                label="Referral Source"
                value={`Refer & Rise${item.referral_reward_family ? ` · ${item.referral_reward_family}` : ''}`}
              />
            ) : null}
            {paymentExtras.map((field) => (
              <DetailFieldCard key={field.label} label={field.label} value={field.value} />
            ))}
          </DetailSection>

          <LeadTrackingSection item={item} compact />

          {metaEntries.length > 0 ? (
            <DetailSection title="Additional Info" icon={ClipboardList} cols={3} className="border-gray-200 bg-gray-50/80">
              {metaEntries.map(([key, value]) => (
                <DetailFieldCard key={key} label={prettifyKey(key)} value={formatDetailScalar(value)} />
              ))}
            </DetailSection>
          ) : null}
        </div>
      ) : null}

      <LeadTimelinePanel leadId={String(item.id || '')} lead={item} />
      <AppActivityTimeline
        leadId={String(item.id || '')}
        phone={item.customer_phone ? String(item.customer_phone) : null}
      />
    </div>
  );
}

function LeadTrackingSection({ item, compact = false }: { item: Record<string, any>; compact?: boolean }) {
  const utm = getLeadUtmParams(item);
  const hasUtm = UTM_KEYS.some((key) => Boolean(utm[key]));

  return (
    <div className={`rounded-xl border border-blue-200 bg-blue-50/70 ${compact ? 'p-3' : 'p-4'}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-800">Campaign Tracking</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-md border border-blue-100 bg-white px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Lead Source</p>
          <div className="mt-0.5">
            <SourceCell lead={item} />
          </div>
        </div>
        {UTM_KEYS.map((key) => (
          <div key={key} className="rounded-md border border-blue-100 bg-white px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{UTM_DISPLAY_LABELS[key]}</p>
            <p className="text-[13px] text-gray-900 mt-0.5 break-words">{utm[key] || '-'}</p>
          </div>
        ))}
      </div>
      {!hasUtm ? (
        <p className="text-[11px] text-amber-700 mt-2">
          No UTM params captured for this lead. User must land via ad URL with utm_* query params before booking.
        </p>
      ) : null}
    </div>
  );
}

function sourceFilterLabel(source: (typeof SOURCE_OPTIONS)[number]) {
  switch (source) {
    case 'ALL':
      return 'All Sources';
    case 'APP':
      return 'App Booking';
    case 'WEBSITE':
      return 'Website';
    case 'MISA':
      return 'MISA AI';
    case 'SARV':
      return 'Incoming Sarv Call';
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'GOOGLE':
      return 'Google Ads';
    case 'META':
      return 'Meta / Insta Ads';
    case 'PARTNER':
      return 'Partner';
    case 'REFERENCE':
      return 'Reference';
    case 'BANNER':
      return 'Banner / Offline';
    case 'OTHER':
      return 'Other';
    default:
      return source;
  }
}

function StatCard({
  label,
  value,
  sub,
  icon,
  onClick,
  active,
  accentClassName,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  accentClassName?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex h-full min-h-[108px] w-[158px] shrink-0 flex-col rounded-2xl border p-3.5 text-left shadow-sm transition sm:w-auto sm:min-w-0 sm:p-4 ${
        active
          ? 'border-white bg-[#003A8C] ring-2 ring-white/70'
          : 'border-[#003A8C] bg-[#004AAD]'
      } ${onClick ? 'cursor-pointer hover:bg-[#003A8C]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wide text-blue-100 sm:text-[11px]">
          {label}
        </p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            accentClassName || 'bg-white/15 text-white'
          }`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none text-white">{value}</p>
      {sub ? (
        <p className="mt-auto pt-2 text-[11px] leading-snug text-blue-100 line-clamp-2">{sub}</p>
      ) : (
        <div className="mt-auto pt-2" aria-hidden />
      )}
    </Wrapper>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`inline-flex h-8 min-w-[120px] items-center ${className}`} title={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004AAD]/30"
      >
        {children}
      </select>
    </label>
  );
}

function couponFilterLabel(coupon: (typeof COUPON_OPTIONS)[number]) {
  switch (coupon) {
    case 'ALL':
      return 'All discounts';
    case 'YES':
      return 'Any discount';
    case 'PROMO':
      return 'Promo coupon';
    case 'REFERRAL':
      return 'Refer & Rise';
    case 'NO':
      return 'No discount';
    default:
      return coupon;
  }
}

function recordingFilterLabel(v: (typeof RECORDING_OPTIONS)[number]) {
  switch (v) {
    case 'YES':
      return 'Has recording';
    case 'NO':
      return 'No recording';
    default:
      return 'All recordings';
  }
}

function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
  allLabel,
  className = '',
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectedLabels = selected.map(
    (value) => options.find((opt) => opt.value === value)?.label || value,
  );
  const display =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selectedLabels[0]
        : selected.length === 2
          ? `${selectedLabels[0]}, ${selectedLabels[1]}`
          : `${selectedLabels[0]} +${selected.length - 1}`;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return (
    <div className={`relative min-w-[140px] ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`${label} — tick more than one`}
        aria-label={label}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-left text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004AAD]/30"
      >
        <span className="truncate">{display}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
              selected.length === 0 ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-700'
            }`}
            onClick={() => onChange([])}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 text-[10px] leading-none">
              {selected.length === 0 ? '✓' : ''}
            </span>
            {allLabel}
          </button>
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  checked ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-700'
                }`}
                onClick={() => toggle(opt.value)}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 text-[10px] leading-none">
                  {checked ? '✓' : ''}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SuperAdminBookingsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [showUploadCrm, setShowUploadCrm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_OPTIONS)[number]>('ALL');
  const [sourceLabelFilter, setSourceLabelFilter] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState('');
  const [couponFilter, setCouponFilter] = useState<(typeof COUPON_OPTIONS)[number]>('ALL');
  const [recordingFilter, setRecordingFilter] = useState<(typeof RECORDING_OPTIONS)[number]>('ALL');
  const [recordingLeadIds, setRecordingLeadIds] = useState<Set<string> | null>(null);
  const [loadingRecordingIds, setLoadingRecordingIds] = useState(false);
  /** Empty = all assignees. Values: UNASSIGNED or telecaller name. */
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  /** Empty = all message triggers. Values: trigger id or NONE. */
  const [messageTriggerFilter, setMessageTriggerFilter] = useState<string[]>([]);
  const [messageTriggersCatalog, setMessageTriggersCatalog] = useState<MessageTrigger[]>([]);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [listSort, setListSort] = useState<'newest' | 'oldest'>('newest');
  const [leadTagMap, setLeadTagMap] = useState<Map<string, Set<string>>>(new Map());
  const [tagMapsReady, setTagMapsReady] = useState(true);
  const [urlFiltersReady, setUrlFiltersReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceLeads, setServiceLeads] = useState<ServiceLead[]>([]);
  const [totalInRange, setTotalInRange] = useState<number | null>(null);
  const [leadsTruncated, setLeadsTruncated] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, any> | null>(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [phoneBookingsOpen, setPhoneBookingsOpen] = useState(false);
  const [phoneBookingsPhone, setPhoneBookingsPhone] = useState('');
  const [phoneBookingsList, setPhoneBookingsList] = useState<ServiceLead[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editLead, setEditLead] = useState<ServiceLead | null>(null);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    vehicle_number: '',
    city: '',
    status: 'NEW',
    lead_source: 'Website',
    estimated_amount: '',
    coupon_code: '',
    discount_amount: '',
    service_type: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [telecallers, setTelecallers] = useState<
    Array<{ id: string; full_name: string; is_active: boolean }>
  >([]);
  const [telecallersLoading, setTelecallersLoading] = useState(false);
  const [showInactiveTelecallers, setShowInactiveTelecallers] = useState(false);
  const [assignTelecallerId, setAssignTelecallerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  /** Quick assign modal from table Assignee column */
  const [quickAssignLead, setQuickAssignLead] = useState<ServiceLead | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAssignTcId, setBulkAssignTcId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<BookingsColumnVisibility>(DEFAULT_BOOKINGS_COLUMNS);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const [chartDrill, setChartDrill] = useState<{
    dimension: ChartDimension;
    key: string;
  } | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; total: number; errors?: string[] } | null>(null);

  const CSV_COLUMNS = ENQUIRY_CSV_COLUMNS;

  const splitCsvLine = (line: string, sep: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === sep) {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const sep = headerLine.includes('\t') ? '\t' : ',';
    const headers = splitCsvLine(headerLine, sep).map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const expectedCols = headers.length;

    return lines.slice(1).map((line) => {
      let values = splitCsvLine(line, sep);

      // If there are extra columns (unquoted commas in data), merge overflow into the last known text column
      if (sep === ',' && values.length > expectedCols) {
        const phoneIdx = Math.max(headers.indexOf('phone_no'), headers.indexOf('phone'));
        const nameIdx = headers.indexOf('name');
        const addressIdx = headers.indexOf('address');
        const mergeIdx = addressIdx >= 0 ? addressIdx : nameIdx >= 0 ? nameIdx : phoneIdx >= 0 ? phoneIdx + 1 : 1;
        const overflow = values.length - expectedCols;
        const merged = values.slice(mergeIdx, mergeIdx + overflow + 1).join(', ');
        values = [...values.slice(0, mergeIdx), merged, ...values.slice(mergeIdx + overflow + 1)];
      }

      const row: CsvRow = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] || '').trim();
      });
      return row;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        const supabase = getBrowserClient();
        const [{ data: tagRows }] = await Promise.all([
          supabase.from('crm_lead_tags').select('name'),
        ]);
        const catalogTags = (tagRows || []).map((t: any) => String(t.name || '').trim()).filter(Boolean);
        let next = mapEnquiryCsvRows(parseCsv(text), catalogTags);
        next = await enrichEnquiryMakes(next, async () => {
          const { data } = await supabase.from('car_models').select('make, model_name').eq('is_active', true);
          return data || [];
        });
        next = await enrichEnquiryTags(next, async () => catalogTags);
        setCsvRows(next);
        if (next.length === 0) toast.error('No data rows found in the file');
      } catch {
        const next = mapEnquiryCsvRows(parseCsv(text));
        setCsvRows(next);
        if (next.length === 0) toast.error('No data rows found in the file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (csvRows.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    const CHUNK = 2000;
    let totalInserted = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < csvRows.length; i += CHUNK) {
        const chunk = csvRows.slice(i, i + CHUNK);
        const res = await fetch('/api/crm/enquiries/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        totalInserted += json.inserted || 0;
        totalSkipped += json.skipped || 0;
        if (json.errors) allErrors.push(...json.errors);
      }

      const result = { inserted: totalInserted, skipped: totalSkipped, total: csvRows.length, errors: allErrors.length > 0 ? allErrors : undefined };
      setUploadResult(result);
          toast.success(`${totalInserted} leads added to Bookings & Leads`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clearCsv = () => {
    setCsvRows([]);
    setCsvFileName('');
    setUploadResult(null);
  };

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const lead of serviceLeads) {
      const name = String((lead as any).assigned_telecaller_name || '').trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [serviceLeads]);

  const activeMessageTriggers = useMemo(
    () => messageTriggersCatalog.filter((trigger) => trigger.is_active !== false && trigger.id),
    [messageTriggersCatalog],
  );

  const messageTriggerOptions = useMemo(() => {
    const groups = new Map<string, { label: string; ids: string[] }>();
    for (const trigger of activeMessageTriggers) {
      const label = String(trigger.label || trigger.phrase || trigger.id).trim() || trigger.id;
      const key = label.toLowerCase();
      const group = groups.get(key) || { label, ids: [] };
      if (!group.ids.includes(trigger.id)) group.ids.push(trigger.id);
      groups.set(key, group);
    }
    return [
      { value: NO_MESSAGE_TRIGGER, label: 'No trigger' },
      ...[...groups.values()]
        .map((group) => ({
          value: group.label,
          label: group.ids.length > 1 ? `${group.label}  ·  ${group.ids.length} campaigns` : group.label,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [activeMessageTriggers]);

  const baseFilteredServiceLeads = useMemo(() => {
    let leads = filterBookingLeads(serviceLeads, {
      source: sourceFilter,
      sourceLabel: sourceLabelFilter,
      hasCoupon: couponFilter,
      search: searchTerm,
    });
    if (statusFilter !== 'ALL') {
      leads = leads.filter((lead) => String(lead.status || 'NEW').toUpperCase() === statusFilter);
    }
    if (leadTypeFilter) {
      const want = leadTypeFilter.toUpperCase();
      leads = leads.filter((lead) => String(lead.lead_type || '').toUpperCase() === want);
    }
    if (assigneeFilter.length > 0) {
      const selected = new Set(assigneeFilter.map((name) => name.trim().toLowerCase()));
      const includeUnassigned = selected.has('unassigned');
      leads = leads.filter((lead) => {
        const name = String((lead as any).assigned_telecaller_name || '').trim();
        if (!name) return includeUnassigned;
        return selected.has(name.toLowerCase());
      });
    }
    if (messageTriggerFilter.length > 0) {
      const selected = new Set(messageTriggerFilter.map((item) => item.trim().toLowerCase()));
      const includeNone = selected.has(NO_MESSAGE_TRIGGER.toLowerCase());
      const catalogIds = new Set(activeMessageTriggers.map((trigger) => trigger.id));
      const selectedIds = new Set<string>();
      for (const trigger of activeMessageTriggers) {
        const label = String(trigger.label || trigger.phrase || '').trim().toLowerCase();
        if (selected.has(trigger.id.toLowerCase()) || (label && selected.has(label))) {
          selectedIds.add(trigger.id);
        }
      }
      leads = leads.filter((lead) => {
        const stored = getLeadStoredMessageTrigger(lead);
        const currentId = stored && catalogIds.has(stored.id) ? stored.id : null;
        const hit = currentId
          ? { id: currentId, label: activeMessageTriggers.find((t) => t.id === currentId)?.label || stored!.label }
          : resolveLeadMessageTrigger(lead, activeMessageTriggers);
        if (!hit || !catalogIds.has(hit.id)) return includeNone;
        return selectedIds.has(hit.id);
      });
    }
    if (recordingFilter !== 'ALL') {
      if (!recordingLeadIds) {
        // Wait until recording index loads — avoid flashing full list
        return [];
      }
      leads = leads.filter((lead) => {
        const id = String(lead.id || '').trim();
        const has = recordingLeadIds.has(id);
        return recordingFilter === 'YES' ? has : !has;
      });
    }
    if (tagIds.length > 0) {
      if (!tagMapsReady) return [];
      leads = leads.filter((lead) => {
        const have = leadTagMap.get(String(lead.id || '')) || new Set<string>();
        return tagMode === 'all' ? tagIds.every((id) => have.has(id)) : tagIds.some((id) => have.has(id));
      });
    }
    return leads;
  }, [
    serviceLeads,
    sourceFilter,
    sourceLabelFilter,
    couponFilter,
    searchTerm,
    statusFilter,
    leadTypeFilter,
    assigneeFilter,
    messageTriggerFilter,
    activeMessageTriggers,
    recordingFilter,
    recordingLeadIds,
    tagIds,
    tagMode,
    leadTagMap,
    tagMapsReady,
  ]);

  const checkoutIndex = useMemo(() => buildCheckoutLeadIndex(serviceLeads), [serviceLeads]);

  const displayedServiceLeads = useMemo(() => {
    const rows = chartDrill
      ? baseFilteredServiceLeads.filter((lead) =>
          leadMatchesChartBucket(lead, chartDrill.dimension, chartDrill.key, baseFilteredServiceLeads),
        )
      : baseFilteredServiceLeads;
    const sorted = [...rows].sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return listSort === 'oldest' ? da - db : db - da;
    });
    return hideOtpStubsWhenNamedBookingExists(
      collapseCheckoutChildLeads(sorted, serviceLeads, checkoutIndex),
    );
  }, [baseFilteredServiceLeads, chartDrill, listSort, serviceLeads, checkoutIndex]);

  /** All loaded leads for a phone (for Bookings count + modal). */
  const bookingsByPhone = useMemo(() => {
    const map = new Map<string, ServiceLead[]>();
    for (const lead of serviceLeads) {
      const key = normalizeLeadPhone(lead.customer_phone);
      if (!key || key.length !== 10) continue;
      const list = map.get(key) || [];
      list.push(lead);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    }
    return map;
  }, [serviceLeads]);

  const collapsedBookingsByPhone = useMemo(() => {
    const map = new Map<string, ServiceLead[]>();
    for (const [phone, list] of bookingsByPhone) {
      map.set(phone, hideOtpStubsWhenNamedBookingExists(collapseCheckoutChildLeads(list, list, checkoutIndex)));
    }
    return map;
  }, [bookingsByPhone, checkoutIndex]);

  const openPhoneBookings = (phone: string | null | undefined, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const key = normalizeLeadPhone(phone);
    if (!key) return;
    const list = collapsedBookingsByPhone.get(key) || [];
    setPhoneBookingsPhone(key);
    setPhoneBookingsList(list);
    setPhoneBookingsOpen(true);
  };

  const serviceLeadOverview = useMemo(() => computeServiceLeadOverview(displayedServiceLeads), [displayedServiceLeads]);

  const totalPages = Math.max(1, Math.ceil(displayedServiceLeads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const pagedServiceLeads = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return displayedServiceLeads.slice(start, start + pageSize);
  }, [displayedServiceLeads, safePage, pageSize]);

  const pageRangeLabel = useMemo(() => {
    if (displayedServiceLeads.length === 0) return '0–0';
    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, displayedServiceLeads.length);
    return `${start}–${end}`;
  }, [displayedServiceLeads.length, safePage, pageSize]);

  // Reset to first page whenever filters / search change.
  useEffect(() => {
    setCurrentPage(1);
  }, [sourceFilter, couponFilter, statusFilter, assigneeFilter, messageTriggerFilter, searchTerm, datePreset, customStart, customEnd, recordingFilter, tagIds, listSort]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setVisibleColumns(loadBookingsColumnVisibility());
  }, []);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!columnsMenuRef.current?.contains(event.target as Node)) {
        setColumnsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [columnsMenuOpen]);

  const toggleTableColumn = (key: BookingsTableColumnKey) => {
    setVisibleColumns((prev) => {
      const turningOff = prev[key];
      if (turningOff && BOOKINGS_TABLE_COLUMNS.filter((c) => prev[c.key]).length <= 1) {
        toast.error('Keep at least one column visible');
        return prev;
      }
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(BOOKINGS_COLUMNS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const showCol = (key: BookingsTableColumnKey) => visibleColumns[key];

  const tableMinWidthPx = useMemo(() => {
    const dataWidth = BOOKINGS_TABLE_COLUMNS.reduce(
      (sum, col) => sum + (visibleColumns[col.key] ? col.width : 0),
      0,
    );
    return Math.max(640, 120 + dataWidth); // select + actions always present
  }, [visibleColumns]);

  const hasActiveLeadFilters =
    sourceFilter !== 'ALL' ||
    couponFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    recordingFilter !== 'ALL' ||
    assigneeFilter.length > 0 ||
    messageTriggerFilter.length > 0 ||
    tagIds.length > 0 ||
    Boolean(searchTerm.trim()) ||
    Boolean(sourceLabelFilter.trim()) ||
    Boolean(leadTypeFilter.trim()) ||
    Boolean(chartDrill);

  const dateRangeLabel = useMemo(
    () => resolveReportDateRange(datePreset, customStart, customEnd).label,
    [customStart, customEnd, datePreset],
  );

  const handleDateRangeChange = ({
    preset,
    customStart: start,
    customEnd: end,
  }: {
    preset: ReportDatePreset;
    customStart: string;
    customEnd: string;
  }) => {
    if (preset === 'custom' && !start && !end) {
      const defaultRange = resolveReportDateRange('last_7_days');
      setDatePreset('custom');
      setCustomStart(defaultRange.startYmd);
      setCustomEnd(defaultRange.endYmd);
      return;
    }

    setDatePreset(preset);
    setCustomStart(start);
    setCustomEnd(end);
  };

  const viewSnapshot = useMemo<BookingsViewSnapshot>(
    () =>
      normalizeBookingsViewFilters({
        source: sourceFilter,
        status: statusFilter,
        coupon: couponFilter,
        recording: recordingFilter,
        assignees: assigneeFilter,
        search: searchTerm,
        sourceLabel: sourceLabelFilter,
        leadType: leadTypeFilter,
        datePreset,
        customStart,
        customEnd,
        tagIds,
        tagMode,
        messageTriggers: messageTriggerFilter,
        sort: listSort,
      }),
    [
      sourceFilter,
      statusFilter,
      couponFilter,
      recordingFilter,
      assigneeFilter,
      searchTerm,
      sourceLabelFilter,
      leadTypeFilter,
      datePreset,
      customStart,
      customEnd,
      tagIds,
      tagMode,
      messageTriggerFilter,
      listSort,
    ],
  );

  const applyViewSnapshot = (nextRaw: BookingsViewSnapshot) => {
    const next = normalizeBookingsViewFilters(nextRaw);
    setSourceFilter(
      (SOURCE_OPTIONS as readonly string[]).includes(next.source)
        ? (next.source as (typeof SOURCE_OPTIONS)[number])
        : 'ALL',
    );
    setStatusFilter(
      (STATUS_OPTIONS as readonly string[]).includes(next.status)
        ? (next.status as (typeof STATUS_OPTIONS)[number])
        : 'ALL',
    );
    setCouponFilter(
      (COUPON_OPTIONS as readonly string[]).includes(next.coupon)
        ? (next.coupon as (typeof COUPON_OPTIONS)[number])
        : 'ALL',
    );
    setRecordingFilter(
      (RECORDING_OPTIONS as readonly string[]).includes(next.recording)
        ? (next.recording as (typeof RECORDING_OPTIONS)[number])
        : 'ALL',
    );
    setAssigneeFilter(next.assignees);
    setSearchTerm(next.search);
    setSourceLabelFilter(next.sourceLabel);
    setLeadTypeFilter(next.leadType);
    setDatePreset(next.datePreset);
    setCustomStart(next.customStart);
    setCustomEnd(next.customEnd);
    setTagIds(next.tagIds);
    setTagMode(next.tagMode);
    setMessageTriggerFilter(next.messageTriggers);
    setListSort(next.sort);
  };

  const clearLeadFilters = () => {
    applyViewSnapshot({
      ...EMPTY_BOOKINGS_VIEW,
      datePreset,
      customStart,
      customEnd,
    });
    setChartDrill(null);
  };

  const fetchData = useCallback(async () => {
    if (showUploadCrm) return;
    if (datePreset === 'custom' && (!customStart || !customEnd)) return;

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      // Paginated API — fetch up to 10k for the selected date range (was hard-capped at 200).
      query.set('limit', '10000');
      query.set('preset', datePreset);
      if (datePreset === 'custom') {
        if (customStart) query.set('start', customStart);
        if (customEnd) query.set('end', customEnd);
      }

      const res = await fetch(`/api/super_admin/leads?${query.toString()}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load bookings data');
      }

      const rows = Array.isArray(payload?.leads) ? payload.leads : [];
      setServiceLeads(rows.map((lead: ServiceLead) => withOtpFlags(enrichBookingLead(lead))));
      const summary = payload?.summary || {};
      const inRange =
        typeof summary.total_in_range === 'number' ? summary.total_in_range : rows.length;
      setTotalInRange(inRange);
      setLeadsTruncated(Boolean(summary.truncated));
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [showUploadCrm, datePreset, customStart, customEnd]);

  useEffect(() => {
    if (searchParams.get('upload') === '1') setShowUploadCrm(true);
  }, [searchParams]);

  useEffect(() => {
    const presetRaw = String(searchParams.get('preset') || '')
      .trim()
      .toLowerCase() as ReportDatePreset;
    const validPreset = REPORT_DATE_PRESETS.some((p) => p.value === presetRaw);
    if (validPreset) setDatePreset(presetRaw);

    const start = String(searchParams.get('start') || '').trim();
    const end = String(searchParams.get('end') || '').trim();
    if (start) setCustomStart(start.slice(0, 10));
    if (end) setCustomEnd(end.slice(0, 10));

    const status = String(searchParams.get('status') || '')
      .trim()
      .toUpperCase();
    if ((STATUS_OPTIONS as readonly string[]).includes(status)) {
      setStatusFilter(status as (typeof STATUS_OPTIONS)[number]);
    }

    const source = String(searchParams.get('source') || '')
      .trim()
      .toUpperCase();
    if ((SOURCE_OPTIONS as readonly string[]).includes(source)) {
      setSourceFilter(source as (typeof SOURCE_OPTIONS)[number]);
    }

    const sourceLabel = String(searchParams.get('source_label') || '').trim();
    if (sourceLabel) setSourceLabelFilter(sourceLabel);

    const leadType = String(searchParams.get('lead_type') || '')
      .trim()
      .toUpperCase();
    if (leadType) setLeadTypeFilter(leadType);

    const search = String(searchParams.get('search') || '').trim();
    if (search) setSearchTerm(search);

    const hasRec = String(searchParams.get('has_recording') || '')
      .trim()
      .toUpperCase();
    if ((RECORDING_OPTIONS as readonly string[]).includes(hasRec)) {
      setRecordingFilter(hasRec as (typeof RECORDING_OPTIONS)[number]);
    }

    setUrlFiltersReady(true);
  }, [searchParams]);

  useEffect(() => {
    if (!urlFiltersReady) return;
    setSelectedIds(new Set());
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchData, urlFiltersReady]);

  useEffect(() => {
    if (!urlFiltersReady) return;
    void fetch('/api/super_admin/leads/with-recordings', { credentials: 'include', cache: 'no-store' });
  }, [urlFiltersReady]);

  useEffect(() => {
    if (recordingFilter === 'ALL') {
      setLoadingRecordingIds(false);
      return;
    }
    let cancelled = false;
    setLoadingRecordingIds(true);
    fetch('/api/super_admin/leads/with-recordings', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load recording filter');
        const ids = new Set<string>(
          (Array.isArray(json?.lead_ids) ? json.lead_ids : []).map((id: unknown) => String(id)),
        );
        if (!cancelled) setRecordingLeadIds(ids);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[bookings] recording filter load failed', err);
          setRecordingLeadIds(new Set());
          toast.error(err?.message || 'Could not load recording filter');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRecordingIds(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recordingFilter]);

  useEffect(() => {
    if (tagIds.length === 0) {
      setLeadTagMap(new Map());
      setTagMapsReady(true);
      return;
    }
    let cancelled = false;
    setTagMapsReady(false);
    fetch(`/api/lead-manager/tags?map_tag_ids=${encodeURIComponent(tagIds.join(','))}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load lead tags');
        const next = new Map<string, Set<string>>();
        for (const row of Array.isArray(json?.maps) ? json.maps : []) {
          const leadId = String(row?.lead_id || '');
          const tagId = String(row?.tag_id || '');
          if (!leadId || !tagId) continue;
          const set = next.get(leadId) || new Set<string>();
          set.add(tagId);
          next.set(leadId, set);
        }
        if (!cancelled) setLeadTagMap(next);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[bookings] tag filter load failed', err);
          setLeadTagMap(new Map());
          toast.error(err?.message || 'Could not load tag filter');
        }
      })
      .finally(() => {
        if (!cancelled) setTagMapsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tagIds]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/lead-manager/message-triggers', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load message triggers');
        const rows = Array.isArray(json?.triggers) ? json.triggers : [];
        if (!cancelled) setMessageTriggersCatalog(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[bookings] message triggers load failed', err);
          setMessageTriggersCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTelecallers = useCallback(async (forLead?: Record<string, any> | null) => {
    setTelecallersLoading(true);
    setShowInactiveTelecallers(false);
    try {
      const res = await fetch('/api/super_admin/telecallers?role=TELECALLER', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load telecallers');
      const list = (json.telecallers || [])
        .map((t: any) => ({
          id: String(t.id),
          full_name: String(t.full_name || t.phone || t.email || 'Telecaller').trim() || 'Telecaller',
          is_active: t.is_active !== false,
        }))
        .filter((t: { id: string }) => t.id);
      const curId = String(forLead?.assigned_telecaller_id || '').trim();
      const curName = String(forLead?.assigned_telecaller_name || '').trim();
      if (curId && !list.some((t: { id: string }) => t.id === curId)) {
        setTelecallers([
          { id: curId, full_name: curName || 'Current assignee', is_active: true },
          ...list,
        ]);
      } else {
        setTelecallers(list);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load telecallers');
    } finally {
      setTelecallersLoading(false);
    }
  }, []);

  const inactiveTelecallerCount = useMemo(
    () => telecallers.filter((t) => !t.is_active).length,
    [telecallers],
  );

  const visibleTelecallers = useMemo(() => {
    if (showInactiveTelecallers) return telecallers;
    return telecallers.filter((t) => t.is_active || t.id === assignTelecallerId);
  }, [telecallers, showInactiveTelecallers, assignTelecallerId]);

  const openDetail = (title: string, item: Record<string, any>) => {
    const resolved = resolveCheckoutPrimary(item, serviceLeads, checkoutIndex);
    setDetailTitle(title);
    setDetailItem(resolved);
    setAssignTelecallerId(String(resolved?.assigned_telecaller_id || ''));
    setShowInactiveTelecallers(false);
    setDetailOpen(true);
    void loadTelecallers(resolved);
  };

  const applyAssigneeUpdate = useCallback(
    (leadId: string, updatedLead: ServiceLead) => {
      setServiceLeads((prev) =>
        prev.map((row) => (row.id === leadId ? updatedLead : row)),
      );
      if (detailOpen && detailItem?.id === leadId) {
        setDetailItem(updatedLead);
        setAssignTelecallerId(String(updatedLead.assigned_telecaller_id || ''));
      }
      if (quickAssignLead?.id === leadId) {
        setQuickAssignLead(updatedLead);
      }
    },
    [detailOpen, detailItem?.id, quickAssignLead?.id],
  );

  const saveAssigneeForLead = async (lead: ServiceLead, nextIdRaw: string) => {
    if (!lead?.id) return;
    const nextId = String(nextIdRaw || '').trim();
    const prevId = String(lead.assigned_telecaller_id || '').trim();
    if (nextId === prevId) {
      toast('Assignee unchanged');
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch(`/api/super_admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assigned_telecaller_id: nextId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Assign failed');

      const updatedLead = enrichBookingLead(
        json.lead || { ...lead, assigned_telecaller_id: nextId || null },
      );
      applyAssigneeUpdate(String(lead.id), updatedLead);

      if (!nextId) toast.success('Lead unassigned');
      else if (!prevId) toast.success(`Assigned to ${updatedLead.assigned_telecaller_name || 'telecaller'}`);
      else toast.success(`Reassigned to ${updatedLead.assigned_telecaller_name || 'telecaller'}`);

      setQuickAssignLead(null);
    } catch (err: any) {
      toast.error(err?.message || 'Assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const saveAssignee = async () => {
    if (!detailItem) return;
    await saveAssigneeForLead(detailItem, assignTelecallerId);
  };

  const saveDetailPatch = async (patch: Record<string, unknown>) => {
    if (!detailItem?.id) return;
    const res = await fetch(`/api/super_admin/leads/${detailItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error || 'Update failed');
      throw new Error(json?.error || 'Update failed');
    }
    const updatedLead = enrichBookingLead(json.lead || { ...detailItem, ...patch });
    setDetailItem(updatedLead);
    setServiceLeads((prev) => prev.map((row) => (row.id === detailItem.id ? updatedLead : row)));
    toast.success('Saved');
  };

  const openQuickAssign = (lead: ServiceLead, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setQuickAssignLead(lead);
    setAssignTelecallerId(String(lead.assigned_telecaller_id || ''));
    void loadTelecallers(lead);
  };

  const openEdit = (lead: ServiceLead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditLead(lead);
    setEditForm({
      customer_name: lead.customer_name || '',
      customer_phone: lead.customer_phone || '',
      vehicle_number: lead.vehicle_number || '',
      city: lead.city || '',
      status: lead.status || 'NEW',
      lead_source: lead.lead_source || 'Website',
      estimated_amount: lead.estimated_amount != null ? String(lead.estimated_amount) : '',
      coupon_code: lead.coupon_code || lead.coupon_display_code || '',
      discount_amount: lead.discount_amount != null ? String(lead.discount_amount) : '',
      service_type: lead.service_display || lead.service_type || '',
    });
    setEditOpen(true);
  };

  const updateLeadStatus = async (
    lead: ServiceLead,
    newStatus: string,
    e?: React.SyntheticEvent,
  ) => {
    e?.stopPropagation();
    if (!lead?.id || String(lead.status || 'NEW') === newStatus) return;

    setStatusUpdatingId(String(lead.id));
    try {
      const res = await fetch(`/api/super_admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Status update failed');

      const updatedLead = enrichBookingLead(json.lead || { ...lead, status: newStatus });

      setServiceLeads((prev) => {
        if (statusFilter !== 'ALL' && newStatus !== statusFilter) {
          return prev.filter((row) => row.id !== lead.id);
        }
        return prev.map((row) => (row.id === lead.id ? updatedLead : row));
      });

      if (detailOpen && detailItem?.id === lead.id) {
        setDetailItem(updatedLead);
      }

      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Status update failed');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const updateCrmLeadStatus = async (
    lead: ServiceLead,
    statusId: string,
    lostReason?: string,
    e?: React.SyntheticEvent,
  ) => {
    e?.stopPropagation();
    if (!lead?.id) return;
    if (resolveAdminCrmStatusId(lead) === statusId && statusId !== 'LOST') return;

    setStatusUpdatingId(`crm:${lead.id}`);
    try {
      const res = await fetch(`/api/super_admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          crm_status: statusId,
          lost_reason: lostReason || null,
          crm_note: 'Changed from Bookings admin',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Lead status update failed');

      const updatedLead = enrichBookingLead(json.lead || lead);
      setServiceLeads((prev) => prev.map((row) => (row.id === lead.id ? updatedLead : row)));
      if (detailOpen && detailItem?.id === lead.id) {
        setDetailItem(updatedLead);
      }
      toast.success(`Lead status updated to ${ADMIN_CRM_STATUS_OPTIONS.find((o) => o.id === statusId)?.label || statusId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Lead status update failed');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const saveEdit = async () => {
    if (!editLead?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/super_admin/leads/${editLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...editForm,
          estimated_amount: editForm.estimated_amount === '' ? null : Number(editForm.estimated_amount),
          discount_amount: editForm.discount_amount === '' ? 0 : Number(editForm.discount_amount),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      toast.success('Lead updated');
      setEditOpen(false);
      setEditLead(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (lead: ServiceLead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!lead?.id) return;
    if (!window.confirm(`Delete lead ${lead.lead_number || lead.id}? This cannot be undone.`)) return;
    setDeletingId(String(lead.id));
    try {
      const res = await fetch(`/api/super_admin/leads/${lead.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      toast.success('Lead deleted');
      setServiceLeads((prev) => prev.filter((row) => row.id !== lead.id));
      if (detailOpen && detailItem?.id === lead.id) setDetailOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pageLeadIds = useMemo(
    () => pagedServiceLeads.map((l) => String(l.id || '')).filter(Boolean),
    [pagedServiceLeads],
  );
  const allPageSelected =
    pageLeadIds.length > 0 && pageLeadIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageLeadIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageLeadIds) next.delete(id);
      } else {
        for (const id of pageLeadIds) next.add(id);
      }
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} selected lead${count > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    const ids = Array.from(selectedIds);

    const BATCH = 5;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((id) => fetch(`/api/super_admin/leads/${id}`, { method: 'DELETE', credentials: 'include' }).then((r) => {
          if (!r.ok) throw new Error('fail');
          return id;
        })),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') deleted++; else failed++;
      }
    }

    setServiceLeads((prev) => prev.filter((l) => !selectedIds.has(String(l.id))));
    setSelectedIds(new Set());
    setBulkDeleting(false);

    if (failed > 0) {
      toast.error(`${deleted} deleted, ${failed} failed (may be linked to jobs/invoices)`);
    } else {
      toast.success(`${deleted} lead${deleted > 1 ? 's' : ''} deleted`);
    }
  };

  const bulkAssignTelecaller = async (clear = false, opts?: { keepSelection?: boolean }) => {
    if (selectedIds.size === 0) return;
    if (!clear && !bulkAssignTcId) {
      toast.error('Pick a telecaller');
      return;
    }
    setBulkAssigning(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/lead-manager/bulk-assign-telecaller', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: ids,
          telecaller_id: clear ? undefined : bulkAssignTcId,
          clear,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Bulk assign failed');
      const tcName =
        telecallers.find((t) => t.id === bulkAssignTcId)?.full_name || 'telecaller';
      const idSet = new Set(ids);
      setServiceLeads((prev) =>
        prev.map((l) => {
          if (!idSet.has(String(l.id))) return l;
          return {
            ...l,
            assigned_telecaller_id: clear ? null : bulkAssignTcId,
            assigned_telecaller_name: clear ? null : tcName,
          } as any;
        }),
      );
      toast.success(json?.message || `Updated ${json?.updated || ids.length}`);
      if (!opts?.keepSelection) {
        setSelectedIds(new Set());
        setBulkAssignTcId('');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Bulk assign failed');
      throw e;
    } finally {
      setBulkAssigning(false);
    }
  };

  const bulkUpdateLeadStatus = async (opts?: { keepSelection?: boolean }) => {
    if (selectedIds.size === 0) return;
    if (!bulkStatus) {
      toast.error('Pick a status');
      return;
    }
    setBulkStatusUpdating(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/super_admin/leads/bulk-status', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: ids,
          status: bulkStatus,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Bulk status update failed');
      const idSet = new Set(ids);
      setServiceLeads((prev) => {
        if (statusFilter !== 'ALL' && bulkStatus !== statusFilter) {
          return prev.filter((l) => !idSet.has(String(l.id)));
        }
        return prev.map((l) => (idSet.has(String(l.id)) ? ({ ...l, status: bulkStatus } as any) : l));
      });
      toast.success(json?.message || `Updated ${ids.length} lead(s)`);
      if (!opts?.keepSelection) {
        setSelectedIds(new Set());
        setBulkStatus('');
        setBulkEditOpen(false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Bulk status update failed');
      throw e;
    } finally {
      setBulkStatusUpdating(false);
    }
  };

  const proceedBulkEdit = async () => {
    if (!bulkStatus && !bulkAssignTcId) {
      toast.error('Pick a status or telecaller');
      return;
    }
    try {
      if (bulkStatus) await bulkUpdateLeadStatus({ keepSelection: Boolean(bulkAssignTcId) });
      if (bulkAssignTcId) await bulkAssignTelecaller(false, { keepSelection: false });
      setBulkStatus('');
      setBulkAssignTcId('');
      setSelectedIds(new Set());
      setBulkEditOpen(false);
    } catch {
      /* toasts already shown */
    }
  };

  const handleExport = async () => {
    if (datePreset === 'custom' && (!customStart || !customEnd)) {
      toast.error('Please select both start and end dates');
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({ export: '1', preset: datePreset });
      if (datePreset === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (couponFilter !== 'ALL') params.set('has_coupon', couponFilter);

      const res = await fetch(`/api/super_admin/leads?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings-leads-${datePreset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="shrink-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-brand-primary" />
                Bookings & Leads
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                All bookings in one place — save filter views, then reuse them anytime.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:flex-1 xl:justify-end min-w-0">
              {showUploadCrm ? (
                <button
                  type="button"
                  onClick={() => {
                    if (String(pathname || '').includes('/lead_manager/bookings')) {
                      router.push('/dashboard/lead_manager/leads');
                      return;
                    }
                    setShowUploadCrm(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Back to leads
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUploadCrm(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  Upload CRM Data
                </button>
              )}

              {!showUploadCrm ? (
                <>
                  <div className="inline-flex shrink-0 items-center rounded-full border-2 border-[#004AAD] bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setChartDrill(null);
                        setViewMode('chart');
                      }}
                      title="Chart view"
                      aria-pressed={viewMode === 'chart'}
                      style={
                        viewMode === 'chart'
                          ? { backgroundColor: '#004AAD', color: '#fff' }
                          : { color: '#334155' }
                      }
                      className={`inline-flex h-9 w-10 items-center justify-center rounded-full transition ${
                        viewMode === 'chart' ? 'shadow-sm' : 'hover:bg-slate-50'
                      }`}
                    >
                      <LineChart className="h-4 w-4" stroke="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      title="List view"
                      aria-pressed={viewMode === 'list'}
                      style={
                        viewMode === 'list'
                          ? { backgroundColor: '#004AAD', color: '#fff' }
                          : { color: '#334155' }
                      }
                      className={`inline-flex h-9 w-10 items-center justify-center rounded-full transition ${
                        viewMode === 'list' ? 'shadow-sm' : 'hover:bg-slate-50'
                      }`}
                    >
                      <List className="h-4 w-4" stroke="currentColor" />
                    </button>
                  </div>
                  {viewMode === 'list' ? (
                  <div className="relative shrink-0" ref={columnsMenuRef}>
                    <button
                      type="button"
                      onClick={() => setColumnsMenuOpen((open) => !open)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      aria-expanded={columnsMenuOpen}
                      aria-haspopup="true"
                    >
                      <Columns3 className="h-4 w-4" />
                      Columns
                      <ChevronDown className={`h-4 w-4 transition ${columnsMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {columnsMenuOpen ? (
                      <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Show columns</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                              onClick={() => {
                                const next = { ...visibleColumns };
                                for (const col of BOOKINGS_TABLE_COLUMNS) {
                                  if (!col.onByDefault) next[col.key] = true;
                                }
                                setVisibleColumns(next);
                                try {
                                  window.localStorage.setItem(BOOKINGS_COLUMNS_STORAGE_KEY, JSON.stringify(next));
                                } catch {
                                  /* ignore */
                                }
                              }}
                            >
                              All detail
                            </button>
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                const next = { ...DEFAULT_BOOKINGS_COLUMNS };
                                setVisibleColumns(next);
                                try {
                                  window.localStorage.setItem(BOOKINGS_COLUMNS_STORAGE_KEY, JSON.stringify(next));
                                } catch {
                                  /* ignore */
                                }
                              }}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                          {BOOKINGS_COLUMN_GROUPS.map((group) => {
                            const cols = BOOKINGS_TABLE_COLUMNS.filter((col) => col.group === group);
                            if (cols.length === 0) return null;
                            return (
                              <div key={group}>
                                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                  {group === 'Core' ? 'Table' : group}
                                </p>
                                <div className="space-y-0.5">
                                  {cols.map((col) => (
                                    <label
                                      key={col.key}
                                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={visibleColumns[col.key]}
                                        onChange={() => toggleTableColumn(col.key)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      {col.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[10px] text-gray-400">
                          Detail fields match lead click view. Select + Actions always stay visible.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleExport()}
                    disabled={loading || exporting || (datePreset === 'custom' && (!customStart || !customEnd))}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {exporting ? 'Exporting...' : 'Export CSV'}
                  </button>
                </>
              ) : null}

              <AdminPageRefresh
                onClick={() => {
                  if (showUploadCrm) setShowUploadCrm(false);
                  void fetchData();
                }}
                loading={loading}
                className="shrink-0 justify-center"
              />
            </div>
          </div>

          {!showUploadCrm ? (
            <div className="mt-2">
              <BookingsSavedViews
                snapshot={viewSnapshot}
                onApply={applyViewSnapshot}
                sourceOptions={SOURCE_OPTIONS.map((source) => ({
                  value: source,
                  label: sourceFilterLabel(source),
                }))}
                statusOptions={STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: status === 'ALL' ? 'All statuses' : status.replace(/_/g, ' '),
                }))}
                couponOptions={COUPON_OPTIONS.map((coupon) => ({
                  value: coupon,
                  label: couponFilterLabel(coupon),
                }))}
                recordingOptions={RECORDING_OPTIONS.map((opt) => ({
                  value: opt,
                  label: recordingFilterLabel(opt),
                }))}
                assigneeOptions={[
                  { value: 'UNASSIGNED', label: 'Unassigned' },
                  ...assigneeOptions.map((name) => ({ value: name, label: name })),
                ]}
                messageTriggerOptions={messageTriggerOptions}
              />
            </div>
          ) : null}

          {!showUploadCrm ? (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ReportDateRangeFilter
                  variant="compact"
                  preset={datePreset}
                  customStart={customStart}
                  customEnd={customEnd}
                  onChange={handleDateRangeChange}
                />

                    <FilterSelect
                      label="Source"
                      value={sourceFilter}
                      onChange={(v) => setSourceFilter(v as (typeof SOURCE_OPTIONS)[number])}
                    >
                      {SOURCE_OPTIONS.map((source) => (
                        <option key={source} value={source}>
                          {sourceFilterLabel(source)}
                        </option>
                      ))}
                    </FilterSelect>

                    <FilterSelect
                      label="Discount"
                      value={couponFilter}
                      onChange={(v) => setCouponFilter(v as (typeof COUPON_OPTIONS)[number])}
                    >
                      {COUPON_OPTIONS.map((coupon) => (
                        <option key={coupon} value={coupon}>
                          {couponFilterLabel(coupon)}
                        </option>
                      ))}
                    </FilterSelect>

                    <FilterSelect
                      label="Status"
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as (typeof STATUS_OPTIONS)[number])}
                      className="min-w-[130px]"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status === 'ALL' ? 'All statuses' : status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </FilterSelect>

                    <FilterSelect
                      label="Recording"
                      value={recordingFilter}
                      onChange={(v) => setRecordingFilter(v as (typeof RECORDING_OPTIONS)[number])}
                      className="min-w-[120px]"
                    >
                      {RECORDING_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {recordingFilterLabel(opt)}
                        </option>
                      ))}
                    </FilterSelect>
                    {recordingFilter !== 'ALL' && loadingRecordingIds ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                      </span>
                    ) : null}

                    <FilterMultiSelect
                      label="Assignee"
                      allLabel="Assignee"
                      selected={assigneeFilter}
                      onChange={setAssigneeFilter}
                      className="min-w-[150px]"
                      options={[
                        { value: 'UNASSIGNED', label: 'Unassigned' },
                        ...assigneeOptions.map((name) => ({ value: name, label: name })),
                      ]}
                    />

                    <FilterMultiSelect
                      label="Trigger"
                      allLabel="Trigger"
                      selected={messageTriggerFilter}
                      onChange={setMessageTriggerFilter}
                      className="min-w-[140px]"
                      options={messageTriggerOptions}
                    />

                {(sourceFilter !== 'ALL' ||
                  couponFilter !== 'ALL' ||
                  statusFilter !== 'ALL' ||
                  recordingFilter !== 'ALL' ||
                  assigneeFilter.length > 0 ||
                  messageTriggerFilter.length > 0 ||
                  tagIds.length > 0 ||
                  sourceLabelFilter.trim() ||
                  leadTypeFilter.trim() ||
                  chartDrill) ? (
                  <button
                    type="button"
                    onClick={clearLeadFilters}
                    className="h-8 px-2 text-xs font-semibold text-[#004AAD] hover:bg-blue-50 rounded-md"
                  >
                    Clear
                  </button>
                ) : null}

                <label className="relative min-w-[180px] flex-1 max-w-sm">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="bookings-search"
                      name="bookings-search"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search name, phone, vehicle..."
                      className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004AAD]/30"
                      autoComplete="off"
                    />
                    {searchTerm.trim() ? (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        onClick={() => setSearchTerm('')}
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </label>

                {leadsTruncated ? (
                  <p className="text-[11px] font-medium text-amber-600 shrink-0 pb-2">
                    Showing latest {serviceLeads.length.toLocaleString('en-IN')} of{' '}
                    {(totalInRange || 0).toLocaleString('en-IN')} — narrow the date range for the rest
                  </p>
                ) : null}
              </div>

              {chartDrill && viewMode === 'list' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                    Chart: {chartDimensionLabel(chartDrill.dimension)} → {chartDrill.key}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-violet-100"
                      aria-label="Clear chart filter"
                      onClick={() => setChartDrill(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-700 hover:underline"
                    onClick={() => {
                      setChartDrill(null);
                      setViewMode('chart');
                    }}
                  >
                    Back to chart
                  </button>
                </div>
              ) : null}

              {(sourceLabelFilter || leadTypeFilter) && viewMode === 'list' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {sourceLabelFilter ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
                      Source: {sourceLabelFilter}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-blue-100"
                        aria-label="Clear source label filter"
                        onClick={() => setSourceLabelFilter('')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                  {leadTypeFilter ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      Type: {leadTypeFilter}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-emerald-100"
                        aria-label="Clear lead type filter"
                        onClick={() => setLeadTypeFilter('')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Bulk action bar */}
      {!showUploadCrm && selectedIds.size > 0 ? (
        <div className="sticky top-[200px] z-10 mx-4 sm:mx-6 lg:mx-8 mt-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 px-5 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-slate-600" />
            <span className="text-sm font-bold">{selectedIds.size} Selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              Deselect All
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              Bulk Edit
            </button>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 min-w-[140px]"
              value={bulkAssignTcId}
              onChange={(e) => setBulkAssignTcId(e.target.value)}
              onFocus={() => {
                if (!telecallers.length) void loadTelecallers(null);
              }}
            >
              <option value="">Assign telecaller…</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                  {!t.is_active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkAssigning}
              onClick={() => void bulkAssignTelecaller(false)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {bulkAssigning ? 'Assigning…' : 'Bulk assign'}
            </button>
            <button
              type="button"
              disabled={bulkAssigning}
              onClick={() => void bulkAssignTelecaller(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              Unassign
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={bulkDelete}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition disabled:opacity-60"
            >
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </button>
          </div>
        </div>
      ) : null}

      {bulkEditOpen && selectedIds.size > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBulkEditOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <button type="button" onClick={() => setBulkEditOpen(false)} className="p-1 rounded hover:bg-slate-100" aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
              <p className="text-sm text-slate-700">
                Selected leads: <span className="font-bold">{selectedIds.size}</span>
              </p>
              <span className="w-6" />
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800">Update Lead Status</span>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className={`text-[11px] font-semibold rounded-full pl-3 pr-8 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      bulkStatus ? leadStatusSelectClass(bulkStatus) : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <option value="">Stage</option>
                    {LEAD_STATUS_ENUM.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <span className="text-sm font-medium text-slate-800">Re/assign telecaller</span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 max-w-[160px]"
                    value={bulkAssignTcId}
                    onChange={(e) => setBulkAssignTcId(e.target.value)}
                    onFocus={() => {
                      if (!telecallers.length) void loadTelecallers(null);
                    }}
                  >
                    <option value="">Select…</option>
                    {telecallers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                disabled={bulkStatusUpdating || bulkAssigning || (!bulkStatus && !bulkAssignTcId)}
                onClick={() => void proceedBulkEdit()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-bold py-3 disabled:opacity-60"
              >
                {(bulkStatusUpdating || bulkAssigning) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                PROCEED WITH {selectedIds.size} LEADS
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="px-4 sm:px-6 lg:px-8 py-5">
        {!showUploadCrm && !loading ? (
          <div className="mb-5">
            {hasActiveLeadFilters ? (
              <p className="mb-3 text-xs font-medium text-amber-700">
                Overview for filtered results · {displayedServiceLeads.length} of {serviceLeads.length} loaded
                {typeof totalInRange === 'number' ? ` · ${totalInRange.toLocaleString('en-IN')} in date range` : ''}
              </p>
            ) : leadsTruncated ? (
              <p className="mb-3 text-xs font-medium text-amber-700">
                Showing latest {serviceLeads.length.toLocaleString('en-IN')} of{' '}
                {(totalInRange || 0).toLocaleString('en-IN')} leads in range — use a shorter date filter for full list
              </p>
            ) : datePreset !== 'all_time' ? (
              <p className="mb-3 text-xs font-medium text-gray-500">Overview for {dateRangeLabel}</p>
            ) : null}
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9">
              <StatCard
                label={hasActiveLeadFilters ? 'Filtered Leads' : 'Total Leads'}
                value={serviceLeadOverview.total}
                icon={<ClipboardList className="h-4 w-4" />}
                onClick={clearLeadFilters}
                active={hasActiveLeadFilters}
              />
              <StatCard
                label="App Booking"
                value={serviceLeadOverview.app}
                icon={<Smartphone className="h-4 w-4" />}
                onClick={() => setSourceFilter(sourceFilter === 'APP' ? 'ALL' : 'APP')}
                active={sourceFilter === 'APP'}
              />
              <StatCard
                label="Website"
                value={serviceLeadOverview.website}
                icon={<Globe className="h-4 w-4" />}
                onClick={() => setSourceFilter(sourceFilter === 'WEBSITE' ? 'ALL' : 'WEBSITE')}
                active={sourceFilter === 'WEBSITE'}
              />
              <StatCard
                label="MISA AI"
                value={serviceLeadOverview.misa}
                icon={<Bot className="h-4 w-4" />}
                onClick={() => setSourceFilter(sourceFilter === 'MISA' ? 'ALL' : 'MISA')}
                active={sourceFilter === 'MISA'}
              />
              <StatCard
                label="Google Ads"
                value={serviceLeadOverview.googleAds}
                icon={<Megaphone className="h-4 w-4" />}
                onClick={() => setSourceFilter(sourceFilter === 'GOOGLE' ? 'ALL' : 'GOOGLE')}
                active={sourceFilter === 'GOOGLE'}
              />
              <StatCard
                label="Meta / Insta Ads"
                value={serviceLeadOverview.metaAds}
                icon={<Megaphone className="h-4 w-4" />}
                onClick={() => setSourceFilter(sourceFilter === 'META' ? 'ALL' : 'META')}
                active={sourceFilter === 'META'}
              />
              <StatCard
                label="Promo Coupon"
                value={serviceLeadOverview.withPromoCoupon}
                icon={<Ticket className="h-4 w-4" />}
                accentClassName="bg-orange-300/30 text-orange-100"
                onClick={() => setCouponFilter(couponFilter === 'PROMO' ? 'ALL' : 'PROMO')}
                active={couponFilter === 'PROMO'}
              />
              <StatCard
                label="Refer & Rise"
                value={serviceLeadOverview.withReferralReward}
                icon={<Gift className="h-4 w-4" />}
                accentClassName="bg-amber-300/30 text-amber-100"
                onClick={() => setCouponFilter(couponFilter === 'REFERRAL' ? 'ALL' : 'REFERRAL')}
                active={couponFilter === 'REFERRAL'}
              />
              <StatCard
                label="New Leads"
                value={serviceLeadOverview.newLeads}
                icon={<UserRound className="h-4 w-4" />}
                onClick={() => setStatusFilter(statusFilter === 'NEW' ? 'ALL' : 'NEW')}
                active={statusFilter === 'NEW'}
              />
            </div>
          </div>
        ) : null}

        {showUploadCrm ? (
          <div className="space-y-5">
            {/* Upload Area */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileChange} className="hidden" />

              {csvRows.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center gap-3 hover:border-brand-primary hover:bg-blue-50/30 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-10 h-10 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Click to upload CSV file</p>
                    <p className="text-xs text-gray-500 mt-1">
                      TeleCRM export: Phone, CARNO, Model (make inferred), LEADTAG matched to Incoming Sarv Call / Website / App Booking. Created &amp; modified times and packagerateaccess are kept. Lead link, lead id and workshop shortAddress are ignored.
                    </p>
                  </div>
                </button>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-brand-primary" />
                      <span className="text-sm font-semibold text-gray-800">{csvFileName}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{csvRows.length} rows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={clearCsv} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Clear
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Change File
                      </button>
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Uploading...' : 'Upload to Database'}
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const badPhones = csvRows.filter((r) => !isValidEnquiryPhone(r.phone_no));
                    if (!badPhones.length) return null;
                    return (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {badPhones.length} row{badPhones.length > 1 ? 's' : ''} have invalid phone
                        {badPhones.slice(0, 3).map((r) => (
                          <span key={`${r.name}-${r.phone_no}`}>
                            {' '}· {r.name || 'row'}: <span className="font-mono">{r.phone_no || '(empty)'}</span> ({String(r.phone_no || '').length} digits)
                          </span>
                        ))}
                        . Need 10-digit Indian mobile (starts 6–9), or 91 + 10 digits. Excel Phone column should be Text.
                      </div>
                    );
                  })()}

                  {uploadResult && (
                    <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${uploadResult.errors ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                      {uploadResult.errors ? (
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                      )}
                      <div className="text-sm">
                        <p className="font-semibold text-gray-800">
                          {uploadResult.inserted} / {uploadResult.total} records inserted
                          {uploadResult.skipped > 0 && <span className="text-yellow-700"> ({uploadResult.skipped} skipped — missing phone)</span>}
                        </p>
                        {uploadResult.errors?.map((err, i) => (
                          <p key={i} className="text-red-600 text-xs mt-1">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                          {CSV_COLUMNS.map((col) => (
                            <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                            {CSV_COLUMNS.map((col) => {
                              const raw = row[col] || '';
                              const display =
                                (col === 'created_at' || col === 'updated_at') && raw
                                  ? formatEnquiryTimestamp(raw)
                                  : raw;
                              const invalidPhone = col === 'phone_no' && !isValidEnquiryPhone(row.phone_no);
                              return (
                                <td
                                  key={col}
                                  className={`px-3 py-2 whitespace-nowrap max-w-[220px] truncate ${
                                    invalidPhone ? 'text-red-600 font-semibold' : 'text-gray-700'
                                  }`}
                                >
                                  {display || <span className="text-gray-300">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 100 && (
                      <div className="text-center py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                        Showing first 100 of {csvRows.length} rows
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            <p className="text-sm text-gray-600 mt-3">Loading records...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        ) : recordingFilter !== 'ALL' && (loadingRecordingIds || !recordingLeadIds) ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-gray-600 mt-3">Loading recordings filter...</p>
          </div>
        ) : displayedServiceLeads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try changing search or status filters.</p>
          </div>
        ) : viewMode === 'chart' ? (
          <BookingsLeadsChartPanel
            leads={baseFilteredServiceLeads}
            showManagerDimensions
            onViewLeads={() => {
              setChartDrill(null);
              setViewMode('list');
            }}
            onBarClick={({ dimension, key, count }) => {
              setChartDrill({ dimension, key });
              setViewMode('list');
              toast.success(`Opened ${count.toLocaleString('en-IN')} lead${count === 1 ? '' : 's'} · ${key}`);
            }}
          />
        ) : (          <>
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full" style={{ minWidth: tableMinWidthPx }}>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="sticky left-0 z-20 bg-gray-50 px-2 py-3 w-12 min-w-[48px] border-r border-gray-200">
                        <button type="button" onClick={toggleSelectAll} className="p-1 rounded hover:bg-gray-200 transition" title="Select all on this page">
                          {!somePageSelected ? (
                            <Square className="w-5 h-5 text-gray-500" />
                          ) : allPageSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <MinusSquare className="w-5 h-5 text-blue-600" />
                          )}
                        </button>
                      </th>
                      {showCol('leadStatus') ? <th className="px-3 py-3 whitespace-nowrap min-w-[130px]">Lead Status</th> : null}
                      {showCol('leadNumber') ? <th className="px-3 py-3 whitespace-nowrap min-w-[120px]">Lead #</th> : null}
                      {showCol('customer') ? <th className="px-3 py-3 whitespace-nowrap min-w-[180px]">Customer</th> : null}
                      {showCol('message') ? <th className="px-3 py-3 whitespace-nowrap min-w-[140px]">Message</th> : null}
                      {showCol('leadsCount') ? (
                        <th className="px-3 py-3 whitespace-nowrap min-w-[100px]" title="How many lead rows exist for this phone">
                          Leads #
                        </th>
                      ) : null}
                      {showCol('vehicle') ? <th className="px-3 py-3 whitespace-nowrap min-w-[120px]">Vehicle</th> : null}
                      {showCol('city') ? <th className="px-3 py-3 whitespace-nowrap min-w-[120px]">City</th> : null}
                      {showCol('service') ? <th className="px-3 py-3 whitespace-nowrap min-w-[180px]">Service</th> : null}
                      {showCol('discount') ? <th className="px-3 py-3 whitespace-nowrap min-w-[100px]">Discount</th> : null}
                      {showCol('amount') ? <th className="px-3 py-3 whitespace-nowrap min-w-[100px]">Amount</th> : null}
                      {showCol('date') ? <th className="px-3 py-3 whitespace-nowrap min-w-[110px]">Date</th> : null}
                      {showCol('time') ? <th className="px-3 py-3 whitespace-nowrap min-w-[90px]">Time</th> : null}
                      {showCol('status') ? <th className="px-3 py-3 whitespace-nowrap min-w-[150px]">Status</th> : null}
                      {showCol('source') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Source</th> : null}
                      {showCol('assignee') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Assignee</th> : null}
                      {showCol('phone') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Phone</th> : null}
                      {showCol('utmCampaign') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">UTM Campaign</th> : null}
                      {showCol('leadType') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Lead Type</th> : null}
                      {showCol('priority') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Priority</th> : null}
                      {showCol('createdFrom') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Created From</th> : null}
                      {showCol('email') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Email</th> : null}
                      {showCol('address') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Address</th> : null}
                      {showCol('pickupRequired') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Pickup</th> : null}
                      {showCol('make') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Make</th> : null}
                      {showCol('model') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Model</th> : null}
                      {showCol('variant') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Variant</th> : null}
                      {showCol('year') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Year</th> : null}
                      {showCol('fuelType') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Fuel</th> : null}
                      {showCol('odometer') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Odometer</th> : null}
                      {showCol('serviceType') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Service Type</th> : null}
                      {showCol('preferredDate') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Pref. Date</th> : null}
                      {showCol('preferredTime') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Pref. Time</th> : null}
                      {showCol('preferredSlot') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Pref. Slot</th> : null}
                      {showCol('problemDescription') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Problem</th> : null}
                      {showCol('notes') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Notes</th> : null}
                      {showCol('utmSource') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">UTM Source</th> : null}
                      {showCol('utmMedium') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">UTM Medium</th> : null}
                      {showCol('utmTerm') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">UTM Term</th> : null}
                      {showCol('utmContent') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">UTM Content</th> : null}
                      {showCol('estimatedAmount') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Est. Amt</th> : null}
                      {showCol('actualAmount') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Actual Amt</th> : null}
                      {showCol('paymentMode') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Pay Mode</th> : null}
                      {showCol('paymentStatus') ? <th className="px-3 py-3 whitespace-nowrap w-[120px]">Pay Status</th> : null}
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedServiceLeads.map((lead, rowIndex) => {
                      const checkoutSiblings = checkoutSiblingsFor(lead, checkoutIndex);
                      const groupedServiceLines = checkoutServiceLines(lead, checkoutSiblings);
                      const serviceLabel =
                        checkoutSiblings.length > 0
                          ? groupedServiceLines.map((line) => line.name).join(', ')
                          : getServiceLabel(lead);
                      const misaServices =
                        checkoutSiblings.length > 0
                          ? groupedServiceLines.map((line) => ({ name: line.name, price: line.price }))
                          : extractMisaServices(lead);
                      const rowAmount =
                        getLeadDisplayAmount(lead) +
                        checkoutSiblings.reduce((sum, row) => sum + getLeadDisplayAmount(row), 0);
                      const leadId = String(lead.id || '');
                      const isSelected = leadId ? selectedIds.has(leadId) : false;
                      const phoneKey = normalizeLeadPhone(lead.customer_phone);
                      const phoneBookingCount = phoneKey
                        ? collapsedBookingsByPhone.get(phoneKey)?.length || 0
                        : 0;
                      const zebra = rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                      return (
                      <tr
                        key={String(lead.id || `${lead.lead_number}-${lead.created_at}`)}
                        onClick={() => openDetail('Service Lead Details', lead)}
                        className={`border-b border-gray-100 cursor-pointer transition ${
                          isSelected
                            ? 'bg-blue-50 hover:bg-blue-100/60'
                            : `${zebra} hover:bg-sky-50/80`
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-10 px-2 py-3 w-12 min-w-[48px] border-r border-gray-100 ${
                            isSelected ? 'bg-blue-50' : zebra === 'bg-white' ? 'bg-white' : 'bg-slate-50'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {leadId ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleSelect(leadId); }}
                              className="p-1 rounded hover:bg-gray-200 transition"
                              title="Select lead"
                              aria-label="Select lead"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-500" />
                              )}
                            </button>
                          ) : null}
                        </td>
                        {showCol('leadStatus') ? (
                          <td className="px-3 py-3 text-sm min-w-[130px]">
                            <TelecallerUpdateCell
                              lead={lead}
                              updating={statusUpdatingId === `crm:${leadId}`}
                              onChange={(statusId, lostReason) =>
                                void updateCrmLeadStatus(lead, statusId, lostReason)
                              }
                            />
                          </td>
                        ) : null}
                        {showCol('leadNumber') ? (
                          <td className="px-3 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap min-w-[120px]">{lead.lead_number || '-'}</td>
                        ) : null}
                        {showCol('customer') ? (
                          <td className="px-3 py-3 text-sm text-gray-800 min-w-[180px] whitespace-normal break-words">
                            {lead.customer_name || '-'}
                          </td>
                        ) : null}
                        {showCol('message') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 min-w-[140px] max-w-[220px]">
                            <span className="block truncate" title={getLeadInboundWhatsAppMessage(lead) || ''}>
                              {getLeadInboundWhatsAppMessage(lead) || '—'}
                            </span>
                          </td>
                        ) : null}
                        {showCol('leadsCount') ? (
                          <td className="px-3 py-3 text-sm whitespace-nowrap w-[120px] max-w-[120px]">
                            {phoneBookingCount > 0 ? (
                              <button
                                type="button"
                                title="View all bookings for this number"
                                onClick={(e) => openPhoneBookings(lead.customer_phone, e)}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-800 hover:ring-blue-200 transition"
                              >
                                <Hash className="h-3 w-3" />
                                {phoneBookingCount}
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ) : null}
                        {showCol('vehicle') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{lead.vehicle_number || '-'}</td>
                        ) : null}
                        {showCol('city') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{lead.city || '-'}</td>
                        ) : null}
                        {showCol('service') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 min-w-[180px] whitespace-normal break-words">
                            {misaServices.length > 1 ? (
                              <div className="space-y-0.5">
                                {misaServices.map((service, index) => (
                                  <div key={`${service.name}-${index}`} className="text-xs leading-4">
                                    {service.name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span>{serviceLabel || '—'}</span>
                            )}
                          </td>
                        ) : null}
                        {showCol('discount') ? (
                          <td className="px-3 py-3 text-sm whitespace-nowrap min-w-[100px]">
                            <LeadDiscountBadge lead={lead} />
                          </td>
                        ) : null}
                        {showCol('amount') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap min-w-[100px]">{formatCurrency(rowAmount)}</td>
                        ) : null}
                        {showCol('date') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap min-w-[110px]">{formatDateOnly(lead.created_at)}</td>
                        ) : null}
                        {showCol('time') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap min-w-[90px]">{formatTimeOnly(lead.created_at)}</td>
                        ) : null}
                        {showCol('status') ? (
                          <td className="px-3 py-3 text-sm whitespace-nowrap min-w-[150px]">
                            <LeadStatusSelect
                              value={String(lead.status || 'NEW')}
                              updating={statusUpdatingId === leadId}
                              onChange={(status, ev) => void updateLeadStatus(lead, status, ev)}
                            />
                          </td>
                        ) : null}
                        {showCol('source') ? (
                          <td className="px-3 py-3 text-sm whitespace-nowrap w-[120px] max-w-[120px]">
                            <SourceCell lead={lead} />
                          </td>
                        ) : null}
                        {showCol('assignee') ? (
                          <td className="px-3 py-3 text-sm whitespace-nowrap w-[120px] max-w-[120px]">
                            <AssigneeBadge
                              name={lead.assigned_telecaller_name}
                              onClick={(e) => openQuickAssign(lead, e)}
                            />
                          </td>
                        ) : null}
                        {showCol('phone') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">{lead.customer_phone || '-'}</td>
                        ) : null}
                        {showCol('utmCampaign') ? (
                          <td className="px-3 py-3 text-sm whitespace-nowrap w-[120px] max-w-[120px]">
                            <UtmCampaignCell lead={lead} />
                          </td>
                        ) : null}
                        {showCol('leadType') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.lead_type)}</td>
                        ) : null}
                        {showCol('priority') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.lead_priority)}</td>
                        ) : null}
                        {showCol('createdFrom') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.created_from)}</td>
                        ) : null}
                        {showCol('email') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.customer_email)}</td>
                        ) : null}
                        {showCol('address') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 w-[120px] max-w-[120px]">
                            <span className="block truncate" title={leadAddressText(lead) || ''}>
                              {leadAddressText(lead) || '—'}
                            </span>
                          </td>
                        ) : null}
                        {showCol('pickupRequired') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">{formatDetailScalar(lead.pickup_required)}</td>
                        ) : null}
                        {showCol('make') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.vehicle_make)}</td>
                        ) : null}
                        {showCol('model') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.vehicle_model)}</td>
                        ) : null}
                        {showCol('variant') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.vehicle_variant)}</td>
                        ) : null}
                        {showCol('year') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">{formatDetailScalar(lead.vehicle_year)}</td>
                        ) : null}
                        {showCol('fuelType') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">
                            {formatDetailScalar(lead.vehicle_fuel_type || lead.fuel_type)}
                          </td>
                        ) : null}
                        {showCol('odometer') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">
                            {formatDetailScalar(lead.odometer_km ?? lead.odometer_reading)}
                          </td>
                        ) : null}
                        {showCol('serviceType') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.service_type)}</td>
                        ) : null}
                        {showCol('preferredDate') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">{formatDetailScalar(lead.preferred_date)}</td>
                        ) : null}
                        {showCol('preferredTime') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">
                            {formatDetailScalar(lead.preferred_time_slot || lead.preferred_service_slot)}
                          </td>
                        ) : null}
                        {showCol('preferredSlot') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">
                            {formatPreferredSlotLabel(lead) || '—'}
                          </td>
                        ) : null}
                        {showCol('problemDescription') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 w-[120px] max-w-[120px]">
                            <span className="block truncate" title={String(lead.problem_description || '')}>
                              {String(lead.problem_description || '').trim() || '—'}
                            </span>
                          </td>
                        ) : null}
                        {showCol('notes') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 w-[120px] max-w-[120px]">
                            <span className="block truncate" title={String(lead.description || '')}>
                              {String(lead.description || '').trim() || '—'}
                            </span>
                          </td>
                        ) : null}
                        {showCol('utmSource') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{leadUtmValue(lead, 'utm_source') || '—'}</td>
                        ) : null}
                        {showCol('utmMedium') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{leadUtmValue(lead, 'utm_medium') || '—'}</td>
                        ) : null}
                        {showCol('utmTerm') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{leadUtmValue(lead, 'utm_term') || '—'}</td>
                        ) : null}
                        {showCol('utmContent') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{leadUtmValue(lead, 'utm_content') || '—'}</td>
                        ) : null}
                        {showCol('estimatedAmount') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">{formatCurrency(lead.estimated_amount)}</td>
                        ) : null}
                        {showCol('actualAmount') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px]">{formatCurrency(lead.actual_amount)}</td>
                        ) : null}
                        {showCol('paymentMode') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.payment_mode)}</td>
                        ) : null}
                        {showCol('paymentStatus') ? (
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap w-[120px] max-w-[120px] truncate">{formatDetailScalar(lead.payment_status)}</td>
                        ) : null}
                                                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="Edit lead"
                              onClick={(e) => openEdit(lead, e)}
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 text-blue-600"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete lead"
                              disabled={deletingId === String(lead.id)}
                              onClick={(e) => deleteLead(lead, e)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                            >
                              {deletingId === String(lead.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {pagedServiceLeads.map((item) => {
                const itemId = String(item.id || '');
                const isItemSelected = itemId ? selectedIds.has(itemId) : false;
                const itemSiblings = checkoutSiblingsFor(item, checkoutIndex);
                const itemServiceLabel =
                  itemSiblings.length > 0
                    ? checkoutServiceLines(item, itemSiblings).map((line) => line.name).join(', ')
                    : getServiceLabel(item);
                const itemAmount =
                  getLeadDisplayAmount(item) +
                  itemSiblings.reduce((sum, row) => sum + getLeadDisplayAmount(row), 0);
                return (
                <div
                  key={String(item.id || `${item.lead_number}-${item.created_at}`)}
                  className={`bg-white border rounded-xl p-4 shadow-sm ${isItemSelected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}
                >
                  {itemId ? (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(itemId)}
                        className="p-0.5 rounded"
                      >
                        {isItemSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <span className="text-xs text-gray-500">Select</span>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail('Service Lead Details', item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail('Service Lead Details', item);
                        }
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <p className="text-sm font-bold text-gray-900 break-words">
                        {item.customer_name || item.lead_number || '-'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.customer_phone || '-'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SourceCell lead={item} />
                        {item.has_coupon_applied ? <LeadDiscountBadge lead={item} /> : null}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>
                          <p className="text-gray-500">City</p>
                          <p className="font-medium text-gray-800">{item.city || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Leads on phone</p>
                          <button
                            type="button"
                            onClick={(e) => openPhoneBookings(item.customer_phone, e)}
                            className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800"
                            title="Lead rows for this phone — not confirmed booking count"
                          >
                            <Hash className="h-3 w-3" />
                            {collapsedBookingsByPhone.get(normalizeLeadPhone(item.customer_phone))?.length || 1}
                          </button>
                        </div>
                        <div>
                          <p className="text-gray-500">Vehicle</p>
                          <p className="font-medium text-gray-800">{item.vehicle_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Amount</p>
                          <p className="font-medium text-gray-800">{formatCurrency(itemAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="font-medium text-gray-800">{formatDateTime(item.created_at)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">Service</p>
                          <p className="font-medium text-gray-800">{itemServiceLabel || '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">UTM Campaign</p>
                          <div className="mt-0.5">
                            <UtmCampaignCell lead={item} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <LeadStatusSelect
                      value={String(item.status || 'NEW')}
                      updating={statusUpdatingId === String(item.id)}
                      onChange={(status, ev) => void updateLeadStatus(item, status, ev)}
                    />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Assignee</p>
                    <AssigneeBadge
                      name={item.assigned_telecaller_name}
                      onClick={(e) => openQuickAssign(item, e)}
                    />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Telecaller update</p>
                    <TelecallerUpdateCell
                      lead={item}
                      updating={statusUpdatingId === `crm:${item.id}`}
                      onChange={(statusId, lostReason) =>
                        void updateCrmLeadStatus(item, statusId, lostReason)
                      }
                    />
                  </div>
                  {item.id ? (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === String(item.id)}
                        onClick={() => deleteLead(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              );})}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span>
                  Showing <span className="font-bold text-gray-900">{pageRangeLabel}</span> of{' '}
                  <span className="font-bold text-gray-900">{displayedServiceLeads.length}</span>
                </span>
                <span className="text-gray-300">·</span>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Per page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="min-w-[88px] text-center text-sm font-semibold text-gray-800">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {editOpen && editLead ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Edit Lead {editLead.lead_number || ''}</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Customer Name</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.customer_name} onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Phone</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.customer_phone} onChange={(e) => setEditForm((f) => ({ ...f, customer_phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Vehicle</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.vehicle_number} onChange={(e) => setEditForm((f) => ({ ...f, vehicle_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">City</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Status</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                    {LEAD_STATUS_ENUM.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Lead Source</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.lead_source} onChange={(e) => setEditForm((f) => ({ ...f, lead_source: e.target.value }))}>
                    {EDIT_LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {editLead ? (
                  <div className="col-span-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-800 mb-2">UTM Tracking</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {UTM_KEYS.map((key) => (
                        <div key={key}>
                          <label className="text-[11px] font-semibold text-gray-500">{UTM_DISPLAY_LABELS[key]}</label>
                          <input
                            readOnly
                            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white text-gray-700"
                            value={getLeadUtmParams(editLead)[key] || '-'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Service</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.service_type} onChange={(e) => setEditForm((f) => ({ ...f, service_type: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Amount (Rs)</label>
                  <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.estimated_amount} onChange={(e) => setEditForm((f) => ({ ...f, estimated_amount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Coupon Code</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.coupon_code} onChange={(e) => setEditForm((f) => ({ ...f, coupon_code: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Discount (Rs)</label>
                  <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.discount_amount} onChange={(e) => setEditForm((f) => ({ ...f, discount_amount: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-lg border text-sm" onClick={() => setEditOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                onClick={saveEdit}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phoneBookingsOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-brand-primary" />
                  Bookings for {phoneBookingsPhone}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {phoneBookingsList.length} booking{phoneBookingsList.length === 1 ? '' : 's'} · click a
                  row for full details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhoneBookingsOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-88px)]">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr className="text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                    <th className="px-4 py-2.5">Lead #</th>
                    <th className="px-4 py-2.5">Source</th>
                    <th className="px-4 py-2.5">Service</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {phoneBookingsList.map((row) => {
                    const otp = resolveOtpVerifiedTag(row);
                    const rowSiblings = checkoutSiblingsFor(row, checkoutIndex);
                    const rowService =
                      rowSiblings.length > 0
                        ? checkoutServiceLines(row, rowSiblings).map((line) => line.name).join(', ')
                        : getServiceLabel(row);
                    const rowAmount =
                      getLeadDisplayAmount(row) +
                      rowSiblings.reduce((sum, sib) => sum + getLeadDisplayAmount(sib), 0);
                    return (
                      <tr
                        key={String(row.id || row.lead_number)}
                        className="border-b border-gray-100 hover:bg-blue-50/60 cursor-pointer"
                        onClick={() => {
                          setPhoneBookingsOpen(false);
                          openDetail('Service Lead Details', row);
                        }}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {row.lead_number || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {otp ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${otp.className}`}
                            >
                              {otp.label}
                            </span>
                          ) : (
                            <SourceBadge lead={row} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[180px] truncate">
                          {rowService || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            {String(row.status || 'NEW').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatCurrency(rowAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                  {phoneBookingsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        No bookings found for this number
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {quickAssignLead ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close assign dialog"
            className="absolute inset-0 bg-black/40"
            onClick={() => setQuickAssignLead(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assign telecaller"
            className="relative z-10 w-full max-w-sm rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-bold text-indigo-900">
                  {quickAssignLead.assigned_telecaller_id ? 'Reassign telecaller' : 'Assign telecaller'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {quickAssignLead.lead_number || 'Lead'} ·{' '}
                  {quickAssignLead.customer_name || quickAssignLead.customer_phone || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAssignLead(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-2">
              Current:{' '}
              <span className="font-semibold text-gray-800">
                {quickAssignLead.assigned_telecaller_name || 'Unassigned'}
              </span>
            </p>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              <button
                type="button"
                disabled={assigning}
                onClick={() => setAssignTelecallerId('')}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 ${
                  !assignTelecallerId ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-gray-700'
                }`}
              >
                Unassigned
              </button>
              {telecallersLoading ? (
                <div className="px-3 py-4 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                visibleTelecallers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={assigning}
                    onClick={() => setAssignTelecallerId(t.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 ${
                      assignTelecallerId === t.id
                        ? 'bg-indigo-50 font-semibold text-indigo-800'
                        : 'text-gray-800'
                    }`}
                  >
                    {t.full_name}
                    {!t.is_active ? (
                      <span className="ml-1 text-[11px] font-medium text-red-500">(inactive)</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
            {inactiveTelecallerCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowInactiveTelecallers((v) => !v)}
                className="mt-2 mb-3 text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
              >
                {showInactiveTelecallers
                  ? 'Hide inactive'
                  : `Show inactive (${inactiveTelecallerCount})`}
              </button>
            ) : (
              <div className="mb-3" />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={assigning || telecallersLoading}
                onClick={() => void saveAssigneeForLead(quickAssignLead, assignTelecallerId)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save'
                )}
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={() => setQuickAssignLead(null)}
                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && detailItem ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close lead details"
            className="flex-1 min-w-0 bg-black/40"
            onClick={() => setDetailOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={detailTitle || 'Lead details'}
            className="relative z-10 flex h-full w-full sm:w-[min(96vw,1280px)] flex-col bg-white shadow-2xl border-l border-gray-200"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 sm:px-5 shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2 min-w-0">
                  <Car className="w-5 h-5 text-brand-primary shrink-0" />
                  <span className="truncate">{detailTitle}</span>
                </h3>
                {detailItem.customer_name || detailItem.customer_phone ? (
                  <p className="mt-0.5 text-xs text-gray-500 truncate pl-7">
                    {[detailItem.customer_name, detailItem.customer_phone].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TelecallerUpdateCell
                  lead={detailItem}
                  updating={statusUpdatingId === `crm:${detailItem.id}`}
                  onChange={(statusId, lostReason) =>
                    void updateCrmLeadStatus(detailItem, statusId, lostReason)
                  }
                />
                {/* Compact TeleCRM-style assignee on the side */}
                <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 pl-2 pr-1 py-1">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <select
                    value={assignTelecallerId}
                    onChange={(e) => setAssignTelecallerId(e.target.value)}
                    disabled={telecallersLoading || assigning}
                    title={detailItem.assigned_telecaller_id ? 'Reassign telecaller' : 'Assign telecaller'}
                    className="max-w-[9.5rem] bg-transparent text-xs font-semibold text-indigo-900 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {visibleTelecallers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                        {!t.is_active ? ' (inactive)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void saveAssignee()}
                    disabled={assigning || telecallersLoading}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </button>
                </div>
                {detailItem.id ? (
                  <button
                    type="button"
                    onClick={() => deleteLead(detailItem)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
              {/* Mobile-only compact assign */}
              <div className="sm:hidden flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 p-2">
                <select
                  value={assignTelecallerId}
                  onChange={(e) => setAssignTelecallerId(e.target.value)}
                  disabled={telecallersLoading || assigning}
                  className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Unassigned</option>
                  {visibleTelecallers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                      {!t.is_active ? ' (inactive)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveAssignee()}
                  disabled={assigning || telecallersLoading}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {assigning ? '…' : 'Save'}
                </button>
              </div>
              {inactiveTelecallerCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowInactiveTelecallers((v) => !v)}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
                >
                  {showInactiveTelecallers
                    ? 'Hide inactive telecallers'
                    : `Show inactive (${inactiveTelecallerCount})`}
                </button>
              ) : null}

              <ServiceLeadDetailContent
                item={detailItem}
                allLeads={serviceLeads}
                onPatch={saveDetailPatch}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default function SuperAdminBookingsRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Loading bookings…
        </div>
      }
    >
      <SuperAdminBookingsPage />
    </Suspense>
  );
}

