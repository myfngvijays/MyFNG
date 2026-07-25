'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, User, LogOut, Clock, CheckCircle } from 'lucide-react';

export default function TelecallerCrmMePage() {
  const router = useRouter();
  const [segment, setSegment] = useState<'attendance' | 'profile'>('attendance');
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/telecaller/crm/attendance');
      const json = await res.json();
      if (!res.ok) {
        setData({ is_punched_in: false, history: [], warning: json?.error });
      } else {
        setData(json);
      }
    } catch (e: any) {
      setData({ is_punched_in: false, history: [], warning: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase
        .from('users_login')
        .select('id, name, email, phone, role')
        .eq('email', user.email)
        .maybeSingle();
      setProfile(row || { email: user.email, name: user.user_metadata?.name });
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (segment === 'profile') loadProfile();
  }, [segment, loadProfile]);

  const punch = async (action: 'punch_in' | 'punch_out') => {
    setPunching(true);
    try {
      const res = await fetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      await load();
    } catch (e: any) {
      alert(
        e?.message?.includes('telecaller_attendance') || e?.message?.includes('relation')
          ? 'Run database migration 282_telecaller_crm_advanced.sql first'
          : e?.message || 'Failed',
      );
    } finally {
      setPunching(false);
    }
  };

  const logout = async () => {
    if (data?.is_punched_in) {
      try {
        await fetch('/api/telecaller/crm/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'punch_out' }),
        });
      } catch {
        // continue
      }
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const history = Array.isArray(data?.history) ? data.history : [];

  return (
    <DashboardLayout role="telecaller">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-500">Advanced CRM</p>
          <h1 className="text-2xl font-extrabold text-[#023D95]">Me</h1>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'attendance' as const, label: 'Attendance' },
            { id: 'profile' as const, label: 'Profile' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegment(s.id)}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold ${
                segment === s.id
                  ? 'bg-[#004AAD] text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {segment === 'attendance' ? (
          loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Punch in when you start calling. Punch out when you leave.
              </p>

              <div
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm ${
                  data?.is_punched_in ? 'border-emerald-200' : 'border-amber-200'
                }`}
              >
                {data?.is_punched_in ? (
                  <CheckCircle className="h-7 w-7 text-emerald-600" />
                ) : (
                  <Clock className="h-7 w-7 text-amber-600" />
                )}
                <div>
                  <p className="font-bold text-slate-900">
                    {data?.is_punched_in ? 'Currently On Floor' : 'Currently Off Duty'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {data?.open_session?.punch_in_at
                      ? `In since ${new Date(data.open_session.punch_in_at).toLocaleString('en-IN')}`
                      : 'No open session'}
                  </p>
                </div>
              </div>

              {data?.warning ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{data.warning}</p>
              ) : null}

              <button
                type="button"
                disabled={punching}
                onClick={() => punch(data?.is_punched_in ? 'punch_out' : 'punch_in')}
                className={`w-full rounded-xl py-3.5 text-sm font-extrabold text-white disabled:opacity-60 ${
                  data?.is_punched_in ? 'bg-red-600' : 'bg-emerald-600'
                }`}
              >
                {punching ? 'Please wait…' : data?.is_punched_in ? 'Punch Out' : 'Punch In'}
              </button>

              <div>
                <h2 className="mb-2 text-sm font-bold text-[#023D95]">Recent Timings</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">No attendance records yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((row: any) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm"
                      >
                        <span className="font-bold text-slate-800">{row.work_date}</span>
                        <span className="text-slate-500">
                          In:{' '}
                          {row.punch_in_at
                            ? new Date(row.punch_in_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        <span className="text-slate-500">
                          Out:{' '}
                          {row.punch_out_at
                            ? new Date(row.punch_out_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/dashboard/telecaller/profile"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#004AAD]"
              >
                <User className="h-4 w-4" /> Open full profile page
              </Link>

              <button
                type="button"
                onClick={logout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </>
          )
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            {!profile ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold text-slate-500">Name</dt>
                  <dd className="font-bold text-slate-900">{profile.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">Email</dt>
                  <dd className="text-slate-800">{profile.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">Phone</dt>
                  <dd className="text-slate-800">{profile.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">Role</dt>
                  <dd className="text-slate-800">{profile.role || 'TELECALLER'}</dd>
                </div>
              </dl>
            )}
            <Link
              href="/dashboard/telecaller/profile"
              className="mt-4 inline-block text-sm font-bold text-[#004AAD]"
            >
              Edit / full profile →
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
