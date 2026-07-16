'use client';

import { useRef, useState } from 'react';
import { CheckCircle, MapPin } from 'lucide-react';

const PIN_LENGTH = 6;

export function assistantAsksForPincode(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/booking summary|mobile number|otp|verify/i.test(t)) return false;
  return (
    /pin\s*code|6-digit pin|6 digit pin|postal code|area pin|your pin/i.test(t) ||
    (/pin/i.test(t) && /6.?digit|six.?digit|location|area|where/i.test(t))
  );
}

type Props = {
  onSubmit: (pincode: string) => void;
};

export function MisaPincodeInput({ onSubmit }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const value = digits.join('');
  const isValid = /^\d{6}$/.test(value);

  function updateDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);
    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && isValid) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = Array(PIN_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i];
    setDigits(next);
    setError(null);
    const focusIndex = Math.min(PIN_LENGTH - 1, pasted.length);
    setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
  }

  function handleSubmit() {
    if (!isValid) {
      setError('Valid 6-digit PIN code daalein');
      return;
    }
    onSubmit(value);
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand-primary/15 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
          <MapPin className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Enter your PIN code</p>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={`pin-${index}`}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => updateDigit(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`h-11 w-10 rounded-xl border-2 text-center text-lg font-bold outline-none transition sm:h-12 sm:w-11 ${
              isValid
                ? 'border-brand-primary bg-brand-primary/5 text-gray-900'
                : 'border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'
            }`}
          />
        ))}
      </div>

      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}

      {isValid && (
        <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-brand-primary">
          <CheckCircle className="h-4 w-4" />
          PIN: {value}
        </p>
      )}

      <button
        type="button"
        disabled={!isValid}
        onClick={handleSubmit}
        className="mt-4 w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isValid ? `Continue · ${value}` : 'Enter PIN code to continue'}
      </button>
    </div>
  );
}
