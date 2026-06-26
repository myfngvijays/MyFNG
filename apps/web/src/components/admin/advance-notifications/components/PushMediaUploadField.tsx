'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';

type UploadKind = 'icon' | 'banner';

type Props = {
  label: string;
  hint: string;
  sizeHint: string;
  value: string;
  onChange: (url: string) => void;
  kind: UploadKind;
  placeholder?: string;
  compact?: boolean;
};

export default function PushMediaUploadField({
  label,
  hint,
  sizeHint,
  value,
  onChange,
  kind,
  placeholder = 'https://...',
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState('');

  const previewUrl = localPreview || value;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      fd.append('title', file.name.replace(/\.[^.]+$/, '') || kind);

      const res = await fetch('/api/super_admin/notifications/upload-image', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join(' — ');
        throw new Error(msg || `Upload failed (${res.status})`);
      }

      onChange(String(json.image_url || ''));
      setLocalPreview('');
      toast.success(kind === 'icon' ? 'App icon uploaded' : 'Notification image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onFilePick = (file: File | null) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    void handleUpload(file);
  };

  const clearValue = () => {
    onChange('');
    setLocalPreview('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="push-label mb-0">{label}</label>

      {kind === 'icon' ? (
        <div className="flex items-start gap-3">
          <div className="push-icon-upload-preview shrink-0">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-blue-600">M</span>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : ''}`}>
              <input
                type="url"
                value={value}
                onChange={(e) => {
                  setLocalPreview('');
                  onChange(e.target.value);
                }}
                placeholder={placeholder}
                className="push-input flex-1 min-w-0"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="push-btn-secondary inline-flex items-center justify-center gap-1.5 shrink-0 px-3 py-2 text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
              {value || localPreview ? (
                <button
                  type="button"
                  onClick={clearValue}
                  className="push-btn-ghost inline-flex items-center justify-center px-2 py-2 shrink-0"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
            <p className="push-hint mb-0">{hint}</p>
            <p className="push-size-spec mb-0">{sizeHint}</p>
          </div>
        </div>
      ) : (
        <>
          <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : ''}`}>
            <div className="push-input-icon-wrap shrink-0">
              <ImageIcon className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="url"
              value={value}
              onChange={(e) => {
                setLocalPreview('');
                onChange(e.target.value);
              }}
              placeholder={placeholder}
              className="push-input flex-1 min-w-0"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="push-btn-secondary inline-flex items-center justify-center gap-1.5 shrink-0 px-3 py-2 text-sm disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
            {value || localPreview ? (
              <button
                type="button"
                onClick={clearValue}
                className="push-btn-ghost inline-flex items-center justify-center px-2 py-2 shrink-0"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          {previewUrl ? (
            <div className="push-banner-upload-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}
          <p className="push-hint mb-0">{hint}</p>
          <p className="push-size-spec mb-0">{sizeHint}</p>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFilePick(e.target.files?.[0] || null)}
      />
    </div>
  );
}
