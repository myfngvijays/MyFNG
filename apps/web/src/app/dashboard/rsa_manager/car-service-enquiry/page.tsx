'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';
import { formatDateTimeIST } from '@/lib/utils';

type CarEnquiry = {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone_raw: string | null;
  customer_phone_norm: string | null;
  car_model: string | null;
  remark: string | null;
  external_status: number | null;
  external_error: string | null;
};

export default function RSAManagerCarServiceEnquiryPage() {
  const [carForm, setCarForm] = useState({
    customer_name: '',
    customer_phone: '',
    car_model: '',
    remark: '',
  });
  const [carSubmitLoading, setCarSubmitLoading] = useState(false);
  const [carSubmitError, setCarSubmitError] = useState('');
  const [carSubmitSuccess, setCarSubmitSuccess] = useState('');
  const [carViewOpen, setCarViewOpen] = useState(false);
  const [carViewLoading, setCarViewLoading] = useState(false);
  const [carViewError, setCarViewError] = useState('');
  const [carEnquiries, setCarEnquiries] = useState<CarEnquiry[]>([]);
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');

  const openWhatsAppPreview = (phone: string | null | undefined) => {
    const value = String(phone || '').trim();
    if (!value) return;
    setWaPreviewPhone(value);
    setWaPreviewOpen(true);
  };

  const fetchCarEnquiries = async () => {
    setCarViewLoading(true);
    setCarViewError('');
    try {
      const res = await fetch('/api/rsa_manager/car-service-enquiries?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load enquiries');
      setCarEnquiries(Array.isArray(json?.enquiries) ? json.enquiries : []);
    } catch (e: any) {
      setCarViewError(e?.message || 'Failed to load enquiries');
      setCarEnquiries([]);
    } finally {
      setCarViewLoading(false);
    }
  };

  const submitCarEnquiry = async () => {
    setCarSubmitLoading(true);
    setCarSubmitError('');
    setCarSubmitSuccess('');
    try {
      const res = await fetch('/api/rsa_manager/car-service-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: carForm.customer_name,
          customer_phone: carForm.customer_phone,
          car_model: carForm.car_model,
          remark: carForm.remark,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to submit enquiry');
      setCarSubmitSuccess('Enquiry submitted successfully.');
      setCarForm({ customer_name: '', customer_phone: '', car_model: '', remark: '' });
      if (carViewOpen) {
        fetchCarEnquiries();
      }
    } catch (e: any) {
      setCarSubmitError(e?.message || 'Failed to submit enquiry');
    } finally {
      setCarSubmitLoading(false);
    }
  };

  return (
    <DashboardLayout role="rsa_manager">
      <div className="w-full min-w-0 max-w-7xl mx-auto">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-bold text-text-heading">Create Car Service Enquiry</h2>
          </div>

          {carSubmitError ? (
            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3">
              {carSubmitError}
            </div>
          ) : null}
          {carSubmitSuccess ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm mb-3">
              {carSubmitSuccess}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Customer Name</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="text"
                placeholder="Name"
                value={carForm.customer_name}
                onChange={(e) => setCarForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Phone</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="text"
                placeholder="Phone"
                value={carForm.customer_phone}
                onChange={(e) => setCarForm((f) => ({ ...f, customer_phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Car Model</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="text"
                placeholder="Car model"
                value={carForm.car_model}
                onChange={(e) => setCarForm((f) => ({ ...f, car_model: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Remark</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="text"
                placeholder="Remark"
                value={carForm.remark}
                onChange={(e) => setCarForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              className="btn btn-primary text-xs px-4 py-2"
              onClick={submitCarEnquiry}
              disabled={carSubmitLoading}
            >
              {carSubmitLoading ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              className="btn btn-outline text-xs px-4 py-2"
              onClick={() => {
                const next = !carViewOpen;
                setCarViewOpen(next);
                if (next && carEnquiries.length === 0) fetchCarEnquiries();
              }}
            >
              {carViewOpen ? 'Hide' : 'View'}
            </button>
          </div>
        </div>

        {carViewOpen ? (
          <div className="card mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Submitted Enquiries</h2>
                <div className="text-xs text-gray-500">
                  Showing {carEnquiries.length} {carViewLoading ? '(loading...)' : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={fetchCarEnquiries}
                disabled={carViewLoading}
              >
                Refresh
              </button>
            </div>

            {carViewError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                {carViewError}
              </div>
            ) : null}

            {carEnquiries.length === 0 ? (
              <div className="text-sm text-gray-600 py-6 text-center">No enquiries found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Phone</th>
                      <th className="py-2 pr-3">Car Model</th>
                      <th className="py-2 pr-3">Remark</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carEnquiries.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">{formatDateTimeIST(row.created_at)}</td>
                        <td className="py-2 pr-3 font-semibold">{row.customer_name || '—'}</td>
                        <td className="py-2 pr-3">
                          {row.customer_phone_raw || row.customer_phone_norm ? (
                            <button
                              type="button"
                              className="text-green-700 hover:text-green-800 underline underline-offset-2"
                              onClick={() => openWhatsAppPreview(row.customer_phone_raw || row.customer_phone_norm)}
                            >
                              {row.customer_phone_raw || row.customer_phone_norm}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 pr-3">{row.car_model || '—'}</td>
                        <td className="py-2 pr-3">{row.remark || '—'}</td>
                        <td className="py-2 pr-3">
                          {row.external_error ? (
                            <span className="text-red-700">Failed</span>
                          ) : row.external_status ? (
                            <span className="text-green-700">Success</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
        <WhatsAppMobilePreviewModal
          isOpen={waPreviewOpen}
          phoneNumber={waPreviewPhone}
          title="WhatsApp Chat"
          onClose={() => setWaPreviewOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
