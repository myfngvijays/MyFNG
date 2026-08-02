'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Car, ClipboardList, Loader2, Search, UserRound, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Smartphone, Globe, Ticket, Pencil, Trash2, CheckSquare, Square, MinusSquare, Download, MessageCircle, Wrench, DollarSign, Hash, Megaphone, Gift, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import ReportDateRangeFilter from '@/components/admin/ReportDateRangeFilter';
import {
  filterBookingLeads,
  enrichBookingLead,
  getLeadServiceLabel,
  getLeadDisplayAmount,
  getLeadInboundWhatsAppMessage,
  isWhatsAppEnquiryLead,
  getLeadUtmParams,
  resolveLeadSourceBadgeTheme,
  computeServiceLeadOverview,
  type LeadSourceBadgeKind,
} from '@/lib/booking-lead-utils';
import { UTM_DISPLAY_LABELS, UTM_KEYS } from '@/lib/utm';
import { LEAD_SOURCES } from '@/lib/enquiry/createLead';
import { resolveReportDateRange, type ReportDatePreset } from '@/lib/report-date-range';

type ServiceLead = Record<string, any>;
type CsvRow = Record<string, string>;

const STATUS_OPTIONS = ['ALL', 'NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'] as const;
const LEAD_STATUS_ENUM = ['NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'] as const;
const SOURCE_OPTIONS = [
  'ALL',
  'APP',
  'WEBSITE',
  'MISA',
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
] as const;

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
        className={`max-w-[148px] text-[11px] font-semibold rounded-full pl-2 pr-6 py-1 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${leadStatusSelectClass(value)}`}
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
  other: { backgroundColor: '#F3F4F6', color: '#374151' },
};

function SourceBadge({ lead }: { lead: Record<string, any> }) {
  // Always recompute from lead fields so stale enriched white-text classes are ignored.
  const theme = resolveLeadSourceBadgeTheme(lead);

  const kind = theme.source_badge_kind;
  const label = theme.source_badge_label || lead.lead_source || lead.booking_source_label || 'Other';
  const styles = theme.source_badge_class || 'bg-gray-100 text-gray-700';
  const inline = SOURCE_KIND_INLINE[kind] || SOURCE_KIND_INLINE.other;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${styles}`}
      style={inline}
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

/** Web OTP Verified / Mob OTP Verified — shown in Source column. */
function resolveOtpVerifiedTag(lead: Record<string, any>): {
  label: 'Web OTP Verified' | 'Mob OTP Verified';
  className: string;
  kind: 'website' | 'app';
} | null {
  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? (lead.coupon_meta as Record<string, unknown>) : {};
  const result = String(meta.last_call_result || lead.otp_result || '').toUpperCase();
  const labelRaw = String(meta.last_call_label || lead.otp_label || '').toLowerCase();
  const desc = String(lead.description || lead.problem_description || '').toLowerCase();
  const isOtp =
    Boolean(lead.otp_verified) ||
    Boolean(meta.otp_verified_at) ||
    Boolean(meta.website_otp_verified) ||
    Boolean(meta.website_booking_abandoned) ||
    result === 'OTP_VERIFIED' ||
    labelRaw.includes('otp verified') ||
    desc.includes('otp verified');
  if (!isOtp) return null;

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

function DetailFieldCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200/80 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-1 text-sm text-gray-900 break-words">{value ?? '-'}</div>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border p-4 ${className}`}>
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        <Icon className="h-4 w-4 shrink-0" />
        {title}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function formatDetailScalar(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function ServiceLeadDetailContent({ item }: { item: Record<string, any> }) {
  const meta = item.meta && typeof item.meta === 'object' ? (item.meta as Record<string, unknown>) : {};
  const serviceLabel = getServiceLabel(item);
  const misaServices = extractMisaServices(item);
  const payable = getLeadDisplayAmount(item);

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
        <div className="space-y-1">
          <p className="font-semibold text-amber-900">Refer & Rise · {item.referral_reward_family || 'Reward'}</p>
          {item.referral_reward_text ? <p className="text-sm text-gray-700">{item.referral_reward_text}</p> : null}
          {Number(item.referral_reward_discount || 0) > 0 ? (
            <p className="text-sm font-medium text-emerald-700">
              Discount applied: {formatCurrency(Number(item.referral_reward_discount))}
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

  return (
    <div className="space-y-4">
      <LeadTrackingSection item={item} />

      <DetailSection title="Lead Overview" icon={Hash} className="border-slate-200 bg-slate-50/80">
        <DetailFieldCard label="Lead Number" value={item.lead_number} />
        <DetailFieldCard label="Status" value={item.status} />
        <DetailFieldCard label="Lead Type" value={item.lead_type} />
        <DetailFieldCard label="Priority" value={item.lead_priority} />
        <DetailFieldCard label="Created At" value={formatDateTime(item.created_at)} />
        <DetailFieldCard label="Created From" value={item.created_from} />
        <DetailFieldCard label="Booking Channel" value={<SourceCell lead={item} />} />
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
        <DetailFieldCard label="Internal ID" value={item.id} />
      </DetailSection>

      <DetailSection title="Customer Details" icon={UserRound} className="border-emerald-200 bg-emerald-50/50">
        <DetailFieldCard label="Customer Name" value={item.customer_name} />
        <DetailFieldCard label="Phone" value={item.customer_phone} />
        <DetailFieldCard label="Email" value={item.customer_email} />
        <DetailFieldCard label="Pickup Required" value={formatDetailScalar(item.pickup_required)} />
        <DetailFieldCard label="Customer Address" value={item.customer_address} />
        <DetailFieldCard label="Address" value={item.address} />
        <DetailFieldCard label="Pickup Address" value={item.pickup_address} />
      </DetailSection>

      <DetailSection title="Vehicle & Location" icon={Car} className="border-blue-200 bg-blue-50/50">
        <DetailFieldCard label="Vehicle Number" value={item.vehicle_number} />
        <DetailFieldCard label="Make" value={item.vehicle_make} />
        <DetailFieldCard label="Model" value={item.vehicle_model} />
        <DetailFieldCard label="Variant" value={item.vehicle_variant} />
        <DetailFieldCard label="Year" value={item.vehicle_year} />
        <DetailFieldCard label="Fuel Type" value={item.fuel_type} />
        <DetailFieldCard label="City" value={item.city} />
        <DetailFieldCard label="Odometer" value={item.odometer_reading} />
      </DetailSection>

      <DetailSection title="Service & Schedule" icon={Wrench} className="border-violet-200 bg-violet-50/50">
        {misaServices.length > 0 ? (
          <div className="md:col-span-2 rounded-lg border border-gray-200/80 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Services</p>
            <ul className="mt-2 space-y-2">
              {misaServices.map((service, index) => (
                <li key={`${service.name}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-gray-900">{service.name}</span>
                  {service.price > 0 ? (
                    <span className="shrink-0 font-semibold text-gray-900">{formatCurrency(service.price)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <DetailFieldCard label="Service" value={serviceLabel} />
        )}
        <DetailFieldCard label="Service Type" value={item.service_type} />
        <DetailFieldCard
          label="WhatsApp Message"
          value={getLeadInboundWhatsAppMessage(item)}
        />
        <DetailFieldCard label="Preferred Slot" value={formatDateTime(item.preferred_slot_start)} />
        <DetailFieldCard label="Preferred Date" value={item.preferred_date} />
        <DetailFieldCard label="Preferred Time" value={item.preferred_time_slot || item.preferred_service_slot} />
        <DetailFieldCard label="Problem Description" value={item.problem_description} />
        <DetailFieldCard label="Notes" value={item.description} />
      </DetailSection>

      <DetailSection title="Payment & Pricing" icon={DollarSign} className="border-amber-200 bg-amber-50/50">
        <DetailFieldCard label="Payable Amount" value={formatCurrency(payable)} />
        <DetailFieldCard label="Estimated Amount" value={formatCurrency(item.estimated_amount)} />
        <DetailFieldCard label="Actual Amount" value={formatCurrency(item.actual_amount)} />
        <DetailFieldCard label="Payment Mode" value={item.payment_mode} />
        <DetailFieldCard label="Payment Status" value={item.payment_status} />
        <DetailFieldCard label="Discount" value={formatCurrency(item.discount_amount)} />
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

      {Object.keys(meta).length > 0 ? (
        <DetailSection title="Additional Info" icon={ClipboardList} className="border-gray-200 bg-gray-50/80">
          {Object.entries(meta)
            .filter(([key]) =>
              ![
                'utm_source',
                'utm_medium',
                'utm_campaign',
                'utm_term',
                'utm_content',
                'tracking',
                'customer_id',
                'referral_reward',
              ].includes(key),
            )
            .map(([key, value]) => (
              <DetailFieldCard key={key} label={prettifyKey(key)} value={formatDetailScalar(value)} />
            ))}
        </DetailSection>
      ) : null}
    </div>
  );
}

function LeadTrackingSection({ item }: { item: Record<string, any> }) {
  const utm = getLeadUtmParams(item);
  const hasUtm = UTM_KEYS.some((key) => Boolean(utm[key]));

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-800 mb-3">Campaign Tracking</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-blue-100 rounded-lg p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Lead Source</p>
          <div className="mt-1.5">
            <SourceCell lead={item} />
          </div>
        </div>
        {UTM_KEYS.map((key) => (
          <div key={key} className="bg-white border border-blue-100 rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{UTM_DISPLAY_LABELS[key]}</p>
            <p className="text-sm text-gray-900 mt-1 break-words">{utm[key] || '-'}</p>
          </div>
        ))}
      </div>
      {!hasUtm ? (
        <p className="text-xs text-amber-700 mt-3">
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
      className={`rounded-2xl border bg-white p-4 shadow-sm text-left transition ${
        active ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-gray-200'
      } ${onClick ? 'hover:border-brand-primary/40 hover:shadow-md cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
          {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
        </div>
        <div className={`rounded-xl p-2 shrink-0 ${accentClassName || 'bg-blue-50 text-blue-600'}`}>{icon}</div>
      </div>
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
    <label className={`flex flex-col gap-1 min-w-[140px] ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

export default function SuperAdminBookingsPage() {
  const [showUploadCrm, setShowUploadCrm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_OPTIONS)[number]>('ALL');
  const [couponFilter, setCouponFilter] = useState<(typeof COUPON_OPTIONS)[number]>('ALL');
  /** ALL | UNASSIGNED | exact assignee name */
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
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
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [currentPage, setCurrentPage] = useState(1);

  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; total: number; errors?: string[] } | null>(null);

  const CSV_COLUMNS = ['phone_no', 'name', 'address', 'regdate', 'car_number', 'make', 'model'] as const;

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
    const headerLine = lines[0];
    const sep = headerLine.includes('\t') ? '\t' : ',';
    const headers = splitCsvLine(headerLine, sep).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const expectedCols = headers.length;

    return lines.slice(1).map((line) => {
      let values = splitCsvLine(line, sep);

      // If there are extra columns (unquoted commas in data), merge overflow into the last known text column
      if (sep === ',' && values.length > expectedCols) {
        const phoneIdx = headers.indexOf('phone_no');
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
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setCsvRows(rows);
      if (rows.length === 0) toast.error('No data rows found in the file');
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
      toast.success(`${totalInserted} records uploaded successfully!`);
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

  const filteredAssigneeOptions = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return assigneeOptions;
    return assigneeOptions.filter((name) => name.toLowerCase().includes(q));
  }, [assigneeOptions, assigneeSearch]);

  const displayedServiceLeads = useMemo(() => {
    let leads = filterBookingLeads(serviceLeads, {
      source: sourceFilter,
      hasCoupon: couponFilter,
      search: searchTerm,
    });
    if (statusFilter !== 'ALL') {
      leads = leads.filter((lead) => String(lead.status || 'NEW').toUpperCase() === statusFilter);
    }
    if (assigneeFilter === 'UNASSIGNED') {
      leads = leads.filter((lead) => !String((lead as any).assigned_telecaller_name || '').trim());
    } else if (assigneeFilter !== 'ALL') {
      const want = assigneeFilter.trim().toLowerCase();
      leads = leads.filter(
        (lead) => String((lead as any).assigned_telecaller_name || '').trim().toLowerCase() === want
      );
    } else if (assigneeSearch.trim()) {
      const q = assigneeSearch.trim().toLowerCase();
      if (q === 'unassigned' || q === 'none') {
        leads = leads.filter((lead) => !String((lead as any).assigned_telecaller_name || '').trim());
      } else {
        leads = leads.filter((lead) =>
          String((lead as any).assigned_telecaller_name || '')
            .trim()
            .toLowerCase()
            .includes(q)
        );
      }
    }
    return leads;
  }, [serviceLeads, sourceFilter, couponFilter, searchTerm, statusFilter, assigneeFilter, assigneeSearch]);

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

  const openPhoneBookings = (phone: string | null | undefined, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const key = normalizeLeadPhone(phone);
    if (!key) return;
    const list = bookingsByPhone.get(key) || [];
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
  }, [sourceFilter, couponFilter, statusFilter, assigneeFilter, assigneeSearch, searchTerm, datePreset, customStart, customEnd]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const hasActiveLeadFilters =
    sourceFilter !== 'ALL' ||
    couponFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    assigneeFilter !== 'ALL' ||
    Boolean(assigneeSearch.trim()) ||
    Boolean(searchTerm.trim());

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
    setSelectedIds(new Set());
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchData]);

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
    setDetailTitle(title);
    setDetailItem(item);
    setAssignTelecallerId(String(item?.assigned_telecaller_id || ''));
    setShowInactiveTelecallers(false);
    setDetailOpen(true);
    void loadTelecallers(item);
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
              <p className="text-sm text-gray-600 mt-1">All bookings in one place — filter by source, status & assignee.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:flex-1 xl:justify-end min-w-0">
              {!showUploadCrm ? (
                <div className="w-full sm:flex-1 xl:max-w-md relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="bookings-search"
                    name="bookings-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, phone, vehicle, city, coupon..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : null}

              {showUploadCrm ? (
                <button
                  type="button"
                  onClick={() => setShowUploadCrm(false)}
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
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={loading || exporting || (datePreset === 'custom' && (!customStart || !customEnd))}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
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
            <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Date</span>
                  <ReportDateRangeFilter
                    variant="compact"
                    preset={datePreset}
                    customStart={customStart}
                    customEnd={customEnd}
                    onChange={handleDateRangeChange}
                  />
                </div>

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
                      className="min-w-[180px]"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status === 'ALL' ? 'All statuses' : status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </FilterSelect>

                    <div className="flex flex-col gap-1 min-w-[220px] flex-1 max-w-sm relative">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Assignee</span>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                        <input
                          type="search"
                          value={assigneeSearch}
                          onChange={(e) => {
                            setAssigneeSearch(e.target.value);
                            setAssigneeFilter('ALL');
                            setAssigneeMenuOpen(true);
                          }}
                          onFocus={() => setAssigneeMenuOpen(true)}
                          onBlur={() => {
                            window.setTimeout(() => setAssigneeMenuOpen(false), 150);
                          }}
                          placeholder={
                            assigneeFilter === 'UNASSIGNED'
                              ? 'Unassigned'
                              : assigneeFilter !== 'ALL'
                                ? assigneeFilter
                                : 'Search assignee...'
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoComplete="off"
                        />
                        {(assigneeFilter !== 'ALL' || assigneeSearch.trim()) ? (
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setAssigneeFilter('ALL');
                              setAssigneeSearch('');
                            }}
                            aria-label="Clear assignee filter"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        {assigneeMenuOpen ? (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                            <button
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                assigneeFilter === 'ALL' && !assigneeSearch.trim() ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-gray-700'
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setAssigneeFilter('ALL');
                                setAssigneeSearch('');
                                setAssigneeMenuOpen(false);
                              }}
                            >
                              All assignees
                            </button>
                            <button
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                assigneeFilter === 'UNASSIGNED' ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-gray-700'
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setAssigneeFilter('UNASSIGNED');
                                setAssigneeSearch('');
                                setAssigneeMenuOpen(false);
                              }}
                            >
                              Unassigned
                            </button>
                            {filteredAssigneeOptions.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-400">No matching assignees</p>
                            ) : (
                              filteredAssigneeOptions.map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                    assigneeFilter === name ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-gray-700'
                                  }`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setAssigneeFilter(name);
                                    setAssigneeSearch('');
                                    setAssigneeMenuOpen(false);
                                  }}
                                >
                                  {name}
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                {(sourceFilter !== 'ALL' ||
                  couponFilter !== 'ALL' ||
                  statusFilter !== 'ALL' ||
                  assigneeFilter !== 'ALL' ||
                  assigneeSearch.trim()) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSourceFilter('ALL');
                      setCouponFilter('ALL');
                      setStatusFilter('ALL');
                      setAssigneeFilter('ALL');
                      setAssigneeSearch('');
                    }}
                    className="mb-0.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Clear filters
                  </button>
                ) : null}

                {!loading ? (
                  <p className="text-[11px] text-gray-500 ml-auto shrink-0 pb-2 text-right">
                    <span className="font-bold text-gray-800">{displayedServiceLeads.length}</span>
                    {` / ${serviceLeads.length} loaded`}
                    {typeof totalInRange === 'number' && totalInRange !== serviceLeads.length ? (
                      <span className="text-gray-400"> · {totalInRange.toLocaleString('en-IN')} in range</span>
                    ) : null}
                    {datePreset !== 'all_time' ? <span className="text-gray-400"> · {dateRangeLabel}</span> : null}
                    {leadsTruncated ? (
                      <span className="block text-amber-600 font-medium mt-0.5">
                        Showing latest {serviceLeads.length.toLocaleString('en-IN')} of{' '}
                        {(totalInRange || 0).toLocaleString('en-IN')} — narrow the date range for the rest
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bulk action bar */}
      {!showUploadCrm && selectedIds.size > 0 ? (
        <div className="sticky top-[200px] z-10 mx-4 sm:mx-6 lg:mx-8 mt-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white px-5 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5" />
            <span className="text-sm font-bold">{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg border border-white/30 text-xs font-semibold hover:bg-white/10 transition"
            >
              Clear Selection
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={bulkDelete}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 transition disabled:opacity-60"
            >
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Lead${selectedIds.size > 1 ? 's' : ''}`}
            </button>
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
              <StatCard
                label={hasActiveLeadFilters ? 'Filtered Leads' : 'Total Leads'}
                value={serviceLeadOverview.total}
                icon={<ClipboardList className="h-5 w-5" />}
                onClick={() => {
                  setSourceFilter('ALL');
                  setCouponFilter('ALL');
                  setStatusFilter('ALL');
                  setAssigneeFilter('ALL');
                  setAssigneeSearch('');
                  setSearchTerm('');
                }}
                active={hasActiveLeadFilters}
              />
              <StatCard
                label="App Booking"
                value={serviceLeadOverview.app}
                icon={<Smartphone className="h-5 w-5" />}
                onClick={() => setSourceFilter(sourceFilter === 'APP' ? 'ALL' : 'APP')}
                active={sourceFilter === 'APP'}
              />
              <StatCard
                label="Website"
                value={serviceLeadOverview.website}
                icon={<Globe className="h-5 w-5" />}
                onClick={() => setSourceFilter(sourceFilter === 'WEBSITE' ? 'ALL' : 'WEBSITE')}
                active={sourceFilter === 'WEBSITE'}
              />
              <StatCard
                label="MISA AI"
                value={serviceLeadOverview.misa}
                icon={<Bot className="h-5 w-5" />}
                onClick={() => setSourceFilter(sourceFilter === 'MISA' ? 'ALL' : 'MISA')}
                active={sourceFilter === 'MISA'}
              />
              <StatCard
                label="Google Ads"
                value={serviceLeadOverview.googleAds}
                icon={<Megaphone className="h-5 w-5" />}
                onClick={() => setSourceFilter(sourceFilter === 'GOOGLE' ? 'ALL' : 'GOOGLE')}
                active={sourceFilter === 'GOOGLE'}
              />
              <StatCard
                label="Meta / Insta Ads"
                value={serviceLeadOverview.metaAds}
                icon={<Megaphone className="h-5 w-5" />}
                onClick={() => setSourceFilter(sourceFilter === 'META' ? 'ALL' : 'META')}
                active={sourceFilter === 'META'}
              />
              <StatCard
                label="Promo Coupon"
                value={serviceLeadOverview.withPromoCoupon}
                sub={`${serviceLeadOverview.total > 0 ? Math.round((serviceLeadOverview.withPromoCoupon / serviceLeadOverview.total) * 100) : 0}% of leads`}
                icon={<Ticket className="h-5 w-5" />}
                accentClassName="bg-orange-50 text-orange-600"
                onClick={() => setCouponFilter(couponFilter === 'PROMO' ? 'ALL' : 'PROMO')}
                active={couponFilter === 'PROMO'}
              />
              <StatCard
                label="Refer & Rise"
                value={serviceLeadOverview.withReferralReward}
                sub={
                  serviceLeadOverview.withReferralReward > 0
                    ? `${serviceLeadOverview.total > 0 ? Math.round((serviceLeadOverview.withReferralReward / serviceLeadOverview.total) * 100) : 0}% used referral voucher`
                    : 'No referral vouchers used yet'
                }
                icon={<Gift className="h-5 w-5" />}
                accentClassName="bg-amber-50 text-amber-700"
                onClick={() => setCouponFilter(couponFilter === 'REFERRAL' ? 'ALL' : 'REFERRAL')}
                active={couponFilter === 'REFERRAL'}
              />
              <StatCard
                label="New Leads"
                value={serviceLeadOverview.newLeads}
                icon={<UserRound className="h-5 w-5" />}
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
                      Columns: phone_no, name, address, regdate, car_number, make, model
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
                          {uploadResult.skipped > 0 && <span className="text-yellow-700"> ({uploadResult.skipped} skipped — missing phone_no)</span>}
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
                            {CSV_COLUMNS.map((col) => (
                              <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                                {row[col] || <span className="text-gray-300">-</span>}
                              </td>
                            ))}
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
        ) : displayedServiceLeads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try changing search or status filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full min-w-[1680px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-3 py-3 w-10">
                        <button type="button" onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-gray-200 transition" title="Select all on this page">
                          {!somePageSelected ? (
                            <Square className="w-4.5 h-4.5 text-gray-400" />
                          ) : allPageSelected ? (
                            <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                          ) : (
                            <MinusSquare className="w-4.5 h-4.5 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap">Lead #</th>
                      <th className="px-4 py-3 whitespace-nowrap">Source</th>
                      <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Assignee</th>
                      <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Customer</th>
                      <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 min-w-[220px]">Message</th>
                      <th className="px-4 py-3 whitespace-nowrap" title="How many lead rows exist for this phone (not confirmed bookings count)">
                        Leads #
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                      <th className="px-4 py-3 whitespace-nowrap">City</th>
                      <th className="px-4 py-3 min-w-[180px]">Service</th>
                      <th className="px-4 py-3 whitespace-nowrap min-w-[120px]">UTM Campaign</th>
                      <th className="px-4 py-3 whitespace-nowrap">Discount</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedServiceLeads.map((lead, rowIndex) => {
                      const serviceLabel = getServiceLabel(lead);
                      const misaServices = extractMisaServices(lead);
                      const leadId = String(lead.id || '');
                      const isSelected = leadId ? selectedIds.has(leadId) : false;
                      const phoneKey = normalizeLeadPhone(lead.customer_phone);
                      const phoneBookingCount = phoneKey
                        ? bookingsByPhone.get(phoneKey)?.length || 0
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
                        <td className="px-3 py-3 w-10">
                          {leadId ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleSelect(leadId); }}
                              className="p-0.5 rounded hover:bg-gray-200 transition"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                              ) : (
                                <Square className="w-4.5 h-4.5 text-gray-400" />
                              )}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{lead.lead_number || '-'}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <SourceCell lead={lead} />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap min-w-[140px]">
                          <AssigneeBadge
                            name={lead.assigned_telecaller_name}
                            onClick={(e) => openQuickAssign(lead, e)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 min-w-[200px]">
                          <span className="block whitespace-nowrap" title={lead.customer_name || ''}>
                            {lead.customer_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.customer_phone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[260px]">
                          <span className="block truncate" title={getLeadInboundWhatsAppMessage(lead) || ''}>
                            {getLeadInboundWhatsAppMessage(lead) || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
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
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.vehicle_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[260px]">
                          {misaServices.length > 1 ? (
                            <div className="space-y-0.5" title={serviceLabel}>
                              {misaServices.map((service, index) => (
                                <div key={`${service.name}-${index}`} className="truncate text-xs leading-4">
                                  {service.name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="block truncate" title={serviceLabel}>{serviceLabel}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <UtmCampaignCell lead={lead} />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <LeadDiscountBadge lead={lead} />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <LeadStatusSelect
                            value={String(lead.status || 'NEW')}
                            updating={statusUpdatingId === leadId}
                            onChange={(status, ev) => void updateLeadStatus(lead, status, ev)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatCurrency(getLeadDisplayAmount(lead))}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDateTime(lead.created_at)}</td>
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
                    <button
                      type="button"
                      onClick={() => openDetail('Service Lead Details', item)}
                      className="text-left flex-1 min-w-0"
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
                            {bookingsByPhone.get(normalizeLeadPhone(item.customer_phone))?.length || 1}
                          </button>
                        </div>
                        <div>
                          <p className="text-gray-500">Vehicle</p>
                          <p className="font-medium text-gray-800">{item.vehicle_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Amount</p>
                          <p className="font-medium text-gray-800">{formatCurrency(getLeadDisplayAmount(item))}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="font-medium text-gray-800">{formatDateTime(item.created_at)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">Service</p>
                          <p className="font-medium text-gray-800">{getServiceLabel(item) || '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">UTM Campaign</p>
                          <div className="mt-0.5">
                            <UtmCampaignCell lead={item} />
                          </div>
                        </div>
                      </div>
                    </button>
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
                          {getServiceLabel(row) || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            {String(row.status || 'NEW').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatCurrency(getLeadDisplayAmount(row))}
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
            className="relative z-10 flex h-full w-full max-w-2xl sm:max-w-3xl flex-col bg-white shadow-2xl border-l border-gray-200"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2 min-w-0">
                <Car className="w-5 h-5 text-brand-primary shrink-0" />
                <span className="truncate">{detailTitle}</span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {detailItem.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailOpen(false);
                        openEdit(detailItem);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLead(detailItem)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </>
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

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="w-4 h-4 text-indigo-700" />
                  <p className="text-sm font-semibold text-indigo-900">
                    {detailItem.assigned_telecaller_id ? 'Reassign telecaller' : 'Assign telecaller'}
                  </p>
                </div>
                <p className="text-xs text-indigo-800/80 mb-3">
                  Current:{' '}
                  <span className="font-medium">
                    {detailItem.assigned_telecaller_name ||
                      (detailItem.assigned_telecaller_id ? 'Assigned' : 'Unassigned')}
                  </span>
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={assignTelecallerId}
                    onChange={(e) => setAssignTelecallerId(e.target.value)}
                    disabled={telecallersLoading || assigning}
                    className="flex-1 min-w-0 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {assigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : detailItem.assigned_telecaller_id ? (
                      'Reassign'
                    ) : (
                      'Assign'
                    )}
                  </button>
                </div>
                {inactiveTelecallerCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowInactiveTelecallers((v) => !v)}
                    className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
                  >
                    {showInactiveTelecallers
                      ? 'Hide inactive'
                      : `Show inactive (${inactiveTelecallerCount})`}
                  </button>
                ) : null}
              </div>

              <ServiceLeadDetailContent item={detailItem} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

