'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Car, ClipboardList, Loader2, Search, UserRound, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Smartphone, Globe, Ticket, Pencil, Trash2, CheckSquare, Square, MinusSquare, Download, MessageCircle, Wrench, DollarSign, Hash, Megaphone, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import ReportDateRangeFilter from '@/components/admin/ReportDateRangeFilter';
import {
  filterBookingLeads,
  enrichBookingLead,
  getLeadServiceLabel,
  getLeadDisplayAmount,
  getMisaServicesFromLead,
  getLeadUtmParams,
  resolveLeadSourceBadgeTheme,
  computeServiceLeadOverview,
  computeChatbotBookingOverview,
  type LeadSourceBadgeKind,
} from '@/lib/booking-lead-utils';
import { UTM_DISPLAY_LABELS, UTM_KEYS } from '@/lib/utm';
import { LEAD_SOURCES } from '@/lib/enquiry/createLead';
import { resolveReportDateRange, type ReportDatePreset } from '@/lib/report-date-range';

type ServiceLead = Record<string, any>;
type ChatbotBooking = Record<string, any>;
type CsvRow = Record<string, string>;
type ActiveTab = 'service_leads' | 'chatbot_bookings' | 'upload_crm';

const STATUS_OPTIONS = ['ALL', 'NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'] as const;
const LEAD_STATUS_ENUM = ['NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'] as const;
const SOURCE_OPTIONS = ['ALL', 'APP', 'WEBSITE', 'MISA', 'OTHER'] as const;
const COUPON_OPTIONS = ['ALL', 'YES', 'PROMO', 'REFERRAL', 'NO'] as const;

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

function SourceBadge({ lead }: { lead: Record<string, any> }) {
  const theme = lead.source_badge_kind
    ? {
        source_badge_kind: lead.source_badge_kind as LeadSourceBadgeKind,
        source_badge_label: lead.source_badge_label,
        source_badge_class: lead.source_badge_class,
      }
    : resolveLeadSourceBadgeTheme(lead);

  const kind = theme.source_badge_kind;
  const label = theme.source_badge_label || lead.lead_source || lead.booking_source_label || 'Other';
  const styles = theme.source_badge_class || 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${styles}`}>
      <SourceBadgeIcon kind={kind} />
      {label}
    </span>
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


function getServiceLabel(lead: ServiceLead) {
  return getLeadServiceLabel(lead);
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
  const serviceLabel = getLeadServiceLabel(item);
  const misaServices = getMisaServicesFromLead(item);
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
        <DetailFieldCard label="Booking Channel" value={<SourceBadge lead={item} />} />
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

function ChatbotBookingDetailContent({ item }: { item: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <DetailSection title="Customer" icon={UserRound} className="border-emerald-200 bg-emerald-50/50">
        <DetailFieldCard label="Name" value={item.customer_name} />
        <DetailFieldCard label="Phone" value={item.phone_number} />
        <DetailFieldCard label="City" value={item.city} />
        <DetailFieldCard label="Pincode" value={item.pincode} />
      </DetailSection>

      <DetailSection title="Vehicle & Service" icon={Car} className="border-blue-200 bg-blue-50/50">
        <DetailFieldCard label="Car Model" value={item.car_model} />
        <DetailFieldCard label="Vehicle Number" value={item.vehicle_number} />
        <DetailFieldCard label="Car Class" value={item.car_class} />
        <DetailFieldCard label="Service" value={item.service_name} />
        <DetailFieldCard label="Category" value={item.service_category} />
      </DetailSection>

      <DetailSection title="Booking" icon={ClipboardList} className="border-violet-200 bg-violet-50/50">
        <DetailFieldCard label="Status" value={item.status} />
        <DetailFieldCard label="Preferred Date" value={item.preferred_date} />
        <DetailFieldCard label="Preferred Time" value={item.preferred_time} />
        <DetailFieldCard label="Address" value={item.address} />
        <DetailFieldCard label="Quoted Price" value={formatCurrency(item.quoted_price)} />
        <DetailFieldCard label="Created At" value={formatDateTime(item.created_at)} />
        <DetailFieldCard label="Session ID" value={item.session_id} />
        <DetailFieldCard label="Notes" value={item.notes} />
      </DetailSection>
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
            <SourceBadge lead={item} />
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

function FilterChip({
  active,
  onClick,
  children,
  activeClassName,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
        active ? activeClassName : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function SuperAdminBookingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('service_leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_OPTIONS)[number]>('ALL');
  const [couponFilter, setCouponFilter] = useState<(typeof COUPON_OPTIONS)[number]>('ALL');
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceLeads, setServiceLeads] = useState<ServiceLead[]>([]);
  const [chatbotBookings, setChatbotBookings] = useState<ChatbotBooking[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, any> | null>(null);
  const [detailTitle, setDetailTitle] = useState('');

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const displayedChatbotBookings = useMemo(() => {
    let rows = chatbotBookings;
    if (statusFilter !== 'ALL') {
      rows = rows.filter((b) => String(b.status || '').toUpperCase() === statusFilter);
    }
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((b) =>
      [b.customer_name, b.phone_number, b.city, b.service_name, b.car_model, b.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [chatbotBookings, searchTerm, statusFilter]);

  const displayedServiceLeads = useMemo(() => {
    let leads = filterBookingLeads(serviceLeads, {
      source: sourceFilter,
      hasCoupon: couponFilter,
      search: searchTerm,
    });
    if (statusFilter !== 'ALL') {
      leads = leads.filter((lead) => String(lead.status || 'NEW').toUpperCase() === statusFilter);
    }
    return leads;
  }, [serviceLeads, sourceFilter, couponFilter, searchTerm, statusFilter]);

  const serviceLeadOverview = useMemo(() => computeServiceLeadOverview(displayedServiceLeads), [displayedServiceLeads]);
  const chatbotOverview = useMemo(() => computeChatbotBookingOverview(displayedChatbotBookings), [displayedChatbotBookings]);

  const hasActiveLeadFilters =
    sourceFilter !== 'ALL' ||
    couponFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    Boolean(searchTerm.trim());

  const activeData = useMemo(
    () => (activeTab === 'service_leads' ? displayedServiceLeads : displayedChatbotBookings),
    [activeTab, displayedServiceLeads, displayedChatbotBookings],
  );

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
    if (activeTab === 'upload_crm') return;
    if (datePreset === 'custom' && (!customStart || !customEnd)) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint =
        activeTab === 'service_leads' ? '/api/super_admin/leads' : '/api/super_admin/chatbot-bookings';

      const query = new URLSearchParams();
      query.set('limit', '500');
      query.set('preset', datePreset);
      if (datePreset === 'custom') {
        if (customStart) query.set('start', customStart);
        if (customEnd) query.set('end', customEnd);
      }

      const res = await fetch(`${endpoint}?${query.toString()}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load bookings data');
      }

      if (activeTab === 'service_leads') {
        const rows = Array.isArray(payload?.leads) ? payload.leads : [];
        setServiceLeads(rows.map((lead: ServiceLead) => enrichBookingLead(lead)));
      } else {
        const rows = Array.isArray(payload?.bookings) ? payload.bookings : [];
        setChatbotBookings(rows);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [activeTab, datePreset, customStart, customEnd]);

  useEffect(() => {
    setSelectedIds(new Set());
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const openDetail = (title: string, item: Record<string, any>) => {
    setDetailTitle(title);
    setDetailItem(item);
    setDetailOpen(true);
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

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedServiceLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedServiceLeads.map((l) => String(l.id)).filter(Boolean)));
    }
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

      if (activeTab === 'service_leads') {
        if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
        if (couponFilter !== 'ALL') params.set('has_coupon', couponFilter);
      }

      const endpoint =
        activeTab === 'service_leads' ? '/api/super_admin/leads' : '/api/super_admin/chatbot-bookings';

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        activeTab === 'service_leads'
          ? `service-leads-${datePreset}.csv`
          : `ai-bookings-${datePreset}.csv`;
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-brand-primary" />
                Bookings & Leads
              </h1>
              <p className="text-sm text-gray-600 mt-1">Website, App & AI bookings — filter by source and coupon.</p>
            </div>

            <div className="w-full lg:w-[420px] relative">
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
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('service_leads')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                activeTab === 'service_leads'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <UserRound className="w-4 h-4" />
              Service Leads
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chatbot_bookings')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                activeTab === 'chatbot_bookings'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Bot className="w-4 h-4" />
              AI Bookings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload_crm')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                activeTab === 'upload_crm'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload CRM Data
            </button>

            {activeTab !== 'upload_crm' ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={loading || exporting || (datePreset === 'custom' && (!customStart || !customEnd))}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            ) : null}
          </div>

          {activeTab !== 'upload_crm' ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:gap-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0">Date</span>
                  <ReportDateRangeFilter
                    variant="compact"
                    preset={datePreset}
                    customStart={customStart}
                    customEnd={customEnd}
                    onChange={handleDateRangeChange}
                  />
                </div>

                {activeTab === 'service_leads' ? (
                  <>
                    <div className="hidden xl:block h-8 w-px bg-gray-200 shrink-0" />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0 mr-0.5">Source</span>
                      {SOURCE_OPTIONS.map((source) => (
                        <FilterChip
                          key={source}
                          active={sourceFilter === source}
                          onClick={() => setSourceFilter(source)}
                          activeClassName={
                            source === 'APP'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : source === 'WEBSITE'
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : source === 'MISA'
                                  ? 'border-violet-600 bg-violet-600 text-white'
                                  : 'border-slate-700 bg-slate-700 text-white'
                          }
                        >
                          {source === 'APP' ? <Smartphone className="h-3 w-3" /> : null}
                          {source === 'WEBSITE' ? <Globe className="h-3 w-3" /> : null}
                          {source === 'MISA' ? <Bot className="h-3 w-3" /> : null}
                          {sourceFilterLabel(source)}
                        </FilterChip>
                      ))}
                    </div>

                    <div className="hidden xl:block h-8 w-px bg-gray-200 shrink-0" />

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0 mr-0.5">Discount</span>
                      {COUPON_OPTIONS.map((coupon) => (
                        <FilterChip
                          key={coupon}
                          active={couponFilter === coupon}
                          onClick={() => setCouponFilter(coupon)}
                          activeClassName={
                            coupon === 'REFERRAL'
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : coupon === 'PROMO'
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-orange-500 bg-orange-500 text-white'
                          }
                        >
                          {coupon === 'YES' || coupon === 'PROMO' ? <Ticket className="h-3 w-3" /> : null}
                          {coupon === 'REFERRAL' ? <Gift className="h-3 w-3" /> : null}
                          {coupon === 'ALL'
                            ? 'All'
                            : coupon === 'YES'
                              ? 'Any Discount'
                              : coupon === 'PROMO'
                                ? 'Promo Coupon'
                                : coupon === 'REFERRAL'
                                  ? 'Refer & Rise'
                                  : 'No Discount'}
                        </FilterChip>
                      ))}
                    </div>
                  </>
                ) : null}

                {!loading ? (
                  <p className="text-[11px] text-gray-500 xl:ml-auto shrink-0">
                    <span className="font-bold text-gray-800">
                      {activeTab === 'service_leads' ? displayedServiceLeads.length : displayedChatbotBookings.length}
                    </span>
                    {activeTab === 'service_leads' ? ` / ${serviceLeads.length} leads` : ' bookings'}
                    {datePreset !== 'all_time' ? <span className="text-gray-400"> · {dateRangeLabel}</span> : null}
                  </p>
                ) : null}
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                      statusFilter === status
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bulk action bar */}
      {activeTab === 'service_leads' && selectedIds.size > 0 ? (
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
        {activeTab !== 'upload_crm' && !loading ? (
          <div className="mb-5">
            {hasActiveLeadFilters && activeTab === 'service_leads' ? (
              <p className="mb-3 text-xs font-medium text-amber-700">
                Overview for filtered results · {displayedServiceLeads.length} of {serviceLeads.length} leads
              </p>
            ) : datePreset !== 'all_time' ? (
              <p className="mb-3 text-xs font-medium text-gray-500">Overview for {dateRangeLabel}</p>
            ) : null}
            {activeTab === 'service_leads' ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
              <StatCard
                label={hasActiveLeadFilters ? 'Filtered Leads' : 'Total Leads'}
                value={serviceLeadOverview.total}
                icon={<ClipboardList className="h-5 w-5" />}
                onClick={() => {
                  setSourceFilter('ALL');
                  setCouponFilter('ALL');
                  setStatusFilter('ALL');
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
              <StatCard label="Google Ads" value={serviceLeadOverview.googleAds} icon={<Megaphone className="h-5 w-5" />} />
              <StatCard label="Meta / Insta Ads" value={serviceLeadOverview.metaAds} icon={<Megaphone className="h-5 w-5" />} />
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
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total AI Bookings" value={chatbotOverview.total} icon={<Bot className="h-5 w-5" />} />
              <StatCard label="Pending" value={chatbotOverview.pending} icon={<ClipboardList className="h-5 w-5" />} />
              <StatCard label="Completed" value={chatbotOverview.completed} icon={<CheckCircle2 className="h-5 w-5" />} />
              <StatCard label="With Quote" value={chatbotOverview.withQuote} icon={<DollarSign className="h-5 w-5" />} />
            </div>
          )}
          </div>
        ) : null}

        {activeTab === 'upload_crm' ? (
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
        ) : activeData.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try changing search or status filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
              {activeTab === 'service_leads' ? (
                <table className="w-full min-w-[1420px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-3 py-3 w-10">
                        <button type="button" onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-gray-200 transition">
                          {selectedIds.size === 0 ? (
                            <Square className="w-4.5 h-4.5 text-gray-400" />
                          ) : selectedIds.size === displayedServiceLeads.length ? (
                            <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                          ) : (
                            <MinusSquare className="w-4.5 h-4.5 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap">Lead #</th>
                      <th className="px-4 py-3 whitespace-nowrap">Source</th>
                      <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Customer</th>
                      <th className="px-4 py-3 whitespace-nowrap">Phone</th>
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
                    {displayedServiceLeads.map((lead) => {
                      const serviceLabel = getServiceLabel(lead);
                      const misaServices = getMisaServicesFromLead(lead);
                      const leadId = String(lead.id || '');
                      const isSelected = leadId ? selectedIds.has(leadId) : false;
                      return (
                      <tr
                        key={String(lead.id || `${lead.lead_number}-${lead.created_at}`)}
                        onClick={() => openDetail('Service Lead Details', lead)}
                        className={`border-b border-gray-100 cursor-pointer transition ${isSelected ? 'bg-blue-50 hover:bg-blue-100/60' : 'hover:bg-blue-50/50'}`}
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
                          <SourceBadge lead={lead} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 min-w-[200px]">
                          <span className="block whitespace-nowrap" title={lead.customer_name || ''}>
                            {lead.customer_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.customer_phone || '-'}</td>
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
              ) : (
                <table className="w-full min-w-[960px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 whitespace-nowrap">Car Model</th>
                      <th className="px-4 py-3 whitespace-nowrap">City</th>
                      <th className="px-4 py-3 min-w-[160px]">Service</th>
                      <th className="px-4 py-3 whitespace-nowrap">Price</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedChatbotBookings.map((booking) => (
                      <tr
                        key={String(booking.id || `${booking.session_id}-${booking.created_at}`)}
                        onClick={() => openDetail('AI Booking Details', booking)}
                        className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-[140px]">
                          <span className="block truncate" title={booking.customer_name || ''}>{booking.customer_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{booking.phone_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{booking.car_model || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{booking.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px]">
                          <span className="block truncate" title={booking.service_name || ''}>{booking.service_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatCurrency(booking.quoted_price)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold whitespace-nowrap">
                            {booking.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDateTime(booking.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {activeData.map((item) => {
                const itemId = String(item.id || '');
                const isItemSelected = activeTab === 'service_leads' && itemId ? selectedIds.has(itemId) : false;
                return (
                <div
                  key={String(item.id || `${item.session_id || item.lead_number}-${item.created_at}`)}
                  className={`bg-white border rounded-xl p-4 shadow-sm ${isItemSelected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}
                >
                  {activeTab === 'service_leads' && itemId ? (
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
                      onClick={() =>
                        openDetail(activeTab === 'service_leads' ? 'Service Lead Details' : 'AI Booking Details', item)
                      }
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="text-sm font-bold text-gray-900 break-words">
                        {activeTab === 'service_leads'
                          ? item.customer_name || item.lead_number || '-'
                          : item.customer_name || '-'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activeTab === 'service_leads' ? item.customer_phone || '-' : item.phone_number || '-'}
                      </p>
                      {activeTab === 'service_leads' ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <SourceBadge lead={item} />
                          {item.has_coupon_applied ? (
                            <LeadDiscountBadge lead={item} />
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>
                          <p className="text-gray-500">City</p>
                          <p className="font-medium text-gray-800">{item.city || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{activeTab === 'service_leads' ? 'Vehicle' : 'Car Model'}</p>
                          <p className="font-medium text-gray-800">
                            {activeTab === 'service_leads' ? item.vehicle_number || '-' : item.car_model || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">{activeTab === 'service_leads' ? 'Amount' : 'Price'}</p>
                          <p className="font-medium text-gray-800">
                            {activeTab === 'service_leads'
                              ? formatCurrency(getLeadDisplayAmount(item))
                              : formatCurrency(item.quoted_price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="font-medium text-gray-800">{formatDateTime(item.created_at)}</p>
                        </div>
                        {activeTab === 'service_leads' ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
                    </button>
                    {activeTab === 'service_leads' ? (
                      <LeadStatusSelect
                        value={String(item.status || 'NEW')}
                        updating={statusUpdatingId === String(item.id)}
                        onChange={(status, ev) => void updateLeadStatus(item, status, ev)}
                      />
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold shrink-0">
                        {item.status || '-'}
                      </span>
                    )}
                  </div>
                  {activeTab === 'service_leads' && item.id ? (
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
                    {LEAD_SOURCES.map((s) => (
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

      {detailOpen && detailItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-brand-primary" />
                {detailTitle}
              </h3>
              <div className="flex items-center gap-2">
                {detailItem.id && detailTitle.includes('Service Lead') ? (
                  <>
                    <button type="button" onClick={() => { setDetailOpen(false); openEdit(detailItem); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteLead(detailItem)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700">
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

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
              {detailTitle.includes('Service Lead') ? (
                <ServiceLeadDetailContent item={detailItem} />
              ) : (
                <ChatbotBookingDetailContent item={detailItem} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

