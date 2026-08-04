'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowRight, MapPin, Plus, Sparkles, X } from 'lucide-react';
import {
  formatAllowedPincodesInput,
  normalizePincode,
  parsePincodesInput,
  pincodePayloadFromMode,
  type PincodeRoutingMode,
} from '@/lib/enquiry/pincodeAllocation';

type Props = {
  telecallerName: string;
  pincodeMode: PincodeRoutingMode;
  allowedPincodes: string[] | null;
  onChange: (next: { pincode_mode: PincodeRoutingMode; allowed_pincodes: string[] | null }) => void;
};

export default function TelecallerPincodeEditor({
  telecallerName,
  pincodeMode,
  allowedPincodes,
  onChange,
}: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const mode = pincodeMode;
  const chips = mode === 'mapped' ? allowedPincodes || [] : [];

  const summary = useMemo(() => {
    if (mode === 'all') return 'All areas';
    if (mode === 'none') return 'No pincodes';
    return `${chips.length} pincode${chips.length === 1 ? '' : 's'}`;
  }, [mode, chips.length]);

  function applyChange(nextMode: PincodeRoutingMode, pincodes: string[] | null = allowedPincodes) {
    onChange(pincodePayloadFromMode(nextMode, pincodes));
  }

  function setMode(next: PincodeRoutingMode) {
    if (next === 'mapped') {
      applyChange('mapped', chips);
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    applyChange(next, next === 'all' ? null : []);
  }

  function startAddingPincodes() {
    setMode('mapped');
  }

  function addPincode(raw: string) {
    const pin = normalizePincode(raw);
    if (!pin) return;
    const base = mode === 'mapped' ? [...chips] : [];
    if (base.includes(pin)) return;
    applyChange('mapped', [...base, pin]);
    setDraft('');
  }

  function removePincode(pin: string) {
    const next = chips.filter((item) => item !== pin);
    applyChange('mapped', next);
  }

  function handlePaste(value: string) {
    const parsed = parsePincodesInput(value);
    if (parsed == null) {
      applyChange('all', null);
      return;
    }
    if (parsed.length === 0) {
      applyChange('none', []);
      return;
    }
    const merged = new Set([...chips, ...parsed]);
    applyChange('mapped', Array.from(merged));
    setDraft('');
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            <MapPin className="w-3 h-3" />
            Pincode zones
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-2">{telecallerName}</p>
          <p className="text-xs text-gray-600 mt-1 leading-5">
            Full booking / lead with pincode routes here first when mapped.
          </p>
        </div>
        <div className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2 text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Coverage</p>
          <p className="text-sm font-bold text-emerald-700">{summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(
          [
            { id: 'all' as const, label: 'All areas', hint: 'Any pincode' },
            { id: 'mapped' as const, label: 'Add pincodes', hint: '400604, 421201…' },
            { id: 'none' as const, label: 'Disabled', hint: 'No routing' },
          ] as const
        ).map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? 'border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-200'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/60'
              }`}
            >
              <div className="text-xs font-bold">{item.label}</div>
              <div className={`text-[10px] mt-0.5 ${active ? 'text-emerald-100' : 'text-gray-500'}`}>
                {item.hint}
              </div>
            </button>
          );
        })}
      </div>

      {mode === 'mapped' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-white p-3">
            <div className="flex flex-wrap gap-2 min-h-[42px]">
              {chips.length === 0 ? (
                <span className="text-xs text-gray-400 self-center">
                  Ab pincode type karke Enter dabao ya Add click karo
                </span>
              ) : (
                chips.map((pin) => (
                  <span
                    key={pin}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-1 text-xs font-bold"
                  >
                    <MapPin className="w-3 h-3" />
                    {pin}
                    <button
                      type="button"
                      onClick={() => removePincode(pin)}
                      className="rounded-full p-0.5 hover:bg-emerald-200"
                      aria-label={`Remove pincode ${pin}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addPincode(draft);
                  }
                }}
                placeholder="Type 6-digit pincode and press Enter"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                type="button"
                onClick={() => addPincode(draft)}
                disabled={draft.trim().length < 4}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-semibold text-gray-800">Bulk paste</p>
            </div>
            <textarea
              key={chips.join('|')}
              className="w-full min-h-[64px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="400604, 400601, 421201"
              defaultValue={formatAllowedPincodesInput(chips)}
              onBlur={(e) => handlePaste(e.target.value)}
            />
            <p className="text-[11px] text-gray-500 mt-2">
              Comma, space, or new line separated. Field se bahar click karte hi import ho jayega.
            </p>
          </div>
        </div>
      ) : null}

      {mode === 'all' ? (
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-4 space-y-3">
          <p className="text-sm text-gray-700 leading-6">
            <strong>All areas</strong> = koi specific pincode nahi. Lead kisi bhi pincode se aa sakti
            hai (jab tak kisi aur telecaller ne woh pincode map nahi kiya).
          </p>
          <button
            type="button"
            onClick={startAddingPincodes}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm"
          >
            Pincode add karo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {mode === 'none' ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
          This telecaller is excluded from pincode-based routing. Pincode add karne ke liye{' '}
          <button type="button" className="font-bold underline" onClick={startAddingPincodes}>
            Add pincodes
          </button>{' '}
          select karo.
        </div>
      ) : null}
    </div>
  );
}

export function telecallerPincodeBadge(
  pincodeMode: PincodeRoutingMode,
  allowedPincodes: string[] | null,
): {
  label: string;
  tone: 'all' | 'mapped' | 'none';
} {
  if (pincodeMode === 'all') return { label: 'All areas', tone: 'all' };
  if (pincodeMode === 'none') return { label: 'No pincodes', tone: 'none' };
  const count = allowedPincodes?.length || 0;
  return { label: count > 0 ? `${count} mapped` : 'Add pincodes', tone: 'mapped' };
}
