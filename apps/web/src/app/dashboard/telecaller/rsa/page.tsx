'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { RSALeadCreateForm } from '@/components/telecaller/RSALeadCreateForm';
import { CheckCircle, Clock, FileText, RefreshCw } from 'lucide-react';

type TabKey = 'overview' | 'create' | 'created';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function TelecallerRSAPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [createdLoading, setCreatedLoading] = useState(false);
  const [createdLeads, setCreatedLeads] = useState<any[]>([]);
  const [createdError, setCreatedError] = useState<string>('');
  const [sarvOpen, setSarvOpen] = useState(false);
  const [sarvLead, setSarvLead] = useState<any | null>(null);
  const [sarvCalls, setSarvCalls] = useState<any[]>([]);
  const [sarvLoading, setSarvLoading] = useState(false);
  const [sarvError, setSarvError] = useState('');

  const stats = useMemo(() => {
    const total = leads.length;
    const pending = leads.filter((l) => String(l?.lead_status || '').toLowerCase() === 'pending').length;
    const completed = leads.filter((l) => String(l?.lead_status || '').toLowerCase() === 'completed').length;
    return { total, pending, completed };
  }, [leads]);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/telecaller/rsa-complaints?limit=50');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load RSA leads');
      setLeads(Array.isArray(json?.leads) ? json.leads : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load RSA leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreatedLeads = async () => {
    setCreatedLoading(true);
    setCreatedError('');
    try {
      // Show ONLY RSA leads created by this telecaller
      const res = await fetch('/api/telecaller/rsa-complaints?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load created leads');
      setCreatedLeads(Array.isArray(json?.leads) ? json.leads : []);
    } catch (e: any) {
      setCreatedError(e?.message || 'Failed to load created leads');
      setCreatedLeads([]);
    } finally {
      setCreatedLoading(false);
    }
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    return String(value).replace('T', ' ').slice(0, 19);
  };

  const openSarvCalls = async (lead: any) => {
    if (!lead?.id) return;
    setSarvLead(lead);
    setSarvOpen(true);
    setSarvLoading(true);
    setSarvError('');
    try {
      const res = await fetch(`/api/telecaller/rsa-complaints/${lead.id}/sarv-calls`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load SARV calls');
      setSarvCalls(Array.isArray(json?.calls) ? json.calls : []);
    } catch (e: any) {
      setSarvError(e?.message || 'Failed to load SARV calls');
      setSarvCalls([]);
    } finally {
      setSarvLoading(false);
    }
  };

  const closeSarvCalls = () => {
    setSarvOpen(false);
    setSarvLead(null);
    setSarvCalls([]);
    setSarvError('');
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 md:space-y-6 px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">RSA</h1>
            <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">
              Overview and creation of RSA leads.
            </p>
          </div>

          {tab === 'overview' ? (
            <button
              type="button"
              className="btn btn-outline text-xs sm:text-sm px-4 py-2 flex items-center gap-2 w-full sm:w-auto"
              onClick={fetchLeads}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : tab === 'created' ? (
            <button
              type="button"
              className="btn btn-outline text-xs sm:text-sm px-4 py-2 flex items-center gap-2 w-full sm:w-auto"
              onClick={fetchCreatedLeads}
              disabled={createdLoading}
            >
              <RefreshCw className={`w-4 h-4 ${createdLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'create'} onClick={() => setTab('create')}>
            Create RSA lead
          </TabButton>
          <TabButton
            active={tab === 'created'}
            onClick={() => {
              setTab('created');
              if (createdLeads.length === 0) fetchCreatedLeads();
            }}
          >
            Created Leads
          </TabButton>
        </div>

        {tab === 'overview' ? (
          <div className="space-y-4">
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Total</div>
                  <div className="text-lg font-bold">{stats.total}</div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xs text-gray-600">Pending</div>
                  <div className="text-lg font-bold">{stats.pending}</div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-600">Completed</div>
                  <div className="text-lg font-bold">{stats.completed}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Recent RSA leads</h2>
                <div className="text-xs text-gray-500">
                  Showing {leads.length} {loading ? '(loading...)' : ''}
                </div>
              </div>

              {leads.length === 0 ? (
                <div className="text-sm text-gray-600 py-6 text-center">
                  No RSA leads found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Phone</th>
                        <th className="py-2 pr-3">Vehicle</th>
                        <th className="py-2 pr-3">Service</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Registered</th>
                        <th className="py-2 pr-3">Calls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((l) => (
                        <tr key={l.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-semibold">{l.customer_name || '—'}</td>
                          <td className="py-2 pr-3">{l.contact_number || '—'}</td>
                          <td className="py-2 pr-3">
                            {l.vehicle_number ? (
                              <span className="font-mono">{l.vehicle_number}</span>
                            ) : (
                              <span className="text-gray-600">{l.vehicle_model || '—'}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{l.service_type || '—'}</td>
                          <td className="py-2 pr-3">
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {l.lead_status || l.complaint_status || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {formatDateTime(l.lead_registered_at || l.requested_at)}
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 font-semibold"
                              onClick={() => openSarvCalls(l)}
                            >
                              View calls
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'created' ? (
          <div className="space-y-4">
            {createdError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {createdError}
              </div>
            ) : null}

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">RSA leads created by you</h2>
                <div className="text-xs text-gray-500">
                  Showing {createdLeads.length} {createdLoading ? '(loading...)' : ''}
                </div>
              </div>

              {createdLeads.length === 0 ? (
                <div className="text-sm text-gray-600 py-6 text-center">No created leads found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Phone</th>
                        <th className="py-2 pr-3">Vehicle</th>
                        <th className="py-2 pr-3">Service</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Registered</th>
                        <th className="py-2 pr-3">Calls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createdLeads.map((l) => (
                        <tr key={l.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-semibold">{l.customer_name || '—'}</td>
                          <td className="py-2 pr-3">{l.contact_number || '—'}</td>
                          <td className="py-2 pr-3">
                            {l.vehicle_number ? (
                              <span className="font-mono">{l.vehicle_number}</span>
                            ) : (
                              <span className="text-gray-600">{l.vehicle_model || '—'}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{l.service_type || '—'}</td>
                          <td className="py-2 pr-3">
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {l.lead_status || l.complaint_status || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {formatDateTime(l.lead_registered_at || l.requested_at)}
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 font-semibold"
                              onClick={() => openSarvCalls(l)}
                            >
                              View calls
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <RSALeadCreateForm
              embedded
              onCreated={() => {
                // After creation, show it in Overview.
                setTab('overview');
                fetchLeads();
              }}
              onCancel={() => setTab('overview')}
            />
          </div>
        )}
      </div>

      {sarvOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-text-heading">SARV Calls</h3>
                <p className="text-xs text-gray-500">
                  {sarvLead?.customer_name || 'Unknown'} • {sarvLead?.contact_number || '—'}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800 font-semibold"
                onClick={closeSarvCalls}
              >
                Close
              </button>
            </div>

            {sarvLoading ? (
              <div className="text-sm text-gray-600">Loading calls...</div>
            ) : sarvError ? (
              <div className="text-sm text-red-600">{sarvError}</div>
            ) : sarvCalls.length === 0 ? (
              <div className="text-sm text-gray-600">No SARV calls found for this complaint.</div>
            ) : (
              <div className="space-y-3">
                {sarvCalls.map((call) => (
                  <div key={call.callid} className="border rounded-lg p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span>Call ID: {call.callid}</span>
                      <span>Status: {call.callstatus ?? '—'}</span>
                      <span>Type: {call.ctype || '—'}</span>
                      <span>Talk: {call.talkduration ?? 0}s</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Answered: {formatDateTime(call.custanswerstime)} • Ended: {formatDateTime(call.custansweretime)}
                    </div>
                    {call.recording_url ? (
                      <audio controls className="w-full">
                        <source src={call.recording_url} />
                      </audio>
                    ) : null}
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold">Transcription</summary>
                      <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                        {call.transcription || 'Not available yet.'}
                      </div>
                    </details>
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold">Summary</summary>
                      <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                        {call.summary || 'Not available yet.'}
                      </div>
                    </details>
                    {call.disposition || call.disposition_note ? (
                      <div className="text-xs text-gray-600">
                        Disposition: {call.disposition || '—'} • Note: {call.disposition_note || '—'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

