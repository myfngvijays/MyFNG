'use client';

import { useState, useCallback, useRef } from 'react';
import {
  User, Phone, Car, Calendar, MapPin, Loader2,
  ClipboardList, Factory, FileText, MessageSquare, Hash, ClipboardPaste, CheckCircle2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface FormData {
  phone_no: string;
  name: string;
  address: string;
  regdate: string;
  car_number: string;
  make: string;
  model: string;
  disposition: string;
  remark: string;
  dialer_id: string;
}

const emptyForm: FormData = {
  phone_no: '',
  name: '',
  address: '',
  regdate: '',
  car_number: '',
  make: '',
  model: '',
  disposition: '',
  remark: '',
  dialer_id: '',
};

export default function CRMPage() {
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [successPopup, setSuccessPopup] = useState<{ name: string; phone: string } | null>(null);

  const fetchByPhone = useCallback(async (phone: string) => {
    if (!/^\d{10}$/.test(phone)) return;

    setFetching(true);
    try {
      const res = await fetch(`/api/crm/enquiries?phone=${phone}`);
      const json = await res.json();

      if (json.success && json.data) {
        setFormData({
          phone_no: json.data.phone_no || phone,
          name: json.data.name || '',
          address: json.data.address || '',
          regdate: json.data.regdate || '',
          car_number: json.data.car_number || '',
          make: json.data.make || '',
          model: json.data.model || '',
          disposition: json.data.disposition || '',
          remark: json.data.remark || '',
          dialer_id: json.data.dialer_id || '',
        });
        setIsExisting(true);
        toast.success('Existing record found — details auto-filled');
      } else {
        setFormData((prev) => ({ ...emptyForm, phone_no: prev.phone_no }));
        setIsExisting(false);
      }
    } catch {
      // silently fail; user can still fill manually
    } finally {
      setFetching(false);
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.phone_no.trim()) {
      newErrors.phone_no = 'Contact number is required';
    } else if (!/^[6-9]\d{9}$/.test(formData.phone_no.trim())) {
      newErrors.phone_no = 'Enter a valid 10-digit mobile number';
    }
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.disposition) newErrors.disposition = 'Disposition is required';
    if (!formData.dialer_id) newErrors.dialer_id = 'Dialer ID is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const phoneInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (name === 'phone_no') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 10) fetchByPhone(digits);
    }
  };

  const handlePhonePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, '').slice(0, 10);
      if (digits) {
        setFormData((prev) => ({ ...prev, phone_no: digits }));
        setErrors((prev) => ({ ...prev, phone_no: '' }));
        if (digits.length === 10) fetchByPhone(digits);
      }
    } catch {
      toast.error('Clipboard access denied — please paste manually');
    }
  };

  const handlePhoneInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const digits = text.replace(/\D/g, '').slice(0, 10);
    if (digits) {
      e.preventDefault();
      setFormData((prev) => ({ ...prev, phone_no: digits }));
      setErrors((prev) => ({ ...prev, phone_no: '' }));
      if (digits.length === 10) fetchByPhone(digits);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/crm/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Submit failed');

      setSuccessPopup({ name: formData.name, phone: formData.phone_no });
      setFormData({ ...emptyForm });
      setIsExisting(false);
      setErrors({});
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-my/10 via-white to-brand-fng/10 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-primary/10 mb-3">
            <ClipboardList className="w-7 h-7 text-brand-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">CRM Enquiry</h1>
          <p className="text-text-body text-sm sm:text-base mt-1">
            Enter mobile number to auto-fetch or add a new enquiry
          </p>
        </div>

        {/* Form Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Phone Number — auto-fetch trigger */}
            <div>
              <label htmlFor="phone_no" className="label">Contact Number</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={phoneInputRef}
                    id="phone_no"
                    name="phone_no"
                    type="tel"
                    maxLength={10}
                    placeholder="Enter or paste mobile number"
                    value={formData.phone_no}
                    onChange={handleChange}
                    onPaste={handlePhoneInputPaste}
                    className={`input pl-10 pr-10 ${errors.phone_no ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fetching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-primary animate-spin" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePhonePaste}
                  className="inline-flex items-center gap-1.5 px-4 py-3 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary-hover transition shrink-0"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Paste
                </button>
              </div>
              {errors.phone_no && <p className="text-red-500 text-xs mt-1">{errors.phone_no}</p>}
              {isExisting && (
                <p className="text-green-600 text-xs mt-1 font-medium">Existing record loaded</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="label">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Car Number */}
            <div>
              <label htmlFor="car_number" className="label">Car Number</label>
              <div className="relative">
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="car_number"
                  name="car_number"
                  type="text"
                  placeholder="e.g. DL 01 AB 1234"
                  value={formData.car_number}
                  onChange={handleChange}
                  className="input pl-10 uppercase"
                />
              </div>
            </div>

            {/* Make & Model — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="make" className="label">Make</label>
                <div className="relative">
                  <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="make"
                    name="make"
                    type="text"
                    placeholder="e.g. Maruti, Hyundai"
                    value={formData.make}
                    onChange={handleChange}
                    className="input pl-10"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="model" className="label">Model</label>
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="model"
                    name="model"
                    type="text"
                    placeholder="e.g. Swift, Creta"
                    value={formData.model}
                    onChange={handleChange}
                    className="input pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Registration Date */}
            <div>
              <label htmlFor="regdate" className="label">Registration Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="regdate"
                  name="regdate"
                  type="date"
                  value={formData.regdate}
                  onChange={handleChange}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="label">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  placeholder="Enter full address"
                  value={formData.address}
                  onChange={handleChange}
                  className="input pl-10 resize-none"
                />
              </div>
            </div>

            {/* Disposition & Dialer ID — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="disposition" className="label">Disposition <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <select
                    id="disposition"
                    name="disposition"
                    value={formData.disposition}
                    onChange={handleChange}
                    className={`input pl-10 appearance-none bg-white ${errors.disposition ? 'border-red-500 focus:ring-red-500' : ''}`}
                  >
                    <option value="">Select Disposition</option>
                    <option value="Interested - Hot">Interested - Hot (Today/Tomorrow)</option>
                    <option value="Interested - Warm">Interested - Warm (3-7 Days)</option>
                    <option value="Interested - Cold">Interested - Cold (Within Month)</option>
                  </select>
                </div>
                {errors.disposition && <p className="text-red-500 text-xs mt-1">{errors.disposition}</p>}
              </div>
              <div>
                <label htmlFor="dialer_id" className="label">Dialer ID <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <select
                    id="dialer_id"
                    name="dialer_id"
                    value={formData.dialer_id}
                    onChange={handleChange}
                    className={`input pl-10 appearance-none bg-white ${errors.dialer_id ? 'border-red-500 focus:ring-red-500' : ''}`}
                  >
                    <option value="">Select Dialer ID</option>
                    <option value="4001">4001</option>
                    <option value="4002">4002</option>
                    <option value="4003">4003</option>
                    <option value="4004">4004</option>
                    <option value="4005">4005</option>
                    <option value="4006">4006</option>
                    <option value="4007">4007</option>
                    <option value="4008">4008</option>
                    <option value="4009">4009</option>
                    <option value="4010">4010</option>
                  </select>
                </div>
                {errors.dialer_id && <p className="text-red-500 text-xs mt-1">{errors.dialer_id}</p>}
              </div>
            </div>

            {/* Remark */}
            <div>
              <label htmlFor="remark" className="label">Remark</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  id="remark"
                  name="remark"
                  rows={2}
                  placeholder="Any additional remarks"
                  value={formData.remark}
                  onChange={handleChange}
                  className="input pl-10 resize-none"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full text-base sm:text-lg mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Enquiry'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Success Popup */}
      {successPopup && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 sm:p-8 text-center relative animate-fade-in-up">
            <button
              type="button"
              onClick={() => setSuccessPopup(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-1">Enquiry Submitted!</h2>
            <p className="text-sm text-gray-600 mb-4">
              Lead for <span className="font-semibold text-gray-800">{successPopup.name}</span> ({successPopup.phone}) has been saved and synced to TeleCRM.
            </p>

            <button
              type="button"
              onClick={() => setSuccessPopup(null)}
              className="btn btn-primary w-full"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
