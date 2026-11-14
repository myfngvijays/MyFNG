'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  History,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessageSquare,
  Save,
  Search,
  Smartphone,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

type SectionId = 'overview' | 'sms' | 'firebase' | 'whatsapp' | 'email' | 'history';

type OtpForm = {
  sms_dlt: boolean;
  firebase: boolean;
  whatsapp: boolean;
  email: boolean;
  email_ready: boolean;
  email_host: string;
  email_port: number;
  email_user: string;
  email_secure: 'tls' | 'ssl';
  email_from: string;
  email_from_name: string;
  password_set: boolean;
  email_pass: string;
};

type Account = {
  phone_number_id: string;
  label: string;
  name: string;
  quality: string;
  active: boolean;
};

type HistoryRow = {
  id: string;
  phone: string;
  channel: string;
  provider: string;
  status: string;
  created_at: string;
  email: string;
  sender_phone_number_id: string;
  tried_phone_number_ids: string[];
  error: string;
};

type HistoryPayload = {
  accounts: Account[];
  summary: Record<'SMS' | 'WHATSAPP' | 'EMAIL', Record<'SENT' | 'VERIFIED' | 'FAILED', number>>;
  rows: HistoryRow[];
};

const EMPTY: OtpForm = {
  sms_dlt: false,
  firebase: false,
  whatsapp: true,
  email: false,
  email_ready: false,
  email_host: '',
  email_port: 465,
  email_user: '',
  email_secure: 'ssl',
  email_from: 'noreply@myfng.in',
  email_from_name: 'MyFNG',
  password_set: false,
  email_pass: '',
};

const SECTIONS: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sms', label: 'SMS OTP', icon: MessageSquare },
  { id: 'firebase', label: 'Firebase OTP', icon: Smartphone },
  { id: 'whatsapp', label: 'WhatsApp OTP', icon: MessageCircle },
  { id: 'email', label: 'Email OTP', icon: Mail },
  { id: 'history', label: 'Sent history', icon: History },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'} disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === 'FAILED'
    ? 'bg-red-50 text-red-700'
    : status === 'VERIFIED'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status || '—'}</span>;
}

function todayIst() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftIstDate(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatWhen(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function senderLabel(row: HistoryRow, accounts: Account[]) {
  if (row.channel !== 'WHATSAPP') return row.email || '—';
  const match = accounts.find((account) => account.phone_number_id === row.sender_phone_number_id);
  if (match) return match.label;
  if (row.sender_phone_number_id) return `•${row.sender_phone_number_id.slice(-4)}`;
  return 'Number not recorded';
}

export default function OtpSettingsPage() {
  const [section, setSection] = useState<SectionId>('overview');
  const [form, setForm] = useState<OtpForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [fromDate, setFromDate] = useState(() => shiftIstDate(todayIst(), -6));
  const [toDate, setToDate] = useState(() => todayIst());
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/otp-settings', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not load OTP settings');
      setForm({ ...EMPTY, ...json.config, email_pass: '' });
    } catch (error: any) {
      toast.error(error?.message || 'Could not load OTP settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const requestChannel = section === 'sms' ? 'SMS' : section === 'whatsapp' ? 'WHATSAPP' : section === 'email' ? 'EMAIL' : channelFilter;
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        channel: requestChannel,
      });
      if ((section === 'history' || section === 'whatsapp') && accountFilter) params.set('account', accountFilter);
      if (search) params.set('q', search);
      const res = await fetch(`/api/super_admin/otp-history?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not load OTP history');
      setHistory(json);
    } catch (error: any) {
      toast.error(error?.message || 'Could not load OTP history');
    } finally {
      setHistoryLoading(false);
    }
  }, [accountFilter, channelFilter, fromDate, search, section, toDate]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const persist = async (next: OtpForm, message = 'OTP settings saved') => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/otp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not save');
      setForm({ ...EMPTY, ...json.config, email_pass: '' });
      toast.success(message);
    } catch (error: any) {
      toast.error(error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const switchChannel = (key: 'sms_dlt' | 'firebase' | 'whatsapp' | 'email', label: string) => {
    const next = { ...form, [key]: !form[key] };
    setForm(next);
    void persist(next, `${label} ${next[key] ? 'on' : 'off'}`);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/super_admin/otp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', to: testTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Test email failed');
      toast.success(json?.message || 'Test email sent');
    } catch (error: any) {
      toast.error(error?.message || 'Test email failed');
    } finally {
      setTesting(false);
    }
  };

  const accounts = history?.accounts || [];
  const rows = history?.rows || [];
  const summary = history?.summary;
  const total = (key: 'SENT' | 'VERIFIED' | 'FAILED') =>
    (summary?.SMS[key] || 0) + (summary?.WHATSAPP[key] || 0) + (summary?.EMAIL[key] || 0);

  const visibleRows = useMemo(() => {
    if (section === 'sms') return rows.filter((row) => row.channel === 'SMS');
    if (section === 'whatsapp') return rows.filter((row) => row.channel === 'WHATSAPP');
    if (section === 'email') return rows.filter((row) => row.channel === 'EMAIL');
    return rows;
  }, [rows, section]);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">OTP</p>
              <p className="text-xs text-slate-500">Codes & mailbox</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <main className="min-w-0 space-y-4">
          {section === 'overview' ? (
            <>
              <section className="grid gap-3 sm:grid-cols-3">
                <Stat label="Sent" value={total('SENT')} hint={`${fromDate} to ${toDate}`} />
                <Stat label="Verified" value={total('VERIFIED')} hint="Customer entered the code" />
                <Stat label="Failed" value={total('FAILED')} hint="Did not leave the server" />
              </section>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ChannelCard title="SMS OTP" on={form.sms_dlt} detail="DLT text message" count={(summary?.SMS.SENT || 0) + (summary?.SMS.FAILED || 0)} onOpen={() => setSection('sms')} />
                <ChannelCard title="Firebase OTP" on={form.firebase} detail="Same switch as Firebase settings" count={0} onOpen={() => setSection('firebase')} />
                <ChannelCard title="WhatsApp OTP" on={form.whatsapp} detail="Both connected numbers" count={(summary?.WHATSAPP.SENT || 0) + (summary?.WHATSAPP.FAILED || 0)} onOpen={() => setSection('whatsapp')} />
                <ChannelCard title="Email OTP" on={form.email} detail={form.email_ready ? form.email_from : 'Mailbox not ready'} count={(summary?.EMAIL.SENT || 0) + (summary?.EMAIL.FAILED || 0)} onOpen={() => setSection('email')} />
              </section>
            </>
          ) : null}

          {section === 'sms' ? (
            <SwitchPanel
              title="SMS OTP"
              hint="DLT text message for booking and login. Leave this off while the DLT pipe is down."
              on={form.sms_dlt}
              disabled={saving || loading}
              onToggle={() => switchChannel('sms_dlt', 'SMS OTP')}
            />
          ) : null}

          {section === 'firebase' ? (
            <SwitchPanel
              title="Firebase OTP"
              hint="Mobile app Firebase phone login. This is the same switch as Push → Firebase Settings. Website booking does not send a code through Firebase."
              on={form.firebase}
              disabled={saving || loading}
              onToggle={() => switchChannel('firebase', 'Firebase OTP')}
            />
          ) : null}

          {section === 'whatsapp' ? (
            <>
              <SwitchPanel
                title="WhatsApp OTP"
                hint="Booking and app login. While a number is red or its display name is pending, turn this off so customers are not sent a code that cannot arrive."
                on={form.whatsapp}
                disabled={saving || loading}
                onToggle={() => switchChannel('whatsapp', 'WhatsApp OTP')}
              />
              <section className="grid gap-3 sm:grid-cols-2">
                {accounts.map((account) => {
                  const sent = rows.filter((row) => row.channel === 'WHATSAPP' && row.sender_phone_number_id === account.phone_number_id && row.status !== 'FAILED').length;
                  const failed = rows.filter((row) => row.channel === 'WHATSAPP' && row.sender_phone_number_id === account.phone_number_id && row.status === 'FAILED').length;
                  return (
                    <button
                      key={account.phone_number_id}
                      type="button"
                      onClick={() => { setSection('history'); setChannelFilter('WHATSAPP'); setAccountFilter(account.phone_number_id); }}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-200"
                    >
                      <p className="text-sm font-semibold text-slate-900">{account.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{account.name || 'Connected number'}{account.quality ? ` · ${account.quality}` : ''}</p>
                      <p className="mt-3 text-xs text-slate-600">{sent} sent · {failed} failed in this list</p>
                    </button>
                  );
                })}
              </section>
            </>
          ) : null}

          {section === 'email' ? (
            <>
              <SwitchPanel
                title="Email OTP"
                hint="Sends the code to the email the customer types. The mailbox below must be saved first."
                on={form.email}
                disabled={saving || loading}
                onToggle={() => switchChannel('email', 'Email OTP')}
              />
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">Mailbox</h2>
                <p className="mt-1 text-sm text-slate-500">Outgoing mail uses SSL on port 465. Ports 993 and 995 only receive mail.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="SMTP host" className="sm:col-span-2">
                    <input value={form.email_host} onChange={(event) => setForm((current) => ({ ...current, email_host: event.target.value }))} placeholder="mail.myfng.in" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                  </Field>
                  <Field label="Port">
                    <input type="number" value={form.email_port} onChange={(event) => setForm((current) => ({ ...current, email_port: Number(event.target.value || 465) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                  </Field>
                  <Field label="Security">
                    <select
                      value={form.email_secure}
                      onChange={(event) => {
                        const secure = event.target.value === 'ssl' ? 'ssl' : 'tls';
                        setForm((current) => ({ ...current, email_secure: secure, email_port: secure === 'ssl' ? 465 : 587 }));
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="ssl">SSL (port 465)</option>
                      <option value="tls">TLS (port 587)</option>
                    </select>
                  </Field>
                  <Field label="Username">
                    <input value={form.email_user} onChange={(event) => setForm((current) => ({ ...current, email_user: event.target.value }))} placeholder="noreply@myfng.in" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                  </Field>
                  <Field label="Password">
                    <span className="relative block">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.email_pass}
                        onChange={(event) => setForm((current) => ({ ...current, email_pass: event.target.value }))}
                        placeholder={form.password_set ? 'Saved — leave blank to keep' : 'Mailbox password'}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </Field>
                  <Field label="From email">
                    <input value={form.email_from} onChange={(event) => setForm((current) => ({ ...current, email_from: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                  </Field>
                  <Field label="From name">
                    <input value={form.email_from_name} onChange={(event) => setForm((current) => ({ ...current, email_from_name: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                  </Field>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="Send a test to this email" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                  <button type="button" onClick={() => void sendTest()} disabled={testing || loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    {testing ? 'Sending...' : 'Send test'}
                  </button>
                  <button type="button" onClick={() => void persist(form)} disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save mailbox'}
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {section !== 'firebase' ? (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{section === 'history' ? 'Sent history' : 'Recent sends'}</h2>
                  <p className="text-xs text-slate-500">Codes are hidden. Times are IST.</p>
                </div>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }}
                >
                  <button type="button" onClick={() => { setFromDate(todayIst()); setToDate(todayIst()); }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600">Today</button>
                  <button type="button" onClick={() => { setFromDate(shiftIstDate(todayIst(), -6)); setToDate(todayIst()); }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600">7 days</button>
                  <button type="button" onClick={() => { setFromDate(shiftIstDate(todayIst(), -29)); setToDate(todayIst()); }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600">30 days</button>
                  <label className="text-xs text-slate-500">
                    From
                    <input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800" />
                  </label>
                  <label className="text-xs text-slate-500">
                    To
                    <input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800" />
                  </label>
                  {section === 'overview' || section === 'history' ? (
                    <select value={channelFilter} onChange={(event) => { setChannelFilter(event.target.value); setAccountFilter(''); }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                      <option value="ALL">All channels</option>
                      <option value="SMS">SMS</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="EMAIL">Email</option>
                    </select>
                  ) : null}
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Phone or email" className="w-44 rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-sm" />
                  </span>
                  <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">Search</button>
                </form>
              </div>
              {(section === 'history' || section === 'whatsapp') && (section === 'whatsapp' || channelFilter === 'WHATSAPP') ? (
                <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-2">
                  <FilterChip active={!accountFilter} onClick={() => setAccountFilter('')}>Both numbers</FilterChip>
                  {accounts.map((account) => (
                    <FilterChip key={account.phone_number_id} active={accountFilter === account.phone_number_id} onClick={() => setAccountFilter(account.phone_number_id)}>
                      {account.label}
                    </FilterChip>
                  ))}
                </div>
              ) : null}
              <HistoryTable rows={visibleRows} accounts={accounts} loading={historyLoading} />
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block text-sm ${className || ''}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function ChannelCard({ title, on, detail, count, onOpen }: { title: string; on: boolean; detail: string; count: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-200">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{on ? 'On' : 'Off'}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
      <p className="mt-3 text-xs text-slate-600">{count} requests in this range</p>
    </button>
  );
}

function SwitchPanel({ title, hint, on, disabled, onToggle }: { title: string; hint: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <section className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-500">{hint}</p>
      </div>
      <Toggle checked={on} disabled={disabled} onChange={onToggle} />
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
      {children}
    </button>
  );
}

function HistoryTable({ rows, accounts, loading }: { rows: HistoryRow[]; accounts: Account[]; loading: boolean }) {
  if (loading && rows.length === 0) {
    return <p className="px-5 py-8 text-sm text-slate-500">Loading sends...</p>;
  }
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-sm text-slate-500">No OTP sends in this view.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">Channel</th>
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Sent from</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatWhen(row.created_at)}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{row.channel === 'SMS' ? 'SMS' : row.channel === 'EMAIL' ? 'Email' : 'WhatsApp'}</td>
              <td className="px-4 py-3 text-slate-700">{row.phone ? `+91 ${row.phone}` : '—'}</td>
              <td className="px-4 py-3 text-slate-600">
                <div>{senderLabel(row, accounts)}</div>
                {row.error ? <div className="mt-0.5 max-w-xs text-xs text-red-600">{row.error}</div> : null}
              </td>
              <td className="px-4 py-3"><StatusPill status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
