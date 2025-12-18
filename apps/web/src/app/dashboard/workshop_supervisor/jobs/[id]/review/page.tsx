'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime } from '@/lib/utils';
import {
  ArrowLeft, Clock, User, Car, CheckCircle, XCircle, 
  Camera, Package, FileText, Loader2, AlertTriangle, Image as ImageIcon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function QCReviewPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // QC Form state
  const [qualityScore, setQualityScore] = useState(5);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [failedItems, setFailedItems] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Data state
  const [beforePhotos, setBeforePhotos] = useState<any[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<any[]>([]);
  const [duringPhotos, setDuringPhotos] = useState<any[]>([]);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [partsUsed, setPartsUsed] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [mechanic, setMechanic] = useState<any>(null);

  const checklistItems = [
    'Before images uploaded',
    'After images uploaded',
    'Progress images uploaded',
    'All parts documented',
    'Service completed as requested',
    'No warning lights',
    'Test drive completed',
    'Car cleaned',
    'Documents ready',
    'No additional issues found'
  ];

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  async function fetchJobDetails() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Fetch lead details
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select(`
          *,
          mechanic:assigned_mechanic_id(id, full_name, profile_image),
          supervisor:assigned_supervisor_id(id, full_name)
        `)
        .eq('id', jobId)
        .single();

      if (leadError) throw leadError;
      
      // Fetch service type names from service_types table (using service_type_ids JSONB)
      if (leadData?.service_type_ids) {
        try {
          let serviceTypeIds = leadData.service_type_ids;
          
          // Parse if it's a string
          if (typeof serviceTypeIds === 'string') {
            serviceTypeIds = JSON.parse(serviceTypeIds);
          }
          
          // Ensure it's an array and has data
          if (Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
            const { data: serviceTypes } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceTypeIds);
            
            leadData.service_type_names = serviceTypes?.map(st => st.name) || [];
          }
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
          leadData.service_type_names = [];
        }
      }
      
      // Fetch sub-service names from service_addons table (using subservice_ids JSONB)
      if (leadData?.subservice_ids) {
        try {
          let subserviceIds = leadData.subservice_ids;
          
          // Parse if it's a string
          if (typeof subserviceIds === 'string') {
            subserviceIds = JSON.parse(subserviceIds);
          }
          
          // Ensure it's an array and has data
          if (Array.isArray(subserviceIds) && subserviceIds.length > 0) {
            const { data: subservices } = await supabase
              .from('service_addons')
              .select('id, name')
              .in('id', subserviceIds);
            
            leadData.subservice_names = subservices?.map(ss => ss.name) || [];
          }
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
          leadData.subservice_names = [];
        }
      }
      
      setLead(leadData);

      // Fetch mechanic details
      if (leadData?.assigned_mechanic_id) {
        const { data: mechanicData } = await supabase
          .from('users_login')
          .select('id, full_name, profile_image')
          .eq('id', leadData.assigned_mechanic_id)
          .single();
        setMechanic(mechanicData);
      }

      // Fetch photos from mechanic_job_photos table (primary source)
      const { data: jobPhotosData, error: jobPhotosError } = await supabase
        .from('mechanic_job_photos')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!jobPhotosError && jobPhotosData) {
        const before = jobPhotosData.filter(p => p.photo_category === 'before');
        const after = jobPhotosData.filter(p => p.photo_category === 'after');
        const during = jobPhotosData.filter(p => p.photo_category === 'during');
        setBeforePhotos(before);
        setAfterPhotos(after);
        setDuringPhotos(during);
      }

      // Also try fetching from lead_media table as fallback
      const { data: photosData, error: photosError } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!photosError && photosData) {
        const beforeFromLeadMedia = photosData
          .filter(p => p.category === 'BEFORE')
          .map(p => ({ ...p, photo_url: p.file_url })); // Map file_url to photo_url
        const afterFromLeadMedia = photosData
          .filter(p => p.category === 'AFTER')
          .map(p => ({ ...p, photo_url: p.file_url }));
        const duringFromLeadMedia = photosData
          .filter(p => p.category === 'PROGRESS' || p.category === 'DURING')
          .map(p => ({ ...p, photo_url: p.file_url }));
        
        // Merge with existing photos if any
        if (beforeFromLeadMedia.length > 0) {
          setBeforePhotos(prev => [...prev, ...beforeFromLeadMedia]);
        }
        if (afterFromLeadMedia.length > 0) {
          setAfterPhotos(prev => [...prev, ...afterFromLeadMedia]);
        }
        if (duringFromLeadMedia.length > 0) {
          setDuringPhotos(prev => [...prev, ...duringFromLeadMedia]);
        }
      }

      // Also try fetching from mechanic_media table as additional fallback
      const { data: mechanicMediaData, error: mechanicMediaError } = await supabase
        .from('mechanic_media')
        .select('*')
        .eq('lead_id', jobId)
        .order('uploaded_at', { ascending: false });

      if (!mechanicMediaError && mechanicMediaData) {
        const beforeFromMechanic = mechanicMediaData
          .filter(p => p.media_category === 'BEFORE')
          .map(p => ({ ...p, photo_url: p.media_url })); // Map media_url to photo_url
        const afterFromMechanic = mechanicMediaData
          .filter(p => p.media_category === 'AFTER')
          .map(p => ({ ...p, photo_url: p.media_url }));
        const duringFromMechanic = mechanicMediaData
          .filter(p => p.media_category === 'PROGRESS' || p.media_category === 'DURING')
          .map(p => ({ ...p, photo_url: p.media_url }));
        
        // Merge with existing photos if any
        if (beforeFromMechanic.length > 0) {
          setBeforePhotos(prev => [...prev, ...beforeFromMechanic]);
        }
        if (afterFromMechanic.length > 0) {
          setAfterPhotos(prev => [...prev, ...afterFromMechanic]);
        }
        if (duringFromMechanic.length > 0) {
          setDuringPhotos(prev => [...prev, ...duringFromMechanic]);
        }
      }

      // Fetch parts used
      const { data: partsData, error: partsError } = await supabase
        .from('mechanic_parts_usage')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!partsError && partsData) {
        setPartsUsed(partsData);
      }

      // Fetch checklist
      if (leadData?.assigned_mechanic_id) {
        const { data: checklistData, error: checklistError } = await supabase
          .from('service_checklists')
          .select('*')
          .eq('lead_id', jobId)
          .eq('mechanic_id', leadData.assigned_mechanic_id)
          .maybeSingle();

        if (!checklistError && checklistData?.checklist_items) {
          let items = checklistData.checklist_items;
          if (typeof items === 'string') {
            try {
              items = JSON.parse(items);
            } catch (e) {
              items = [];
            }
          }
          setChecklist(items);
        }
      }
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      setError(err.message);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!lead) {
      toast.error('Lead data not loaded');
      return;
    }

    console.log('Approving QC for job:', jobId, {
      qualityScore,
      approvalNotes,
      leadStatus: lead.status,
      qcStatus: lead.qc_status
    });

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/approve-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: approvalNotes,
          quality_score: qualityScore
        })
      });

      const data = await response.json();
      console.log('Approve QC response:', { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || data.details || 'Failed to approve QC';
        console.error('QC approval failed:', { status: response.status, error: errorMsg, data });
        throw new Error(errorMsg);
      }

      toast.success('QC approved successfully!');
      router.push('/dashboard/workshop_supervisor/qc-queue');
    } catch (error: any) {
      console.error('Error approving QC:', error);
      toast.error(error.message || 'Failed to approve QC');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!lead || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/reject-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          failed_checklist_items: failedItems,
          notes: approvalNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject QC');
      }

      toast.success('QC rejected - Job sent back to mechanic');
      router.push('/dashboard/workshop_supervisor/qc-queue');
    } catch (error: any) {
      console.error('Error rejecting QC:', error);
      toast.error(error.message || 'Failed to reject QC');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !lead) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Error loading job details: {error}</p>
          <button onClick={() => router.back()} className="btn btn-primary mt-3">
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="btn btn-outline flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-heading">QC Review: {lead.lead_number}</h1>
              <p className="text-sm text-gray-600 mt-1">Review and approve completed work</p>
            </div>
          </div>
        </div>

        {/* Job Summary */}
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-bold text-lg">{lead.customer_name}</p>
              <p className="text-sm text-gray-600">{lead.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vehicle</p>
              <p className="font-bold text-lg">{lead.vehicle_number}</p>
              <p className="text-sm text-gray-600">{lead.vehicle_make} {lead.vehicle_model}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Mechanic</p>
              <p className="font-bold text-lg">{mechanic?.full_name || 'Unknown'}</p>
              {lead.mechanic_completed_at && (
                <p className="text-sm text-gray-600">
                  Completed: {formatDateTime(lead.mechanic_completed_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Service Details</h3>
          <div className="space-y-2">
            {/* Display Service Types */}
            {lead.service_type_names && lead.service_type_names.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                <div>
                  <p className="text-gray-900 font-semibold">Service Types:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {lead.service_type_names.map((name: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Display Sub-Services/Addons */}
            {lead.subservice_names && lead.subservice_names.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full mt-2"></span>
                <div>
                  <p className="text-gray-900 font-semibold">Add-ons / Sub-Services:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {lead.subservice_names.map((name: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Fallback: Display raw service_type if names not available */}
            {(!lead.service_type_names || lead.service_type_names.length === 0) && !lead.subservice_names && (
              <p className="text-gray-700">{lead.service_type || 'General Service'}</p>
            )}
          </div>
          {lead.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-1">Work Summary:</p>
              <p className="text-sm text-gray-600">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Photos Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Before Photos */}
          <div className="card border-2 border-blue-300">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-700">
              <Camera className="w-5 h-5" />
              Before Photos ({beforePhotos.length})
            </h3>
            {beforePhotos.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllPhotos(v => !v)}
                className="text-xs text-blue-700 underline mb-2"
              >
                {showAllPhotos ? 'Show less' : 'Show all'}
              </button>
            )}
            {beforePhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(showAllPhotos ? beforePhotos : beforePhotos.slice(0, 4)).map((photo: any) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.photo_url || photo.file_url || photo.media_url}
                      alt="Before"
                      className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                      onClick={() => window.open(photo.photo_url || photo.file_url || photo.media_url, '_blank')}
                    />
                    <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No before photos</p>
              </div>
            )}
          </div>

          {/* During Photos */}
          <div className="card border-2 border-orange-300">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-orange-700">
              <Camera className="w-5 h-5" />
              During Photos ({duringPhotos.length})
            </h3>
            {duringPhotos.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllPhotos(v => !v)}
                className="text-xs text-orange-700 underline mb-2"
              >
                {showAllPhotos ? 'Show less' : 'Show all'}
              </button>
            )}
            {duringPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(showAllPhotos ? duringPhotos : duringPhotos.slice(0, 4)).map((photo: any) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.photo_url || photo.file_url || photo.media_url}
                      alt="During"
                      className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                      onClick={() => window.open(photo.photo_url || photo.file_url || photo.media_url, '_blank')}
                    />
                    <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No during photos</p>
              </div>
            )}
          </div>

          {/* After Photos */}
          <div className="card border-2 border-green-300">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-green-700">
              <Camera className="w-5 h-5" />
              After Photos ({afterPhotos.length})
            </h3>
            {afterPhotos.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllPhotos(v => !v)}
                className="text-xs text-green-700 underline mb-2"
              >
                {showAllPhotos ? 'Show less' : 'Show all'}
              </button>
            )}
            {afterPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(showAllPhotos ? afterPhotos : afterPhotos.slice(0, 4)).map((photo: any) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.photo_url || photo.file_url || photo.media_url}
                      alt="After"
                      className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                      onClick={() => window.open(photo.photo_url || photo.file_url || photo.media_url, '_blank')}
                    />
                    <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No after photos</p>
              </div>
            )}
          </div>
        </div>

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Service Checklist</h3>
            <div className="space-y-2">
              {checklist.map((item: any, index: number) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-2 rounded ${
                    item.status === 'COMPLETED' ? 'bg-green-50' : 'bg-gray-50'
                  }`}
                >
                  {item.status === 'COMPLETED' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                  )}
                  <span className={`flex-1 ${
                    item.status === 'COMPLETED' ? 'text-green-800' : 'text-gray-700'
                  }`}>
                    {item.name || item.item_name || `Item ${index + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parts Used */}
        {partsUsed.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Parts Used ({partsUsed.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Part Name</th>
                    <th className="text-left p-2">Part Code</th>
                    <th className="text-right p-2">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {partsUsed.map((part: any) => (
                    <tr key={part.id} className="border-b">
                      <td className="p-2">{part.part_name}</td>
                      <td className="p-2 text-gray-600">{part.part_code || '-'}</td>
                      <td className="p-2 text-right">{part.quantity || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* QC Approval Form */}
        <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <h3 className="text-xl font-bold mb-4 text-green-800">Quality Check Review</h3>
          
          {/* Quality Score */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality Score (1-5)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() => setQualityScore(score)}
                  className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                    qualityScore === score
                      ? 'border-green-600 bg-green-100 text-green-700'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          {/* Approval Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Notes (Optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Any notes or feedback..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={processing}
              className="btn bg-green-600 hover:bg-green-700 text-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Approve QC
                </>
              )}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={processing}
              className="btn bg-red-600 hover:bg-red-700 text-white flex-1 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject QC
            </button>
          </div>

          {(beforePhotos.length === 0 || afterPhotos.length === 0) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Missing photos: Before ({beforePhotos.length}), After ({afterPhotos.length})
              </p>
            </div>
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-red-600">Reject Quality Check</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={3}
                    placeholder="Explain what needs to be fixed..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Failed Checklist Items
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {checklistItems.map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={failedItems.includes(item)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFailedItems([...failedItems, item]);
                            } else {
                              setFailedItems(failedItems.filter(i => i !== item));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
                >
                  {processing ? 'Rejecting...' : 'Reject & Send Back'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                    setFailedItems([]);
                  }}
                  disabled={processing}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

