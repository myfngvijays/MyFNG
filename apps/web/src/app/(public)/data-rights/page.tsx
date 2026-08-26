'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { DATA_RIGHTS_TYPES, GRIEVANCE_OFFICER } from '@/lib/dpdp/constants';

export default function DataRightsPage() {
  const [requestType, setRequestType] = useState('access');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doneId, setDoneId] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/dpdp/rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: requestType,
          full_name: fullName,
          email,
          phone,
          details,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not submit');
      setDoneId(String(json.id || 'received'));
    } catch (err: any) {
      setError(err?.message || 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-20 sm:pt-24">
        <div className="mx-auto max-w-xl space-y-4 px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Data rights request</h1>
          <p className="text-sm text-gray-600">
            Access, correct, erase, withdraw consent, nominate, or file a grievance under the DPDP Act,
            2023. Officer: {GRIEVANCE_OFFICER.name} ·{' '}
            <a className="text-blue-700 underline" href={`mailto:${GRIEVANCE_OFFICER.email}`}>
              {GRIEVANCE_OFFICER.email}
            </a>
          </p>
          {doneId ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
              Request received{doneId !== 'received' ? ` (ref ${doneId})` : ''}. We aim to acknowledge
              within {GRIEVANCE_OFFICER.acknowledgeHours} hours.
              <div className="mt-3">
                <Link href="/privacy-notice" className="font-semibold underline">
                  Back to Privacy Notice
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <label className="block text-sm font-medium text-gray-800">
                Request type
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                >
                  {DATA_RIGHTS_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-800">
                Full name *
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-gray-800">
                Email *
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-gray-800">
                Mobile
                <input
                  type="tel"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </label>
              <label className="block text-sm font-medium text-gray-800">
                Details
                <textarea
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="What should we access, correct, or delete?"
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
