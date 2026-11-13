'use client';

import AgentEnvSettingsPanel from '@/app/dashboard/super_admin/bot-flow/components/AgentEnvSettingsPanel';
import WhatsAppAccountSwitch, { useWhatsAppAccount } from '@/components/whatsapp/WhatsAppAccountSwitch';

export default function WhatsAppSettingsPage() {
  const { accounts, selected } = useWhatsAppAccount();
  const viewing = selected?.display_phone || '+91 95949 96161';

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4 md:px-6 md:py-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">WhatsApp Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          The original number stays <span className="font-semibold text-emerald-700">+91 95949 96161</span>. Switch to the other connected number to see it here.
        </p>
        <div className="mt-3">
          <WhatsAppAccountSwitch />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((account) => {
          const on = account.id === (selected?.id || 'settings');
          return (
            <article key={account.id} className={`rounded-2xl border p-4 ${on ? 'border-emerald-300 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{account.source === 'settings' ? 'Default account' : 'Connected account'}</p>
              <p className={`mt-1 text-lg font-semibold ${on ? 'text-emerald-700' : 'text-slate-900'}`}>{account.display_phone || account.label}</p>
              <p className="text-sm text-slate-500">{account.verified_name || account.label}</p>
              {account.quality_rating ? <p className="mt-2 text-xs font-semibold text-slate-500">Quality {account.quality_rating}</p> : null}
            </article>
          );
        })}
      </div>
      {selected?.source === 'connected' ? (
        <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm text-slate-600">
          <span className="font-semibold text-emerald-700">{viewing}</span> is connected from Bulk WhatsApp. Its token is already saved. The form below is still the original +91 95949 96161 credential set.
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
          Credential form below belongs to <span className="font-semibold text-emerald-700">+91 95949 96161</span>.
        </div>
      )}
      <AgentEnvSettingsPanel />
    </div>
  );
}
