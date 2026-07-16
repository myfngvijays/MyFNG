'use client';

import { useState } from 'react';
import { User } from 'lucide-react';

export function assistantAsksForName(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/booking summary|registration number|vehicle number|car registration/i.test(t)) return false;
  return (
    /what'?s your name|your (full )?name|may i know your name|please share your name|tell me your name/i.test(t)
  );
}

type Props = {
  onSubmit: (name: string) => void;
};

export function MisaNameInput({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;

  return (
    <div className="mt-3 rounded-2xl border border-brand-primary/15 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
          <User className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-bold text-gray-800">Your name</p>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isValid) {
            e.preventDefault();
            onSubmit(trimmed);
          }
        }}
        placeholder="Full name"
        className="mt-3 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      />

      <button
        type="button"
        disabled={!isValid}
        onClick={() => onSubmit(trimmed)}
        className="mt-4 w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isValid ? `Continue · ${trimmed}` : 'Enter your name'}
      </button>
    </div>
  );
}
