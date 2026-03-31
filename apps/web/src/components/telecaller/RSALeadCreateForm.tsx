'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, UploadCloud, X } from 'lucide-react';

const SOURCES = [
  'Google Ads',
  'Instagram Ads',
  'WhatsApp',
  'Website',
  'App Booking',
  'Banner/Offline',
  'Reference',
  'Partner',
  'Other',
] as const;

const SERVICE_TYPES = [
  { value: 'flat_tire', label: 'Flat Tire' },
  { value: 'battery', label: 'Battery Jumpstart' },
  { value: 'fuel', label: 'Fuel Delivery' },
  { value: 'towing', label: 'Towing' },
  { value: 'key_lockout', label: 'Key Lockout' },
  { value: 'other', label: 'Other' },
] as const;

type FormState = {
  customer_name: string;
  contact_number: string;
  vehicle_number: string;
  vehicle_model: string;
  vehicle_details: string;
  source: string;
  location_link: string;
  drop_location: string;
  customer_quoted_amount: string;
  advance_payment: string;
  problem: string;
  alternate_number: string;
  service_type: string;
};

type CarModelSuggestion = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  vehicleClass: string | null;
};

function normalizeVehicleNumber(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}

function formatCarModelLabel(m: CarModelSuggestion) {
  const base = `${m.make} ${m.model}`.trim();
  return m.variant ? `${base} (${m.variant})` : base;
}

function normalizePhone10(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  // For India numbers pasted with +91/0/etc, keep last 10 digits.
  return digits.length <= 10 ? digits : digits.slice(-10);
}

export function RSALeadCreateForm({
  embedded = false,
  onCreated,
  onUpdated,
  onCancel,
  initialLead,
}: {
  embedded?: boolean;
  onCreated?: (id: string) => void;
  onUpdated?: (id: string) => void;
  onCancel?: () => void;
  initialLead?: {
    id: string;
    customer_name?: string;
    contact_number?: string;
    alternate_number?: string;
    vehicle_number?: string;
    vehicle_model?: string;
    source?: string;
    location_link?: string;
    drop_location?: string;
    customer_quoted_amount?: number | string;
    advance_payment?: string;
    problem?: string;
    service_type?: string;
    media_upload?: string[] | null;
  } | null;
}) {
  const router = useRouter();
  const isEditMode = Boolean(initialLead?.id);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [form, setForm] = useState<FormState>({
    customer_name: '',
    contact_number: '',
    vehicle_number: '',
    vehicle_model: '',
    vehicle_details: '',
    source: '',
    location_link: '',
    drop_location: '',
    customer_quoted_amount: '',
    advance_payment: '',
    problem: '',
    alternate_number: '',
    service_type: '',
  });

  const [carModelQuery, setCarModelQuery] = useState('');
  const [carModelLoading, setCarModelLoading] = useState(false);
  const [carModelSuggestions, setCarModelSuggestions] = useState<CarModelSuggestion[]>([]);
  const [carModelOpen, setCarModelOpen] = useState(false);

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const previews = useMemo(() => mediaFiles.map((f) => URL.createObjectURL(f)), [mediaFiles]);
  const remainingMediaSlots = Math.max(0, 5 - existingMediaUrls.length);

  useEffect(() => {
    if (initialLead?.id) {
      const L = initialLead;
      setForm({
        customer_name: String(L.customer_name ?? '').trim(),
        contact_number: String(L.contact_number ?? '').replace(/\D/g, '').slice(-10),
        vehicle_number: String(L.vehicle_number ?? '').trim(),
        vehicle_model: String(L.vehicle_model ?? '').trim(),
        vehicle_details: '',
        source: String(L.source ?? '').trim(),
        location_link: String(L.location_link ?? '').trim(),
        drop_location: String(L.drop_location ?? '').trim(),
        customer_quoted_amount: L.customer_quoted_amount != null ? String(L.customer_quoted_amount) : '',
        advance_payment: String(L.advance_payment ?? '').trim(),
        problem: String(L.problem ?? '').trim(),
        alternate_number: String(L.alternate_number ?? '').replace(/\D/g, '').slice(-10),
        service_type: String(L.service_type ?? '').trim(),
      });
      setCarModelQuery(String(L.vehicle_model ?? '').trim());
      setExistingMediaUrls(Array.isArray(L.media_upload) ? L.media_upload.filter(Boolean) : []);
    } else {
      setExistingMediaUrls([]);
    }
    setMediaFiles([]);
  }, [initialLead?.id]);

  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((p) => ({ ...p, [key]: value }));
    };

  const onPickMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxSelectable = Math.max(0, remainingMediaSlots);
    const next = [...mediaFiles, ...files].slice(0, maxSelectable);
    setMediaFiles(next);
    e.target.value = '';
  };

  const removeMedia = (idx: number) => {
    setMediaFiles((p) => p.filter((_, i) => i !== idx));
  };

  const validate = () => {
    setErrorMessage('');
    const name = form.customer_name.trim();
    const phone = form.contact_number.replace(/\D/g, '');
    const service = form.service_type.trim();

    if (!name) return 'Customer Name is required';
    if (!phone || phone.length < 10) return 'Valid 10-digit Phone Number is required';
    if (!service) return 'Service Type is required';
    if (service.toLowerCase() === 'towing' && !form.drop_location.trim()) {
      return 'Drop Location is required for Towing';
    }
    if (existingMediaUrls.length + mediaFiles.length > 5) return 'Maximum 5 images allowed';
    return '';
  };

  useEffect(() => {
    const q = carModelQuery.trim();
    if (q.length < 2) {
      setCarModelSuggestions([]);
      setCarModelLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      setCarModelLoading(true);
      try {
        const res = await fetch(`/api/car-models/search?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to search car models');
        setCarModelSuggestions(Array.isArray(json?.models) ? (json.models as CarModelSuggestion[]) : []);
      } catch {
        setCarModelSuggestions([]);
      } finally {
        setCarModelLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [carModelQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    const msg = validate();
    if (msg) {
      setErrorMessage(msg);
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && initialLead?.id) {
        const fd = new FormData();
        fd.append('customer_name', form.customer_name);
        fd.append('contact_number', form.contact_number);
        fd.append('vehicle_number', form.vehicle_number);
        fd.append('vehicle_model', form.vehicle_model);
        fd.append('vehicle_details', form.vehicle_details);
        fd.append('source', form.source);
        fd.append('location_link', form.location_link);
        fd.append('drop_location', form.drop_location);
        fd.append('customer_quoted_amount', form.customer_quoted_amount || '');
        fd.append('advance_payment', form.advance_payment || '');
        fd.append('problem', form.problem || '');
        fd.append('description', form.problem || '');
        fd.append('alternate_number', form.alternate_number || '');
        fd.append('service_type', form.service_type || '');
        mediaFiles.forEach((f) => fd.append('media', f));

        const res = await fetch(`/api/telecaller/rsa-complaints/${encodeURIComponent(initialLead.id)}`, {
          method: 'PATCH',
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to update RSA lead');
        }
        setMediaFiles([]);
        setSuccessMessage('RSA lead updated successfully.');
        if (json?.id) onUpdated?.(String(json.id));
      } else {
        const fd = new FormData();
        fd.append('customer_name', form.customer_name);
        fd.append('contact_number', form.contact_number);
        fd.append('vehicle_number', form.vehicle_number);
        fd.append('vehicle_model', form.vehicle_model);
        fd.append('vehicle_details', form.vehicle_details);
        fd.append('source', form.source);
        fd.append('location_link', form.location_link);
        fd.append('drop_location', form.drop_location);
        fd.append('customer_quoted_amount', form.customer_quoted_amount);
        fd.append('advance_payment', form.advance_payment);
        fd.append('problem', form.problem);
        fd.append('alternate_number', form.alternate_number);
        fd.append('service_type', form.service_type);

        mediaFiles.forEach((f) => fd.append('media', f));

        const res = await fetch('/api/telecaller/rsa-complaints', {
          method: 'POST',
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to create RSA lead');
        }

        setSuccessMessage(`RSA lead created successfully. ID: ${json?.id}`);
        setForm({
          customer_name: '',
          contact_number: '',
          vehicle_number: '',
          vehicle_model: '',
          vehicle_details: '',
          source: '',
          location_link: '',
          drop_location: '',
          customer_quoted_amount: '',
          advance_payment: '',
          problem: '',
          alternate_number: '',
          service_type: '',
        });
        setCarModelQuery('');
        setCarModelSuggestions([]);
        setCarModelOpen(false);
        setMediaFiles([]);

        if (json?.id) onCreated?.(String(json.id));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) return onCancel();
    router.push('/dashboard/telecaller');
  };

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 sm:space-y-5 md:space-y-6'}>
      {successMessage ? (
        <div className="bg-green-50 border border-green-200 text-green-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="font-medium text-sm sm:text-base">{successMessage}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="font-medium text-sm sm:text-base">{errorMessage}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="card space-y-4 sm:space-y-5 md:space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              className="input text-sm"
              placeholder="Enter customer name"
              value={form.customer_name}
              onChange={update('customer_name')}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              className="input text-sm"
              placeholder="Enter phone number"
              value={form.contact_number}
              onChange={(e) => {
                const next = normalizePhone10(e.target.value);
                setForm((p) => ({ ...p, contact_number: next }));
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData?.getData('text') || '';
                const next = normalizePhone10(text);
                setForm((p) => ({ ...p, contact_number: next }));
              }}
              inputMode="numeric"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
              Car Number (optional)
            </label>
            <input
              className="input text-sm"
              placeholder="e.g. MH12AB1234"
              value={form.vehicle_number}
              onChange={(e) => {
                const v = normalizeVehicleNumber(e.target.value);
                setForm((p) => ({ ...p, vehicle_number: v }));
              }}
            />
          </div>

          <div className="relative">
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
              Car Model (optional)
            </label>
            <input
              className="input text-sm"
              placeholder="Type to search car model (make/model)"
              value={carModelQuery}
              onChange={(e) => {
                const v = e.target.value;
                setCarModelQuery(v);
                setCarModelOpen(true);
                // If user is typing manually, clear stored value unless it exactly matches.
                setForm((p) => ({ ...p, vehicle_model: '' }));
              }}
              onFocus={() => setCarModelOpen(true)}
              onBlur={() => {
                // allow click selection from dropdown
                setTimeout(() => setCarModelOpen(false), 120);
              }}
            />
            <div className="mt-1 text-[10px] sm:text-xs text-gray-500">
              {carModelLoading ? 'Searching…' : form.vehicle_model ? `Selected: ${form.vehicle_model}` : ''}
            </div>

            {carModelOpen && (carModelLoading || carModelSuggestions.length > 0) ? (
              <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {carModelLoading ? (
                  <div className="p-3 text-xs sm:text-sm text-gray-600">Searching…</div>
                ) : (
                  <div className="max-h-56 overflow-auto">
                    {carModelSuggestions.map((m) => {
                      const label = formatCarModelLabel(m);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs sm:text-sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm((p) => ({ ...p, vehicle_model: label }));
                            setCarModelQuery(label);
                            setCarModelOpen(false);
                          }}
                        >
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500">
                            {m.vehicleClass ? `Class: ${m.vehicleClass}` : ' '}
                          </div>
                        </button>
                      );
                    })}
                    {carModelSuggestions.length === 0 ? (
                      <div className="p-3 text-xs sm:text-sm text-gray-600">No matches.</div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
              Vehicle Details (optional)
            </label>
            <textarea
              className="input text-sm"
              placeholder="Optional: color, variant, any extra details"
              rows={3}
              value={form.vehicle_details}
              onChange={update('vehicle_details')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Source</label>
              <select className="input text-sm" value={form.source} onChange={update('source')}>
                <option value="">Select Source</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Location Link</label>
              <input
                className="input text-sm"
                placeholder="Enter location link or coordinates"
                value={form.location_link}
                onChange={update('location_link')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Customer Quoted Amount</label>
              <input
                className="input text-sm"
                placeholder="Enter quoted amount"
                value={form.customer_quoted_amount}
                onChange={update('customer_quoted_amount')}
                inputMode="decimal"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Advance Payment</label>
              <input
                className="input text-sm"
                placeholder="Enter advance payment amount"
                value={form.advance_payment}
                onChange={update('advance_payment')}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Upload Media</label>
            <div className="border-2 border-dashed rounded-lg p-4 sm:p-5 bg-white">
              {isEditMode && existingMediaUrls.length > 0 ? (
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-2">Already uploaded ({existingMediaUrls.length}/5)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {existingMediaUrls.map((url, idx) => (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative border rounded-lg overflow-hidden block"
                        title="Open media"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Existing media ${idx + 1}`} className="w-full h-24 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <UploadCloud className="w-6 h-6 text-gray-500" />
                <div className="text-xs sm:text-sm text-gray-600">
                  Click to upload images (Max 5 files)
                  {isEditMode ? ` • Remaining: ${Math.max(0, remainingMediaSlots - mediaFiles.length)}` : ''}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickMedia}
                  disabled={remainingMediaSlots <= 0 || mediaFiles.length >= remainingMediaSlots}
                />
              </div>

              {mediaFiles.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {mediaFiles.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="relative border rounded-lg overflow-hidden">
                      <img src={previews[idx]} alt={f.name} className="w-full h-24 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                        title="Remove"
                        aria-label="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Description</label>
            <textarea
              className="input text-sm"
              placeholder="Describe the problem in detail"
              rows={4}
              value={form.problem}
              onChange={update('problem')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Alternate Number</label>
              <input
                className="input text-sm"
                placeholder="Enter alternate number"
                value={form.alternate_number}
                onChange={(e) => {
                  const next = normalizePhone10(e.target.value);
                  setForm((p) => ({ ...p, alternate_number: next }));
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData?.getData('text') || '';
                  const next = normalizePhone10(text);
                  setForm((p) => ({ ...p, alternate_number: next }));
                }}
                inputMode="numeric"
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select className="input text-sm" value={form.service_type} onChange={update('service_type')}>
                <option value="">Select Service Type</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {String(form.service_type || '').toLowerCase() === 'towing' ? (
                <div className="mt-3">
                  <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">
                    Drop Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input text-sm"
                    placeholder="Enter drop location / address"
                    value={form.drop_location}
                    onChange={update('drop_location')}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t gap-3">
          <button type="button" className="btn btn-outline text-xs sm:text-sm px-4 py-2" onClick={handleCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary text-xs sm:text-sm px-4 py-2 flex items-center gap-2" disabled={loading}>
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : isEditMode ? 'Update lead' : 'Create RSA lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

