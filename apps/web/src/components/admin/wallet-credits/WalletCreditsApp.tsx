'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, IndianRupee, MinusCircle } from 'lucide-react';
import BulkCreditSection from './sections/BulkCreditSection';
import BulkDebitSection from './sections/BulkDebitSection';
import HistorySection from './sections/HistorySection';

type SectionId = 'bulk' | 'debit' | 'history';

const NAV = [
  { id: 'bulk' as const, label: 'Bulk Credit', icon: IndianRupee, description: 'Add balance — uniform or per-user' },
  { id: 'debit' as const, label: 'Bulk Debit', icon: MinusCircle, description: 'Remove balance from users' },
  { id: 'history' as const, label: 'History & Export', icon: History, description: 'Audit trail + CSV export' },
];

function sectionFromParam(value: string | null): SectionId {
  if (value === 'debit' || value === 'history') return value;
  return 'bulk';
}

function WalletCreditsAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));

  const setSection = useCallback(
    (next: SectionId) => {
      router.push(`/dashboard/super_admin/wallet-credits?section=${next}`);
    },
    [router],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50/40">
      <div className="border-b border-emerald-100/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Wallet Operations</p>
            <h1 className="text-2xl font-black text-gray-900 mt-0.5">Wallet Credits</h1>
            <p className="text-sm text-gray-500 mt-1">
              Advanced bulk credit/debit — Google Sheet, variable amounts, expiry, push notifications.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                    active
                      ? item.id === 'debit'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {section === 'bulk' ? <BulkCreditSection /> : null}
        {section === 'debit' ? <BulkDebitSection /> : null}
        {section === 'history' ? <HistorySection /> : null}
      </div>
    </div>
  );
}

export default function WalletCreditsApp() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading wallet credits…</div>}>
      <WalletCreditsAppInner />
    </Suspense>
  );
}
