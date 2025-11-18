'use client';

/**
 * Extra Charges Section
 * Request and approve additional charges
 * Task: WA-602
 */

import { useState, useEffect } from 'react';
import { DollarSign, Plus, CheckCircle, XCircle, Clock, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExtraChargesSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface ExtraCharge {
  id: string;
  charge_description: string;
  amount: number;
  reason: string;
  supporting_image_url?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_by: string;
  approved_by?: string;
  rejected_by?: string;
  created_at: string;
  requester?: { full_name: string };
  approver?: { full_name: string };
}

export default function ExtraChargesSection({ lead, onUpdate }: ExtraChargesSectionProps) {
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchExtraCharges();
  }, [lead.id]);

  async function fetchExtraCharges() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('lead_extra_charges')
        .select(`
          *,
          requester:requested_by(full_name),
          approver:approved_by(full_name)
        `)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExtraCharges(data || []);
    } catch (error) {
      console.error('Error fetching extra charges:', error);
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient();
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${lead.id}/extra-charges/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `lead-media/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('myfng-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('myfng-media')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async function handleAddCharge() {
    if (!description || amount <= 0 || !reason) {
      alert('Please fill in all required fields');
      return;
    }

    // If amount > 1000, image is required
    if (amount > 1000 && !imageFile) {
      alert('For charges above ₹1000, supporting image is required');
      return;
    }

    setUploading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase.from('lead_extra_charges').insert({
        lead_id: lead.id,
        charge_description: description,
        amount,
        reason,
        supporting_image_url: imageUrl,
        status: 'PENDING',
        requested_by: user.id,
      });

      if (error) throw error;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'EXTRA_CHARGE_REQUESTED',
        event_description: `Extra charge requested: ${description} - ₹${amount}`,
        event_data: { amount, description },
        created_by: user.id,
      });

      // Reset form
      setDescription('');
      setAmount(0);
      setReason('');
      setImageFile(null);
      setShowAddForm(false);

      alert('✅ Extra charge request submitted!');
      fetchExtraCharges();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error adding extra charge:', error);
      alert(`Failed to add extra charge: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleApproveReject(chargeId: string, action: 'APPROVED' | 'REJECTED') {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this charge?`)) return;

    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {
        status: action,
        [`${action.toLowerCase()}_by`]: user.id,
        [`${action.toLowerCase()}_at`]: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('lead_extra_charges')
        .update(updateData)
        .eq('id', chargeId);

      if (error) throw error;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: `EXTRA_CHARGE_${action}`,
        event_description: `Extra charge ${action.toLowerCase()}`,
        event_data: { charge_id: chargeId },
        created_by: user.id,
      });

      alert(`✅ Extra charge ${action.toLowerCase()} successfully!`);
      fetchExtraCharges();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Failed to ${action.toLowerCase()} charge: ${error.message}`);
    }
  }

  const totalPending = extraCharges
    .filter(c => c.status === 'PENDING')
    .reduce((sum, c) => sum + c.amount, 0);
  
  const totalApproved = extraCharges
    .filter(c => c.status === 'APPROVED')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-brand-primary" />
        Extra Charges Management
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-800">₹{totalPending.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-2xl font-bold text-green-800">₹{totalApproved.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">Total Requests</p>
          <p className="text-2xl font-bold text-blue-800">{extraCharges.length}</p>
        </div>
      </div>

      {/* Add Charge Button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary mb-4"
        >
          <Plus className="w-4 h-4" />
          Request Extra Charge
        </button>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h3 className="font-semibold mb-3">Request New Extra Charge</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Additional part replacement"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              {amount > 1000 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Charges above ₹1000 require supporting image
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explain why this extra charge is needed..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supporting Image {amount > 1000 && '*'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              {imageFile && (
                <p className="text-xs text-green-600 mt-1">✓ {imageFile.name}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddCharge}
                disabled={uploading}
                className="btn btn-primary"
              >
                {uploading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setDescription('');
                  setAmount(0);
                  setReason('');
                  setImageFile(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charges List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : extraCharges.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No extra charges requested yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {extraCharges.map((charge) => (
            <div
              key={charge.id}
              className={`p-4 rounded-lg border-2 ${
                charge.status === 'PENDING'
                  ? 'bg-yellow-50 border-yellow-300'
                  : charge.status === 'APPROVED'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{charge.charge_description}</h3>
                  <p className="text-2xl font-bold text-gray-800">₹{charge.amount.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      charge.status === 'PENDING'
                        ? 'bg-yellow-200 text-yellow-800'
                        : charge.status === 'APPROVED'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {charge.status === 'PENDING' && <Clock className="w-3 h-3" />}
                    {charge.status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
                    {charge.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                    {charge.status}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Reason:</span>
                  <p className="text-gray-600 mt-1">{charge.reason}</p>
                </div>
                
                {charge.supporting_image_url && (
                  <div>
                    <span className="font-medium text-gray-700 flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      Supporting Image:
                    </span>
                    <a
                      href={charge.supporting_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Image
                    </a>
                  </div>
                )}
                
                <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-300">
                  <span>
                    Requested by: {charge.requester?.full_name || 'Unknown'}
                  </span>
                  <span>
                    {new Date(charge.created_at).toLocaleString()}
                  </span>
                </div>

                {charge.status === 'APPROVED' && charge.approver && (
                  <div className="text-xs text-green-700">
                    Approved by: {charge.approver.full_name}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {charge.status === 'PENDING' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-300">
                  <button
                    onClick={() => handleApproveReject(charge.id, 'APPROVED')}
                    className="btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleApproveReject(charge.id, 'REJECTED')}
                    className="btn btn-sm bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

