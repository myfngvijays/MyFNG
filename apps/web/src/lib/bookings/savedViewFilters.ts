import type { ReportDatePreset } from '@/lib/report-date-range';
import { REPORT_DATE_PRESETS } from '@/lib/report-date-range';

export type BookingsViewSort = 'newest' | 'oldest';
export type BookingsTagMode = 'any' | 'all';

export type BookingsViewSnapshot = {
  v: 1;
  source: string;
  status: string;
  coupon: string;
  recording: string;
  assignees: string[];
  search: string;
  sourceLabel: string;
  leadType: string;
  datePreset: ReportDatePreset;
  customStart: string;
  customEnd: string;
  tagIds: string[];
  tagMode: BookingsTagMode;
  messageTriggers: string[];
  sort: BookingsViewSort;
};

export const EMPTY_BOOKINGS_VIEW: BookingsViewSnapshot = {
  v: 1,
  source: 'ALL',
  status: 'ALL',
  coupon: 'ALL',
  recording: 'ALL',
  assignees: [],
  search: '',
  sourceLabel: '',
  leadType: '',
  datePreset: 'all_time',
  customStart: '',
  customEnd: '',
  tagIds: [],
  tagMode: 'any',
  messageTriggers: [],
  sort: 'newest',
};

export type BookingsViewConditionKey =
  | 'lead_tag'
  | 'created_on'
  | 'assignee'
  | 'status'
  | 'source'
  | 'discount'
  | 'recording'
  | 'lead_type'
  | 'message_trigger';

const DATE_PRESETS = new Set(REPORT_DATE_PRESETS.map((p) => p.value));

function asString(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => asString(item)).filter(Boolean))];
}

export function normalizeBookingsViewFilters(raw: unknown): BookingsViewSnapshot {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const presetRaw = asString(src.datePreset || src.date_preset, 'all_time').toLowerCase();
  const datePreset = (DATE_PRESETS.has(presetRaw as ReportDatePreset)
    ? presetRaw
    : 'all_time') as ReportDatePreset;
  const tagMode = asString(src.tagMode || src.tag_mode, 'any').toLowerCase() === 'all' ? 'all' : 'any';
  const sort = asString(src.sort, 'newest').toLowerCase() === 'oldest' ? 'oldest' : 'newest';

  return {
    v: 1,
    source: asString(src.source, 'ALL').toUpperCase() || 'ALL',
    status: asString(src.status, 'ALL').toUpperCase() || 'ALL',
    coupon: asString(src.coupon, 'ALL').toUpperCase() || 'ALL',
    recording: asString(src.recording, 'ALL').toUpperCase() || 'ALL',
    assignees: asStringList(src.assignees),
    search: asString(src.search),
    sourceLabel: asString(src.sourceLabel || src.source_label),
    leadType: asString(src.leadType || src.lead_type).toUpperCase(),
    datePreset,
    customStart: asString(src.customStart || src.custom_start).slice(0, 10),
    customEnd: asString(src.customEnd || src.custom_end).slice(0, 10),
    tagIds: asStringList(src.tagIds || src.tag_ids),
    tagMode,
    messageTriggers: asStringList(src.messageTriggers || src.message_triggers),
    sort,
  };
}

function sortedKey(values: string[]): string {
  return [...values].map((v) => v.toLowerCase()).sort().join('|');
}

export function bookingsViewFiltersEqual(a: BookingsViewSnapshot, b: BookingsViewSnapshot): boolean {
  return (
    a.source === b.source &&
    a.status === b.status &&
    a.coupon === b.coupon &&
    a.recording === b.recording &&
    a.search === b.search &&
    a.sourceLabel === b.sourceLabel &&
    a.leadType === b.leadType &&
    a.datePreset === b.datePreset &&
    a.customStart === b.customStart &&
    a.customEnd === b.customEnd &&
    a.tagMode === b.tagMode &&
    a.sort === b.sort &&
    sortedKey(a.assignees) === sortedKey(b.assignees) &&
    sortedKey(a.tagIds) === sortedKey(b.tagIds) &&
    sortedKey(a.messageTriggers) === sortedKey(b.messageTriggers)
  );
}

export function bookingsViewHasConditions(snapshot: BookingsViewSnapshot): boolean {
  return !bookingsViewFiltersEqual(
    { ...snapshot, sort: 'newest' },
    { ...EMPTY_BOOKINGS_VIEW, search: snapshot.search },
  );
}

export function conditionsFromSnapshot(snapshot: BookingsViewSnapshot): BookingsViewConditionKey[] {
  const keys: BookingsViewConditionKey[] = [];
  if (snapshot.tagIds.length > 0) keys.push('lead_tag');
  if (snapshot.datePreset !== 'all_time') keys.push('created_on');
  if (snapshot.assignees.length > 0) keys.push('assignee');
  if (snapshot.messageTriggers.length > 0) keys.push('message_trigger');
  if (snapshot.status !== 'ALL') keys.push('status');
  if (snapshot.source !== 'ALL' || snapshot.sourceLabel) keys.push('source');
  if (snapshot.coupon !== 'ALL') keys.push('discount');
  if (snapshot.recording !== 'ALL') keys.push('recording');
  if (snapshot.leadType) keys.push('lead_type');
  return keys;
}

export function resetCondition(
  snapshot: BookingsViewSnapshot,
  key: BookingsViewConditionKey,
): BookingsViewSnapshot {
  switch (key) {
    case 'lead_tag':
      return { ...snapshot, tagIds: [], tagMode: 'any' };
    case 'created_on':
      return { ...snapshot, datePreset: 'all_time', customStart: '', customEnd: '' };
    case 'assignee':
      return { ...snapshot, assignees: [] };
    case 'message_trigger':
      return { ...snapshot, messageTriggers: [] };
    case 'status':
      return { ...snapshot, status: 'ALL' };
    case 'source':
      return { ...snapshot, source: 'ALL', sourceLabel: '' };
    case 'discount':
      return { ...snapshot, coupon: 'ALL' };
    case 'recording':
      return { ...snapshot, recording: 'ALL' };
    case 'lead_type':
      return { ...snapshot, leadType: '' };
    default:
      return snapshot;
  }
}
