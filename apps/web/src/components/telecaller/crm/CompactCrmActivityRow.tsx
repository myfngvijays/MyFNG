'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, ClipboardList, History, Phone } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import CallRecordingPlayer from '@/components/telecaller/CallRecordingPlayer';
import {
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

export default function CompactCrmActivityRow({ row }: { row: CompactActivityRowModel }) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const kind = row.kind;
  const callLogId = String(row.meta?.call_log_id || '').trim();
  const hasRec =
    kind === 'call' &&
    Boolean(callLogId) &&
    (Boolean(row.meta?.has_call_recording) || Boolean(row.meta?.call_recording_url));
  const when = activityTimestampLabel(row.at);

  const waInbound = kind === 'whatsapp' ? whatsappDirectionInbound(row.title, row.meta) : false;

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
        <span className="min-w-0 truncate text-[10px] text-slate-400 italic">{summary.noteText}</span>
      </div>
    );
  } else if (kind === 'whatsapp') {
    main = (
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span
          className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
            waInbound ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
          }`}
        >
          {waInbound ? 'Customer' : 'We sent'}
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-800">
          {compactWhatsappPreview(row.body, row.title)}
        </p>
      </div>
    );
  } else {
    main = (
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-800">
        {compactGenericLine(row.title, row.body)}
      </p>
    );
  }

  const iconSlot =
    kind === 'whatsapp' ? (
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
        ) : (
          <History className="h-3.5 w-3.5 text-slate-500" />
        )}
      </span>
    );

  return (
    <li className="min-h-[2.125rem]">
      <div className="flex items-center gap-2 py-1">
        {iconSlot}
        {main}
        <time
          dateTime={row.at}
          className="shrink-0 text-right text-[9px] font-semibold leading-tight text-slate-400 whitespace-nowrap"
        >
          {when}
        </time>
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
      {hasRec && playerOpen ? (
        <div className="mb-1 ml-9">
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