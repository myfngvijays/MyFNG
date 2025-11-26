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
  labor_charges: number;
  additional_work: string | null;
  mechanic_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface JobCardPart {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function JobCardSection({ lead, onUpdate }: JobCardSectionProps) {
  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [parts, setParts] = useState<JobCardPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Form fields
  const [laborCharges, setLaborCharges] = useState(0);
  const [additionalWork, setAdditionalWork] = useState('');
  const [mechanicNotes, setMechanicNotes] = useState('');
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
      // First, check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setJobCard(null);
        setParts([]);
        setLoading(false);
        return;
      }

      const { data: jobCardData, error: jobCardError } = await supabase
        .from('job_cards')
        .select('*')
        .eq('lead_id', lead.id)
        .maybeSingle();

      // Handle 406 (Not Acceptable) - RLS or permission issue
      if (jobCardError) {
        if (jobCardError.code === 'PGRST116') {
          // No rows returned - job card doesn't exist yet, that's OK
          setJobCard(null);
          setParts([]);
          setLoading(false);
          return;
        }
        
        if ((jobCardError as any).status === 406 || jobCardError.message?.includes('406')) {
          // RLS blocking access
          setJobCard(null);
          setParts([]);
          setLoading(false);
          return;
        }
        
        // Other errors
        console.error('Error fetching job card:', jobCardError);
        setJobCard(null);
        setParts([]);
        setLoading(false);
        return;
      }

      if (jobCardData) {
        setJobCard(jobCardData);
        setLaborCharges(parseFloat(jobCardData.labor_charges || '0'));
        setAdditionalWork(jobCardData.additional_work || '');
        setMechanicNotes(jobCardData.mechanic_notes || '');

        // Fetch parts
        const { data: partsData, error: partsError } = await supabase
          .from('job_card_parts')
          .select('*')
          .eq('job_card_id', jobCardData.id)
          .order('created_at', { ascending: true });

        if (partsError) {
          console.error('Error fetching parts:', partsError);
          setParts([]);
        } else {
          setParts(partsData || []);
        }
      } else {
        setJobCard(null);
        setParts([]);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setJobCard(null);
      setParts([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveJobCard() {
    if (!jobCard) return;
    
    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('job_cards')
        .update({
          labor_charges: laborCharges,
          additional_work: additionalWork || null,
          mechanic_notes: mechanicNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobCard.id);

      if (error) {
        console.error('Error updating job card:', error);
        alert('Failed to save job card: ' + error.message);
        return;
      }

      setEditing(false);
      fetchJobCard();
      onUpdate?.();
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Failed to save job card');
    } finally {
      setSaving(false);
    }
  }

  async function addPart() {
    if (!partName || !jobCard) return;

    const totalPrice = quantity * unitPrice;
    setSaving(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('job_card_parts')
        .insert({
          job_card_id: jobCard.id,
          part_name: partName,
          part_number: partNumber || null,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding part:', error);
        alert('Failed to add part: ' + error.message);
        return;
      }

      setParts([...parts, data]);
      setPartName('');
      setPartNumber('');
      setQuantity(1);
      setUnitPrice(0);
      onUpdate?.();
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Failed to add part');
    } finally {
      setSaving(false);
    }
  }

  async function deletePart(partId: string) {
    if (!confirm('Are you sure you want to delete this part?')) return;

    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('job_card_parts')
        .delete()
        .eq('id', partId);

      if (error) {
        console.error('Error deleting part:', error);
        alert('Failed to delete part: ' + error.message);
        return;
      }

      setParts(parts.filter(p => p.id !== partId));
      onUpdate?.();
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Failed to delete part');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Job Card</h3>
        </div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Job Card</h3>
        </div>
        <p className="text-gray-500">No job card found for this lead.</p>
      </div>
    );
  }

  const totalPartsCost = parts.reduce((sum, part) => sum + parseFloat(part.total_price.toString()), 0);
  const totalCost = laborCharges + totalPartsCost;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Job Card</h3>
          <span className="text-sm text-gray-500">#{jobCard.job_card_number}</span>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Labor Charges (₹)
            </label>
            <input
              type="number"
              value={laborCharges}
              onChange={(e) => setLaborCharges(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Work
            </label>
            <textarea
              value={additionalWork}
              onChange={(e) => setAdditionalWork(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mechanic Notes
            </label>
            <textarea
              value={mechanicNotes}
              onChange={(e) => setMechanicNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveJobCard}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                fetchJobCard();
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Labor Charges</p>
              <p className="text-lg font-semibold">₹{laborCharges.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Parts Cost</p>
              <p className="text-lg font-semibold">₹{totalPartsCost.toFixed(2)}</p>
            </div>
          </div>

          {additionalWork && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Additional Work</p>
              <p className="text-gray-700">{additionalWork}</p>
            </div>
          )}

          {mechanicNotes && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Mechanic Notes</p>
              <p className="text-gray-700">{mechanicNotes}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">Total Cost</p>
            <p className="text-2xl font-bold text-blue-600">₹{totalCost.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Parts Section */}
      <div className="mt-6 border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold">Parts Used</h4>
          {editing && (
            <button
              onClick={addPart}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Part
            </button>
          )}
        </div>

        {editing && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Part Name"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Part Number"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="number"
                placeholder="Unit Price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={addPart}
                disabled={!partName || saving}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {parts.length === 0 ? (
          <p className="text-gray-500 text-sm">No parts added yet.</p>
        ) : (
          <div className="space-y-2">
            {parts.map((part) => (
              <div
                key={part.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{part.part_name}</p>
                  {part.part_number && (
                    <p className="text-sm text-gray-500">Part #: {part.part_number}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Qty: {part.quantity} × ₹{parseFloat(part.unit_price.toString()).toFixed(2)} = ₹{parseFloat(part.total_price.toString()).toFixed(2)}
                  </p>
                </div>
                {editing && (
                  <button
                    onClick={() => deletePart(part.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
