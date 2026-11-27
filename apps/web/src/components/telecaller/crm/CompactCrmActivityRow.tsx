'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Clock,
  ClipboardList,
  History,
  Phone,
  Pin,
  Tag,
  UserRound,
} from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import CallRecordingPlayer from '@/components/telecaller/CallRecordingPlayer';
import {
  activityEndInitials,
  activityHeadline,
  activityIsAutomated,
  activityTimestampLabel,
  compactCallSummary,
  compactGenericLine,
  compactWhatsappPreview,
  whatsappDirectionInbound,
} from '@/lib/telecaller/compactActivityFeed';

export type CompactActivityRowModel = {
  id: string;
  kind: 'call' | 'followup' | 'whatsapp' | 'system' | 'booking' | 'update';
  at: string;
  title: string;
  body?: string | null;
  meta?: Record<string, unknown>;
};

function InitialBadge({ label, variant }: { label: string; variant: 'user' | 'bot' }) {
  if (variant === 'bot') {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600"
        title="Automated"
      >
        <Bot className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-[8px] font-extrabold text-violet-900"
      title={label}
    >
      {label}
    </span>
  );
}

function isFieldTextActivity(row: CompactActivityRowModel): boolean {
  const event = String(row.meta?.event || '').toUpperCase();
  const blob = `${row.title}\n${row.body || ''}`;
  if (event === 'FIELDS') return true;
  if (row.kind === 'update') return true;
  return /details updated|→|status\s*:|leadtag\s*:|utm\s|:\s*empty\s*->/i.test(blob);
}

export default function CompactCrmActivityRow({
  row,
  pinned,
  onTogglePin,
}: {
  row: CompactActivityRowModel;
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
}) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const kind = row.kind;
  const callLogId = String(row.meta?.call_log_id || '').trim();
  const hasRec =
    kind === 'call' &&
    Boolean(callLogId) &&
    (Boolean(row.meta?.has_call_recording) || Boolean(row.meta?.call_recording_url));
  const when = activityTimestampLabel(row.at);
  const automated = activityIsAutomated(row.title, row.body, row.meta);
  const initials = activityEndInitials(row.title, row.body, row.meta);
  const isTransfer = Boolean(row.meta?.transfer) || /lead transferred|lead escalated/i.test(row.title);
  const headline = activityHeadline(row.title, row.body);
  const fieldText = isFieldTextActivity(row);

  const waInbound = kind === 'whatsapp' ? whatsappDirectionInbound(row.title, row.meta) : false;
  const isTagEvent = /lead\s*tag|leadtag/i.test(`${row.title}\n${row.body || ''}`);

  let main: ReactNode = null;

  if (kind === 'call') {
    const summary = compactCallSummary({
      duration: row.meta?.duration,
      callStatus: String(row.meta?.call_status || ''),
      outcome: String(row.meta?.outcome || ''),
      notes: row.body,
      title: row.title,
    });
    const outbound = /dial|outgoing|phone dial/i.test(row.title);
    main = (
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {outbound ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        )}
        <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-slate-900">
          {summary.duration}
        </span>
        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-slate-800">
          {summary.statusText}
        </span>
        <span className="min-w-0 truncate text-[10px] text-slate-500 italic">{summary.noteText}</span>
      </div>
    );
  } else if (kind === 'whatsapp') {
    const pricingTag = String(row.meta?.pricing_link_tag || '');
    const isPricingShare = String(row.meta?.event || '') === 'PRICING_SHARE';
    main = (
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {isPricingShare && pricingTag ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
              pricingTag === 'link_expired'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {pricingTag === 'link_expired' ? 'Link expired' : 'Link active'}
          </span>
        ) : (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
              waInbound ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            {waInbound ? 'Customer' : 'We sent'}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-900">
          {isPricingShare ? row.title : compactWhatsappPreview(row.body, row.title)}
        </p>
      </div>
    );
  } else {
    const line = compactGenericLine(headline, row.body);
    main = (
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {isTagEvent ? (
          <Tag className="h-3 w-3 shrink-0 text-violet-600" aria-hidden />
        ) : isTransfer || /reassign|assigned/i.test(line) ? (
          <UserRound className="h-3 w-3 shrink-0 text-violet-600" aria-hidden />
        ) : null}
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-900">{line}</p>
      </div>
    );
  }

  const iconSlot = isTransfer ? (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50"
      title="Lead transfer"
    >
      <UserRound className="h-3.5 w-3.5 text-violet-700" />
    </span>
  ) : fieldText ? (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-[11px] font-black text-slate-700"
      title="Field update"
    >
      T
    </span>
  ) : kind === 'whatsapp' ? (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
        waInbound
          ? 'border-emerald-200 bg-emerald-50 text-[#25D366]'
          : 'border-sky-200 bg-sky-50 text-[#25D366]'
      }`}
    >
      <WhatsAppIcon className="h-4 w-4" />
    </span>
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100">
      {kind === 'call' ? (
        <Phone className="h-3.5 w-3.5 text-emerald-600" />
      ) : kind === 'followup' ? (
        <Clock className="h-3.5 w-3.5 text-sky-600" />
      ) : kind === 'booking' ? (
        <ClipboardList className="h-3.5 w-3.5 text-amber-600" />
      ) : automated ? (
        <Bot className="h-3.5 w-3.5 text-slate-600" />
      ) : (
        <History className="h-3.5 w-3.5 text-slate-500" />
      )}
    </span>
  );

  const detailText = [
    headline !== row.title ? row.title : null,
    headline,
    row.body,
  ]
    .filter((x) => String(x || '').trim())
    .join('\n\n');
  const canExpand = detailText.replace(/\s+/g, ' ').trim().length > 48 || kind === 'whatsapp';

  const metaSlot = (
    <div className="flex shrink-0 flex-nowrap items-center gap-1 pl-0.5">
      <time
        dateTime={row.at}
        className="shrink-0 whitespace-nowrap text-[10px] font-bold tabular-nums text-slate-900"
      >
        {when}
      </time>
      {initials.slice(0, 2).map((init) => (
        <InitialBadge key={init} label={init} variant="user" />
      ))}
      {automated ? <InitialBadge label="bot" variant="bot" /> : null}
    </div>
  );

  return (
    <li
      className={`min-h-[2.125rem] rounded-md ${pinned ? 'bg-amber-50/95 ring-1 ring-inset ring-amber-200/80' : ''}`}
    >
      <div className="flex items-center gap-1.5 px-0.5 py-1">
        {onTogglePin ? (
          <button
            type="button"
            onClick={() => onTogglePin(row.id)}
            className={`inline-flex h-7 w-5 shrink-0 items-center justify-center ${
              pinned ? 'text-amber-600' : 'text-slate-300 hover:text-slate-500'
            }`}
            title={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className={`h-3 w-3 ${pinned ? 'fill-amber-400' : ''}`} />
          </button>
        ) : (
          <span className="inline-block h-7 w-5 shrink-0" aria-hidden />
        )}
        {iconSlot}
        <button
          type="button"
          disabled={!canExpand}
          onClick={() => canExpand && setExpanded((v) => !v)}
          className={`flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left ${
            canExpand ? 'cursor-pointer rounded-md hover:bg-slate-50/90' : 'cursor-default'
          }`}
          title={canExpand ? (expanded ? 'Hide details' : 'Show full message') : undefined}
        >
          {main}
        </button>
        {metaSlot}
        {hasRec && !playerOpen ? (
          <CallRecordingPlayer
            callLogId={callLogId}
            hasRecording
            durationSeconds={row.meta?.duration != null ? Number(row.meta.duration) : null}
            open={false}
            onOpenChange={setPlayerOpen}
            showChipDuration={false}
          />
        ) : null}
      </div>
      {expanded && canExpand ? (
        <div className="mb-1 ml-12 mr-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap">
          {detailText}
        </div>
      ) : null}
      {hasRec && playerOpen ? (
        <div className="mb-1 ml-14">
          <CallRecordingPlayer
            callLogId={callLogId}
            hasRecording
            durationSeconds={row.meta?.duration != null ? Number(row.meta.duration) : null}
            open
            onOpenChange={setPlayerOpen}
            showChipDuration={false}
          />
        </div>
      ) : null}
    </li>
  );
}