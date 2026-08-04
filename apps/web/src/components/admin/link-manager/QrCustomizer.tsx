'use client';

import { useRef } from 'react';
import { ImagePlus, Palette, Trash2 } from 'lucide-react';
import {
  DEFAULT_QR_STYLE,
  MYFNG_LOGO_URL,
  QR_COLOR_PRESETS,
  type QrStyleOptions,
} from '@/lib/link-manager/qr-types';

const MAX_LOGO_BYTES = 300_000;

export default function QrCustomizer({
  value,
  onChange,
}: {
  value: QrStyleOptions;
  onChange: (next: QrStyleOptions) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  function patch(partial: Partial<QrStyleOptions>) {
    onChange({ ...value, ...partial });
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_LOGO_BYTES) {
      alert('Logo must be under 300 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({
        logo_data_url: String(reader.result || ''),
        logo_url: null,
        error_correction: 'auto',
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Palette className="w-4 h-4 text-violet-600" />
          QR customization
        </p>
        <p className="text-xs text-gray-500 mt-1">Logo, brand colors, and scan-safe styling</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Color presets</p>
        <div className="flex flex-wrap gap-2">
          {QR_COLOR_PRESETS.map((preset) => {
            const active = value.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  patch({
                    preset: preset.id,
                    dark_color: preset.dark,
                    light_color: preset.light,
                  })
                }
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active ? 'border-violet-600 bg-white text-violet-700' : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <span className="inline-flex overflow-hidden rounded-full border">
                  <span className="w-3 h-3" style={{ background: preset.dark }} />
                  <span className="w-3 h-3" style={{ background: preset.light }} />
                </span>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">QR color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.dark_color || DEFAULT_QR_STYLE.dark_color}
              onChange={(e) => patch({ dark_color: e.target.value, preset: 'custom' })}
              className="h-10 w-12 rounded border cursor-pointer"
            />
            <input
              value={value.dark_color || ''}
              onChange={(e) => patch({ dark_color: e.target.value, preset: 'custom' })}
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Background</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.light_color || DEFAULT_QR_STYLE.light_color}
              onChange={(e) => patch({ light_color: e.target.value, preset: 'custom' })}
              className="h-10 w-12 rounded border cursor-pointer"
            />
            <input
              value={value.light_color || ''}
              onChange={(e) => patch({ light_color: e.target.value, preset: 'custom' })}
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Center logo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"
          >
            <ImagePlus className="w-3.5 h-3.5" /> Upload logo
          </button>
          <button
            type="button"
            onClick={() =>
              patch({
                logo_url: MYFNG_LOGO_URL,
                logo_data_url: null,
                error_correction: 'auto',
              })
            }
            className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold"
          >
            Use MyFNG logo
          </button>
          {(value.logo_data_url || value.logo_url) ? (
            <button
              type="button"
              onClick={() => patch({ logo_data_url: null, logo_url: null, error_correction: 'auto' })}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          ) : null}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0] || null)} />
        {(value.logo_data_url || value.logo_url) ? (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={value.logo_data_url || value.logo_url || ''}
              alt="Logo preview"
              className="w-10 h-10 rounded-lg border bg-white object-contain p-1"
            />
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Logo size ({value.logo_size_percent || 22}%)</label>
              <input
                type="range"
                min={12}
                max={30}
                value={value.logo_size_percent || 22}
                onChange={(e) => patch({ logo_size_percent: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Margin</label>
          <select
            value={String(value.margin || 2)}
            onChange={(e) => patch({ margin: Number(e.target.value) })}
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Error correction</label>
          <select
            value={value.error_correction || 'auto'}
            onChange={(e) => patch({ error_correction: e.target.value as QrStyleOptions['error_correction'] })}
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="auto">Auto (H with logo)</option>
            <option value="L">Low (L)</option>
            <option value="M">Medium (M)</option>
            <option value="Q">Quartile (Q)</option>
            <option value="H">High (H)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
