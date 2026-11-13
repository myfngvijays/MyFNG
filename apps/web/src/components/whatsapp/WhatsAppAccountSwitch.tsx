'use client';

import { useEffect, useState } from 'react';
import {
  WA_ACCOUNT_EVENT,
  readStoredWaAccountId,
  writeStoredWaAccountId,
  type WaAccountChoice,
} from '@/lib/whatsapp/accountSelection';

export function useWhatsAppAccount() {
  const [accounts, setAccounts] = useState<WaAccountChoice[]>([]);
  const [accountId, setAccountId] = useState('settings');

  useEffect(() => {
    const sync = () => setAccountId(readStoredWaAccountId());
    sync();
    window.addEventListener(WA_ACCOUNT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WA_ACCOUNT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/super_admin/whatsapp-accounts', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setAccounts(Array.isArray(json?.accounts) ? json.accounts : []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = accounts.find((account) => account.id === accountId) || accounts.find((account) => account.source === 'settings') || null;

  return {
    accounts,
    accountId: selected?.id || accountId || 'settings',
    selected,
    select: (id: string) => {
      writeStoredWaAccountId(id);
      setAccountId(id);
    },
  };
}

export default function WhatsAppAccountSwitch({ tone = 'light' }: { tone?: 'light' | 'sidebar' }) {
  const { accounts, accountId, select } = useWhatsAppAccount();
  const rows = accounts.length
    ? accounts
    : [{ id: 'settings', label: 'My FNG Autocare', display_phone: '+91 95949 96161', source: 'settings' }];

  if (tone === 'sidebar') {
    return (
      <div className="px-1 pb-2">
        <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-100/80">WhatsApp account</p>
        <div className="flex flex-wrap gap-1">
          {rows.map((account) => {
            const on = account.id === accountId || (account.source === 'settings' && accountId === 'settings');
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => select(account.id)}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${on ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'}`}
              >
                {account.display_phone || account.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Account</span>
      {rows.map((account) => {
        const on = account.id === accountId || (account.source === 'settings' && accountId === 'settings');
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => select(account.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
          >
            {account.display_phone || account.label}
          </button>
        );
      })}
    </div>
  );
}
