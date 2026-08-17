'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';
import {
  Calendar,
  Clock,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  AlertTriangle,
  Eye,
} from 'lucide-react';

type Segment = 'followups' | 'scripts' | 'rsa';

const SCRIPT_CARDS = [
  {
    title: 'New lead opener',
    body: 'Hello, main MyFNG se bol raha/rahi hoon. Aapne car service ke liye enquiry ki thi — kab convenient hoga pickup schedule karne ke liye?',
  },
  {
    title: 'Callback / follow-up',
    body: 'Namaste, pehle call pe baat hui thi. Aaj slot confirm kar sakte hain? Doorstep pickup ya workshop visit — kya prefer karenge?',
  },
  {
    title: 'Price objection',
    body: 'Price transparent hai — package mein labour + checklist covered hai. Coupon apply karke main best payable amount bata deta/deti hoon.',
  },
  {
    title: 'RSA pitch',
    body: 'Agar aap stuck hain — battery, towing, flat tyre — hum RSA team assign kar sakte hain. Location aur vehicle number share karein.',
  },
  {
    title: 'Closing / book',
    body: 'Perfect. Main abhi booking create karta/karti hoon — Pay Later option rahega. WhatsApp pe confirmation aa jayega.',
  },
];

function EngageContent() {
  const router = useRouter();
  const { permissions, loading: permLoading } = useCrmPermissions();
  const searchParams = useSearchParams();
  const tabParam = (searchParams?.get('tab') || 'followups') as Segment;
  const [segment, setSegment] = useState<Segment>(
    ['followups', 'scripts', 'rsa'].includes(tabParam) ? tabParam : 'followups',
  );
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    if (permLoading) return;
    if (!permissions.engage) {
      router.replace('/dashboard/telecaller/reports');
    }
  }, [permLoading, permissions.engage, router]);

  useEffect(() => {
    if (['followups', 'scripts', 'rsa'].includes(tabParam)) setSegment(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (!permissions.engage || permLoading) return;
    if (segment !== 'followups') return;
    fetchFollowUps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, filter, permissions.engage, permLoading]);

  async function fetchFollowUps() {
    const supabase = createClient();
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      let query = supabase
        .from('telecaller_follow_ups')
        .select(
          `*, lead:service_leads(id, lead_number, customer_name, customer_phone, vehicle_make, vehicle_model)`,
        )
        .eq('telecaller_id', userProfile?.id);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      switch (filter) {
        case 'pending':
          query = query.eq('status', 'PENDING');
          break;
        case 'today':
          query = query
            .eq('status', 'PENDING')
            .gte('scheduled_time', today.toISOString())
            .lt('scheduled_time', tomorrow.toISOString());
          break;
        case 'overdue':
          query = query.eq('status', 'PENDING').lt('scheduled_time', new Date().toISOString());
          break;
        case 'completed':
          query = query.eq('status', 'COMPLETED');
          break;
      }

      const { data, error } = await query.order('scheduled_time', { ascending: true });
      if (error) throw error;
      setFollowUps(data || []);
    } catch (e) {
      console.error(e);
      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  }


  if (permLoading || !permissions.engage) {
    return (
      <DashboardLayout role="telecaller">
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Redirecting…
        </div>
      </DashboardLayout>
    );
  }

  async function markDone(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('telecaller_follow_ups')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    fetchFollowUps();
  }

  async function markCancel(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('telecaller_follow_ups')
      .update({ status: 'CANCELLED' })
      .eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    fetchFollowUps();
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Advanced CRM</p>
            <h1 className="text-2xl font-extrabold text-[#023D95]">Engage</h1>
          </div>
          <Link
            href="/dashboard/telecaller/enquiry-leads"
            className="text-sm font-bold text-[#004AAD] hover:underline"
          >
            Enquiry leads →
          </Link>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'followups' as const, label: 'Follow-ups' },
            { id: 'scripts' as const, label: 'Scripts' },
            { id: 'rsa' as const, label: 'RSA / Pay' },
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

        {segment === 'followups' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'pending', label: 'Pending' },
                { id: 'today', label: 'Today' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'completed', label: 'Done' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                    filter === f.id
                      ? 'bg-[#004AAD] text-white'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : followUps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
                No follow-ups in this filter
              </div>
            ) : (
              <div className="space-y-3">
                {followUps.map((fu) => {
                  const lead = fu.lead || {};
                  const when = fu.scheduled_time
                    ? new Date(fu.scheduled_time).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';
                  return (
                    <div
                      key={fu.id}
                      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-slate-900">
                            {lead.customer_name || 'Customer'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {lead.lead_number || '—'} · {[lead.vehicle_make, lead.vehicle_model]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#004AAD]">
                            <Calendar className="h-3.5 w-3.5" /> {when}
                          </p>
                          {fu.notes ? (
                            <p className="mt-1 text-xs text-slate-500">{fu.notes}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lead.customer_phone ? (
                          <a
                            href={`tel:${lead.customer_phone}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                          >
                            <Phone className="h-3.5 w-3.5" /> Call
                          </a>
                        ) : null}
                        {lead.id ? (
                          <Link
                            href={`/dashboard/telecaller/leads/${lead.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#004AAD]"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                        ) : null}
                        {fu.status === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => markDone(fu.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Done
                            </button>
                            <button
                              type="button"
                              onClick={() => markCancel(fu.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href="/dashboard/telecaller/followups"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#004AAD]"
            >
              <Clock className="h-4 w-4" /> Open classic follow-ups page
            </Link>
          </>
        ) : null}

        {segment === 'scripts' ? (
          <div className="grid gap-3 md:grid-cols-2">
            {SCRIPT_CARDS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2 text-[#004AAD]">
                  <MessageSquare className="h-4 w-4" />
                  <h3 className="text-sm font-extrabold">{s.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{s.body}</p>
                <button
                  type="button"
                  className="mt-3 text-xs font-bold text-[#004AAD]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(s.body);
                      alert('Copied');
                    } catch {
                      alert(s.body);
                    }
                  }}
                >
                  Copy script
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {segment === 'rsa' ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-lg font-extrabold text-[#023D95]">RSA / Payments</h2>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Roadside assistance leads aur payment follow-ups ke liye dedicated RSA panel use karein.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/telecaller/rsa"
                className="rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white"
              >
                Open RSA panel
              </Link>
              <Link
                href="/dashboard/telecaller/book"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Create RSA booking
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default function TelecallerCrmEngagePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="telecaller">
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        </DashboardLayout>
      }
    >
      <EngageContent />
    </Suspense>
  );
}
