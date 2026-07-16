'use client';

import { useRef, useState } from 'react';
import { Car, CheckCircle, Loader2 } from 'lucide-react';
import { isValidVehicleNumber, normalizeVehicleNumber } from '@/lib/chatbot_v2/vehicleNumber';

export function assistantAsksForVehicleNumber(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return (
    /registration number|vehicle number|car registration|car number/i.test(t) &&
    !/booking summary/i.test(t)
  );
}

type Props = {
  sessionId?: string;
  onContextPatch?: (patch: Record<string, unknown>) => void;
  onSave: (vehicleNumber: string) => void;
};

export function MisaVehicleNumberInput({ sessionId, onContextPatch, onSave }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const normalized = normalizeVehicleNumber(value);
  const isValid = isValidVehicleNumber(normalized);

  async function handleSave() {
    if (!isValid) {
      setError('Valid registration number daalein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (sessionId) {
        const res = await fetch('/api/chatbot/v2/verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_vehicle',
            session_id: sessionId,
            vehicle_number: normalized,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Could not save vehicle number');
        }
        if (json.contextPatch && onContextPatch) {
          onContextPatch(json.contextPatch);
        }
      }

      setSaved(true);
      onSave(normalized);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand-primary/15 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-md">
          <Car className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-bold text-gray-800">Car registration number</p>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value.toUpperCase());
          setError(null);
          setSaved(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isValid) {
            e.preventDefault();
            void handleSave();
          }
        }}
        placeholder="Enter vehicle number"
        autoCapitalize="characters"
        className={`mt-3 w-full rounded-xl border-2 px-4 py-3 text-base font-semibold uppercase tracking-wide outline-none transition ${
          saved
            ? 'border-green-500 bg-green-50 text-green-800'
            : 'border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'
        }`}
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {saved && (
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-green-600">
          <CheckCircle className="h-4 w-4" />
          Saved
        </p>
      )}

      <button
        type="button"
        disabled={!isValid || loading || saved}
        onClick={() => void handleSave()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}
