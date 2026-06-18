'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';

export type IconFieldValue = {
  icon?: string;
  icon_url?: string;
  icon_class?: string;
};

type Props = {
  value: IconFieldValue;
  onChange: (patch: Partial<IconFieldValue>) => void;
  onUpload?: (file: File) => Promise<void>;
  uploading?: boolean;
  ioniconsPlaceholder?: string;
  flaticonPlaceholder?: string;
};

export function MembershipIconPreview({
  icon,
  icon_url,
  icon_class,
  size = 20,
}: IconFieldValue & { size?: number }) {
  if (icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon_url} alt="" className="object-contain" style={{ width: size, height: size }} />
    );
  }
  if (icon_class) {
    return <i className={icon_class} style={{ fontSize: size, color: '#023D95', lineHeight: 1 }} aria-hidden />;
  }
  if (icon) {
    return <span className="text-[10px] font-bold text-[#023D95] uppercase">{icon.slice(0, 3)}</span>;
  }
  return <span className="text-[10px] text-gray-400">—</span>;
}

export default function MembershipIconField({
  value,
  onChange,
  onUpload,
  uploading = false,
  ioniconsPlaceholder = 'pricetag',
  flaticonPlaceholder = 'fi fi-rr-tags',
}: Props) {
  const [mode, setMode] = useState<'ionicons' | 'flaticon' | 'upload'>(() => {
    if (value.icon_url) return 'upload';
    if (value.icon_class) return 'flaticon';
    return 'ionicons';
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-600">Icon</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6F0FB] overflow-hidden shrink-0">
          <MembershipIconPreview {...value} size={18} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['ionicons', 'flaticon', 'upload'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              mode === m ? 'bg-[#023D95] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m === 'ionicons' ? 'Ionicons' : m === 'flaticon' ? 'Flaticon CSS' : 'Image URL'}
          </button>
        ))}
      </div>

      {mode === 'ionicons' ? (
        <>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            placeholder={ioniconsPlaceholder}
            value={value.icon || ''}
            onChange={(e) => onChange({ icon: e.target.value, icon_class: '', icon_url: '' })}
          />
          <p className="text-[10px] text-gray-500">Mobile app native icon name (Ionicons). Example: pricetag, car-sport</p>
        </>
      ) : null}

      {mode === 'flaticon' ? (
        <>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            placeholder={flaticonPlaceholder}
            value={value.icon_class || ''}
            onChange={(e) => onChange({ icon_class: e.target.value, icon: '', icon_url: '' })}
          />
          <p className="text-[10px] text-gray-500">
            Flaticon Uicons CSS class. Load stylesheet once, then use e.g.{' '}
            <code className="bg-gray-100 px-1 rounded">fi fi-rr-car</code>. For mobile app, also upload PNG or paste image URL.
          </p>
        </>
      ) : null}

      {mode === 'upload' ? (
        <>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="https://… or upload below"
            value={value.icon_url || ''}
            onChange={(e) => onChange({ icon_url: e.target.value, icon: '', icon_class: '' })}
          />
          {onUpload ? (
            <label className="inline-flex items-center justify-center gap-1 rounded-lg border bg-gray-50 px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-100 w-full">
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload icon image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />
            </label>
          ) : null}
          <p className="text-[10px] text-gray-500">Best for mobile app — PNG/SVG URL or upload</p>
        </>
      ) : null}
    </div>
  );
}
