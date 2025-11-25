'use client';

/**
 * Job Card & Parts Section
 * Manage job cards and parts list
 * Task: WA-701
 */

import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface JobCardSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface JobCard {
  id: string;
  job_card_number: string;
  labor_charges?: number;
  additional_work?: string;
  mechanic_notes?: string;
  created_at: string;
  updated_at?: string;
}

interface JobCardPart {
  id: string;
  part_name: string;
  part_number?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function JobCardSection({ lead, onUpdate }: JobCardSectionProps) {
  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [parts, setParts] = useState<JobCardPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Job card form
  const [laborCharges, setLaborCharges] = useState(0);
  const [additionalWork, setAdditionalWork] = useState('');
  const [mechanicNotes, setMechanicNotes] = useState('');
  
  // Part form
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  useEffect(() => {
    fetchJobCard();
  }, [lead.id]);

  async function fetchJobCard() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: jobCardData, error: jobCardError } = await supabase
        .from('job_cards')
        .select('*')
        .eq('lead_id', lead.id)
        .single();

      if (jobCardError && jobCardError.code !== 'PGRST116') {
        throw jobCardError;
      }

      setJobCard(jobCardData);

      if (jobCardData) {
        const { data: partsData } = await supabase
          .from('job_card_parts')
          .select('*')
          .eq('job_card_id', jobCardData.id)
          .order('created_at', { ascending: true });

        setParts(partsData || []);
      }
    } catch (error) {
      console.error('Error fetching job card:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createJobCard() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate job card number
      const jobCardNumber = `JC-${lead.lead_number}-${Date.now().toString().slice(-6)}`;

      const { data, error } = await supabase
        .from('job_cards')
        .insert({
          lead_id: lead.id,
          job_card_number: jobCardNumber,
          labor_charges: laborCharges,
          additional_work: additionalWork || null,
          mechanic_notes: mechanicNotes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'JOB_CARD_CREATED',
        event_description: `Job card ${jobCardNumber} created`,
        event_data: { job_card_id: data.id },
        created_by: user.id,
      });

      setJobCard(data);
      setShowCreateForm(false);
      alert('✅ Job card created successfully!');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error creating job card:', error);
      alert(`Failed to create job card: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function addPart() {
    if (!jobCard) return;
    if (!partName || quantity <= 0 || unitPrice < 0) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalPrice = quantity * unitPrice;

      const { error } = await supabase.from('job_card_parts').insert({
        job_card_id: jobCard.id,
        part_name: partName,
        part_number: partNumber || null,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      });

      if (error) throw error;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'PART_ADDED',
        event_description: `Part added: ${partName} (Qty: ${quantity})`,
        event_data: { part_name: partName, quantity, unit_price: unitPrice },
        created_by: user.id,
      });

      // Reset form
      setPartName('');
      setPartNumber('');
      setQuantity(1);
      setUnitPrice(0);

      alert('✅ Part added successfully!');
      fetchJobCard();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error adding part:', error);
      alert(`Failed to add part: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deletePart(partId: string) {
    if (!confirm('Are you sure you want to delete this part?')) return;

    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('job_card_parts')
        .delete()
        .eq('id', partId);

      if (error) throw error;

      alert('✅ Part deleted successfully!');
      fetchJobCard();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting part:', error);
      alert('Failed to delete part');
    }
  }

  const totalPartsCost = parts.reduce((sum, part) => sum + part.total_price, 0);

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-primary" />
        Job Card & Parts
      </h2>

      {loading && !jobCard ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : !jobCard ? (
        <div>
          {!showCreateForm ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 mb-4">No job card created yet</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4" />
                Create Job Card
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold">Create New Job Card</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labor Charges (₹) *
                </label>
                <input
                  type="number"
                  value={laborCharges}
                  onChange={(e) => setLaborCharges(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="100"
                  placeholder="e.g., 2000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Work (Optional)
                </label>
                <textarea
                  value={additionalWork}
                  onChange={(e) => setAdditionalWork(e.target.value)}
                  rows={2}
                  placeholder="Any additional work required..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mechanic Notes (Optional)
                </label>
                <textarea
                  value={mechanicNotes}
                  onChange={(e) => setMechanicNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any initial notes or observations..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createJobCard}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  <Save className="w-4 h-4" />
                  Create Job Card
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Job Card Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Job Card Number</p>
                <p className="font-semibold">{jobCard.job_card_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Labor Charges</p>
                <p className="font-semibold text-green-600">₹{jobCard.labor_charges?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-semibold">{new Date(jobCard.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Updated</p>
                <p className="font-semibold">
                  {jobCard.updated_at ? new Date(jobCard.updated_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            {jobCard.additional_work && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-sm text-gray-600">Additional Work</p>
                <p className="text-sm">{jobCard.additional_work}</p>
              </div>
            )}
            {jobCard.mechanic_notes && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-sm text-gray-600">Mechanic Notes</p>
                <p className="text-sm">{jobCard.mechanic_notes}</p>
              </div>
            )}
          </div>

          {/* Add Part Form */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-3">Add Part</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Name *</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="e.g., Brake Pad"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g., BP-123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹) *</label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value))}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <button
              onClick={addPart}
              disabled={loading}
              className="btn btn-primary mt-3"
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
          </div>

          {/* Parts List */}
          <div>
            <h3 className="font-semibold mb-3">Parts List ({parts.length})</h3>
            {parts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No parts added yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Part Name</th>
                      <th className="px-4 py-2 text-left">Part #</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Unit Price</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part) => (
                      <tr key={part.id} className="border-t border-gray-200">
                        <td className="px-4 py-2">{part.part_name}</td>
                        <td className="px-4 py-2 text-gray-600">{part.part_number || '-'}</td>
                        <td className="px-4 py-2 text-right">{part.quantity}</td>
                        <td className="px-4 py-2 text-right">₹{part.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold">₹{part.total_price.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => deletePart(part.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right">Total Parts Cost:</td>
                      <td className="px-4 py-2 text-right">₹{totalPartsCost.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

